import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { llmService } from '../services/LLMService'

interface ContextSource {
  id: string
  type: 'static' | 'dynamic' | 'historical'
  name: string
  path?: string
  content?: string
  timestamp: number
  metadata: any
}

interface Chunk {
  id: string
  content: string
  filePath: string
  startLine: number
  endLine: number
  embedding?: number[]
  metadata: any
}

interface SearchResult {
  chunk: Chunk
  score: number
  relevance: 'high' | 'medium' | 'low'
}

export class ContextManager {
  private sources: Map<string, ContextSource> = new Map()
  private chunks: Map<string, Chunk> = new Map()
  private indexPath: string
  private maxContextSize: number = 500000

  constructor() {
    this.indexPath = path.join(app.getPath('userData'), 'context-index')
    this.ensureIndexDirectory()
  }

  private ensureIndexDirectory() {
    if (!fs.existsSync(this.indexPath)) {
      fs.mkdirSync(this.indexPath, { recursive: true })
    }
  }

  // 数据源管理
  addSource(source: ContextSource) {
    this.sources.set(source.id, source)
  }

  removeSource(sourceId: string) {
    this.sources.delete(sourceId)
  }

  listSources(): ContextSource[] {
    return Array.from(this.sources.values())
  }

  // 索引构建
  async buildIndex() {
    const sources = this.listSources()
    const newChunks: Chunk[] = []

    for (const source of sources) {
      if (source.type === 'static' && source.path) {
        try {
          const content = fs.readFileSync(source.path, 'utf8')
          const fileChunks = this.chunkFile(content, source.path)
          newChunks.push(...fileChunks)
        } catch (error) {
          console.error(`Failed to process file ${source.path}:`, error)
        }
      } else if (source.content) {
        const contentChunks = this.chunkContent(source.content, source.id)
        newChunks.push(...contentChunks)
      }
    }

    // 生成嵌入向量
    await this.generateEmbeddings(newChunks)

    // 保存索引
    this.saveIndex(newChunks)

    return newChunks.length
  }

  private chunkFile(content: string, filePath: string): Chunk[] {
    const chunks: Chunk[] = []
    const lines = content.split('\n')
    const chunkSize = 200 // 每块大约200行

    for (let i = 0; i < lines.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, lines.length)
      const chunkContent = lines.slice(i, end).join('\n')
      
      chunks.push({
        id: `${filePath}_${i}`,
        content: chunkContent,
        filePath,
        startLine: i + 1,
        endLine: end,
        metadata: {
          fileType: path.extname(filePath),
          chunkSize: chunkContent.length
        }
      })
    }

