import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export enum ErrorCategory {
  NETWORK = 'network',
  FILE_SYSTEM = 'file_system',
  API = 'api',
  TOOL_EXECUTION = 'tool_execution',
  TASK_EXECUTION = 'task_execution',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  component?: string
  operation?: string
  details?: Record<string, any>
  timestamp?: number
  userId?: string
  sessionId?: string
  stepId?: string
  tool?: string
  taskId?: string
  instruction?: string
  model?: string
}

export class AppError extends Error {
  public readonly category: ErrorCategory
  public readonly severity: ErrorSeverity
  public readonly context: ErrorContext
  public readonly originalError?: Error
  public readonly userMessage: string

  constructor(
    message: string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: ErrorContext = {},
    originalError?: Error
  ) {
    super(message)
    this.name = 'AppError'
    this.category = category
    this.severity = severity
    this.context = context
    this.originalError = originalError
    this.userMessage = this.generateUserMessage()
    Error.captureStackTrace(this, this.constructor)
  }

  private generateUserMessage(): string {
    const userMessages: Record<ErrorCategory, string> = {
      [ErrorCategory.NETWORK]: '网络连接出现问题，请检查您的网络设置',
      [ErrorCategory.FILE_SYSTEM]: '文件操作失败，请检查文件权限和路径',
      [ErrorCategory.API]: 'API调用失败，请检查API密钥配置',
      [ErrorCategory.TOOL_EXECUTION]: '工具执行失败，请检查操作参数',
      [ErrorCategory.TASK_EXECUTION]: '任务执行失败，请稍后重试',
      [ErrorCategory.VALIDATION]: '输入参数验证失败，请检查输入内容',
      [ErrorCategory.PERMISSION]: '权限不足，请检查文件或操作权限',
      [ErrorCategory.TIMEOUT]: '操作超时，请稍后重试或增加超时时间',
      [ErrorCategory.UNKNOWN]: '发生未知错误，请联系技术支持'
    }
    
    return userMessages[this.category] || userMessages[ErrorCategory.UNKNOWN]
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      context: this.context,
      userMessage: this.userMessage,
      stack: this.stack
    }
  }
}

export class ErrorHandler {
  private static logFilePath: string
  private static maxLogFileSize = 10 * 1024 * 1024
  private static maxLogFiles = 5
  private static initialized = false

