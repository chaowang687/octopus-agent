/**
 * 工具插件管理器
 * 负责管理所有工具插件的注册和执行
 */

import { EventEmitter } from 'events'
import { ToolPlugin, ToolDefinition, ToolResult } from './PluginInterface'

export class ToolPluginManager extends EventEmitter {
  private tools: Map<string, ToolPlugin> = new Map()
  private toolDefinitions: Map<string, ToolDefinition> = new Map()

  constructor() {
    super()
  }

  async registerTool(tool: ToolPlugin): Promise<void> {
    await tool.initialize()
    
    this.tools.set(tool.id, tool)
    
    for (const def of tool.toolDefinitions) {
      this.toolDefinitions.set(def.name, def)
    }
    
    console.log(`[ToolPluginManager] Registered tool plugin: ${tool.name} with ${tool.toolDefinitions.length} tools`)
    this.emit('tool_registered', { pluginId: tool.id, toolCount: tool.toolDefinitions.length })
  }

  async unregisterTool(toolId: string): Promise<void> {
    const tool = this.tools.get(toolId)
    if (tool) {
      await tool.destroy()
      
      for (const def of tool.toolDefinitions) {
        this.toolDefinitions.delete(def.name)
      }
      
      this.tools.delete(toolId)
      console.log(`[ToolPluginManager] Unregistered tool plugin: ${toolId}`)
      this.emit('tool_unregistered', { pluginId: toolId })
    }
  }

  async executeTool(toolName: string, params: Record<string, any>): Promise<ToolResult> {
    const def = this.toolDefinitions.get(toolName)
    if (!def) {
      return { success: false, error: `Tool ${toolName} not found` }
    }

    for (const tool of this.tools.values()) {
      const matched = tool.toolDefinitions.find(d => d.name === toolName)
      if (matched) {
        try {
          const result = await tool.executeTool(toolName, params)
          this.emit('tool_executed', { toolName, params, result })
          return result
        } catch (error: any) {
          const errorResult = { success: false, error: error.message }
          this.emit('tool_error', { toolName, params, error: error.message })
          return errorResult
        }
      }
    }

    return { success: false, error: `No plugin found for tool ${toolName}` }
  }

  getToolDefinition(name: string): ToolDefinition | undefined {
    return this.toolDefinitions.get(name)
  }

  getAllToolDefinitions(): ToolDefinition[] {
    return Array.from(this.toolDefinitions.values())
  }

  getToolDefinitionsByCategory(category: string): ToolDefinition[] {
    return Array.from(this.toolDefinitions.values()).filter(
      def => def.parameters?.category === category
    )
  }

  getPluginByToolName(toolName: string): ToolPlugin | undefined {
    for (const tool of this.tools.values()) {
      if (tool.toolDefinitions.find(d => d.name === toolName)) {
        return tool
      }
    }
    return undefined
  }

  getAllPlugins(): ToolPlugin[] {
    return Array.from(this.tools.values())
  }

  hasTool(name: string): boolean {
    return this.toolDefinitions.has(name)
  }

  getToolCount(): number {
    return this.toolDefinitions.size
  }
}

export const toolPluginManager = new ToolPluginManager()
