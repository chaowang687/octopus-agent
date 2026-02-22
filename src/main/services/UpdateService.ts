import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow } from 'electron'

export class UpdateService {
  private mainWindow: BrowserWindow | null = null
  private updateInfo: UpdateInfo | null = null
  private updateAvailable = false
  private eventHandlersSetup = false

  constructor() {
    this.configureUpdater()
  }

  private configureUpdater() {
    const feedURL = process.env.UPDATE_FEED_URL || 'https://your-server.com/updates'
    const platform = process.platform

    autoUpdater.setFeedURL({
      provider: 'generic',
      url: `${feedURL}/${platform}`,
    })

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
  }

  private setupEventHandlers() {
    if (this.eventHandlersSetup) return
    this.eventHandlersSetup = true
    autoUpdater.on('checking-for-update', () => {
      this.sendToRenderer('update:checking', {})
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log('发现新版本:', info.version)
      this.updateInfo = info
      this.updateAvailable = true
      this.sendToRenderer('update:available', info)
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      console.log('当前已是最新版本:', info.version)
      this.updateAvailable = false
      this.sendToRenderer('update:not-available', info)
    })

    autoUpdater.on('error', (err: Error) => {
      console.error('更新错误:', err)
      this.sendToRenderer('update:error', { message: err.message })
    })

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent)
      const speed = this.formatBytes(progress.bytesPerSecond)
      const transferred = this.formatBytes(progress.transferred)
      const total = this.formatBytes(progress.total)

      this.sendToRenderer('update:progress', {
        percent,
        speed,
        transferred,
        total,
      })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      console.log('更新下载完成:', info.version)
      this.sendToRenderer('update:downloaded', info)
    })
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
    if (!this.eventHandlersSetup) {
      this.setupEventHandlers()
    }
  }

  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result && result.updateInfo) {
        return result.updateInfo
      }
      return null
    } catch (error: any) {
      console.error('检查更新失败:', error)
      throw error
    }
  }

  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate()
    } catch (error: any) {
      console.error('下载更新失败:', error)
      throw error
    }
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall()
  }

  getUpdateInfo(): UpdateInfo | null {
    return this.updateInfo
  }

  isUpdateAvailable(): boolean {
    return this.updateAvailable
  }

  getCurrentVersion(): string {
    return autoUpdater.currentVersion.version
  }

  private sendToRenderer(channel: string, data: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }
}

export const updateService = new UpdateService()
