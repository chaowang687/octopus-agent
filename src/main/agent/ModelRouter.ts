/**
 * 模型路由器 - 智能分配 System 1 / System 2 的模型
 * 根据任务复杂度、情绪状态、用户配置自动选择最优模型
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { llmService } from '../services/LLMService'
import { EmotionVector } from './EmotionTypes'

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
  'doubao-seed-2-0-code-preview-260215': { id: 'doubao-seed-2-0-code-preview-260215', name: 'Doubao Seed 2.0 Code', provider: 'doubao', contextWindow: 128000, isFast: true, isStrong: true, costLevel: 'medium' },
}

// 默认配置
const DEFAULT_CONFIG: ModelConfig = {
  system1: {
    preferred: 'deepseek-chat',
    fallback: ['doubao-pro-32k', 'gpt-3.5-turbo', 'claude-3-haiku'],
    timeout: 10000,
    temperature: 0.7
  },
  system2: {
    preferred: 'doubao-seed-2-0-code-preview-260215',
    fallback: ['gpt-4o', 'claude-3-opus', 'deepseek-coder'],
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
    this.configPath = path.join(app.getPath('userData'), 'model_router_config.json')
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
    const emergencyModel = this.findAnyAvailableModel(['deepseek-chat', 'doubao-pro-32k', 'gpt-3.5-turbo', 'claude-3-haiku'])
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
      const strongModels = ['gpt-4o', 'claude-3-opus', 'doubao-pro-128k', 'deepseek-coder']
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
    const emergencyModel = this.findAnyAvailableModel(['claude-3-sonnet', 'abab6.5s-chat', 'deepseek-chat'])
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
}

// 导出单例
export const modelRouter = new ModelRouter()
