import { ipcMain } from 'electron'
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

  // 保存工作流
  ipcMain.handle('agent:saveWorkflow', (_, workflow: any) => {
    try {
      const preferences = readPreferences()
      preferences.savedWorkflows = preferences.savedWorkflows || []
      preferences.savedWorkflows.push(workflow)
      writePreferences(preferences)
      return { success: true }
    } catch (error: any) {
      console.error('保存工作流失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 加载工作流
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
}