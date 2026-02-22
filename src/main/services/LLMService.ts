import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { app, safeStorage } from 'electron'

export interface LLMResponse {
  success: boolean
  content?: string
  error?: string
}

export interface LLMStreamChunk {
  delta: string
  done: boolean
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface MultimodalContent {
  type: 'input_text' | 'input_image'
  text?: string
  image_url?: string
}

export interface LLMMultimodalMessage {
  role: 'system' | 'user' | 'assistant'
  content: MultimodalContent[]
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
  private modelToProvider: Record<string, string> = {
    'gpt-4o': 'openai', 'gpt-4o-mini': 'openai', 'gpt-3.5-turbo': 'openai',
    'claude-3-opus': 'claude', 'claude-3-sonnet': 'claude', 'claude-3-haiku': 'claude',
    'deepseek-chat': 'deepseek', 'deepseek-coder': 'deepseek',
    'abab6.5s-chat': 'minimax',
    'doubao-pro-32k': 'doubao', 'doubao-pro-128k': 'doubao',
    'doubao-seed-2-0-pro-260215': 'doubao',
    'doubao-seed-2-0-code-preview-260215': 'doubao'
  }
  
  // API 密钥缓存
  private apiKeyCache: Map<string, {
    key: string
    timestamp: number
  }> = new Map()
  
  // 缓存过期时间（毫秒）
  private cacheTTL = 5 * 60 * 1000 // 5分钟
  
  // 备用加密密钥（当safeStorage不可用时使用）
  private fallbackKey: Buffer | null = null
  
  // 当前用户ID（用于用户级别的API密钥隔离）
  private currentUserId: string | null = null

  constructor() {
  }
  
  // 设置当前用户ID
  public setUserId(userId: string | null): void {
    this.currentUserId = userId
    // 清除缓存，因为用户切换了
    this.apiKeyCache.clear()
  }
  
  // 获取当前用户ID
  public getCurrentUserId(): string | null {
    return this.currentUserId
  }
  
  // 获取或创建备用加密密钥
  private getOrCreateFallbackKey(): Buffer {
    if (this.fallbackKey) {
      return this.fallbackKey
    }
    
    const keyPath = path.join(app.getPath('userData'), '.encryption_key')
    try {
      if (fs.existsSync(keyPath)) {
        const key = fs.readFileSync(keyPath)
        if (key.length === 32) {
          this.fallbackKey = key
          return key
        }
      }
      const newKey = crypto.randomBytes(32)
      fs.writeFileSync(keyPath, newKey, { mode: 0o600 })
      this.fallbackKey = newKey
      return newKey
    } catch (error) {
      console.error('Failed to get or create fallback encryption key:', error)
      const newKey = crypto.randomBytes(32)
      this.fallbackKey = newKey
      return newKey
    }
  }

  // 动态获取API密钥文件路径
  private get apiKeysPath(): string {
    if (this.currentUserId) {
      // 用户级别存储：userData/users/{userId}/apiKeys.json
      const userDir = path.join(app.getPath('userData'), 'users', this.currentUserId)
      return path.join(userDir, 'apiKeys.json')
    } else {
      // 全局存储（向后兼容）
      return path.join(app.getPath('userData'), 'apiKeys.json')
    }
  }
  
