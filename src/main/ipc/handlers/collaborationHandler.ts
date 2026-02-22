import { ipcMain, BrowserWindow } from 'electron'

// ============================================
// 协作阶段类型
// ============================================
export enum CollaborationPhase {
  REQUIREMENTS = 'requirements',       // 需求分析
  ARCHITECTURE = 'architecture',       // 架构设计
  IMPLEMENTATION = 'implementation',    // 实现方案
  REVIEW = 'review'                    // 方案评审
}

// ============================================
// 协作请求接口
// ============================================
export interface CollaborationRequest {
  id: string
  taskId: string
  phase: CollaborationPhase
  title: string
  description: string
  content: any              // 当前阶段的方案内容
  alternatives?: string[]   // 考虑的替代方案
  editableParams?: string[] // 用户可编辑的参数
  timestamp: number
  status: 'pending' | 'approved' | 'rejected' | 'modified'
  userResponse?: string     // 用户的反馈
  modifiedParams?: any      // 用户修改的参数
}

// ============================================
// 协作管理器
// ============================================
class CollaborationManager {
  private pendingRequests: Map<string, CollaborationRequest> = new Map()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  // 创建新的协作请求
  async requestCollaboration(
    taskId: string,
    phase: CollaborationPhase,
    title: string,
    description: string,
    content: any,
    alternatives?: string[],
    editableParams?: string[]
  ): Promise<CollaborationRequest> {
    const request: CollaborationRequest = {
      id: `collab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      taskId,
      phase,
      title,
      description,
      content,
      alternatives,
      editableParams,
      timestamp: Date.now(),
      status: 'pending'
    }

    this.pendingRequests.set(request.id, request)
    
    // 发送到前端显示
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('collaboration:request', request)
    }

    // 等待用户响应
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const req = this.pendingRequests.get(request.id)
        if (req && req.status !== 'pending') {
          clearInterval(checkInterval)
          resolve(req)
        }
      }, 100)

      // 超时 10 分钟
      setTimeout(() => {
        clearInterval(checkInterval)
        if (this.pendingRequests.has(request.id)) {
          const req = this.pendingRequests.get(request.id)!
          req.status = 'rejected'
          req.userResponse = '超时自动拒绝'
          resolve(req)
        }
      }, 600000)
    })
  }

  // 用户批准
  approveCollaboration(requestId: string, response?: string) {
    const request = this.pendingRequests.get(requestId)
    if (request) {
      request.status = 'approved'
      request.userResponse = response || '用户已确认方案'
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('collaboration:response', request)
      }
    }
  }

  // 用户拒绝
  rejectCollaboration(requestId: string, reason?: string) {
    const request = this.pendingRequests.get(requestId)
    if (request) {
      request.status = 'rejected'
      request.userResponse = reason || '用户拒绝方案'
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('collaboration:response', request)
      }
    }
  }

  // 用户修改方案
  modifyCollaboration(requestId: string, modifiedParams: any, response?: string) {
    const request = this.pendingRequests.get(requestId)
    if (request) {
      request.status = 'modified'
      request.modifiedParams = modifiedParams
      request.userResponse = response || '用户已修改方案'
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('collaboration:response', request)
      }
    }
  }

  // 获取待处理的协作请求
  getPendingRequests(taskId?: string): CollaborationRequest[] {
    if (taskId) {
      return Array.from(this.pendingRequests.values()).filter(r => r.taskId === taskId)
    }
    return Array.from(this.pendingRequests.values())
  }

  // 取消请求
  cancelRequest(requestId: string) {
    this.pendingRequests.delete(requestId)
  }
}

// 导出单例
export const collaborationManager = new CollaborationManager()

// ============================================
// IPC 处理器
// ============================================
export function registerCollaborationHandlers() {
  // 创建协作请求
  ipcMain.handle('collaboration:request', async (_, data: {
    taskId: string
    phase: CollaborationPhase
    title: string
    description: string
    content: any
    alternatives?: string[]
    editableParams?: string[]
  }) => {
    const result = await collaborationManager.requestCollaboration(
      data.taskId,
      data.phase,
      data.title,
      data.description,
      data.content,
      data.alternatives,
      data.editableParams
    )
    return result
  })

  // 批准协作
  ipcMain.handle('collaboration:approve', (_, requestId: string, response?: string) => {
    collaborationManager.approveCollaboration(requestId, response)
    return { success: true }
  })

  // 拒绝协作
  ipcMain.handle('collaboration:reject', (_, requestId: string, reason?: string) => {
    collaborationManager.rejectCollaboration(requestId, reason)
    return { success: true }
  })

  // 修改协作
  ipcMain.handle('collaboration:modify', (_, requestId: string, modifiedParams: any, response?: string) => {
    collaborationManager.modifyCollaboration(requestId, modifiedParams, response)
    return { success: true }
  })

  // 获取待处理请求
  ipcMain.handle('collaboration:getPending', (_, taskId?: string) => {
    return collaborationManager.getPendingRequests(taskId)
  })

  console.log('[CollaborationHandler] 协作处理器已注册')
}
