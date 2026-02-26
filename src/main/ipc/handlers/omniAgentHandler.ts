/**
 * 全能智能体管家 IPC 处理器
 * 提供全能智能体管家的所有功能接口
 */

import { ipcMain } from 'electron'
import { omniAgent, OmniAgentOptions, OmniAgentResult, OmniAgentType, PermissionLevel, ProjectContext } from '../../agent/OmniAgent'
import { conversationManager, SessionOptions, ConversationResponse } from '../../agent/ConversationManager'

// ============================================
// 全能智能体管家 IPC 处理器
// ============================================

export function registerOmniAgentHandlers() {
  console.log('[OmniAgent IPC] 注册全能智能体管家处理器...')

  // 执行任务（使用对话管理器）
  ipcMain.handle('omni:executeTask', async (_event, instruction: string, options?: OmniAgentOptions & { sessionId?: string }) => {
    try {
      console.log('[OmniAgent IPC] 收到任务执行请求:', instruction.slice(0, 100))
      
      const sessionId = options?.sessionId || 'default'
      const response = await conversationManager.processMessage(sessionId, instruction)
      
      return { success: true, result: response }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 任务执行失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 执行任务（使用原始 OmniAgent）
  ipcMain.handle('omni:executeTaskDirect', async (_event, instruction: string, options?: OmniAgentOptions) => {
    try {
      console.log('[OmniAgent IPC] 收到直接任务执行请求:', instruction.slice(0, 100))
      const result = await omniAgent.executeTask(instruction, options)
      return { success: true, result }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 直接任务执行失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 创建会话
  ipcMain.handle('omni:createSession', async (_event, userId: string, options?: SessionOptions) => {
    try {
      const session = await conversationManager.createSession(userId, options)
      return { success: true, session }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 创建会话失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取对话历史
  ipcMain.handle('omni:getConversationHistory', async (_event, sessionId: string, limit?: number) => {
    try {
      const history = conversationManager.getHistory(sessionId, limit)
      return { success: true, history }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 获取对话历史失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 清除对话历史
  ipcMain.handle('omni:clearConversationHistory', async (_event, sessionId: string) => {
    try {
      await conversationManager.clearHistory(sessionId)
      return { success: true }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 清除对话历史失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 删除会话
  ipcMain.handle('omni:deleteSession', async (_event, sessionId: string) => {
    try {
      await conversationManager.deleteSession(sessionId)
      return { success: true }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 删除会话失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取任务状态
  ipcMain.handle('omni:getTaskStatus', async (_event, taskId: string) => {
    try {
      const task = omniAgent.getTask(taskId)
      return { success: true, task }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 获取任务状态失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取任务历史
  ipcMain.handle('omni:getTaskHistory', async () => {
    try {
      const history = omniAgent.getTaskHistory()
      return { success: true, history }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 获取任务历史失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 清除任务历史
  ipcMain.handle('omni:clearTaskHistory', async () => {
    try {
      omniAgent.clearTaskHistory()
      return { success: true }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 清除任务历史失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 项目管理 - 添加项目
  ipcMain.handle('omni:addProject', async (_event, project: Omit<ProjectContext, 'lastModified'>) => {
    try {
      await omniAgent.addProject(project)
      return { success: true }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 添加项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 项目管理 - 获取项目
  ipcMain.handle('omni:getProject', async (_event, projectId: string) => {
    try {
      const project = omniAgent.getProject(projectId)
      return { success: true, project }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 获取项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 项目管理 - 获取所有项目
  ipcMain.handle('omni:getAllProjects', async () => {
    try {
      const projects = omniAgent.getAllProjects()
      return { success: true, projects }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 获取所有项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 项目管理 - 切换项目
  ipcMain.handle('omni:switchProject', async (_event, projectId: string) => {
    try {
      const success = await omniAgent.switchProject(projectId)
      return { success }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 切换项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 项目管理 - 删除项目
  ipcMain.handle('omni:removeProject', async (_event, projectId: string) => {
    try {
      await omniAgent.removeProject(projectId)
      return { success: true }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 删除项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 权限管理 - 设置权限级别
  ipcMain.handle('omni:setPermissionLevel', async (_event, level: PermissionLevel) => {
    try {
      omniAgent.setPermissionLevel(level)
      return { success: true }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 设置权限级别失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 权限管理 - 获取权限级别
  ipcMain.handle('omni:getPermissionLevel', async () => {
    try {
      const level = omniAgent.getPermissionLevel()
      return { success: true, level }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 获取权限级别失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 权限管理 - 检查权限
  ipcMain.handle('omni:hasPermission', async (_event, requiredLevel: PermissionLevel) => {
    try {
      const hasPermission = omniAgent.hasPermission(requiredLevel)
      return { success: true, hasPermission }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 检查权限失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 权限管理 - 获取权限日志
  ipcMain.handle('omni:getPermissionLog', async () => {
    try {
      const log = omniAgent.getPermissionLog()
      return { success: true, log }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 获取权限日志失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 状态查询 - 是否忙碌
  ipcMain.handle('omni:isBusy', async () => {
    try {
      const isBusy = omniAgent.isBusy()
      return { success: true, isBusy }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 查询忙碌状态失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 状态查询 - 获取当前任务ID
  ipcMain.handle('omni:getCurrentTaskId', async () => {
    try {
      const taskId = omniAgent.getCurrentTaskId()
      return { success: true, taskId }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 获取当前任务ID失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 状态查询 - 获取智能体类型
  ipcMain.handle('omni:getAgentType', async () => {
    try {
      const agentType = omniAgent.getAgentType()
      return { success: true, agentType }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 获取智能体类型失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 健康检查
  ipcMain.handle('omni:healthCheck', async () => {
    try {
      const health = await omniAgent.healthCheck()
      return { success: true, health }
    } catch (error: any) {
      console.error('[OmniAgent IPC] 健康检查失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 事件监听器注册
  ipcMain.on('omni:subscribe', (event, eventType: string) => {
    console.log('[OmniAgent IPC] 订阅事件:', eventType)
    
    const listener = (data: any) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(`omni:${eventType}`, data)
      }
    }
    
    omniAgent.on(eventType, listener)
    
    event.sender.on('destroyed', () => {
      omniAgent.off(eventType, listener)
    })
  })

  console.log('[OmniAgent IPC] 全能智能体管家处理器注册完成!')
}
