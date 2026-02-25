/**
 * @deprecated 请使用新架构
 * 
 * 旧版工作流引擎 - 已迁移至 ./workflow/
 * 
 * 迁移指南：
 * - WorkflowEngine -> workflow/UnifiedWorkflowEngine
 * - EnhancedWorkflowEngine -> workflow/
 * 
 * @see ./workflow/
 */

export { UnifiedWorkflowEngine, unifiedWorkflowEngine } from './workflow/UnifiedWorkflowEngine'

console.warn('[DEPRECATED] WorkflowEngine.ts is deprecated. Please use ./workflow/ instead.')
