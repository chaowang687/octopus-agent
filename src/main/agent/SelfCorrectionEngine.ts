/**
 * AI自我纠正引擎
 * 实现了AI驱动的错误分析和自我修复能力
 * 当工具执行失败时，自动分析错误原因并尝试替代方案
 */

import { toolRegistry } from './ToolRegistry'
import { llmService, LLMMessage } from '../services/LLMService'
import { enhancedReActEngine } from './EnhancedReActEngine'
import { ReActStep, ReActStepType, ReActTrace } from './ReActEngine'

// 错误类型分类
export enum ErrorType {
  SYNTAX_ERROR = 'syntax_error',           // 语法错误
  RUNTIME_ERROR = 'runtime_error',         // 运行时错误
  PERMISSION_ERROR = 'permission_error',   // 权限错误
  NOT_FOUND = 'not_found',                 // 资源不存在
  TIMEOUT = 'timeout',                     // 超时错误
  NETWORK_ERROR = 'network_error',         // 网络错误
  INVALID_INPUT = 'invalid_input',         // 输入无效
  UNKNOWN = 'unknown'                      // 未知错误
}

// 纠正策略
export enum CorrectionStrategy {
  RETRY_SAME = 'retry_same',           // 重试相同操作
  RETRY_WITH_MODIFICATION = 'retry_with_modification', // 修改后重试
  USE_ALTERNATIVE_TOOL = 'use_alternative_tool', // 使用替代工具
  SIMPLIFY_TASK = 'simplify_task',     // 简化任务
  ASK_USER = 'ask_user',                // 请求用户帮助
  SKIP = 'skip'                        // 跳过此步骤
}

// 错误分析结果
export interface ErrorAnalysis {
  errorType: ErrorType
  errorMessage: string
  possibleCauses: string[]
  suggestedFixes: string[]
  confidence: number
}

// 纠正结果
export interface CorrectionResult {
  success: boolean
  strategy: CorrectionStrategy
  action?: string
  actionInput?: any
  explanation: string
  iterations: number
}

// 纠正历史记录
export interface CorrectionHistory {
  timestamp: number
  originalError: string
  errorType: ErrorType
  strategy: CorrectionStrategy
  action: string
  result: 'success' | 'failed'
  durationMs: number
}

// 错误预测结果
export interface ErrorPrediction {
  willFail: boolean
  predictedErrorType?: ErrorType
  predictedErrorMessage?: string
  confidence: number
  preventionSuggestions: string[]
  riskLevel: 'low' | 'medium' | 'high'
}

// 错误模式
export interface ErrorPattern {
  id: string
  pattern: string
  errorType: ErrorType
  frequency: number
  lastOccurred: number
  contextKeywords: string[]
  successfulStrategies: string[]
}

// 纠正效果评估
export interface CorrectionEvaluation {
  success: boolean
  strategy: CorrectionStrategy
  timeToFix: number
  confidenceImprovement: number
  wasPreventable: boolean
  preventionOpportunities: string[]
}

// 自我纠正引擎类
export class SelfCorrectionEngine {
  private correctionHistory: CorrectionHistory[] = []
  private errorPatterns: ErrorPattern[] = []
  private maxHistorySize: number = 100
  private maxRetries: number = 3
  private maxPatterns: number = 50

  constructor() {
    // 加载历史纠正记录（如果有持久化存储）
    this.loadHistory()
    this.loadErrorPatterns()
  }

  /**
   * 分析错误并确定错误类型
   */
  async analyzeError(error: any, context?: any): Promise<ErrorAnalysis> {
    const errorMessage = error?.message || String(error)
    const errorType = this.classifyError(errorMessage)
    const possibleCauses = await this.getPossibleCauses(errorType, errorMessage, context)
    const suggestedFixes = this.getSuggestedFixes(errorType)
    const confidence = this.calculateConfidence(errorType)

    return {
      errorType,
      errorMessage,
      possibleCauses,
      suggestedFixes,
      confidence
    }
  }

  /**
   * 将错误上下文转换为ReActStep格式
   */
  private convertToReActStep(
    error: any,
    failedAction: string,
    originalInput: any
  ): ReActStep {
    return {
      id: `step_${Date.now()}`,
      type: ReActStepType.ACT,
      action: failedAction,
      actionInput: originalInput,
      thought: `尝试执行 ${failedAction} 操作`,
      observation: error?.message || String(error),
      error: error?.message || String(error),
      timestamp: Date.now()
    }
  }