  static initialize() {
    if (this.initialized) return
    
    try {
      const userDataPath = app.getPath('userData')
      const logsDir = path.join(userDataPath, 'logs')
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
      }
      this.logFilePath = path.join(logsDir, 'error.log')
      this.initialized = true
    } catch (error) {
      this.logFilePath = '/tmp/error.log'
      this.initialized = true
    }
  }

  static {
    this.initialize()
  }

  static handleError(error: Error | AppError, context: ErrorContext = {}): AppError {
    let appError: AppError

    if (error instanceof AppError) {
      if (context && Object.keys(context).length > 0) {
        // 使用AppError构造函数创建新的错误对象，因为context是只读属性
        appError = new AppError(
          error.message,
          error.category,
          error.severity,
          { ...error.context, ...context },
          error.originalError
        )
      } else {
        appError = error
      }
    } else {
      const category = this.categorizeError(error)
      const severity = this.determineSeverity(error)
      appError = new AppError(
        error.message || 'Unknown error',
        category,
        severity,
        context,
        error
      )
    }

    this.logError(appError)
    return appError
  }

  static createError(
    message: string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: ErrorContext = {}
  ): AppError {
    const error = new AppError(message, category, severity, context)
    this.logError(error)
    return error
  }

  static wrapError(
    error: Error | string | null | undefined,
    defaultMessage: string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    context: ErrorContext = {}
  ): AppError {
    const errorMessage = typeof error === 'string' ? error : error?.message
    const finalMessage = errorMessage || defaultMessage
    
    const originalErrorObj = typeof error === 'object' && error !== null ? error : undefined
    
    const appError = new AppError(
      finalMessage,
      category,
      ErrorSeverity.MEDIUM,
      context,
      originalErrorObj
    )
    
    this.logError(appError)
    return appError
  }

  static categorizeError(error: Error | { message?: string }): ErrorCategory {
    const message = error.message?.toLowerCase() || ''
    
    if (message.includes('task') || message.includes('plan') || message.includes('step')) {
      return ErrorCategory.TASK_EXECUTION
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ErrorCategory.NETWORK
    }
    if (message.includes('file') || message.includes('directory') || message.includes('path')) {
      return ErrorCategory.FILE_SYSTEM
    }
    if (message.includes('api') || message.includes('http') || message.includes('status')) {
      return ErrorCategory.API
    }
    if (message.includes('tool') || message.includes('command') || message.includes('execution')) {
      return ErrorCategory.TOOL_EXECUTION
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return ErrorCategory.VALIDATION
    }
    if (message.includes('permission') || message.includes('access denied') || message.includes('eacces')) {
      return ErrorCategory.PERMISSION
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorCategory.TIMEOUT
    }
    
    return ErrorCategory.UNKNOWN
  }

  static determineSeverity(error: Error | { message?: string }): ErrorSeverity {
    const message = error.message?.toLowerCase() || ''
    
    if (message.includes('critical') || message.includes('fatal') || message.includes('crash')) {
      return ErrorSeverity.CRITICAL
    }
    if (message.includes('error') || message.includes('failed') || message.includes('exception')) {
      return ErrorSeverity.HIGH
    }
    if (message.includes('warning') || message.includes('deprecated')) {
      return ErrorSeverity.MEDIUM
    }
    
    return ErrorSeverity.LOW
  }

  private static logError(error: AppError): void {
    try {
      this.rotateLogsIfNeeded()

      const logEntry = {
        timestamp: new Date().toISOString(),
        level: error.severity.toUpperCase(),
        category: error.category,
        message: error.message,
        userMessage: error.userMessage,
        context: error.context,
        stack: error.stack
      }

      const logLine = JSON.stringify(logEntry) + '\n'
      fs.appendFileSync(this.logFilePath, logLine, 'utf8')
      
      console.error(`[${error.category.toUpperCase()}] ${error.message}`)
      console.error(`User message: ${error.userMessage}`)
      if (error.context.component) {
        console.error(`Component: ${error.context.component}`)
      }
      if (error.context.operation) {
        console.error(`Operation: ${error.context.operation}`)
      }
    } catch (logError) {
      console.error('Failed to write error log:', logError)
      console.error('Original error:', error)
    }
  }

  private static rotateLogsIfNeeded(): void {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return
      }

      const stats = fs.statSync(this.logFilePath)
      if (stats.size < this.maxLogFileSize) {
        return
      }

      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldPath = path.join(path.dirname(this.logFilePath), `error.${i}.log`)
        const newPath = path.join(path.dirname(this.logFilePath), `error.${i + 1}.log`)
        
        if (fs.existsSync(oldPath)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldPath)
          } else {
            fs.renameSync(oldPath, newPath)
          }
        }
      }

      fs.renameSync(this.logFilePath, path.join(path.dirname(this.logFilePath), 'error.1.log'))
    } catch (error) {
      console.error('Failed to rotate logs:', error)
    }
  }

  static getErrorLogs(limit: number = 100): any[] {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return []
      }

      const content = fs.readFileSync(this.logFilePath, 'utf8')
      const lines = content.split('\n').filter(line => line.trim())
      
      return lines
        .slice(-limit)
        .map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        })
        .filter(log => log !== null)
    } catch (error) {
      console.error('Failed to read error logs:', error)
      return []
    }
  }

  static clearErrorLogs(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        fs.unlinkSync(this.logFilePath)
      }
      
      const logDir = path.dirname(this.logFilePath)
      const files = fs.readdirSync(logDir)
      files.forEach(file => {
        if (file.startsWith('error.') && file.endsWith('.log')) {
          const filePath = path.join(logDir, file)
          fs.unlinkSync(filePath)
        }
      })
    } catch (error) {
      console.error('Failed to clear error logs:', error)
    }
  }

  static formatErrorForUser(error: AppError): string {
    const severityEmoji: Record<ErrorSeverity, string> = {
      [ErrorSeverity.LOW]: 'ℹ️',
      [ErrorSeverity.MEDIUM]: '⚠️',
      [ErrorSeverity.HIGH]: '❌',
      [ErrorSeverity.CRITICAL]: '🚨'
    }

    const emoji = severityEmoji[error.severity]
    const title = error.userMessage
    
    let details = ''
    if (error.context.component) {
      details += `\n位置: ${error.context.component}`
    }
    if (error.context.operation) {
      details += `\n操作: ${error.context.operation}`
    }
    
    let suggestion = ''
    switch (error.category) {
      case ErrorCategory.NETWORK:
        suggestion = '\n建议: 检查网络连接，确保可以访问外部服务'
        break
      case ErrorCategory.FILE_SYSTEM:
        suggestion = '\n建议: 检查文件路径和权限，确保文件可访问'
        break
      case ErrorCategory.API:
        suggestion = '\n建议: 检查API密钥配置，确保密钥有效'
        break
      case ErrorCategory.TOOL_EXECUTION:
        suggestion = '\n建议: 检查工具参数，确保输入正确'
        break
      case ErrorCategory.TASK_EXECUTION:
        suggestion = '\n建议: 稍后重试，或检查任务配置'
        break
      case ErrorCategory.VALIDATION:
        suggestion = '\n建议: 检查输入参数，确保格式正确'
        break
      case ErrorCategory.PERMISSION:
        suggestion = '\n建议: 检查文件或操作权限，确保有足够权限'
        break
      case ErrorCategory.TIMEOUT:
        suggestion = '\n建议: 增加超时时间或检查网络连接'
        break
      case ErrorCategory.UNKNOWN:
        suggestion = '\n建议: 联系技术支持，提供错误详情'
        break
    }
    
    return `${emoji} ${title}${details}${suggestion}`
  }

  static formatErrorForDeveloper(error: AppError): string {
    const errorInfo = {
      name: error.name,
      message: error.message,
      category: error.category,
      severity: error.severity,
      context: error.context,
      userMessage: error.userMessage,
      stack: error.stack
    }
    
    return JSON.stringify(errorInfo, null, 2)
  }
}
