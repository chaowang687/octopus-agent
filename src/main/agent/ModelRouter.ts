/**
 * 模型路由器 - 智能分配 System 1 / System 2 的模型
 * 根据任务复杂度、情绪状态、用户配置自动选择最优模型
 * 
 * 新增功能：
 * - 细粒度任务类型路由 (TaskType → Model)
 * - 混合模式调度 (本地小模型 + 云端大模型)
 * - 决策解释能力
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { llmService } from '../services/LLMService'
import { EmotionVector } from './EmotionTypes'

// ============================================
// 任务类型枚举 - 细粒度路由
// ============================================
export enum TaskType {
  // 代码相关
  CODE_GENERATION = 'code_gen',       // 代码生成
  CODE_REFACTOR = 'code_refactor',    // 代码重构
  CODE_FIX = 'code_fix',              // Bug修复
  CODE_REVIEW = 'code_review',        // 代码审查
  
  // 规划与推理
  PLANNING = 'planning',              // 任务规划
  REASONING = 'reasoning',            // 深度推理
  
  // 信息检索
  FILE_RETRIEVAL = 'file_retrieval',  // 文件检索
  CODE_SUMMARY = 'code_summary',       // 代码摘要
  
  // 对话与问答
  QA = 'qa',                          // 问答
  CHAT = 'chat',                      // 闲聊
  
  // 执行操作
  COMMAND_EXEC = 'command_exec',      // 命令执行
  PROJECT_SETUP = 'project_setup'     // 项目初始化
}

// 任务类型中文映射
export const TaskTypeLabel: Record<TaskType, string> = {
  [TaskType.CODE_GENERATION]: '代码生成',
  [TaskType.CODE_REFACTOR]: '代码重构',
  [TaskType.CODE_FIX]: 'Bug修复',
  [TaskType.CODE_REVIEW]: '代码审查',
  [TaskType.PLANNING]: '任务规划',
  [TaskType.REASONING]: '深度推理',
  [TaskType.FILE_RETRIEVAL]: '文件检索',
  [TaskType.CODE_SUMMARY]: '代码摘要',
  [TaskType.QA]: '问答',
  [TaskType.CHAT]: '闲聊',
  [TaskType.COMMAND_EXEC]: '命令执行',
  [TaskType.PROJECT_SETUP]: '项目初始化'
}

// 任务类型 → 关键词映射（用于自动识别）
export const TaskTypeKeywords: Record<TaskType, string[]> = {
  [TaskType.CODE_GENERATION]: ['开发', '创建', '实现', '写代码', 'build', 'create', 'implement', 'write code'],
  [TaskType.CODE_REFACTOR]: ['重构', '优化', 'refactor', 'optimize', '改进'],
  [TaskType.CODE_FIX]: ['修复', 'bug', '错误', '问题', 'fix', 'error', 'issue'],
  [TaskType.CODE_REVIEW]: ['审查', 'review', '检查', '评审'],
  [TaskType.PLANNING]: ['规划', '计划', '步骤', 'plan', '步骤'],
  [TaskType.REASONING]: ['分析', '思考', '推理', 'analyze', 'reason'],
  [TaskType.FILE_RETRIEVAL]: ['查找', '搜索', '找文件', 'find', 'search', 'locate'],
  [TaskType.CODE_SUMMARY]: ['总结', '摘要', '解释', 'summarize', 'explain'],
  [TaskType.QA]: ['什么是', '如何', '怎么', 'what is', 'how to', 'why'],
  [TaskType.CHAT]: ['你好', '天气', '聊天', 'hello', 'chat'],
  [TaskType.COMMAND_EXEC]: ['运行', '执行', '命令', 'run', 'execute', 'command'],
  [TaskType.PROJECT_SETUP]: ['初始化', '新建项目', 'setup', 'init project']
}

// 路由决策结果
export interface RoutingDecisionResult {
  model: string
  options: any
  taskType: TaskType
  reasoning: string          // 选择理由
  alternatives: string[]    // 考虑的替代方案
  confidence: number        // 置信度 0-1
}

// ============================================
// 模型配置
// ============================================

export interface ModelConfig {
  system1: {
    /** 用户首选模型 */
    preferred: string
    /** 回退模型列表 */
    fallback: string[]
    /** 超时时间(ms) */
    timeout: number
    /** 温度参数 */
    temperature: number
  }
  system2: {
    /** 用户首选模型 */
    preferred: string
    /** 回退模型列表 */
    fallback: string[]
    /** 超时时间(ms) */
    timeout: number
    /** 温度参数 */
    temperature: number
  }
}

