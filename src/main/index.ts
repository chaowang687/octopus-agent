import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import * as path from 'path'
import { configureSecurity, getRecommendedSecurityOptions } from './security/ElectronSecurity'

// 解决GPU进程和沙箱问题
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-process-crash-limit')
app.commandLine.appendSwitch('disable-features', 'HardwareAcceleration')
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer')
app.commandLine.appendSwitch('ignore-gpu-blacklist')
app.commandLine.appendSwitch('disable-dev-shm-usage')
app.commandLine.appendSwitch('enable-logging')

// 延迟导入所有服务和模块，避免在app就绪前调用app.getPath()
let electronApp: any
let optimizer: any
let is: any
let autoUpdater: any
let isDev: boolean

// 服务单例 - 将在app.whenReady()中延迟初始化
let securityManager: any
let createTaskStateManager: any
let FloatingCapsuleService: any
let TrayService: any
let taskEngine: any
let toolRegistry: any
let galleryService: any
let safeCodeExecutionService: any
let updateService: any
let backupService: any
let analyticsService: any
let licenseService: any
let llmService: any
let modelService: any
let memoryService: any
let contextManager: any
let skillManager: any
let toolExecutionEngine: any
let enhancedImageProcessor: any
let enhancedImageGenerator: any
let multimodalService: any
let syncService: any
let systemService: any
let emotionProcessor: any
let collaborationManager: any
let userService: any
let initWindowDockService: any
let getPluginSystem: any

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
let floatingCapsuleService: any = null
let trayService: any = null

// 导出mainWindow引用供其他模块使用
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

// 确保模块导出一个明确的对象，避免其他模块错误地导入
export default {
  getMainWindow
}

// API密钥存储路径
let apiKeysPath: string

// 确保API密钥文件存在
function ensureApiKeysFile() {
  if (!apiKeysPath) {
    apiKeysPath = path.join(app.getPath('userData'), 'apiKeys.json')
  }
  if (!fs.existsSync(apiKeysPath)) {
    fs.writeFileSync(apiKeysPath, JSON.stringify({}))
  }
}

// 创建主窗口
function createWindow() {
  console.log('[Main] createWindow called')
  try {
    console.log('[Main] Creating BrowserWindow...')
    mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,  // 立即显示
    backgroundColor: '#1e1e1e',  // 深色背景，与 IDE 主题匹配
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',  // macOS 风格的隐藏标题栏
    trafficLightPosition: { x: 12, y: 12 },  // 交通灯位置调整
    frame: false,  // 无框窗口
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !!isDev
    }
  })

  // 设置协作管理器的主窗口（如果已初始化）
  if (collaborationManager && collaborationManager.setMainWindow) {
    collaborationManager.setMainWindow(mainWindow)
  }
  
  // 设置更新服务的主窗口（如果已初始化）
  if (updateService && updateService.setMainWindow) {
    updateService.setMainWindow(mainWindow)
  }

  // 初始化窗口吸附服务（如果已初始化）
  if (initWindowDockService) {
    initWindowDockService(mainWindow)
  }

  // 初始化系统托盘服务（如果TrayService已初始化）
  if (TrayService) {
    trayService = new TrayService(mainWindow)
    trayService.initialize()
  }

  mainWindow.on('ready-to-show', () => {
    console.log('[Main] Window ready to show')
    mainWindow?.show()
  })

  // 监听渲染进程错误
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Main] Renderer failed to load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] Renderer crashed:', details.reason)
  })

  mainWindow.webContents.on('console-message', (_event, level, message, _line, _sourceId) => {
    const logLevels = ['verbose', 'info', 'warn', 'error']
    console.log(`[Renderer Console][${logLevels[level] || 'unknown'}] ${message}`)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Renderer finished loading')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-attach-webview', (_event, webContents) => {
    webContents.setWindowOpenHandler((details) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-new-window', {
          url: details.url,
          frameName: details.frameName
        })
      }
      return { action: 'deny' }
    })
  })

  // 加载URL
  if (isDev && !isDev) {
    console.log('[Main] Loading from dev server: http://localhost:5173')
    mainWindow.loadURL('http://localhost:5173')
  } else {
    const indexPath = join(__dirname, '../renderer/index.html')
    console.log('[Main] Loading renderer from:', indexPath)
    if (fs.existsSync(indexPath)) {
      console.log('[Main] Renderer file exists, loading...')
      mainWindow.loadFile(indexPath)
    } else {
      console.error('[Main] Renderer file NOT found:', indexPath)
    }
  }
    console.log('[Main] createWindow completed')
  } catch (error) {
    console.error('[Main] Error creating window:', error)
  }
}

