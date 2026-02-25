/**
 * Short Term Memory
 * 短期记忆 - 当前会话上下文
 */

import { MemoryEntry } from './MemoryService'

export interface ShortTermMemoryOptions {
  maxSize: number
  ttl: number
}

export class ShortTermMemory {
  private entries: Map<string, MemoryEntry> = new Map()
  private options: ShortTermMemoryOptions
  private accessOrder: string[] = []

  constructor(options: ShortTermMemoryOptions) {
    this.options = options
  }

  /**
   * 添加记忆
   */
  add(entry: MemoryEntry): MemoryEntry {
    // 检查是否超过最大容量
    if (this.entries.size >= this.options.maxSize) {
      this.evict()
    }

    // 设置过期时间
    entry.expiresAt = Date.now() + this.options.ttl
    
    this.entries.set(entry.id, entry)
    this.accessOrder.push(entry.id)

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

      // 更新访问顺序
      const index = this.accessOrder.indexOf(id)
      if (index > -1) {
        this.accessOrder.splice(index, 1)
        this.accessOrder.push(id)
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

      // 按访问顺序排序
      validEntries.sort((a, b) => {
        const indexA = this.accessOrder.indexOf(a.id)
        const indexB = this.accessOrder.indexOf(b.id)
        return indexB - indexA
      })
    }

    return validEntries
  }

  /**
   * 移除记忆
   */
  remove(id: string): boolean {
    const index = this.accessOrder.indexOf(id)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
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
    this.accessOrder = []
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
  private evict(): void {
    if (this.accessOrder.length > 0) {
      const oldestId = this.accessOrder.shift()
      if (oldestId) {
        this.entries.delete(oldestId)
      }
    }
  }
}