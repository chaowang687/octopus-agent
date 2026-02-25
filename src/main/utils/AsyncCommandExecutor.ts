import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
  success: boolean
}

export interface ExecOptions {
  cwd?: string
  timeout?: number
  env?: NodeJS.ProcessEnv
  maxBuffer?: number
  shell?: boolean
  onProgress?: (data: { stdout?: string; stderr?: string }) => void
}

export class AsyncCommandExecutor extends EventEmitter {
  private activeProcesses: Map<string, ChildProcess> = new Map()
  private defaultTimeout = 60000
  private defaultMaxBuffer = 10 * 1024 * 1024

  async execute(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    const {
      cwd = process.cwd(),
      timeout = this.defaultTimeout,
      env = process.env,
      maxBuffer = this.defaultMaxBuffer,
      shell = true,
      onProgress
    } = options

    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let killed = false
      const processId = `${command}-${Date.now()}`

      const child = spawn(command, [], {
        cwd,
        env,
        shell,
        windowsHide: true
      })

      this.activeProcesses.set(processId, child)

      const timeoutId = setTimeout(() => {
        killed = true
        child.kill('SIGKILL')
        this.activeProcesses.delete(processId)
        resolve({
          stdout,
          stderr: stderr + '\nProcess timed out',
          exitCode: -1,
          success: false
        })
      }, timeout)

      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString()
        if (stdout.length < maxBuffer) {
          stdout += chunk
        }
        onProgress?.({ stdout: chunk })
        this.emit('stdout', { processId, data: chunk })
      })

      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString()
        if (stderr.length < maxBuffer) {
          stderr += chunk
        }
        onProgress?.({ stderr: chunk })
        this.emit('stderr', { processId, data: chunk })
      })

      child.on('error', (error: Error) => {
        clearTimeout(timeoutId)
        this.activeProcesses.delete(processId)
        resolve({
          stdout,
          stderr: stderr + '\n' + error.message,
          exitCode: -1,
          success: false
        })
      })

      child.on('close', (code: number | null) => {
        clearTimeout(timeoutId)
        this.activeProcesses.delete(processId)
        
        if (killed) return

        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
          success: code === 0
        })
      })
    })
  }

  async executeWithSignal(
    command: string,
    options: ExecOptions = {}
  ): Promise<{ result: Promise<ExecResult>; abort: () => void }> {
    const {
      cwd = process.cwd(),
      timeout = this.defaultTimeout,
      env = process.env,
      maxBuffer = this.defaultMaxBuffer,
      shell = true,
      onProgress
    } = options

    let child: ChildProcess | null = null
    let stdout = ''
    let stderr = ''
    const processId = `${command}-${Date.now()}`

    const result = new Promise<ExecResult>((resolve) => {
      child = spawn(command, [], {
        cwd,
        env,
        shell,
        windowsHide: true
      })

      if (child) {
        this.activeProcesses.set(processId, child)
      }

      const timeoutId = setTimeout(() => {
        child?.kill('SIGKILL')
        this.activeProcesses.delete(processId)
        resolve({
          stdout,
          stderr: stderr + '\nProcess timed out',
          exitCode: -1,
          success: false
        })
      }, timeout)

      child?.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString()
        if (stdout.length < maxBuffer) {
          stdout += chunk
        }
        onProgress?.({ stdout: chunk })
      })

      child?.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString()
        if (stderr.length < maxBuffer) {
          stderr += chunk
        }
        onProgress?.({ stderr: chunk })
      })

      child?.on('error', (error: Error) => {
        clearTimeout(timeoutId)
        this.activeProcesses.delete(processId)
        resolve({
          stdout,
          stderr: stderr + '\n' + error.message,
          exitCode: -1,
          success: false
        })
      })

      child?.on('close', (code: number | null) => {
        clearTimeout(timeoutId)
        this.activeProcesses.delete(processId)
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
          success: code === 0
        })
      })
    })

    const abort = () => {
      child?.kill('SIGKILL')
      this.activeProcesses.delete(processId)
    }

    return { result, abort }
  }

  killProcess(processId: string): boolean {
    const child = this.activeProcesses.get(processId)
    if (child) {
      child.kill('SIGKILL')
      this.activeProcesses.delete(processId)
      return true
    }
    return false
  }

  killAll(): void {
    for (const [id, child] of this.activeProcesses) {
      child.kill('SIGKILL')
      this.activeProcesses.delete(id)
    }
  }

  getActiveProcessCount(): number {
    return this.activeProcesses.size
  }
}

export const asyncExecutor = new AsyncCommandExecutor()

export async function executeAsync(
  command: string,
  options?: ExecOptions
): Promise<ExecResult> {
  return asyncExecutor.execute(command, options)
}

export async function executeWithProgress(
  command: string,
  options: ExecOptions & { onProgress: (data: { stdout?: string; stderr?: string }) => void }
): Promise<ExecResult> {
  return asyncExecutor.execute(command, options)
}
