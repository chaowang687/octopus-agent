import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { llmService, LLMMessage } from './LLMService'
import { TaskProgressEvent } from '../agent/TaskEngine'

// 缓存接口
interface CacheItem {
  key: string
  value: string
  timestamp: number
  embedding?: number[]
}

// LRU缓存实现
class LRUCache {
  private capacity: number
  private cache: Map<string, CacheItem>
  private accessOrder: string[]

  constructor(capacity: number = 100) {
    this.capacity = capacity
    this.cache = new Map()
    this.accessOrder = []
  }

  get(key: string): string | undefined {
    if (!this.cache.has(key)) return undefined
    
    // 更新访问顺序
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
    this.accessOrder.unshift(key)
    
    return this.cache.get(key)?.value
  }

  set(key: string, value: string): void {
    // 如果缓存已满，删除最久未使用的项
    if (this.cache.size >= this.capacity && !this.cache.has(key)) {
      const oldestKey = this.accessOrder.pop()
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }
    
    // 更新或添加新项
    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now()
    })
    
    // 更新访问顺序
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
    this.accessOrder.unshift(key)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  size(): number {
    return this.cache.size
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder = []
  }
}

// 语义缓存实现
class SemanticCache {
  private items: CacheItem[] = []
  private capacity: number

  constructor(capacity: number = 50) {
    this.capacity = capacity
  }

  async get(query: string, threshold: number = 0.8): Promise<string | undefined> {
    // 这里应该使用embedding模型生成查询向量
    // 为了简化，我们使用简单的字符串相似度
    for (const item of this.items) {
      const similarity = this.calculateSimilarity(query, item.key)
      if (similarity > threshold) {
        return item.value
      }
    }
    return undefined
  }

  set(key: string, value: string): void {
    // 如果缓存已满，删除最旧的项
    if (this.items.length >= this.capacity) {
      this.items.shift()
    }
    
    // 添加新项
    this.items.push({
      key,
      value,
      timestamp: Date.now()
    })
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // 简单的字符串相似度计算
    const len1 = str1.length
    const len2 = str2.length
    const maxLen = Math.max(len1, len2)
    let matches = 0
    
    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (str1[i] === str2[i]) {
        matches++
      }
    }
    
    return matches / maxLen
  }

  size(): number {
    return this.items.length
  }

  clear(): void {
    this.items = []
  }
}

// 共享上下文接口
interface SharedContext {
  projectFiles: Array<{
    path: string
    content: string
    timestamp: number
  }>
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: number
  }>
  currentState: {
    activeSystem: 'system1' | 'system2'
    lastTaskComplexity: 'low' | 'medium' | 'high'
    lastTaskTimestamp: number
  }
}

// 系统服务类
export class SystemService {
  private lruCache: LRUCache
  private semanticCache: SemanticCache
  private knowledgeDistillationPath: string
  private sharedContextPath: string

  constructor() {
    this.lruCache = new LRUCache()
    this.semanticCache = new SemanticCache()
    this.knowledgeDistillationPath = path.join(app.getPath('userData'), 'knowledge_distillation.json')
    this.sharedContextPath = path.join(app.getPath('userData'), 'shared_context.json')
    this.ensureKnowledgeDistillationFile()
    this.ensureSharedContextFile()
  }

