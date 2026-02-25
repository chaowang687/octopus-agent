import { ipcMain } from 'electron'
import { toolRegistry } from '../../agent/ToolRegistry'

class ToolLimiter {
  private active = 0
  private queue: Array<() => void> = []

  constructor(private readonly maxConcurrent: number) {}

  async runWithMeta<T>(task: () => Promise<T>): Promise<{
    result: T
    queuedMs: number
    startedAt: number
    finishedAt: number
  }> {
    const queuedAt = Date.now()
    await this.acquire()
    const startedAt = Date.now()
    try {
      const result = await task()
      const finishedAt = Date.now()
      return {
        result,
        queuedMs: startedAt - queuedAt,
        startedAt,
        finishedAt
      }
    } finally {
      this.release()
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1
      return Promise.resolve()
    }
    return new Promise(resolve => {
      this.queue.push(() => {
        this.active += 1
        resolve()
      })
    })
  }

  private release(): void {
    this.active -= 1
    const next = this.queue.shift()
    if (next) next()
  }
}

const toolLimiter = new ToolLimiter(4)
const TOOL_EXEC_TIMEOUT_MS = 60_000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    promise
      .then(result => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch(error => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

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
  ipcMain.handle('tools:execute', async (_, toolName: string, _command: string, args: any[]) => {
    try {
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
        const { result, queuedMs, startedAt, finishedAt } = await toolLimiter.runWithMeta(() =>
          withTimeout(tool.handler(params), TOOL_EXEC_TIMEOUT_MS, `Tool execution timed out after ${TOOL_EXEC_TIMEOUT_MS}ms`)
        )
        return {
          success: true,
          output: result,
          queuedMs,
          startedAt,
          finishedAt
        }
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
