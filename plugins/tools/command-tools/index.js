/**
 * 命令工具插件
 * 提供命令执行功能
 */

const { exec, spawn } = require('child_process')

class CommandToolsPlugin {
  id = 'tool-command'
  name = 'Command Tools'
  version = '1.0.0'
  description = 'Execute shell commands and scripts'
  author = 'Octopus Agent'
  enabled = false
  category = 'tool'

  toolDefinitions = [
    {
      name: 'command_execute',
      description: 'Execute a shell command',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' },
          cwd: { type: 'string', description: 'Working directory' },
          timeout: { type: 'number', description: 'Timeout in ms', default: 30000 }
        },
        required: ['command']
      }
    },
    {
      name: 'command_spawn',
      description: 'Spawn a long-running process',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to spawn' },
          args: { type: 'array', description: 'Command arguments', items: { type: 'string' } },
          cwd: { type: 'string', description: 'Working directory' }
        },
        required: ['command']
      }
    }
  ]

  async initialize() {
    console.log(`[CommandToolsPlugin] Initializing...`)
    this.enabled = true
  }

  async destroy() {
    console.log(`[CommandToolsPlugin] Destroying...`)
    this.enabled = false
  }

  async executeTool(name, params) {
    if (!this.enabled) {
      return { success: false, error: 'Plugin not enabled' }
    }

    try {
      switch (name) {
        case 'command_execute':
          return await this.executeCommand(params.command, params.cwd, params.timeout)
        case 'command_spawn':
          return await this.spawnCommand(params.command, params.args, params.cwd)
        default:
          return { success: false, error: `Unknown tool: ${name}` }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async executeCommand(command, cwd, timeout = 30000) {
    return new Promise((resolve) => {
      exec(command, { cwd, timeout }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message, stderr })
        } else {
          resolve({ success: true, result: stdout, stderr })
        }
      })
    })
  }

  async spawnCommand(command, args = [], cwd) {
    return new Promise((resolve) => {
      const process = spawn(command, args, { cwd })
      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        resolve({
          success: code === 0,
          result: stdout,
          stderr,
          exitCode: code
        })
      })

      process.on('error', (error) => {
        resolve({ success: false, error: error.message })
      })
    })
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

module.exports = CommandToolsPlugin
module.exports.default = CommandToolsPlugin
