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
      const tempDir = app.getPath('temp')
      this.logFilePath = path.join(tempDir, 'error.log')
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
    
    // 任务执行错误
    if (message.includes('task') || message.includes('plan') || message.includes('step') || 
        message.includes('execute') || message.includes('run')) {
      return ErrorCategory.TASK_EXECUTION
    }
    
    // 网络错误
    if (message.includes('network') || message.includes('fetch') || message.includes('connection') ||
        message.includes('timeout') || message.includes('timed out') ||
        message.includes('socket') || message.includes('connect') ||
        message.includes('dns') || message.includes('http') ||
        message.includes('request') || message.includes('response')) {
      return ErrorCategory.NETWORK
    }
    
    // 文件系统错误
    if (message.includes('file') || message.includes('directory') || message.includes('path') ||
        message.includes('read') || message.includes('write') ||
        message.includes('create') || message.includes('delete') ||
        message.includes('rename') || message.includes('copy') ||
        message.includes('enoent') || message.includes('eperm') ||
        message.includes('eexist') || message.includes('eacces')) {
      return ErrorCategory.FILE_SYSTEM
    }
    
    // API错误
    if (message.includes('api') || message.includes('http') || message.includes('status') ||
        message.includes('response') || message.includes('request') ||
        message.includes('token') || message.includes('auth') ||
        message.includes('rate limit') || message.includes('quota')) {
      return ErrorCategory.API
    }
    
    // 工具执行错误
    if (message.includes('tool') || message.includes('command') || message.includes('execution') ||
        message.includes('execute') || message.includes('run') ||
        message.includes('command not found') || message.includes('exit code')) {
      return ErrorCategory.TOOL_EXECUTION
    }
    
    // 验证错误
    if (message.includes('validation') || message.includes('invalid') || message.includes('required') ||
        message.includes('missing') || message.includes('format') ||
        message.includes('type') || message.includes('length') ||
        message.includes('range') || message.includes('pattern')) {
      return ErrorCategory.VALIDATION
    }
    
    // 权限错误
    if (message.includes('permission') || message.includes('access denied') || message.includes('eacces') ||
        message.includes('eperm') || message.includes('unauthorized') ||
        message.includes('forbidden') || message.includes('403')) {
      return ErrorCategory.PERMISSION
    }
    
    // 超时错误
    if (message.includes('timeout') || message.includes('timed out') ||
        message.includes('etimedout') || message.includes('timeout exceeded')) {
      return ErrorCategory.TIMEOUT
    }
    
    return ErrorCategory.UNKNOWN
  }

  static determineSeverity(error: Error | { message?: string }): ErrorSeverity {
    const message = error.message?.toLowerCase() || ''
    
    // 严重错误
    if (message.includes('critical') || message.includes('fatal') || message.includes('crash') ||
        message.includes('panic') || message.includes('abort') ||
        message.includes('segmentation fault') || message.includes('out of memory') ||
        message.includes('stack overflow') || message.includes('system error')) {
      return ErrorSeverity.CRITICAL
    }
    
    // 高严重度错误
    if (message.includes('error') || message.includes('failed') || message.includes('exception') ||
        message.includes('invalid') || message.includes('not found') ||
        message.includes('permission denied') || message.includes('access denied') ||
        message.includes('timeout') || message.includes('timed out') ||
        message.includes('connection refused') || message.includes('network error') ||
        message.includes('api error') || message.includes('http error') ||
        message.includes('tool error') || message.includes('execution failed')) {
      return ErrorSeverity.HIGH
    }
    
    // 中等严重度错误
    if (message.includes('warning') || message.includes('deprecated') ||
        message.includes('info') || message.includes('notice') ||
        message.includes('slow') || message.includes('delay') ||
        message.includes('retry') || message.includes('fallback') ||
        message.includes('minor') || message.includes('temporary')) {
      return ErrorSeverity.MEDIUM
    }
    
    // 低严重度错误
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
    if (error.context.tool) {
      details += `\n工具: ${error.context.tool}`
    }
    if (error.context.taskId) {
      details += `\n任务ID: ${error.context.taskId.slice(-8)}`
    }
    if (error.context.model) {
      details += `\n模型: ${error.context.model}`
    }
    
    let suggestion = ''
    switch (error.category) {
      case ErrorCategory.NETWORK:
        suggestion = '\n\n建议:\n1. 检查网络连接是否正常\n2. 尝试重启网络设备\n3. 确保可以访问外部服务\n4. 检查防火墙设置'
        break
      case ErrorCategory.FILE_SYSTEM:
        suggestion = '\n\n建议:\n1. 检查文件路径是否正确\n2. 确保文件或目录存在\n3. 检查文件权限设置\n4. 尝试使用绝对路径'
        break
      case ErrorCategory.API:
        suggestion = '\n\n建议:\n1. 检查API密钥配置是否正确\n2. 确保API密钥有效且未过期\n3. 检查网络连接\n4. 查看API文档了解正确用法'
        break
      case ErrorCategory.TOOL_EXECUTION:
        suggestion = '\n\n建议:\n1. 检查工具参数是否正确\n2. 确保输入格式符合要求\n3. 检查工具依赖是否安装\n4. 查看工具文档了解正确用法'
        break
      case ErrorCategory.TASK_EXECUTION:
        suggestion = '\n\n建议:\n1. 稍后重试该任务\n2. 检查任务配置是否正确\n3. 确保所有依赖都已满足\n4. 尝试简化任务复杂度'
        break
      case ErrorCategory.VALIDATION:
        suggestion = '\n\n建议:\n1. 检查输入参数格式是否正确\n2. 确保所有必填参数都已提供\n3. 验证参数值是否在有效范围内\n4. 查看相关文档了解正确格式'
        break
      case ErrorCategory.PERMISSION:
        suggestion = '\n\n建议:\n1. 检查文件或目录权限设置\n2. 尝试使用管理员权限运行\n3. 确保目标位置可写\n4. 检查用户权限级别'
        break
      case ErrorCategory.TIMEOUT:
        suggestion = '\n\n建议:\n1. 增加操作超时时间\n2. 检查网络连接是否稳定\n3. 尝试简化操作复杂度\n4. 分批处理大任务'
        break
      case ErrorCategory.UNKNOWN:
        suggestion = '\n\n建议:\n1. 稍后重试操作\n2. 检查系统状态\n3. 重启应用程序\n4. 联系技术支持并提供错误详情'
        break
    }
    
    let severityInfo = ''
    if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL) {
      severityInfo = '\n\n注意: 这是一个高优先级错误，可能需要立即处理。'
    }
    
    return `${emoji} ${title}${details}${suggestion}${severityInfo}`
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
