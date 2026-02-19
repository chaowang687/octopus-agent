/**
 * 短期记忆和工作记忆服务
 * 提供会话期间的信息存储和处理能力
 * 包括短期记忆（最近信息）和工作记忆（当前任务）
 */

import { EventEmitter } from 'events'


// 短期记忆条目类型
export interface ShortTermMemoryEntry {
  id: string
  content: string
  type: 'recent' | 'context' | 'task' | 'result' | 'error'
  metadata: {
    source?: string
    timestamp: number
    importance?: number
    relevanceScore?: number
    accessCount?: number
  }
}

// 工作记忆结构
export interface WorkingMemory {
  task: {
    id: string
    description: string
    context: string
    goals: string[]
    constraints: string[]
  }
  currentState: {
    step: number
    totalSteps: number
    activeTools: string[]
    currentOperation: string
  }
  shortTermMemory: ShortTermMemoryEntry[]
  attentionFocus: {
    current: string
    priority: string[]
    distractions: string[]
  }
  cognitiveLoad: number
  lastUpdated: number
}

// 记忆服务选项
export interface ShortTermMemoryOptions {
  maxShortTermEntries?: number
  maxWorkingMemorySize?: number
  cognitiveLoadLimit?: number
  decayRate?: number
}

// 记忆服务类
export class ShortTermMemoryService extends EventEmitter {
  private shortTermMemories: ShortTermMemoryEntry[] = []
  private workingMemory: WorkingMemory | null = null
  private options: Required<ShortTermMemoryOptions>
  private taskContexts: Map<string, string[]> = new Map()

  constructor(options: ShortTermMemoryOptions = {}) {
    super()
    
    this.options = {
      maxShortTermEntries: options.maxShortTermEntries || 50,
      maxWorkingMemorySize: options.maxWorkingMemorySize || 10000,
      cognitiveLoadLimit: options.cognitiveLoadLimit || 0.8,
      decayRate: options.decayRate || 0.1
    }
  }

