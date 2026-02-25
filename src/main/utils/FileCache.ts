import * as fs from 'fs'
import * as crypto from 'crypto'

interface CacheEntry<T> {
  data: T
  mtime: number
  size: number
  hash: string
  createdAt: number
  hits: number
}

interface CacheStats {
  hits: number
  misses: number
  size: number
  entries: number
}

export class FileCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private maxEntries: number
  private maxMemoryMB: number
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, entries: 0 }

  constructor(maxEntries: number = 1000, maxMemoryMB: number = 100) {
    this.maxEntries = maxEntries
    this.maxMemoryMB = maxMemoryMB
  }

  private computeHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex')
  }

  private estimateSize(data: any): number {
    return JSON.stringify(data).length
  }

  private evictIfNeeded(): void {
    while (this.cache.size >= this.maxEntries || this.stats.size > this.maxMemoryMB * 1024 * 1024) {
      let oldestKey: string | null = null
      let oldestTime = Infinity

      for (const [key, entry] of this.cache) {
        if (entry.createdAt < oldestTime) {
          oldestTime = entry.createdAt
          oldestKey = key
        }
      }

      if (oldestKey) {
        const entry = this.cache.get(oldestKey)
        if (entry) {
          this.stats.size -= entry.size
          this.stats.entries--
        }
        this.cache.delete(oldestKey)
      } else {
        break
      }
    }
  }

  async get<T>(filePath: string): Promise<T | null> {
    try {
      const stat = await fs.promises.stat(filePath)
      const cached = this.cache.get(filePath)

      if (cached && cached.mtime === stat.mtimeMs) {
        cached.hits++
        this.stats.hits++
        return cached.data as T
      }

      this.stats.misses++
      return null
    } catch {
      this.stats.misses++
      return null
    }
  }

  async set<T>(filePath: string, data: T): Promise<void> {
    try {
      const stat = await fs.promises.stat(filePath)
      const content = typeof data === 'string' ? data : JSON.stringify(data)
      const size = this.estimateSize(data)

      this.evictIfNeeded()

      this.cache.set(filePath, {
        data,
        mtime: stat.mtimeMs,
        size,
        hash: this.computeHash(content),
        createdAt: Date.now(),
        hits: 0
      })

      this.stats.size += size
      this.stats.entries++
    } catch (error) {
      console.error(`[FileCache] Failed to cache ${filePath}:`, error)
    }
  }

  async getOrLoad<T>(filePath: string, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(filePath)
    if (cached !== null) {
      return cached
    }

    const data = await loader()
    await this.set(filePath, data)
    return data
  }

  async readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    const cached = await this.get<string>(filePath)
    if (cached !== null) {
      return cached
    }

    const content = await fs.promises.readFile(filePath, encoding)
    await this.set(filePath, content)
    return content
  }

  async readJson<T = any>(filePath: string): Promise<T> {
    const cached = await this.get<T>(filePath)
    if (cached !== null) {
      return cached
    }

    const content = await fs.promises.readFile(filePath, 'utf8')
    const data = JSON.parse(content) as T
    await this.set(filePath, data)
    return data
  }

  invalidate(filePath: string): boolean {
    const entry = this.cache.get(filePath)
    if (entry) {
      this.stats.size -= entry.size
      this.stats.entries--
      this.cache.delete(filePath)
      return true
    }
    return false
  }

  invalidatePattern(pattern: RegExp): number {
    let count = 0
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.invalidate(key)
        count++
      }
    }
    return count
  }

  clear(): void {
    this.cache.clear()
    this.stats = { hits: 0, misses: 0, size: 0, entries: 0 }
  }

  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0
    }
  }

  getEntries(): string[] {
    return Array.from(this.cache.keys())
  }
}

export const fileCache = new FileCache()

export class ProjectFileCache {
  private caches: Map<string, FileCache> = new Map()

  getCache(projectPath: string): FileCache {
    let cache = this.caches.get(projectPath)
    if (!cache) {
      cache = new FileCache(500, 50)
      this.caches.set(projectPath, cache)
    }
    return cache
  }

  clearProject(projectPath: string): void {
    const cache = this.caches.get(projectPath)
    if (cache) {
      cache.clear()
      this.caches.delete(projectPath)
    }
  }

  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear()
    }
    this.caches.clear()
  }
}

export const projectFileCache = new ProjectFileCache()
