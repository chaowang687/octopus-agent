import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { LLMResponse, LLMMessage } from './LLMService'

interface ModelConfig {
  id: string
  name: string
  type: 'local' | 'cloud'
  provider: 'openai' | 'deepseek' | 'claude' | 'minimax' | 'vllm' | 'llamacpp'
  model: string
  apiKey?: string
  baseUrl?: string
  config: any
  enabled: boolean
}

interface ModelProvider {
  id: string
  name: string
  type: 'local' | 'cloud'
  models: string[]
  defaultConfig: any
}

export interface ModelService {
  getModels(): ModelConfig[]
  getModel(id: string): ModelConfig | undefined
  addModel(config: Omit<ModelConfig, 'id'>): string
  updateModel(id: string, config: Partial<ModelConfig>): boolean
  deleteModel(id: string): boolean
  chat(modelId: string, messages: LLMMessage[], options?: any): Promise<LLMResponse>
  getProviders(): ModelProvider[]
  testModel(modelId: string): Promise<{ success: boolean; latency?: number; error?: string }>
}

class LocalModelService implements ModelService {
  private models: Map<string, ModelConfig> = new Map()
  private modelsPath: string
  private providers: ModelProvider[] = [
    {
      id: 'openai',
      name: 'OpenAI',
      type: 'cloud',
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      defaultConfig: {
        baseUrl: 'https://api.openai.com/v1'
      }
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      type: 'cloud',
      models: ['deepseek-chat', 'deepseek-coder'],
      defaultConfig: {
        baseUrl: 'https://api.deepseek.com/v1'
      }
    },
    {
      id: 'claude',
      name: 'Claude',
      type: 'cloud',
      models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
      defaultConfig: {
        baseUrl: 'https://api.anthropic.com/v1'
      }
    },
    {
      id: 'minimax',
      name: 'MiniMax',
      type: 'cloud',
      models: ['abab6.5s-chat', 'abab6-chat'],
      defaultConfig: {
        baseUrl: 'https://api.minimax.chat/v1'
      }
    },
    {
      id: 'vllm',
      name: 'vLLM',
      type: 'local',
      models: ['qwen2.5-32b', 'deepseek-v3', 'codellama-7b'],
      defaultConfig: {
        baseUrl: 'http://localhost:8000/v1',
        temperature: 0.1,
        max_tokens: 2000
      }
    },
    {
      id: 'llamacpp',
      name: 'llama.cpp',
      type: 'local',
      models: ['llama3-8b', 'mistral-7b', 'gemma-7b'],
      defaultConfig: {
        baseUrl: 'http://localhost:8080',
        temperature: 0.1,
        max_tokens: 2000
      }
    }
  ]

  constructor() {
    this.modelsPath = ''
  }

  /**
   * 初始化模型服务
   */
  initialize(): void {
    if (!this.modelsPath && app) {
      this.modelsPath = path.join(app.getPath('userData'), 'models.json')
      this.loadModels()
    }
  }

