import { ipcMain } from 'electron'
import { taskEngine } from '../../agent/TaskEngine'

// 检查处理器是否已注册
function isHandlerRegistered(channel: string): boolean {
  try {
    return ipcMain.listenerCount(channel) > 0
  } catch {
    return false
  }
}

// 任务相关的 IPC 处理器
export function registerTaskHandlers() {
  // 执行任务 - 只在未注册时注册
  if (!isHandlerRegistered('task:execute')) {
    ipcMain.handle('task:execute', async (_, instruction: string, options?: { agentId?: string; sessionId?: string; system?: string; complexity?: string; taskDir?: string }) => {
      try {
        const result = await taskEngine.executeTask(instruction, 'openai', options)
        return result
      } catch (error: any) {
        console.error('执行任务失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 取消任务 - 只在未注册时注册
  if (!isHandlerRegistered('task:cancel')) {
    ipcMain.handle('task:cancel', () => {
      try {
        taskEngine.cancelTask()
        return { success: true }
      } catch (error: any) {
        console.error('取消任务失败:', error)
        return { success: false, error: error.message }
      }
    })
  }
}