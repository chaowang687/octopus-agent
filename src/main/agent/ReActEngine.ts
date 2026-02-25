/**
 * @deprecated 请使用新架构
 * 
 * 旧版推理引擎 - 已迁移至 ./reasoning/
 * 
 * 迁移指南：
 * - ReActEngine -> reasoning/strategies/ReActStrategy
 * - CognitiveEngine -> reasoning/strategies/CognitiveStrategy
 * - ThoughtTreeEngine -> reasoning/strategies/ThoughtTreeStrategy
 * - UnifiedReasoningEngine -> reasoning/ReasoningFramework
 * 
 * @see ./reasoning/
 */

// ============================================
// 旧版类型定义 (向后兼容)
// ============================================

/** @deprecated 使用 ReasoningStep 代替 */
export enum ReActStepType {
  THOUGHT = 'thought',
  ACT = 'act',
  OBSERVATION = 'observation'
}

/** @deprecated 使用 ReasoningStep 代替 */
export interface ReActStep {
  id: string
  type: ReActStepType
  thought?: string
  action?: string
  actionInput?: any
  observation?: string
  confidence?: number
  result?: any
  error?: string
  timestamp: number
}

/** @deprecated */
export interface ReActTrace {
  id: string
  task: string
  currentStep?: number
  steps: ReActStep[]
  success?: boolean
  finalAnswer?: string
  maxIterations?: number
  finalResult?: any
  timestamp: number
}

/** @deprecated */
export interface ReActResult {
  success: boolean
  result?: any
  trace: ReActTrace
  error?: string
}

/** @deprecated */
export interface ReActOptions {
  maxIterations?: number
  maxTokens?: number
  model?: string
  temperature?: number
  stopOnError?: boolean
  includeReflection?: boolean
  earlyStopping?: boolean
  useChainOfThought?: boolean
  useSelfConsistency?: boolean
  consistencySamples?: number
}

// Legacy compatibility class for older modules that still instantiate ReActEngine.
export class ReActEngine {
  async execute(task: string, options: ReActOptions = {}): Promise<ReActTrace> {
    const step: ReActStep = {
      id: `step_${Date.now()}`,
      type: ReActStepType.THOUGHT,
      thought: task,
      timestamp: Date.now()
    }

    return {
      id: `react_${Date.now()}`,
      task,
      steps: [step],
      success: true,
      finalAnswer: task,
      maxIterations: options.maxIterations,
      finalResult: task,
      timestamp: Date.now()
    }
  }
}

// Re-export for backward compatibility
export { UnifiedReasoningEngine } from './reasoning/ReasoningFramework'
export { unifiedReasoningEngine } from './reasoning/ReasoningFramework'

console.warn('[DEPRECATED] ReActEngine.ts is deprecated. Please use ./reasoning/ instead.')
