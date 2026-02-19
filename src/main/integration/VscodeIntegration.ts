import { spawn, exec, execSync } from 'child_process'
import * as fs from 'fs'

import { v4 as uuidv4 } from 'uuid'
import { VscodeOptions, VscodeInstance, ToolStatus, ToolIntegration } from './ToolTypes'

export class VscodeIntegration implements ToolIntegration {
  private vscodePath: string | null
  private instances: Map<string, VscodeInstance>

  constructor() {
    this.vscodePath = this.findVscodePath()
    this.instances = new Map()
  }

  private findVscodePath(): string | null {
    const possiblePaths = [
      '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
      '/Applications/Visual Studio Code.app/Contents/MacOS/Code',
      '/Applications/VSCode.app/Contents/MacOS/Code',
      '/usr/local/bin/code'
    ]

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p
      }
    }

    try {
      const stdout = execSync('which code', { encoding: 'utf8' })
      if (stdout && stdout.trim()) {
        return stdout.trim()
      }
    } catch (error) {
      console.warn('VS Code not found in PATH')
    }

    return null
  }

  isAvailable(): boolean {
    return this.vscodePath !== null
  }

  async getStatus(): Promise<ToolStatus> {
    return {
      available: this.isAvailable(),
      version: await this.getVersion(),
      path: this.vscodePath,
      lastChecked: new Date()
    }
  }

  private async getVersion(): Promise<string | null> {
    try {
      const stdout = execSync('code --version', { encoding: 'utf8' })
      if (stdout) {
        const versionLine = stdout.split('\n')[0]
        return versionLine.trim()
      }
    } catch (error) {
      console.warn('Failed to get VS Code version:', error)
    }
    return null
  }

  async startInstance(options: VscodeOptions = {}): Promise<VscodeInstance> {
    if (!this.isAvailable()) {
      throw new Error('VS Code is not available')
    }

    const instanceId = uuidv4()
    const args = options.args || []

    const process = spawn(this.vscodePath!, args, {
      cwd: options.workingDirectory,
      detached: true,
      stdio: 'ignore'
    })

    const instance: VscodeInstance = {
      id: instanceId,
      process,
      options,
      startTime: new Date()
    }

    this.instances.set(instanceId, instance)
    return instance
  }

  async openPath(filePath: string, options: VscodeOptions = {}): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('VS Code is not available')
    }

    const args = [filePath]

    if (options.workingDirectory) {
      args.unshift(options.workingDirectory)
    }

    if (options.extensionFolder) {
      args.push('--extensions-dir', options.extensionFolder)
    }

    if (options.debugMode) {
      args.push('--debug')
    }

    return new Promise((resolve, reject) => {
      const process = spawn(this.vscodePath!, args, {
        detached: true,
        stdio: 'ignore'
      })

      process.on('error', reject)
      process.on('spawn', () => resolve())
      process.unref()
    })
  }

  async openProject(projectPath: string, options: VscodeOptions = {}): Promise<void> {
    return this.openPath(projectPath, options)
  }

  async openFile(filePath: string, line?: number, column?: number): Promise<void> {
    const args = ['--goto', `${filePath}:${line || 1}:${column || 1}`]
    
    return new Promise((resolve, reject) => {
      const process = spawn(this.vscodePath!, args, {
        detached: true,
        stdio: 'ignore'
      })

      process.on('error', reject)
      process.on('spawn', () => resolve())
      process.unref()
    })
  }

  async executeCommand(command: string, ...args: any[]): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('VS Code is not available')
    }

    const fullCommand = `code ${command} ${args.join(' ')}`

    return new Promise((resolve, reject) => {
      exec(fullCommand, (error, stdout, stderr) => {
        if (error) {
          reject(error)
        } else {
          resolve({ stdout, stderr })
        }
      })
    })
  }

  async closeInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`)
    }

    if (instance.process) {
      instance.process.kill()
    }

    this.instances.delete(instanceId)
  }

  async closeAllInstances(): Promise<void> {
    for (const [instanceId] of this.instances) {
      await this.closeInstance(instanceId)
    }
  }

  getActiveInstances(): VscodeInstance[] {
    return Array.from(this.instances.values())
  }
}