/**
 * @deprecated 请使用新架构
 * 
 * 旧版工具文件 - 已迁移至 ./tools/
 * 
 * 迁移指南：
 * - tools.ts -> tools/file-tools.ts, tools/command-tools.ts, tools/browser-tools.ts
 * 
 * @see ./tools/
 */

console.warn('[DEPRECATED] tools.ts is deprecated. Please use ./tools/ instead.')

export { initializeTools } from './tools/index'
