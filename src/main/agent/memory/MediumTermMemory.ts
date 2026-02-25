/**
 * Medium Term Memory
 * 中期记忆 - 任务级状态
 */

import { MemoryEntry } from './MemoryService'

export interface MediumTermMemoryOptions {
  maxSize: number
  ttl: number
}

export class MediumTermMemory {
  private entries: Map<string, MemoryEntry> = new Map()
  private options: MediumTermMemoryOptions

  constructor(options: MediumTermMemoryOptions) {
    this.options = options
  }

  /**
   * 添加记忆
   */
  add(entry: MemoryEntry): MemoryEntry {
    // 检查是否超过最大容量
    if (this.entries.size >= this.options.maxSize) {
      this.evictLRU()
    }

    // 设置过期时间
    entry.expiresAt = Date.now() + this.options.ttl
    
    this.entries.set(entry.id, entry)

    return entry
  }

  /**
   * 获取记忆
   */
  get(id: string): MemoryEntry | undefined {
    const entry = this.entries.get(id)
    
    if (entry) {
      // 检查是否过期
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.remove(id)
        return undefined
      }
    }

    return entry
  }

  /**
   * 获取所有记忆
   */
  getAll(): MemoryEntry[] {
    const now = Date.now()
    const validEntries: MemoryEntry[] = []

    for (const entry of this.entries.values()) {
      if (!entry.expiresAt || now <= entry.expiresAt) {
        validEntries.push(entry)
      } else {
        this.entries.delete(entry.id)
      }
    }

    // 按时间排序
    return validEntries.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 移除记忆
   */
  remove(id: string): boolean {
    return this.entries.delete(id)
  }

  /**
   * 清理过期记忆
   */
  cleanup(): void {
    const now = Date.now()
    const toRemove: string[] = []

    for (const [id, entry] of this.entries.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        toRemove.push(id)
      }
    }

    for (const id of toRemove) {
      this.remove(id)
    }
  }

  /**
   * 清空所有记忆
   */
  clear(): void {
    this.entries.clear()
  }

  /**
   * 获取大小
   */
  size(): number {
    return this.entries.size
  }

  /**
   * LRU 驱逐
   */
  private evictLRU(): void {
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
}