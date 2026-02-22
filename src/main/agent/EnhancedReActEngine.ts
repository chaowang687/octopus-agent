/**
 * 增强版ReAct推理引擎
 * 实现深度反思、智能工具选择、增强记忆管理和改进的自我一致性
 */

import { EventEmitter } from 'events'
import { ReActStep, ReActStepType, ReActTrace } from './ReActEngine'

// ============================================
// 增强的反思结果
// ============================================
export interface EnhancedReflection {
  stepId: string
  success: boolean
  errorAnalysis?: {
    type: 'parameter_error' | 'tool_error' | 'logic_error' | 'execution_error'
    rootCause: string
    suggestedFix: string
    alternativeTools?: string[]
  }
  learning: {
    whatWorked: string[]
    whatDidntWork: string[]
    insights: string[]
  }
  nextStepSuggestion?: {
    action: string
    reasoning: string
    confidence: number
  }
  timestamp: number
}

// ============================================
// 工具能力图谱
// ============================================
export interface ToolCapability {
  name: string
  capabilities: string[]
  dependencies: string[]
  complementaryTools: string[]
  typicalUseCases: string[]
  failurePatterns: string[]
  successRate: number
  averageConfidence: number
}

// ============================================
// 经验库条目
// ============================================
export interface ExperienceEntry {
  id: string
  taskPattern: string
  successfulActions: Array<{
    tool: string
    parameters: any
    outcome: string
    reasoning: string
  }>
  failedActions: Array<{
    tool: string
    parameters: any
    error: string
    reason: string
  }>
  successRate: number
  lastUsed: number
  usageCount: number
}

// ============================================
// 自我一致性评估结果
// ============================================
export interface ConsistencyEvaluation {
  traces: ReActTrace[]
  consensus: {
    answer: string
    confidence: number
    supportingTraces: number[]
  }
  diversity: {
    uniqueApproaches: number
    commonPatterns: string[]
    outliers: number[]
  }
  qualityScores: {
    logical: number[]
    complete: number[]
    coherent: number[]
  }
  bestTrace: ReActTrace
  reasoning: string
}

// ============================================
// 增强版ReAct引擎类
// ============================================
export class EnhancedReActEngine extends EventEmitter {
  private toolCapabilities: Map<string, ToolCapability> = new Map()
  private experienceLibrary: Map<string, ExperienceEntry[]> = new Map()
  private reflectionHistory: Map<string, EnhancedReflection[]> = new Map()
  
  constructor() {
    super()
    this.initializeToolCapabilities()
    this.loadExperienceLibrary()
  }

  // ============================================
  // 工具能力管理
  // ============================================
  
  private initializeToolCapabilities(): void {
    const defaultCapabilities: ToolCapability[] = [
      {
        name: 'read_file',
        capabilities: ['read', 'inspect', 'analyze', 'content_extraction'],
        dependencies: [],
        complementaryTools: ['list_dir', 'grep_search'],
        typicalUseCases: ['reading configuration', 'analyzing code', 'inspecting files'],
        failurePatterns: ['file_not_found', 'permission_denied'],
        successRate: 0.95,
        averageConfidence: 0.9
      },
      {
        name: 'write_file',
        capabilities: ['create', 'modify', 'write', 'save'],
        dependencies: ['read_file'],
        complementaryTools: ['create_directory', 'read_file'],
        typicalUseCases: ['creating files', 'modifying code', 'saving results'],
        failurePatterns: ['permission_denied', 'invalid_path', 'disk_full'],
        successRate: 0.92,
        averageConfidence: 0.88
      },
      {
        name: 'execute_command',
        capabilities: ['execute', 'run', 'command', 'shell'],
        dependencies: [],
        complementaryTools: ['read_file', 'write_file'],
        typicalUseCases: ['running scripts', 'installing packages', 'building projects'],
        failurePatterns: ['command_not_found', 'permission_denied', 'syntax_error'],
        successRate: 0.85,
        averageConfidence: 0.82
      },
      {
        name: 'list_dir',
        capabilities: ['list', 'explore', 'navigate', 'discover'],
        dependencies: [],
        complementaryTools: ['read_file', 'grep_search'],
        typicalUseCases: ['exploring directories', 'finding files', 'understanding structure'],
        failurePatterns: ['directory_not_found', 'permission_denied'],
        successRate: 0.98,
        averageConfidence: 0.95
      },
      {
        name: 'grep_search',
        capabilities: ['search', 'find', 'pattern_match', 'filter'],
        dependencies: ['list_dir'],
        complementaryTools: ['read_file', 'list_dir'],
        typicalUseCases: ['searching code', 'finding patterns', 'filtering results'],
        failurePatterns: ['pattern_not_found', 'permission_denied'],
        successRate: 0.90,
        averageConfidence: 0.87
      },
      {
        name: 'web_fetch',
        capabilities: ['fetch', 'retrieve', 'download', 'http'],
        dependencies: [],
        complementaryTools: ['read_file', 'write_file'],
        typicalUseCases: ['fetching web content', 'downloading files', 'API calls'],
        failurePatterns: ['network_error', 'timeout', 'invalid_url'],
        successRate: 0.80,
        averageConfidence: 0.78
      }
    ]

    for (const capability of defaultCapabilities) {
      this.toolCapabilities.set(capability.name, capability)
    }
  }

