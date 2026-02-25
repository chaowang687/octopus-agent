/**
 * Unified Error System
 * 统一错误处理系统
 */

export enum ErrorCode {
  // 通用错误 (1000-1999)
  UNKNOWN = 'UNKNOWN',
  INVALID_INPUT = 'INVALID_INPUT',
  TIMEOUT = 'TIMEOUT',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  
  // 任务相关错误 (2000-2999)
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_FAILED = 'TASK_FAILED',
  TASK_CANCELLED = 'TASK_CANCELLED',
  TASK_TIMEOUT = 'TASK_TIMEOUT',
  
  // 推理相关错误 (3000-3999)
  REASONING_FAILED = 'REASONING_FAILED',
  REASONING_TIMEOUT = 'REASONING_TIMEOUT',
  INVALID_REASONING_STRATEGY = 'INVALID_REASONING_STRATEGY',
  
  // 工具相关错误 (4000-4999)
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',
  INVALID_TOOL_PARAMETERS = 'INVALID_TOOL_PARAMETERS',
  
  // 工作流相关错误 (5000-5999)
  WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',
  WORKFLOW_INVALID = 'WORKFLOW_INVALID',
  WORKFLOW_EXECUTION_FAILED = 'WORKFLOW_EXECUTION_FAILED',
  WORKFLOW_NODE_FAILED = 'WORKFLOW_NODE_FAILED',
  
  // 记忆相关错误 (6000-6999)
  MEMORY_NOT_FOUND = 'MEMORY_NOT_FOUND',
  MEMORY_FULL = 'MEMORY_FULL',
  MEMORY_PERSISTENCE_FAILED = 'MEMORY_PERSISTENCE_FAILED'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AgentErrorOptions {
  code: ErrorCode
  message: string
  severity: ErrorSeverity
  details?: any
  cause?: Error
  stackTrace?: string
}

/**
 * Agent Error 基类
 */
export class AgentError extends Error {
  public readonly code: ErrorCode
  public readonly severity: ErrorSeverity
  public readonly details?: any
  public readonly cause?: Error
  public readonly timestamp: number
  public readonly stackTrace?: string

  constructor(options: AgentErrorOptions) {
    super(options.message)
    this.name = 'AgentError'
    this.code = options.code
    this.severity = options.severity
    this.details = options.details
    this.cause = options.cause
    this.timestamp = Date.now()
    this.stackTrace = options.stackTrace || this.stack

    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * 转换为 JSON
   */
  toJSON(): any {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      details: this.details,
      timestamp: this.timestamp,
      stackTrace: this.stackTrace
    }
  }

  /**
   * 转换为字符串
   */
  toString(): string {
    return `[${this.code}] ${this.message}`
  }
}

/**
 * 错误工厂
 */
export class ErrorFactory {
  /**
   * 创建错误
   */
  static create(code: ErrorCode, message: string, severity: ErrorSeverity = ErrorSeverity.MEDIUM, details?: any): AgentError {
    return new AgentError({
      code,
      message,
      severity,
      details
    })
  }

  /**
   * 创建任务错误
   */
  static taskNotFound(taskId: string): AgentError {
    return this.create(ErrorCode.TASK_NOT_FOUND, `Task not found: ${taskId}`)
  }

  static taskFailed(taskId: string, reason: string): AgentError {
    return this.create(ErrorCode.TASK_FAILED, `Task failed: ${taskId} - ${reason}`, ErrorSeverity.HIGH)
  }

  /**
   * 创建工具错误
   */
  static toolNotFound(toolName: string): AgentError {
    return this.create(ErrorCode.TOOL_NOT_FOUND, `Tool not found: ${toolName}`)
  }

  static toolExecutionFailed(toolName: string, reason: string): AgentError {
    return this.create(ErrorCode.TOOL_EXECUTION_FAILED, `Tool execution failed: ${toolName} - ${reason}`, ErrorSeverity.HIGH)
  }

  /**
   * 创建工作流错误
   */
  static workflowNotFound(workflowId: string): AgentError {
    return this.create(ErrorCode.WORKFLOW_NOT_FOUND, `Workflow not found: ${workflowId}`)
  }

  static workflowInvalid(workflowId: string, errors: string[]): AgentError {
    return this.create(ErrorCode.WORKFLOW_INVALID, `Workflow invalid: ${workflowId} - ${errors.join(', ')}`)
  }

  /**
   * 包装错误
   */
  static wrap(error: Error, code: ErrorCode, severity: ErrorSeverity = ErrorSeverity.MEDIUM): AgentError {
    return new AgentError({
      code,
      message: error.message,
      severity,
      cause: error
    })
  }
}