  // 确保用户API密钥目录存在
  private ensureUserApiKeyDir(): void {
    if (this.currentUserId) {
      const userDir = path.join(app.getPath('userData'), 'users', this.currentUserId)
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true, mode: 0o700 })
      }
    }
  }

  public getApiKey(model: string): string | null {
    try {
      // 先检查缓存
      const cachedKey = this.getCachedApiKey(model)
      if (cachedKey) {
        return cachedKey
      }

      if (fs.existsSync(this.apiKeysPath)) {
        const apiKeys = JSON.parse(fs.readFileSync(this.apiKeysPath, 'utf8'))
        if (apiKeys[model]) {
          // 尝试解密 API 密钥
          const key = this.decryptApiKey(apiKeys[model])
          // 缓存 API 密钥
          this.cacheApiKey(model, key)
          return key
        }
        const provider = this.modelToProvider[model]
        if (provider && apiKeys[provider]) {
          // 尝试解密 API 密钥
          const key = this.decryptApiKey(apiKeys[provider])
          // 缓存 API 密钥
          this.cacheApiKey(model, key)
          return key
        }
        return null
      }
    } catch (error) {
      console.error('Failed to read API keys:', error)
    }
    return null
  }

  public getAvailableProviders(): string[] {
    try {
      if (fs.existsSync(this.apiKeysPath)) {
        const apiKeys = JSON.parse(fs.readFileSync(this.apiKeysPath, 'utf8'))
        const providers: string[] = []
        
        // 检查所有提供商
        const providerList: string[] = ['openai', 'claude', 'deepseek', 'minimax', 'doubao']
        for (const provider of providerList) {
          if (apiKeys[provider] && apiKeys[provider].trim()) {
            providers.push(provider)
          }
        }
        
        return providers
      }
    } catch (error) {
      console.error('Failed to get available providers:', error)
    }
    return []
  }

  public getFirstAvailableProvider(): string | null {
    const providers = this.getAvailableProviders()
    return providers.length > 0 ? providers[0] : null
  }

  private getCachedApiKey(model: string): string | null {
    const cached = this.apiKeyCache.get(model)
    if (cached) {
      const now = Date.now()
      if (now - cached.timestamp < this.cacheTTL) {
        return cached.key
      }
      // 缓存过期，移除
      this.apiKeyCache.delete(model)
    }
    return null
  }

  private cacheApiKey(model: string, key: string): void {
    this.apiKeyCache.set(model, {
      key,
      timestamp: Date.now()
    })
    
    // 限制缓存大小，最多缓存 50 个密钥
    if (this.apiKeyCache.size > 50) {
      // 移除最早的缓存项
      const oldestEntry = this.apiKeyCache.entries().next()
      if (!oldestEntry.done && oldestEntry.value) {
        const oldestKey = oldestEntry.value[0]
        this.apiKeyCache.delete(oldestKey)
      }
    }
  }

  public setApiKey(model: string, key: string): boolean {
    try {
      // 确保用户API密钥目录存在
      this.ensureUserApiKeyDir()
      
      let apiKeys: any = {}
      if (fs.existsSync(this.apiKeysPath)) {
        apiKeys = JSON.parse(fs.readFileSync(this.apiKeysPath, 'utf8'))
      }
      
      // 加密存储 API 密钥
      apiKeys[model] = this.encryptApiKey(key)
      fs.writeFileSync(this.apiKeysPath, JSON.stringify(apiKeys, null, 2), { mode: 0o600 })
      
      // 清除对应缓存，确保下次获取时能获取到新的密钥
      this.apiKeyCache.delete(model)
      
      return true
    } catch (error) {
      console.error('Failed to write API keys:', error)
      return false
    }
  }

  private encryptApiKey(key: string): string {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(key)
        return 'safe:' + encrypted.toString('base64')
      }
      
      // 确保fallbackKey已初始化
      const keyBuffer = this.getOrCreateFallbackKey()
      
      // 使用AES-256-CBC备用加密
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv)
      let encrypted = cipher.update(key, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      return 'fallback:' + iv.toString('hex') + ':' + encrypted
    } catch (error) {
      console.error('Failed to encrypt API key:', error)
      throw new Error('API密钥加密失败')
    }
  }

  private decryptApiKey(encryptedKey: string): string {
    try {
      // 检查加密类型
      if (encryptedKey.startsWith('safe:')) {
        // 使用safeStorage解密
        const base64Key = encryptedKey.substring(5)
        const encrypted = Buffer.from(base64Key, 'base64')
        return safeStorage.decryptString(encrypted)
      } else if (encryptedKey.startsWith('fallback:')) {
        // 确保fallbackKey已初始化
        const keyBuffer = this.getOrCreateFallbackKey()
        
        // 使用AES-256-CBC解密
        const parts = encryptedKey.substring(9).split(':')
        if (parts.length === 2) {
          const iv = Buffer.from(parts[0], 'hex')
          const encrypted = parts[1]
          const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
          let decrypted = decipher.update(encrypted, 'hex', 'utf8')
          decrypted += decipher.final('utf8')
          return decrypted
        }
      }
      
      // 兼容旧的明文格式（但记录警告）
      console.warn('警告: 发现未加密的API密钥，建议重新设置')
      return encryptedKey
    } catch (error) {
      console.error('Failed to decrypt API key:', error)
      throw new Error('API密钥解密失败')
    }
  }

  public getAvailableModels(): string[] {
    try {
      if (fs.existsSync(this.apiKeysPath)) {
        const apiKeys = JSON.parse(fs.readFileSync(this.apiKeysPath, 'utf8'))
        return Object.keys(apiKeys).filter(key => {
          try {
            const decryptedKey = this.decryptApiKey(apiKeys[key])
            return decryptedKey && decryptedKey.length > 0
          } catch {
            return false
          }
        })
      }
    } catch (error) {
      console.error('Failed to read API keys:', error)
    }
    return []
  }
  
  // 删除API密钥
  public deleteApiKey(model: string): boolean {
    try {
      if (!fs.existsSync(this.apiKeysPath)) {
        return false
      }
      
      const apiKeys = JSON.parse(fs.readFileSync(this.apiKeysPath, 'utf8'))
      if (apiKeys[model]) {
        delete apiKeys[model]
        fs.writeFileSync(this.apiKeysPath, JSON.stringify(apiKeys, null, 2), { mode: 0o600 })
        // 清除缓存
        this.apiKeyCache.delete(model)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to delete API key:', error)
      return false
    }
  }
  
  // 迁移旧的全局API密钥到用户目录
  public migrateGlobalApiKeys(userId: string): void {
    try {
      const globalPath = path.join(app.getPath('userData'), 'apiKeys.json')
      if (!fs.existsSync(globalPath)) {
        return
      }
      
      const globalKeys = JSON.parse(fs.readFileSync(globalPath, 'utf8'))
      if (Object.keys(globalKeys).length === 0) {
        return
      }
      
      // 设置用户ID
      this.setUserId(userId)
      
      // 确保用户目录存在
      this.ensureUserApiKeyDir()
      
      // 读取用户现有的API密钥
      let userKeys: any = {}
      if (fs.existsSync(this.apiKeysPath)) {
        userKeys = JSON.parse(fs.readFileSync(this.apiKeysPath, 'utf8'))
      }
      
      // 合并密钥（用户密钥优先）
      const mergedKeys = { ...globalKeys, ...userKeys }
      fs.writeFileSync(this.apiKeysPath, JSON.stringify(mergedKeys, null, 2), { mode: 0o600 })
      
      // 删除全局密钥文件
      fs.unlinkSync(globalPath)
      
      console.log(`已将 ${Object.keys(globalKeys).length} 个API密钥从全局迁移到用户 ${userId}`)
    } catch (error) {
      console.error('Failed to migrate API keys:', error)
    }
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

  // 多模态聊天方法 - 支持图像输入
  async chatMultimodal(model: string, messages: LLMMultimodalMessage[], options: any = {}): Promise<LLMResponse> {
    const apiKey = this.getApiKey(model)
    
    if (!apiKey) {
      return { success: false, error: `请先配置 ${model} 的 API Key` }
    }

    try {
      const provider = this.modelToProvider[model] || model
      
      if (provider === 'doubao' || model.startsWith('doubao')) {
        return await this.callDoubaoMultimodal(apiKey, messages, options)
      } else {
        return { success: false, error: `多模态暂不支持模型: ${model}` }
      }
    } catch (error: any) {
      console.error(`多模态LLM调用失败 for ${model}:`, error)
      return { success: false, error: error?.message || String(error) }
    }
  }

  // 流式聊天方法 - 支持逐字输出
  async chatStream(
    model: string, 
    messages: LLMMessage[], 
    options: any = {},
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse> {
    const apiKey = this.getApiKey(model)
    
    if (!apiKey) {
      return { success: false, error: `请先配置 ${model} 的 API Key` }
    }

    try {
      const provider = this.modelToProvider[model] || model
      
      if (provider === 'deepseek' || model === 'deepseek') {
        return await this.callDeepSeekStream(apiKey, messages, options, onChunk)
      } else if (provider === 'openai' || model === 'openai') {
        return await this.callOpenAIStream(apiKey, messages, options, onChunk)
      } else if (provider === 'claude' || model === 'claude') {
        return await this.callClaudeStream(apiKey, messages, options, onChunk)
      } else {
        return { success: false, error: `流式响应暂不支持模型: ${model}` }
      }
    } catch (error: any) {
      console.error(`流式LLM调用失败 for ${model}:`, error)
      return { success: false, error: error?.message || String(error) }
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

    // 检查是否为402错误（余额不足）
    if (response1.status === 402) {
      const body1 = await response1.text().catch(() => '')
      console.warn(`DeepSeek API 402 Payment Required: ${body1}`)
      return { success: false, error: `DeepSeek API error: 402 Payment Required - ${body1}` }
    }

    const body1 = await response1.text().catch(() => '')
    const normalizedMessages = this.normalizeMessagesForDeepSeek(messages)
    const response2 = await send(normalizedMessages as any[])
    if (response2.ok) {
      const data = await response2.json()
      return { success: true, content: data.choices?.[0]?.message?.content || '' }
    }

    // 检查是否为402错误（余额不足）
    if (response2.status === 402) {
      const body2 = await response2.text().catch(() => '')
      console.warn(`DeepSeek API 402 Payment Required: ${body2}`)
      return { success: false, error: `DeepSeek API error: 402 Payment Required - ${body2}` }
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
        model: options.model || 'deepseek-coder',
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

  // 豆包多模态模型 API - 支持图像输入
  private async callDoubaoMultimodal(apiKey: string, messages: LLMMultimodalMessage[], options: any): Promise<LLMResponse> {
    // 使用豆包多模态API端点
    const response = await this.fetchWithTimeout('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: options.model || 'doubao-seed-2-0-pro-260215',
        messages: messages,
        max_tokens: options?.max_tokens ?? 1000,
        temperature: options?.temperature ?? 0.7
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Doubao Multimodal API error: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`)
    }

    const data = await response.json()
    return { success: true, content: data.choices?.[0]?.message?.content || '' }
  }

  // 流式响应实现
  private async callOpenAIStream(
    apiKey: string, 
    messages: LLMMessage[], 
    options: any,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse> {
    const response = await this.fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o-mini',
        messages,
        max_tokens: options?.max_tokens ?? 1000,
        temperature: options?.temperature ?? 0.7,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              onChunk({ delta: '', done: true })
              break
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                fullContent += delta
                onChunk({ delta, done: false })
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return { success: true, content: fullContent }
  }

  private async callDeepSeekStream(
    apiKey: string, 
    messages: LLMMessage[], 
    options: any,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse> {
    const url = 'https://api.deepseek.com/v1/chat/completions'
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
    const model = options.model || 'deepseek-chat'
    const maxTokens = options?.max_tokens ?? 1000
    const temperature = options?.temperature ?? 0.7

    const normalizedMessages = this.normalizeMessagesForDeepSeek(messages)

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      signal: options?.signal,
      headers,
      body: JSON.stringify({
        model,
        messages: normalizedMessages,
        max_tokens: maxTokens,
        temperature,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              onChunk({ delta: '', done: true })
              break
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                fullContent += delta
                onChunk({ delta, done: false })
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return { success: true, content: fullContent }
  }

  private async callClaudeStream(
    apiKey: string, 
    messages: LLMMessage[], 
    options: any,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse> {
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
        messages: messages.filter(m => m.role !== 'system'),
        system: messages.find(m => m.role === 'system')?.content,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.delta?.text || parsed.content_block?.text || ''
              if (delta) {
                fullContent += delta
                onChunk({ delta, done: false })
              }

              if (parsed.type === 'message_stop') {
                onChunk({ delta: '', done: true })
                break
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return { success: true, content: fullContent }
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
