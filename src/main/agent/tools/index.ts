/**
 * Modular Tool System
 * 模块化工具系统
 * 
 * 按功能领域拆分工具：
 * - file-tools: 文件操作工具
 * - command-tools: 命令执行工具
 * - browser-tools: 浏览器操作工具
 * - response-tools: 响应工具
 * - project-tools: 项目操作工具
 */

// 导入各分类工具
import './file-tools'
import './command-tools'
import './browser-tools'
import './response-tools'
import './project-tools'

export { toolRegistry } from '../ToolRegistry'

export function initializeTools(): void {
  console.log('[Tools] All tool modules initialized')
}
