/**
 * Error Handler
 * 全局错误处理器
 */

import { EventEmitter } from 'events'
import { AgentError, ErrorCode, ErrorSeverity, ErrorFactory } from './ErrorRegistry'

export interface ErrorHandlerOptions {
  logErrors?: boolean
  showNotifications?: boolean
  maxRetries?: number
}

export interface ErrorLogEntry {
  id: string
  error: AgentError
  context?: string
  timestamp: number
  resolved: boolean
}

/**
 * 全局错误处理器
 */
export class ErrorHandler extends EventEmitter {
  private options: ErrorHandlerOptions
  private errorLog: Map<string, ErrorLogEntry> = new Map()
  private errorListeners: Map<ErrorCode, (error: AgentError) => void> = new Map()

  constructor(options: ErrorHandlerOptions = {}) {
    super()
    this.options = {
      logErrors: options.logErrors ?? true,
      showNotifications: options.showNotifications ?? false,
      maxRetries: options.maxRetries ?? 3
    }
  }

  /**
   * 处理错误
   */
  handle(error: Error | AgentError, context?: string): AgentError {
    let agentError: AgentError

    if (error instanceof AgentError) {
      agentError = error
    } else {
      agentError = ErrorFactory.wrap(error, ErrorCode.UNKNOWN)
    }

    // 记录错误
    if (this.options.logErrors) {
      this.logError(agentError, context)
    }

    // 触发错误事件
    this.emit('error', agentError)

    // 调用特定错误类型的监听器
    const listener = this.errorListeners.get(agentError.code)
    if (listener) {
      listener(agentError)
    }

    return agentError
  }

  /**
   * 记录错误
   */
  private logError(error: AgentError, context?: string): void {
    const entry: ErrorLogEntry = {
      id: `error_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      error,
      context,
      timestamp: Date.now(),
      resolved: false
    }

    this.errorLog.set(entry.id, entry)

    // 保留最近的 1000 条错误记录
    if (this.errorLog.size > 1000) {
      const firstKey = this.errorLog.keys().next().value
      if (firstKey) {
        this.errorLog.delete(firstKey)
      }
    }

    // 输出到控制台
    console.error(`[Error] ${error.code}: ${error.message}`, {
      context,
      severity: error.severity,
      timestamp: new Date(error.timestamp).toISOString()
    })
  }

  /**
   * 注册错误监听器
   */
  onError(code: ErrorCode, handler: (error: AgentError) => void): void {
    this.errorListeners.set(code, handler)
  }

  /**
   * 移除错误监听器
   */
  offError(code: ErrorCode): void {
    this.errorListeners.delete(code)
  }

  /**
   * 获取错误日志
   */
  getErrorLog(limit: number = 100): ErrorLogEntry[] {
    return Array.from(this.errorLog.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  /**
   * 获取特定上下文的错误
   */
  getErrorsByContext(context: string): ErrorLogEntry[] {
    return Array.from(this.errorLog.values())
      .filter(entry => entry.context === context)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 标记错误为已解决
   */
  resolveError(errorId: string): boolean {
    const entry = this.errorLog.get(errorId)
    if (entry) {
      entry.resolved = true
      return true
    }
    return false
  }

  /**
   * 获取错误统计
   */
  getStats(): { total: number; unresolved: number; bySeverity: Record<ErrorSeverity, number>; byCode: Record<ErrorCode, number> } {
    const entries = Array.from(this.errorLog.values())
    
    const bySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    }

    const byCode: Record<ErrorCode, number> = {} as any

    for (const entry of entries) {
      bySeverity[entry.error.severity]++
      byCode[entry.error.code] = (byCode[entry.error.code] || 0) + 1
    }

    return {
      total: entries.length,
      unresolved: entries.filter(e => !e.resolved).length,
      bySeverity,
      byCode
    }
  }

  /**
   * 清空错误日志
   */
  clearLog(): void {
    this.errorLog.clear()
  }
}

export const errorHandler = new ErrorHandler()