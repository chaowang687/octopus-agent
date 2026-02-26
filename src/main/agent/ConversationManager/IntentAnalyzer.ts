/**
 * 意图分析器
 * 负责识别用户意图、提取实体和分类消息
 */

import { EventEmitter } from 'events'
import { IntentAnalysis, Entity, IntentType, ProcessedMessage, TaskType } from './types'

export interface IntentAnalyzerOptions {
  enableEntityExtraction?: boolean
  enableConfidenceScoring?: boolean
  model?: string
}

export class IntentAnalyzer extends EventEmitter {
  private enableEntityExtraction: boolean
  private enableConfidenceScoring: boolean
  private model: string

  constructor(options: IntentAnalyzerOptions = {}) {
    super()
    this.enableEntityExtraction = options.enableEntityExtraction !== false
    this.enableConfidenceScoring = options.enableConfidenceScoring !== false
    this.model = options.model || 'gpt-4o-mini'
  }

  async analyze(message: string): Promise<IntentAnalysis> {
    const startTime = Date.now()

    try {
      const intent = await this.detectIntent(message)
      const taskType = this.classifyTaskType(message)
      const priority = this.assessPriority(message)
      const entities = this.enableEntityExtraction
        ? await this.extractEntities(message)
        : []

      const analysis: IntentAnalysis = {
        primaryIntent: intent.primary,
        secondaryIntents: intent.secondary,
        confidence: intent.confidence,
        taskType,
        priority,
        requiresAction: this.requiresAction(intent.primary),
        suggestedActions: this.suggestActions(intent.primary, taskType)
      }

      const processingTime = Date.now() - startTime
      this.emit('intent_analyzed', { message, analysis, processingTime })

      return analysis
    } catch (error: any) {
      this.emit('error', { message, error: error.message })
      return this.getDefaultAnalysis()
    }
  }

  async process(message: string): Promise<ProcessedMessage> {
    const intent = await this.analyze(message)
    const entities = this.enableEntityExtraction
      ? await this.extractEntities(message)
      : []

    return {
      original: message,
      normalized: this.normalizeMessage(message),
      intent,
      entities,
      metadata: {
        intent: intent.primaryIntent,
        entities,
        taskType: intent.taskType,
        priority: intent.priority,
        confidence: intent.confidence
      }
    }
  }

  async extractEntities(message: string): Promise<Entity[]> {
    const entities: Entity[] = []

    const patterns = [
      { type: 'time', regex: /\d{1,2}:\d{2}/g },
      { type: 'date', regex: /\d{4}-\d{2}-\d{2}/g },
      { type: 'number', regex: /\b\d+\b/g },
      { type: 'email', regex: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/g },
      { type: 'url', regex: /https?:\/\/[^\s]+/g },
      { type: 'file', regex: /[\w.-]+\.(ts|js|tsx|jsx|py|java|go|rs|json|md|txt)/g }
    ]

    for (const pattern of patterns) {
      const matches = message.matchAll(pattern.regex)
      for (const match of matches) {
        if (match.index !== undefined) {
          entities.push({
            type: pattern.type,
            value: match[0],
            confidence: 0.9,
            start: match.index,
            end: match.index + match[0].length
          })
        }
      }
    }

    return entities
  }

  private async detectIntent(message: string): Promise<{
    primary: string
    secondary: string[]
    confidence: number
  }> {
    const lowerMessage = message.toLowerCase()

    const intentPatterns: Record<string, RegExp[]> = {
      question: [
        /what|how|why|when|where|who|which|什么|怎么|为什么|什么时候|哪里|谁|哪个/gi
      ],
      task: [
        /create|build|implement|develop|write|generate|创建|构建|实现|开发|写|生成/gi
      ],
      request: [
        /please|help|can you|could you|请|帮助|能否|可以/gi
      ],
      greeting: [
        /hello|hi|hey|good morning|good afternoon|good evening|你好|嗨|早上好|下午好|晚上好/gi
      ],
      farewell: [
        /bye|goodbye|see you|再见|拜拜/gi
      ],
      clarification: [
        /what do you mean|clarify|explain|什么意思|澄清|解释/gi
      ],
      confirmation: [
        /yes|no|correct|right|是|否|正确|对/gi
      ],
      correction: [
        /wrong|incorrect|mistake|error|错误|不对|错了/gi
      ]
    }

    let bestIntent = 'unknown'
    let maxScore = 0
    const secondaryIntents: string[] = []

    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      let score = 0
      for (const pattern of patterns) {
        const matches = message.match(pattern)
        if (matches) {
          score += matches.length
        }
      }

      if (score > maxScore) {
        secondaryIntents.push(bestIntent)
        bestIntent = intent
        maxScore = score
      } else if (score > 0) {
        secondaryIntents.push(intent)
      }
    }

    const confidence = this.enableConfidenceScoring
      ? Math.min(0.5 + (maxScore * 0.1), 0.95)
      : 0.8

    return {
      primary: bestIntent,
      secondary: [...new Set(secondaryIntents)].slice(0, 3),
      confidence
    }
  }

  private classifyTaskType(message: string): any {
    const lowerMessage = message.toLowerCase()

    if (lowerMessage.includes('code') || lowerMessage.includes('代码') ||
        lowerMessage.includes('function') || lowerMessage.includes('函数')) {
      return 'code_generation'
    }

    if (lowerMessage.includes('image') || lowerMessage.includes('图片') ||
        lowerMessage.includes('photo') || lowerMessage.includes('图像')) {
      return 'image_processing'
    }

    if (lowerMessage.includes('analyze') || lowerMessage.includes('分析') ||
        lowerMessage.includes('data') || lowerMessage.includes('数据')) {
      return 'data_analysis'
    }

    if (lowerMessage.includes('project') || lowerMessage.includes('项目')) {
      return 'project_management'
    }

    if (lowerMessage.includes('reasoning') || lowerMessage.includes('推理') ||
        lowerMessage.includes('complex') || lowerMessage.includes('复杂')) {
      return 'complex_reasoning'
    }

    return 'text_processing'
  }

  private assessPriority(message: string): 'low' | 'medium' | 'high' | 'critical' {
    const lowerMessage = message.toLowerCase()

    if (lowerMessage.includes('urgent') || lowerMessage.includes('紧急') ||
        lowerMessage.includes('immediate') || lowerMessage.includes('立即')) {
      return 'critical'
    }

    if (lowerMessage.includes('important') || lowerMessage.includes('重要') ||
        lowerMessage.includes('priority') || lowerMessage.includes('优先')) {
      return 'high'
    }

    if (message.length > 200 || message.includes('\n')) {
      return 'medium'
    }

    return 'low'
  }

  private requiresAction(intent: string): boolean {
    const actionableIntents = ['task', 'request']
    return actionableIntents.includes(intent)
  }

  private suggestActions(intent: string, taskType: any): string[] {
    const suggestions: Record<string, string[]> = {
      task: ['execute_task', 'plan_task'],
      request: ['provide_help', 'clarify_request'],
      question: ['answer_question', 'provide_explanation'],
      code_generation: ['write_code', 'review_code'],
      data_analysis: ['analyze_data', 'generate_report']
    }

    return suggestions[taskType] || suggestions[intent] || []
  }

  private normalizeMessage(message: string): string {
    return message
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\u4e00-\u9fa5.,!?;:()]/g, '')
  }

  private getDefaultAnalysis(): IntentAnalysis {
    return {
      primaryIntent: 'unknown',
      secondaryIntents: [],
      confidence: 0.5,
      taskType: 'text_processing',
      priority: 'low',
      requiresAction: false,
      suggestedActions: []
    }
  }
}