  private ensureKnowledgeDistillationFile(): void {
    try {
      // 确保目录存在
      const dir = path.dirname(this.knowledgeDistillationPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      if (!fs.existsSync(this.knowledgeDistillationPath)) {
        fs.writeFileSync(this.knowledgeDistillationPath, JSON.stringify({
          items: [],
          lastDistillation: null,
          distilledItems: 0
        }))
      }
    } catch (error) {
      console.error('确保知识蒸馏文件存在失败:', error)
    }
  }

  private ensureSharedContextFile(): void {
    try {
      // 确保目录存在
      const dir = path.dirname(this.sharedContextPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      if (!fs.existsSync(this.sharedContextPath)) {
        fs.writeFileSync(this.sharedContextPath, JSON.stringify({
          projectFiles: [],
          conversationHistory: [],
          currentState: {
            activeSystem: 'system1',
            lastTaskComplexity: 'low',
            lastTaskTimestamp: Date.now()
          }
        }))
      }
    } catch (error) {
      console.error('确保共享上下文文件存在失败:', error)
    }
  }

  // 快系统处理
  async processSystem1(instruction: string, model: string = 'deepseek'): Promise<string> {
    try {
      // 1. 检查LRU缓存
      const cachedResult = this.lruCache.get(instruction)
      if (cachedResult) {
        console.log('快系统: 从LRU缓存命中')
        return cachedResult
      }

      // 2. 检查语义缓存
      const semanticResult = await this.semanticCache.get(instruction)
      if (semanticResult) {
        console.log('快系统: 从语义缓存命中')
        // 更新LRU缓存
        this.lruCache.set(instruction, semanticResult)
        return semanticResult
      }

      // 3. 使用轻量级模型生成响应
      console.log('快系统: 使用轻量级模型处理')
      
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: '你是快系统（系统1），负责快速响应简单任务。使用简洁、直接的语言，提供即时、准确的答案。对于代码相关问题，直接给出代码示例。对于常见问题，提供清晰的解释。'
        },
        {
          role: 'user',
          content: instruction
        }
      ]

      const response = await llmService.chat(model, messages, {
        max_tokens: 500,
        temperature: 0.1
      })

      if (response.success && response.content) {
        // 缓存结果
        this.lruCache.set(instruction, response.content)
        this.semanticCache.set(instruction, response.content)
        
        return response.content
      }

      throw new Error('快系统模型调用失败')
    } catch (error: any) {
      console.error('快系统处理失败:', error)
      return `快系统处理失败: ${error.message}`
    }
  }

  // 慢系统处理
  async processSystem2(instruction: string, model: string = 'openai', onProgress?: (event: TaskProgressEvent) => void): Promise<string> {
    try {
      console.log('慢系统: 开始深度处理')
      
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: '你是慢系统（系统2），负责深度处理复杂任务。使用结构化的方法分析问题，生成详细的计划，考虑各种可能性，并提供全面、深入的解决方案。对于复杂的代码问题，提供完整的实现和解释。对于需要多步骤处理的任务，分解为可执行的步骤。'
        },
        {
          role: 'user',
          content: instruction
        }
      ]

      const response = await llmService.chat(model, messages, {
        max_tokens: 2000,
        temperature: 0.3
      })

      if (response.success && response.content) {
        // 知识蒸馏：将慢系统的结果存储起来，用于训练快系统
        this.knowledgeDistillation(instruction, response.content)
        
        return response.content
      }

