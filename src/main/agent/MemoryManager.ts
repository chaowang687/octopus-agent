/**
 * @deprecated 请使用新架构
 * 
 * 旧版记忆管理器 - 已迁移至 ./memory/
 * 
 * 迁移指南：
 * - MemoryManager -> memory/MemoryService
 * - ShortTermMemoryService -> memory/ShortTermMemory
 * - MemorySystem -> memory/
 * 
 * @see ./memory/
 */

export { MemoryService, memoryService } from './memory/MemoryService'

console.warn('[DEPRECATED] MemoryManager.ts is deprecated. Please use ./memory/ instead.')
