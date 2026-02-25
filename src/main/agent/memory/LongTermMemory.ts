/**
 * Long Term Memory
 * 长期记忆 - 持久化知识
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { MemoryEntry } from './MemoryService'

export interface LongTermMemoryOptions {
  maxSize: number
  storagePath?: string
}

export class LongTermMemory {
  private entries: Map<string, MemoryEntry> = new Map()
  private options: LongTermMemoryOptions
  private storagePath: string

  constructor(options: LongTermMemoryOptions) {
    this.options = options
    this.storagePath = options.storagePath || this.getDefaultStoragePath()
    this.load()
  }

  /**
   * 获取默认存储路径
   */
  private getDefaultStoragePath(): string {
    try {
      return path.join(app.getPath('userData'), 'long-term-memory.json')
    } catch {
      return path.join(process.cwd(), 'long-term-memory.json')
    }
  }

  /**
   * 添加记忆
   */
  add(entry: MemoryEntry): MemoryEntry {
    // 检查是否超过最大容量
    if (this.entries.size >= this.options.maxSize) {
      this.evictOldest()
    }

    this.entries.set(entry.id, entry)
    this.persist()

    return entry
  }

  /**
   * 获取记忆
   */
  get(id: string): MemoryEntry | undefined {
    return this.entries.get(id)
  }

  /**
   * 获取所有记忆
   */
  getAll(): MemoryEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 搜索记忆
   */
  search(keywords: string[]): MemoryEntry[] {
    const results: MemoryEntry[] = []

    for (const entry of this.entries.values()) {
      const contentStr = JSON.stringify(entry.content).toLowerCase()
      
      if (keywords.some(keyword => contentStr.includes(keyword.toLowerCase()))) {
        results.push(entry)
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 移除记忆
   */
  remove(id: string): boolean {
    const result = this.entries.delete(id)
    if (result) {
      this.persist()
    }
    return result
  }

  /**
   * 清理过期记忆（长期记忆可以有选择性地清理）
   */
  cleanup(): void {
    // 长期记忆默认不自动清理
    // 可以由用户手动触发
  }

  /**
   * 清空所有记忆
   */
  clear(): void {
    this.entries.clear()
    this.persist()
  }

  /**
   * 获取大小
   */
  size(): number {
    return this.entries.size
  }

  /**
   * 驱逐最旧的记忆
   */
  private evictOldest(): void {
    let oldestId: string | null = null
    let oldestTime = Date.now()

    for (const [id, entry] of this.entries.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestId = id
      }
    }

    if (oldestId) {
      this.entries.delete(oldestId)
    }
  }

  /**
   * 持久化到磁盘
   */
  private persist(): void {
    try {
      const data = JSON.stringify(Array.from(this.entries.entries()))
      fs.writeFileSync(this.storagePath, data, 'utf8')
    } catch (error) {
      console.error('Failed to persist long-term memory:', error)
    }
  }

  /**
   * 从磁盘加载
   */
  private load(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8')
        const entries = JSON.parse(data) as [string, MemoryEntry][]
        this.entries = new Map(entries)
      }
    } catch (error) {
      console.error('Failed to load long-term memory:', error)
      this.entries = new Map()
    }
  }

  /**
   * 导出记忆
   */
  export(): string {
    return JSON.stringify(Array.from(this.entries.entries()), null, 2)
  }

  /**
   * 导入记忆
   */
  import(data: string): void {
    try {
      const entries = JSON.parse(data) as [string, MemoryEntry][]
      for (const [id, entry] of entries) {
        this.entries.set(id, entry)
      }
      this.persist()
    } catch (error) {
      console.error('Failed to import memory:', error)
    }
  }
}