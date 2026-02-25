import { ipcMain } from 'electron'
import { analyticsService, AnalyticsConfig } from '../../services/AnalyticsService'

export function registerAnalyticsHandlers() {
  console.log('[AnalyticsHandler] 注册分析处理器...')

  ipcMain.handle('analytics:track-usage', async (_event, action: string, category: string, details?: Record<string, any>, duration?: number, userId?: string) => {
    try {
      analyticsService.trackUsage(action, category, details, duration, userId)
      return { success: true }
    } catch (error: any) {
      console.error('追踪使用失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:track-performance', async (_event, name: string, value: number, unit?: string, details?: Record<string, any>, userId?: string) => {
    try {
      analyticsService.trackPerformance('ipc', name, value, unit || 'count', details, userId)
      return { success: true }
    } catch (error: any) {
      console.error('追踪性能失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:track-error', async (_event, message: string, category: string, severity: 'low' | 'medium' | 'high' | 'critical', stack?: string, context?: Record<string, any>, userId?: string) => {
    try {
      analyticsService.trackError(category, message, stack, { ...context, severity }, userId)
      return { success: true }
    } catch (error: any) {
      console.error('追踪错误失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:track-behavior', async (_event, type: 'click' | 'scroll' | 'input' | 'navigation' | 'focus', element?: string, page?: string, details?: Record<string, any>, userId?: string) => {
    try {
      analyticsService.trackUsage(`behavior:${type}`, 'behavior', { element, page, ...details }, undefined, userId)
      return { success: true }
    } catch (error: any) {
      console.error('追踪行为失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:mark-error-resolved', async (_event, errorId: string) => {
    try {
      return { success: true, message: `Not supported by current AnalyticsService: ${errorId}` }
    } catch (error: any) {
      console.error('标记错误已解决失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:report', async () => {
    try {
      const summary = await analyticsService.getUsageStatistics('day')
      return { success: true, summary }
    } catch (error: any) {
      console.error('报告事件失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:generate-report', async (_event, startDate?: number, endDate?: number) => {
    try {
      const report = {
        range: { startDate, endDate },
        usage: await analyticsService.getUsageStatistics('month'),
        performance: await analyticsService.getPerformanceStatistics()
      }
      return { success: true, report }
    } catch (error: any) {
      console.error('生成报告失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:get-usage-events', async (_event, _userId?: string, _limit?: number) => {
    try {
      const events = await analyticsService.getUsageStatistics('month')
      return { success: true, events }
    } catch (error: any) {
      console.error('获取使用事件失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:get-performance-metrics', async (_event, _limit?: number) => {
    try {
      const metrics = await analyticsService.getPerformanceStatistics()
      return { success: true, metrics }
    } catch (error: any) {
      console.error('获取性能指标失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:get-error-events', async (_event, _resolved?: boolean, _limit?: number) => {
    try {
      const errors = await analyticsService.getUsageStatistics('month')
      return { success: true, errors }
    } catch (error: any) {
      console.error('获取错误事件失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:get-behavior-events', async (_event, _userId?: string, _limit?: number) => {
    try {
      return { success: true, events: [] }
    } catch (error: any) {
      console.error('获取行为事件失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:get-session-info', async () => {
    try {
      const info = { sessionId: analyticsService.getSessionId() }
      return { success: true, info }
    } catch (error: any) {
      console.error('获取会话信息失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:cleanup', async () => {
    try {
      analyticsService.cleanupOldData()
      return { success: true }
    } catch (error: any) {
      console.error('清理旧事件失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:get-config', async () => {
    try {
      const config = analyticsService.getConfig()
      return { success: true, config }
    } catch (error: any) {
      console.error('获取分析配置失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:update-config', async (_event, newConfig: Partial<AnalyticsConfig>) => {
    try {
      analyticsService.updateConfig(newConfig)
      const config = analyticsService.getConfig()
      return { success: true, config }
    } catch (error: any) {
      console.error('更新分析配置失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:export', async (_event, format: 'json' | 'csv' = 'json') => {
    try {
      const data = {
        format,
        usage: await analyticsService.getUsageStatistics('month'),
        performance: await analyticsService.getPerformanceStatistics()
      }
      return { success: true, data }
    } catch (error: any) {
      console.error('导出事件失败:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[AnalyticsHandler] 分析处理器注册完成')
}
