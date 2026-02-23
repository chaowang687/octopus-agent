import { ipcMain } from 'electron'
import { taskLogger } from '../../agent/TaskLogger'

export function registerTaskLogHandlers(): void {
  ipcMain.handle('task-log:list', async (_, limit?: number) => {
    try {
      const logs = await taskLogger.listLogs(limit || 50)
      return { success: true, logs }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('task-log:get', async (_, taskId: string) => {
    try {
      const log = await taskLogger.loadLog(taskId)
      return { success: true, log }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('task-log:delete', async (_, taskId: string) => {
    try {
      await taskLogger.deleteLog(taskId)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('task-log:search', async (_, query: string) => {
    try {
      const logs = await taskLogger.searchLogs(query)
      return { success: true, logs }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('task-log:stats', async () => {
    try {
      const stats = taskLogger.getLogStats()
      return { success: true, stats }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('task-log:current', async () => {
    try {
      const log = taskLogger.getCurrentLog()
      return { success: true, log }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
