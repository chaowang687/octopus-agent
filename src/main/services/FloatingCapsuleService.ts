/**
 * Floating Capsule Service
 * 实现悬浮胶囊窗口服务
 */

import { BrowserWindow, screen, globalShortcut, app, ipcMain } from 'electron'
import { join } from 'path'

// 使用环境变量来检测开发模式
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1'

export interface CapsuleOptions {
  size: number
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  opacity: number
  shortcut: string
}

export class FloatingCapsuleService {
  private capsuleWindow: BrowserWindow | null = null
  private isVisible = false
  private options: CapsuleOptions

  constructor(options: Partial<CapsuleOptions> = {}) {
    this.options = {
      size: 60,
      position: 'top-right',
      opacity: 0.8,
      shortcut: 'Alt+A',
      ...options
    }
  }

  /**
   * 初始化悬浮胶囊服务
   */
  async initialize(): Promise<void> {
    await this.createCapsuleWindow()
    this.registerGlobalShortcut()
    this.setupEventListeners()
  }

  /**
   * 创建悬浮胶囊窗口
   */
  private async createCapsuleWindow(): Promise<void> {
    const { size, opacity, position } = this.options
    
    // 获取屏幕尺寸
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

    // 计算窗口位置
    const { x, y } = this.calculatePosition(position, screenWidth, screenHeight, size)

    this.capsuleWindow = new BrowserWindow({
      width: size,
      height: size,
      x,
      y,
      alwaysOnTop: true,
      skipTaskbar: true,
      frame: false,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      closable: false,
      transparent: true,
      opacity,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    // 加载胶囊窗口页面
    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      await this.capsuleWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/capsule.html`)
    } else {
      await this.capsuleWindow.loadFile(join(__dirname, '../renderer/capsule.html'))
    }

    // 初始隐藏窗口
    this.capsuleWindow.hide()
  }

  /**
   * 计算窗口位置
   */
  private calculatePosition(
    position: string, 
    screenWidth: number, 
    screenHeight: number, 
    size: number
  ): { x: number; y: number } {
    const margin = 20

    switch (position) {
      case 'top-left':
        return { x: margin, y: margin }
      case 'top-right':
        return { x: screenWidth - size - margin, y: margin }
      case 'bottom-left':
        return { x: margin, y: screenHeight - size - margin }
      case 'bottom-right':
        return { x: screenWidth - size - margin, y: screenHeight - size - margin }
      case 'center':
        return { 
          x: Math.floor((screenWidth - size) / 2), 
          y: Math.floor((screenHeight - size) / 2) 
        }
      default:
        return { x: margin, y: margin }
    }
  }

  /**
   * 注册全局快捷键
   */
  private registerGlobalShortcut(): void {
    const shortcut = this.options.shortcut
    
    const ret = globalShortcut.register(shortcut, () => {
      this.toggleVisibility()
    })

    if (!ret) {
      console.error(`Failed to register global shortcut: ${shortcut}`)
    } else {
      console.log(`Global shortcut registered: ${shortcut}`)
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // IPC 事件监听
    ipcMain.handle('capsule:show', () => this.show())
    ipcMain.handle('capsule:hide', () => this.hide())
    ipcMain.handle('capsule:toggle', () => this.toggleVisibility())
    ipcMain.handle('capsule:get-state', () => this.getState())

    // 窗口事件监听
    if (this.capsuleWindow) {
      this.capsuleWindow.on('closed', () => {
        this.capsuleWindow = null
      })

      // 双击事件
      this.capsuleWindow.on('double-click', () => {
        this.toggleVisibility()
      })
    }
  }

  /**
   * 显示悬浮胶囊
   */
  show(): void {
    if (this.capsuleWindow && !this.isVisible) {
      this.capsuleWindow.show()
      this.capsuleWindow.focus()
      this.isVisible = true
      console.log('Floating capsule shown')
    }
  }

  /**
   * 隐藏悬浮胶囊
   */
  hide(): void {
    if (this.capsuleWindow && this.isVisible) {
      this.capsuleWindow.hide()
      this.isVisible = false
      console.log('Floating capsule hidden')
    }
  }

  /**
   * 切换显示状态
   */
  toggleVisibility(): void {
    if (this.isVisible) {
      this.hide()
    } else {
      this.show()
    }
  }

  /**
   * 获取胶囊状态
   */
  getState(): { visible: boolean; position: string; size: number } {
    return {
      visible: this.isVisible,
      position: this.options.position,
      size: this.options.size
    }
  }

  /**
   * 移动到指定位置
   */
  moveTo(x: number, y: number): void {
    if (this.capsuleWindow) {
      this.capsuleWindow.setPosition(x, y)
    }
  }

  /**
   * 设置大小
   */
  setSize(size: number): void {
    if (this.capsuleWindow) {
      this.capsuleWindow.setSize(size, size)
      this.options.size = size
    }
  }

  /**
   * 设置透明度
   */
  setOpacity(opacity: number): void {
    if (this.capsuleWindow) {
      this.capsuleWindow.setOpacity(opacity)
      this.options.opacity = opacity
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    globalShortcut.unregister(this.options.shortcut)
    globalShortcut.unregisterAll()
    
    if (this.capsuleWindow) {
      this.capsuleWindow.close()
      this.capsuleWindow = null
    }
  }
}