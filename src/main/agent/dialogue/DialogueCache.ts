import { AgentExecutionCache, FileCacheEntry } from './types'

export class DialogueCache {
  private agentExecutionCache: Map<string, AgentExecutionCache> = new Map()
  private fileCache: Map<string, FileCacheEntry> = new Map()
  private cacheTTL: number = 60000
  private maxAgentCacheSize: number = 50
  private maxFileCacheSize: number = 30

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl
  }

  private getCacheKey(agentId: string, input: string): string {
    return `${agentId}_${Buffer.from(input).toString('base64').slice(0, 100)}`
  }

  setAgentCache(agentId: string, input: string, result: any): void {
    const key = this.getCacheKey(agentId, input)
    this.agentExecutionCache.set(key, {
      result,
      timestamp: Date.now()
    })
    
    if (this.agentExecutionCache.size > this.maxAgentCacheSize) {
      const oldestKey = this.agentExecutionCache.keys().next().value
      if (oldestKey) {
        this.agentExecutionCache.delete(oldestKey)
      }
    }
  }

  getAgentCache(agentId: string, input: string): any | null {
    const key = this.getCacheKey(agentId, input)
    const cached = this.agentExecutionCache.get(key)
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.result
    }
    
    if (cached) {
      this.agentExecutionCache.delete(key)
    }
    
    return null
  }

  setFileCache(filePath: string, content: string): void {
    this.fileCache.set(filePath, {
      content,
      timestamp: Date.now()
    })
    
    if (this.fileCache.size > this.maxFileCacheSize) {
      const oldestKey = this.fileCache.keys().next().value
      if (oldestKey) {
        this.fileCache.delete(oldestKey)
      }
    }
  }

  getFileCache(filePath: string): string | null {
    const cached = this.fileCache.get(filePath)
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.content
    }
    
    if (cached) {
      this.fileCache.delete(filePath)
    }
    
    return null
  }

  clear(): void {
    this.agentExecutionCache.clear()
    this.fileCache.clear()
    console.log('[DialogueCache] Cache cleared')
  }

  clearAgentCache(agentId?: string): void {
    if (agentId) {
      for (const key of this.agentExecutionCache.keys()) {
        if (key.startsWith(agentId)) {
          this.agentExecutionCache.delete(key)
        }
      }
    } else {
      this.agentExecutionCache.clear()
    }
  }

  getStats(): {
    agentCacheSize: number
    fileCacheSize: number
    cacheTTL: number
  } {
    return {
      agentCacheSize: this.agentExecutionCache.size,
      fileCacheSize: this.fileCache.size,
      cacheTTL: this.cacheTTL
    }
  }
}

export const dialogueCache = new DialogueCache()
