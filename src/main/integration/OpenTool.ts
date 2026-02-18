import { toolRegistry } from '../agent/ToolRegistry'
import { toolCallCenter } from './ToolCallCenter'
import { ToolType } from './ToolTypes'

export function registerOpenTool() {
  toolRegistry.register({
    name: 'open_software',
    description: 'Open development software (VS Code, Unity, etc.)',
    parameters: [
      { name: 'tool', type: 'string', description: 'The software to open (vscode, unity, source, terminal, browser)', required: true },
      { name: 'path', type: 'string', description: 'Optional path to open with the software', required: false },
      { name: 'options', type: 'object', description: 'Additional options for the tool', required: false }
    ],
    handler: async (params: any, context: any) => {
      const { tool, path: filePath, options } = params

      try {
        if (filePath) {
          await toolCallCenter.openPath(tool as ToolType, filePath, options)
          return {
            success: true,
            message: `Opened ${tool} with path: ${filePath}`
          }
        } else {
          await toolCallCenter.openTool(tool as ToolType, options)
          return {
            success: true,
            message: `Opened ${tool}`
          }
        }
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to open software'
        }
      }
    }
  })

  toolRegistry.register({
    name: 'open_vscode',
    description: 'Open Visual Studio Code',
    parameters: [
      { name: 'path', type: 'string', description: 'Path to file or project to open', required: false },
      { name: 'line', type: 'number', description: 'Line number to jump to', required: false },
      { name: 'column', type: 'number', description: 'Column number to jump to', required: false }
    ],
    handler: async (params: any, context: any) => {
      const { path: filePath, line, column } = params

      try {
        if (filePath) {
          const vscodeIntegration = (await import('./VscodeIntegration')).VscodeIntegration
          const integration = new vscodeIntegration()
          
          if (line || column) {
            await integration.openFile(filePath, line, column)
          } else {
            await integration.openPath(filePath)
          }
          
          return {
            success: true,
            message: `Opened ${filePath} in VS Code`
          }
        } else {
          await toolCallCenter.openTool('vscode')
          return {
            success: true,
            message: 'Opened VS Code'
          }
        }
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to open VS Code'
        }
      }
    }
  })

  toolRegistry.register({
    name: 'get_tool_status',
    description: 'Get status of available development tools',
    parameters: [
      { name: 'tool', type: 'string', description: 'Specific tool to check (optional, returns all if not specified)', required: false }
    ],
    handler: async (params: any, context: any) => {
      const { tool } = params

      try {
        if (tool) {
          const status = await toolCallCenter.getToolStatus(tool as ToolType)
          return {
            success: true,
            status
          }
        } else {
          const statuses = await toolCallCenter.getAllToolStatuses()
          const result: any = {}
          for (const [key, value] of statuses) {
            result[key] = value
          }
          return {
            success: true,
            statuses: result
          }
        }
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to get tool status'
        }
      }
    }
  })

  toolRegistry.register({
    name: 'list_available_tools',
    description: 'List all available development tools',
    parameters: [],
    handler: async (params: any, context: any) => {
      try {
        const availableTools = toolCallCenter.listAvailableTools()
        const statuses = await toolCallCenter.getAllToolStatuses()
        
        const result = availableTools.map(tool => ({
          name: tool,
          status: statuses.get(tool)
        }))

        return {
          success: true,
          tools: result
        }
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to list available tools'
        }
      }
    }
  })
}

export { registerOpenTool as default }