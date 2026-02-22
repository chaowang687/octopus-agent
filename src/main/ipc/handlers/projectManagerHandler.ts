import { ipcMain } from 'electron'
import { projectManager } from '../../services/ProjectManager'

export function registerProjectManagerHandlers() {
  ipcMain.handle('projectManager:create', async (_event, data: any) => {
    try {
      const project = projectManager.createProject(data)
      return { success: true, project }
    } catch (error: any) {
      console.error('创建项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:get', async (_event, projectId: string) => {
    try {
      const project = projectManager.getProject(projectId)
      if (!project) {
        return { success: false, error: '项目不存在' }
      }
      return { success: true, project }
    } catch (error: any) {
      console.error('获取项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:list', async (_event, filter?: any) => {
    try {
      const projects = projectManager.listProjects(filter)
      return { success: true, projects }
    } catch (error: any) {
      console.error('列出项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:update', async (_event, projectId: string, updates: any) => {
    try {
      const project = projectManager.updateProject(projectId, updates)
      if (!project) {
        return { success: false, error: '项目不存在' }
      }
      return { success: true, project }
    } catch (error: any) {
      console.error('更新项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:delete', async (_event, projectId: string) => {
    try {
      const success = projectManager.deleteProject(projectId)
      if (!success) {
        return { success: false, error: '项目不存在' }
      }
      return { success: true }
    } catch (error: any) {
      console.error('删除项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:addTask', async (_event, data: any) => {
    try {
      const task = projectManager.addTask(data)
      return { success: true, task }
    } catch (error: any) {
      console.error('添加任务失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:getTask', async (_event, taskId: string) => {
    try {
      const task = projectManager.getTask(taskId)
      if (!task) {
        return { success: false, error: '任务不存在' }
      }
      return { success: true, task }
    } catch (error: any) {
      console.error('获取任务失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:getTasks', async (_event, projectId: string) => {
    try {
      const tasks = projectManager.getProjectTasks(projectId)
      return { success: true, tasks }
    } catch (error: any) {
      console.error('获取任务列表失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:updateTask', async (_event, taskId: string, updates: any) => {
    try {
      const task = projectManager.updateTask(taskId, updates)
      if (!task) {
        return { success: false, error: '任务不存在' }
      }
      return { success: true, task }
    } catch (error: any) {
      console.error('更新任务失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:deleteTask', async (_event, taskId: string) => {
    try {
      const success = projectManager.deleteTask(taskId)
      if (!success) {
        return { success: false, error: '任务不存在' }
      }
      return { success: true }
    } catch (error: any) {
      console.error('删除任务失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:addTaskComment', async (_event, taskId: string, author: string, content: string) => {
    try {
      const task = projectManager.addTaskComment(taskId, author, content)
      if (!task) {
        return { success: false, error: '任务不存在' }
      }
      return { success: true, task }
    } catch (error: any) {
      console.error('添加任务评论失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:generateReport', async (_event, projectId: string, type: string, title: string) => {
    try {
      const report = projectManager.generateReport(projectId, type as any, title)
      return { success: true, report }
    } catch (error: any) {
      console.error('生成报告失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:getReports', async (_event, projectId: string) => {
    try {
      const reports = projectManager.getProjectReports(projectId)
      return { success: true, reports }
    } catch (error: any) {
      console.error('获取报告列表失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:getReport', async (_event, reportId: string) => {
    try {
      const report = projectManager.getReport(reportId)
      if (!report) {
        return { success: false, error: '报告不存在' }
      }
      return { success: true, report }
    } catch (error: any) {
      console.error('获取报告失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:estimateTime', async (_event, projectId: string) => {
    try {
      const estimate = projectManager.estimateProjectTime(projectId)
      return { success: true, estimate }
    } catch (error: any) {
      console.error('估计时间失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:trackProgress', async (_event, projectId: string) => {
    try {
      const progress = projectManager.trackProjectProgress(projectId)
      return { success: true, progress }
    } catch (error: any) {
      console.error('跟踪进度失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:setMode', async (_event, projectId: string, mode: string) => {
    try {
      const project = projectManager.setProjectMode(projectId, mode as any)
      if (!project) {
        return { success: false, error: '项目不存在' }
      }
      return { success: true, project }
    } catch (error: any) {
      console.error('设置模式失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:getMode', async (_event, projectId: string) => {
    try {
      const mode = projectManager.getProjectMode(projectId)
      if (!mode) {
        return { success: false, error: '项目不存在' }
      }
      return { success: true, mode }
    } catch (error: any) {
      console.error('获取模式失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projectManager:getStatistics', async () => {
    try {
      const statistics = projectManager.getStatistics()
      return { success: true, statistics }
    } catch (error: any) {
      console.error('获取统计信息失败:', error)
      return { success: false, error: error.message }
    }
  })
}