  private getToolCapability(toolName: string): ToolCapability | undefined {
    return this.toolCapabilities.get(toolName)
  }

  // ============================================
  // 经验库管理
  // ============================================
  
  private loadExperienceLibrary(): void {
    try {
      const fs = require('fs')
      const path = require('path')
      const experiencePath = path.join(process.cwd(), 'data', 'experience_library.json')
      
      if (fs.existsSync(experiencePath)) {
        const content = fs.readFileSync(experiencePath, 'utf-8')
        const data = JSON.parse(content)
        
        for (const [pattern, entries] of Object.entries(data)) {
          this.experienceLibrary.set(pattern, entries as ExperienceEntry[])
        }
        
        console.log(`[EnhancedReActEngine] 加载了 ${this.experienceLibrary.size} 个任务模式的经验`)
      }
    } catch (error) {
      console.log('[EnhancedReActEngine] 经验库加载失败，将从头开始学习')
    }
  }



  private findSimilarExperiences(task: string): ExperienceEntry[] {
    const taskLower = task.toLowerCase()
    const similarEntries: ExperienceEntry[] = []
    
    for (const [pattern, entries] of this.experienceLibrary.entries()) {
      if (taskLower.includes(pattern.toLowerCase()) || 
          pattern.toLowerCase().includes(taskLower.split(' ')[0])) {
        similarEntries.push(...entries)
      }
    }
    
    return similarEntries.sort((a, b) => b.successRate - a.successRate).slice(0, 5)
  }





  // ============================================
  // 深度反思机制
  // ============================================
  
 public async performDeepReflection(
    step: ReActStep,
    trace: ReActTrace,

  ): Promise<EnhancedReflection> {
    const reflection: EnhancedReflection = {
      stepId: step.id,
      success: !step.error,
      learning: {
        whatWorked: [],
        whatDidntWork: [],
        insights: []
      },
      timestamp: Date.now()
    }

    if (step.error) {
      reflection.errorAnalysis = await this.analyzeError(step)
      reflection.learning = {
        whatWorked: [],
        whatDidntWork: [`${step.action || 'unknown'} failed: ${step.error}`],
        insights: [`Error type: ${reflection.errorAnalysis.type}`, `Root cause: ${reflection.errorAnalysis.rootCause}`]
      }
      
      if (reflection.errorAnalysis.alternativeTools) {
        reflection.nextStepSuggestion = {
          action: reflection.errorAnalysis.alternativeTools[0],
          reasoning: reflection.errorAnalysis.suggestedFix,
          confidence: 0.7
        }
      }
    } else {
      const successfulSteps: any[] = []
      const failedSteps: any[] = []
      reflection.learning = {
        whatWorked: successfulSteps.map(s => `${s.action} succeeded`),
        whatDidntWork: failedSteps.map(s => `${s.action} failed`),
        insights: this.generateInsights(step)
      }
    }

    const traceId = trace.id
    if (!this.reflectionHistory.has(traceId)) {
      this.reflectionHistory.set(traceId, [])
    }
    this.reflectionHistory.get(traceId)!.push(reflection)

    return reflection
  }

