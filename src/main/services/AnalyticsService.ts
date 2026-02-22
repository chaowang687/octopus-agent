import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import * as os from 'os'

export interface AnalyticsConfig {
  enabled: boolean
  collectUsageStats: boolean
  collectPerformanceStats: boolean
  collectErrorStats: boolean
  collectUserBehavior: boolean
  reportInterval: number // 毫秒
  analyticsServer: string
  apiKey: string
  anonymizeData: boolean
  retentionDays: number
}

export interface UsageEvent {
  id: string
  timestamp: number
  userId?: string
  sessionId: string
  type: string
  action: string
  category: string
  details?: Record<string, any>
  duration?: number
}

export interface PerformanceMetric {
  id: string
  timestamp: number
  userId?: string
  sessionId: string
  type: string
  name: string
  value: number
  unit: string
  details?: Record<string, any>
}

export interface ErrorEvent {
  id: string
  timestamp: number
  userId?: string
  sessionId: string
  type: string
  message: string
  stack?: string
  level: string
  context?: Record<string, any>
}

export interface SessionInfo {
  id: string
  startTime: number
  endTime?: number
  duration?: number
  events: number
  errors: number
  userId?: string
  userAgent: string
  platform: string
  appVersion: string
}

export class AnalyticsService {
  private config: AnalyticsConfig
  private analyticsDir: string
  private sessionId: string
  private usageEvents: UsageEvent[] = []
  private performanceMetrics: PerformanceMetric[] = []
  private errorEvents: ErrorEvent[] = []
  private sessions: SessionInfo[] = []
  private reportTimer?: NodeJS.Timeout
  private initialized: boolean = false

  constructor(config?: Partial<AnalyticsConfig>) {
    this.analyticsDir = path.join(process.cwd(), 'analytics')
    this.config = {
      enabled: true,
      collectUsageStats: true,
      collectPerformanceStats: true,
      collectErrorStats: true,
      collectUserBehavior: false,
      reportInterval: 5 * 60 * 1000, // 5分钟
      analyticsServer: '',
      apiKey: '',
      anonymizeData: true,
      retentionDays: 30,
      ...config
    }

    this.sessionId = uuidv4()
  }

  initialize() {
    if (this.initialized) return
    
    try {
      this.initializeAnalyticsDirectory()
      this.loadHistoricalData()
      this.startReporting()
      this.initialized = true
      console.log('[AnalyticsService] 服务初始化完成')
    } catch (error) {
      console.error('[AnalyticsService] 初始化失败:', error)
    }
  }

