export interface ToolParameter {
  name: string
  type: string
  description: string
  required: boolean
}

export interface ToolContext {
  signal?: AbortSignal
  taskId?: string
  taskDir?: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameter[]
  handler: (args: any, ctx?: ToolContext) => Promise<any>
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()
  private enabledTools: Set<string> = new Set()

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool)
    this.enabledTools.add(tool.name) // Enable by default
  }

  getTool(name: string): ToolDefinition | undefined {
    if (!this.enabledTools.has(name)) return undefined
    return this.tools.get(name)
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(t => this.enabledTools.has(t.name))
  }
  
  isToolEnabled(name: string): boolean {
    return this.enabledTools.has(name)
  }
  
  enableTool(name: string) {
    if (this.tools.has(name)) {
      this.enabledTools.add(name)
    }
  }
  
  disableTool(name: string) {
    this.enabledTools.delete(name)
  }

  getToolsDescription(): string {
    return this.getAllTools().map(tool => {
      const params = tool.parameters.map(p => 
        `- ${p.name} (${p.type}): ${p.description} ${p.required ? '(Required)' : '(Optional)'}`
      ).join('\n')
      return `Tool: ${tool.name}\nDescription: ${tool.description}\nParameters:\n${params}`
    }).join('\n\n')
  }
}

export const toolRegistry = new ToolRegistry()
