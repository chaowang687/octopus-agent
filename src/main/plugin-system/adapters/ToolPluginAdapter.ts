/**
 * 工具插件适配器
 * 将现有工具系统接入插件系统
 */

import { PluginInterface, ToolDefinition, ToolResult } from '../PluginInterface'
import { toolRegistry, ToolDefinition as OriginalToolDefinition } from '../../agent/ToolRegistry'

export class ToolPluginAdapter implements PluginInterface {
  id: string
  name: string
  version: string
  description: string
  author: string
  enabled: boolean = true
  category: 'tool' = 'tool'
  toolDefinitions: ToolDefinition[] = []

  constructor(options: {
    id: string
    name: string
    version: string
    description: string
    author: string
    toolDefinitions?: ToolDefinition[]
  }) {
    this.id = options.id
    this.name = options.name
    this.version = options.version
    this.description = options.description
    this.author = options.author
    this.toolDefinitions = options.toolDefinitions || []
  }

  async initialize(): Promise<void> {
    for (const def of this.toolDefinitions) {
      const originalDef: OriginalToolDefinition = {
        name: def.name,
        description: def.description,
        parameters: def.parameters || [],
        handler: async () => { return {} }
      }
      toolRegistry.register(originalDef)
    }
    console.log(`[ToolPluginAdapter] Initialized: ${this.name}`)
  }

  async destroy(): Promise<void> {
    console.log(`[ToolPluginAdapter] Destroyed: ${this.name}`)
  }

  async executeTool(name: string, params: Record<string, any>): Promise<ToolResult> {
    try {
      const tool = toolRegistry.getTool(name)
      if (!tool) {
        return { success: false, error: `Tool ${name} not found` }
      }
      const result = await tool.handler(params)
      return { success: true, result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  registerTools(registry: any): void {
    for (const def of this.toolDefinitions) {
      const originalDef: OriginalToolDefinition = {
        name: def.name,
        description: def.description,
        parameters: def.parameters || [],
        handler: async () => { return {} }
      }
      registry.register(originalDef)
    }
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.name,
      capabilities: this.toolDefinitions.map(d => ({
        name: d.name,
        description: d.description,
        parameters: d.parameters
      })),
      version: this.version
    }
  }
}

export function createToolPlugin(
  id: string,
  name: string,
  version: string,
  description: string,
  author: string,
  tools: Array<{
    name: string
    description: string
    parameters: Array<{
      name: string
      type: string
      description: string
      required: boolean
    }>
    handler: (args: any) => Promise<any>
  }>
): ToolPluginAdapter {
  const toolDefinitions: ToolDefinition[] = tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }))

  const plugin = new ToolPluginAdapter({
    id,
    name,
    version,
    description,
    author,
    toolDefinitions
  })

  for (const tool of tools) {
    const originalDef: OriginalToolDefinition = {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      handler: tool.handler
    }
    toolRegistry.register(originalDef)
  }

  return plugin
}