  private loadModels() {
    try {
      if (!this.modelsPath && app) {
        this.modelsPath = path.join(app.getPath('userData'), 'models.json')
      }
      if (this.modelsPath && fs.existsSync(this.modelsPath)) {
        const models = JSON.parse(fs.readFileSync(this.modelsPath, 'utf8'))
        if (Array.isArray(models)) {
          models.forEach(model => {
            this.models.set(model.id, model)
          })
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  private saveModels() {
    try {
      if (!this.modelsPath && app) {
        this.modelsPath = path.join(app.getPath('userData'), 'models.json')
      }
      if (this.modelsPath) {
        const models = Array.from(this.models.values())
        fs.writeFileSync(this.modelsPath, JSON.stringify(models, null, 2))
      }
    } catch (error) {
      console.error('Failed to save models:', error)
    }
  }

  getModels(): ModelConfig[] {
    return Array.from(this.models.values()).filter(model => model.enabled)
  }

  getModel(id: string): ModelConfig | undefined {
    return this.models.get(id)
  }

  addModel(config: Omit<ModelConfig, 'id'>): string {
    const id = `model_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const model: ModelConfig = {
      id,
      ...config
    }
    this.models.set(id, model)
    this.saveModels()
    return id
  }

  updateModel(id: string, config: Partial<ModelConfig>): boolean {
    const model = this.models.get(id)
    if (!model) {
      return false
    }
    const updatedModel = {
      ...model,
      ...config
    }
    this.models.set(id, updatedModel)
    this.saveModels()
    return true
  }

  deleteModel(id: string): boolean {
    const deleted = this.models.delete(id)
    if (deleted) {
      this.saveModels()
    }
    return deleted
  }

  async chat(modelId: string, messages: LLMMessage[], options?: any): Promise<LLMResponse> {
    const model = this.models.get(modelId)
    if (!model || !model.enabled) {
      return { success: false, error: 'Model not found or disabled' }
    }

    try {
      switch (model.type) {
        case 'cloud':
          return await this.chatWithCloudModel(model, messages, options)
        case 'local':
          return await this.chatWithLocalModel(model, messages, options)
        default:
          return { success: false, error: 'Unsupported model type' }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async chatWithCloudModel(model: ModelConfig, messages: LLMMessage[], options?: any): Promise<LLMResponse> {
    const { provider, model: modelName, apiKey, baseUrl } = model
    const mergedOptions = { ...model.config, ...options }

    switch (provider) {
      case 'openai':
        return this.callOpenAI(baseUrl || 'https://api.openai.com/v1', apiKey!, modelName, messages, mergedOptions)
      case 'deepseek':
        return this.callDeepSeek(baseUrl || 'https://api.deepseek.com/v1', apiKey!, modelName, messages, mergedOptions)
      case 'claude':
        return this.callClaude(baseUrl || 'https://api.anthropic.com/v1', apiKey!, modelName, messages, mergedOptions)
      case 'minimax':
        return this.callMiniMax(baseUrl || 'https://api.minimax.chat/v1', apiKey!, modelName, messages, mergedOptions)
      default:
        return { success: false, error: 'Unsupported cloud provider' }
    }
  }

  private async chatWithLocalModel(model: ModelConfig, messages: LLMMessage[], options?: any): Promise<LLMResponse> {
    const { provider, model: modelName, baseUrl } = model
    const mergedOptions = { ...model.config, ...options }

    switch (provider) {
      case 'vllm':
        return this.callVLLM(baseUrl || 'http://localhost:8000/v1', modelName, messages, mergedOptions)
      case 'llamacpp':
        return this.callLlamaCpp(baseUrl || 'http://localhost:8080', modelName, messages, mergedOptions)
      default:
        return { success: false, error: 'Unsupported local provider' }
    }
  }

  private async callOpenAI(baseUrl: string, apiKey: string, model: string, messages: LLMMessage[], options: any): Promise<LLMResponse> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options?.max_tokens ?? 1000,
        temperature: options?.temperature ?? 0.7,
        ...(options?.response_format ? { response_format: options.response_format } : {})
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return { success: true, content: data.choices?.[0]?.message?.content || '' }
  }

  private async callDeepSeek(baseUrl: string, apiKey: string, model: string, messages: LLMMessage[], options: any): Promise<LLMResponse> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options?.max_tokens ?? 1000,
        temperature: options?.temperature ?? 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return { success: true, content: data.choices?.[0]?.message?.content || '' }
  }

  private async callClaude(baseUrl: string, apiKey: string, model: string, messages: LLMMessage[], options: any): Promise<LLMResponse> {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: options?.max_tokens ?? 1000,
        messages: messages.filter(m => m.role !== 'system'),
        system: messages.find(m => m.role === 'system')?.content
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return { success: true, content: data.content?.[0]?.text || '' }
  }

  private async callMiniMax(baseUrl: string, apiKey: string, model: string, messages: LLMMessage[], options: any): Promise<LLMResponse> {
    const response = await fetch(`${baseUrl}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options?.max_tokens ?? 1000,
        temperature: options?.temperature ?? 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`MiniMax API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return { success: true, content: data.choices?.[0]?.message?.content || '' }
  }

  private async callVLLM(baseUrl: string, model: string, messages: LLMMessage[], options: any): Promise<LLMResponse> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options?.max_tokens ?? 1000,
        temperature: options?.temperature ?? 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`vLLM API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return { success: true, content: data.choices?.[0]?.message?.content || '' }
  }

  private async callLlamaCpp(baseUrl: string, _model: string, messages: LLMMessage[], options: any): Promise<LLMResponse> {
    const response = await fetch(`${baseUrl}/completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: messages.map(m => `[${m.role}] ${m.content}`).join('\n'),
        n_predict: options?.max_tokens ?? 1000,
        temperature: options?.temperature ?? 0.7,
        stop: ['[user]', '[assistant]', '[system]']
      })
    })

    if (!response.ok) {
      throw new Error(`llama.cpp API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return { success: true, content: data.content || '' }
  }

  getProviders(): ModelProvider[] {
    return this.providers
  }

  async testModel(modelId: string): Promise<{ success: boolean; latency?: number; error?: string }> {
    const model = this.models.get(modelId)
    if (!model || !model.enabled) {
      return { success: false, error: 'Model not found or disabled' }
    }

    try {
      const start = Date.now()
      const response = await this.chat(modelId, [
        { role: 'user', content: 'Hello, test message!' }
      ], {
        max_tokens: 50,
        temperature: 0.1
      })
      const latency = Date.now() - start

      if (response.success) {
        return { success: true, latency }
      } else {
        return { success: false, error: response.error }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}

export const modelService = new LocalModelService()