// 模型能力定义
export interface ModelCapability {
  id: string
  name: string
  provider: 'openai' | 'deepseek' | 'claude' | 'minimax' | 'doubao'
  contextWindow: number
  isFast: boolean // 是否适合快速响应
  isStrong: boolean // 是否适合深度推理
  costLevel: 'low' | 'medium' | 'high'
}

// 模型能力映射
const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  // OpenAI
  'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000, isFast: false, isStrong: true, costLevel: 'high' },
  'gpt-4o-mini': { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000, isFast: true, isStrong: true, costLevel: 'medium' },
  'gpt-3.5-turbo': { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', contextWindow: 16385, isFast: true, isStrong: false, costLevel: 'low' },
  // Anthropic
  'claude-3-opus': { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'claude', contextWindow: 200000, isFast: false, isStrong: true, costLevel: 'high' },
  'claude-3-sonnet': { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'claude', contextWindow: 200000, isFast: true, isStrong: true, costLevel: 'medium' },
  'claude-3-haiku': { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'claude', contextWindow: 200000, isFast: true, isStrong: false, costLevel: 'low' },
  // DeepSeek
  'deepseek-chat': { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', contextWindow: 16384, isFast: true, isStrong: false, costLevel: 'low' },
  'deepseek-coder': { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'deepseek', contextWindow: 16384, isFast: true, isStrong: true, costLevel: 'low' },
  // MiniMax
  'abab6.5s-chat': { id: 'abab6.5s-chat', name: 'MiniMax Chat', provider: 'minimax', contextWindow: 245760, isFast: true, isStrong: true, costLevel: 'medium' },
  // Doubao (字节跳动)
  'doubao-pro-32k': { id: 'doubao-pro-32k', name: 'Doubao Pro 32K', provider: 'doubao', contextWindow: 32000, isFast: true, isStrong: true, costLevel: 'medium' },
  'doubao-pro-128k': { id: 'doubao-pro-128k', name: 'Doubao Pro 128K', provider: 'doubao', contextWindow: 128000, isFast: false, isStrong: true, costLevel: 'high' },
  'doubao-seed-2-0-lite-260215': { id: 'doubao-seed-2-0-lite-260215', name: 'Doubao Seed 2.0 Lite', provider: 'doubao', contextWindow: 128000, isFast: true, isStrong: true, costLevel: 'low' },
  'doubao-seed-2-0-code-preview-260215': { id: 'doubao-seed-2-0-code-preview-260215', name: 'Doubao Seed 2.0 Code', provider: 'doubao', contextWindow: 128000, isFast: true, isStrong: true, costLevel: 'medium' },
}

// ============================================
// 任务类型路由配置 - 细粒度模型选择
// ============================================
export interface TaskTypeRoutingConfig {
  primary: string           // 主选模型
  fallback: string[]        // 回退模型列表
  useLocalFirst: boolean    // 简单任务是否优先使用本地/快速模型
  temperature: number
  maxTokens: number
}

const TASK_TYPE_ROUTING: Record<TaskType, TaskTypeRoutingConfig> = {
  // 代码生成 - 使用豆包Lite
  [TaskType.CODE_GENERATION]: {
    primary: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-32k'],
    useLocalFirst: false,
    temperature: 0.3,
    maxTokens: 8000
  },
  // 代码重构
  [TaskType.CODE_REFACTOR]: {
    primary: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-128k'],
    useLocalFirst: false,
    temperature: 0.2,
    maxTokens: 10000
  },
  // Bug修复
  [TaskType.CODE_FIX]: {
    primary: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-32k'],
    useLocalFirst: false,
    temperature: 0.2,
    maxTokens: 6000
  },
  // 代码审查
  [TaskType.CODE_REVIEW]: {
    primary: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-128k'],
    useLocalFirst: false,
    temperature: 0.3,
    maxTokens: 8000
  },
  // 任务规划
  [TaskType.PLANNING]: {
    primary: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-128k'],
    useLocalFirst: false,
    temperature: 0.3,
    maxTokens: 6000
  },
  // 深度推理
  [TaskType.REASONING]: {
    primary: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-128k'],
    useLocalFirst: false,
    temperature: 0.2,
    maxTokens: 8000
  },
  // 文件检索
  [TaskType.FILE_RETRIEVAL]: {
    primary: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-32k'],
    useLocalFirst: true,
    temperature: 0.5,
    maxTokens: 2000
  },
  // 代码摘要
  [TaskType.CODE_SUMMARY]: {
    primary: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-32k'],
    useLocalFirst: true,
    temperature: 0.4,
    maxTokens: 4000
  },
  // 问答
  [TaskType.QA]: {
    primary: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-32k'],
    useLocalFirst: true,
    temperature: 0.7,
    maxTokens: 2000
  },
  // 闲聊
  [TaskType.CHAT]: {
    primary: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-32k'],
    useLocalFirst: true,
    temperature: 0.8,
    maxTokens: 1000
  },
  // 命令执行
  [TaskType.COMMAND_EXEC]: {
    primary: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-32k'],
    useLocalFirst: false,
    temperature: 0.3,
    maxTokens: 4000
  },
  // 项目初始化
  [TaskType.PROJECT_SETUP]: {
    primary: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-32k'],
    useLocalFirst: false,
    temperature: 0.3,
    maxTokens: 6000
  }
}

// 默认配置
const DEFAULT_CONFIG: ModelConfig = {
  system1: {
    preferred: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-32k'],
    timeout: 10000,
    temperature: 0.7
  },
  system2: {
    preferred: 'doubao-seed-2-0-lite-260215',
    fallback: ['doubao-pro-128k'],
    timeout: 120000,
    temperature: 0.3
  }
}

// ============================================
// 模型路由器类
// ============================================

export class ModelRouter {
  private configPath: string
  private config: ModelConfig
  
  constructor() {
    try {
      this.configPath = path.join(app.getPath('userData'), 'model_router_config.json')
    } catch (error) {
      console.warn('Failed to get userData path for ModelRouter, using current directory:', error)
      this.configPath = path.join(process.cwd(), 'model_router_config.json')
    }
    this.config = this.loadConfig()
  }

  private loadConfig(): ModelConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
        return { ...DEFAULT_CONFIG, ...data }
      }
    } catch (error) {
      console.error('加载模型配置失败:', error)
    }
    return { ...DEFAULT_CONFIG }
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
    } catch (error) {
      console.error('保存模型配置失败:', error)
    }
  }

  /**
   * 获取 System 1 的模型
   * @param emotion 情绪向量（可选，用于动态调整）
   */
  getSystem1Model(emotion?: EmotionVector): { model: string; options: any } {
    const strategy = this.config.system1
    
    // 根据情绪调整
    if (emotion) {
      // 高紧迫情况，优先选择最快的模型
      if (emotion.urgency > 0.7) {
        const fastestModel = this.findFastestAvailableModel(strategy.fallback)
        if (fastestModel) {
          return {
            model: fastestModel,
            options: { temperature: strategy.temperature, timeout: Math.min(strategy.timeout, 5000) }
          }
        }
      }
    }

    // 检查首选模型是否可用
    if (this.isModelAvailable(strategy.preferred)) {
      return {
        model: strategy.preferred,
        options: { temperature: strategy.temperature, timeout: strategy.timeout }
      }
    }

    // 尝试回退模型
    for (const fallbackModel of strategy.fallback) {
      if (this.isModelAvailable(fallbackModel)) {
        console.log(`ModelRouter: System1 首选模型 ${strategy.preferred} 不可用，使用回退模型 ${fallbackModel}`)
        return {
          model: fallbackModel,
          options: { temperature: strategy.temperature, timeout: strategy.timeout }
        }
      }
    }

    // 最后的兜底：查找任何可用的快速模型
    const emergencyModel = this.findAnyAvailableModel(['doubao-pro-32k', 'doubao-pro-128k'])
    if (emergencyModel) {
      console.log(`ModelRouter: System1 全部配置模型不可用，使用紧急回退 ${emergencyModel}`)
      return {
        model: emergencyModel,
        options: { temperature: 0.8, timeout: 8000 }
      }
    }

    // 完全不可用
    throw new Error('没有可用的 System1 模型，请配置 API Key')
  }

  /**
   * 获取 System 2 的模型
   * @param complexity 复杂度 (0-1)
   */
  getSystem2Model(complexity: number = 0.5): { model: string; options: any } {
    const strategy = this.config.system2
    
    // 高复杂度需要更强大的模型
    if (complexity > 0.7) {
      const strongModels = ['doubao-pro-128k', 'doubao-seed-2-0-lite-260215']
      for (const model of strongModels) {
        if (this.isModelAvailable(model)) {
          return {
            model,
            options: { temperature: 0.2, timeout: strategy.timeout * 2 }
          }
        }
      }
    }

    // 检查首选模型
    if (this.isModelAvailable(strategy.preferred)) {
      return {
        model: strategy.preferred,
        options: { temperature: strategy.temperature, timeout: strategy.timeout }
      }
    }

    // 尝试回退模型
    for (const fallbackModel of strategy.fallback) {
      if (this.isModelAvailable(fallbackModel)) {
        console.log(`ModelRouter: System2 首选模型 ${strategy.preferred} 不可用，使用回退模型 ${fallbackModel}`)
        return {
          model: fallbackModel,
          options: { temperature: strategy.temperature, timeout: strategy.timeout }
        }
      }
    }

    // 兜底
    const emergencyModel = this.findAnyAvailableModel(['doubao-pro-128k', 'doubao-pro-32k'])
    if (emergencyModel) {
      return {
        model: emergencyModel,
        options: { temperature: 0.3, timeout: 60000 }
      }
    }

    throw new Error('没有可用的 System2 模型，请配置 API Key')
  }

  /**
   * 检查模型是否可用（有 API Key）
   */
  private isModelAvailable(modelId: string): boolean {
    // 模型ID到provider的映射
    const providerMap: Record<string, string> = {
      'gpt-4o': 'openai', 'gpt-4o-mini': 'openai', 'gpt-3.5-turbo': 'openai',
      'claude-3-opus': 'claude', 'claude-3-sonnet': 'claude', 'claude-3-haiku': 'claude',
      'deepseek-chat': 'deepseek', 'deepseek-coder': 'deepseek',
      'abab6.5s-chat': 'minimax',
      'doubao-pro-32k': 'doubao', 'doubao-pro-128k': 'doubao'
    }

    const provider = providerMap[modelId]
    if (!provider) return false
    
    return llmService.getApiKey(provider) !== null
  }

  /**
   * 查找最快的可用模型
   */
  private findFastestAvailableModel(models: string[]): string | null {
    for (const model of models) {
      const cap = MODEL_CAPABILITIES[model]
      if (cap && cap.isFast && this.isModelAvailable(model)) {
        return model
      }
    }
    return null
  }

  /**
   * 查找任何可用的模型
   */
  private findAnyAvailableModel(models: string[]): string | null {
    for (const model of models) {
      if (this.isModelAvailable(model)) {
        return model
      }
    }
    return null
  }

  /**
   * 获取配置
   */
  getConfig(): ModelConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<ModelConfig>): void {
    this.config = {
      system1: { ...this.config.system1, ...updates.system1 },
      system2: { ...this.config.system2, ...updates.system2 }
    }
    this.saveConfig()
    console.log('ModelRouter: 配置已更新')
  }

  /**
   * 获取模型能力信息
   */
  getModelCapability(modelId: string): ModelCapability | undefined {
    return MODEL_CAPABILITIES[modelId]
  }

  /**
   * 获取所有可用模型列表
   */
  getAvailableModels(): Array<{ id: string; name: string; provider: string; isFast: boolean; isStrong: boolean }> {
    const available: Array<{ id: string; name: string; provider: string; isFast: boolean; isStrong: boolean }> = []
    
    for (const [id, cap] of Object.entries(MODEL_CAPABILITIES)) {
      if (this.isModelAvailable(id)) {
        available.push({
          id: cap.id,
          name: cap.name,
          provider: cap.provider,
          isFast: cap.isFast,
          isStrong: cap.isStrong
        })
      }
    }
    
    return available
  }

  // ============================================
  // 细粒度任务路由方法
  // ============================================

  /**
   * 分析用户输入的任务类型（基于关键词匹配）
   * @param instruction 用户输入
   */
  analyzeTaskType(instruction: string): TaskType {
    const lowerInput = instruction.toLowerCase()
    let maxMatches = 0
    let detectedType = TaskType.QA // 默认类型

    for (const [taskType, keywords] of Object.entries(TaskTypeKeywords)) {
      const matches = keywords.filter(kw => lowerInput.includes(kw.toLowerCase())).length
      if (matches > maxMatches) {
        maxMatches = matches
        detectedType = taskType as TaskType
      }
    }

    // 特殊规则处理
    if (lowerInput.includes('代码生成') || lowerInput.includes('开发一个') || lowerInput.includes('create ') || lowerInput.includes('build ')) {
      detectedType = TaskType.CODE_GENERATION
    } else if (lowerInput.includes('修复') || lowerInput.includes('bug') || lowerInput.includes('fix')) {
      detectedType = TaskType.CODE_FIX
    } else if (lowerInput.includes('重构') || lowerInput.includes('refactor')) {
      detectedType = TaskType.CODE_REFACTOR
    } else if (lowerInput.includes('审查') || lowerInput.includes('review')) {
      detectedType = TaskType.CODE_REVIEW
    } else if (lowerInput.includes('规划') || lowerInput.includes('计划') || lowerInput.includes('步骤')) {
      detectedType = TaskType.PLANNING
    }

    console.log(`ModelRouter: 任务类型识别结果: ${detectedType} (${TaskTypeLabel[detectedType]})`)
    return detectedType
  }

  /**
   * 根据任务类型选择模型
   * @param taskType 任务类型
   */
  routeByTaskType(taskType: TaskType): RoutingDecisionResult {
    const routingConfig = TASK_TYPE_ROUTING[taskType]
    const alternatives: string[] = [routingConfig.primary, ...routingConfig.fallback]
    
    // 生成选择理由
    const reasoningMap: Record<TaskType, string> = {
      [TaskType.CODE_GENERATION]: '代码生成需要精确的代码理解和生成能力，选择专门优化的代码模型',
      [TaskType.CODE_REFACTOR]: '代码重构需要理解代码结构，选择具有强推理能力的模型',
      [TaskType.CODE_FIX]: 'Bug修复需要分析问题根源，选择具有代码理解能力的模型',
      [TaskType.CODE_REVIEW]: '代码审查需要全面分析，选择擅长理解代码的模型',
      [TaskType.PLANNING]: '任务规划需要强推理能力来分解复杂任务',
      [TaskType.REASONING]: '深度推理需要最强的推理能力',
      [TaskType.FILE_RETRIEVAL]: '文件检索是简单任务，使用快速响应模型即可',
      [TaskType.CODE_SUMMARY]: '代码摘要需要理解能力但不需要深度推理',
      [TaskType.QA]: '简单问答使用轻量级模型以提高响应速度',
      [TaskType.CHAT]: '闲聊使用最轻量的模型以降低成本',
      [TaskType.COMMAND_EXEC]: '命令执行需要代码理解能力',
      [TaskType.PROJECT_SETUP]: '项目初始化需要综合的代码生成能力'
    }

    // 尝试使用主选模型
    if (this.isModelAvailable(routingConfig.primary)) {
      return {
        model: routingConfig.primary,
        options: {
          temperature: routingConfig.temperature,
          max_tokens: routingConfig.maxTokens
        },
        taskType,
        reasoning: reasoningMap[taskType],
        alternatives,
        confidence: 0.9
      }
    }

    // 尝试回退模型
    for (const fallbackModel of routingConfig.fallback) {
      if (this.isModelAvailable(fallbackModel)) {
        console.log(`ModelRouter: 主选模型 ${routingConfig.primary} 不可用，使用回退模型 ${fallbackModel}`)
        return {
          model: fallbackModel,
          options: {
            temperature: routingConfig.temperature,
            max_tokens: routingConfig.maxTokens
          },
          taskType,
          reasoning: `${reasoningMap[taskType]}（主选模型不可用，使用回退）`,
          alternatives,
          confidence: 0.7
        }
      }
    }

    // 最后的兜底：查找任何可用模型
    const emergencyModel = this.findAnyAvailableModel([
      'doubao-pro-32k', 'doubao-pro-128k'
    ])
    if (emergencyModel) {
      return {
        model: emergencyModel,
        options: {
          temperature: 0.5,
          max_tokens: 2000
        },
        taskType,
        reasoning: '所有配置模型不可用，使用紧急回退模型',
        alternatives,
        confidence: 0.5
      }
    }

    throw new Error('没有可用的模型，请配置 API Key')
  }

  /**
   * 智能路由入口 - 自动分析任务类型并选择模型
   * @param instruction 用户输入
   */
  route(instruction: string): RoutingDecisionResult {
    const taskType = this.analyzeTaskType(instruction)
    return this.routeByTaskType(taskType)
  }
}

// 导出单例
export const modelRouter = new ModelRouter()
