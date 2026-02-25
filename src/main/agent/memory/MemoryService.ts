/**
 * Unified Memory Service
 * 统一记忆服务 - 三级记忆架构
 * - 短期记忆：当前会话上下文
 * - 中期记忆：任务级状态
 * - 长期记忆：持久化知识
 */

import { EventEmitter } from 'events'
import { ShortTermMemory } from './ShortTermMemory'
import { MediumTermMemory } from './MediumTermMemory'
import { LongTermMemory } from './LongTermMemory'

export interface MemoryEntry {
  id: string
  type: 'short' | 'medium' | 'long'
  content: any
  timestamp: number
  expiresAt?: number
  metadata?: Record<string, any>
}

export interface MemoryQuery {
  type?: 'short' | 'medium' | 'long' | 'all'
  keywords?: string[]
  limit?: number
  since?: number
}

export interface MemoryServiceOptions {
  shortTermMaxSize?: number
  shortTermTTL?: number
  mediumTermMaxSize?: number
  mediumTermTTL?: number
  longTermMaxSize?: number
}

/**
 * 统一记忆服务
 */
export class MemoryService extends EventEmitter {
  private shortTerm: ShortTermMemory
  private mediumTerm: MediumTermMemory
  private longTerm: LongTermMemory

  constructor(options: MemoryServiceOptions = {}) {
    super()

    this.shortTerm = new ShortTermMemory({
      maxSize: options.shortTermMaxSize || 100,
      ttl: options.shortTermTTL || 3600000 // 1小时
    })

    this.mediumTerm = new MediumTermMemory({
      maxSize: options.mediumTermMaxSize || 1000,
      ttl: options.mediumTermTTL || 86400000 // 24小时
    })

    this.longTerm = new LongTermMemory({
      maxSize: options.longTermMaxSize || 10000
    })
  }

  /**
   * 存储记忆
   */
  async store(content: any, type: 'short' | 'medium' | 'long', metadata?: Record<string, any>): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type,
      content,
      timestamp: Date.now(),
      metadata
    }

    switch (type) {
      case 'short':
        return this.shortTerm.add(entry)
      case 'medium':
        return this.mediumTerm.add(entry)
      case 'long':
        return this.longTerm.add(entry)
    }
  }

  /**
   * 查询记忆
   */
  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = []
    const limit = query.limit || 10

    const types = query.type ? [query.type] : ['short', 'medium', 'long']

    for (const type of types) {
      let entries: MemoryEntry[] = []

      switch (type) {
        case 'short':
          entries = this.shortTerm.getAll()
          break
        case 'medium':
          entries = this.mediumTerm.getAll()
          break
        case 'long':
          entries = this.longTerm.getAll()
          break
      }

      // 过滤
      if (query.keywords && query.keywords.length > 0) {
        entries = entries.filter(entry => 
          query.keywords!.some(keyword => 
            JSON.stringify(entry.content).toLowerCase().includes(keyword.toLowerCase())
          )
        )
      }

      if (query.since) {
        entries = entries.filter(entry => entry.timestamp >= query.since!)
      }

      results.push(...entries)
    }

    // 按时间排序并限制数量
    return results
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  /**
   * 获取短期记忆
   */
  getShortTerm(): ShortTermMemory {
    return this.shortTerm
  }

  /**
   * 获取中期记忆
   */
  getMediumTerm(): MediumTermMemory {
    return this.mediumTerm
  }

  /**
   * 获取长期记忆
   */
  getLongTerm(): LongTermMemory {
    return this.longTerm
  }

  /**
   * 提升记忆到长期
   */
  async promoteToLongTerm(entryId: string): Promise<boolean> {
    const entry = this.mediumTerm.get(entryId)
    if (entry) {
      await this.longTerm.add({
        ...entry,
        type: 'long',
        id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      })
      this.mediumTerm.remove(entryId)
      return true
    }
    return false
  }

  /**
   * 清理过期记忆
   */
  cleanup(): void {
    this.shortTerm.cleanup()
    this.mediumTerm.cleanup()
    // 长期记忆不需要自动清理
  }

  /**
   * 获取记忆统计
   */
  getStats(): { short: number; medium: number; long: number } {
    return {
      short: this.shortTerm.size(),
      medium: this.mediumTerm.size(),
      long: this.longTerm.size()
    }
  }

  /**
   * 清空所有记忆
   */
  clear(): void {
    this.shortTerm.clear()
    this.mediumTerm.clear()
    this.longTerm.clear()
    this.emit('cleared')
  }
}

export const memoryService = new MemoryService()