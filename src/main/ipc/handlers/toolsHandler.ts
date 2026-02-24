import { ipcMain } from 'electron'
import { toolRegistry } from '../../agent/ToolRegistry'

// 工具相关的 IPC 处理器
export function registerToolsHandlers() {
  // 查找工具路径
  ipcMain.handle('tools:findPath', () => {
    try {
      // 这里可以添加查找工具路径的逻辑
      return { success: true, path: '' }
    } catch (error: any) {
      console.error('查找工具路径失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 列出工具
  ipcMain.handle('tools:list', () => {
    try {
      const tools = toolRegistry.getAllTools()
      return { success: true, tools }
    } catch (error: any) {
      console.error('列出工具失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 检测工具
  ipcMain.handle('tools:detect', () => {
    try {
      // 这里可以添加工具检测逻辑
      return { success: true, tools: [] }
    } catch (error: any) {
      console.error('检测工具失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 配置工具
  ipcMain.handle('tools:configure', () => {
    try {
      // 这里可以添加工具配置逻辑
      return { success: true }
    } catch (error: any) {
      console.error('配置工具失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取工具配置
  ipcMain.handle('tools:getConfig', () => {
    try {
      // 这里可以返回工具配置
      return { success: true, config: {} }
    } catch (error: any) {
      console.error('获取工具配置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 执行工具
  ipcMain.handle('tools:execute', async (_, toolName: string, command: string, args: any[]) => {
    try {
      console.log('[ToolsHandler] Executing tool:', toolName, 'command:', command, 'args:', args)
      const tool = toolRegistry.getTool(toolName)
      if (tool) {
        // 正确处理参数：如果 args 是数组且只有一个对象，直接传递该对象
        let params: any
        if (Array.isArray(args) && args.length === 1 && typeof args[0] === 'object') {
          params = args[0]
        } else if (Array.isArray(args)) {
          params = { args }
        } else {
          params = args
        }
        console.log('[ToolsHandler] Passing params to tool:', params)
        const result = await tool.handler(params)
        console.log('[ToolsHandler] Tool result:', result)
        return { success: true, output: result }
      }
      return { success: false, error: 'Tool not found' }
    } catch (error: any) {
      console.error('执行工具失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 构建工具
  ipcMain.handle('tools:build', () => {
    try {
      // 这里可以添加构建工具的逻辑
      return { success: true }
    } catch (error: any) {
      console.error('构建工具失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 打开工具
  ipcMain.handle('tools:open', () => {
    try {
      // 这里可以添加打开工具的逻辑
      return { success: true }
    } catch (error: any) {
      console.error('打开工具失败:', error)
      return { success: false, error: error.message }
    }
  })

  // VS Code 相关
  ipcMain.handle('tools:vscode:openProject', () => {
    try {
      // 这里可以添加打开 VS Code 项目的逻辑
      return { success: true }
    } catch (error: any) {
      console.error('打开 VS Code 项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('tools:vscode:createFile', (_, _projectPath: string, _fileName: string, _content: string) => {
    try {
      // 这里可以添加创建 VS Code 文件的逻辑
      return { success: true }
    } catch (error: any) {
      console.error('创建 VS Code 文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('tools:vscode:executeCommand', (_, _command: string, _args: string[]) => {
    try {
      // 这里可以添加执行 VS Code 命令的逻辑
      return { success: true }
    } catch (error: any) {
      console.error('执行 VS Code 命令失败:', error)
      return { success: false, error: error.message }
    }
  })
}