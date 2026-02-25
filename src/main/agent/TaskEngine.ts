/**
 * @deprecated 请使用新架构
 * 
 * 旧版任务引擎 - 已迁移至 ./tasks/
 * 
 * 迁移指南：
 * - TaskEngine -> tasks/TaskEngine
 * - Planner -> tasks/TaskDecomposer
 * - Executor -> tasks/TaskExecutor
 * 
 * @see ./tasks/
 */

export { ModularTaskEngine, taskEngine } from './tasks/TaskEngine'

console.warn('[DEPRECATED] TaskEngine.ts is deprecated. Please use ./tasks/ instead.')