  /**
   * 添加短期记忆
   */
  addShortTermMemory(content: string, type: ShortTermMemoryEntry['type'], options?: {
    source?: string
    importance?: number
    relevanceScore?: number
  }): ShortTermMemoryEntry {
    const entry: ShortTermMemoryEntry = {
      id: `stm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      type,
      metadata: {
        source: options?.source,
        timestamp: Date.now(),
        importance: options?.importance ?? 0.5,
        relevanceScore: options?.relevanceScore,
        accessCount: 0
      }
    }

    // 添加到短期记忆
    this.shortTermMemories.unshift(entry)

    // 检查容量
    if (this.shortTermMemories.length > this.options.maxShortTermEntries) {
      this.shortTermMemories = this.shortTermMemories.slice(0, this.options.maxShortTermEntries)
    }

    // 应用记忆衰减
    this.applyMemoryDecay()

    this.emit('memoryAdded', entry)
    return entry
  }

  /**
   * 获取相关短期记忆
   */
  getRelatedMemories(query: string, options?: {
    type?: ShortTermMemoryEntry['type'][]
    limit?: number
    minRelevance?: number
  }): ShortTermMemoryEntry[] {
    const limit = options?.limit || 10
    const types = options?.type
    const minRelevance = options?.minRelevance || 0.3

    // 简单的相关性计算
    const scoredMemories = this.shortTermMemories
      .filter(entry => !types || types.includes(entry.type))
      .map(entry => {
        const relevance = this.calculateRelevance(entry.content, query)
        return {
          entry,
          relevance
        }
      })
      .filter(item => item.relevance >= minRelevance)
      .sort((a, b) => b.relevance - a.relevance)

    // 更新访问计数
    scoredMemories.forEach(item => {
      item.entry.metadata.accessCount = (item.entry.metadata.accessCount || 0) + 1
    })

    return scoredMemories.slice(0, limit).map(item => item.entry)
  }

  /**
   * 初始化工作记忆
   */
  initializeWorkingMemory(taskId: string, description: string, context: string, goals: string[] = [], constraints: string[] = []): WorkingMemory {
    this.workingMemory = {
      task: {
        id: taskId,
        description,
        context,
        goals,
        constraints
      },
      currentState: {
        step: 1,
        totalSteps: goals.length || 1,
        activeTools: [],
        currentOperation: 'initializing'
      },
      shortTermMemory: this.shortTermMemories.slice(0, 10), // 最近的10个记忆
      attentionFocus: {
        current: 'task_initialization',
        priority: ['task_goals', 'constraints', 'context'],
        distractions: []
      },
      cognitiveLoad: 0.1, // 初始认知负荷
      lastUpdated: Date.now()
    }

    this.emit('workingMemoryInitialized', this.workingMemory)
    return this.workingMemory
  }

  /**
   * 更新工作记忆
   */
  updateWorkingMemory(updates: Partial<WorkingMemory>): WorkingMemory {
    if (!this.workingMemory) {
      throw new Error('Working memory not initialized')
    }

    this.workingMemory = {
      ...this.workingMemory,
      ...updates,
      lastUpdated: Date.now()
    }

    // 计算认知负荷
    this.workingMemory.cognitiveLoad = this.calculateCognitiveLoad(this.workingMemory)

    // 检查认知负荷是否超过限制
    if (this.workingMemory.cognitiveLoad > this.options.cognitiveLoadLimit) {
      this.emit('cognitiveLoadExceeded', this.workingMemory.cognitiveLoad)
    }

    this.emit('workingMemoryUpdated', this.workingMemory)
    return this.workingMemory
  }

  /**
   * 获取工作记忆
   */
  getWorkingMemory(): WorkingMemory | null {
    return this.workingMemory
  }

  /**
   * 清除工作记忆
   */
  clearWorkingMemory(): void {
    this.workingMemory = null
    this.emit('workingMemoryCleared')
  }

  /**
   * 保存任务上下文
   */
  saveTaskContext(taskId: string, context: string[]): void {
    this.taskContexts.set(taskId, context)
  }

  /**
   * 获取任务上下文
   */
  getTaskContext(taskId: string): string[] {
    return this.taskContexts.get(taskId) || []
  }

  /**
   * 记录操作
   */
  recordOperation(operation: string, result: string, success: boolean): void {
    const entry: ShortTermMemoryEntry = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: `操作: ${operation}\n结果: ${result}\n成功: ${success}`,
      type: success ? 'result' : 'error',
      metadata: {
        source: 'operation',
        timestamp: Date.now(),
        importance: success ? 0.6 : 0.8
      }
    }

    this.shortTermMemories.unshift(entry)
    this.applyMemoryDecay()

    this.emit('operationRecorded', entry)
  }

  /**
   * 聚焦注意力
   */
  focusAttention(on: string, priority: string[] = [], distractions: string[] = []): void {
    if (this.workingMemory) {
      this.workingMemory.attentionFocus = {
        current: on,
        priority,
        distractions
      }
      this.updateWorkingMemory({ attentionFocus: this.workingMemory.attentionFocus })
    }
  }

  /**
   * 转移注意力
   */
  shiftAttention(to: string): void {
    if (this.workingMemory) {
      this.workingMemory.attentionFocus.current = to
      this.updateWorkingMemory({ attentionFocus: this.workingMemory.attentionFocus })
    }
  }

  /**
   * 计算相关性
   */
  private calculateRelevance(content: string, query: string): number {
    const contentLower = content.toLowerCase()
    const queryLower = query.toLowerCase()

    // 简单的词频匹配
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)
    const contentWords = contentLower.split(/\s+/)

    let matchCount = 0
    for (const word of queryWords) {
      if (contentWords.includes(word)) {
        matchCount++
      }
    }

    return queryWords.length > 0 ? matchCount / queryWords.length : 0
  }

  /**
   * 应用记忆衰减
   */
  private applyMemoryDecay(): void {
    const now = Date.now()
    this.shortTermMemories = this.shortTermMemories
      .map(entry => {
        const age = now - entry.metadata.timestamp
        const decay = Math.exp(-(age / 3600000) * this.options.decayRate) // 按小时衰减
        const importance = (entry.metadata.importance || 0.5) * decay
        
        return {
          ...entry,
          metadata: {
            ...entry.metadata,
            importance
          }
        }
      })
      .filter(entry => entry.metadata.importance > 0.1) // 过滤掉重要性低于0.1的记忆
  }

  /**
   * 计算认知负荷
   */
  private calculateCognitiveLoad(workingMemory: WorkingMemory): number {
    // 基于任务复杂度、当前步骤、活跃工具等因素计算
    const taskComplexity = workingMemory.task.goals.length * 0.1
    const stepProgress = workingMemory.currentState.step / workingMemory.currentState.totalSteps
    const toolComplexity = workingMemory.currentState.activeTools.length * 0.1
    const memoryLoad = workingMemory.shortTermMemory.length * 0.01

    let load = taskComplexity + toolComplexity + memoryLoad
    
    // 步骤进度影响（中间步骤认知负荷最高）
    if (stepProgress > 0.3 && stepProgress < 0.8) {
      load += 0.2
    }

    return Math.min(1.0, load)
  }

  /**
   * 获取短期记忆统计
   */
  getStats(): {
    totalEntries: number
    byType: Record<string, number>
    averageImportance: number
    workingMemoryActive: boolean
  } {
    const byType: Record<string, number> = {}
    let totalImportance = 0

    for (const entry of this.shortTermMemories) {
      byType[entry.type] = (byType[entry.type] || 0) + 1
      totalImportance += entry.metadata.importance || 0
    }

    return {
      totalEntries: this.shortTermMemories.length,
      byType,
      averageImportance: this.shortTermMemories.length > 0 ? totalImportance / this.shortTermMemories.length : 0,
      workingMemoryActive: !!this.workingMemory
    }
  }

  /**
   * 清除所有短期记忆
   */
  clearShortTermMemory(): void {
    this.shortTermMemories = []
    this.emit('shortTermMemoryCleared')
  }

  /**
   * 导出短期记忆
   */
  exportShortTermMemory(): ShortTermMemoryEntry[] {
    return this.shortTermMemories
  }

  /**
   * 导入短期记忆
   */
  importShortTermMemory(memories: ShortTermMemoryEntry[]): void {
    this.shortTermMemories = memories
    this.emit('shortTermMemoryImported', memories.length)
  }

  /**
   * 检查记忆是否存在
   */
  hasMemory(content: string): boolean {
    return this.shortTermMemories.some(entry => 
      entry.content.includes(content) || content.includes(entry.content)
    )
  }

  /**
   * 增强记忆
   */
  strengthenMemory(id: string, importanceBoost: number = 0.1): boolean {
    const entry = this.shortTermMemories.find(e => e.id === id)
    if (entry) {
      entry.metadata.importance = Math.min(1.0, (entry.metadata.importance || 0.5) + importanceBoost)
      entry.metadata.timestamp = Date.now()
      this.emit('memoryStrengthened', entry)
      return true
    }
    return false
  }

  /**
   * 记忆检索
   */
  retrieveMemory(pattern: string): ShortTermMemoryEntry | null {
    const results = this.getRelatedMemories(pattern, { limit: 1 })
    return results.length > 0 ? results[0] : null
  }

  /**
   * 工作记忆容量检查
   */
  checkWorkingMemoryCapacity(): boolean {
    if (!this.workingMemory) return true
    
    const currentSize = JSON.stringify(this.workingMemory).length
    return currentSize <= this.options.maxWorkingMemorySize
  }

  /**
   * 优化工作记忆
   */
  optimizeWorkingMemory(): void {
    if (!this.workingMemory) return

    // 移除不重要的信息
    this.workingMemory.shortTermMemory = this.workingMemory.shortTermMemory
      .filter(entry => (entry.metadata.importance || 0) > 0.3)
      .slice(0, 5) // 只保留最近的5个重要记忆

    this.updateWorkingMemory({ shortTermMemory: this.workingMemory.shortTermMemory })
    this.emit('workingMemoryOptimized', this.workingMemory)
  }
}

// 导出单例
export const shortTermMemoryService = new ShortTermMemoryService()
