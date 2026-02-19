/**
 * 长期记忆服务
 * 提供跨会话的知识保持和语义检索能力
 * 使用简单的向量嵌入实现语义搜索
 */

import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { llmService } from '../services/LLMService'

// 记忆条目类型
export enum MemoryType {
  CONVERSATION = 'conversation',     // 对话记忆
  FACT = 'fact',                     // 事实知识
  PREFERENCE = 'preference',         // 用户偏好
  SKILL = 'skill',                   // 技能知识
  PROJECT = 'project',               // 项目知识
  CUSTOM = 'custom'                  // 自定义
}

// 记忆条目
export interface MemoryEntry {
  id: string
  type: MemoryType
  content: string
  embedding?: number[]
  metadata: {
    source?: string
    tags?: string[]
    importance?: number
    createdAt: number
    updatedAt?: number
    lastAccessedAt?: number
    accessCount?: number
  }
}

// 记忆搜索结果
export interface MemorySearchResult {
  entry: MemoryEntry
  similarity: number
  distance: number
}

// 记忆服务选项
export interface MemoryServiceOptions {
  maxEntries?: number           // 最大记忆条目数
  embeddingDimension?: number   // 向量维度
  similarityThreshold?: number  // 相似度阈值
  autoCleanup?: boolean         // 自动清理旧记忆
  retentionDays?: number        // 保留天数
}

// 记忆统计
export interface MemoryStats {
  totalEntries: number
  byType: Record<MemoryType, number>
  oldestEntry?: number
  newestEntry?: number
  averageImportance: number
}

// 记忆服务类
export class MemoryService extends EventEmitter {
  private memories: Map<string, MemoryEntry> = new Map()
  private storagePath: string
  private options: Required<MemoryServiceOptions>

