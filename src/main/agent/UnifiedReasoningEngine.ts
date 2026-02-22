/**
 * 增强推理引擎集成模块
 * 整合EnhancedReActEngine和ThoughtTreeEngine到现有系统
 */

import { EventEmitter } from 'events'
import { ReActStepType, ReActTrace, ReActOptions } from './ReActEngine'
import { EnhancedReActEngine, EnhancedReflection } from './EnhancedReActEngine'
import { ThoughtTreeEngine, ThoughtTree, ToTOptions } from './ThoughtTreeEngine'

// ============================================
// 推理模式
// ============================================
export enum ReasoningMode {
  REACT = 'react',
  ENHANCED_REACT = 'enhanced_react',
  THOUGHT_TREE = 'thought_tree',
  HYBRID = 'hybrid'
}

// ============================================
// 推理引擎选项
// ============================================
export interface UnifiedReasoningOptions {
  mode?: ReasoningMode
  taskComplexity?: 'low' | 'medium' | 'high'
  enableDeepReflection?: boolean
  enableToolSelection?: boolean
  enableExperienceLearning?: boolean
  enableSelfConsistency?: boolean
  enableTreeReasoning?: boolean
  maxIterations?: number
  maxDepth?: number
  temperature?: number
}

// ============================================
// 推理结果
// ============================================
export interface ReasoningResult {
  mode: ReasoningMode
  success: boolean
  answer?: string
  trace?: ReActTrace
  tree?: ThoughtTree
  reflections?: EnhancedReflection[]
  statistics?: {
    totalSteps: number
    totalDurationMs: number
    avgConfidence: number
    errorCount: number
    successRate: number
  }
  reasoning?: string
  confidence: number
}

// ============================================
// 任务复杂度评估
// ============================================
export interface ComplexityAssessment {
  complexity: 'low' | 'medium' | 'high'
  confidence: number
  factors: {
    length: number
    hasMultipleSteps: boolean
    requiresExternalInfo: boolean
    requiresCodeGeneration: boolean
    requiresAnalysis: boolean
  }
  reasoning: string
}

// ============================================
// 统一推理引擎类
// ============================================
export class UnifiedReasoningEngine extends EventEmitter {
  private enhancedReAct: EnhancedReActEngine
  private thoughtTree: ThoughtTreeEngine
  private complexityCache: Map<string, ComplexityAssessment> = new Map()

  constructor() {
    super()
    this.enhancedReAct = new EnhancedReActEngine()
    this.thoughtTree = new ThoughtTreeEngine()
  }

  // ============================================
  // 主要推理方法
  // ============================================
  
  async reason(
    task: string,
    options: UnifiedReasoningOptions = {}
  ): Promise<ReasoningResult> {
    const opts = this.normalizeOptions(options)
    const startTime = Date.now()
    
    this.emit('start', { task, mode: opts.mode })
    
    try {
      const complexity = await this.assessComplexity(task)
      const recommendedMode = this.recommendMode(complexity, opts)
      
      const finalMode = opts.mode || recommendedMode
      
      let result: ReasoningResult
      
      switch (finalMode) {
        case ReasoningMode.ENHANCED_REACT:
          result = await this.executeEnhancedReAct(task, opts)
          break
        case ReasoningMode.THOUGHT_TREE:
          result = await this.executeThoughtTree(task, opts)
          break
        case ReasoningMode.HYBRID:
          result = await this.executeHybrid(task, opts)
          break
        default:
          result = await this.executeStandardReAct(task, opts)
      }
      
      result.statistics = {
        totalSteps: result.trace?.steps.length || result.tree?.totalNodes || 0,
        totalDurationMs: Date.now() - startTime,
        avgConfidence: this.calculateAvgConfidence(result),
        errorCount: this.countErrors(result),
        successRate: result.success ? 1.0 : 0.0
      }
      
      this.emit('complete', { result, task, mode: finalMode })
      
      return result
    } catch (error: any) {
      this.emit('error', { error, task })
      
      return {
        mode: opts.mode || ReasoningMode.REACT,
        success: false,
        confidence: 0.0,
        reasoning: `Error: ${error.message}`
      }
    }
  }

  // ============================================
  // 复杂度评估
  // ============================================
  
