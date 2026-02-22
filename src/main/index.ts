import { app, BrowserWindow, ipcMain, shell } from 'electron'

// 必须在app ready之前禁用沙箱！
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-sandbox')
app.commandLine.appendSwitch('disable-gpu-sandbox')

import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import * as fs from 'fs'
import * as path from 'path'
import { taskEngine } from './agent/TaskEngine'
import { toolRegistry } from './agent/ToolRegistry'
import { galleryService } from './services/GalleryService'
import { safeCodeExecutionService } from './services/SafeCodeExecutionService'
import { registerAllHandlers } from './ipc'
// import './agent/imageTools' // 暂时注释掉以避免sharp模块加载问题

const traeSandboxStoragePath = process.env.TRAE_SANDBOX_STORAGE_PATH
if (traeSandboxStoragePath) {
  const userDataDir = path.join(process.cwd(), '.localized-agent-coder-userData')
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true })
  }
  app.setPath('userData', userDataDir)
}

// 添加WebView实验性功能开关
app.commandLine.appendSwitch('enable-webview')
app.commandLine.appendSwitch('allow-file-access-from-files')
app.commandLine.appendSwitch('allow-universal-access-from-file-urls')
app.commandLine.appendSwitch('disable-web-security')
app.commandLine.appendSwitch('disable-features', 'CrossSiteDocumentBlockingIfIsolating')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// 禁用GPU加速以避免崩溃
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-gpu-process')
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('disable-gpu-watchdog')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-sandbox')

// 全局窗口引用
let mainWindow: BrowserWindow | null = null

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
    backgroundColor: '#ffffff',  // 白色背景
    autoHideMenuBar: true,
    ...(is.dev ? { webPreferences: { devTools: true } } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

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
  ensureApiKeysFile()
  
  // 注册所有IPC处理器
  console.log('注册所有IPC处理器...')
  registerAllHandlers()
  
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
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