  private async analyzeError(
    step: ReActStep
  ): Promise<{
    type: 'parameter_error' | 'tool_error' | 'logic_error' | 'execution_error'
    rootCause: string
    suggestedFix: string
    alternativeTools?: string[]
  }> {
    const error = step.error || ''
    const tool = step.action || 'unknown'

    let errorType: 'parameter_error' | 'tool_error' | 'logic_error' | 'execution_error' = 'execution_error'
    let rootCause = 'Unknown error'
    let suggestedFix = 'Try a different approach'
    let alternativeTools: string[] = []

    if (error.includes('not found') || error.includes('does not exist')) {
      errorType = 'parameter_error'
      rootCause = 'File or resource not found'
      suggestedFix = 'Use list_dir to find the correct path'
      alternativeTools = ['list_dir', 'grep_search']
    } else if (error.includes('permission') || error.includes('denied')) {
      errorType = 'execution_error'
      rootCause = 'Insufficient permissions'
      suggestedFix = 'Check file permissions or use a different approach'
    } else if (error.includes('command not found')) {
      errorType = 'tool_error'
      rootCause = 'Command or tool not available'
      suggestedFix = 'Install the required tool or use an alternative'
      alternativeTools = this.findAlternativeTools(tool)
    } else if (error.includes('syntax') || error.includes('parse')) {
      errorType = 'logic_error'
      rootCause = 'Syntax or parsing error'
      suggestedFix = 'Review and correct the syntax'
    }

    return {
      type: errorType,
      rootCause,
      suggestedFix,
      alternativeTools
    }
  }

  private findAlternativeTools(toolName: string): string[] {
    const capability = this.getToolCapability(toolName)
    if (capability && capability.complementaryTools.length > 0) {
      return capability.complementaryTools
    }
    return []
  }

  private generateInsights(step: ReActStep): string[] {
    const insights: string[] = []
    
    const tool = step.action
    if (tool) {
      const capability = this.getToolCapability(tool)
      
      if (capability) {
        insights.push(`Tool ${tool} has ${capability.successRate * 100}% success rate`)
        if (capability.complementaryTools.length > 0) {
          insights.push(`Consider using: ${capability.complementaryTools.join(', ')}`)
        }
      }
    }
    
    const errorCount = 0
    if (errorCount > 0) {
      insights.push(`${errorCount} errors encountered so far`)
    }
    
    return insights
  }

  // ============================================
  // 智能工具选择
  // ============================================
  
  async selectBestTool(
    task: string,
    availableTools: string[],

  ): Promise<{
    tool: string
    reasoning: string
    confidence: number
    alternatives: string[]
  }> {
    const experiences = this.findSimilarExperiences(task)
    const toolScores: Map<string, number> = new Map()
    
    for (const toolName of availableTools) {
      let score = 0
      
      const capability = this.getToolCapability(toolName)
      if (capability) {
        score += capability.successRate * 0.4
        score += capability.averageConfidence * 0.3
        
        for (const useCase of capability.typicalUseCases) {
          if (task.toLowerCase().includes(useCase.toLowerCase())) {
            score += 0.2
          }
        }
      }
      
      for (const exp of experiences) {
        for (const action of exp.successfulActions) {
          if (action.tool === toolName) {
            score += 0.1 * exp.successRate
          }
        }
      }
      
      const recentFailures = 0
      
      if (recentFailures > 0) {
        score -= recentFailures * 0.15
      }
      
      toolScores.set(toolName, score)
    }
    
    const sortedTools = Array.from(toolScores.entries())
      .sort((a, b) => b[1] - a[1])
    
    const bestTool = sortedTools[0]
    const alternatives = sortedTools.slice(1, 4).map(t => t[0])
    
    const capability = this.getToolCapability(bestTool[0])
    const reasoning = capability 
      ? `Selected ${bestTool[0]} based on ${capability.successRate * 100}% success rate and task relevance`
      : `Selected ${bestTool[0]} based on historical performance`
    
    return {
      tool: bestTool[0],
      reasoning,
      confidence: Math.min(bestTool[1], 1.0),
      alternatives
    }
  }

