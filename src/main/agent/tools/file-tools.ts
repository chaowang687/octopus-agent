/**
 * File Tools
 * 文件操作工具集
 */

import * as fs from 'fs'
import * as path from 'path'
import { toolRegistry } from '../ToolRegistry'

export function registerFileTools(): void {
  // 读取文件
  toolRegistry.register({
    name: 'read_file',
    description: 'Read the content of a file',
    parameters: [
      { name: 'path', type: 'string', description: 'Absolute path to the file', required: true }
    ],
    handler: async (params: any) => {
      try {
        const filePath = params?.path
        if (!filePath) return { error: 'Missing parameter: path' }
        if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` }
        const content = fs.readFileSync(filePath, 'utf8')
        return { content }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 写入文件
  toolRegistry.register({
    name: 'write_file',
    description: 'Write content to a file',
    parameters: [
      { name: 'path', type: 'string', description: 'Absolute path to the file', required: true },
      { name: 'content', type: 'string', description: 'Content to write', required: true }
    ],
    handler: async (params: any) => {
      try {
        const filePath = params?.path
        const content = params?.content
        if (!filePath) return { error: 'Missing parameter: path' }
        if (content === undefined) return { error: 'Missing parameter: content' }
        
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        
        fs.writeFileSync(filePath, content, 'utf8')
        return { success: true, path: filePath }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 创建目录
  toolRegistry.register({
    name: 'create_directory',
    description: 'Create a new directory',
    parameters: [
      { name: 'path', type: 'string', description: 'Directory path to create', required: true }
    ],
    handler: async (params: any) => {
      try {
        const dirPath = params?.path
        if (!dirPath) return { error: 'Missing parameter: path' }
        
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 })
        }
        
        return { success: true, path: dirPath }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 列出文件
  toolRegistry.register({
    name: 'list_files',
    description: 'List files in a directory',
    parameters: [
      { name: 'path', type: 'string', description: 'Directory path', required: true }
    ],
    handler: async (params: any) => {
      try {
        const dirPath = params?.path
        if (!dirPath) return { error: 'Missing parameter: path' }
        if (!fs.existsSync(dirPath)) return { error: `Directory not found: ${dirPath}` }
        
        const files = fs.readdirSync(dirPath)
        return { files }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 文件glob搜索
  toolRegistry.register({
    name: 'glob_paths',
    description: 'Find files matching a glob pattern',
    parameters: [
      { name: 'pattern', type: 'string', description: 'Glob pattern (e.g. "**/*.ts")', required: true },
      { name: 'cwd', type: 'string', description: 'Root directory for the glob', required: false }
    ],
    handler: async (_params: any) => {
      // 简化实现，实际需要使用 glob 库
      return { paths: [], message: 'Glob not implemented in modular version' }
    }
  })

  // 搜索文件内容
  toolRegistry.register({
    name: 'search_files',
    description: 'Search for content in files',
    parameters: [
      { name: 'pattern', type: 'string', description: 'Regex or string pattern to search for', required: true },
      { name: 'path', type: 'string', description: 'Directory to search in', required: true },
      { name: 'include', type: 'string', description: 'File pattern to include', required: false }
    ],
    handler: async (_params: any) => {
      return { results: [], message: 'Search not implemented in modular version' }
    }
  })

  // 获取项目结构
  toolRegistry.register({
    name: 'get_project_structure',
    description: 'Get project directory structure',
    parameters: [
      { name: 'path', type: 'string', description: 'Root directory path', required: true },
      { name: 'depth', type: 'number', description: 'Max depth (default 2)', required: false }
    ],
    handler: async (params: any) => {
      try {
        const rootPath = params?.path
        const depth = params?.depth || 2
        
        if (!rootPath) return { error: 'Missing parameter: path' }
        if (!fs.existsSync(rootPath)) return { error: `Directory not found: ${rootPath}` }

        const structure = buildDirectoryTree(rootPath, depth)
        return { structure }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })
}

function buildDirectoryTree(dirPath: string, maxDepth: number, currentDepth: number = 0): any {
  if (currentDepth >= maxDepth) {
    return '...'
  }

  try {
    const items = fs.readdirSync(dirPath)
    const tree: any = {}

    for (const item of items) {
      if (item.startsWith('.') || item === 'node_modules') continue
      
      const fullPath = path.join(dirPath, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        tree[item] = buildDirectoryTree(fullPath, maxDepth, currentDepth + 1)
      } else {
        tree[item] = 'file'
      }
    }

    return tree
  } catch {
    return 'error'
  }
}

registerFileTools()
