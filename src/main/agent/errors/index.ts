/**
 * Errors Module Exports
 * 错误处理模块导出
 */

export { 
  AgentError, 
  ErrorCode, 
  ErrorSeverity, 
  ErrorFactory
} from './ErrorRegistry'
export { ErrorHandler, errorHandler } from './ErrorHandler'

export type { AgentErrorOptions } from './ErrorRegistry'
export type { ErrorHandlerOptions, ErrorLogEntry } from './ErrorHandler'
