import { ipcMain, BrowserWindow } from 'electron'
import { taskEngine } from '../../agent/TaskEngine'
import { multiAgentCoordinator } from '../../agent/MultiAgentCoordinator'

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

// 获取主窗口
function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
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

  // 监听多智能体协调器的流式事件
  multiAgentCoordinator.on('stream', (data) => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send('chat:stream', data)
    }
  })

  // 监听 TaskEngine 的 progress 事件（包括系统一的流式输出）
  taskEngine.on('progress', (data) => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      // 如果是流式事件，发送到 chat:stream 通道
      if (data.type === 'stream') {
        mainWindow.webContents.send('chat:stream', {
          agentId: 'system1',
          delta: data.content,
          done: data.done
        })
      }
    }
  })
}