import { ipcMain } from 'electron'
import { taskEngine } from '../../agent/TaskEngine'

// 检查处理器是否已注册
function isHandlerRegistered(channel: string): boolean {
  try {
    // 尝试获取已注册的处理器，如果不存在会抛出错误
    ipcMain.listenerCount(channel)
    return ipcMain.listenerCount(channel) > 0
  } catch {
    return false
  }
}

// 聊天相关的 IPC 处理器
export function registerChatHandlers() {
  // 发送消息 - 只在未注册时注册
  if (!isHandlerRegistered('chat:sendMessage')) {
    ipcMain.handle('chat:sendMessage', async (_, model: string, message: string, agentOptions?: { agentId?: string; sessionId?: string; system?: string; complexity?: string }) => {
      try {
        // 执行任务
        const result = await taskEngine.executeTask(message, model, agentOptions)
        return result
      } catch (error: any) {
        console.error('发送消息失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 取消聊天 - 只在未注册时注册
  if (!isHandlerRegistered('chat:cancel')) {
    ipcMain.handle('chat:cancel', () => {
      try {
        taskEngine.cancelTask()
        return { success: true }
      } catch (error: any) {
        console.error('取消聊天失败:', error)
        return { success: false, error: error.message }
      }
    })
  }
}