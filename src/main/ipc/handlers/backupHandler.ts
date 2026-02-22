import { ipcMain } from 'electron'
import { backupService, BackupConfig, BackupInfo, BackupRestoreResult } from '../../services/BackupService'

export function registerBackupHandlers() {
  console.log('[BackupHandler] 注册备份处理器...')

  ipcMain.handle('backup:create', async (_event, description?: string, userId?: string) => {
    try {
      const backup = await backupService.createBackup(description, userId)
      return { success: true, backup }
    } catch (error: any) {
      console.error('创建备份失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('backup:restore', async (_event, backupId: string) => {
    try {
      const result = await backupService.restoreBackup(backupId)
      return { success: result.success, result }
    } catch (error: any) {
      console.error('恢复备份失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('backup:delete', async (_event, backupId: string) => {
    try {
      const success = backupService.deleteBackup(backupId)
      return { success }
    } catch (error: any) {
      console.error('删除备份失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('backup:list', async () => {
    try {
      const backups = backupService.getBackupList()
      return { success: true, backups }
    } catch (error: any) {
      console.error('获取备份列表失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('backup:info', async (_event, backupId: string) => {
    try {
      const info = backupService.getBackupInfo(backupId)
      return { success: true, info }
    } catch (error: any) {
      console.error('获取备份信息失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('backup:export', async (_event, backupId: string, exportPath: string) => {
    try {
      const success = await backupService.exportBackup(backupId, exportPath)
      return { success }
    } catch (error: any) {
      console.error('导出备份失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('backup:import', async (_event, importPath: string) => {
    try {
      const backup = await backupService.importBackup(importPath)
      return { success: true, backup }
    } catch (error: any) {
      console.error('导入备份失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('backup:get-config', async () => {
    try {
      const config = backupService.getConfig()
      return { success: true, config }
    } catch (error: any) {
      console.error('获取备份配置失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('backup:update-config', async (_event, newConfig: Partial<BackupConfig>) => {
    try {
      backupService.updateConfig(newConfig)
      const config = backupService.getConfig()
      return { success: true, config }
    } catch (error: any) {
      console.error('更新备份配置失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('backup:auto-backup', async () => {
    try {
      const backup = await backupService.createBackup('自动备份')
      return { success: true, backup }
    } catch (error: any) {
      console.error('自动备份失败:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[BackupHandler] 备份处理器注册完成')
}
