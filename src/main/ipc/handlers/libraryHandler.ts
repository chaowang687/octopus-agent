import { ipcMain } from 'electron'
import { documentService } from '../../library/DocumentService'
import { planService } from '../../library/PlanService'
import { decisionService } from '../../library/DecisionService'
import { collaborationController } from '../../library/CollaborationController'

// 文库系统相关的 IPC 处理器
export function registerLibraryHandlers() {
  // 文档管理
  ipcMain.handle('library:createDocument', async (_, doc: any) => {
    try {
      const result = await documentService.createDocument(doc)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('创建文档失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:getDocument', async (_, id: string) => {
    try {
      const result = await documentService.getDocument(id)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('获取文档失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:updateDocument', async (_, id: string, updates: any) => {
    try {
      const result = await documentService.updateDocument(id, updates)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('更新文档失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:deleteDocument', async (_, id: string) => {
    try {
      await documentService.deleteDocument(id)
      return { success: true }
    } catch (error: any) {
      console.error('删除文档失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:searchDocuments', async (_, query: any) => {
    try {
      const result = await documentService.searchDocuments(query)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('搜索文档失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:getDocumentHistory', async (_, id: string) => {
    try {
      const result = await documentService.getDocumentHistory(id)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('获取文档历史失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:restoreVersion', async (_, id: string, version: number) => {
    try {
      const result = await documentService.restoreVersion(id, version)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('恢复版本失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 计划管理
  ipcMain.handle('library:createPlan', async (_, requirementId: string, metadata?: any) => {
    try {
      const result = await planService.createPlan(requirementId, metadata)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('创建计划失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:getPlan', async (_, planId: string) => {
    try {
      const result = await planService.getPlan(planId)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('获取计划失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:updatePlan', async (_, planId: string, updates: any) => {
    try {
      const result = await planService.updatePlan(planId, updates)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('更新计划失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:getPlanProgress', async (_, planId: string) => {
    try {
      const result = await planService.getPlanProgress(planId)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('获取计划进度失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 决策管理
  ipcMain.handle('library:createDecision', async (_, request: any) => {
    try {
      const result = await decisionService.createDecision(request)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('创建决策失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:getDecision', async (_, decisionId: string) => {
    try {
      const result = await decisionService.getDecision(decisionId)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('获取决策失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:makeDecision', async (_, decisionId: string, optionId: string, reason?: string) => {
    try {
      const result = await decisionService.makeDecision(decisionId, optionId, reason)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('做出决策失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:getPendingDecisions', async (_, planId?: string) => {
    try {
      const result = await decisionService.getPendingDecisions(planId)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('获取待决策失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 协作管理
  ipcMain.handle('library:startCollaboration', async (_, request: any) => {
    try {
      const result = await collaborationController.startCollaboration(request)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('启动协作失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:getCollaborationSession', async (_, sessionId: string) => {
    try {
      const result = collaborationController.getSession(sessionId)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('获取协作会话失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:executePlan', async (_, sessionId: string) => {
    try {
      const result = await collaborationController.executePlan(sessionId)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('执行计划失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:makeSessionDecision', async (_, sessionId: string, decisionId: string, optionId: string, reason?: string) => {
    try {
      await collaborationController.makeDecision(sessionId, decisionId, optionId, reason)
      return { success: true }
    } catch (error: any) {
      console.error('做出会话决策失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:cancelSession', async (_, sessionId: string, reason?: string) => {
    try {
      await collaborationController.cancelSession(sessionId, reason)
      return { success: true }
    } catch (error: any) {
      console.error('取消会话失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:getSessionProgress', async (_, sessionId: string) => {
    try {
      const result = await collaborationController.getProgress(sessionId)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('获取会话进度失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('library:getSessionPendingDecisions', async (_, sessionId: string) => {
    try {
      const result = await collaborationController.getPendingDecisions(sessionId)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('获取会话待决策失败:', error)
      return { success: false, error: error.message }
    }
  })
}