  async assessComplexity(task: string): Promise<ComplexityAssessment> {
    const cacheKey = task.toLowerCase().slice(0, 100)
    
    if (this.complexityCache.has(cacheKey)) {
      return this.complexityCache.get(cacheKey)!
    }
    
    const factors = {
      length: task.length,
      hasMultipleSteps: this.hasMultipleSteps(task),
      requiresExternalInfo: this.requiresExternalInfo(task),
      requiresCodeGeneration: this.requiresCodeGeneration(task),
      requiresAnalysis: this.requiresAnalysis(task)
    }
    
    let complexityScore = 0
    
    if (factors.length > 200) complexityScore += 1
    if (factors.hasMultipleSteps) complexityScore += 2
    if (factors.requiresExternalInfo) complexityScore += 1
    if (factors.requiresCodeGeneration) complexityScore += 2
    if (factors.requiresAnalysis) complexityScore += 1
    
    let complexity: 'low' | 'medium' | 'high'
    let confidence = 0.8
    
    if (complexityScore <= 2) {
      complexity = 'low'
      confidence = 0.9
    } else if (complexityScore <= 4) {
      complexity = 'medium'
      confidence = 0.8
    } else {
      complexity = 'high'
      confidence = 0.7
    }
    
    const assessment: ComplexityAssessment = {
      complexity,
      confidence,
      factors,
      reasoning: this.generateComplexityReasoning(factors, complexity)
    }
    
    this.complexityCache.set(cacheKey, assessment)
    
    return assessment
  }

  private hasMultipleSteps(task: string): boolean {
    const stepIndicators = ['然后', '接着', '之后', '再', '然后', 'then', 'next', 'after', 'also', 'and then']
    return stepIndicators.some(indicator => task.toLowerCase().includes(indicator))
  }

  private requiresExternalInfo(task: string): boolean {
    const infoIndicators = ['搜索', '查找', '获取', 'fetch', 'search', 'find', 'get', 'look up']
    return infoIndicators.some(indicator => task.toLowerCase().includes(indicator))
  }

  private requiresCodeGeneration(task: string): boolean {
    const codeIndicators = ['代码', '编程', '实现', 'code', 'program', 'implement', 'create', 'build']
    return codeIndicators.some(indicator => task.toLowerCase().includes(indicator))
  }

  private requiresAnalysis(task: string): boolean {
    const analysisIndicators = ['分析', '评估', '比较', 'analyze', 'evaluate', 'compare', 'review']
    return analysisIndicators.some(indicator => task.toLowerCase().includes(indicator))
  }

  private generateComplexityReasoning(
    factors: any,
    complexity: 'low' | 'medium' | 'high'
  ): string {
    const reasons: string[] = []
    
    if (factors.length > 200) reasons.push('任务描述较长')
    if (factors.hasMultipleSteps) reasons.push('包含多个步骤')
    if (factors.requiresExternalInfo) reasons.push('需要外部信息')
    if (factors.requiresCodeGeneration) reasons.push('需要代码生成')
    if (factors.requiresAnalysis) reasons.push('需要分析')
    
    return `复杂度评估: ${complexity}。原因: ${reasons.join(', ')}`
  }

  // ============================================
  // 模式推荐
  // ============================================
  
  private recommendMode(
    complexity: ComplexityAssessment,
    options: UnifiedReasoningOptions
  ): ReasoningMode {
    if (options.mode) {
      return options.mode
    }
    
    switch (complexity.complexity) {
      case 'low':
        return ReasoningMode.REACT
      case 'medium':
        return ReasoningMode.ENHANCED_REACT
      case 'high':
        return ReasoningMode.HYBRID
      default:
        return ReasoningMode.ENHANCED_REACT
    }
  }

  // ============================================
  // 执行方法
  // ============================================
  
  private async executeStandardReAct(
    task: string,
    options: UnifiedReasoningOptions
  ): Promise<ReasoningResult> {
    const { ReActEngine } = await import('./ReActEngine')
    const reactEngine = new ReActEngine()
    
    const reactOptions: ReActOptions = {
      maxIterations: options.maxIterations || 10,
      temperature: options.temperature || 0.7,
      includeReflection: true,
      earlyStopping: true,
      useChainOfThought: true
    }
    
    const trace = await reactEngine.execute(task, reactOptions)
    
    return {
      mode: ReasoningMode.REACT,
      success: trace.success,
      answer: trace.finalAnswer,
      trace,
      confidence: trace.success ? 0.7 : 0.3,
      reasoning: '使用标准ReAct推理'
    }
  }

  private async executeEnhancedReAct(
    task: string,
    options: UnifiedReasoningOptions
  ): Promise<ReasoningResult> {
    const { ReActEngine } = await import('./ReActEngine')
    const reactEngine = new ReActEngine()
    
    const reactOptions: ReActOptions = {
      maxIterations: options.maxIterations || 10,
      temperature: options.temperature || 0.7,
      includeReflection: true,
      earlyStopping: true,
      useChainOfThought: true,
      useSelfConsistency: options.enableSelfConsistency,
      consistencySamples: 3
    }
    
    const trace = await reactEngine.execute(task, reactOptions)
    
    if (options.enableDeepReflection) {
      for (let i = 0; i < trace.steps.length; i++) {
        const step = trace.steps[i]
        
        if (step.type === ReActStepType.ACT) {
          await this.enhancedReAct.performDeepReflection(
            step,
            trace
          )
          
          if (!trace.id) {
            trace.id = `react_${Date.now()}`
          }
        }
      }
    }
    
    const reflections = trace.id 
      ? this.enhancedReAct.getReflectionHistory(trace.id)
      : []
    
    if (options.enableExperienceLearning) {

    }
    
    return {
      mode: ReasoningMode.ENHANCED_REACT,
      success: trace.success,
      answer: trace.finalAnswer,
      trace,
      reflections,
      confidence: trace.success ? 0.8 : 0.4,
      reasoning: '使用增强ReAct推理，包含深度反思和自我一致性'
    }
  }