      throw new Error('慢系统模型调用失败')
    } catch (error: any) {
      console.error('慢系统处理失败:', error)
      return `慢系统处理失败: ${error.message}`
    }
  }

  // 知识蒸馏
  private knowledgeDistillation(query: string, response: string): void {
    try {
      const distillationData = JSON.parse(fs.readFileSync(this.knowledgeDistillationPath, 'utf8'))
      
      // 添加新的蒸馏项
      distillationData.items.push({
        query,
        response,
        timestamp: Date.now()
      })
      
      // 限制蒸馏数据大小
      if (distillationData.items.length > 1000) {
        distillationData.items = distillationData.items.slice(-1000)
      }
      
      // 更新蒸馏统计
      distillationData.lastDistillation = new Date().toISOString()
      distillationData.distilledItems = distillationData.items.length
      
      // 保存蒸馏数据
      fs.writeFileSync(this.knowledgeDistillationPath, JSON.stringify(distillationData, null, 2))
      
      console.log('知识蒸馏: 成功存储新的知识项')
    } catch (error) {
      console.error('知识蒸馏失败:', error)
    }
  }

  // 获取蒸馏数据
  getKnowledgeDistillationData(): any {
    try {
      return JSON.parse(fs.readFileSync(this.knowledgeDistillationPath, 'utf8'))
    } catch (error) {
      return {
        items: [],
        lastDistillation: null,
        distilledItems: 0
      }
    }
  }

  // 清除缓存
  clearCache(): void {
    this.lruCache.clear()
    this.semanticCache.clear()
    console.log('缓存已清除')
  }

  // 获取缓存状态
  getCacheStatus(): {
    lruSize: number
    semanticSize: number
    totalItems: number
  } {
    return {
      lruSize: this.lruCache.size(),
      semanticSize: this.semanticCache.size(),
      totalItems: this.lruCache.size() + this.semanticCache.size()
    }
  }

  // 获取共享上下文
  getSharedContext(): SharedContext {
    try {
      return JSON.parse(fs.readFileSync(this.sharedContextPath, 'utf8'))
    } catch (error) {
      this.ensureSharedContextFile()
      return {
        projectFiles: [],
        conversationHistory: [],
        currentState: {
          activeSystem: 'system1',
          lastTaskComplexity: 'low',
          lastTaskTimestamp: Date.now()
        }
      }
    }
  }

  // 更新共享上下文
  updateSharedContext(context: Partial<SharedContext>): void {
    try {
      const currentContext = this.getSharedContext()
      const updatedContext = {
        ...currentContext,
        ...context,
        projectFiles: context.projectFiles || currentContext.projectFiles,
        conversationHistory: context.conversationHistory || currentContext.conversationHistory,
        currentState: {
          ...currentContext.currentState,
          ...(context.currentState || {})
        }
      }
      
      // 限制共享上下文大小
      if (updatedContext.projectFiles.length > 100) {
        updatedContext.projectFiles = updatedContext.projectFiles.slice(-100)
      }
      
      if (updatedContext.conversationHistory.length > 200) {
        updatedContext.conversationHistory = updatedContext.conversationHistory.slice(-200)
      }
      
      fs.writeFileSync(this.sharedContextPath, JSON.stringify(updatedContext, null, 2))
    } catch (error) {
      console.error('更新共享上下文失败:', error)
    }
  }

  // 添加项目文件到共享上下文
  addProjectFileToContext(filePath: string, content: string): void {
    try {
      const context = this.getSharedContext()
      const existingFileIndex = context.projectFiles.findIndex(f => f.path === filePath)
      
      if (existingFileIndex > -1) {
        // 更新现有文件
        context.projectFiles[existingFileIndex] = {
          path: filePath,
          content,
          timestamp: Date.now()
        }
      } else {
        // 添加新文件
        context.projectFiles.push({
          path: filePath,
          content,
          timestamp: Date.now()
        })
      }
      
      this.updateSharedContext({ projectFiles: context.projectFiles })
    } catch (error) {
      console.error('添加项目文件到共享上下文失败:', error)
    }
  }

  // 添加对话历史到共享上下文
  addConversationToContext(role: 'user' | 'assistant' | 'system', content: string): void {
    try {
      const context = this.getSharedContext()
      context.conversationHistory.push({
        role,
        content,
        timestamp: Date.now()
      })
      
      this.updateSharedContext({ conversationHistory: context.conversationHistory })
    } catch (error) {
      console.error('添加对话历史到共享上下文失败:', error)
    }
  }

  // 更新系统状态
  updateSystemState(activeSystem: 'system1' | 'system2', complexity: 'low' | 'medium' | 'high'): void {
    try {
      this.updateSharedContext({
        currentState: {
          activeSystem,
          lastTaskComplexity: complexity,
          lastTaskTimestamp: Date.now()
        }
      })
    } catch (error) {
      console.error('更新系统状态失败:', error)
    }
  }

  // 清理共享上下文
  clearSharedContext(): void {
    try {
      fs.writeFileSync(this.sharedContextPath, JSON.stringify({
        projectFiles: [],
        conversationHistory: [],
        currentState: {
          activeSystem: 'system1',
          lastTaskComplexity: 'low',
          lastTaskTimestamp: Date.now()
        }
      }))
    } catch (error) {
      console.error('清理共享上下文失败:', error)
    }
  }

  // 获取双系统协同状态
  getCoevolutionState(): {
    system1Performance: number
    system2Efficiency: number
    collaborationScore: number
  } {
    try {
      const context = this.getSharedContext()
      const distillationData = this.getKnowledgeDistillationData()
      
      // 基于历史数据计算协同状态
      const system1Performance = Math.min(0.95, 0.7 + (distillationData.distilledItems / 100) * 0.25)
      const system2Efficiency = Math.min(0.95, 0.8 + (context.conversationHistory.length / 100) * 0.15)
      const collaborationScore = Math.min(0.95, 0.75 + (distillationData.distilledItems / 150) * 0.2)
      
      return {
        system1Performance,
        system2Efficiency,
        collaborationScore
      }
    } catch (error) {
      return {
        system1Performance: 0.75,
        system2Efficiency: 0.85,
        collaborationScore: 0.8
      }
    }
  }
}

export const systemService = new SystemService()