  /**
   * 执行深度反思
   */
  private async performDeepReflection(
    error: any,
    failedAction: string,
    originalInput: any
  ): Promise<any> {
    try {
      const step = this.convertToReActStep(error, failedAction, originalInput)
      const trace: ReActTrace = {
        id: `trace_${Date.now()}`,
        task: failedAction,
        steps: [step],
        maxIterations: 1,
        currentStep: 1,
        success: false,
        finalAnswer: '',
        totalDurationMs: 0,
        createdAt: Date.now()
      }

      const reflection = await enhancedReActEngine.performDeepReflection(
        step,
        trace
      )

      console.log(`[SelfCorrection] Deep reflection result:`, reflection)
      return reflection
    } catch (reflectionError) {
      console.error('[SelfCorrection] Deep reflection failed:', reflectionError)
      return null
    }
  }

  /**
   * 尝试纠正错误
   */
  async correct(
    error: any,
    failedAction: string,
    originalInput: any,
    context?: any,
    onCorrectionAttempt?: (attempt: number, strategy: CorrectionStrategy, action: string) => void
  ): Promise<CorrectionResult> {
    const startTime = Date.now()
    const analysis = await this.analyzeError(error, context)
    
    console.log(`[SelfCorrection] Analyzing error: ${analysis.errorType} - ${analysis.errorMessage}`)
    console.log(`[SelfCorrection] Possible causes: ${analysis.possibleCauses.join(', ')}`)
    console.log(`[SelfCorrection] Suggested fixes: ${analysis.suggestedFixes.join(', ')}`)

    // 执行深度反思
    const reflection = await this.performDeepReflection(error, failedAction, originalInput)

    // 根据错误类型和反思结果选择纠正策略
    let strategy = this.selectStrategy(analysis, reflection)
    let iterations = 0
    let lastError = error

    // 尝试多次纠正
    while (iterations < this.maxRetries) {
      iterations++
      
      if (onCorrectionAttempt) {
        onCorrectionAttempt(iterations, strategy, failedAction)
      }

      let action: string
      let actionInput: any

      // 根据策略确定下一步行动
      switch (strategy) {
        case CorrectionStrategy.RETRY_SAME:
          action = failedAction
          actionInput = originalInput
          break

        case CorrectionStrategy.RETRY_WITH_MODIFICATION:
          const modification = await this.suggestModification(
            failedAction, 
            originalInput, 
            analysis,
            reflection
          )
          action = modification.action
          actionInput = modification.actionInput
          break

        case CorrectionStrategy.USE_ALTERNATIVE_TOOL:
          const alternative = await this.findAlternativeTool(
            failedAction
          )
          if (alternative) {
            action = alternative.action
            actionInput = { ...originalInput, ...alternative.actionInput }
          } else {
            // 没有找到替代工具，请求用户帮助
            strategy = CorrectionStrategy.ASK_USER
            action = 'respond_to_user'
            actionInput = {
              message: `I encountered an error while executing ${failedAction}: ${analysis.errorMessage}. I've tried ${iterations} correction attempts but couldn't resolve the issue. Would you like me to try a different approach, or would you prefer to help me correct this manually?`
            }
          }
          break

        case CorrectionStrategy.SIMPLIFY_TASK:
          action = 'respond_to_user'
          actionInput = {
            message: `The original task encountered an error: ${analysis.errorMessage}. I can try a simplified version of the task. Would you like me to proceed with a simpler approach?`
          }
          break

        case CorrectionStrategy.ASK_USER:
        default:
          action = 'respond_to_user'
          actionInput = {
            message: `I encountered an error: ${analysis.errorMessage}. ${analysis.suggestedFixes[0] || 'Could you please help me understand how to proceed?'}`
          }
          break
      }

      // 记录纠正历史
      const historyEntry: CorrectionHistory = {
        timestamp: Date.now(),
        originalError: analysis.errorMessage,
        errorType: analysis.errorType,
        strategy,
        action,
        result: 'failed',
        durationMs: 0
      }

      try {
        // 执行纠正行动
        if (action === 'respond_to_user') {
          // 询问用户，不需要执行工具
          return {
            success: true,
            strategy,
            action,
            actionInput,
            explanation: `Asked user for help after ${iterations} attempts`,
            iterations
          }
        }

        // 执行工具调用
        const tool = toolRegistry.getTool(action)
        if (!tool) {
          lastError = new Error(`Tool not found: ${action}`)
          strategy = CorrectionStrategy.ASK_USER
          continue
        }

        const result = await tool.handler(actionInput, context || {})
        
        if (result.error) {
          // 仍然失败，记录并继续尝试
          lastError = result.error
          historyEntry.result = 'failed'
          
          // 根据新的错误更新分析
          const newAnalysis = await this.analyzeError(result.error, context)
          strategy = this.selectStrategy(newAnalysis)
        } else {
          // 成功！
          historyEntry.result = 'success'
          historyEntry.durationMs = Date.now() - startTime
          this.addToHistory(historyEntry)

          return {
            success: true,
            strategy,
            action,
            actionInput,
            explanation: `Successfully corrected error after ${iterations} attempt(s)`,
            iterations
          }
        }

      } catch (execError: any) {
        lastError = execError
        historyEntry.result = 'failed'
      }

      this.addToHistory(historyEntry)
    }

    // 所有纠正尝试都失败了
    return {
      success: false,
      strategy: CorrectionStrategy.ASK_USER,
      action: 'respond_to_user',
      actionInput: {
        message: `I tried ${iterations} correction attempts but encountered persistent errors: ${lastError?.message || lastError}. Would you like me to try a different approach, or would you prefer to take over?`
      },
      explanation: `Failed to correct error after ${iterations} attempts`,
      iterations
    }
  }