  private async executeThoughtTree(
    task: string,
    options: UnifiedReasoningOptions
  ): Promise<ReasoningResult> {
    const totOptions: ToTOptions = {
      maxIterations: options.maxIterations || 10,
      temperature: options.temperature || 0.7,
      maxDepth: options.maxDepth || 5,
      branchStrategy: {
        type: 'adaptive',
        beamWidth: 3,
        maxBranches: 5,
        confidenceThreshold: 0.3,
        diversityBonus: 0.2
      },
      enableBacktracking: true,
      enableParallelExploration: true,
      maxParallelBranches: 3
    }
    
    const tree = await this.thoughtTree.execute(task, totOptions)
    
    const bestPath = tree.bestPath
    const answer = bestPath.length > 0 
      ? bestPath[bestPath.length - 1].thought
      : undefined
    
    return {
      mode: ReasoningMode.THOUGHT_TREE,
      success: bestPath.length > 0,
      answer,
      tree,
      confidence: bestPath.length > 0 ? 0.85 : 0.3,
      reasoning: '使用思维树推理，包含分支探索和回溯机制'
    }
  }

  private async executeHybrid(
    task: string,
    options: UnifiedReasoningOptions
  ): Promise<ReasoningResult> {
    const complexity = await this.assessComplexity(task)
    
    if (complexity.complexity === 'high') {
      const totResult = await this.executeThoughtTree(task, options)
      
      if (totResult.success && totResult.confidence > 0.7) {
        return totResult
      }
      
      const reactResult = await this.executeEnhancedReAct(task, options)
      
      const combinedAnswer = this.combineAnswers(
        totResult.answer || '',
        reactResult.answer || ''
      )
      
      return {
        mode: ReasoningMode.HYBRID,
        success: reactResult.success || totResult.success,
        answer: combinedAnswer,
        trace: reactResult.trace,
        tree: totResult.tree,
        confidence: Math.max(totResult.confidence, reactResult.confidence),
        reasoning: '使用混合推理：思维树 + 增强ReAct'
      }
    } else {
      return this.executeEnhancedReAct(task, options)
    }
  }

  // ============================================
  // 辅助方法
  // ============================================
  
  private normalizeOptions(options: UnifiedReasoningOptions): UnifiedReasoningOptions {
    return {
      mode: options.mode || ReasoningMode.ENHANCED_REACT,
      taskComplexity: options.taskComplexity || 'medium',
      enableDeepReflection: options.enableDeepReflection !== false,
      enableToolSelection: options.enableToolSelection !== false,
      enableExperienceLearning: options.enableExperienceLearning !== false,
      enableSelfConsistency: options.enableSelfConsistency !== false,
      enableTreeReasoning: options.enableTreeReasoning !== false,
      maxIterations: options.maxIterations || 10,
      maxDepth: options.maxDepth || 5,
      temperature: options.temperature || 0.7
    }
  }

  private calculateAvgConfidence(result: ReasoningResult): number {
    if (result.trace) {
      const steps = result.trace.steps.filter(s => s.confidence !== undefined)
      if (steps.length > 0) {
        return steps.reduce((sum, s) => sum + (s.confidence || 0), 0) / steps.length
      }
    }
    
    if (result.tree) {
      const nodes = Array.from(result.tree.nodes.values())
      if (nodes.length > 0) {
        return nodes.reduce((sum, n) => sum + n.confidence, 0) / nodes.length
      }
    }
    
    return result.confidence
  }

  private countErrors(result: ReasoningResult): number {
    if (result.trace) {
      return result.trace.steps.filter(s => s.error).length
    }
    
    if (result.tree) {
      return Array.from(result.tree.nodes.values())
        .filter(n => n.status === 'failed')
        .length
    }
    
    return 0
  }

  private combineAnswers(answer1: string, answer2: string): string {
    if (!answer1) return answer2
    if (!answer2) return answer1
    
    const maxLength = Math.max(answer1.length, answer2.length)
    const combined = answer1.slice(0, maxLength / 2) + '\n\n' + answer2.slice(0, maxLength / 2)
    
    return combined
  }

  // ============================================
  // 公共API
  // ============================================
  
  getEnhancedReAct(): EnhancedReActEngine {
    return this.enhancedReAct
  }
  
  getThoughtTree(): ThoughtTreeEngine {
    return this.thoughtTree
  }
  
  getComplexityCache(): Map<string, ComplexityAssessment> {
    return this.complexityCache
  }
  
  clearComplexityCache(): void {
    this.complexityCache.clear()
  }
}

export const unifiedReasoningEngine = new UnifiedReasoningEngine()