  // ============================================
  // 增强的自我一致性
  // ============================================
  
  async evaluateConsistency(
    traces: ReActTrace[]
  ): Promise<ConsistencyEvaluation> {
    const evaluation: ConsistencyEvaluation = {
      traces,
      consensus: {
        answer: '',
        confidence: 0,
        supportingTraces: []
      },
      diversity: {
        uniqueApproaches: 0,
        commonPatterns: [],
        outliers: []
      },
      qualityScores: {
        logical: [],
        complete: [],
        coherent: []
      },
      bestTrace: traces[0],
      reasoning: ''
    }

    const answers = traces
      .filter(t => t.success && t.finalAnswer)
      .map(t => t.finalAnswer!)
    
    if (answers.length === 0) {
      evaluation.bestTrace = traces[0]
      evaluation.reasoning = 'No successful traces found, returning first trace'
      return evaluation
    }

    const answerGroups = this.groupSimilarAnswers(answers)
    const largestGroup = answerGroups.sort((a, b) => b.length - a.length)[0]
    
    evaluation.consensus.answer = largestGroup[0]
    evaluation.consensus.confidence = largestGroup.length / answers.length
    evaluation.consensus.supportingTraces = largestGroup.map((_, idx) => idx)

    evaluation.diversity.uniqueApproaches = answerGroups.length
    evaluation.diversity.commonPatterns = this.findCommonPatterns(traces)
    evaluation.diversity.outliers = this.findOutliers(traces, largestGroup)

    for (const trace of traces) {
      const quality = await this.evaluateTraceQuality(trace)
      evaluation.qualityScores.logical.push(quality.logical)
      evaluation.qualityScores.complete.push(quality.complete)
      evaluation.qualityScores.coherent.push(quality.coherent)
    }

    const bestTraceIndex = this.selectBestTraceByQuality(traces, evaluation.qualityScores)
    evaluation.bestTrace = traces[bestTraceIndex]

    evaluation.reasoning = this.generateConsistencyReasoning(evaluation)

    return evaluation
  }

  private groupSimilarAnswers(answers: string[]): string[][] {
    const groups: string[][] = []
    const used = new Set<number>()
    
    for (let i = 0; i < answers.length; i++) {
      if (used.has(i)) continue
      
      const group = [answers[i]]
      used.add(i)
      
      for (let j = i + 1; j < answers.length; j++) {
        if (used.has(j)) continue
        
        const similarity = this.calculateAnswerSimilarity(answers[i], answers[j])
        if (similarity > 0.7) {
          group.push(answers[j])
          used.add(j)
        }
      }
      
      groups.push(group)
    }
    
    return groups
  }