    return chunks
  }

  private chunkContent(content: string, sourceId: string): Chunk[] {
    const chunks: Chunk[] = []
    const chunkSize = 1000 // 每块大约1000字符

    for (let i = 0; i < content.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, content.length)
      const chunkContent = content.substring(i, end)
      
      chunks.push({
        id: `${sourceId}_${i}`,
        content: chunkContent,
        filePath: sourceId,
        startLine: 1,
        endLine: Math.ceil((end / content.length) * 100),
        metadata: {
          chunkSize: chunkContent.length
        }
      })
    }

    return chunks
  }

  private async generateEmbeddings(chunks: Chunk[]) {
    // 这里使用简化的嵌入生成，实际应用中应该使用真实的嵌入模型
    for (const chunk of chunks) {
      // 模拟嵌入向量
      chunk.embedding = Array(768).fill(0).map(() => Math.random() * 2 - 1)
    }
  }

  private saveIndex(chunks: Chunk[]) {
    const indexData = {
      version: '1.0',
      timestamp: Date.now(),
      chunks: chunks.map(chunk => ({
        ...chunk,
        embedding: chunk.embedding?.slice(0, 10) // 只保存部分嵌入用于演示
      }))
    }

    fs.writeFileSync(
      path.join(this.indexPath, 'index.json'),
      JSON.stringify(indexData, null, 2)
    )
  }

  // 检索
  async search(query: string, topK: number = 10): Promise<SearchResult[]> {
    const chunks = Array.from(this.chunks.values())
    const results: SearchResult[] = []

    // 简单的基于关键词的检索
    for (const chunk of chunks) {
      const score = this.calculateRelevance(query, chunk.content)
      if (score > 0) {
        results.push({
          chunk,
          score,
          relevance: score > 0.7 ? 'high' : score > 0.3 ? 'medium' : 'low'
        })
      }
    }

    // 排序并返回前K个结果
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  private calculateRelevance(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean)
    const contentWords = content.toLowerCase().split(/\s+/).filter(Boolean)
    
    let matchCount = 0
    for (const word of queryWords) {
      if (contentWords.includes(word)) {
        matchCount++
      }
    }

    return queryWords.length > 0 ? matchCount / queryWords.length : 0
  }

  // 压缩
  async compressContext(context: string): Promise<string> {
    if (context.length <= this.maxContextSize) {
      return context
    }

    // 使用LLM进行压缩
    const response = await llmService.chat('openai', [
      {
        role: 'system',
        content: 'You are a context compressor. Condense the following text while preserving key information.'
      },
      {
        role: 'user',
        content: `Please compress the following context to fit within ${this.maxContextSize} characters:\n\n${context}`
      }
    ], {
      max_tokens: 5000,
      temperature: 0.1
    })

    if (response.success && response.content) {
      return response.content
    }

    // 压缩失败，返回前maxContextSize个字符
    return context.substring(0, this.maxContextSize)
  }

  // 注入
  async injectContext(prompt: string, context: any): Promise<string> {
    const compressedContext = await this.compressContext(JSON.stringify(context))
    
    return `Context:\n${compressedContext}\n\n${prompt}`
  }

  // 上下文聚合
  async aggregateContext(sessionId: string, query: string): Promise<any> {
    // 收集静态上下文
    const staticContext = await this.collectStaticContext()
    
    // 收集动态上下文
    const dynamicContext = await this.collectDynamicContext()
    
    // 收集历史上下文
    const historicalContext = await this.collectHistoricalContext(sessionId)
    
    // 搜索相关上下文
    const searchResults = await this.search(query)
    
    // 构建最终上下文
    const context = {
      static: staticContext,
      dynamic: dynamicContext,
      historical: historicalContext,
      search: searchResults.map(result => ({
        content: result.chunk.content,
        filePath: result.chunk.filePath,
        score: result.score,
        relevance: result.relevance
      }))
    }

    return context
  }

  private async collectStaticContext(): Promise<any> {
    return {
      project: {
        structure: await this.getProjectStructure(),
        dependencies: await this.getProjectDependencies()
      }
    }
  }

  private async collectDynamicContext(): Promise<any> {
    return {
      system: {
        os: process.platform,
        cwd: process.cwd(),
        timestamp: Date.now()
      }
    }
  }

  private async collectHistoricalContext(sessionId: string): Promise<any> {
    const historyPath = path.join(this.indexPath, `${sessionId}_history.json`)
    if (fs.existsSync(historyPath)) {
      try {
        return JSON.parse(fs.readFileSync(historyPath, 'utf8'))
      } catch {
        return {}
      }
    }
    return {}
  }

  private async getProjectStructure(): Promise<any> {
    try {
      const cwd = process.cwd()
      const structure: any = {}
      
      const walk = (dir: string, current: any, maxDepth: number = 3, currentDepth: number = 0) => {
        if (currentDepth >= maxDepth) return
        
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
              continue
            }
            
            if (entry.isDirectory()) {
              current[entry.name] = {}
              walk(path.join(dir, entry.name), current[entry.name], maxDepth, currentDepth + 1)
            } else {
              current[entry.name] = 'file'
            }
          }
        } catch {
          // 忽略权限错误
        }
      }
      
      walk(cwd, structure)
      return structure
    } catch {
      return {}
    }
  }

  private async getProjectDependencies(): Promise<any> {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json')
      if (fs.existsSync(packageJsonPath)) {
        const content = fs.readFileSync(packageJsonPath, 'utf8')
        const packageJson = JSON.parse(content)
        return {
          dependencies: packageJson.dependencies || {},
          devDependencies: packageJson.devDependencies || {}
        }
      }
    } catch {
      // 忽略错误
    }
    return {}
  }

  // 保存历史上下文
  saveHistoricalContext(sessionId: string, context: any) {
    const historyPath = path.join(this.indexPath, `${sessionId}_history.json`)
    const history = {
      timestamp: Date.now(),
      context
    }
    
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2))
  }

  // 清理上下文
  clearContext(sessionId: string) {
    const historyPath = path.join(this.indexPath, `${sessionId}_history.json`)
    if (fs.existsSync(historyPath)) {
      fs.unlinkSync(historyPath)
    }
  }

  // 上下文大小管理
  getContextSize(context: any): number {
    return JSON.stringify(context).length
  }

  // 检查上下文大小
  isContextTooLarge(context: any): boolean {
    return this.getContextSize(context) > this.maxContextSize
  }
}

export const contextManager = new ContextManager()
