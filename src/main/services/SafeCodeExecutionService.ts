import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'
import { securityManager } from '../security/SecurityManager'

export interface ExecutionResult {
  success: boolean
  result?: any
  error?: string
  stdout: string
  stderr: string
  duration: number
  memoryUsed?: number
}

export interface ExecutionOptions {
  timeout?: number
  maxMemory?: number
  context?: Record<string, any>
  allowedModules?: string[]
}

export class SafeCodeExecutionService {
  private static instance: SafeCodeExecutionService
  private activeProcesses: Map<string, ChildProcess> = new Map()
  
  static getInstance(): SafeCodeExecutionService {
    if (!SafeCodeExecutionService.instance) {
      SafeCodeExecutionService.instance = new SafeCodeExecutionService()
    }
    return SafeCodeExecutionService.instance
  }
  
  async executeCode(
    code: string, 
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now()
    const timeout = options.timeout || 30000
    const maxMemory = options.maxMemory || 256
    
    const tempDir = app.getPath('temp')
    const scriptId = `exec_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const scriptPath = path.join(tempDir, `${scriptId}.js`)
    
    try {
      const wrappedCode = this.wrapCode(code, options.context, options.allowedModules)
      fs.writeFileSync(scriptPath, wrappedCode, 'utf8')
      
      const result = await this.executeInProcess(scriptPath, timeout, maxMemory)
      
      return {
        ...result,
        duration: Date.now() - startTime
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stdout: '',
        stderr: error.message,
        duration: Date.now() - startTime
      }
    } finally {
      try {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath)
        }
      } catch {
        // 忽略清理错误
      }
    }
  }
  
  private wrapCode(
    code: string, 
    context?: Record<string, any>,
    allowedModules?: string[]
  ): string {
    const contextStr = context ? JSON.stringify(context) : '{}'
    const allowedModulesStr = allowedModules ? JSON.stringify(allowedModules) : '[]'
    
    return `
const __context = ${contextStr};
const __allowedModules = ${allowedModulesStr};

// 安全的require代理
const __safeRequire = (moduleName) => {
  if (__allowedModules.length > 0 && !__allowedModules.includes(moduleName)) {
    throw new Error('Module not allowed: ' + moduleName);
  }
  return require(moduleName);
};

// 执行环境
const __sandbox = {
  console: {
    log: (...args) => process.send({ type: 'log', data: args }),
    error: (...args) => process.send({ type: 'error', data: args }),
    warn: (...args) => process.send({ type: 'warn', data: args }),
    info: (...args) => process.send({ type: 'info', data: args })
  },
  require: __safeRequire,
  ...__context
};

// 设置全局环境
Object.assign(global, __sandbox);

// 执行代码
try {
  const __result = (function() {
    ${code}
  })();
  process.send({ type: 'result', data: __result });
} catch (__err) {
  process.send({ type: 'error', data: __err.message });
}
`
  }
  
  private executeInProcess(
    scriptPath: string, 
    timeout: number,
    maxMemory: number
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let result: any = undefined
      let error: string | undefined
      
      const child = spawn('node', [
        `--max-old-space-size=${maxMemory}`,
        '--no-warnings',
        scriptPath
      ], {
        timeout,
        killSignal: 'SIGKILL',
        env: {
          ...process.env,
          NODE_ENV: 'sandbox'
        }
      })
      
      const processId = `proc_${Date.now()}`
      this.activeProcesses.set(processId, child)
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })
      
      child.on('message', (msg: any) => {
        if (msg.type === 'result') {
          result = msg.data
        } else if (msg.type === 'error') {
          error = msg.data
        } else if (msg.type === 'log' || msg.type === 'error' || msg.type === 'warn' || msg.type === 'info') {
          stdout += `[${msg.type}] ${msg.data?.join(' ') || ''}\n`
        }
      })
      
      child.on('close', (code) => {
        this.activeProcesses.delete(processId)
        
        resolve({
          success: code === 0 && !error,
          result,
          error: error || (code !== 0 ? `Process exited with code ${code}` : undefined),
          stdout,
          stderr,
          duration: 0
        })
      })
      
      child.on('error', (err) => {
        this.activeProcesses.delete(processId)
        resolve({
          success: false,
          error: err.message,
          stdout,
          stderr: err.message,
          duration: 0
        })
      })
    })
  }
  
  async executeFunction(
    code: string, 
    args: any[] = [], 
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const wrappedCode = `
      const __func = ${code};
      return __func(...${JSON.stringify(args)});
    `
    return this.executeCode(wrappedCode, options)
  }
  
  async evaluateExpression(
    expression: string, 
    context: Record<string, any> = {},
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const wrappedCode = `
      return (${expression});
    `
    return this.executeCode(wrappedCode, { ...options, context })
  }
  
  killAllProcesses(): void {
    for (const [id, proc] of this.activeProcesses) {
      try {
        proc.kill('SIGKILL')
      } catch {
        // 忽略错误
      }
    }
    this.activeProcesses.clear()
  }
}

export const safeCodeExecutionService = SafeCodeExecutionService.getInstance()
