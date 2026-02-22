import { ipcMain } from 'electron'
import { updateService } from '../../services/UpdateService'

const registeredHandlers = new Set<string>()

function isHandlerRegistered(channel: string): boolean {
  return registeredHandlers.has(channel)
}

export function registerUpdateHandlers() {
  if (registeredHandlers.size > 0) {
    console.log('[UpdateHandler] 更新处理器已注册')
    return
  }

  console.log('[UpdateHandler] 注册更新处理器...')

  if (!isHandlerRegistered('update:check')) {
    ipcMain.handle('update:check', async () => {
      try {
        const updateInfo = await updateService.checkForUpdates()
        return { success: true, updateInfo }
      } catch (error: any) {
        console.error('检查更新失败:', error)
        return { success: false, error: error.message }
      }
    })
    registeredHandlers.add('update:check')
  }

  if (!isHandlerRegistered('update:download')) {
    ipcMain.handle('update:download', async () => {
      try {
        await updateService.downloadUpdate()
        return { success: true }
      } catch (error: any) {
        console.error('下载更新失败:', error)
        return { success: false, error: error.message }
      }
    })
    registeredHandlers.add('update:download')
  }

  if (!isHandlerRegistered('update:install')) {
    ipcMain.handle('update:install', async () => {
      try {
        updateService.quitAndInstall()
        return { success: true }
      } catch (error: any) {
        console.error('安装更新失败:', error)
        return { success: false, error: error.message }
      }
    })
    registeredHandlers.add('update:install')
  }

  if (!isHandlerRegistered('update:getInfo')) {
    ipcMain.handle('update:getInfo', async () => {
      try {
        const updateInfo = updateService.getUpdateInfo()
        const isAvailable = updateService.isUpdateAvailable()
        const currentVersion = updateService.getCurrentVersion()
        return { success: true, updateInfo, isAvailable, currentVersion }
      } catch (error: any) {
        console.error('获取更新信息失败:', error)
        return { success: false, error: error.message }
      }
    })
    registeredHandlers.add('update:getInfo')
  }

  console.log('[UpdateHandler] 更新处理器注册完成!')
}
