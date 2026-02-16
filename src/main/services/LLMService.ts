import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface LLMResponse {
  success: boolean
  content?: string
  error?: string
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMClientBase {
  id: string
  provider: 'openai' | 'deepseek' | 'claude' | 'minimax' | 'doubao'
  chat: (messages: LLMMessage[], options?: any) => Promise<LLMResponse>
}

type ChatCompletionMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export class LLMService {
  private apiKeysPath: string

  // 模型ID到provider的映射
  private modelToProvider: Record<string, string> = {
    'gpt-4o': 'openai', 'gpt-4o-mini': 'openai', 'gpt-3.5-turbo': 'openai',
    'claude-3-opus': 'claude', 'claude-3-sonnet': 'claude', 'claude-3-haiku': 'claude',
    'deepseek-chat': 'deepseek', 'deepseek-coder': 'deepseek',
    'abab6.5s-chat': 'minimax',
    'doubao-pro-32k': 'doubao', 'doubao-pro-128k': 'doubao',
    'doubao-seed-2-0-code-preview-260215': 'doubao'
  }

  constructor() {
    this.apiKeysPath = path.join(app.getPath('userData'), 'apiKeys.json')
  }

  public getApiKey(model: string): string | null {
    try {
      if (fs.existsSync(this.apiKeysPath)) {
        const apiKeys = JSON.parse(fs.readFileSync(this.apiKeysPath, 'utf8'))
        // 优先使用模型名查找，其次使用provider映射
        if (apiKeys[model]) {
          return apiKeys[model]
        }
        // 尝试通过provider映射获取
        const provider = this.modelToProvider[model]
        if (provider && apiKeys[provider]) {
          return apiKeys[provider]
        }
        return null
      }
    } catch (error) {
      console.error('Failed to read API keys:', error)
    }
    return null
  }

  public getAvailableModels(): string[] {
    try {
      if (fs.existsSync(this.apiKeysPath)) {
        const apiKeys = JSON.parse(fs.readFileSync(this.apiKeysPath, 'utf8'))
        return Object.keys(apiKeys).filter(key => apiKeys[key] && apiKeys[key].length > 0)
      }
    } catch (error) {
      console.error('Failed to read API keys:', error)
    }
    return []
  }

  async chat(model: string, messages: LLMMessage[], options: any = {}): Promise<LLMResponse> {
    const apiKey = this.getApiKey(model)
    
    // 如果没有API Key，尝试使用模拟响应（用于演示模式）
    if (!apiKey) {
      const lastMessage = messages[messages.length - 1].content.toLowerCase()
      console.log('No API Key found, attempting mock response for:', lastMessage)
      
      // 模拟：创建文件夹
      if (lastMessage.includes('folder') || lastMessage.includes('directory') || lastMessage.includes('文件夹') || lastMessage.includes('目录')) {
        return {
          success: true,
          content: JSON.stringify({
            reasoning: "既然你没有配置API Key，那我就演示一下如何创建文件夹吧！(Demo Mode)",
            steps: [
              {
                id: "create_demo_dir",
                tool: "create_directory",
                parameters: { path: path.join(app.getPath('desktop'), "demo_folder") },
                description: "在桌面创建 'demo_folder'"
              },
              {
                id: "respond_done",
                tool: "respond_to_user",
                parameters: { message: "已为您在桌面创建了 demo_folder 文件夹！请在设置中配置 API Key 以解锁全部智能能力。" },
                description: "回复用户"
              }
            ]
          })
        }
      }
      
      // 模拟：写文件
      if (lastMessage.includes('file') || lastMessage.includes('write') || lastMessage.includes('文件')) {
        return {
          success: true,
          content: JSON.stringify({
            reasoning: "Demo模式：演示文件创建。",
            steps: [
              {
                id: "create_demo_file",
                tool: "write_file",
                parameters: { 
                  path: path.join(app.getPath('desktop'), "hello.txt"),
                  content: "Hello from Agent Coder (Demo Mode)!" 
                },
                description: "在桌面创建 hello.txt"
              }
            ]
          })
        }
      }

      // 默认模拟回复
      if (!lastMessage.includes('json') && !messages.some(m => m.role === 'system' && m.content.includes('JSON'))) {
         return {
           success: true,
           content: `你好！我是 Agent Coder。由于未检测到 ${model} 的 API Key，我目前处于**演示模式**。\n\n你可以尝试对我说：\n- "在桌面创建一个文件夹"\n- "写一个 hello.txt 文件"\n\n或者去 **API 管理** 页面配置你的 Key 以解锁全部功能。`
         }
      }
      
      return { success: false, error: `请先在 "API 管理" 页面配置 ${model} 的 API Key` }
    }

    try {
      // 将模型名称映射到provider
      const provider = this.modelToProvider[model] || model
      
      if (provider === 'openai' || model === 'openai') {
        return await this.callOpenAI(apiKey, messages, options)
      } else if (provider === 'deepseek' || model === 'deepseek') {
        return await this.callDeepSeek(apiKey, messages, options)
      } else if (provider === 'claude' || model === 'claude') {
        return await this.callClaude(apiKey, messages, options)
      } else if (provider === 'minimax' || model === 'minimax') {
        return await this.callMiniMax(apiKey, messages, options)
      } else if (provider === 'doubao' || model === 'doubao') {
        return await this.callDoubao(apiKey, messages, options)
      } else {
        return { success: false, error: `Unsupported model: ${model}` }
      }
    } catch (error: any) {
      console.error(`LLM call failed for ${model}:`, error)
      const msg = String(error?.message || error || '')
      if (error?.name === 'AbortError' || msg.toLowerCase().includes('abort')) {
        return { success: false, error: 'Task cancelled' }
      }
      return { success: false, error: msg }
    }
  }

  private normalizeMessagesForDeepSeek(messages: LLMMessage[]): ChatCompletionMessage[] {
    const systemMessages: string[] = []
    const out: ChatCompletionMessage[] = []
    for (const m of messages) {
      if (m.role === 'system') {
        systemMessages.push(m.content)
      } else {
        out.push({ role: m.role, content: m.content })
      }
    }
    if (systemMessages.length === 0) return out

    const systemText = systemMessages.join('\n\n')
    if (out.length === 0) return [{ role: 'user', content: systemText }]
    if (out[0].role === 'user') {
      out[0] = { role: 'user', content: `${systemText}\n\n${out[0].content}` }
      return out
    }
    return [{ role: 'user', content: systemText }, ...out]
  }

  private async fetchWithTimeout(url: string, options: any, timeout = 120000): Promise<Response> {
    const { signal, ...rest } = options
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId)
        controller.abort()
      } else {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId)
          controller.abort()
        })
      }
    }

    try {
      const response = await fetch(url, { ...rest, signal: controller.signal })
      clearTimeout(timeoutId)
      return response
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        // Distinguish between user abort and timeout
        if (signal?.aborted) {
            throw new Error('Request cancelled by user')
        }
        throw new Error(`Request timed out after ${timeout}ms`)
      }
      throw error
    }
  }

  private async callOpenAI(apiKey: string, messages: LLMMessage[], options: any): Promise<LLMResponse> {
    const responseFormat = options?.response_format
    const response = await this.fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o-mini',
        messages: messages,
        max_tokens: options?.max_tokens ?? 1000,
        temperature: options?.temperature ?? 0.7,
        ...(responseFormat ? { response_format: responseFormat } : {})
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return { success: true, content: data.choices?.[0]?.message?.content || '' }
  }

  private async callDeepSeek(apiKey: string, messages: LLMMessage[], options: any): Promise<LLMResponse> {
    const url = 'https://api.deepseek.com/v1/chat/completions'
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
    const model = options.model || 'deepseek-chat'
    const maxTokens = options?.max_tokens ?? 1000
    const temperature = options?.temperature ?? 0.7

    const send = async (payloadMessages: any[]) => {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        signal: options?.signal,
        headers,
        body: JSON.stringify({
          model,
          messages: payloadMessages,
          max_tokens: maxTokens,
          temperature
        })
      })
      return response
    }

    const response1 = await send(messages as any[])
    if (response1.ok) {
      const data = await response1.json()
      return { success: true, content: data.choices?.[0]?.message?.content || '' }
    }

    const body1 = await response1.text().catch(() => '')
    const normalizedMessages = this.normalizeMessagesForDeepSeek(messages)
    const response2 = await send(normalizedMessages as any[])
    if (response2.ok) {
      const data = await response2.json()
      return { success: true, content: data.choices?.[0]?.message?.content || '' }
    }

    const body2 = await response2.text().catch(() => '')
    const details = [body1, body2].filter(Boolean).map(t => t.slice(0, 800)).join(' | ')
    const suffix = details ? ` - ${details}` : ''
    throw new Error(`DeepSeek API error: ${response2.status} ${response2.statusText}${suffix}`)
  }

  private async callClaude(apiKey: string, messages: LLMMessage[], options: any): Promise<LLMResponse> {
    const response = await this.fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-haiku-20240307',
        max_tokens: options?.max_tokens ?? 1000,
        messages: messages.filter(m => m.role !== 'system'), // Claude handles system prompt differently
        system: messages.find(m => m.role === 'system')?.content
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return { success: true, content: data.content?.[0]?.text || '' }
  }

  private async callMiniMax(apiKey: string, messages: LLMMessage[], options: any): Promise<LLMResponse> {
    const response = await this.fetchWithTimeout('https://api.minimax.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: options.model || 'abab6.5s-chat',
        messages: messages,
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

  // 豆包模型 API (字节跳动)
  private async callDoubao(apiKey: string, messages: LLMMessage[], options: any): Promise<LLMResponse> {
    // 豆包API端点 - 使用volcengine/maas API
    const response = await this.fetchWithTimeout('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: options.model || 'doubao-seed-2-0-code-preview-260215',
        messages: messages,
        max_tokens: options?.max_tokens ?? 1000,
        temperature: options?.temperature ?? 0.7
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Doubao API error: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`)
    }

    const data = await response.json()
    return { success: true, content: data.choices?.[0]?.message?.content || '' }
  }
}

export const llmService = new LLMService()

class ServiceBackedLLMClient implements LLMClientBase {
  id: string
  provider: 'openai' | 'deepseek' | 'claude' | 'minimax' | 'doubao'
  private service: LLMService
  private defaultOptions: any

  constructor(service: LLMService, provider: 'openai' | 'deepseek' | 'claude' | 'minimax' | 'doubao', id: string, defaultOptions: any = {}) {
    this.service = service
    this.provider = provider
    this.id = id
    this.defaultOptions = defaultOptions
  }

  async chat(messages: LLMMessage[], options: any = {}): Promise<LLMResponse> {
    const mergedOptions = { ...this.defaultOptions, ...options }
    return this.service.chat(this.provider, messages, mergedOptions)
  }
}

export const openaiClient: LLMClientBase = new ServiceBackedLLMClient(llmService, 'openai', 'openai:gpt-4o-mini', {
  model: 'gpt-4o-mini'
})

export const deepseekClient: LLMClientBase = new ServiceBackedLLMClient(llmService, 'deepseek', 'deepseek:deepseek-chat', {
  model: 'deepseek-chat'
})

export const claudeClient: LLMClientBase = new ServiceBackedLLMClient(llmService, 'claude', 'claude:haiku-20240307', {
  model: 'claude-3-haiku-20240307'
})

export const minimaxClient: LLMClientBase = new ServiceBackedLLMClient(llmService, 'minimax', 'minimax:abab6.5s-chat', {
  model: 'abab6.5s-chat'
})