// 应用生命周期
app.whenReady().then(async () => {
  // 现在electron.app已经初始化，可以安全导入这些模块
  const { electronApp: ea, optimizer: opt, is: isUtil } = await import('@electron-toolkit/utils')
  const { autoUpdater: au } = await import('electron-updater')
  
  electronApp = ea
  optimizer = opt
  is = isUtil
  autoUpdater = au
  isDev = is.dev
  
  // 动态导入所有服务单例
  const securityModule = await import('./security/SecurityManager')
  securityManager = securityModule.securityManager
  
  const taskStateManagerModule = await import('./agent/TaskStateManager')
  createTaskStateManager = taskStateManagerModule.createTaskStateManager
  
  const floatingCapsuleServiceModule = await import('./services/FloatingCapsuleService')
  FloatingCapsuleService = floatingCapsuleServiceModule.FloatingCapsuleService
  
  const trayServiceModule = await import('./services/TrayService')
  TrayService = trayServiceModule.TrayService
  
  const taskEngineModule = await import('./agent/TaskEngine')
  taskEngine = taskEngineModule.taskEngine
  
  const toolRegistryModule = await import('./agent/ToolRegistry')
  toolRegistry = toolRegistryModule.toolRegistry
  
  const galleryServiceModule = await import('./services/GalleryService')
  galleryService = galleryServiceModule.galleryService
  
  const safeCodeExecutionServiceModule = await import('./services/SafeCodeExecutionService')
  safeCodeExecutionService = safeCodeExecutionServiceModule.safeCodeExecutionService
  
  const updateServiceModule = await import('./services/UpdateService')
  updateService = updateServiceModule.updateService
  
  const backupServiceModule = await import('./services/BackupService')
  backupService = backupServiceModule.backupService
  
  const analyticsServiceModule = await import('./services/AnalyticsService')
  analyticsService = analyticsServiceModule.analyticsService
  
  const licenseServiceModule = await import('./services/LicenseService')
  licenseService = licenseServiceModule.licenseService
  
  const llmServiceModule = await import('./services/LLMService')
  llmService = llmServiceModule.llmService
  
  const modelServiceModule = await import('./services/ModelService')
  modelService = modelServiceModule.modelService
  
  const memoryServiceModule = await import('./services/MemoryService')
  memoryService = memoryServiceModule.memoryService
  
  const contextManagerModule = await import('./agent/ContextManager')
  contextManager = contextManagerModule.contextManager
  
  const skillManagerModule = await import('./agent/SkillManager')
  skillManager = skillManagerModule.skillManager
  
  const toolExecutionEngineModule = await import('./agent/ToolExecutionEngine')
  toolExecutionEngine = toolExecutionEngineModule.toolExecutionEngine
  
  const enhancedImageProcessorModule = await import('./services/EnhancedImageProcessor')
  enhancedImageProcessor = enhancedImageProcessorModule.enhancedImageProcessor
  
  const enhancedImageGeneratorModule = await import('./services/EnhancedImageGenerator')
  enhancedImageGenerator = enhancedImageGeneratorModule.enhancedImageGenerator
  
  const multimodalServiceModule = await import('./services/MultimodalService')
  multimodalService = multimodalServiceModule.multimodalService
  
  const syncServiceModule = await import('./services/SyncService')
  syncService = syncServiceModule.syncService
  
  const systemServiceModule = await import('./services/SystemService')
  systemService = systemServiceModule.systemService
  
  const emotionProcessorModule = await import('./agent/EmotionTypes')
  emotionProcessor = emotionProcessorModule.emotionProcessor
  
  const collaborationHandlerModule = await import('./ipc/handlers/collaborationHandler')
  collaborationManager = collaborationHandlerModule.collaborationManager
  
  const userServiceModule = await import('./services/UserService')
  userService = userServiceModule.userService
  
  const windowDockServiceModule = await import('./services/WindowDockService')
  initWindowDockService = windowDockServiceModule.initWindowDockService
  
  // 动态导入插件系统
  const pluginSystemModule = await import('./plugin-system')
  if (pluginSystemModule && pluginSystemModule.getPluginSystem) {
    getPluginSystem = pluginSystemModule.getPluginSystem
  } else {
    console.warn('[Main] Failed to load plugin system, using fallback')
    // 提供一个简单的fallback实现
    getPluginSystem = () => ({
      initialize: async () => console.log('[Fallback] Plugin system initialized'),
      getPluginManager: () => ({
        scanAndLoadPlugins: async () => {},
        getAllPluginIds: () => []
      }),
      getModuleDispatcher: () => ({
        loadModule: async () => false,
        executeModuleFunction: async () => {}
      })
    })
  }
  
  // 确保TaskStateManager被包含在构建中
  const _taskStateManager = createTaskStateManager()
  void _taskStateManager
  
  // 初始化悬浮胶囊服务
  floatingCapsuleService = new FloatingCapsuleService({
    size: 60,
    position: 'top-right',
    opacity: 0.8,
    shortcut: 'Alt+A'
  })
  
  // 注册 taskEngine 事件
  taskEngine.on('progress', (evt: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('task:progress', evt)
    }
  })
  
  const securityOptions = getRecommendedSecurityOptions()
  configureSecurity(securityOptions)
  
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
  
  // 初始化LLM服务
  console.log('初始化LLM服务...')
  llmService.initialize()
  
  // 初始化模型服务
  console.log('初始化模型服务...')
  modelService.initialize()
  
  // 初始化记忆服务
  console.log('初始化记忆服务...')
  memoryService.initialize()
  
  // 初始化上下文管理器
  console.log('初始化上下文管理器...')
  contextManager.initialize()
  
  // 初始化工具执行引擎
  console.log('初始化工具执行引擎...')
  toolExecutionEngine.initialize()
  
  // 初始化增强图像处理服务
  console.log('初始化增强图像处理服务...')
  try {
    await enhancedImageProcessor.initialize()
  } catch (error) {
    console.warn('[Main] EnhancedImageProcessor init failed:', error)
  }
  
  // 初始化增强图像生成服务
  console.log('初始化增强图像生成服务...')
  try {
    await enhancedImageGenerator.initialize()
  } catch (error) {
    console.warn('[Main] EnhancedImageGenerator init failed:', error)
  }
  
  // 初始化多模态服务
  console.log('初始化多模态服务...')
  try {
    await multimodalService.initialize()
  } catch (error) {
    console.warn('[Main] MultimodalService init failed:', error)
  }
  
  // 初始化同步服务
  console.log('初始化同步服务...')
  try {
    await syncService.initialize()
  } catch (error) {
    console.warn('[Main] SyncService init failed:', error)
  }
  
  // 初始化系统服务
  console.log('初始化系统服务...')
  systemService.initialize()
  
  // 初始化情绪处理器
  console.log('初始化情绪处理器...')
  emotionProcessor.initialize()
  
  // 初始化技能管理器
  console.log('初始化技能管理器...')
  skillManager.initialize()
  
  // 初始化图库服务
  console.log('初始化图库服务...')
  galleryService.initialize()
  
  // 初始化商业化服务（模拟模式下减少初始化）
  console.log('初始化商业化服务...')
  backupService.initialize()
  if (!isMockMode) {
    analyticsService.initialize()
    licenseService.initialize()
  }
  
  // 注册所有IPC处理器
  console.log('注册所有IPC处理器...')
  const ipcModule = await import('./ipc')
  ipcModule.registerAllHandlers()
  
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
  
  // 初始化插件系统
  console.log('初始化插件系统...')
  const pluginSystem = getPluginSystem()
  try {
    await pluginSystem.initialize()
  } catch (error) {
    console.error('[Main] Failed to initialize plugin system:', error)
  }
  
  // 初始化悬浮胶囊服务
  console.log('初始化悬浮胶囊服务...')
  await floatingCapsuleService.initialize()
  
  // 自动更新配置
  if (!isDev) {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'yourusername',
      repo: 'localized-agent-coder'
    })
    autoUpdater.checkForUpdatesAndNotify()
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
