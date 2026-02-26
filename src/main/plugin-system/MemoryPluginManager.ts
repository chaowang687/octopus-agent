/**
 * 记忆插件管理器
 * 负责管理所有记忆插件的存储和检索
 */

import { EventEmitter } from 'events'
import { MemoryPlugin, MemoryQuery } from './PluginInterface'

export class MemoryPluginManager extends EventEmitter {
  private memoryPlugins: Map<string, MemoryPlugin> = new Map()
  private defaultPlugin: MemoryPlugin | null = null

  constructor() {
    super()
  }

  async registerMemory(memory: MemoryPlugin): Promise<void> {
    await memory.initialize()
    
    this.memoryPlugins.set(memory.id, memory)
    
    if (!this.defaultPlugin || memory.memoryType === 'short') {
      this.defaultPlugin = memory
    }
    
    console.log(`[MemoryPluginManager] Registered memory plugin: ${memory.name} (${memory.memoryType})`)
    this.emit('memory_registered', { pluginId: memory.id, type: memory.memoryType })
  }

  async unregisterMemory(memoryId: string): Promise<void> {
    const memory = this.memoryPlugins.get(memoryId)
    if (memory) {
      await memory.destroy()
      
      if (this.defaultPlugin?.id === memoryId) {
        this.defaultPlugin = null
      }
      
      this.memoryPlugins.delete(memoryId)
      console.log(`[MemoryPluginManager] Unregistered memory plugin: ${memoryId}`)
      this.emit('memory_unregistered', { pluginId: memoryId })
    }
  }

  async store(key: string, value: any, type?: 'short' | 'medium' | 'long'): Promise<void> {
    const plugin = this.getPluginByType(type)
    if (!plugin) {
      throw new Error(`Memory plugin of type ${type || 'default'} not found`)
    }

    await plugin.store(key, value)
    this.emit('memory_stored', { key, type: plugin.memoryType })
  }

  async retrieve(key: string, type?: 'short' | 'medium' | 'long'): Promise<any> {
    const plugin = this.getPluginByType(type)
    if (!plugin) {
      throw new Error(`Memory plugin of type ${type || 'default'} not found`)
    }

    const result = await plugin.retrieve(key)
    this.emit('memory_retrieved', { key, type: plugin.memoryType, found: result !== undefined })
    return result
  }

  async query(query: MemoryQuery): Promise<any[]> {
    if (query.type && query.type !== 'all') {
      const plugin = this.getPluginByType(query.type)
      if (plugin) {
        return await plugin.query(query)
      }
    }

    const results: any[] = []
    for (const plugin of this.memoryPlugins.values()) {
      const pluginResults = await plugin.query({ ...query, type: plugin.memoryType })
      results.push(...pluginResults)
    }

    return results.slice(0, query.limit || 100)
  }

  async clear(type?: 'short' | 'medium' | 'long'): Promise<void> {
    if (type) {
      const plugin = this.getPluginByType(type)
      if (plugin) {
        await plugin.clear()
        this.emit('memory_cleared', { type })
      }
    } else {
      for (const plugin of this.memoryPlugins.values()) {
        await plugin.clear()
      }
      this.emit('memory_cleared', { type: 'all' })
    }
  }

  private getPluginByType(type?: 'short' | 'medium' | 'long'): MemoryPlugin | null {
    if (type) {
      for (const plugin of this.memoryPlugins.values()) {
        if (plugin.memoryType === type) {
          return plugin
        }
      }
      return null
    }
    return this.defaultPlugin
  }

  getPlugin(id: string): MemoryPlugin | undefined {
    return this.memoryPlugins.get(id)
  }

  getAllPlugins(): MemoryPlugin[] {
    return Array.from(this.memoryPlugins.values())
  }

  hasMemoryType(type: 'short' | 'medium' | 'long'): boolean {
    for (const plugin of this.memoryPlugins.values()) {
      if (plugin.memoryType === type) {
        return true
      }
    }
    return false
  }
}

export const memoryPluginManager = new MemoryPluginManager()
