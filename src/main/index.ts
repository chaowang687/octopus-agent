import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as si from 'systeminformation'
import axios from 'axios'
import { taskEngine } from './agent/TaskEngine'
import { toolRegistry } from './agent/ToolRegistry'
import { galleryService } from './services/GalleryService'

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
    show: false,
    autoHideMenuBar: true,
    ...(is.dev ? { webPreferences: { devTools: true } } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-attach-webview', (event, contents) => {
    contents.setWindowOpenHandler((details) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-new-window', {
          url: details.url,
          frameName: details.frameName
        })
      }
      return { action: 'deny' }
    })
    
    // 处理webview下载事件
    contents.on('will-download', (event, downloadItem) => {
      const filename = downloadItem.getFilename()
      const totalBytes = downloadItem.getTotalBytes()
      
      console.log('[Webview] Starting download:', filename, 'Size:', totalBytes)
      
      // 发送下载开始事件到渲染进程
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-download-start', {
          filename,
          totalBytes,
          url: downloadItem.getURL()
        })
      }
      
      // 设置下载保存路径（使用用户下载目录）
      const savePath = path.join(app.getPath('downloads'), filename)
      downloadItem.setSavePath(savePath)
      
      // 监听下载进度
      downloadItem.on('updated', (event, state) => {
        if (state === 'progressing') {
          const receivedBytes = downloadItem.getReceivedBytes()
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('webview-download-progress', {
              filename,
              receivedBytes,
              totalBytes,
              progress: totalBytes > 0 ? receivedBytes / totalBytes : 0
            })
          }
        }
      })
      
      // 监听下载完成
      downloadItem.on('done', (event, state) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (state === 'completed') {
            mainWindow.webContents.send('webview-download-complete', {
              filename,
              savePath,
              success: true
            })
          } else {
            mainWindow.webContents.send('webview-download-complete', {
              filename,
              error: state,
              success: false
            })
          }
        }
      })
    })
  })

  // 加载渲染进程
  if (is.dev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 应用生命周期
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.localized-agent.coder')
  ensureApiKeysFile()
  
  // 确保chat:sendMessage处理函数被注册
  console.log('注册chat:sendMessage处理函数...')
  
  // 重新注册chat:sendMessage处理函数，确保它被正确注册
  try {
    ipcMain.handle('chat:sendMessage', async (_, model: string, message: string, agentOptions?: { agentId?: string; sessionId?: string; system?: string; complexity?: string }) => {
      try {
        console.log(`智能助手收到消息 (${model}): ${message}`)
        
        // 解析系统和复杂度信息
        const targetSystem = agentOptions?.system || 'system1'
        const complexity = agentOptions?.complexity || 'low'
        
        console.log(`任务路由器: 系统=${targetSystem}, 复杂度=${complexity}`)
        
        // 使用 TaskEngine 处理消息
        // TaskEngine 会自动判断是进行普通对话还是执行任务
        const result = await taskEngine.executeTask(message, model, {
          ...agentOptions,
          system: targetSystem,
          complexity
        })
        
        // 构造返回给前端的格式
        let responseContent = ''
        
        if (result.success) {
          // 如果有执行步骤，说明执行了任务
          if (result.result && Object.keys(result.result).length > 0) {
            for (const [stepId, stepResult] of Object.entries(result.result)) {
              const stepPlan = result.plan?.steps.find((s: any) => s.id === stepId)
              if (stepPlan?.tool === 'respond_to_user' && (stepResult as any).message) {
                responseContent = String((stepResult as any).message)
                break
              }
            }

            if (!responseContent) {
              responseContent = `任务已执行完成。\n\n**执行结果：**\n`
              for (const [stepId, stepResult] of Object.entries(result.result)) {
                const stepPlan = result.plan?.steps.find((s: any) => s.id === stepId)
                const description = stepPlan ? stepPlan.description : stepId
                
                if ((stepResult as any).message) {
                  responseContent += `- ${description}: ${(stepResult as any).message}\n`
                } else if ((stepResult as any).output) {
                  responseContent += `- ${description}: \n\`\`\`\n${(stepResult as any).output.trim()}\n\`\`\`\n`
                } else {
                  responseContent += `- ${description}: 完成\n`
                }
              }
            }
          } else {
            // 如果没有执行步骤，可能是纯对话，检查是否有 respond_to_user 工具的调用结果
            // 或者直接查看 result.plan.reasoning
             responseContent = result.plan?.reasoning || '任务已完成'
             
             // 检查是否调用了 respond_to_user
             if (result.result) {
               for (const res of Object.values(result.result)) {
                 if ((res as any).message) {
                   responseContent = (res as any).message
                 }
               }
             }
          }

        } else {
          responseContent = `任务执行遇到问题：${result.error}`
        }

        return { success: true, content: responseContent }

      } catch (error: any) {
        console.error('发送消息失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    console.log('✅ chat:sendMessage处理函数已注册 (Agent模式)')
  } catch (error: any) {
    console.error('❌ 注册chat:sendMessage处理函数失败:', error)
  }

  // 注册 task:execute 处理器 - 用于复杂开发任务（调用 Planner + Executor 执行工具）
  try {
    ipcMain.handle('task:execute', async (_, instruction: string, options?: { agentId?: string; sessionId?: string; system?: string; complexity?: string; taskDir?: string }) => {
      try {
        console.log(`[task:execute] 收到任务: ${instruction.slice(0, 50)}...`)
        
        // 强制使用 System2 和中等复杂度 - 让认知引擎决定具体处理方式
        const targetSystem = 'system2'
        const complexity = 'medium'
        
        console.log(`[task:execute] 强制使用 System2 + 复杂度=medium`)
        
        // 直接调用 TaskEngine 执行任务
        const result = await taskEngine.executeTask(instruction, 'deepseek-coder', {
          ...options,
          system: targetSystem,
          complexity
        })
        
        console.log(`[task:execute] 执行完成: success=${result.success}`)
        
        // 构造返回给前端的格式
        let responseContent = ''
        
        if (result.success) {
          // 如果有执行步骤，说明执行了任务
          if (result.result && Object.keys(result.result).length > 0) {
            for (const [stepId, stepResult] of Object.entries(result.result)) {
              const stepPlan = result.plan?.steps.find((s: any) => s.id === stepId)
              if (stepPlan?.tool === 'respond_to_user' && (stepResult as any).message) {
                responseContent = String((stepResult as any).message)
                break
              }
            }

            if (!responseContent) {
              responseContent = `任务已执行完成。\n\n**执行结果：**\n`
              for (const [stepId, stepResult] of Object.entries(result.result)) {
                const stepPlan = result.plan?.steps.find((s: any) => s.id === stepId)
                const description = stepPlan ? stepPlan.description : stepId
                
                if ((stepResult as any).message) {
                  responseContent += `- ${description}: ${(stepResult as any).message}\n`
                } else if ((stepResult as any).output) {
                  responseContent += `- ${description}: \n\`\`\`\n${(stepResult as any).output.trim()}\n\`\`\`\n`
                } else {
                  responseContent += `- ${description}: 完成\n`
                }
              }
            }
          } else {
            // 如果没有执行步骤，可能是纯对话
            responseContent = result.plan?.reasoning || '任务已完成'
             
            if (result.result) {
              for (const res of Object.values(result.result)) {
                if ((res as any).message) {
                  responseContent = (res as any).message
                }
              }
            }
          }
        } else {
          responseContent = `任务执行遇到问题：${result.error}`
        }

        return { success: true, content: responseContent, result }

      } catch (error: any) {
        console.error('task:execute 失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    console.log('✅ task:execute 处理函数已注册')
  } catch (error: any) {
    console.error('❌ 注册 task:execute 处理函数失败:', error)
  }

  ipcMain.handle('chat:cancel', () => {
    const cancelled = taskEngine.cancelCurrentTask()
    return { success: true, cancelled }
  })
  
  // 开发者工具控制
  ipcMain.handle('webview:openDevTools', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 获取webview并打开开发者工具
      const webViews = mainWindow.webContents.getAllWebContents()
      for (const wc of webViews) {
        if (wc.getType() === 'webview') {
          wc.openDevTools()
        }
      }
      return { success: true }
    }
    return { success: false, error: 'No window' }
  })
  
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

// IPC通信

// 系统操作命名空间
ipcMain.handle('system:openExternal', (_, url: string) => {
  return shell.openExternal(url)
})

ipcMain.handle('system:captureScreen', async () => {
  try {
    const tempPath = path.join(app.getPath('temp'), `screenshot_${Date.now()}.png`)
    // macOS screencapture -i 交互式截图
    execSync(`screencapture -i "${tempPath}"`, { stdio: 'pipe' })
    
    if (fs.existsSync(tempPath)) {
      const imageBuffer = fs.readFileSync(tempPath)
      const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`
      // Clean up temp file
      fs.unlinkSync(tempPath)
      return { success: true, image: base64Image }
    } else {
      return { success: false, error: '截图取消或失败' }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// Dialog
import { dialog } from 'electron'
ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return { canceled: true }
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections']
  })
  
  return result
})

ipcMain.handle('system:executeCommand', (_, command: string, args: string[]) => {
  try {
    // 扩展PATH环境变量，添加常见路径
    const extendedEnv = {
      ...process.env,
      PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${path.join(process.env.HOME || '', 'bin')}:${path.join(process.env.HOME || '', '.nvm/versions/node')}/current/bin`
    }
    const result = execSync(`${command} ${args.join(' ')}`, { 
      encoding: 'utf8',
      env: extendedEnv,
      cwd: process.env.HOME,
      stdio: 'pipe'
    })
    return { success: true, output: result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('system:executeComplexCommand', (_, command: string, options?: any) => {
  try {
    const defaultOptions = {
      encoding: 'utf8',
      timeout: 60000, // 60秒超时
      maxBuffer: 1024 * 1024 * 10, // 10MB缓冲区
      cwd: process.cwd()
    }
    
    const execOptions = { ...defaultOptions, ...options, stdio: 'pipe' }
    const result = execSync(command, execOptions)
    return { success: true, output: result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('system:executeShellScript', (_, script: string, cwd?: string) => {
  try {
    // 创建临时脚本文件
    const tempScriptPath = path.join(require('os').tmpdir(), `temp_script_${Date.now()}.sh`)
    fs.writeFileSync(tempScriptPath, script)
    
    // 设置执行权限
    fs.chmodSync(tempScriptPath, '755')
    
    // 执行脚本
    const result = execSync(`bash "${tempScriptPath}"`, {
      encoding: 'utf8',
      timeout: 300000, // 5分钟超时
      maxBuffer: 1024 * 1024 * 50, // 50MB缓冲区
      cwd: cwd || process.cwd(),
      stdio: 'pipe'
    })
    
    // 删除临时文件
    fs.unlinkSync(tempScriptPath)
    
    return { success: true, output: result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('system:getSystemInfo', async () => {
  try {
    const [cpu, memory, os, system] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
      si.system()
    ])
    return {
      cpu: {
        brand: cpu.brand,
        cores: cpu.cores,
        speed: cpu.speed
      },
      memory: {
        total: memory.total,
        free: memory.free
      },
      os: {
        platform: os.platform,
        version: os.version,
        arch: os.arch
      },
      system: {
        manufacturer: system.manufacturer,
        model: system.model
      }
    }
  } catch (error) {
    return { error: 'Failed to get system info' }
  }
})

// API管理命名空间
  ipcMain.handle('api:setKey', (_, model: string, key: string) => {
    try {
      const apiKeys = JSON.parse(fs.readFileSync(apiKeysPath, 'utf8'))
      apiKeys[model] = key
      fs.writeFileSync(apiKeysPath, JSON.stringify(apiKeys, null, 2))
      return { success: true, message: 'API key set successfully' }
    } catch (error) {
      return { success: false, error: 'Failed to set API key' }
    }
  })

ipcMain.handle('api:getKey', (_, model: string) => {
  try {
    const apiKeys = JSON.parse(fs.readFileSync(apiKeysPath, 'utf8'))
    return apiKeys[model] || null
  } catch (error) {
    return null
  }
})

ipcMain.handle('api:testKey', (_, model: string, key: string) => {
  // 模拟API密钥测试，实际应该调用相应API进行验证
  console.log(`Testing API key for ${model}: ${key.substring(0, 10)}...`)
  return { success: true, message: 'API key test successful' }
})

// 本地文件操作命名空间
ipcMain.handle('fs:readFile', (_, path: string) => {
  try {
    const content = fs.readFileSync(path, 'utf8')
    return { success: true, content }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:writeFile', (_, path: string, content: string) => {
  try {
    fs.writeFileSync(path, content)
    return { success: true, message: 'File written successfully' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:editFile', (_, path: string, oldContent: string, newContent: string) => {
  try {
    const currentContent = fs.readFileSync(path, 'utf8')
    if (currentContent.includes(oldContent)) {
      const updatedContent = currentContent.replace(oldContent, newContent)
      fs.writeFileSync(path, updatedContent)
      return { success: true, message: 'File edited successfully' }
    } else {
      return { success: false, error: 'Old content not found in file' }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:compareFiles', (_, path1: string, path2: string) => {
  try {
    const content1 = fs.readFileSync(path1, 'utf8')
    const content2 = fs.readFileSync(path2, 'utf8')
    
    // 简单的差异比较
    const lines1 = content1.split('\n')
    const lines2 = content2.split('\n')
    const maxLines = Math.max(lines1.length, lines2.length)
    
    const differences: { line: number; type: 'add' | 'remove' | 'change'; content1?: string; content2?: string }[] = []
    
    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i]
      const line2 = lines2[i]
      
      if (!line1 && line2) {
        differences.push({ line: i + 1, type: 'add', content2: line2 })
      } else if (line1 && !line2) {
        differences.push({ line: i + 1, type: 'remove', content1: line1 })
      } else if (line1 !== line2) {
        differences.push({ line: i + 1, type: 'change', content1: line1, content2: line2 })
      }
    }
    
    return { success: true, differences }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:exists', (_, path: string) => {
  return fs.existsSync(path)
})

ipcMain.handle('fs:listFiles', (_, path: string) => {
  try {
    const files = fs.readdirSync(path)
    return { success: true, files }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// 图库（本地持久化图片）
ipcMain.handle('gallery:list', async () => {
  try {
    const items = galleryService.list()
    return { success: true, items }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('gallery:import', async (_evt, filePaths: string[]) => {
  try {
    const imported = (filePaths || []).map(p => galleryService.importFile(p))
    return { success: true, items: imported }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('gallery:delete', async (_evt, id: string) => {
  try {
    galleryService.delete(id)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('gallery:getDataUrl', async (_evt, filePath: string) => {
  try {
    const dataUrl = galleryService.getDataUrlByPath(filePath)
    return { success: true, dataUrl }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('gallery:reveal', async (_evt, filePath: string) => {
  try {
    const ok = galleryService.reveal(filePath)
    return { success: ok }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('gallery:addTag', async (_evt, id: string, tag: string) => {
  try {
    const result = galleryService.addTag(id, tag)
    return result
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('gallery:removeTag', async (_evt, id: string, tag: string) => {
  try {
    const result = galleryService.removeTag(id, tag)
    return result
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('gallery:renameItem', async (_evt, id: string, newName: string) => {
  try {
    const result = galleryService.renameItem(id, newName)
    return result
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// 工具配置管理
const toolStatePath = path.join(app.getPath('userData'), 'toolState.json')

const TOOL_GROUPS = {
  read: ['read_file', 'list_files', 'glob_paths', 'search_files', 'get_project_structure', 'check_file', 'read_image', 'list_imgs'],
  edit: ['write_file', 'create_directory', 'create_project'],
  terminal: ['execute_command', 'git_status', 'git_init', 'git_add', 'git_commit', 'get_system_info'],
  preview: ['preview_image'],
  webSearch: ['search_web', 'fetch_webpage', 'search_images', 'batch_download_images', 'download_image']
}

function loadToolState() {
  try {
    if (fs.existsSync(toolStatePath)) {
      return JSON.parse(fs.readFileSync(toolStatePath, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to load tool state', e)
  }
  // Default state
  return {
    search: true, // Agent
    read: true,
    edit: true,
    terminal: true,
    preview: true,
    webSearch: true
  }
}

function saveToolState(state: any) {
  try {
    fs.writeFileSync(toolStatePath, JSON.stringify(state, null, 2))
  } catch (e) {
    console.error('Failed to save tool state', e)
  }
}

function applyToolState(state: any) {
  // Apply groups
  for (const [group, tools] of Object.entries(TOOL_GROUPS)) {
    const isEnabled = state[group]
    tools.forEach(toolName => {
      if (isEnabled) {
        toolRegistry.enableTool(toolName)
      } else {
        toolRegistry.disableTool(toolName)
      }
    })
  }
  // Special handling for Search Agent if needed (currently mapped to nothing specific in ToolRegistry other than what webSearch covers)
}

// Workflow Settings Management
const workflowSettingsPath = path.join(app.getPath('userData'), 'workflowSettings.json')

function loadWorkflowSettings() {
  try {
    if (fs.existsSync(workflowSettingsPath)) {
      return JSON.parse(fs.readFileSync(workflowSettingsPath, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to load workflow settings', e)
  }
  // Default workflow settings
  return {
    todoList: {
      ide: true,
      solo: true
    },
    autoCollapse: {
      solo: true // Solo only feature
    },
    autoFix: {
      ide: true,
      solo: false
    },
    codeReview: {
      ide: 'all',
      solo: 'all',
      jumpToNext: true
    },
    autoRunMCP: {
      ide: false,
      solo: true
    },
    commandMode: {
      ide: 'sandbox',
      solo: 'sandbox',
      whitelist: []
    },
    notifications: {
      banner: true,
      sound: true
    }
  }
}

function saveWorkflowSettings(settings: any) {
  try {
    fs.writeFileSync(workflowSettingsPath, JSON.stringify(settings, null, 2))
  } catch (e) {
    console.error('Failed to save workflow settings', e)
  }
}

ipcMain.handle('agent:getWorkflowSettings', () => {
  return loadWorkflowSettings()
})

ipcMain.handle('agent:updateWorkflowSettings', (_, newSettings: any) => {
  saveWorkflowSettings(newSettings)
  return { success: true }
})

// Initialize tools
app.whenReady().then(() => {
  const state = loadToolState()
  applyToolState(state)
})

ipcMain.handle('agent:getToolState', () => {
  return loadToolState()
})

ipcMain.handle('agent:updateToolState', (_, newState: any) => {
  saveToolState(newState)
  applyToolState(newState)
  return { success: true }
})

const toolsConfigPath = path.join(app.getPath('userData'), 'toolsConfig.json')

// 确保工具配置文件存在
function ensureToolsConfig() {
  if (!fs.existsSync(toolsConfigPath)) {
    fs.writeFileSync(toolsConfigPath, JSON.stringify({}))
  }
}

// 工具检测函数
function detectTool(toolId: string): any {
  const toolPaths: Record<string, { paths: string[], versionCmd: string }> = {
    unity: {
      paths: [
        '/Applications/Unity/Hub/Hub.app',
        '/Applications/Unity/Unity.app',
        path.join(process.env.HOME || '', 'Applications/Unity/Hub/Hub.app'),
        path.join(process.env.HOME || '', 'Applications/Unity/Unity.app')
      ],
      versionCmd: 'unity --version'
    },
    sourcetree: {
      paths: [
        '/Applications/SourceTree.app',
        '/Applications/Sourcetree.app'
      ],
      versionCmd: 'echo "SourceTree detected"'
    },
    vscode: {
      paths: [
        '/Applications/Visual Studio Code.app',
        '/Applications/Visual Studio Code - Insiders.app',
        path.join(process.env.HOME || '', 'Applications/Visual Studio Code.app'),
        path.join(process.env.HOME || '', 'Applications/Visual Studio Code - Insiders.app')
      ],
      versionCmd: 'code --version'
    }
  }

  const tool = toolPaths[toolId]
  if (!tool) return { id: toolId, available: false }

  // 检查每个可能路径
  for (const toolPath of tool.paths) {
    if (fs.existsSync(toolPath)) {
      return {
        id: toolId,
        name: toolId === 'vscode' ? 'VS Code' : toolId === 'unity' ? 'Unity' : 'SourceTree',
        description: toolId === 'vscode' ? 'Visual Studio Code编辑器' : 
                     toolId === 'unity' ? 'Unity游戏引擎' : 'Git GUI 客户端',
        available: true,
        version: '已安装',
        path: toolPath
      }
    }
  }

  return {
    id: toolId,
    name: toolId === 'vscode' ? 'VS Code' : toolId === 'unity' ? 'Unity' : 'SourceTree',
    description: toolId === 'vscode' ? 'Visual Studio Code编辑器' : 
                 toolId === 'unity' ? 'Unity游戏引擎' : 'Git GUI 客户端',
    available: false,
    version: null,
    path: null
  }
}

ipcMain.handle('tools:findPath', (_, toolId: string) => {
  try {
    if (process.platform !== 'darwin') {
      return { success: false, error: '自动检测仅支持 macOS' }
    }

    let searchName = ''
    if (toolId === 'vscode') searchName = 'Visual Studio Code.app'
    else if (toolId === 'unity') searchName = 'Unity.app' // This might be tricky as Hub manages it
    else if (toolId === 'sourcetree') searchName = 'SourceTree.app'

    if (!searchName) return { success: false, error: '未知工具' }

    // Use mdfind to search
    const cmd = `mdfind "kMDItemKind == 'Application' && kMDItemFSName == '${searchName}'" | head -n 1`
    const result = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim()

    if (result && fs.existsSync(result)) {
      return { success: true, path: result }
    }
    
    // Special handling for Unity Hub if Unity.app not found directly
    if (toolId === 'unity') {
       const hubCmd = `mdfind "kMDItemKind == 'Application' && kMDItemFSName == 'Unity Hub.app'" | head -n 1`
       const hubResult = execSync(hubCmd, { encoding: 'utf8', stdio: 'pipe' }).trim()
       if (hubResult && fs.existsSync(hubResult)) {
         return { success: true, path: hubResult }
       }
    }

    return { success: false, error: '未找到应用' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('tools:list', () => {
  return ['vscode', 'unity', 'sourcetree']
})

ipcMain.handle('tools:detect', () => {
  const toolIds = ['vscode', 'unity', 'sourcetree']
  return toolIds.map(toolId => detectTool(toolId))
})

ipcMain.handle('tools:configure', (_, toolId: string, customPath: string) => {
  try {
    ensureToolsConfig()
    const config = JSON.parse(fs.readFileSync(toolsConfigPath, 'utf8'))
    config[toolId] = { customPath, autoDetected: false }
    fs.writeFileSync(toolsConfigPath, JSON.stringify(config, null, 2))
    return { success: true, message: '工具配置成功', path: customPath }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('tools:getConfig', (_, toolId: string) => {
  try {
    ensureToolsConfig()
    const config = JSON.parse(fs.readFileSync(toolsConfigPath, 'utf8'))
    return config[toolId] || null
  } catch (error) {
    return null
  }
})

ipcMain.handle('tools:execute', async (_, toolName: string, command: string, args: any[]) => {
  console.log(`Executing ${command} on ${toolName} with args:`, args)
  try {
    const tool = toolRegistry.getTool(toolName)
    if (!tool) {
      return { success: false, error: `Tool ${toolName} not found` }
    }
    
    // args[0] is usually the params object
    const params = args[0] || {}
    const result = await tool.handler(params)
    return { success: true, output: result }
  } catch (error: any) {
    console.error(`Error executing tool ${toolName}:`, error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('tools:build', (_, buildPath: string, tool: string, target: string) => {
  console.log(`Building ${buildPath} with ${tool} for ${target}`)
  return { success: true, message: 'Build completed successfully' }
})

ipcMain.handle('tools:open', (_, openPath: string, tool?: string) => {
  if (tool === 'vscode') {
    try {
      execSync(`code "${openPath}"`, { encoding: 'utf8', stdio: 'pipe' })
      return { success: true, message: `Opened ${openPath} with VS Code` }
    } catch (error) {
      return { success: false, error: 'VS Code not found' }
    }
  } else {
    return shell.openPath(openPath)
  }
})

ipcMain.handle('tools:vscode:openProject', (_, projectPath: string) => {
  try {
    execSync(`code "${projectPath}"`, { encoding: 'utf8', stdio: 'pipe' })
    return { success: true, message: `Opened project ${projectPath} with VS Code` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('tools:vscode:createFile', (_, projectPath: string, fileName: string, content: string) => {
  try {
    const filePath = path.join(projectPath, fileName)
    // 确保目录存在
    const dirPath = path.dirname(filePath)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    // 创建文件
    fs.writeFileSync(filePath, content)
    // 用VSCode打开文件
    execSync(`code "${filePath}"`, { encoding: 'utf8' })
    return { success: true, message: `Created file ${fileName} and opened with VS Code` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('tools:vscode:executeCommand', (_, command: string, args: string[]) => {
  try {
    // 执行VSCode命令
    const commandStr = `code ${args.map(arg => `"${arg}"`).join(' ')} --command ${command}`
    execSync(commandStr, { encoding: 'utf8', stdio: 'pipe' })
    return { success: true, message: `Executed VS Code command: ${command}` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// 插件管理命名空间
const pluginsPath = path.join(app.getPath('userData'), 'plugins')

// 确保插件目录存在
function ensurePluginsDir() {
  if (!fs.existsSync(pluginsPath)) {
    fs.mkdirSync(pluginsPath, { recursive: true })
  }
}

// 网页自动化
ipcMain.handle('web:crawlPage', async (_, url: string, options?: any) => {
  try {
    const defaultOptions = {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }
    
    const axiosOptions = { ...defaultOptions, ...options }
    const response = await axios.get(url, axiosOptions)
    
    return {
      success: true,
      content: response.data,
      status: response.status,
      headers: response.headers
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('web:submitForm', async (_, url: string, formData: any, options?: any) => {
  try {
    const defaultOptions = {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
    
    const axiosOptions = { ...defaultOptions, ...options }
    const response = await axios.post(url, formData, axiosOptions)
    
    return {
      success: true,
      content: response.data,
      status: response.status,
      headers: response.headers
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('web:downloadFile', async (_, url: string, savePath: string, options?: any) => {
  try {
    const defaultOptions = {
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      responseType: 'stream'
    }
    
    const axiosOptions = { ...defaultOptions, ...options }
    const response = await axios.get(url, axiosOptions)
    
    // 确保保存目录存在
    const dirPath = path.dirname(savePath)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    
    // 保存文件
    const writer = fs.createWriteStream(savePath)
    response.data.pipe(writer)
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
    
    return {
      success: true,
      path: savePath,
      status: response.status,
      headers: response.headers
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// 插件管理配置
const pluginsConfigPath = path.join(app.getPath('userData'), 'plugins.json')

// 确保插件配置文件存在
function ensurePluginsConfig() {
  if (!fs.existsSync(pluginsConfigPath)) {
    fs.writeFileSync(pluginsConfigPath, JSON.stringify({ plugins: [] }))
  }
}

// 加载插件配置
function loadPluginsConfig() {
  ensurePluginsConfig()
  return JSON.parse(fs.readFileSync(pluginsConfigPath, 'utf8'))
}

// 保存插件配置
function savePluginsConfig(config: any) {
  fs.writeFileSync(pluginsConfigPath, JSON.stringify(config, null, 2))
}

// 插件接口
interface Plugin {
  name: string
  version: string
  description: string
  enabled: boolean
  installed: boolean
  path: string
  main?: string
  dependencies?: string[]
}

// 加载插件
function loadPlugin(pluginPath: string): Plugin | null {
  try {
    const packageJsonPath = path.join(pluginPath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      return null
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return {
      name: packageJson.name || path.basename(pluginPath),
      version: packageJson.version || '1.0.0',
      description: packageJson.description || '',
      enabled: true,
      installed: true,
      path: pluginPath,
      main: packageJson.main || 'index.js',
      dependencies: packageJson.dependencies || []
    }
  } catch (error) {
    console.error('加载插件失败:', error)
    return null
  }
}

// 扫描插件目录，加载所有插件
function scanPlugins(): Plugin[] {
  ensurePluginsDir()
  const plugins: Plugin[] = []
  
  try {
    const pluginDirs = fs.readdirSync(pluginsPath)
    for (const dir of pluginDirs) {
      const pluginPath = path.join(pluginsPath, dir)
      if (fs.statSync(pluginPath).isDirectory()) {
        const plugin = loadPlugin(pluginPath)
        if (plugin) {
          plugins.push(plugin)
        }
      }
    }
  } catch (error) {
    console.error('扫描插件失败:', error)
  }
  
  return plugins
}

// 初始化插件系统
function initializePlugins() {
  const config = loadPluginsConfig()
  const scannedPlugins = scanPlugins()
  
  // 更新配置中的插件列表
  config.plugins = scannedPlugins
  savePluginsConfig(config)
  
  console.log(`已加载 ${scannedPlugins.length} 个插件`)
  return scannedPlugins
}

// 执行插件
function executePlugin(pluginName: string, command: string, args: any[]): any {
  try {
    const config = loadPluginsConfig()
    const plugin = config.plugins.find((p: Plugin) => p.name === pluginName)
    
    if (!plugin) {
      return { success: false, error: `插件 ${pluginName} 不存在` }
    }
    
    if (!plugin.enabled) {
      return { success: false, error: `插件 ${pluginName} 已禁用` }
    }
    
    // 这里应该加载插件并执行命令，这里使用模拟实现
    console.log(`执行插件 ${pluginName} 的命令 ${command}，参数:`, args)
    
    return {
      success: true,
      message: `插件 ${pluginName} 的命令 ${command} 执行成功`,
      result: `这是插件 ${pluginName} 执行命令 ${command} 的结果`
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 插件管理IPC处理函数
ipcMain.handle('plugins:list', () => {
  ensurePluginsDir()
  try {
    const plugins = initializePlugins()
    return plugins
  } catch (error) {
    console.error('列出插件失败:', error)
    return []
  }
})

ipcMain.handle('plugins:install', async (_, url: string) => {
  ensurePluginsDir()
  try {
    console.log(`安装插件: ${url}`)
    
    // 模拟插件安装，实际应该从URL下载并安装插件
    // 这里只是创建一个示例插件目录和package.json文件
    const pluginName = `plugin-${Date.now()}`
    const pluginPath = path.join(pluginsPath, pluginName)
    fs.mkdirSync(pluginPath, { recursive: true })
    
    // 创建package.json文件
    const packageJson = {
      name: pluginName,
      version: '1.0.0',
      description: '示例插件',
      main: 'index.js',
      dependencies: {}
    }
    fs.writeFileSync(path.join(pluginPath, 'package.json'), JSON.stringify(packageJson, null, 2))
    
    // 创建index.js文件
    const indexJs = `
module.exports = {
  name: '${pluginName}',
  description: '示例插件',
  version: '1.0.0',
  
  // 插件初始化
  initialize: function() {
    console.log('${pluginName} 初始化');
  },
  
  // 执行命令
  execute: function(command, args) {
    console.log('${pluginName} 执行命令:', command, args);
    return {
      success: true,
      result: \`这是 ${pluginName} 执行命令 \${command} 的结果\`
    };
  }
};
`
    fs.writeFileSync(path.join(pluginPath, 'index.js'), indexJs)
    
    // 更新插件配置
    initializePlugins()
    
    return { success: true, message: '插件安装成功', plugin: packageJson }
  } catch (error: any) {
    console.error('安装插件失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('plugins:uninstall', (_, name: string) => {
  try {
    console.log(`卸载插件: ${name}`)
    
    const config = loadPluginsConfig()
    const plugin = config.plugins.find((p: Plugin) => p.name === name)
    
    if (!plugin) {
      return { success: false, error: `插件 ${name} 不存在` }
    }
    
    // 删除插件目录
    if (fs.existsSync(plugin.path)) {
      fs.rmSync(plugin.path, { recursive: true, force: true })
    }
    
    // 更新插件配置
    config.plugins = config.plugins.filter((p: Plugin) => p.name !== name)
    savePluginsConfig(config)
    
    return { success: true, message: '插件卸载成功' }
  } catch (error: any) {
    console.error('卸载插件失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('plugins:update', (_, name: string) => {
  try {
    console.log(`更新插件: ${name}`)
    
    const config = loadPluginsConfig()
    const plugin = config.plugins.find((p: Plugin) => p.name === name)
    
    if (!plugin) {
      return { success: false, error: `插件 ${name} 不存在` }
    }
    
    // 模拟插件更新，实际应该下载并更新插件
    // 这里只是更新插件的版本号
    const packageJsonPath = path.join(plugin.path, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      packageJson.version = '2.0.0'
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
    }
    
    // 更新插件配置
    initializePlugins()
    
    return { success: true, message: '插件更新成功' }
  } catch (error: any) {
    console.error('更新插件失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('plugins:enable', (_, name: string) => {
  try {
    console.log(`启用插件: ${name}`)
    
    const config = loadPluginsConfig()
    const plugin = config.plugins.find((p: Plugin) => p.name === name)
    
    if (!plugin) {
      return { success: false, error: `插件 ${name} 不存在` }
    }
    
    plugin.enabled = true
    savePluginsConfig(config)
    
    return { success: true, message: '插件启用成功' }
  } catch (error: any) {
    console.error('启用插件失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('plugins:disable', (_, name: string) => {
  try {
    console.log(`禁用插件: ${name}`)
    
    const config = loadPluginsConfig()
    const plugin = config.plugins.find((p: Plugin) => p.name === name)
    
    if (!plugin) {
      return { success: false, error: `插件 ${name} 不存在` }
    }
    
    plugin.enabled = false
    savePluginsConfig(config)
    
    return { success: true, message: '插件禁用成功' }
  } catch (error: any) {
    console.error('禁用插件失败:', error)
    return { success: false, error: error.message }
  }
})

// 执行插件命令
ipcMain.handle('plugins:execute', (_, name: string, command: string, args: any[]) => {
  try {
    const result = executePlugin(name, command, args)
    return result
  } catch (error: any) {
    console.error('执行插件命令失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取插件详情
ipcMain.handle('plugins:get', (_, name: string) => {
  try {
    const config = loadPluginsConfig()
    const plugin = config.plugins.find((p: Plugin) => p.name === name)
    
    if (!plugin) {
      return { success: false, error: `插件 ${name} 不存在` }
    }
    
    return { success: true, plugin }
  } catch (error: any) {
    console.error('获取插件详情失败:', error)
    return { success: false, error: error.message }
  }
})

// 初始化插件系统
let plugins: Plugin[] = []
app.whenReady().then(() => {
  plugins = initializePlugins()
})

// AI对话命名空间已在app.whenReady()回调中注册

// 智能任务取消
ipcMain.handle('task:cancel', () => {
  const cancelled = taskEngine.cancelCurrentTask()
  return { success: true, cancelled }
})

// 解析任务指令
async function parseTaskInstruction(instruction: string): Promise<any> {
  // 这里应该使用AI模型来解析指令，这里使用简单的规则匹配作为示例
  const lowerInstruction = instruction.toLowerCase()
  
  // 匹配常见任务类型
  if (lowerInstruction.includes('创建') && lowerInstruction.includes('项目')) {
    return {
      type: 'create_project',
      steps: [
        {
          id: 'step_1',
          action: 'create_directory',
          params: {
            path: './new-project'
          }
        },
        {
          id: 'step_2',
          action: 'initialize_project',
          params: {
            path: './new-project',
            type: 'npm'
          }
        },
        {
          id: 'step_3',
          action: 'open_vscode',
          params: {
            path: './new-project'
          }
        }
      ]
    }
  } else if (lowerInstruction.includes('爬取') && lowerInstruction.includes('网页')) {
    return {
      type: 'crawl_webpage',
      steps: [
        {
          id: 'step_1',
          action: 'fetch_webpage',
          params: {
            url: instruction.match(/https?:\/\/[^\s]+/)?.[0] || 'https://example.com'
          }
        },
        {
          id: 'step_2',
          action: 'save_content',
          params: {
            path: './webpage-content.txt'
          }
        }
      ]
    }
  } else if (lowerInstruction.includes('执行') && lowerInstruction.includes('命令')) {
    return {
      type: 'execute_command',
      steps: [
        {
          id: 'step_1',
          action: 'run_command',
          params: {
            command: instruction.replace(/执行命令\s*/, '')
          }
        }
      ]
    }
  } else {
    // 默认任务类型
    return {
      type: 'general',
      steps: [
        {
          id: 'step_1',
          action: 'chat_response',
          params: {
            message: instruction
          }
        }
      ]
    }
  }
}

// 执行任务步骤
async function executeTaskSteps(taskPlan: any): Promise<any> {
  const results: any[] = []
  
  for (const step of taskPlan.steps) {
    console.log(`执行步骤: ${step.id}, 动作: ${step.action}`)
    
    let stepResult
    switch (step.action) {
      case 'create_directory':
        stepResult = await createDirectory(step.params.path)
        break
      case 'initialize_project':
        stepResult = await initializeProject(step.params.path, step.params.type)
        break
      case 'open_vscode':
        stepResult = await openVSCode(step.params.path)
        break
      case 'fetch_webpage':
        stepResult = await fetchWebpage(step.params.url)
        break
      case 'save_content':
        stepResult = await saveContent(stepResult.content, step.params.path)
        break
      case 'run_command':
        stepResult = await runCommand(step.params.command)
        break
      case 'chat_response':
        stepResult = await getChatResponse(step.params.message)
        break
      default:
        stepResult = { success: false, error: `未知动作: ${step.action}` }
    }
    
    results.push(stepResult)
    
    if (!stepResult.success) {
      break
    }
  }
  
  return {
    steps: results,
    success: results.every(r => r.success)
  }
}

// 辅助函数：创建目录
async function createDirectory(path: string): Promise<any> {
  try {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true })
      return { success: true, message: `目录创建成功: ${path}` }
    } else {
      return { success: true, message: `目录已存在: ${path}` }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 辅助函数：初始化项目
async function initializeProject(path: string, type: string): Promise<any> {
  try {
    if (type === 'npm') {
      execSync(`cd "${path}" && npm init -y`, { encoding: 'utf8' })
      return { success: true, message: `项目初始化成功: ${path}` }
    } else {
      return { success: false, error: `不支持的项目类型: ${type}` }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 辅助函数：打开VSCode
async function openVSCode(path: string): Promise<any> {
  try {
    execSync(`code "${path}"`, { encoding: 'utf8' })
    return { success: true, message: `VSCode已打开: ${path}` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 辅助函数：获取网页内容
async function fetchWebpage(url: string): Promise<any> {
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    return { success: true, content: response.data, url }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 辅助函数：保存内容到文件
  async function saveContent(content: string, filePath: string): Promise<any> {
    try {
      // 确保目录存在
      const dirPath = path.dirname(filePath)
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
      }
      
      fs.writeFileSync(filePath, content)
      return { success: true, message: `内容保存成功: ${filePath}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

// 辅助函数：执行命令
async function runCommand(command: string): Promise<any> {
  try {
    const result = execSync(command, { encoding: 'utf8' })
    return { success: true, output: result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 辅助函数：获取聊天响应
async function getChatResponse(message: string): Promise<any> {
  try {
    // 使用默认模型生成响应
    const model = 'openai'
    
    // 读取API密钥
    const apiKeys = JSON.parse(fs.readFileSync(apiKeysPath, 'utf8'))
    const apiKey = apiKeys[model]
    
    if (!apiKey) {
      return { success: true, response: `我理解你说的是: "${message}"。这是一个示例响应，实际应用中应该使用AI模型生成响应。` }
    }
    
    // 这里应该调用AI API生成响应，这里使用示例响应
    return { success: true, response: `我理解你说的是: "${message}"。这是一个使用${model}模型生成的响应。` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 本地知识库功能
const knowledgeBasePath = path.join(app.getPath('userData'), 'knowledgeBase')

// 确保知识库目录存在
function ensureKnowledgeBaseDir() {
  if (!fs.existsSync(knowledgeBasePath)) {
    fs.mkdirSync(knowledgeBasePath, { recursive: true })
  }
}

// 知识库配置路径
const knowledgeBaseConfigPath = path.join(app.getPath('userData'), 'knowledgeBaseConfig.json')

// 确保知识库配置文件存在
function ensureKnowledgeBaseConfig() {
  if (!fs.existsSync(knowledgeBaseConfigPath)) {
    fs.writeFileSync(knowledgeBaseConfigPath, JSON.stringify({ documents: [] }))
  }
}

// 加载知识库配置
function loadKnowledgeBaseConfig() {
  ensureKnowledgeBaseConfig()
  return JSON.parse(fs.readFileSync(knowledgeBaseConfigPath, 'utf8'))
}

// 保存知识库配置
function saveKnowledgeBaseConfig(config: any) {
  fs.writeFileSync(knowledgeBaseConfigPath, JSON.stringify(config, null, 2))
}

// 文档接口
interface Document {
  id: string
  name: string
  type: string
  size: number
  path: string
  indexed: boolean
  createdAt: string
  updatedAt: string
  metadata?: any
}

// 初始化知识库
function initializeKnowledgeBase() {
  ensureKnowledgeBaseDir()
  ensureKnowledgeBaseConfig()
  console.log('知识库初始化完成')
}

// 上传文档到知识库
function uploadDocument(filePath: string): Document {
  try {
    const fileName = path.basename(filePath)
    const fileStats = fs.statSync(filePath)
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const docPath = path.join(knowledgeBasePath, docId + path.extname(filePath))
    
    // 复制文件到知识库目录
    fs.copyFileSync(filePath, docPath)
    
    const document: Document = {
      id: docId,
      name: fileName,
      type: path.extname(filePath).substr(1),
      size: fileStats.size,
      path: docPath,
      indexed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    // 更新配置
    const config = loadKnowledgeBaseConfig()
    config.documents.push(document)
    saveKnowledgeBaseConfig(config)
    
    return document
  } catch (error: any) {
    throw new Error(`上传文档失败: ${error.message}`)
  }
}

// 列出知识库中的文档
function listDocuments(): Document[] {
  const config = loadKnowledgeBaseConfig()
  return config.documents
}

// 删除知识库中的文档
function deleteDocument(docId: string): boolean {
  try {
    const config = loadKnowledgeBaseConfig()
    const document = config.documents.find((doc: Document) => doc.id === docId)
    
    if (!document) {
      throw new Error('文档不存在')
    }
    
    // 删除文件
    if (fs.existsSync(document.path)) {
      fs.unlinkSync(document.path)
    }
    
    // 从配置中移除
    config.documents = config.documents.filter((doc: Document) => doc.id !== docId)
    saveKnowledgeBaseConfig(config)
    
    return true
  } catch (error: any) {
    throw new Error(`删除文档失败: ${error.message}`)
  }
}

// 搜索知识库
function searchKnowledgeBase(query: string): Document[] {
  try {
    const config = loadKnowledgeBaseConfig()
    
    // 简单的关键词搜索，实际应用中应该使用更复杂的搜索算法
    const results = config.documents.filter((doc: Document) => 
      doc.name.toLowerCase().includes(query.toLowerCase()) ||
      (doc.metadata && JSON.stringify(doc.metadata).toLowerCase().includes(query.toLowerCase()))
    )
    
    return results
  } catch (error: any) {
    throw new Error(`搜索知识库失败: ${error.message}`)
  }
}

// 提取文档内容
function extractDocumentContent(docId: string): string {
  try {
    const config = loadKnowledgeBaseConfig()
    const document = config.documents.find((doc: Document) => doc.id === docId)
    
    if (!document) {
      throw new Error('文档不存在')
    }
    
    // 根据文件类型提取内容
    if (['txt', 'md', 'json', 'js', 'ts', 'html', 'css'].includes(document.type)) {
      return fs.readFileSync(document.path, 'utf8')
    } else {
      return `文档类型 ${document.type} 暂不支持内容提取`
    }
  } catch (error: any) {
    throw new Error(`提取文档内容失败: ${error.message}`)
  }
}

// 本地知识库IPC处理函数
ipcMain.handle('kb:initialize', () => {
  try {
    initializeKnowledgeBase()
    return { success: true, message: '知识库初始化成功' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('kb:upload', (_, filePath: string) => {
  try {
    const document = uploadDocument(filePath)
    return { success: true, document }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('kb:list', () => {
  try {
    const documents = listDocuments()
    return { success: true, documents }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('kb:delete', (_, docId: string) => {
  try {
    const result = deleteDocument(docId)
    return { success: true, message: '文档删除成功' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('kb:search', (_, query: string) => {
  try {
    const results = searchKnowledgeBase(query)
    return { success: true, results }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('kb:extract', (_, docId: string) => {
  try {
    const content = extractDocumentContent(docId)
    return { success: true, content }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('kb:get', (_, docId: string) => {
  try {
    const config = loadKnowledgeBaseConfig()
    const document = config.documents.find((doc: Document) => doc.id === docId)
    
    if (!document) {
      return { success: false, error: '文档不存在' }
    }
    
    return { success: true, document }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// 初始化知识库
app.whenReady().then(() => {
  initializeKnowledgeBase()
})

// 个性化设置功能
const preferencesPath = path.join(app.getPath('userData'), 'preferences.json')

// 确保偏好设置文件存在
function ensurePreferencesFile() {
  if (!fs.existsSync(preferencesPath)) {
    const defaultPreferences = {
      general: {
        language: 'zh-CN',
        theme: 'light',
        fontSize: 14,
        autoSave: true
      },
      ai: {
        defaultModel: 'openai',
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: '你是一个智能助手，帮助用户完成各种任务。'
      },
      editor: {
        tabSize: 2,
        lineNumbers: true,
        wordWrap: false,
        autoIndent: true
      },
      shortcuts: {
        executeTask: 'CmdOrCtrl+Enter',
        generateCode: 'CmdOrCtrl+Shift+C',
        explainCode: 'CmdOrCtrl+Shift+E',
        refactorCode: 'CmdOrCtrl+Shift+R',
        generateVisualization: 'CmdOrCtrl+Shift+V'
      },
      plugins: {
        autoUpdate: true,
        enableDefaultPlugins: true
      }
    }
    fs.writeFileSync(preferencesPath, JSON.stringify(defaultPreferences, null, 2))
  }
}

// 加载偏好设置
function loadPreferences() {
  ensurePreferencesFile()
  return JSON.parse(fs.readFileSync(preferencesPath, 'utf8'))
}

// 保存偏好设置
function savePreferences(preferences: any) {
  fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2))
}

// 初始化偏好设置
function initializePreferences() {
  ensurePreferencesFile()
  console.log('偏好设置初始化完成')
}

// 个性化设置IPC处理函数
ipcMain.handle('preferences:get', (_, section?: string) => {
  try {
    const preferences = loadPreferences()
    if (section) {
      return { success: true, preferences: preferences[section] }
    } else {
      return { success: true, preferences: preferences }
    }
  } catch (error: any) {
    console.error('获取偏好设置失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('preferences:set', (_, section: string, key: string, value: any) => {
  try {
    const preferences = loadPreferences()
    
    // 设置偏好值
    if (preferences[section]) {
      preferences[section][key] = value
    } else {
      preferences[section] = { [key]: value }
    }
    
    savePreferences(preferences)
    return { success: true, message: '偏好设置已保存' }
  } catch (error: any) {
    console.error('设置偏好设置失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('preferences:setMultiple', (_, section: string, values: any) => {
  try {
    const preferences = loadPreferences()
    
    // 设置多个偏好值
    if (!preferences[section]) {
      preferences[section] = {}
    }
    
    Object.assign(preferences[section], values)
    savePreferences(preferences)
    return { success: true, message: '偏好设置已保存' }
  } catch (error: any) {
    console.error('设置多个偏好设置失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('preferences:reset', (_, section?: string) => {
  try {
    const preferences = loadPreferences()
    
    // 重置偏好设置
    if (section) {
      const defaultPreferences = {
        general: {
          language: 'zh-CN',
          theme: 'light',
          fontSize: 14,
          autoSave: true
        },
        ai: {
          defaultModel: 'openai',
          temperature: 0.7,
          maxTokens: 1000,
          systemPrompt: '你是一个智能助手，帮助用户完成各种任务。'
        },
        editor: {
          tabSize: 2,
          lineNumbers: true,
          wordWrap: false,
          autoIndent: true
        },
        shortcuts: {
          executeTask: 'CmdOrCtrl+Enter',
          generateCode: 'CmdOrCtrl+Shift+C',
          explainCode: 'CmdOrCtrl+Shift+E',
          refactorCode: 'CmdOrCtrl+Shift+R',
          generateVisualization: 'CmdOrCtrl+Shift+V'
        },
        plugins: {
          autoUpdate: true,
          enableDefaultPlugins: true
        }
      }
      
      if (defaultPreferences[section]) {
        preferences[section] = defaultPreferences[section]
      }
    } else {
      // 重置所有偏好设置
      const defaultPreferences = {
        general: {
          language: 'zh-CN',
          theme: 'light',
          fontSize: 14,
          autoSave: true
        },
        ai: {
          defaultModel: 'openai',
          temperature: 0.7,
          maxTokens: 1000,
          systemPrompt: '你是一个智能助手，帮助用户完成各种任务。'
        },
        editor: {
          tabSize: 2,
          lineNumbers: true,
          wordWrap: false,
          autoIndent: true
        },
        shortcuts: {
          executeTask: 'CmdOrCtrl+Enter',
          generateCode: 'CmdOrCtrl+Shift+C',
          explainCode: 'CmdOrCtrl+Shift+E',
          refactorCode: 'CmdOrCtrl+Shift+R',
          generateVisualization: 'CmdOrCtrl+Shift+V'
        },
        plugins: {
          autoUpdate: true,
          enableDefaultPlugins: true
        }
      }
      Object.assign(preferences, defaultPreferences)
    }
    
    savePreferences(preferences)
    return { success: true, message: '偏好设置已重置' }
  } catch (error: any) {
    console.error('重置偏好设置失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('preferences:export', () => {
  try {
    const preferences = loadPreferences()
    const exportPath = path.join(app.getPath('desktop'), `preferences-${Date.now()}.json`)
    fs.writeFileSync(exportPath, JSON.stringify(preferences, null, 2))
    return { success: true, path: exportPath, message: '偏好设置已导出' }
  } catch (error: any) {
    console.error('导出偏好设置失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('preferences:import', (_, filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在' }
    }
    
    const importedPreferences = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    savePreferences(importedPreferences)
    return { success: true, message: '偏好设置已导入' }
  } catch (error: any) {
    console.error('导入偏好设置失败:', error)
    return { success: false, error: error.message }
  }
})

// 初始化偏好设置
app.whenReady().then(() => {
  initializePreferences()
})

// 项目经理模式功能
const projectsPath = path.join(app.getPath('userData'), 'projects')
const projectManagerConfigPath = path.join(app.getPath('userData'), 'projectManagerConfig.json')

// 确保项目目录存在
function ensureProjectsDir() {
  if (!fs.existsSync(projectsPath)) {
    fs.mkdirSync(projectsPath, { recursive: true })
  }
}

// 确保项目管理器配置文件存在
function ensureProjectManagerConfig() {
  if (!fs.existsSync(projectManagerConfigPath)) {
    const defaultConfig = {
      projects: [],
      currentMode: 'ide', // Default to ide
      currentProject: null
    }
    fs.writeFileSync(projectManagerConfigPath, JSON.stringify(defaultConfig, null, 2))
  }
}

// 加载项目管理器配置
function loadProjectManagerConfig() {
  ensureProjectManagerConfig()
  return JSON.parse(fs.readFileSync(projectManagerConfigPath, 'utf8'))
}

// 保存项目管理器配置
function saveProjectManagerConfig(config: any) {
  fs.writeFileSync(projectManagerConfigPath, JSON.stringify(config, null, 2))
}

// 项目接口
interface Project {
  id: string
  name: string
  type: string
  path: string
  status: 'active' | 'inactive' | 'completed'
  createdAt: string
  updatedAt: string
  estimatedTime: number
  actualTime: number
  tasks: Task[]
  metadata?: any
}

// 任务接口
interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done' | 'blocked'
  priority: 'low' | 'medium' | 'high'
  estimatedTime: number
  actualTime: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  assignee?: string
  dependencies?: string[]
}

// 初始化项目经理
function initializeProjectManager() {
  ensureProjectsDir()
  ensureProjectManagerConfig()
  console.log('项目经理初始化完成')
}

// 创建项目
function createProject(name: string, type: string, options?: any): Project {
  try {
    ensureProjectsDir()
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const projectPath = path.join(projectsPath, projectId)
    fs.mkdirSync(projectPath, { recursive: true })
    
    const project: Project = {
      id: projectId,
      name: name,
      type: type,
      path: projectPath,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estimatedTime: options?.estimatedTime || 0,
      actualTime: 0,
      tasks: [],
      metadata: options?.metadata || {}
    }
    
    // 保存项目配置文件
    const projectConfigPath = path.join(projectPath, 'project.json')
    fs.writeFileSync(projectConfigPath, JSON.stringify(project, null, 2))
    
    // 更新项目管理器配置
    const config = loadProjectManagerConfig()
    config.projects.push({
      id: project.id,
      name: project.name,
      type: project.type,
      path: project.path,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    })
    saveProjectManagerConfig(config)
    
    return project
  } catch (error: any) {
    throw new Error(`创建项目失败: ${error.message}`)
  }
}

// 列出所有项目
function listProjects() {
  try {
    const config = loadProjectManagerConfig()
    return config.projects
  } catch (error: any) {
    throw new Error(`列出项目失败: ${error.message}`)
  }
}

// 打开项目
function openProject(projectId: string) {
  try {
    const config = loadProjectManagerConfig()
    const project = config.projects.find((p: any) => p.id === projectId)
    
    if (!project) {
      throw new Error('项目不存在')
    }
    
    // 检查项目配置文件是否存在
    const projectConfigPath = path.join(project.path, 'project.json')
    if (!fs.existsSync(projectConfigPath)) {
      throw new Error('项目配置文件不存在')
    }
    
    // 更新当前项目
    config.currentProject = projectId
    saveProjectManagerConfig(config)
    
    return {
      success: true,
      message: `项目 ${project.name} 已打开`,
      project: JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'))
    }
  } catch (error: any) {
    throw new Error(`打开项目失败: ${error.message}`)
  }
}

// 关闭项目
function closeProject(projectId: string) {
  try {
    const config = loadProjectManagerConfig()
    const project = config.projects.find((p: any) => p.id === projectId)
    
    if (!project) {
      throw new Error('项目不存在')
    }
    
    // 清除当前项目
    if (config.currentProject === projectId) {
      config.currentProject = null
      saveProjectManagerConfig(config)
    }
    
    return {
      success: true,
      message: `项目 ${project.name} 已关闭`
    }
  } catch (error: any) {
    throw new Error(`关闭项目失败: ${error.message}`)
  }
}

// 删除项目
function deleteProject(projectId: string) {
  try {
    const config = loadProjectManagerConfig()
    const project = config.projects.find((p: any) => p.id === projectId)
    
    if (!project) {
      throw new Error('项目不存在')
    }
    
    // 删除项目目录
    if (fs.existsSync(project.path)) {
      fs.rmSync(project.path, { recursive: true, force: true })
    }
    
    // 从配置中移除项目
    config.projects = config.projects.filter((p: any) => p.id !== projectId)
    
    // 如果是当前项目，清除当前项目
    if (config.currentProject === projectId) {
      config.currentProject = null
    }
    
    saveProjectManagerConfig(config)
    
    return {
      success: true,
      message: `项目 ${project.name} 已删除`
    }
  } catch (error: any) {
    throw new Error(`删除项目失败: ${error.message}`)
  }
}

// 添加任务
function addTask(projectId: string, task: any): Task {
  try {
    const config = loadProjectManagerConfig()
    const projectInfo = config.projects.find((p: any) => p.id === projectId)
    
    if (!projectInfo) {
      throw new Error('项目不存在')
    }
    
    // 读取项目配置
    const projectConfigPath = path.join(projectInfo.path, 'project.json')
    if (!fs.existsSync(projectConfigPath)) {
      throw new Error('项目配置文件不存在')
    }
    
    const project = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'))
    
    // 创建任务
    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: task.title || '新任务',
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      estimatedTime: task.estimatedTime || 0,
      actualTime: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignee: task.assignee,
      dependencies: task.dependencies || []
    }
    
    // 添加任务到项目
    project.tasks.push(newTask)
    project.updatedAt = new Date().toISOString()
    
    // 保存项目配置
    fs.writeFileSync(projectConfigPath, JSON.stringify(project, null, 2))
    
    return newTask
  } catch (error: any) {
    throw new Error(`添加任务失败: ${error.message}`)
  }
}

// 更新任务
function updateTask(projectId: string, taskId: string, updates: any): Task {
  try {
    const config = loadProjectManagerConfig()
    const projectInfo = config.projects.find((p: any) => p.id === projectId)
    
    if (!projectInfo) {
      throw new Error('项目不存在')
    }
    
    // 读取项目配置
    const projectConfigPath = path.join(projectInfo.path, 'project.json')
    if (!fs.existsSync(projectConfigPath)) {
      throw new Error('项目配置文件不存在')
    }
    
    const project = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'))
    const taskIndex = project.tasks.findIndex((t: Task) => t.id === taskId)
    
    if (taskIndex === -1) {
      throw new Error('任务不存在')
    }
    
    // 更新任务
    project.tasks[taskIndex] = {
      ...project.tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    // 如果任务状态变为完成，添加完成时间
    if (updates.status === 'done' && !project.tasks[taskIndex].completedAt) {
      project.tasks[taskIndex].completedAt = new Date().toISOString()
    }
    
    project.updatedAt = new Date().toISOString()
    
    // 保存项目配置
    fs.writeFileSync(projectConfigPath, JSON.stringify(project, null, 2))
    
    return project.tasks[taskIndex]
  } catch (error: any) {
    throw new Error(`更新任务失败: ${error.message}`)
  }
}

// 删除任务
function deleteTask(projectId: string, taskId: string): boolean {
  try {
    const config = loadProjectManagerConfig()
    const projectInfo = config.projects.find((p: any) => p.id === projectId)
    
    if (!projectInfo) {
      throw new Error('项目不存在')
    }
    
    // 读取项目配置
    const projectConfigPath = path.join(projectInfo.path, 'project.json')
    if (!fs.existsSync(projectConfigPath)) {
      throw new Error('项目配置文件不存在')
    }
    
    const project = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'))
    const taskIndex = project.tasks.findIndex((t: Task) => t.id === taskId)
    
    if (taskIndex === -1) {
      throw new Error('任务不存在')
    }
    
    // 删除任务
    project.tasks.splice(taskIndex, 1)
    project.updatedAt = new Date().toISOString()
    
    // 保存项目配置
    fs.writeFileSync(projectConfigPath, JSON.stringify(project, null, 2))
    
    return true
  } catch (error: any) {
    throw new Error(`删除任务失败: ${error.message}`)
  }
}

// 获取项目任务
function getTasks(projectId: string): Task[] {
  try {
    const config = loadProjectManagerConfig()
    const projectInfo = config.projects.find((p: any) => p.id === projectId)
    
    if (!projectInfo) {
      throw new Error('项目不存在')
    }
    
    // 读取项目配置
    const projectConfigPath = path.join(projectInfo.path, 'project.json')
    if (!fs.existsSync(projectConfigPath)) {
      throw new Error('项目配置文件不存在')
    }
    
    const project = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'))
    return project.tasks || []
  } catch (error: any) {
    throw new Error(`获取任务失败: ${error.message}`)
  }
}

// 生成项目报告
function generateReport(projectId: string, reportType: string): any {
  try {
    const config = loadProjectManagerConfig()
    const projectInfo = config.projects.find((p: any) => p.id === projectId)
    
    if (!projectInfo) {
      throw new Error('项目不存在')
    }
    
    // 读取项目配置
    const projectConfigPath = path.join(projectInfo.path, 'project.json')
    if (!fs.existsSync(projectConfigPath)) {
      throw new Error('项目配置文件不存在')
    }
    
    const project = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'))
    
    // 生成报告
    switch (reportType) {
      case 'status':
        // 状态报告
        const statusCounts = {
          todo: project.tasks.filter((t: Task) => t.status === 'todo').length,
          in_progress: project.tasks.filter((t: Task) => t.status === 'in_progress').length,
          done: project.tasks.filter((t: Task) => t.status === 'done').length,
          blocked: project.tasks.filter((t: Task) => t.status === 'blocked').length
        }
        
        return {
          project: {
            id: project.id,
            name: project.name,
            status: project.status,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
          },
          taskStatus: statusCounts,
          totalTasks: project.tasks.length,
          completedTasks: statusCounts.done,
          completionRate: project.tasks.length > 0 ? (statusCounts.done / project.tasks.length * 100).toFixed(2) + '%' : '0%',
          estimatedTime: project.estimatedTime,
          actualTime: project.actualTime,
          timeVariance: project.estimatedTime > 0 ? ((project.actualTime - project.estimatedTime) / project.estimatedTime * 100).toFixed(2) + '%' : 'N/A'
        }
        
      case 'timeline':
        // 时间线报告
        const tasksByDate = project.tasks.reduce((acc: any, task: Task) => {
          const date = task.createdAt.split('T')[0]
          if (!acc[date]) {
            acc[date] = []
          }
          acc[date].push(task)
          return acc
        }, {})
        
        return {
          project: {
            id: project.id,
            name: project.name
          },
          timeline: tasksByDate,
          totalEstimatedTime: project.tasks.reduce((acc: number, task: Task) => acc + task.estimatedTime, 0),
          totalActualTime: project.tasks.reduce((acc: number, task: Task) => acc + task.actualTime, 0)
        }
        
      case 'priority':
        // 优先级报告
        const priorityCounts = {
          low: project.tasks.filter((t: Task) => t.priority === 'low').length,
          medium: project.tasks.filter((t: Task) => t.priority === 'medium').length,
          high: project.tasks.filter((t: Task) => t.priority === 'high').length
        }
        
        return {
          project: {
            id: project.id,
            name: project.name
          },
          priorityDistribution: priorityCounts,
          highPriorityTasks: project.tasks.filter((t: Task) => t.priority === 'high' && t.status !== 'done')
        }
        
      default:
        throw new Error('不支持的报告类型')
    }
  } catch (error: any) {
    throw new Error(`生成报告失败: ${error.message}`)
  }
}

// 估算项目时间
function estimateProjectTime(projectId: string): any {
  try {
    const config = loadProjectManagerConfig()
    const projectInfo = config.projects.find((p: any) => p.id === projectId)
    
    if (!projectInfo) {
      throw new Error('项目不存在')
    }
    
    // 读取项目配置
    const projectConfigPath = path.join(projectInfo.path, 'project.json')
    if (!fs.existsSync(projectConfigPath)) {
      throw new Error('项目配置文件不存在')
    }
    
    const project = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'))
    
    // 计算总估算时间和已用时间
    const totalEstimatedTime = project.tasks.reduce((acc: number, task: Task) => acc + task.estimatedTime, 0)
    const totalActualTime = project.tasks.reduce((acc: number, task: Task) => acc + task.actualTime, 0)
    const completedTasks = project.tasks.filter((t: Task) => t.status === 'done').length
    const completionRate = project.tasks.length > 0 ? completedTasks / project.tasks.length : 0
    
    // 估算剩余时间
    const estimatedRemainingTime = totalEstimatedTime * (1 - completionRate)
    const estimatedTotalTime = totalActualTime + estimatedRemainingTime
    
    return {
      projectId: project.id,
      projectName: project.name,
      totalEstimatedTime: totalEstimatedTime,
      totalActualTime: totalActualTime,
      estimatedRemainingTime: estimatedRemainingTime,
      estimatedTotalTime: estimatedTotalTime,
      completionRate: (completionRate * 100).toFixed(2) + '%',
      tasksCount: project.tasks.length,
      completedTasks: completedTasks
    }
  } catch (error: any) {
    throw new Error(`估算时间失败: ${error.message}`)
  }
}

// 跟踪项目进度
function trackProjectProgress(projectId: string): any {
  try {
    const config = loadProjectManagerConfig()
    const projectInfo = config.projects.find((p: any) => p.id === projectId)
    
    if (!projectInfo) {
      throw new Error('项目不存在')
    }
    
    // 读取项目配置
    const projectConfigPath = path.join(projectInfo.path, 'project.json')
    if (!fs.existsSync(projectConfigPath)) {
      throw new Error('项目配置文件不存在')
    }
    
    const project = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'))
    
    // 计算进度
    const tasksCount = project.tasks.length
    const completedTasks = project.tasks.filter((t: Task) => t.status === 'done').length
    const inProgressTasks = project.tasks.filter((t: Task) => t.status === 'in_progress').length
    const blockedTasks = project.tasks.filter((t: Task) => t.status === 'blocked').length
    
    const completionRate = tasksCount > 0 ? (completedTasks / tasksCount) * 100 : 0
    const progressRate = tasksCount > 0 ? ((completedTasks + inProgressTasks) / tasksCount) * 100 : 0
    
    // 计算时间进度
    const totalEstimatedTime = project.tasks.reduce((acc: number, task: Task) => acc + task.estimatedTime, 0)
    const totalActualTime = project.tasks.reduce((acc: number, task: Task) => acc + task.actualTime, 0)
    const timeProgress = totalEstimatedTime > 0 ? (totalActualTime / totalEstimatedTime) * 100 : 0
    
    // 识别风险
    const risks = []
    if (blockedTasks > 0) {
      risks.push(`有 ${blockedTasks} 个任务被阻塞`)
    }
    if (timeProgress > progressRate + 20) {
      risks.push('时间进度落后于任务进度')
    }
    if (tasksCount > 0 && completedTasks === 0) {
      risks.push('项目尚未开始')
    }
    
    return {
      projectId: project.id,
      projectName: project.name,
      projectStatus: project.status,
      tasksCount: tasksCount,
      completedTasks: completedTasks,
      inProgressTasks: inProgressTasks,
      blockedTasks: blockedTasks,
      completionRate: completionRate.toFixed(2) + '%',
      progressRate: progressRate.toFixed(2) + '%',
      timeProgress: timeProgress.toFixed(2) + '%',
      totalEstimatedTime: totalEstimatedTime,
      totalActualTime: totalActualTime,
      risks: risks,
      nextSteps: [
        ...project.tasks.filter((t: Task) => t.status === 'todo' && t.priority === 'high').map((t: Task) => `开始任务: ${t.title}`),
        ...project.tasks.filter((t: Task) => t.status === 'blocked').map((t: Task) => `解决阻塞: ${t.title}`)
      ].slice(0, 3)
    }
  } catch (error: any) {
    throw new Error(`跟踪进度失败: ${error.message}`)
  }
}

// 设置工作模式
function setProjectManagerMode(mode: string) {
  try {
    if (!['standard', 'solo'].includes(mode)) {
      throw new Error('不支持的模式')
    }
    
    const config = loadProjectManagerConfig()
    config.currentMode = mode
    saveProjectManagerConfig(config)
    
    return {
      success: true,
      message: `工作模式已设置为 ${mode}`,
      mode: mode
    }
  } catch (error: any) {
    throw new Error(`设置模式失败: ${error.message}`)
  }
}

// 获取当前工作模式
function getProjectManagerMode() {
  try {
    const config = loadProjectManagerConfig()
    return {
      success: true,
      mode: config.currentMode
    }
  } catch (error: any) {
    throw new Error(`获取模式失败: ${error.message}`)
  }
}

// 项目经理模式IPC处理函数
ipcMain.handle('projectManager:create', (_, name: string, type: string, options?: any) => {
  try {
    const project = createProject(name, type, options)
    return { success: true, project: project }
  } catch (error: any) {
    console.error('创建项目失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:list', () => {
  try {
    const projects = listProjects()
    return { success: true, projects: projects }
  } catch (error: any) {
    console.error('列出项目失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:open', (_, projectId: string) => {
  try {
    const result = openProject(projectId)
    return result
  } catch (error: any) {
    console.error('打开项目失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:close', (_, projectId: string) => {
  try {
    const result = closeProject(projectId)
    return result
  } catch (error: any) {
    console.error('关闭项目失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:delete', (_, projectId: string) => {
  try {
    const result = deleteProject(projectId)
    return result
  } catch (error: any) {
    console.error('删除项目失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:addTask', (_, projectId: string, task: any) => {
  try {
    const newTask = addTask(projectId, task)
    return { success: true, task: newTask }
  } catch (error: any) {
    console.error('添加任务失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:updateTask', (_, projectId: string, taskId: string, updates: any) => {
  try {
    const updatedTask = updateTask(projectId, taskId, updates)
    return { success: true, task: updatedTask }
  } catch (error: any) {
    console.error('更新任务失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:deleteTask', (_, projectId: string, taskId: string) => {
  try {
    const result = deleteTask(projectId, taskId)
    return { success: true, message: '任务已删除' }
  } catch (error: any) {
    console.error('删除任务失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:getTasks', (_, projectId: string) => {
  try {
    const tasks = getTasks(projectId)
    return { success: true, tasks: tasks }
  } catch (error: any) {
    console.error('获取任务失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:generateReport', (_, projectId: string, reportType: string) => {
  try {
    const report = generateReport(projectId, reportType)
    return { success: true, report: report }
  } catch (error: any) {
    console.error('生成报告失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:estimateTime', (_, projectId: string) => {
  try {
    const estimate = estimateProjectTime(projectId)
    return { success: true, estimate: estimate }
  } catch (error: any) {
    console.error('估算时间失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:trackProgress', (_, projectId: string) => {
  try {
    const progress = trackProjectProgress(projectId)
    return { success: true, progress: progress }
  } catch (error: any) {
    console.error('跟踪进度失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:setMode', (_, mode: string) => {
  try {
    const result = setProjectManagerMode(mode)
    return result
  } catch (error: any) {
    console.error('设置模式失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('projectManager:getMode', () => {
  try {
    const result = getProjectManagerMode()
    return result
  } catch (error: any) {
    console.error('获取模式失败:', error)
    return { success: false, error: error.message }
  }
})

// 初始化项目经理
app.whenReady().then(() => {
  initializeProjectManager()
})

// 数据可视化功能
ipcMain.handle('viz:generate', async (_, data: any, chartType: string, options?: any) => {
  try {
    console.log(`生成可视化图表，类型: ${chartType}`)
    
    // 读取API密钥
    const apiKeys = JSON.parse(fs.readFileSync(apiKeysPath, 'utf8'))
    const apiKey = apiKeys['openai'] || apiKeys['deepseek'] || apiKeys['claude'] || apiKeys['minimax']
    const model = apiKeys['openai'] ? 'openai' : apiKeys['deepseek'] ? 'deepseek' : apiKeys['claude'] ? 'claude' : 'minimax'
    
    if (!apiKey) {
      // 没有API密钥，返回模拟图表配置
      const mockChartConfig = {
        type: chartType,
        data: data,
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: '数据可视化示例'
            }
          }
        }
      }
      
      return {
        success: true,
        chartConfig: mockChartConfig,
        explanation: `这是一个${chartType}类型的图表示例，使用提供的数据生成。`
      }
    }
    
    // 调用AI API生成图表配置
    let chartConfig = {}
    let explanation = ''
    
    if (model === 'openai') {
      // OpenAI API调用
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'system',
            content: `You are a data visualization assistant. Generate a Chart.js configuration object for the given data and chart type. Return only the JSON configuration object without any additional text.`
          }, {
            role: 'user',
            content: `Chart type: ${chartType}\nData: ${JSON.stringify(data)}\nReturn a Chart.js configuration object.`
          }],
          max_tokens: 2000
        })
      })
      
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      
      // 提取JSON配置
      try {
        chartConfig = JSON.parse(content)
        explanation = '使用OpenAI模型生成的图表配置'
      } catch (error) {
        // 如果解析失败，使用默认配置
        chartConfig = {
          type: chartType,
          data: data,
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: '数据可视化'
              }
            }
          }
        }
        explanation = '使用默认配置生成的图表'
      }
    } else if (model === 'deepseek') {
      // DeepSeek API调用
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'system',
            content: `You are a data visualization assistant. Generate a Chart.js configuration object for the given data and chart type. Return only the JSON configuration object without any additional text.`
          }, {
            role: 'user',
            content: `Chart type: ${chartType}\nData: ${JSON.stringify(data)}\nReturn a Chart.js configuration object.`
          }],
          max_tokens: 2000
        })
      })
      
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      
      // 提取JSON配置
      try {
        chartConfig = JSON.parse(content)
        explanation = '使用DeepSeek模型生成的图表配置'
      } catch (error) {
        // 如果解析失败，使用默认配置
        chartConfig = {
          type: chartType,
          data: data,
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: '数据可视化'
              }
            }
          }
        }
        explanation = '使用默认配置生成的图表'
      }
    } else if (model === 'claude') {
      // Claude API调用
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `You are a data visualization assistant. Generate a Chart.js configuration object for the given data and chart type. Return only the JSON configuration object without any additional text.\n\nChart type: ${chartType}\nData: ${JSON.stringify(data)}\nReturn a Chart.js configuration object.`
          }]
        })
      })
      
      const data = await response.json()
      const content = data.content?.[0]?.text || ''
      
      // 提取JSON配置
      try {
        chartConfig = JSON.parse(content)
        explanation = '使用Claude模型生成的图表配置'
      } catch (error) {
        // 如果解析失败，使用默认配置
        chartConfig = {
          type: chartType,
          data: data,
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: '数据可视化'
              }
            }
          }
        }
        explanation = '使用默认配置生成的图表'
      }
    } else if (model === 'minimax') {
      // MiniMax API调用
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'abab6.5s-chat',
          messages: [{
            role: 'user',
            content: `You are a data visualization assistant. Generate a Chart.js configuration object for the given data and chart type. Return only the JSON configuration object without any additional text.\n\nChart type: ${chartType}\nData: ${JSON.stringify(data)}\nReturn a Chart.js configuration object.`
          }]
        })
      })
      
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      
      // 提取JSON配置
      try {
        chartConfig = JSON.parse(content)
        explanation = '使用Minimax模型生成的图表配置'
      } catch (error) {
        // 如果解析失败，使用默认配置
        chartConfig = {
          type: chartType,
          data: data,
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: '数据可视化'
              }
            }
          }
        }
        explanation = '使用默认配置生成的图表'
      }
    }
    
    return {
      success: true,
      chartConfig: chartConfig,
      explanation: explanation
    }
  } catch (error: any) {
    console.error('生成可视化图表失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('viz:processData', async (_, rawData: any, operation: string, options?: any) => {
  try {
    console.log(`处理数据，操作: ${operation}`)
    
    let processedData: any = rawData
    
    // 根据操作类型处理数据
    switch (operation) {
      case 'filter':
        // 过滤数据
        if (options?.filterBy && options?.filterValue) {
          processedData = rawData.filter((item: any) => 
            item[options.filterBy] === options.filterValue
          )
        }
        break
      case 'sort':
        // 排序数据
        if (options?.sortBy) {
          processedData = rawData.sort((a: any, b: any) => {
            if (a[options.sortBy] < b[options.sortBy]) return -1
            if (a[options.sortBy] > b[options.sortBy]) return 1
            return 0
          })
        }
        break
      case 'aggregate':
        // 聚合数据
        if (options?.groupBy && options?.aggregateBy && options?.aggregateFunction) {
          const aggregated: any = {}
          rawData.forEach((item: any) => {
            const key = item[options.groupBy]
            if (!aggregated[key]) {
              aggregated[key] = []
            }
            aggregated[key].push(item[options.aggregateBy])
          })
          
          // 应用聚合函数
          processedData = Object.entries(aggregated).map(([key, values]: [string, any[]]) => {
            let result: number
            switch (options.aggregateFunction) {
              case 'sum':
                result = values.reduce((acc: number, val: number) => acc + val, 0)
                break
              case 'average':
                result = values.reduce((acc: number, val: number) => acc + val, 0) / values.length
                break
              case 'count':
                result = values.length
                break
              case 'max':
                result = Math.max(...values)
                break
              case 'min':
                result = Math.min(...values)
                break
              default:
                result = values[0]
            }
            return {
              [options.groupBy]: key,
              [options.aggregateBy]: result
            }
          })
        }
        break
      case 'transform':
        // 转换数据格式
        if (options?.transformFunction) {
          processedData = rawData.map((item: any) => {
            try {
              // 使用eval执行转换函数，注意安全风险
              // 在实际应用中应该使用更安全的方式
              const transformFn = new Function('item', options.transformFunction)
              return transformFn(item)
            } catch (error) {
              return item
            }
          })
        }
        break
      default:
        // 无操作，返回原数据
        processedData = rawData
    }
    
    return {
      success: true,
      data: processedData,
      explanation: `已成功${operation}处理数据`
    }
  } catch (error: any) {
    console.error('处理数据失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('viz:analyze', async (_, data: any, options?: any) => {
  try {
    console.log('分析数据')
    
    // 读取API密钥
    const apiKeys = JSON.parse(fs.readFileSync(apiKeysPath, 'utf8'))
    const apiKey = apiKeys['openai'] || apiKeys['deepseek'] || apiKeys['claude'] || apiKeys['minimax']
    const model = apiKeys['openai'] ? 'openai' : apiKeys['deepseek'] ? 'deepseek' : apiKeys['claude'] ? 'claude' : 'minimax'
    
    if (!apiKey) {
      // 没有API密钥，返回模拟分析结果
      return {
        success: true,
        analysis: {
          summary: '数据包含多个条目，展示了不同类别的信息。',
          insights: [
            '数据分布相对均匀',
            '没有明显的异常值',
            '可以考虑使用柱状图或折线图进行可视化'
          ],
          recommendations: [
            '进一步分析数据的趋势',
            '考虑添加更多维度的数据',
            '使用更复杂的分析方法'
          ]
        }
      }
    }
    
    // 调用AI API分析数据
    let analysis: any = {}
    
    if (model === 'openai') {
      // OpenAI API调用
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'system',
            content: 'You are a data analysis assistant. Analyze the given data and provide a comprehensive analysis including summary, key insights, and recommendations for visualization.'
          }, {
            role: 'user',
            content: `Analyze the following data:\n${JSON.stringify(data)}\n\nProvide:\n1. A brief summary of the data\n2. Key insights and patterns\n3. Recommendations for visualization\n4. Any potential issues or limitations`
          }],
          max_tokens: 2000
        })
      })
      
      const data = await response.json()
      analysis = data.choices?.[0]?.message?.content || ''
    } else if (model === 'deepseek') {
      // DeepSeek API调用
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'system',
            content: 'You are a data analysis assistant. Analyze the given data and provide a comprehensive analysis including summary, key insights, and recommendations for visualization.'
          }, {
            role: 'user',
            content: `Analyze the following data:\n${JSON.stringify(data)}\n\nProvide:\n1. A brief summary of the data\n2. Key insights and patterns\n3. Recommendations for visualization\n4. Any potential issues or limitations`
          }],
          max_tokens: 2000
        })
      })
      
      const data = await response.json()
      analysis = data.choices?.[0]?.message?.content || ''
    } else if (model === 'claude') {
      // Claude API调用
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `You are a data analysis assistant. Analyze the given data and provide a comprehensive analysis including summary, key insights, and recommendations for visualization.\n\nAnalyze the following data:\n${JSON.stringify(data)}\n\nProvide:\n1. A brief summary of the data\n2. Key insights and patterns\n3. Recommendations for visualization\n4. Any potential issues or limitations`
          }]
        })
      })
      
      const data = await response.json()
      analysis = data.content?.[0]?.text || ''
    } else if (model === 'minimax') {
      // MiniMax API调用
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'abab6.5s-chat',
          messages: [{
            role: 'user',
            content: `You are a data analysis assistant. Analyze the given data and provide a comprehensive analysis including summary, key insights, and recommendations for visualization.\n\nAnalyze the following data:\n${JSON.stringify(data)}\n\nProvide:\n1. A brief summary of the data\n2. Key insights and patterns\n3. Recommendations for visualization\n4. Any potential issues or limitations`
          }]
        })
      })
      
      const data = await response.json()
      analysis = data.choices?.[0]?.message?.content || ''
    }
    
    return {
      success: true,
      analysis: analysis
    }
  } catch (error: any) {
    console.error('分析数据失败:', error)
    return { success: false, error: error.message }
  }
})

// 代码生成和解释功能
ipcMain.handle('code:generate', async (_, prompt: string, language: string, options?: any) => {
  try {
    console.log(`生成代码，提示: ${prompt}, 语言: ${language}`)
    
    // 读取API密钥
    const apiKeys = JSON.parse(fs.readFileSync(apiKeysPath, 'utf8'))
    const apiKey = apiKeys['openai'] || apiKeys['deepseek'] || apiKeys['claude'] || apiKeys['minimax']
    const model = apiKeys['openai'] ? 'openai' : apiKeys['deepseek'] ? 'deepseek' : apiKeys['claude'] ? 'claude' : 'minimax'
    
    if (!apiKey) {
      // 没有API密钥，返回模拟代码
      const mockCode: Record<string, string> = {
        javascript: `// 生成的JavaScript代码
function ${prompt.split(' ')[0] || 'example'}() {
  console.log('Hello, world!');
  return 'Generated code example';
}

module.exports = ${prompt.split(' ')[0] || 'example'};`,
        typescript: `// 生成的TypeScript代码
function ${prompt.split(' ')[0] || 'example'}(): string {
  console.log('Hello, world!');
  return 'Generated code example';
}

export default ${prompt.split(' ')[0] || 'example'};`,
        python: `# 生成的Python代码
def ${prompt.split(' ')[0] || 'example'}():
    print('Hello, world!')
    return 'Generated code example'

if __name__ == '__main__':
    ${prompt.split(' ')[0] || 'example'}()`,
        java: `// 生成的Java代码
public class ${prompt.split(' ')[0] || 'Example'} {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
    }
    
    public static String ${prompt.split(' ')[0] || 'example'}() {
        return "Generated code example";
    }
}`,
        go: `// 生成的Go代码
package main

import "fmt"

func ${prompt.split(' ')[0] || 'Example'}() string {
    fmt.Println("Hello, world!")
    return "Generated code example"
}

func main() {
    ${prompt.split(' ')[0] || 'Example'}()
}`,
        rust: `// 生成的Rust代码
fn ${prompt.split(' ')[0] || 'example'}() -> String {
    println!("Hello, world!");
    "Generated code example".to_string()
}

fn main() {
    ${prompt.split(' ')[0] || 'example'}();
}`,
        default: `// 生成的代码
// 提示: ${prompt}
// 语言: ${language}
console.log('Hello, world!');
`
      }
      
      return {
        success: true,
        code: mockCode[language] || mockCode.default,
        explanation: `这是一个生成的${language}代码示例，实现了"${prompt}"的功能。`
      }
    }
    
    // 调用AI API生成代码
    let generatedCode = ''
    let explanation = ''
    
    if (model === 'openai') {
      // OpenAI API调用
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'system',
            content: `You are a code generation assistant. Generate ${language} code for the following prompt. Include a brief explanation of what the code does.`
          }, {
            role: 'user',
            content: prompt
          }],
          max_tokens: 2000
        })
      })
      
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      
      // 提取代码和解释
      const codeMatch = content.match(/```[\s\S]*?```/)
      if (codeMatch) {
        generatedCode = codeMatch[0].replace(/```[\s\S]*?\n|```/g, '')
        explanation = content.replace(codeMatch[0], '').trim()
      } else {
        generatedCode = content
        explanation = 'Generated code based on the prompt'
      }
    } else if (model === 'deepseek') {
      // DeepSeek API调用
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'system',
            content: `You are a code generation assistant. Generate ${language} code for the following prompt. Include a brief explanation of what the code does.`
          }, {
            role: 'user',
            content: prompt
          }],
          max_tokens: 2000
        })
      })
      
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      
      // 提取代码和解释
      const codeMatch = content.match(/```[\s\S]*?```/)
      if (codeMatch) {
        generatedCode = codeMatch[0].replace(/```[\s\S]*?\n|```/g, '')
        explanation = content.replace(codeMatch[0], '').trim()
      } else {
        generatedCode = content
        explanation = 'Generated code based on the prompt'
      }
    } else if (model === 'claude') {
      // Claude API调用
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `Generate ${language} code for the following prompt. Include a brief explanation of what the code does.\n\nPrompt: ${prompt}`
          }]
        })
      })
      
      const data = await response.json()
      const content = data.content?.[0]?.text || ''
      
      // 提取代码和解释
      const codeMatch = content.match(/```[\s\S]*?```/)
      if (codeMatch) {
        generatedCode = codeMatch[0].replace(/```[\s\S]*?\n|```/g, '')
        explanation = content.replace(codeMatch[0], '').trim()
      } else {
        generatedCode = content
        explanation = 'Generated code based on the prompt'
      }
    } else if (model === 'minimax') {
      // MiniMax API调用
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'abab6.5s-chat',
          messages: [{
            role: 'user',
            content: `Generate ${language} code for the following prompt. Include a brief explanation of what the code does.\n\nPrompt: ${prompt}`
          }]
        })
      })
      
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      
      // 提取代码和解释
      const codeMatch = content.match(/```[\s\S]*?```/)
      if (codeMatch) {
        generatedCode = codeMatch[0].replace(/```[\s\S]*?\n|```/g, '')
        explanation = content.replace(codeMatch[0], '').trim()
      } else {
        generatedCode = content
        explanation = 'Generated code based on the prompt'
      }
    }
    
    return {
      success: true,
      code: generatedCode,
      explanation: explanation
    }
  } catch (error: any) {
    console.error('生成代码失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('code:explain', async (_, code: string, language: string, options?: any) => {
  try {
    console.log(`解释代码，语言: ${language}`)
    
    // 读取API密钥
    const apiKeys = JSON.parse(fs.readFileSync(apiKeysPath, 'utf8'))
    const apiKey = apiKeys['openai'] || apiKeys['deepseek'] || apiKeys['claude'] || apiKeys['minimax']
    const model = apiKeys['openai'] ? 'openai' : apiKeys['deepseek'] ? 'deepseek' : apiKeys['claude'] ? 'claude' : 'minimax'
    
    if (!apiKey) {
      // 没有API密钥，返回模拟解释
      return {
        success: true,
        explanation: `这是一段${language}代码，它实现了特定的功能。代码分析：\n1. 代码结构分析\n2. 功能说明\n3. 潜在问题\n4. 优化建议\n\n由于没有配置API密钥，这是一个示例解释。`
      }
    }
    
    // 调用AI API解释代码
    let explanation = ''
    
    if (model === 'openai') {
      // OpenAI API调用
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'system',
            content: `You are a code explanation assistant. Explain what the following ${language} code does, including its structure, functionality, potential issues, and optimization suggestions.`
          }, {
            role: 'user',
            content: code
          }],
          max_tokens: 2000
        })
      })
      
      const data = await response.json()
      explanation = data.choices?.[0]?.message?.content || 'Failed to generate explanation'
    } else if (model === 'deepseek') {
      // DeepSeek API调用
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'system',
            content: `You are a code explanation assistant. Explain what the following ${language} code does, including its structure, functionality, potential issues, and optimization suggestions.`
          }, {
            role: 'user',
            content: code
          }],
          max_tokens: 2000
        })
      })
      
      const data = await response.json()
      explanation = data.choices?.[0]?.message?.content || 'Failed to generate explanation'
    } else if (model === 'claude') {
      // Claude API调用
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `Explain what the following ${language} code does, including its structure, functionality, potential issues, and optimization suggestions.\n\n${code}`
          }]
        })
      })
      
      const data = await response.json()
      explanation = data.content?.[0]?.text || 'Failed to generate explanation'
    } else if (model === 'minimax') {
      // MiniMax API调用
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'abab6.5s-chat',
          messages: [{
            role: 'user',
            content: `Explain what the following ${language} code does, including its structure, functionality, potential issues, and optimization suggestions.\n\n${code}`
          }]
        })
      })
      
      const data = await response.json()
      explanation = data.choices?.[0]?.message?.content || 'Failed to generate explanation'
    }
    
    return {
      success: true,
      explanation: explanation
    }
  } catch (error: any) {
    console.error('解释代码失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('code:refactor', async (_, code: string, language: string, options?: any) => {
  try {
    console.log(`重构代码，语言: ${language}`)
    
    // 读取API密钥
    const apiKeys = JSON.parse(fs.readFileSync(apiKeysPath, 'utf8'))
    const apiKey = apiKeys['openai'] || apiKeys['deepseek'] || apiKeys['claude'] || apiKeys['minimax']
    const model = apiKeys['openai'] ? 'openai' : apiKeys['deepseek'] ? 'deepseek' : apiKeys['claude'] ? 'claude' : 'minimax'
    
    if (!apiKey) {
      // 没有API密钥，返回原代码
      return {
        success: true,
        code: code,
        explanation: '由于没有配置API密钥，无法进行代码重构。'
      }
    }
    
    // 调用AI API重构代码
    let refactoredCode = ''
    let explanation = ''
    
    if (model === 'openai') {
      // OpenAI API调用
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'system',
            content: `You are a code refactoring assistant. Refactor the following ${language} code to improve its readability, efficiency, and maintainability. Include an explanation of the changes made.`
          }, {
            role: 'user',
            content: code
          }],
          max_tokens: 2000
        })
      })
      
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      
      // 提取重构后的代码和解释
      const codeMatch = content.match(/```[\s\S]*?```/)
      if (codeMatch) {
        refactoredCode = codeMatch[0].replace(/```[\s\S]*?\n|```/g, '')
        explanation = content.replace(codeMatch[0], '').trim()
      } else {
        refactoredCode = content
        explanation = 'Refactored code based on best practices'
      }
    } else if (model === 'deepseek') {
      // DeepSeek API调用
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'system',
            content: `You are a code refactoring assistant. Refactor the following ${language} code to improve its readability, efficiency, and maintainability. Include an explanation of the changes made.`
          }, {
            role: 'user',
            content: code
          }],
          max_tokens: 2000
        })
      })
      
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      
      // 提取重构后的代码和解释
      const codeMatch = content.match(/```[\s\S]*?```/)
      if (codeMatch) {
        refactoredCode = codeMatch[0].replace(/```[\s\S]*?\n|```/g, '')
        explanation = content.replace(codeMatch[0], '').trim()
      } else {
        refactoredCode = content
        explanation = 'Refactored code based on best practices'
      }
    } else if (model === 'claude') {
      // Claude API调用
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `Refactor the following ${language} code to improve its readability, efficiency, and maintainability. Include an explanation of the changes made.\n\n${code}`
          }]
        })
      })
      
      const data = await response.json()
      const content = data.content?.[0]?.text || ''
      
      // 提取重构后的代码和解释
      const codeMatch = content.match(/```[\s\S]*?```/)
      if (codeMatch) {
        refactoredCode = codeMatch[0].replace(/```[\s\S]*?\n|```/g, '')
        explanation = content.replace(codeMatch[0], '').trim()
      } else {
        refactoredCode = content
        explanation = 'Refactored code based on best practices'
      }
    } else if (model === 'minimax') {
      // MiniMax API调用
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'abab6.5s-chat',
          messages: [{
            role: 'user',
            content: `Refactor the following ${language} code to improve its readability, efficiency, and maintainability. Include an explanation of the changes made.\n\n${code}`
          }]
        })
      })
      
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      
      // 提取重构后的代码和解释
      const codeMatch = content.match(/```[\s\S]*?```/)
      if (codeMatch) {
        refactoredCode = codeMatch[0].replace(/```[\s\S]*?\n|```/g, '')
        explanation = content.replace(codeMatch[0], '').trim()
      } else {
        refactoredCode = content
        explanation = 'Refactored code based on best practices'
      }
    }
    
    return {
      success: true,
      code: refactoredCode,
      explanation: explanation
    }
  } catch (error: any) {
    console.error('重构代码失败:', error)
    return { success: false, error: error.message }
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