  private calculateAnswerSimilarity(answer1: string, answer2: string): number {
    const words1 = answer1.toLowerCase().split(/\s+/)
    const words2 = answer2.toLowerCase().split(/\s+/)
    
    const set1 = new Set(words1)
    const set2 = new Set(words2)
    
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])
    
    return union.size > 0 ? intersection.size / union.size : 0
  }

  private findCommonPatterns(traces: ReActTrace[]): string[] {
    const toolSequences: Map<string, number> = new Map()
    
    for (const trace of traces) {
      const sequence = trace.steps
        .filter(s => s.type === ReActStepType.ACT && s.action)
        .map(s => s.action)
        .join(' -> ')
      
      toolSequences.set(sequence, (toolSequences.get(sequence) || 0) + 1)
    }
    
    const commonPatterns = Array.from(toolSequences.entries())
      .filter(([_, count]) => count >= traces.length / 2)
      .map(([sequence, _]) => sequence)
    
    return commonPatterns
  }

  private findOutliers(traces: ReActTrace[], consensusGroup: string[]): number[] {
    const outliers: number[] = []
    
    for (let i = 0; i < traces.length; i++) {
      const trace = traces[i]
      if (!trace.finalAnswer) continue
      
      const isInConsensus = consensusGroup.includes(trace.finalAnswer)
      if (!isInConsensus) {
        outliers.push(i)
      }
    }
    
    return outliers
  }

  private async evaluateTraceQuality(
    trace: ReActTrace
  ): Promise<{ logical: number; complete: number; coherent: number }> {
    let logical = 0.5
    let complete = 0.5
    let coherent = 0.5
    
    const errorSteps = trace.steps.filter(s => s.error)
    const successSteps = trace.steps.filter(s => !s.error && s.type === ReActStepType.ACT)
    
    logical = successSteps.length / (successSteps.length + errorSteps.length)
    
    if (trace.finalAnswer && trace.finalAnswer.length > 50) {
      complete = 0.8
    } else if (trace.finalAnswer) {
      complete = 0.6
    }
    
    const toolSequence = trace.steps
      .filter(s => s.type === ReActStepType.ACT && s.action)
      .map(s => s.action)
    
    for (let i = 1; i < toolSequence.length; i++) {
      const prevTool = toolSequence[i - 1]
      const currTool = toolSequence[i]
      
      if (prevTool && currTool) {
        const prevCapability = this.getToolCapability(prevTool)
        if (prevCapability && prevCapability.complementaryTools.includes(currTool)) {
          coherent += 0.1
        }
      }
    }
    
    coherent = Math.min(coherent, 1.0)
    
    return { logical, complete, coherent }
  }

  private selectBestTraceByQuality(
    traces: ReActTrace[],
    qualityScores: { logical: number[]; complete: number[]; coherent: number[] }
  ): number {
    let bestIndex = 0
    let bestScore = 0
    
    for (let i = 0; i < traces.length; i++) {
      const score = (
        qualityScores.logical[i] * 0.4 +
        qualityScores.complete[i] * 0.3 +
        qualityScores.coherent[i] * 0.3
      )
      
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }
    
    return bestIndex
  }

  private generateConsistencyReasoning(evaluation: ConsistencyEvaluation): string {
    const parts: string[] = []
    
    parts.push(`Consensus confidence: ${(evaluation.consensus.confidence * 100).toFixed(1)}%`)
    parts.push(`Unique approaches: ${evaluation.diversity.uniqueApproaches}`)
    parts.push(`Outliers: ${evaluation.diversity.outliers.length}`)
    
    if (evaluation.diversity.commonPatterns.length > 0) {
      parts.push(`Common patterns: ${evaluation.diversity.commonPatterns.join(', ')}`)
    }
    
    const avgLogical = evaluation.qualityScores.logical.reduce((a, b) => a + b, 0) / evaluation.qualityScores.logical.length
    const avgComplete = evaluation.qualityScores.complete.reduce((a, b) => a + b, 0) / evaluation.qualityScores.complete.length
    const avgCoherent = evaluation.qualityScores.coherent.reduce((a, b) => a + b, 0) / evaluation.qualityScores.coherent.length
    
    parts.push(`Average quality scores - Logical: ${(avgLogical * 100).toFixed(1)}%, Complete: ${(avgComplete * 100).toFixed(1)}%, Coherent: ${(avgCoherent * 100).toFixed(1)}%`)
    
    return parts.join('. ')
  }

  // ============================================
  // 公共方法
  // ============================================
  
  getToolCapabilities(): ToolCapability[] {
    return Array.from(this.toolCapabilities.values())
  }
  
  getExperienceLibrary(): Map<string, ExperienceEntry[]> {
    return this.experienceLibrary
  }
  
  getReflectionHistory(traceId: string): EnhancedReflection[] {
    return this.reflectionHistory.get(traceId) || []
  }
}

export const enhancedReActEngine = new EnhancedReActEngine()
