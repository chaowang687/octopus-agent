import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import * as fs from 'fs'
import * as path from 'path'
import { configureSecurity, getRecommendedSecurityOptions } from './security/ElectronSecurity'
import { securityManager } from './security/SecurityManager'
import { TaskStateManager, createTaskStateManager } from './agent/TaskStateManager'

const isDev = is.dev
const securityOptions = getRecommendedSecurityOptions()
configureSecurity(securityOptions)

import { taskEngine } from './agent/TaskEngine'
import { toolRegistry } from './agent/ToolRegistry'
import { galleryService } from './services/GalleryService'
import { safeCodeExecutionService } from './services/SafeCodeExecutionService'
import { updateService } from './services/UpdateService'
import { backupService } from './services/BackupService'
import { analyticsService } from './services/AnalyticsService'
import { licenseService } from './services/LicenseService'
import { registerAllHandlers } from './ipc'
import { collaborationManager } from './ipc/handlers/collaborationHandler'
import { userService } from './services/UserService'
import { initWindowDockService } from './services/WindowDockService'

const traeSandboxStoragePath = process.env.TRAE_SANDBOX_STORAGE_PATH
if (traeSandboxStoragePath) {
  const userDataDir = path.join(process.cwd(), '.localized-agent-coder-userData')
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true })
  }
  app.setPath('userData', userDataDir)
}

// 全局窗口引用
let mainWindow: BrowserWindow | null = null

// 确保TaskStateManager被包含在构建中
const taskStateManager = createTaskStateManager()

// 导出mainWindow引用供其他模块使用
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

taskEngine.on('progress', (evt: any) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('task:progress', evt)
  }
})

// API密钥存储路径
const apiKeysPath = path.join(app.getPath('userData'), 'apiKeys.json')

// 确保API密钥文件存在
function ensureApiKeysFile() {
  if (!fs.existsSync(apiKeysPath)) {
    fs.writeFileSync(apiKeysPath, JSON.stringify({}))
  }
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,  // 立即显示
    backgroundColor: '#1e1e1e',  // 深色背景，与 IDE 主题匹配
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',  // macOS 风格的隐藏标题栏
    trafficLightPosition: { x: 12, y: 12 },  // 交通灯位置调整
    frame: false,  // 无框窗口
    ...(is.dev ? { webPreferences: { devTools: true } } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 设置协作管理器的主窗口
  collaborationManager.setMainWindow(mainWindow)
  
  // 设置更新服务的主窗口
  updateService.setMainWindow(mainWindow)

  // 初始化窗口吸附服务
  initWindowDockService(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 监听渲染进程错误
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Main] Renderer failed to load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('[Main] Renderer crashed, killed:', killed)
  })

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const logLevels = ['verbose', 'info', 'warn', 'error']
    console.log(`[Renderer Console][${logLevels[level] || 'unknown'}] ${message}`)
  })

  // 在页面加载完成后检查
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Renderer finished loading')
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Renderer DOM content loaded')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-attach-webview', (_, contents) => {
    contents.setWindowOpenHandler((details) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-new-window', {
          url: details.url,
          frameName: details.frameName
        })
      }
      return { action: 'deny' }
    })
  })

  // 加载渲染进程
  // 开发模式下使用 dev server，生产模式使用本地文件
  const isProduction = process.env.NODE_ENV === 'production' || process.env.ELECTRON_IS_DEV === '0'
  console.log('[Main] is.dev:', is.dev, 'isProduction:', isProduction)
  
  if (is.dev && !isProduction) {
    // 开发模式：加载 dev server
    console.log('[Main] Loading from dev server: http://localhost:5173')
    mainWindow.loadURL('http://localhost:5173')
  } else {
    // 生产模式：加载本地文件
    const rendererPath = join(__dirname, '../renderer/index.html')
    console.log('[Main] Loading renderer from:', rendererPath)
    
    const fs = require('fs')
    if (fs.existsSync(rendererPath)) {
      console.log('[Main] Renderer file exists, loading...')
      mainWindow.loadFile(rendererPath)
    } else {
      console.error('[Main] Renderer file NOT found:', rendererPath)
    }
  }
}

// 应用生命周期
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.localized-agent.coder')
  
  // 检查加密可用性
  const { safeStorage } = require('electron')
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('警告: Electron safeStorage 不可用，将使用备用加密方案')
    console.warn('建议: 在生产环境中启用系统级加密以获得更好的安全性')
  } else {
    console.log('安全: Electron safeStorage 可用，使用系统级加密')
  }
  
  ensureApiKeysFile()
  
  // 检查是否在模拟模式（无API密钥）
  const isMockMode = Object.keys(JSON.parse(fs.readFileSync(apiKeysPath, 'utf8'))).length === 0
  console.log('应用模式:', isMockMode ? '模拟模式' : '正常模式')
  
  // 初始化用户服务
  console.log('初始化用户服务...')
  userService.initialize()
  
  // 初始化商业化服务（模拟模式下减少初始化）
  console.log('初始化商业化服务...')
  backupService
  if (!isMockMode) {
    analyticsService
    licenseService
  }
  
  // 注册所有IPC处理器
  console.log('注册所有IPC处理器...')
  registerAllHandlers()
  
  // 窗口控制IPC处理器
  ipcMain.handle('window:minimize', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) window.minimize()
  })
  
  ipcMain.handle('window:maximize', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
  })
  
  ipcMain.handle('window:close', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) window.close()
  })
  
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  
  // 初始化新增的服务（模拟模式下减少初始化）
  console.log('App ready, initializing services...')
  if (!isMockMode) {
    analyticsService.initialize()
    licenseService.initialize()
    
    // 启动会话
    analyticsService.startSession()
  }
  
  // 其他初始化逻辑
  createWindow()
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 自动更新配置
if (!is.dev) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'yourusername',
    repo: 'localized-agent-coder'
  })
  autoUpdater.checkForUpdatesAndNotify()
}
