/**
 * Unified Reasoning Framework
 * 统一推理框架 - 整合所有推理引擎
 * 
 * 支持旧版 API 兼容:
 * - reason(task, history, tools)
 * - setStrategy(type)
 * - on('progress', callback)
 */

import { EventEmitter } from 'events'
import { ReasoningStrategy } from './strategies/ReasoningStrategy'
import { ReActStrategy } from './strategies/ReActStrategy'
import { ThoughtTreeStrategy } from './strategies/ThoughtTreeStrategy'
import { CognitiveStrategy } from './strategies/CognitiveStrategy'

export type ReasoningType = 'react' | 'thought-tree' | 'cognitive' | 'chain-of-thought'

export interface ReasoningContext {
  task: string
  history: ReasoningStep[]
  tools: any[]
  maxIterations?: number
  temperature?: number
}

export interface ReasoningStep {
  thought: string
  action?: string
  observation?: string
  result?: any
  timestamp: number
}

export interface ReasoningResult {
  success: boolean
  result?: any
  steps: ReasoningStep[]
  error?: string
  reasoningType: ReasoningType
}

/**
 * 统一推理引擎
 * 使用策略模式支持不同的推理方式
 */
export class UnifiedReasoningEngine extends EventEmitter {
  private strategies: Map<ReasoningType, ReasoningStrategy> = new Map()
  private defaultStrategy: ReasoningType = 'react'

  constructor() {
    super()
    this.initializeStrategies()
  }

  /**
   * 初始化所有推理策略
   */
  private initializeStrategies(): void {
    this.strategies.set('react', new ReActStrategy())
    this.strategies.set('thought-tree', new ThoughtTreeStrategy())
    this.strategies.set('cognitive', new CognitiveStrategy())
    this.strategies.set('chain-of-thought', new ReActStrategy())
  }

  /**
   * 执行推理 (新版 API)
   */
  async reason(context: ReasoningContext, strategyType?: ReasoningType): Promise<ReasoningResult> {
    const type = strategyType || this.defaultStrategy
    const strategy = this.strategies.get(type)

    if (!strategy) {
      throw new Error(`No strategy found for type: ${type}`)
    }

    try {
      // 发送进度事件
      this.emit('progress', { type: 'reasoning_start', timestamp: Date.now() })

      const result = await strategy.execute(context)
      
      // 发送完成事件
      this.emit('progress', { type: 'reasoning_complete', timestamp: Date.now() })
      
      return result
    } catch (error) {
      return {
        success: false,
        steps: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        reasoningType: type
      }
    }
  }

  /**
   * 执行推理 (旧版兼容 API)
   */
  async execute(
    task: string, 
    history: ReasoningStep[] = [], 
    tools: any[] = []
  ): Promise<ReasoningResult> {
    const context: ReasoningContext = {
      task,
      history,
      tools,
      maxIterations: 10,
      temperature: 0.7
    }

    return this.reason(context)
  }

  /**
   * 设置默认推理策略
   */
  setDefaultStrategy(type: ReasoningType): void {
    if (this.strategies.has(type)) {
      this.defaultStrategy = type
    } else {
      throw new Error(`Unknown reasoning strategy: ${type}`)
    }
  }

  /**
   * 注册自定义推理策略
   */
  registerStrategy(type: ReasoningType, strategy: ReasoningStrategy): void {
    this.strategies.set(type, strategy)
  }

  /**
   * 获取可用的推理策略列表
   */
  getAvailableStrategies(): ReasoningType[] {
    return Array.from(this.strategies.keys())
  }
}

export const unifiedReasoningEngine = new UnifiedReasoningEngine()