  /**
   * 对错误进行分类
   */
  private classifyError(errorMessage: string): ErrorType {
    const msg = errorMessage.toLowerCase()

    // 语法错误
    if (msg.includes('syntax') || msg.includes('unexpected token') || msg.includes('parse error')) {
      return ErrorType.SYNTAX_ERROR
    }

    // 运行时错误
    if (msg.includes('referenceerror') || msg.includes('typeerror') || msg.includes('undefined is not')) {
      return ErrorType.RUNTIME_ERROR
    }

    // 权限错误
    if (msg.includes('permission denied') || msg.includes('eacces') || msg.includes('access denied')) {
      return ErrorType.PERMISSION_ERROR
    }

    // 资源不存在
    if (msg.includes('not found') || msg.includes('enoent') || msg.includes('does not exist')) {
      return ErrorType.NOT_FOUND
    }

    // 超时
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout')) {
      return ErrorType.TIMEOUT
    }

    // 网络错误
    if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('fetch failed')) {
      return ErrorType.NETWORK_ERROR
    }

    // 输入无效
    if (msg.includes('invalid') || msg.includes('required') || msg.includes('missing parameter')) {
      return ErrorType.INVALID_INPUT
    }

    return ErrorType.UNKNOWN
  }

  /**
   * 获取可能的错误原因
   */
  private async getPossibleCauses(
    errorType: ErrorType, 
    errorMessage: string, 
    context?: any
  ): Promise<string[]> {
    const baseCauses: Record<ErrorType, string[]> = {
      [ErrorType.SYNTAX_ERROR]: [
        '代码语法不正确',
        '括号或引号未匹配',
        '使用了错误的字符编码'
      ],
      [ErrorType.RUNTIME_ERROR]: [
        '变量未定义',
        '类型不匹配',
        '调用了不存在的方法'
      ],
      [ErrorType.PERMISSION_ERROR]: [
        '文件权限不足',
        '需要管理员权限',
        '目标目录不可写'
      ],
      [ErrorType.NOT_FOUND]: [
        '文件路径不正确',
        '文件已被删除或移动',
        '工作目录设置错误'
      ],
      [ErrorType.TIMEOUT]: [
        '网络连接慢',
        '服务器响应时间长',
        '操作过于复杂'
      ],
      [ErrorType.NETWORK_ERROR]: [
        '网络连接中断',
        '服务器不可用',
        '防火墙阻止了请求'
      ],
      [ErrorType.INVALID_INPUT]: [
        '参数格式不正确',
        '缺少必需参数',
        '参数值超出范围'
      ],
      [ErrorType.UNKNOWN]: [
        '未知的内部错误',
        '环境配置问题',
        '版本不兼容'
      ]
    }

    // 如果有上下文，可以使用LLM来获取更精确的原因分析
    if (context && (context.taskDir || context.history)) {
      try {
        const messages: LLMMessage[] = [
          {
            role: 'system',
            content: '你是一个错误分析助手。请分析以下错误，提供3-5个可能的根本原因。只返回原因列表，每行一个。'
          },
          {
            role: 'user',
            content: `错误类型: ${errorType}\n错误信息: ${errorMessage}\n上下文: ${JSON.stringify(context)}`
          }
        ]

        const response = await llmService.chat('openai', messages, { temperature: 0.3 })
        if (response.success && response.content) {
          const llmCauses = response.content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .slice(0, 5)
          
          if (llmCauses.length > 0) {
            return llmCauses
          }
        }
      } catch (e) {
        // 忽略LLM错误，使用默认原因
      }
    }

    return baseCauses[errorType] || baseCauses[ErrorType.UNKNOWN]
  }

  /**
   * 获取建议的修复方案
   */
  private getSuggestedFixes(errorType: ErrorType): string[] {
    const fixes: Record<ErrorType, string[]> = {
      [ErrorType.SYNTAX_ERROR]: [
        '检查并修正语法错误',
        '确保所有括号和引号正确闭合',
        '使用代码格式化工具'
      ],
      [ErrorType.RUNTIME_ERROR]: [
        '检查变量是否已定义',
        '确保类型转换正确',
        '添加适当的错误处理'
      ],
      [ErrorType.PERMISSION_ERROR]: [
        '检查文件权限设置',
        '使用sudo提升权限',
        '更改文件所有权'
      ],
      [ErrorType.NOT_FOUND]: [
        '检查文件路径是否正确',
        '确认文件是否存在',
        '使用绝对路径'
      ],
      [ErrorType.TIMEOUT]: [
        '增加超时时间',
        '简化操作步骤',
        '检查网络连接'
      ],
      [ErrorType.NETWORK_ERROR]: [
        '检查网络连接',
        '重试请求',
        '使用备用服务器'
      ],
      [ErrorType.INVALID_INPUT]: [
        '验证输入参数格式',
        '检查必需参数',
        '查看API文档'
      ],
      [ErrorType.UNKNOWN]: [
        '查看详细错误日志',
        '尝试简化任务',
        '请求用户帮助'
      ]
    }

    return fixes[errorType] || fixes[ErrorType.UNKNOWN]
  }

  /**
   * 计算错误分析的置信度
   */
  private calculateConfidence(errorType: ErrorType): number {
    // 基于错误类型的默认置信度
    const baseConfidence: Record<ErrorType, number> = {
      [ErrorType.SYNTAX_ERROR]: 0.9,
      [ErrorType.RUNTIME_ERROR]: 0.8,
      [ErrorType.PERMISSION_ERROR]: 0.85,
      [ErrorType.NOT_FOUND]: 0.9,
      [ErrorType.TIMEOUT]: 0.7,
      [ErrorType.NETWORK_ERROR]: 0.75,
      [ErrorType.INVALID_INPUT]: 0.8,
      [ErrorType.UNKNOWN]: 0.5
    }

    return baseConfidence[errorType] || 0.5
  }

  /**
   * 选择纠正策略
   */
  private selectStrategy(analysis: ErrorAnalysis, reflection?: any): CorrectionStrategy {
    const { errorType, confidence } = analysis

    // 如果有反思结果，优先使用反思建议
    if (reflection && reflection.nextStepSuggestion) {
      console.log(`[SelfCorrection] Using reflection-based strategy:`, reflection.nextStepSuggestion)
      
      if (reflection.nextStepSuggestion.action !== analysis.errorType) {
        if (reflection.errorAnalysis?.alternativeTools && reflection.errorAnalysis.alternativeTools.length > 0) {
          return CorrectionStrategy.USE_ALTERNATIVE_TOOL
        } else if (reflection.learning?.insights && reflection.learning.insights.length > 0) {
          return CorrectionStrategy.RETRY_WITH_MODIFICATION
        }
      }
    }

    // 高置信度的可自动纠正错误
    if (confidence > 0.8) {
      switch (errorType) {
        case ErrorType.TIMEOUT:
        case ErrorType.NETWORK_ERROR:
          return CorrectionStrategy.RETRY_WITH_MODIFICATION
        
        case ErrorType.NOT_FOUND:
        case ErrorType.INVALID_INPUT:
          return CorrectionStrategy.RETRY_WITH_MODIFICATION
        
        case ErrorType.PERMISSION_ERROR:
          return CorrectionStrategy.USE_ALTERNATIVE_TOOL
        
        case ErrorType.RUNTIME_ERROR:
        case ErrorType.SYNTAX_ERROR:
          return CorrectionStrategy.RETRY_WITH_MODIFICATION
      }
    }

    // 低置信度或复杂错误，寻求用户帮助
    if (confidence < 0.6) {
      return CorrectionStrategy.ASK_USER
    }

    // 中等置信度，尝试修改后重试
    return CorrectionStrategy.RETRY_WITH_MODIFICATION
  }

  /**
   * 建议修改方案
   */
  private async suggestModification(
    action: string,
    input: any,
    analysis: ErrorAnalysis,
    reflection?: any
  ): Promise<{ action: string; actionInput: any }> {
    // 首先尝试基于错误类型的自动修复
    const autoFixes = this.getAutoFixes(analysis, action, input)
    if (autoFixes) {
      return autoFixes
    }

    // 如果有反思结果，优先使用反思建议
    if (reflection && reflection.nextStepSuggestion) {
      console.log(`[SelfCorrection] Using reflection suggestion:`, reflection.nextStepSuggestion)
      return {
        action: reflection.nextStepSuggestion.action,
        actionInput: input
      }
    }

    // 使用LLM来生成修改建议
    try {
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: '你是一个代码修复助手。根据错误分析，建议如何修改工具调用参数。只返回JSON格式的建议，包含action和actionInput字段。'
        },
        {
          role: 'user',
          content: `原始工具: ${action}\n原始参数: ${JSON.stringify(input)}\n错误类型: ${analysis.errorType}\n错误信息: ${analysis.errorMessage}\n可能原因: ${analysis.possibleCauses.join(', ')}`
        }
      ]

      const response = await llmService.chat('openai', messages, { temperature: 0.3 })
      if (response.success && response.content) {
        const parsed = JSON.parse(response.content)
        if (parsed.action && parsed.actionInput) {
          return parsed
        }
      }
    } catch (e) {
      // 忽略LLM错误，使用默认修复
    }

    // 默认：返回原始参数，让重试逻辑处理
    return { action, actionInput: input }
  }

  /**
   * 获取自动修复方案
   */
  private getAutoFixes(
    analysis: ErrorAnalysis,
    action: string,
    input: any
  ): { action: string; actionInput: any } | null {
    const { errorType } = analysis

    // 路径错误：尝试修正路径
    if (errorType === ErrorType.NOT_FOUND && (action === 'read_file' || action === 'write_file')) {
      const path = input.path || input.filePath
      if (path) {
        // 尝试常见的路径修正
        const corrections = [
          path.replace(/\/Documents\//, '/Desktop/'),
          path.replace(/\/Downloads\//, '/Desktop/')
        ]

        for (const correctedPath of corrections) {
          const fs = require('fs')
          if (fs.existsSync(correctedPath)) {
            return {
              action,
              actionInput: { ...input, path: correctedPath, filePath: correctedPath }
            }
          }
        }
      }
    }

    // 超时错误：增加超时时间
    if (errorType === ErrorType.TIMEOUT && input.timeout) {
      return {
        action,
        actionInput: { ...input, timeout: (input.timeout || 30000) * 2 }
      }
    }

    // 权限错误：尝试其他路径或请求用户
    if (errorType === ErrorType.PERMISSION_ERROR) {
      // 返回原参数，让上层决定是否询问用户
      return { action, actionInput: input }
    }

    return null
  }

  /**
   * 查找替代工具
   */
  private async findAlternativeTool(
    failedAction: string
  ): Promise<{ action: string; actionInput?: any } | null> {
    const toolAlternatives: Record<string, string[]> = {
      'read_file': ['fetch_webpage', 'http_request'],
      'write_file': ['clipboard_write'],
      'execute_command': ['execute_node', 'execute_python'],
      'search_web': ['http_request'],
      'glob_paths': ['list_files', 'search_content']
    }

    const alternatives = toolAlternatives[failedAction]
    if (!alternatives || alternatives.length === 0) {
      return null
    }

    // 检查哪些替代工具可用
    for (const alt of alternatives) {
      const tool = toolRegistry.getTool(alt)
      if (tool) {
        console.log(`[SelfCorrection] Found alternative tool: ${alt} for ${failedAction}`)
        return { action: alt }
      }
    }

    return null
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(entry: CorrectionHistory): void {
    this.correctionHistory.push(entry)
    
    // 保持历史记录在限制范围内
    if (this.correctionHistory.length > this.maxHistorySize) {
      this.correctionHistory = this.correctionHistory.slice(-this.maxHistorySize)
    }

    // 持久化保存
    this.saveHistory()
  }

  /**
   * 获取纠正历史
   */
  getHistory(): CorrectionHistory[] {
    return [...this.correctionHistory]
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalAttempts: number
    successRate: number
    mostCommonError: ErrorType
    mostUsedStrategy: CorrectionStrategy
  } {
    if (this.correctionHistory.length === 0) {
      return {
        totalAttempts: 0,
        successRate: 0,
        mostCommonError: ErrorType.UNKNOWN,
        mostUsedStrategy: CorrectionStrategy.ASK_USER
      }
    }

    const successCount = this.correctionHistory.filter(h => h.result === 'success').length
    const successRate = successCount / this.correctionHistory.length

    // 统计最常见的错误类型
    const errorCounts: Record<ErrorType, number> = {} as any
    for (const h of this.correctionHistory) {
      errorCounts[h.errorType] = (errorCounts[h.errorType] || 0) + 1
    }
    const mostCommonError = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] as ErrorType || ErrorType.UNKNOWN

    // 统计最常用的策略
    const strategyCounts: Record<CorrectionStrategy, number> = {} as any
    for (const h of this.correctionHistory) {
      strategyCounts[h.strategy] = (strategyCounts[h.strategy] || 0) + 1
    }
    const mostUsedStrategy = Object.entries(strategyCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] as CorrectionStrategy || CorrectionStrategy.ASK_USER

    return {
      totalAttempts: this.correctionHistory.length,
      successRate: Math.round(successRate * 100) / 100,
      mostCommonError,
      mostUsedStrategy
    }
  }

  /**
   * 保存历史到持久化存储
   */
  private saveHistory(): void {
    try {
      const fs = require('fs')
      const path = require('path')
      const { app } = require('electron')
      
      const historyPath = path.join(app.getPath('userData'), 'correction_history.json')
      fs.writeFileSync(historyPath, JSON.stringify(this.correctionHistory))
    } catch (e) {
      console.error('[SelfCorrection] Failed to save history:', e)
    }
  }

  /**
   * 从持久化存储加载历史
   */
  private loadHistory(): void {
    try {
      const fs = require('fs')
      const path = require('path')
      const { app } = require('electron')
      
      const historyPath = path.join(app.getPath('userData'), 'correction_history.json')
      if (fs.existsSync(historyPath)) {
        this.correctionHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'))
      }
    } catch (e) {
      console.error('[SelfCorrection] Failed to load history:', e)
      this.correctionHistory = []
    }
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.correctionHistory = []
    this.saveHistory()
  }

  /**
   * 预测操作是否会失败
   */
  async predictError(action: string, input: any, context?: any): Promise<ErrorPrediction> {
    
    // 1. 检查错误模式
    const patternMatch = this.matchErrorPattern(action, input, context)
    
    // 2. 使用LLM进行预测
    let llmPrediction: any = null
    try {
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: '你是一个错误预测专家。分析以下操作和参数，预测是否会失败，如果会，预测可能的错误类型和原因，并提供预防建议。'
        },
        {
          role: 'user',
          content: `操作: ${action}\n参数: ${JSON.stringify(input)}\n上下文: ${JSON.stringify(context)}\n\n请返回JSON格式，包含：\n- willFail: boolean\n- predictedErrorType: string (可选)\n- predictedErrorMessage: string (可选)\n- confidence: number (0-1)\n- preventionSuggestions: string[]\n- riskLevel: "low" | "medium" | "high"`
        }
      ]
      
      const response = await llmService.chat('openai', messages, { temperature: 0.3 })
      if (response.success && response.content) {
        llmPrediction = JSON.parse(response.content)
      }
    } catch (e) {
      // 忽略LLM错误，使用模式匹配结果
    }
    
    // 3. 综合分析
    const prediction: ErrorPrediction = {
      willFail: patternMatch.willFail || (llmPrediction?.willFail || false),
      predictedErrorType: patternMatch.predictedErrorType || (llmPrediction?.predictedErrorType as ErrorType),
      predictedErrorMessage: patternMatch.predictedErrorMessage || llmPrediction?.predictedErrorMessage,
      confidence: Math.max(patternMatch.confidence || 0, typeof llmPrediction?.confidence === 'number' ? llmPrediction.confidence : 0),
      preventionSuggestions: [
        ...(Array.isArray(patternMatch.preventionSuggestions) ? patternMatch.preventionSuggestions : []),
        ...(Array.isArray(llmPrediction?.preventionSuggestions) ? llmPrediction.preventionSuggestions : [])
      ],
      riskLevel: this.calculateRiskLevel(action, input, patternMatch, llmPrediction)
    }
    
    // 4. 学习新模式
    if (prediction.confidence > 0.7) {
      this.learnErrorPattern(action, input, prediction, context)
    }
    
    return prediction
  }

  /**
   * 匹配错误模式
   */
  private matchErrorPattern(action: string, input: any, context?: any): Partial<ErrorPrediction> {
    let bestMatch: Partial<ErrorPrediction> = {
      willFail: false,
      confidence: 0,
      preventionSuggestions: []
    }
    
    const inputStr = JSON.stringify(input)
    const contextStr = JSON.stringify(context)
    
    for (const pattern of this.errorPatterns) {
      // 检查操作匹配
      if (action.includes(pattern.pattern) || pattern.pattern.includes(action)) {
        // 检查输入模式匹配
        const inputMatch = inputStr.includes(pattern.pattern)
        // 检查上下文匹配
        const contextMatch = contextStr.includes(pattern.pattern)
        
        if (inputMatch || contextMatch) {
          const matchScore = (inputMatch ? 0.6 : 0) + (contextMatch ? 0.4 : 0)
          if (matchScore > bestMatch.confidence!) {
            bestMatch = {
              willFail: true,
              predictedErrorType: pattern.errorType,
              predictedErrorMessage: `可能的${pattern.errorType}错误`,
              confidence: matchScore * (pattern.frequency / 10),
              preventionSuggestions: this.getPatternPreventionSuggestions(pattern),
              riskLevel: pattern.frequency > 5 ? 'high' : pattern.frequency > 2 ? 'medium' : 'low'
            }
          }
        }
      }
    }
    
    return bestMatch
  }

  /**
   * 学习错误模式
   */
  private learnErrorPattern(action: string, input: any, prediction: ErrorPrediction, context?: any): void {
    if (!prediction.willFail) return
    
    const patternText = this.extractPattern(action, input, prediction.predictedErrorType!)
    const existingPattern = this.errorPatterns.find(p => p.pattern === patternText)
    
    if (existingPattern) {
      // 更新现有模式
      existingPattern.frequency++
      existingPattern.lastOccurred = Date.now()
      existingPattern.contextKeywords = this.extractKeywords(context || {})
      existingPattern.successfulStrategies = this.uniqueArray([...existingPattern.successfulStrategies, 'prevention'])
    } else {
      // 创建新模式
      const newPattern: ErrorPattern = {
        id: `pattern_${Date.now()}`,
        pattern: patternText,
        errorType: prediction.predictedErrorType!,
        frequency: 1,
        lastOccurred: Date.now(),
        contextKeywords: this.extractKeywords(context || {}),
        successfulStrategies: ['prevention']
      }
      
      this.errorPatterns.push(newPattern)
      
      // 保持模式数量在限制范围内
      if (this.errorPatterns.length > this.maxPatterns) {
        this.errorPatterns = this.errorPatterns
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, this.maxPatterns)
      }
    }
    
    this.saveErrorPatterns()
  }

  /**
   * 提取模式文本
   */
  private extractPattern(action: string, input: any, errorType: ErrorType): string {
    const keyWords = this.extractKeywords(input)
    
    return `${action}_${errorType}_${keyWords.slice(0, 3).join('_')}`
  }

  /**
   * 提取关键词
   */
  private extractKeywords(obj: any): string[] {
    const str = JSON.stringify(obj)
    const words = str
      .replace(/[^a-zA-Z0-9_]/g, ' ')
      .split(' ')
      .filter(w => w.length > 3 && !w.match(/^\d+$/))
      .slice(0, 5)
    
    return this.uniqueArray(words)
  }

  /**
   * 数组去重
   */
  private uniqueArray<T>(array: T[]): T[] {
    const seen = new Map<T, boolean>()
    return array.filter(item => {
      if (seen.has(item)) {
        return false
      }
      seen.set(item, true)
      return true
    })
  }

  /**
   * 获取模式预防建议
   */
  private getPatternPreventionSuggestions(pattern: ErrorPattern): string[] {
    const suggestions: Record<ErrorType, string[]> = {
      [ErrorType.SYNTAX_ERROR]: ['检查代码语法', '验证括号和引号匹配', '使用语法检查工具'],
      [ErrorType.RUNTIME_ERROR]: ['验证变量定义', '添加类型检查', '使用try-catch'],
      [ErrorType.PERMISSION_ERROR]: ['检查文件权限', '以管理员身份运行', '修改目标路径'],
      [ErrorType.NOT_FOUND]: ['验证文件路径', '检查文件是否存在', '使用绝对路径'],
      [ErrorType.TIMEOUT]: ['增加超时时间', '优化网络连接', '分批处理大任务'],
      [ErrorType.NETWORK_ERROR]: ['检查网络连接', '验证URL正确性', '使用备用网络'],
      [ErrorType.INVALID_INPUT]: ['验证参数格式', '检查必需参数', '使用默认值'],
      [ErrorType.UNKNOWN]: ['添加错误处理', '记录详细日志', '尝试简化操作']
    }
    
    return suggestions[pattern.errorType] || ['添加错误处理', '记录详细日志']
  }

  /**
   * 计算风险级别
   */
  private calculateRiskLevel(action: string, input: any, patternMatch: any, llmPrediction: any): 'low' | 'medium' | 'high' {
    let riskScore = 0
    
    // 基于操作类型的风险
    const highRiskActions = ['execute_command', 'write_file', 'delete_file']
    if (highRiskActions.includes(action)) {
      riskScore += 0.5
    }
    
    // 基于输入的风险
    if (input.path && input.path.includes('/system/')) {
      riskScore += 0.3
    }
    
    // 基于模式匹配的风险
    if (patternMatch.willFail) {
      riskScore += 0.4
    }
    
    // 基于LLM预测的风险
    if (llmPrediction?.riskLevel === 'high') {
      riskScore += 0.3
    }
    
    if (riskScore >= 0.7) return 'high'
    if (riskScore >= 0.3) return 'medium'
    return 'low'
  }

  /**
   * 评估纠正效果
   */
  evaluateCorrection(correction: CorrectionResult, originalError: any, timeToFix: number): CorrectionEvaluation {
    const wasPreventable = this.wasErrorPreventable(originalError)
    const preventionOpportunities = this.getPreventionOpportunities(originalError)
    
    return {
      success: correction.success,
      strategy: correction.strategy,
      timeToFix,
      confidenceImprovement: correction.success ? 0.5 : 0,
      wasPreventable,
      preventionOpportunities
    }
  }

  /**
   * 检查错误是否可预防
   */
  private wasErrorPreventable(error: any): boolean {
    const errorMessage = error?.message || String(error)
    
    // 常见可预防错误
    const preventablePatterns = [
      'syntax', 'undefined', 'not found', 'permission denied', 'timeout'
    ]
    
    return preventablePatterns.some(pattern => errorMessage.toLowerCase().includes(pattern))
  }

  /**
   * 获取预防机会
   */
  private getPreventionOpportunities(error: any): string[] {
    const opportunities: string[] = []
    const errorMessage = error?.message || String(error)
    
    if (errorMessage.includes('syntax')) {
      opportunities.push('使用语法检查工具')
    }
    if (errorMessage.includes('undefined')) {
      opportunities.push('添加变量存在性检查')
    }
    if (errorMessage.includes('not found')) {
      opportunities.push('验证路径和资源存在性')
    }
    if (errorMessage.includes('permission')) {
      opportunities.push('检查权限设置')
    }
    if (errorMessage.includes('timeout')) {
      opportunities.push('增加超时时间或优化操作')
    }
    
    return opportunities
  }

  /**
   * 保存错误模式
   */
  private saveErrorPatterns(): void {
    try {
      const fs = require('fs')
      const path = require('path')
      const { app } = require('electron')
      
      const patternsPath = path.join(app.getPath('userData'), 'error_patterns.json')
      fs.writeFileSync(patternsPath, JSON.stringify(this.errorPatterns))
    } catch (e) {
      console.error('[SelfCorrection] Failed to save error patterns:', e)
    }
  }

  /**
   * 加载错误模式
   */
  private loadErrorPatterns(): void {
    try {
      const fs = require('fs')
      const path = require('path')
      const { app } = require('electron')
      
      let patternsPath
      try {
        patternsPath = path.join(app.getPath('userData'), 'error_patterns.json')
      } catch (error) {
        console.warn('Failed to get userData path for error patterns, using current directory:', error)
        patternsPath = path.join(process.cwd(), 'error_patterns.json')
      }
      if (fs.existsSync(patternsPath)) {
        this.errorPatterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8'))
      }
    } catch (e) {
      console.error('[SelfCorrection] Failed to load error patterns:', e)
      this.errorPatterns = []
    }
  }

  /**
   * 设置最大重试次数
   */
  setMaxRetries(max: number): void {
    this.maxRetries = Math.max(1, Math.min(max, 10))
  }
}

// 导出单例
export const selfCorrectionEngine = new SelfCorrectionEngine()
