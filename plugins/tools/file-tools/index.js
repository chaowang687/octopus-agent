/**
 * 文件工具插件
 * 提供文件系统操作功能
 */

const fs = require('fs')
const path = require('path')

class FileToolsPlugin {
  id = 'tool-file'
  name = 'File Tools'
  version = '1.0.0'
  description = 'File system operations'
  author = 'Octopus Agent'
  enabled = false
  category = 'tool'

  toolDefinitions = [
    {
      name: 'file_read',
      description: 'Read file content',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' },
          encoding: { type: 'string', description: 'File encoding', default: 'utf-8' }
        },
        required: ['path']
      }
    },
    {
      name: 'file_write',
      description: 'Write content to file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write' },
          encoding: { type: 'string', description: 'File encoding', default: 'utf-8' }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'file_delete',
      description: 'Delete a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to delete' }
        },
        required: ['path']
      }
    },
    {
      name: 'file_copy',
      description: 'Copy a file',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source file path' },
          destination: { type: 'string', description: 'Destination file path' }
        },
        required: ['source', 'destination']
      }
    },
    {
      name: 'file_move',
      description: 'Move a file',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source file path' },
          destination: { type: 'string', description: 'Destination file path' }
        },
        required: ['source', 'destination']
      }
    },
    {
      name: 'file_exists',
      description: 'Check if file exists',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to check' }
        },
        required: ['path']
      }
    },
    {
      name: 'dir_list',
      description: 'List directory contents',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
          recursive: { type: 'boolean', description: 'List recursively', default: false }
        },
        required: ['path']
      }
    },
    {
      name: 'dir_create',
      description: 'Create a directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to create' },
          recursive: { type: 'boolean', description: 'Create parent directories', default: true }
        },
        required: ['path']
      }
    },
    {
      name: 'dir_delete',
      description: 'Delete a directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to delete' },
          recursive: { type: 'boolean', description: 'Delete recursively', default: false }
        },
        required: ['path']
      }
    }
  ]

  async initialize() {
    console.log(`[FileToolsPlugin] Initializing...`)
    this.enabled = true
  }

  async destroy() {
    console.log(`[FileToolsPlugin] Destroying...`)
    this.enabled = false
  }

  async executeTool(name, params) {
    if (!this.enabled) {
      return { success: false, error: 'Plugin not enabled' }
    }

    try {
      switch (name) {
        case 'file_read':
          return await this.readFile(params.path, params.encoding)
        case 'file_write':
          return await this.writeFile(params.path, params.content, params.encoding)
        case 'file_delete':
          return await this.deleteFile(params.path)
        case 'file_copy':
          return await this.copyFile(params.source, params.destination)
        case 'file_move':
          return await this.moveFile(params.source, params.destination)
        case 'file_exists':
          return await this.fileExists(params.path)
        case 'dir_list':
          return await this.listDir(params.path, params.recursive)
        case 'dir_create':
          return await this.createDir(params.path, params.recursive)
        case 'dir_delete':
          return await this.deleteDir(params.path, params.recursive)
        default:
          return { success: false, error: `Unknown tool: ${name}` }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async readFile(filePath, encoding = 'utf-8') {
    const content = fs.readFileSync(filePath, encoding)
    return { success: true, result: content }
  }

  async writeFile(filePath, content, encoding = 'utf-8') {
    fs.writeFileSync(filePath, content, encoding)
    return { success: true, result: `File written: ${filePath}` }
  }

  async deleteFile(filePath) {
    fs.unlinkSync(filePath)
    return { success: true, result: `File deleted: ${filePath}` }
  }

  async copyFile(source, destination) {
    fs.copyFileSync(source, destination)
    return { success: true, result: `File copied: ${source} -> ${destination}` }
  }

  async moveFile(source, destination) {
    fs.renameSync(source, destination)
    return { success: true, result: `File moved: ${source} -> ${destination}` }
  }

  async fileExists(filePath) {
    const exists = fs.existsSync(filePath)
    return { success: true, result: exists }
  }

  async listDir(dirPath, recursive = false) {
    if (recursive) {
      const results = []
      const walk = (dir) => {
        const items = fs.readdirSync(dir)
        for (const item of items) {
          const fullPath = path.join(dir, item)
          const stat = fs.statSync(fullPath)
          results.push({
            name: item,
            path: fullPath,
            type: stat.isDirectory() ? 'directory' : 'file',
            size: stat.size
          })
          if (stat.isDirectory()) {
            walk(fullPath)
          }
        }
      }
      walk(dirPath)
      return { success: true, result: results }
    } else {
      const items = fs.readdirSync(dirPath).map(item => {
        const fullPath = path.join(dirPath, item)
        const stat = fs.statSync(fullPath)
        return {
          name: item,
          path: fullPath,
          type: stat.isDirectory() ? 'directory' : 'file',
          size: stat.size
        }
      })
      return { success: true, result: items }
    }
  }

  async createDir(dirPath, recursive = true) {
    fs.mkdirSync(dirPath, { recursive })
    return { success: true, result: `Directory created: ${dirPath}` }
  }

  async deleteDir(dirPath, recursive = false) {
    fs.rmSync(dirPath, { recursive, force: recursive })
    return { success: true, result: `Directory deleted: ${dirPath}` }
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.name,
      capabilities: this.toolDefinitions,
      version: this.version
    }
  }
}

module.exports = FileToolsPlugin
module.exports.default = FileToolsPlugin