  constructor(options: MemoryServiceOptions = {}) {
    super()
    
    this.options = {
      maxEntries: options.maxEntries || 10000,
      embeddingDimension: options.embeddingDimension || 1536,
      similarityThreshold: options.similarityThreshold || 0.7,
      autoCleanup: options.autoCleanup !== false,
      retentionDays: options.retentionDays || 90
    }

    this.storagePath = path.join(app.getPath('userData'), 'memory')
    this.ensureStorageDir()
    this.load()
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true })
    }
  }

  /**
   * 加载记忆
   */
  async load(): Promise<void> {
    try {
      const indexPath = path.join(this.storagePath, 'index.json')
      
      if (fs.existsSync(indexPath)) {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
        
        // 加载所有类型的记忆
        for (const [_type, entries] of Object.entries(data)) {
          for (const entry of entries as MemoryEntry[]) {
            this.memories.set(entry.id, entry)
          }
        }

        console.log(`[Memory] Loaded ${this.memories.size} memories`)
        this.emit('loaded', { count: this.memories.size })
      } else {
        console.log('[Memory] No existing memory found, starting fresh')
      }
    } catch (e) {
      console.error('[Memory] Failed to load:', e)
    }
  }

  /**
   * 保存记忆
   */
  private save(): void {
    try {
      // 按类型分组
      const byType: Record<string, MemoryEntry[]> = {} as any
      
      for (const entry of this.memories.values()) {
        if (!byType[entry.type]) {
          byType[entry.type] = []
        }
        byType[entry.type].push(entry)
      }

      const indexPath = path.join(this.storagePath, 'index.json')
      fs.writeFileSync(indexPath, JSON.stringify(byType, null, 2))
      
      this.emit('saved', { count: this.memories.size })
    } catch (e) {
      console.error('[Memory] Failed to save:', e)
    }
  }

  /**
   * 生成嵌入向量（简化版本，使用LLM）
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // 尝试使用OpenAI的text-embedding-ada-002
      const apiKey = llmService.getApiKey('openai')
      
      if (apiKey) {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'text-embedding-ada-002',
            input: text
          })
        })

        const data = await response.json()
        return data.data[0].embedding
      }
    } catch (e) {
      console.error('[Memory] Failed to generate embedding:', e)
    }

    // 如果失败，返回随机向量（仅用于演示）
    return Array(this.options.embeddingDimension).fill(0).map(() => Math.random() * 2 - 1)
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    if (normA === 0 || normB === 0) return 0
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * 添加记忆
   */
  async add(
    content: string,
    type: MemoryType,
    options?: {
      source?: string
      tags?: string[]
      importance?: number
      generateEmbedding?: boolean
    }
  ): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      metadata: {
        source: options?.source,
        tags: options?.tags || [],
        importance: options?.importance ?? 0.5,
        createdAt: Date.now(),
        accessCount: 0
      }
    }

    // 生成嵌入向量
    if (options?.generateEmbedding !== false) {
      entry.embedding = await this.generateEmbedding(content)
    }

    // 检查是否需要清理
    if (this.memories.size >= this.options.maxEntries) {
      await this.cleanup()
    }

    this.memories.set(entry.id, entry)
    this.save()
    
    this.emit('memoryAdded', entry)
    
    return entry
  }

  /**
   * 搜索记忆
   */
  async search(
    query: string,
    options?: {
      type?: MemoryType
      limit?: number
      minSimilarity?: number
      tags?: string[]
    }
  ): Promise<MemorySearchResult[]> {
    const limit = options?.limit || 10
    const minSimilarity = options?.minSimilarity || this.options.similarityThreshold

    // 为查询生成嵌入
    const queryEmbedding = await this.generateEmbedding(query)

    const results: MemorySearchResult[] = []

    for (const entry of this.memories.values()) {
      // 过滤类型
      if (options?.type && entry.type !== options.type) {
        continue
      }

      // 过滤标签
      if (options?.tags?.length) {
        const hasTag = options.tags.some(tag => 
          entry.metadata.tags?.includes(tag)
        )
        if (!hasTag) continue
      }

      // 计算相似度
      let similarity = 0
      
      if (entry.embedding && queryEmbedding) {
        similarity = this.cosineSimilarity(entry.embedding, queryEmbedding)
      } else {
        // 如果没有嵌入，使用简单的文本匹配
        const queryLower = query.toLowerCase()
        const contentLower = entry.content.toLowerCase()
        
        // 检查关键词匹配
        const queryWords = queryLower.split(/\s+/)
        let matchCount = 0
        for (const word of queryWords) {
          if (word.length > 2 && contentLower.includes(word)) {
            matchCount++
          }
        }
        similarity = matchCount / queryWords.length
      }

      if (similarity >= minSimilarity) {
        // 更新访问统计
        entry.metadata.lastAccessedAt = Date.now()
        entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1
        
        results.push({
          entry,
          similarity,
          distance: 1 - similarity
        })
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity)

    return results.slice(0, limit)
  }

  /**
   * 获取记忆
   */
  get(id: string): MemoryEntry | undefined {
    const entry = this.memories.get(id)
    
    if (entry) {
      entry.metadata.lastAccessedAt = Date.now()
      entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1
    }
    
    return entry
  }

  /**
   * 更新记忆
   */
  async update(id: string, content: string, options?: {
    tags?: number[]
    importance?: number
  }): Promise<MemoryEntry | undefined> {
    const entry = this.memories.get(id)
    
    if (!entry) {
      return undefined
    }

    // 重新生成嵌入
    entry.embedding = await this.generateEmbedding(content)
    entry.content = content
    entry.metadata.updatedAt = Date.now()

    if (options?.tags !== undefined) {
      entry.metadata.tags = options.tags as any
    }

    if (options?.importance !== undefined) {
      entry.metadata.importance = options.importance
    }

    this.save()
    this.emit('memoryUpdated', entry)
    
    return entry
  }

  /**
   * 删除记忆
   */
  delete(id: string): boolean {
    const deleted = this.memories.delete(id)
    
    if (deleted) {
      this.save()
      this.emit('memoryDeleted', { id })
    }
    
    return deleted
  }

  /**
   * 按类型获取记忆
   */
  getByType(type: MemoryType): MemoryEntry[] {
    return Array.from(this.memories.values())
      .filter(entry => entry.type === type)
      .sort((a, b) => (b.metadata.accessCount || 0) - (a.metadata.accessCount || 0))
  }

  /**
   * 获取统计信息
   */
  getStats(): MemoryStats {
    const entries = Array.from(this.memories.values())
    
    const byType: Record<MemoryType, number> = {} as any
    let totalImportance = 0
    let oldest = Infinity
    let newest = 0

    for (const entry of entries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1
      totalImportance += entry.metadata.importance || 0
      
      if (entry.metadata.createdAt < oldest) {
        oldest = entry.metadata.createdAt
      }
      if (entry.metadata.createdAt > newest) {
        newest = entry.metadata.createdAt
      }
    }

    return {
      totalEntries: entries.length,
      byType,
      oldestEntry: oldest === Infinity ? undefined : oldest,
      newestEntry: newest,
      averageImportance: entries.length > 0 ? totalImportance / entries.length : 0
    }
  }

  /**
   * 清理旧记忆
   */
  private async cleanup(): Promise<number> {
    const now = Date.now()
    const retentionMs = this.options.retentionDays * 24 * 60 * 60 * 1000
    
    let deleted = 0

    for (const [id, entry] of this.memories) {
      // 删除过期记忆
      if (now - entry.metadata.createdAt > retentionMs) {
        this.memories.delete(id)
        deleted++
        continue
      }

      // 删除低重要性的记忆（如果超过最大数量）
      if (this.memories.size > this.options.maxEntries && 
          (entry.metadata.importance || 0) < 0.3 &&
          (entry.metadata.accessCount || 0) < 3) {
        this.memories.delete(id)
        deleted++
      }
    }

    if (deleted > 0) {
      this.save()
      this.emit('cleanup', { deleted, remaining: this.memories.size })
    }

    return deleted
  }

  /**
   * 导出记忆
   */
  export(options?: {
    type?: MemoryType
    format?: 'json' | 'markdown'
  }): string {
    let entries = Array.from(this.memories.values())

    if (options?.type) {
      entries = entries.filter(e => e.type === options.type)
    }

    if (options?.format === 'markdown') {
      return entries.map(e => 
        `# ${e.type}\n\n${e.content}\n\n---\n*Created: ${new Date(e.metadata.createdAt).toLocaleString()}*`
      ).join('\n\n')
    }

    return JSON.stringify(entries, null, 2)
  }

  /**
   * 导入记忆
   */
  async import(data: string, options?: {
    merge?: boolean
  }): Promise<number> {
    try {
      const entries = JSON.parse(data) as MemoryEntry[]
      let imported = 0

      if (!options?.merge) {
        this.memories.clear()
      }

      for (const entry of entries) {
        // 重新生成嵌入
        entry.embedding = await this.generateEmbedding(entry.content)
        
        this.memories.set(entry.id, entry)
        imported++
      }

      this.save()
      this.emit('imported', { count: imported })
      
      return imported
    } catch (e) {
      console.error('[Memory] Import failed:', e)
      return 0
    }
  }

  /**
   * 清空所有记忆
   */
  clear(type?: MemoryType): number {
    if (type) {
      let deleted = 0
      for (const [id, entry] of this.memories) {
        if (entry.type === type) {
          this.memories.delete(id)
          deleted++
        }
      }
      this.save()
      return deleted
    }

    const count = this.memories.size
    this.memories.clear()
    this.save()
    this.emit('cleared')
    
    return count
  }

  /**
   * 记录对话
   */
  async rememberConversation(messages: Array<{
    role: string
    content: string
  }>, context?: string): Promise<void> {
    const summary = messages.map(m => 
      `${m.role}: ${m.content.substring(0, 100)}`
    ).join('\n')

    await this.add(
      context ? `${context}\n\n${summary}` : summary,
      MemoryType.CONVERSATION,
      {
        source: 'conversation',
        importance: 0.4
      }
    )
  }

  /**
   * 记住用户偏好
   */
  async rememberPreference(
    key: string,
    value: string,
    reason?: string
  ): Promise<void> {
    const content = reason 
      ? `用户偏好: ${key} = ${value} (原因: ${reason})`
      : `用户偏好: ${key} = ${value}`

    await this.add(content, MemoryType.PREFERENCE, {
      source: 'user_feedback',
      tags: [key],
      importance: 0.8
    })
  }

  /**
   * 获取相关记忆用于上下文
   */
  async getContextForQuery(query: string, _maxTokens?: number): Promise<string> {
    const results = await this.search(query, { limit: 5 })
    
    if (results.length === 0) {
      return ''
    }

    let context = '相关记忆:\n'
    
    for (const result of results) {
      context += `- ${result.entry.content}\n`
    }

    return context
  }
}

// 导出单例
export const memoryService = new MemoryService()
