import { ipcMain } from 'electron'
import { BackupService } from '../../services/BackupService'

let backupServiceInstance: BackupService | null = null

function getBackupService(): BackupService {
  if (!backupServiceInstance) {
    backupServiceInstance = new BackupService()
  }
  return backupServiceInstance
}

function isHandlerRegistered(channel: string): boolean {
  try {
    ipcMain.listenerCount(channel)
    return ipcMain.listenerCount(channel) > 0
  } catch {
    return false
  }
}

export function registerBackupHandlers() {
  if (!isHandlerRegistered('backup:export')) {
    ipcMain.handle('backup:export', async (_, backupId: string, exportPath: string) => {
      try {
        const result = await getBackupService().exportToFile()
        return result
      } catch (error: any) {
        console.error('导出备份失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  if (!isHandlerRegistered('backup:import')) {
    ipcMain.handle('backup:import', async (_, importPath: string) => {
      try {
        const result = await getBackupService().importFromFile()
        return result
      } catch (error: any) {
        console.error('导入备份失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  if (!isHandlerRegistered('backup:auto-backup')) {
    ipcMain.handle('backup:auto-backup', async () => {
      try {
        const result = await getBackupService().autoBackup()
        return result
      } catch (error: any) {
        console.error('自动备份失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  if (!isHandlerRegistered('backup:list')) {
    ipcMain.handle('backup:list', async () => {
      try {
        const result = await getBackupService().getBackupFiles()
        return result
      } catch (error: any) {
        console.error('获取备份文件失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  if (!isHandlerRegistered('backup:delete')) {
    ipcMain.handle('backup:delete', async (_, fileName: string) => {
      try {
        const result = await getBackupService().deleteBackupFile(fileName)
        return result
      } catch (error: any) {
        console.error('删除备份文件失败:', error)
        return { success: false, error: error.message }
      }
    })
  }
}
