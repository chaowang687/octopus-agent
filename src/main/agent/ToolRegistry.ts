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

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool)
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values())
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
