/**
 * Tray Service
 * 实现系统托盘图标服务
 */

import { app, Tray, Menu, nativeImage, BrowserWindow, Notification } from 'electron'
import { join } from 'path'

// 使用环境变量来检测开发模式
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1'

// 扩展 app 类型以支持 isQuitting
interface ExtendedApp {
  isQuitting?: boolean
}

const extendedApp = app as ExtendedApp

export class TrayService {
  private tray: Tray | null = null
  private mainWindow: BrowserWindow | null = null

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  /**
   * 初始化系统托盘服务
   */
  async initialize(): Promise<void> {
    await this.createTray()
    this.setupEventListeners()
  }

  /**
   * 创建系统托盘图标
   */
  private async createTray(): Promise<void> {
    // 创建托盘图标
    const iconPath = this.getTrayIconPath()
    const image = nativeImage.createFromPath(iconPath)
    
    // 调整图标大小以适应托盘
    const resizedImage = image.resize({ width: 16, height: 16 })
    
    this.tray = new Tray(resizedImage)
    
    // 设置托盘工具提示
    this.tray.setToolTip('Octopus Agent - 智能体编码工具')
    
    // 设置托盘菜单
    this.updateTrayMenu()
  }

  /**
   * 获取托盘图标路径
   */
  private getTrayIconPath(): string {
    if (isDev) {
      return join(__dirname, '../../build/icon.png')
    } else {
      return join(process.resourcesPath, 'build/icon.png')
    }
  }

  /**
   * 更新托盘菜单
   */
  private updateTrayMenu(): void {
    if (!this.tray) return

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => this.showMainWindow()
      },
      {
        label: '隐藏到托盘',
        click: () => this.hideToTray()
      },
      { type: 'separator' },
      {
        label: '新建对话',
        click: () => this.createNewConversation()
      },
      {
        label: '快速任务',
        submenu: [
          {
            label: '截图分析',
            click: () => this.quickTask('screenshot')
          },
          {
            label: '代码生成',
            click: () => this.quickTask('codegen')
          },
          {
            label: '文档处理',
            click: () => this.quickTask('document')
          }
        ]
      },
      { type: 'separator' },
      {
        label: '设置',
        click: () => this.openSettings()
      },
      {
        label: '关于',
        click: () => this.showAbout()
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => this.quitApp()
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 托盘点击事件
    if (this.tray) {
      this.tray.on('click', () => {
        this.toggleMainWindow()
      })

      this.tray.on('double-click', () => {
        this.showMainWindow()
      })

      this.tray.on('right-click', () => {
        // 右键点击已经通过上下文菜单处理
      })
    }

    // 主窗口事件
    if (this.mainWindow) {
      this.mainWindow.on('close', (event) => {
        // 阻止窗口关闭，而是隐藏到托盘
        if (!extendedApp.isQuitting) {
          event.preventDefault()
          this.hideToTray()
        }
      })

      this.mainWindow.on('minimize', () => {
        // 最小化时隐藏到托盘
        this.hideToTray()
      })
    }

    // 应用事件
    app.on('before-quit', () => {
      extendedApp.isQuitting = true
    })
  }

  /**
   * 显示主窗口
   */
  private showMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore()
      }
      this.mainWindow.show()
      this.mainWindow.focus()
    }
  }

  /**
   * 隐藏到托盘
   */
  private hideToTray(): void {
    if (this.mainWindow) {
      this.mainWindow.hide()
    }
  }

  /**
   * 切换主窗口显示状态
   */
  private toggleMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isVisible()) {
        this.hideToTray()
      } else {
        this.showMainWindow()
      }
    }
  }

  /**
   * 创建新对话
   */
  private createNewConversation(): void {
    this.showMainWindow()
    // 发送消息到渲染进程创建新对话
    if (this.mainWindow) {
      this.mainWindow.webContents.send('tray:new-conversation')
    }
  }

  /**
   * 快速任务
   */
  private quickTask(taskType: string): void {
    this.showMainWindow()
    
    // 发送快速任务消息到渲染进程
    if (this.mainWindow) {
      this.mainWindow.webContents.send('tray:quick-task', { type: taskType })
    }
  }

  /**
   * 打开设置
   */
  private openSettings(): void {
    this.showMainWindow()
    
    // 发送打开设置消息到渲染进程
    if (this.mainWindow) {
      this.mainWindow.webContents.send('tray:open-settings')
    }
  }

  /**
   * 显示关于信息
   */
  private showAbout(): void {
    // 显示关于对话框
    if (this.mainWindow) {
      this.mainWindow.webContents.send('tray:show-about')
    }
  }

  /**
   * 退出应用
   */
  private quitApp(): void {
    extendedApp.isQuitting = true
    app.quit()
  }

  /**
   * 更新托盘图标
   */
  updateIcon(iconPath: string): void {
    if (this.tray) {
      const image = nativeImage.createFromPath(iconPath)
      const resizedImage = image.resize({ width: 16, height: 16 })
      this.tray.setImage(resizedImage)
    }
  }

  /**
   * 更新托盘工具提示
   */
  updateTooltip(tooltip: string): void {
    if (this.tray) {
      this.tray.setToolTip(tooltip)
    }
  }

  /**
   * 显示通知
   */
  showNotification(title: string, body: string): void {
    if (this.tray) {
      // 使用系统通知
      new Notification(title, { body }).show()
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}