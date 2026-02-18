jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name: string) => {
      const paths: Record<string, string> = {
        userData: '/tmp/test-app-data',
        home: '/tmp/test-home'
      }
      return paths[name] || '/tmp/test'
    }),
    setPath: jest.fn(),
    commandLine: {
      appendSwitch: jest.fn()
    }
  },
  BrowserWindow: jest.fn(),
  ipcMain: jest.fn(),
  ipcRenderer: jest.fn()
}))

jest.mock('../src/main/utils/ErrorHandler', () => {
  class MockAppError extends Error {
    public readonly category: string
    public readonly severity: string
    public readonly context: any
    public readonly originalError?: Error
    public readonly userMessage: string

    constructor(
      message: string,
      category: string = 'unknown',
      severity: string = 'medium',
      context: any = {},
      originalError?: Error
    ) {
      super(message)
      this.name = 'AppError'
      this.category = category
      this.severity = severity
      this.context = context
      this.originalError = originalError
      
      const userMessages: Record<string, string> = {
        'network': '网络连接出现问题，请检查您的网络设置',
        'file_system': '文件操作失败，请检查文件权限和路径',
        'api': 'API调用失败，请检查API密钥配置',
        'tool_execution': '工具执行失败，请检查操作参数',
        'task_execution': '任务执行失败，请稍后重试',
        'validation': '输入参数验证失败，请检查输入内容',
        'permission': '权限不足，请检查文件或操作权限',
        'timeout': '操作超时，请稍后重试或增加超时时间',
        'unknown': '发生未知错误，请联系技术支持'
      }
      this.userMessage = userMessages[category] || userMessages['unknown']
      Error.captureStackTrace(this, this.constructor)
    }
  }

  const mockErrorHandler = {
    handleError: jest.fn((error: any, context: any) => {
      const message = error.message?.toLowerCase() || ''
      let category = 'unknown'
      if (message.includes('network') || message.includes('fetch') || message.includes('connection')) category = 'network'
      else if (message.includes('file') || message.includes('directory') || message.includes('path')) category = 'file_system'
      else if (message.includes('api') || message.includes('http') || message.includes('status')) category = 'api'
      else if (message.includes('task') || message.includes('plan') || message.includes('step')) category = 'task_execution'
      else if (message.includes('tool') || message.includes('command') || message.includes('execution')) category = 'tool_execution'
      else if (message.includes('validation') || message.includes('invalid') || message.includes('required')) category = 'validation'
      else if (message.includes('permission') || message.includes('access denied') || message.includes('eacces')) category = 'permission'
      else if (message.includes('timeout') || message.includes('timed out')) category = 'timeout'
      
      let severity = 'low'
      if (message.includes('critical') || message.includes('fatal') || message.includes('crash')) severity = 'critical'
      else if (message.includes('error') || message.includes('failed') || message.includes('exception')) severity = 'high'
      else if (message.includes('warning') || message.includes('deprecated')) severity = 'medium'
      
      return new MockAppError(
        error.message || 'Unknown error',
        category,
        severity,
        { ...context },
        error
      )
    }),
    wrapError: jest.fn((error: any, defaultMessage: string, category: string, context: any) => {
      let message = defaultMessage || 'Unknown error'
      let originalError: Error | undefined
      
      if (typeof error === 'string') {
        message = error
      } else if (error instanceof Error) {
        message = error.message || defaultMessage
        originalError = error
      }
      
      return new MockAppError(
        message,
        category,
        'medium',
        context,
        originalError
      )
    }),
    createError: jest.fn((message: string, category: string, severity: string, context: any) => {
      const error = new MockAppError(
        message,
        category,
        severity,
        context
      )
      mockErrorHandler.logError(error)
      return error
    }),
    initialize: jest.fn(),
    logError: jest.fn((error: any) => {
      console.error(`[${error.category.toUpperCase()}] ${error.message}`)
      console.error(`User message: ${error.userMessage}`)
      if (error.context.component) {
        console.error(`Component: ${error.context.component}`)
      }
      if (error.context.operation) {
        console.error(`Operation: ${error.context.operation}`)
      }
    }),
    getUserMessage: jest.fn(() => 'Test error message'),
    categorizeError: jest.fn((error: any) => {
      const message = error.message?.toLowerCase() || ''
      if (message.includes('network') || message.includes('fetch') || message.includes('connection')) return 'network'
      if (message.includes('file') || message.includes('directory') || message.includes('path')) return 'file_system'
      if (message.includes('api') || message.includes('http') || message.includes('status')) return 'api'
      if (message.includes('task') || message.includes('plan') || message.includes('step')) return 'task_execution'
      if (message.includes('tool') || message.includes('command') || message.includes('execution')) return 'tool_execution'
      if (message.includes('validation') || message.includes('invalid') || message.includes('required')) return 'validation'
      if (message.includes('permission') || message.includes('access denied') || message.includes('eacces')) return 'permission'
      if (message.includes('timeout') || message.includes('timed out')) return 'timeout'
      return 'unknown'
    }),
    determineSeverity: jest.fn((error: any) => {
      const message = error.message?.toLowerCase() || ''
      if (message.includes('critical') || message.includes('fatal') || message.includes('crash')) return 'critical'
      if (message.includes('error') || message.includes('failed') || message.includes('exception')) return 'high'
      if (message.includes('warning') || message.includes('deprecated')) return 'medium'
      return 'low'
    }),
    getErrorLogs: jest.fn(() => []),
    clearErrorLogs: jest.fn(),
    formatErrorForUser: jest.fn((error: any) => {
      const severityEmoji: Record<string, string> = {
        'low': 'ℹ️',
        'medium': '⚠️',
        'high': '❌',
        'critical': '🚨'
      }
      const emoji = severityEmoji[error.severity] || '⚠️'
      const title = error.userMessage || '发生错误'
      let result = `${emoji} ${title}`
      if (error.context?.component) {
        result += `\n组件: ${error.context.component}`
      }
      return result
    }),
    formatErrorForDeveloper: jest.fn((error: any) => {
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
    })
  }

  return {
    ErrorCategory: {
      NETWORK: 'network',
      FILE_SYSTEM: 'file_system',
      API: 'api',
      TOOL_EXECUTION: 'tool_execution',
      TASK_EXECUTION: 'task_execution',
      VALIDATION: 'validation',
      PERMISSION: 'permission',
      TIMEOUT: 'timeout',
      UNKNOWN: 'unknown'
    },
    ErrorSeverity: {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical'
    },
    AppError: MockAppError,
    ErrorHandler: mockErrorHandler,
    default: mockErrorHandler
  }
})
