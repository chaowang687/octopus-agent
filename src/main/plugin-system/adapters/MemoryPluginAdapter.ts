/**
 * 记忆插件适配器
 * 将现有记忆系统接入插件系统
 */

import { PluginInterface, MemoryQuery } from '../PluginInterface'

export class MemoryPluginAdapter implements PluginInterface {
  id: string
  name: string
  version: string
  description: string
  author: string
  enabled: boolean = true
  category: 'memory' = 'memory'
  memoryType: 'short' | 'medium' | 'long'
  private storage: Map<string, { value: any; timestamp: number; metadata?: any }> = new Map()

  constructor(options: {
    id: string
    name: string
    version: string
    description: string
    author: string
    memoryType: 'short' | 'medium' | 'long'
  }) {
    this.id = options.id
    this.name = options.name
    this.version = options.version
    this.description = options.description
    this.author = options.author
    this.memoryType = options.memoryType
  }

  async initialize(): Promise<void> {
    console.log(`[MemoryPluginAdapter] Initialized: ${this.name} (${this.memoryType})`)
  }

  async destroy(): Promise<void> {
    this.storage.clear()
    console.log(`[MemoryPluginAdapter] Destroyed: ${this.name}`)
  }

  async store(key: string, value: any, metadata?: any): Promise<void> {
    this.storage.set(key, {
      value,
      timestamp: Date.now(),
      metadata
    })
  }

  async retrieve(key: string): Promise<any> {
    const entry = this.storage.get(key)
    return entry?.value
  }

  async query(query: MemoryQuery): Promise<any[]> {
    let results = Array.from(this.storage.entries()).map(([key, entry]) => ({
      key,
      ...entry
    }))

    if (query.keywords && query.keywords.length > 0) {
      results = results.filter(entry => 
        query.keywords!.some(keyword => 
          JSON.stringify(entry.value).toLowerCase().includes(keyword.toLowerCase())
        )
      )
    }

    if (query.since) {
      results = results.filter(entry => entry.timestamp >= query.since!)
    }

    return results.slice(0, query.limit || 100)
  }

  async clear(): Promise<void> {
    this.storage.clear()
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.name,
      capabilities: [{
        name: this.memoryType,
        description: `${this.memoryType} memory storage`,
        parameters: {}
      }],
      version: this.version
    }
  }
}

export function createMemoryPlugin(
  id: string,
  name: string,
  version: string,
  description: string,
  author: string,
  memoryType: 'short' | 'medium' | 'long'
): MemoryPluginAdapter {
  return new MemoryPluginAdapter({
    id,
    name,
    version,
    description,
    author,
    memoryType
  })
}
