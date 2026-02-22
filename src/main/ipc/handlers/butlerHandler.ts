import { ipcMain } from 'electron'
import { smartButlerAgent } from '../../agent/SmartButlerAgent'

export function registerButlerHandlers() {
  // 获取所有项目
  ipcMain.handle('butler:getAllProjects', async () => {
    try {
      const projects = smartButlerAgent.getAllProjects()
      return { success: true, projects }
    } catch (error: any) {
      console.error('[ButlerHandler] 获取项目列表失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取活跃项目
  ipcMain.handle('butler:getActiveProject', async () => {
    try {
      const project = smartButlerAgent.getActiveProject()
      return { success: true, project }
    } catch (error: any) {
      console.error('[ButlerHandler] 获取活跃项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取项目详情
  ipcMain.handle('butler:getProject', async (_, projectId: string) => {
    try {
      const project = smartButlerAgent.getProjectInfo(projectId)
      return { success: true, project }
    } catch (error: any) {
      console.error('[ButlerHandler] 获取项目详情失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取项目报告
  ipcMain.handle('butler:getProjectReport', async (_, projectId: string) => {
    try {
      const report = smartButlerAgent.generateProjectReport(projectId)
      return { success: true, report }
    } catch (error: any) {
      console.error('[ButlerHandler] 获取项目报告失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取所有问题
  ipcMain.handle('butler:getAllProblems', async () => {
    try {
      const problems = smartButlerAgent.getAllProblems()
      return { success: true, problems }
    } catch (error: any) {
      console.error('[ButlerHandler] 获取问题列表失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取问题详情
  ipcMain.handle('butler:getProblem', async (_, problemId: string) => {
    try {
      const problem = smartButlerAgent.getProblem(problemId)
      return { success: true, problem }
    } catch (error: any) {
      console.error('[ButlerHandler] 获取问题详情失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取解决方案
  ipcMain.handle('butler:getSolution', async (_, problemId: string) => {
    try {
      const solution = smartButlerAgent.getSolution(problemId)
      return { success: true, solution }
    } catch (error: any) {
      console.error('[ButlerHandler] 获取解决方案失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 手动修复问题
  ipcMain.handle('butler:fixProblem', async (_, problemId: string) => {
    try {
      const problem = smartButlerAgent.getProblem(problemId)
      if (!problem) {
        return { success: false, error: '问题不存在' }
      }

      const solution = await smartButlerAgent.getSolution(problemId)
      if (!solution) {
        return { success: false, error: '解决方案不存在' }
      }

      return { success: true, solution }
    } catch (error: any) {
      console.error('[ButlerHandler] 修复问题失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取智能管家能力
  ipcMain.handle('butler:getCapabilities', async () => {
    try {
      const capabilities = smartButlerAgent.getCapabilities()
      return { success: true, capabilities }
    } catch (error: any) {
      console.error('[ButlerHandler] 获取能力列表失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 启用能力
  ipcMain.handle('butler:enableCapability', async (_, name: string) => {
    try {
      smartButlerAgent.enableCapability(name)
      return { success: true }
    } catch (error: any) {
      console.error('[ButlerHandler] 启用能力失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 禁用能力
  ipcMain.handle('butler:disableCapability', async (_, name: string) => {
    try {
      smartButlerAgent.disableCapability(name)
      return { success: true }
    } catch (error: any) {
      console.error('[ButlerHandler] 禁用能力失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 清理已解决的问题
  ipcMain.handle('butler:cleanup', async () => {
    try {
      smartButlerAgent.cleanupResolvedProblems()
      return { success: true }
    } catch (error: any) {
      console.error('[ButlerHandler] 清理失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 注册问题（供外部调用）
  ipcMain.handle('butler:registerProblem', async (_, error: any, sourceAgent: string, sourcePhase: string, context?: any) => {
    try {
      const problem = await smartButlerAgent.registerProblem(error, sourceAgent, sourcePhase, context)
      return { success: true, problem }
    } catch (error: any) {
      console.error('[ButlerHandler] 注册问题失败:', error)
      return { success: false, error: error.message }
    }
  })

  // ========== 项目记忆系统 ==========

  // 获取项目记忆
  ipcMain.handle('butler:getProjectMemories', async (_, projectId: string) => {
    try {
      const memories = smartButlerAgent.getProjectMemories(projectId)
      return { success: true, memories }
    } catch (error: any) {
      console.error('[ButlerHandler] 获取项目记忆失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 搜索项目记忆
  ipcMain.handle('butler:searchProjectMemories', async (_, query: string, projectId?: string) => {
    try {
      const memories = smartButlerAgent.searchProjectMemories(query, projectId)
      return { success: true, memories }
    } catch (error: any) {
      console.error('[ButlerHandler] 搜索项目记忆失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 添加项目记忆
  ipcMain.handle('butler:addProjectMemory', async (_, 
    projectId: string,
    projectName: string,
    projectPath: string,
    type: 'issue' | 'solution' | 'preference' | 'pattern' | 'command',
    content: string,
    context?: any,
    importance?: number
  ) => {
    try {
      const memory = smartButlerAgent.addProjectMemory(
        projectId,
        projectName,
        projectPath,
        type,
        content,
        context,
        importance
      )
      return { success: true, memory }
    } catch (error: any) {
      console.error('[ButlerHandler] 添加项目记忆失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 更新记忆重要性
  ipcMain.handle('butler:updateMemoryImportance', async (_, projectId: string, memoryId: string, importance: number) => {
    try {
      smartButlerAgent.updateMemoryImportance(projectId, memoryId, importance)
      return { success: true }
    } catch (error: any) {
      console.error('[ButlerHandler] 更新记忆重要性失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 删除记忆
  ipcMain.handle('butler:deleteMemory', async (_, projectId: string, memoryId: string) => {
    try {
      smartButlerAgent.deleteMemory(projectId, memoryId)
      return { success: true }
    } catch (error: any) {
      console.error('[ButlerHandler] 删除记忆失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 清理旧记忆
  ipcMain.handle('butler:cleanupOldMemories', async (_, maxAge?: number) => {
    try {
      smartButlerAgent.cleanupOldMemories(maxAge)
      return { success: true }
    } catch (error: any) {
      console.error('[ButlerHandler] 清理旧记忆失败:', error)
      return { success: false, error: error.message }
    }
  })

  // ========== 项目管理工具 ==========

  // 获取项目管理工具
  ipcMain.handle('butler:getProjectTools', async () => {
    try {
      const tools = smartButlerAgent.getProjectTools()
      return { success: true, tools }
    } catch (error: any) {
      console.error('[ButlerHandler] 获取项目管理工具失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 执行项目管理工具
  ipcMain.handle('butler:executeProjectTool', async (_, toolName: string, projectPath: string, options?: any) => {
    try {
      const result = await smartButlerAgent.executeProjectTool(toolName, projectPath, options)
      return { success: result.success, output: result.output, error: result.error }
    } catch (error: any) {
      console.error('[ButlerHandler] 执行项目管理工具失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 智能问题解决
  ipcMain.handle('butler:solveProjectProblem', async (_, 
    projectId: string,
    projectName: string,
    projectPath: string,
    problemDescription: string
  ) => {
    try {
      const result = await smartButlerAgent.solveProjectProblem(
        projectId,
        projectName,
        projectPath,
        problemDescription
      )
      return { success: result.success, solution: result.solution, steps: result.steps }
    } catch (error: any) {
      console.error('[ButlerHandler] 智能问题解决失败:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[ButlerHandler] 智能管家IPC处理器已注册')
}
