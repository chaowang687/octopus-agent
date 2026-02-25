import { ipcMain, dialog } from 'electron'
import * as si from 'systeminformation'
import { executeAsync } from '../../utils/AsyncCommandExecutor'

class CommandLimiter {
  private active = 0
  private queue: Array<() => void> = []

  constructor(private readonly maxConcurrent: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await task()
    } finally {
      this.release()
    }
  }

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
    if (next) {
      next()
    }
  }
}

const commandLimiter = new CommandLimiter(4)
const MAX_COMMAND_OUTPUT = 200 * 1024

function finalizeCommandOutput(raw: string): { text: string; truncated: boolean } {
  if (raw.length <= MAX_COMMAND_OUTPUT) {
    return { text: raw, truncated: false }
  }

  const text = `${raw.slice(0, MAX_COMMAND_OUTPUT)}\n\n[output truncated]`
  return { text, truncated: true }
}

// 系统相关的 IPC 处理器
export function registerSystemHandlers() {
  // 打开外部链接
  ipcMain.handle('system:openExternal', (_, url: string) => {
    try {
      const { shell } = require('electron')
      shell.openExternal(url)
      return { success: true }
    } catch (error: any) {
      console.error('打开外部链接失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 截取屏幕
  ipcMain.handle('system:captureScreen', async () => {
    try {
      const { desktopCapturer } = require('electron')
      
      if (!desktopCapturer || !desktopCapturer.getSources) {
        return { success: false, error: 'Desktop capturer not available' }
      }
      
      const sources = await desktopCapturer.getSources({ types: ['screen'] })
      
      if (sources.length > 0) {
        // 这里可以返回屏幕截图信息
        return { success: true, sources: sources.map((s: any) => ({ id: s.id, name: s.name })) }
      }
      return { success: false, error: 'No screen sources found' }
    } catch (error: any) {
      console.error('截取屏幕失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 执行命令
  ipcMain.handle('system:executeCommand', async (_, command: string, args: string[]) => {
    try {
      const cmd = `${command} ${(args || []).join(' ')}`.trim()
      const { result, queuedMs, startedAt, finishedAt } = await commandLimiter.runWithMeta(() =>
        executeAsync(cmd, { timeout: 60000, maxBuffer: MAX_COMMAND_OUTPUT })
      )
      if (result.success) {
        const finalized = finalizeCommandOutput(result.stdout)
        return {
          success: true,
          output: finalized.text,
          truncated: finalized.truncated,
          queuedMs,
          startedAt,
          finishedAt
        }
      }
      const finalized = finalizeCommandOutput(result.stderr || result.stdout)
      return {
        success: false,
        error: finalized.text,
        exitCode: result.exitCode,
        truncated: finalized.truncated,
        queuedMs,
        startedAt,
        finishedAt
      }
    } catch (error: any) {
      console.error('执行命令失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 执行复杂命令
  ipcMain.handle('system:executeComplexCommand', async (_, command: string, options?: any) => {
    try {
      const { cwd = process.cwd(), timeout = 120000 } = options || {}
      const { result, queuedMs, startedAt, finishedAt } = await commandLimiter.runWithMeta(() =>
        executeAsync(command, { cwd, timeout, maxBuffer: MAX_COMMAND_OUTPUT })
      )
      if (result.success) {
        const finalized = finalizeCommandOutput(result.stdout)
        return {
          success: true,
          output: finalized.text,
          truncated: finalized.truncated,
          queuedMs,
          startedAt,
          finishedAt
        }
      }
      const finalized = finalizeCommandOutput(result.stderr || result.stdout)
      return {
        success: false,
        error: finalized.text,
        exitCode: result.exitCode,
        truncated: finalized.truncated,
        queuedMs,
        startedAt,
        finishedAt
      }
    } catch (error: any) {
      console.error('执行复杂命令失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 执行 Shell 脚本
  ipcMain.handle('system:executeShellScript', async (_, script: string, cwd?: string) => {
    try {
      const { result, queuedMs, startedAt, finishedAt } = await commandLimiter.runWithMeta(() =>
        executeAsync(script, {
          cwd: cwd || process.cwd(),
          timeout: 120000,
          maxBuffer: MAX_COMMAND_OUTPUT
        })
      )
      if (result.success) {
        const finalized = finalizeCommandOutput(result.stdout)
        return {
          success: true,
          output: finalized.text,
          truncated: finalized.truncated,
          queuedMs,
          startedAt,
          finishedAt
        }
      }
      const finalized = finalizeCommandOutput(result.stderr || result.stdout)
      return {
        success: false,
        error: finalized.text,
        exitCode: result.exitCode,
        truncated: finalized.truncated,
        queuedMs,
        startedAt,
        finishedAt
      }
    } catch (error: any) {
      console.error('执行脚本失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取系统信息
  ipcMain.handle('system:getSystemInfo', async () => {
    try {
      const systemInfo = {
        os: await si.osInfo(),
        cpu: await si.cpu(),
        memory: await si.mem(),
        disk: await si.diskLayout(),
        network: await si.networkInterfaces(),
        battery: await si.battery(),
        graphics: await si.graphics()
      }
      return { success: true, data: systemInfo }
    } catch (error: any) {
      console.error('获取系统信息失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 对话框 - 打开文件
  ipcMain.handle('dialog:openFile', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile']
      })
      if (canceled) {
        return { success: false, canceled: true }
      }
      return { success: true, filePath: filePaths[0] }
    } catch (error: any) {
      console.error('打开文件对话框失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 对话框 - 显示打开对话框
  ipcMain.handle('dialog:showOpenDialog', async (_, options: any) => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(options)
      if (canceled) {
        return { success: false, canceled: true }
      }
      return { success: true, filePaths }
    } catch (error: any) {
      console.error('显示打开对话框失败:', error)
      return { success: false, error: error.message }
    }
  })

  // WebView 开发工具
  ipcMain.handle('webview:openDevTools', () => {
    try {
      // 这里可以添加打开 WebView 开发工具的逻辑
      return { success: true }
    } catch (error: any) {
      console.error('打开 WebView 开发工具失败:', error)
      return { success: false, error: error.message }
    }
  })
}
