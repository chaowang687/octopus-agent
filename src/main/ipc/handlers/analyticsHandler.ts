import { ipcMain } from 'electron'
import { analyticsService, AnalyticsConfig, AnalyticsReport, UsageEvent, PerformanceMetric, ErrorEvent, UserBehaviorEvent } from '../../services/AnalyticsService'

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
      analyticsService.trackPerformance(name, value, unit, details, userId)
      return { success: true }
    } catch (error: any) {
      console.error('追踪性能失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:track-error', async (_event, message: string, category: string, severity: 'low' | 'medium' | 'high' | 'critical', stack?: string, context?: Record<string, any>, userId?: string) => {
    try {
      analyticsService.trackError(message, category, severity, stack, context, userId)
      return { success: true }
    } catch (error: any) {
      console.error('追踪错误失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:track-behavior', async (_event, type: 'click' | 'scroll' | 'input' | 'navigation' | 'focus', element?: string, page?: string, details?: Record<string, any>, userId?: string) => {
    try {
      analyticsService.trackBehavior(type, element, page, details, userId)
      return { success: true }
    } catch (error: any) {
      console.error('追踪行为失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:mark-error-resolved', async (_event, errorId: string) => {
    try {
      analyticsService.markErrorResolved(errorId)
      return { success: true }
    } catch (error: any) {
      console.error('标记错误已解决失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:report', async () => {
    try {
      const success = await analyticsService.reportEvents()
      return { success }
    } catch (error: any) {
      console.error('报告事件失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:generate-report', async (_event, startDate?: number, endDate?: number) => {
    try {
      const report = analyticsService.generateReport(startDate, endDate)
      return { success: true, report }
    } catch (error: any) {
      console.error('生成报告失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:get-usage-events', async (_event, userId?: string, limit?: number) => {
    try {
      const events = analyticsService.getUsageEvents(userId, limit)
      return { success: true, events }
    } catch (error: any) {
      console.error('获取使用事件失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:get-performance-metrics', async (_event, limit?: number) => {
    try {
      const metrics = analyticsService.getPerformanceMetrics(limit)
      return { success: true, metrics }
    } catch (error: any) {
      console.error('获取性能指标失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:get-error-events', async (_event, resolved?: boolean, limit?: number) => {
    try {
      const errors = analyticsService.getErrorEvents(resolved, limit)
      return { success: true, errors }
    } catch (error: any) {
      console.error('获取错误事件失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:get-behavior-events', async (_event, userId?: string, limit?: number) => {
    try {
      const events = analyticsService.getBehaviorEvents(userId, limit)
      return { success: true, events }
    } catch (error: any) {
      console.error('获取行为事件失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:get-session-info', async () => {
    try {
      const info = analyticsService.getSessionInfo()
      return { success: true, info }
    } catch (error: any) {
      console.error('获取会话信息失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analytics:cleanup', async () => {
    try {
      analyticsService.cleanupOldEvents()
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
      const data = analyticsService.exportEvents(format)
      return { success: true, data }
    } catch (error: any) {
      console.error('导出事件失败:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[AnalyticsHandler] 分析处理器注册完成')
}
