import { ipcMain, dialog, shell, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { WorkflowEngine } from '../../agent/WorkflowEngine'
import { registerWorkflowTools } from '../../agent/tools/WorkflowTools'
import { getMainWindow } from '../../index'

// 智能体相关的 IPC 处理器
export function registerAgentHandlers() {
  const preferencesPath = path.join(process.cwd(), 'preferences.json')
  
  // 注册工作流工具
  registerWorkflowTools()

  // 默认工作流设置
  const defaultWorkflowSettings = {
    todoList: {
      ide: true,
      solo: true
    },
    autoCollapse: {
      solo: true
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

  // 默认工具状态
  const defaultToolState = {
    search: true,
    read: true,
    edit: true,
    terminal: true,
    preview: true,
    webSearch: true
  }

  // 读取 preferences 文件
  const readPreferences = () => {
    try {
      if (fs.existsSync(preferencesPath)) {
        return JSON.parse(fs.readFileSync(preferencesPath, 'utf8'))
      }
      return {}
    } catch {
      return {}
    }
  }

  // 写入 preferences 文件
  const writePreferences = (preferences: any) => {
    try {
      fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2))
    } catch (error) {
      console.error('写入 preferences 失败:', error)
    }
  }

  // 获取上次的工作流路径
  const getLastWorkflowPath = (): string | null => {
    try {
      const preferences = readPreferences()
      return preferences.lastWorkflowPath || null
    } catch {
      return null
    }
  }

  // 设置上次的工作流路径
  const setLastWorkflowPath = (filePath: string) => {
    try {
      const preferences = readPreferences()
      preferences.lastWorkflowPath = path.dirname(filePath)
      writePreferences(preferences)
    } catch (error) {
      console.error('保存工作流路径失败:', error)
    }
  }

  // 获取工作流设置
  ipcMain.handle('agent:getWorkflowSettings', () => {
    try {
      const preferences = readPreferences()
      const settings = preferences.workflow || defaultWorkflowSettings
      return { success: true, settings }
    } catch (error: any) {
      console.error('获取工作流设置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 更新工作流设置
  ipcMain.handle('agent:updateWorkflowSettings', (_, settings: any) => {
    try {
      const preferences = readPreferences()
      preferences.workflow = settings
      writePreferences(preferences)
      return { success: true }
    } catch (error: any) {
      console.error('更新工作流设置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 存储当前工作流引擎实例
  let currentWorkflowEngine: WorkflowEngine | null = null

  // 执行工作流
  ipcMain.handle('agent:executeWorkflow', (_, workflow: any) => {
    try {
      const { nodes, edges } = workflow
      currentWorkflowEngine = new WorkflowEngine(nodes, edges)
      return currentWorkflowEngine.execute()
    } catch (error: any) {
      console.error('执行工作流失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 暂停工作流
  ipcMain.handle('agent:pauseWorkflow', () => {
    try {
      if (currentWorkflowEngine) {
        currentWorkflowEngine.pause()
        return { success: true, status: currentWorkflowEngine.getStatus() }
      }
      return { success: false, error: '没有正在执行的工作流' }
    } catch (error: any) {
      console.error('暂停工作流失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 恢复工作流
  ipcMain.handle('agent:resumeWorkflow', () => {
    try {
      if (currentWorkflowEngine) {
        currentWorkflowEngine.resume()
        return { success: true, status: currentWorkflowEngine.getStatus() }
      }
      return { success: false, error: '没有正在执行的工作流' }
    } catch (error: any) {
      console.error('恢复工作流失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取工作流状态
  ipcMain.handle('agent:getWorkflowStatus', () => {
    try {
      if (currentWorkflowEngine) {
        return { success: true, status: currentWorkflowEngine.getStatus() }
      }
      return { success: false, error: '没有正在执行的工作流' }
    } catch (error: any) {
      console.error('获取工作流状态失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 保存工作流（覆盖保存）
  ipcMain.handle('agent:saveWorkflow', (_, workflow: any) => {
    try {
      const preferences = readPreferences()
      preferences.currentWorkflow = {
        ...workflow,
        savedAt: new Date().toISOString()
      }
      preferences.savedWorkflows = preferences.savedWorkflows || []
      
      const existingIndex = preferences.savedWorkflows.findIndex((w: any) => w.id === 'current')
      if (existingIndex >= 0) {
        preferences.savedWorkflows[existingIndex] = preferences.currentWorkflow
      } else {
        preferences.savedWorkflows.unshift({ ...preferences.currentWorkflow, id: 'current' })
      }
      
      writePreferences(preferences)
      console.log('工作流已保存')
      return { success: true }
    } catch (error: any) {
      console.error('保存工作流失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 保存工作流为文件
  ipcMain.handle('agent:saveWorkflowAsFile', async (_, workflow: any) => {
    try {
      console.log('开始保存工作流...')
      const mainWindow = getMainWindow()
      
      if (!mainWindow || mainWindow.isDestroyed()) {
        console.error('主窗口不存在或已销毁')
        return { success: false, error: '应用程序窗口不可用' }
      }
      
      console.log('主窗口状态正常')
      const lastPath = getLastWorkflowPath()
      console.log('上次路径:', lastPath)
      
      // 如果上次路径不存在或无法访问，使用用户文档目录
      let defaultPath = ''
      if (lastPath) {
        try {
          // 测试上次路径是否可写
          fs.accessSync(lastPath, fs.constants.W_OK)
          defaultPath = path.join(lastPath, `workflow_${new Date().toISOString().split('T')[0]}.json`)
        } catch (e) {
          // 如果上次路径不可写，使用默认文档目录
          defaultPath = path.join(app.getPath('documents'), `workflow_${new Date().toISOString().split('T')[0]}.json`)
        }
      } else {
        defaultPath = path.join(app.getPath('documents'), `workflow_${new Date().toISOString().split('T')[0]}.json`)
      }
      
      console.log('默认路径:', defaultPath)
      
      const result = await dialog.showSaveDialog(mainWindow, {
        title: '保存工作流',
        defaultPath: defaultPath,
        filters: [
          { name: 'Workflow Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['showHiddenFiles', 'createDirectory', 'treatPackageAsDirectory']
      })
      
      console.log('保存对话框结果:', result)
      if (!result.canceled && result.filePath) {
        console.log('保存路径:', result.filePath)
        
        // 检查工作流数据是否有效
        if (!workflow || typeof workflow !== 'object') {
          console.error('工作流数据无效:', workflow)
          return { success: false, error: '工作流数据无效' }
        }
        
        const workflowData = {
          ...workflow,
          savedAt: new Date().toISOString(),
          version: '1.0'
        }
        console.log('工作流数据:', workflowData)
        
        try {
          // 确保目录存在
          const dir = path.dirname(result.filePath)
          console.log('目标目录:', dir)
          
          // 检查目录是否存在，如果不存在则尝试创建
          if (!fs.existsSync(dir)) {
            console.log('目录不存在，正在创建:', dir)
            fs.mkdirSync(dir, { recursive: true })
            console.log('目录创建成功')
          } else {
            console.log('目录已存在')
          }
          
          // 检查目录是否可写
          try {
            fs.accessSync(dir, fs.constants.W_OK)
            console.log('目录可写')
          } catch (accessError) {
            console.error('目录不可写:', accessError)
            return { success: false, error: `目录没有写入权限: ${dir}` }
          }
          
          fs.writeFileSync(result.filePath, JSON.stringify(workflowData, null, 2))
          console.log('文件写入成功')
          setLastWorkflowPath(result.filePath)
          console.log('路径保存成功')
          return { success: true, filePath: result.filePath }
        } catch (writeError: any) {
          console.error('文件写入失败:', writeError)
          return { success: false, error: `文件写入失败: ${writeError.message}` }
        }
      } else if (result.canceled) {
        console.log('用户取消保存')
        return { success: false, canceled: true }
      } else {
        console.log('保存路径为空')
        return { success: false, error: '保存路径为空' }
      }
    } catch (error: any) {
      console.error('保存工作流文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 加载工作流文件
  ipcMain.handle('agent:loadWorkflowFromFile', async () => {
    try {
      const mainWindow = getMainWindow()
      const lastPath = getLastWorkflowPath()
      
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: '打开工作流',
        defaultPath: lastPath || undefined,
        properties: ['openFile'],
        filters: [
          { name: 'Workflow Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8')
          const workflow = JSON.parse(content)
          setLastWorkflowPath(filePath)
          return { success: true, workflow, filePath }
        }
        return { success: false, error: '文件不存在' }
      }
      return { success: false, canceled: true }
    } catch (error: any) {
      console.error('加载工作流文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 加载当前工作流
  ipcMain.handle('agent:loadCurrentWorkflow', () => {
    try {
      const preferences = readPreferences()
      const currentWorkflow = preferences.currentWorkflow || null
      return { success: true, workflow: currentWorkflow }
    } catch (error: any) {
      console.error('加载当前工作流失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 加载所有工作流
  ipcMain.handle('agent:loadWorkflows', () => {
    try {
      const preferences = readPreferences()
      const workflows = preferences.savedWorkflows || []
      return { success: true, workflows }
    } catch (error: any) {
      console.error('加载工作流失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取可用的智能体
  ipcMain.handle('agent:getAvailableAgents', () => {
    try {
      // 这里可以返回可用的智能体列表
      return { success: true, agents: [] }
    } catch (error: any) {
      console.error('获取可用智能体失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取智能体配置
  ipcMain.handle('agent:getAgentConfig', (_, agentId: string) => {
    try {
      // 这里可以返回指定智能体的配置
      return { success: true, config: {} }
    } catch (error: any) {
      console.error('获取智能体配置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 设置智能体配置
  ipcMain.handle('agent:setAgentConfig', (_, agentId: string, config: any) => {
    try {
      // 这里可以保存指定智能体的配置
      return { success: true }
    } catch (error: any) {
      console.error('设置智能体配置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取工具状态
  ipcMain.handle('agent:getToolState', () => {
    try {
      const preferences = readPreferences()
      const state = preferences.toolState || defaultToolState
      return { success: true, state }
    } catch (error: any) {
      console.error('获取工具状态失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 更新工具状态
  ipcMain.handle('agent:updateToolState', (_, state: any) => {
    try {
      const preferences = readPreferences()
      preferences.toolState = state
      writePreferences(preferences)
      return { success: true }
    } catch (error: any) {
      console.error('更新工具状态失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 打开文件夹选择对话框
  ipcMain.handle('agent:openFolder', async () => {
    try {
      const mainWindow = getMainWindow()
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory', 'createDirectory'],
        title: '选择文件夹'
      })
      if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, path: result.filePaths[0] }
      }
      return { success: false, canceled: true }
    } catch (error: any) {
      console.error('打开文件夹失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 打开文件选择对话框
  ipcMain.handle('agent:selectFile', async () => {
    try {
      const mainWindow = getMainWindow()
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile', 'multiSelections'],
        title: '选择文件',
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg'] },
          { name: 'Code', extensions: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rs'] }
        ]
      })
      if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, paths: result.filePaths }
      }
      return { success: false, canceled: true }
    } catch (error: any) {
      console.error('选择文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 打开文件/文件夹
  ipcMain.handle('agent:openFile', async (_, filePath: string) => {
    try {
      if (filePath) {
        await shell.openPath(filePath)
        return { success: true }
      }
      return { success: false, error: '文件路径为空' }
    } catch (error: any) {
      console.error('打开文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 读取文件内容
  ipcMain.handle('agent:readFile', async (_, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        return { success: true, content }
      }
      return { success: false, error: '文件不存在' }
    } catch (error: any) {
      console.error('读取文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 写入文件内容
  ipcMain.handle('agent:writeFile', async (_, filePath: string, content: string) => {
    try {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true }
    } catch (error: any) {
      console.error('写入文件失败:', error)
      return { success: false, error: error.message }
    }
  })
}