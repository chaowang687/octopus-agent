import { ipcMain, dialog, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { WorkflowEngine } from '../../agent/WorkflowEngine'
import { registerWorkflowTools } from '../../agent/tools/WorkflowTools'

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

  // 执行工作流
  ipcMain.handle('agent:executeWorkflow', (_, workflow: any) => {
    try {
      const { nodes, edges } = workflow
      const engine = new WorkflowEngine(nodes, edges)
      return engine.execute()
    } catch (error: any) {
      console.error('执行工作流失败:', error)
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
      const result = await dialog.showOpenDialog({
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
      const result = await dialog.showOpenDialog({
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
}