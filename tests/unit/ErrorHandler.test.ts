import { ErrorHandler, AppError, ErrorCategory, ErrorSeverity } from '../../src/main/utils/ErrorHandler'

describe('ErrorHandler', () => {
  describe('createError', () => {
    it('should create an AppError with correct properties', () => {
      const error = ErrorHandler.createError(
        'Test error message',
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        { component: 'TestComponent' }
      )

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe('Test error message')
      expect(error.category).toBe(ErrorCategory.NETWORK)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.context.component).toBe('TestComponent')
    })

    it('should generate user-friendly message', () => {
      const error = ErrorHandler.createError(
        'Network connection failed',
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH
      )

      expect(error.userMessage).toContain('网络')
    })

    it('should log error to file', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      ErrorHandler.createError(
        'Test error',
        ErrorCategory.API,
        ErrorSeverity.MEDIUM
      )

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('handleError', () => {
    it('should handle Error object', () => {
      const originalError = new Error('Original error')
      const appError = ErrorHandler.handleError(originalError, {
        component: 'TestComponent'
      })

      expect(appError).toBeInstanceOf(AppError)
      expect(appError.message).toBe('Original error')
      expect(appError.originalError).toBe(originalError)
    })

    it('should handle string error', () => {
      const appError = ErrorHandler.wrapError('String error', 'Default message', ErrorCategory.UNKNOWN, {
        component: 'TestComponent'
      })

      expect(appError).toBeInstanceOf(AppError)
      expect(appError.message).toBe('String error')
    })

    it('should handle null/undefined error', () => {
      const appError = ErrorHandler.wrapError(null, 'Default message', ErrorCategory.UNKNOWN, {
        component: 'TestComponent'
      })

      expect(appError).toBeInstanceOf(AppError)
      expect(appError.message).toBe('Default message')
    })

    it('should auto-categorize error', () => {
      const networkError = new Error('Network connection failed')
      const appError = ErrorHandler.handleError(networkError)

      expect(appError.category).toBe(ErrorCategory.NETWORK)
    })

    it('should auto-determine severity', () => {
      const criticalError = new Error('Critical system failure')
      const appError = ErrorHandler.handleError(criticalError)

      expect(appError.severity).toBeDefined()
    })
  })

  describe('wrapError', () => {
    it('should wrap error with default message', () => {
      const originalError = new Error('Inner error')
      const appError = ErrorHandler.wrapError(
        originalError,
        'Default message',
        ErrorCategory.TOOL_EXECUTION
      )

      expect(appError.message).toBe('Inner error')
      expect(appError.originalError).toBe(originalError)
      expect(appError.category).toBe(ErrorCategory.TOOL_EXECUTION)
    })

    it('should use default message when error is null', () => {
      const appError = ErrorHandler.wrapError(
        null,
        'Default message',
        ErrorCategory.UNKNOWN
      )

      expect(appError.message).toBe('Default message')
    })

    it('should wrap string error', () => {
      const appError = ErrorHandler.wrapError(
        'String error',
        'Default message',
        ErrorCategory.VALIDATION
      )

      expect(appError.message).toBe('String error')
      expect(appError.category).toBe(ErrorCategory.VALIDATION)
    })
  })

  describe('categorizeError', () => {
    it('should categorize network errors', () => {
      const category = ErrorHandler.categorizeError(
        new Error('Network connection failed')
      )
      expect(category).toBe(ErrorCategory.NETWORK)
    })

    it('should categorize file system errors', () => {
      const category = ErrorHandler.categorizeError(
        new Error('File not found')
      )
      expect(category).toBe(ErrorCategory.FILE_SYSTEM)
    })

    it('should categorize API errors', () => {
      const category = ErrorHandler.categorizeError(
        new Error('API request failed')
      )
      expect(category).toBe(ErrorCategory.API)
    })

    it('should categorize tool execution errors', () => {
      const category = ErrorHandler.categorizeError(
        new Error('Tool execution failed')
      )
      expect(category).toBe(ErrorCategory.TOOL_EXECUTION)
    })

    it('should categorize task execution errors', () => {
      const category = ErrorHandler.categorizeError(
        new Error('Task execution failed')
      )
      expect(category).toBe(ErrorCategory.TASK_EXECUTION)
    })

    it('should categorize validation errors', () => {
      const category = ErrorHandler.categorizeError(
        new Error('Validation failed')
      )
      expect(category).toBe(ErrorCategory.VALIDATION)
    })

    it('should categorize permission errors', () => {
      const category = ErrorHandler.categorizeError(
        new Error('Permission denied')
      )
      expect(category).toBe(ErrorCategory.PERMISSION)
    })

    it('should categorize timeout errors', () => {
      const category = ErrorHandler.categorizeError(
        new Error('Operation timed out')
      )
      expect(category).toBe(ErrorCategory.TIMEOUT)
    })

    it('should return unknown for unrecognized errors', () => {
      const category = ErrorHandler.categorizeError(
        new Error('Some random issue')
      )
      expect(category).toBe(ErrorCategory.UNKNOWN)
    })
  })

  describe('determineSeverity', () => {
    it('should determine critical severity', () => {
      const severity = ErrorHandler.determineSeverity({
        message: 'Critical system crash'
      })
      expect(severity).toBe(ErrorSeverity.CRITICAL)
    })

    it('should determine high severity', () => {
      const severity = ErrorHandler.determineSeverity({
        message: 'System failed'
      })
      expect(severity).toBe(ErrorSeverity.HIGH)
    })

    it('should determine medium severity', () => {
      const severity = ErrorHandler.determineSeverity({
        message: 'Warning message'
      })
      expect(severity).toBe(ErrorSeverity.MEDIUM)
    })

    it('should determine low severity', () => {
      const severity = ErrorHandler.determineSeverity({
        message: 'Informational message'
      })
      expect(severity).toBe(ErrorSeverity.LOW)
    })
  })

  describe('formatErrorForUser', () => {
    it('should format error for user display', () => {
      const error = new AppError(
        'Technical error message',
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        { component: 'TestComponent' }
      )

      const formatted = ErrorHandler.formatErrorForUser(error)

      expect(formatted).toContain('❌')
      expect(formatted).toContain('网络')
      expect(formatted).toContain('TestComponent')
    })
  })

  describe('formatErrorForDeveloper', () => {
    it('should format error for developer debugging', () => {
      const error = new AppError(
        'Technical error message',
        ErrorCategory.API,
        ErrorSeverity.MEDIUM,
        { component: 'TestComponent', operation: 'testOperation' }
      )

      const formatted = ErrorHandler.formatErrorForDeveloper(error)

      expect(formatted).toContain('AppError')
      expect(formatted).toContain('Technical error message')
      expect(formatted).toContain('api')
      expect(formatted).toContain('medium')
      expect(formatted).toContain('TestComponent')
      expect(formatted).toContain('testOperation')
    })
  })

  describe('getErrorLogs', () => {
    it('should return empty array when no logs exist', () => {
      const logs = ErrorHandler.getErrorLogs()
      expect(Array.isArray(logs)).toBe(true)
    })

    it('should limit number of logs returned', () => {
      const logs = ErrorHandler.getErrorLogs(5)
      expect(logs.length).toBeLessThanOrEqual(5)
    })
  })

  describe('clearErrorLogs', () => {
    it('should clear error logs', () => {
      expect(() => {
        ErrorHandler.clearErrorLogs()
      }).not.toThrow()
    })
  })

  describe('AppError class', () => {
    it('should create AppError with all properties', () => {
      const originalError = new Error('Original')
      const error = new AppError(
        'Test message',
        ErrorCategory.TOOL_EXECUTION,
        ErrorSeverity.HIGH,
        { component: 'Test' },
        originalError
      )

      expect(error.message).toBe('Test message')
      expect(error.category).toBe(ErrorCategory.TOOL_EXECUTION)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.context.component).toBe('Test')
      expect(error.originalError).toBe(originalError)
      expect(error.name).toBe('AppError')
    })

    it('should generate user message based on category', () => {
      const error = new AppError(
        'Network error',
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH
      )

      expect(error.userMessage).toContain('网络')
    })

    it('should have correct stack trace', () => {
      const error = new AppError(
        'Test',
        ErrorCategory.UNKNOWN,
        ErrorSeverity.LOW
      )

      expect(error.stack).toBeDefined()
      expect(typeof error.stack).toBe('string')
    })
  })
})