  private initializeAnalyticsDirectory(): void {
    try {
      if (!fs.existsSync(this.analyticsDir)) {
        fs.mkdirSync(this.analyticsDir, { recursive: true, mode: 0o755 })
        console.log('[AnalyticsService] 创建分析目录:', this.analyticsDir)
      } else {
        console.log('[AnalyticsService] 分析目录已存在:', this.analyticsDir)
      }

      const subdirectories = ['events', 'metrics', 'errors', 'sessions']
      for (const subdir of subdirectories) {
        const dirPath = path.join(this.analyticsDir, subdir)
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 })
        }
      }
    } catch (error: any) {
      console.error('[AnalyticsService] 创建分析目录失败:', error)
      // 使用备用目录
      this.analyticsDir = path.join(process.cwd(), 'analytics')
      try {
        if (!fs.existsSync(this.analyticsDir)) {
          fs.mkdirSync(this.analyticsDir, { recursive: true, mode: 0o755 })
          console.log('[AnalyticsService] 使用备用分析目录:', this.analyticsDir)
        }
      } catch (analyticsError) {
        console.error('[AnalyticsService] 备用目录也失败:', analyticsError)
      }
    }
  }

  private loadHistoricalData(): void {
    try {
      const sessionsPath = path.join(this.analyticsDir, 'sessions', 'sessions.json')
      if (fs.existsSync(sessionsPath)) {
        const data = fs.readFileSync(sessionsPath, 'utf-8')
        this.sessions = JSON.parse(data)
        console.log('[AnalyticsService] 加载历史会话:', this.sessions.length, '个会话')
      }
    } catch (error) {
      console.error('[AnalyticsService] 加载历史数据失败:', error)
    }
  }

  private startReporting(): void {
    if (this.config.reportInterval > 0) {
      this.reportTimer = setInterval(() => {
        this.reportData()
      }, this.config.reportInterval)
      console.log('[AnalyticsService] 报告定时器已启动，间隔:', this.config.reportInterval / 1000 / 60, '分钟')
    }
  }

  private stopReporting(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer)
      this.reportTimer = undefined
      console.log('[AnalyticsService] 报告定时器已停止')
    }
  }

  trackUsage(action: string, category: string, details?: Record<string, any>, duration?: number, userId?: string): void {
    if (!this.config.enabled || !this.config.collectUsageStats) return

    if (!this.initialized) {
      this.initialize()
    }

    const event: UsageEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      userId,
      sessionId: this.sessionId,
      type: 'usage',
      action,
      category,
      details,
      duration
    }

    this.usageEvents.push(event)
    this.saveEvent(event, 'events')
    console.log('[AnalyticsService] 跟踪使用事件:', action, category)
  }

  trackPerformance(type: string, name: string, value: number, unit: string, details?: Record<string, any>, userId?: string): void {
    if (!this.config.enabled || !this.config.collectPerformanceStats) return

    if (!this.initialized) {
      this.initialize()
    }

    const metric: PerformanceMetric = {
      id: uuidv4(),
      timestamp: Date.now(),
      userId,
      sessionId: this.sessionId,
      type,
      name,
      value,
      unit,
      details
    }

    this.performanceMetrics.push(metric)
    this.saveMetric(metric, 'metrics')
    console.log('[AnalyticsService] 跟踪性能指标:', name, value, unit)
  }

  trackError(type: string, message: string, stack?: string, context?: Record<string, any>, userId?: string): void {
    if (!this.config.enabled || !this.config.collectErrorStats) return

    if (!this.initialized) {
      this.initialize()
    }

    const error: ErrorEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      userId,
      sessionId: this.sessionId,
      type,
      message,
      stack,
      level: 'error',
      context
    }

    this.errorEvents.push(error)
    this.saveError(error, 'errors')
    console.error('[AnalyticsService] 跟踪错误:', type, message)
  }

  private saveEvent(event: UsageEvent, directory: string): void {
    if (!this.initialized) return

    try {
      const eventsDir = path.join(this.analyticsDir, directory)
      if (!fs.existsSync(eventsDir)) {
        fs.mkdirSync(eventsDir, { recursive: true, mode: 0o755 })
      }

      const fileName = `events_${new Date().toISOString().split('T')[0]}.json`
      const filePath = path.join(eventsDir, fileName)

      let events: UsageEvent[] = []
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8')
        events = JSON.parse(data)
      }

      events.push(event)
      fs.writeFileSync(filePath, JSON.stringify(events, null, 2))
    } catch (error) {
      console.error('[AnalyticsService] 保存事件失败:', error)
    }
  }

  private saveMetric(metric: PerformanceMetric, directory: string): void {
    if (!this.initialized) return

    try {
      const metricsDir = path.join(this.analyticsDir, directory)
      if (!fs.existsSync(metricsDir)) {
        fs.mkdirSync(metricsDir, { recursive: true, mode: 0o755 })
      }

      const fileName = `metrics_${new Date().toISOString().split('T')[0]}.json`
      const filePath = path.join(metricsDir, fileName)

      let metrics: PerformanceMetric[] = []
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8')
        metrics = JSON.parse(data)
      }

      metrics.push(metric)
      fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2))
    } catch (error) {
      console.error('[AnalyticsService] 保存指标失败:', error)
    }
  }

  private saveError(error: ErrorEvent, directory: string): void {
    if (!this.initialized) return

    try {
      const errorsDir = path.join(this.analyticsDir, directory)
      if (!fs.existsSync(errorsDir)) {
        fs.mkdirSync(errorsDir, { recursive: true, mode: 0o755 })
      }

      const fileName = `errors_${new Date().toISOString().split('T')[0]}.json`
      const filePath = path.join(errorsDir, fileName)

      let errors: ErrorEvent[] = []
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8')
        errors = JSON.parse(data)
      }

      errors.push(error)
      fs.writeFileSync(filePath, JSON.stringify(errors, null, 2))
    } catch (error) {
      console.error('[AnalyticsService] 保存错误失败:', error)
    }
  }

  private async reportData(): Promise<void> {
    if (!this.config.enabled || !this.config.analyticsServer) return

    console.log('[AnalyticsService] 开始报告数据...')

    try {
      const dataToReport = {
        events: this.usageEvents,
        metrics: this.performanceMetrics,
        errors: this.errorEvents,
        sessionId: this.sessionId,
        timestamp: Date.now()
      }

      console.log('[AnalyticsService] 报告数据:', {
        events: this.usageEvents.length,
        metrics: this.performanceMetrics.length,
        errors: this.errorEvents.length
      })

      this.usageEvents = []
      this.performanceMetrics = []
      this.errorEvents = []
    } catch (error) {
      console.error('[AnalyticsService] 报告数据失败:', error)
    }
  }

  startSession(userId?: string): void {
    if (!this.initialized) {
      this.initialize()
    }

    this.sessionId = uuidv4()
    const session: SessionInfo = {
      id: this.sessionId,
      startTime: Date.now(),
      userId,
      userAgent: '',
      platform: os.platform(),
      appVersion: app.getVersion(),
      events: 0,
      errors: 0
    }

    this.sessions.push(session)
    this.saveSessions()
    console.log('[AnalyticsService] 会话已启动:', this.sessionId)
  }

  endSession(): void {
    if (!this.initialized) return

    const session = this.sessions.find(s => s.id === this.sessionId)
    if (session) {
      session.endTime = Date.now()
      session.duration = session.endTime - session.startTime
      session.events = this.usageEvents.length
      session.errors = this.errorEvents.length
      this.saveSessions()
      console.log('[AnalyticsService] 会话已结束:', this.sessionId, '持续时间:', session.duration, '毫秒')
    }
  }

  private saveSessions(): void {
    if (!this.initialized) return

    try {
      const sessionsDir = path.join(this.analyticsDir, 'sessions')
      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true, mode: 0o755 })
      }

      const filePath = path.join(sessionsDir, 'sessions.json')
      fs.writeFileSync(filePath, JSON.stringify(this.sessions, null, 2))
    } catch (error) {
      console.error('[AnalyticsService] 保存会话失败:', error)
    }
  }

  async getUsageStatistics(timeRange: 'day' | 'week' | 'month' | 'year'): Promise<any> {
    if (!this.initialized) {
      this.initialize()
    }

    const now = Date.now()
    let startTime = 0

    switch (timeRange) {
      case 'day':
        startTime = now - 24 * 60 * 60 * 1000
        break
      case 'week':
        startTime = now - 7 * 24 * 60 * 60 * 1000
        break
      case 'month':
        startTime = now - 30 * 24 * 60 * 60 * 1000
        break
      case 'year':
        startTime = now - 365 * 24 * 60 * 60 * 1000
        break
    }

    const stats = {
      totalEvents: 0,
      totalErrors: 0,
      totalSessions: 0,
      averageSessionDuration: 0,
      topActions: [] as Array<{ action: string, count: number }>,
      errorTypes: [] as Array<{ type: string, count: number }>
    }

    return stats
  }

  async getPerformanceStatistics(): Promise<any> {
    if (!this.initialized) {
      this.initialize()
    }

    return {
      metrics: this.performanceMetrics,
      averageResponseTime: 0,
      peakMemoryUsage: 0,
      cpuUsage: 0
    }
  }

  cleanupOldData(): void {
    if (!this.initialized) return

    try {
      const retentionTime = this.config.retentionDays * 24 * 60 * 60 * 1000
      const cutoffTime = Date.now() - retentionTime

      const directories = ['events', 'metrics', 'errors']
      for (const directory of directories) {
        const dirPath = path.join(this.analyticsDir, directory)
        if (fs.existsSync(dirPath)) {
          const files = fs.readdirSync(dirPath)
          for (const file of files) {
            const filePath = path.join(dirPath, file)
            const stats = fs.statSync(filePath)
            if (stats.mtimeMs < cutoffTime) {
              fs.unlinkSync(filePath)
              console.log('[AnalyticsService] 删除旧数据文件:', filePath)
            }
          }
        }
      }

      this.sessions = this.sessions.filter(session => {
        return session.startTime > cutoffTime
      })
      this.saveSessions()

      console.log('[AnalyticsService] 清理旧数据完成')
    } catch (error) {
      console.error('[AnalyticsService] 清理旧数据失败:', error)
    }
  }

  updateConfig(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig }

    if (newConfig.reportInterval !== undefined) {
      this.stopReporting()
      if (this.initialized) {
        this.startReporting()
      }
    }

    console.log('[AnalyticsService] 配置已更新:', this.config)
  }

  getConfig(): AnalyticsConfig {
    return { ...this.config }
  }

  getSessionId(): string {
    return this.sessionId
  }

  resetSession(): void {
    this.endSession()
    this.startSession()
  }

  destroy(): void {
    this.endSession()
    this.stopReporting()
    console.log('[AnalyticsService] 服务已销毁')
  }
}

export const analyticsService = new AnalyticsService()
