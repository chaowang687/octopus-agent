import { spawn } from 'child_process'

export function escapeShellArg(arg: string): string {
  if (process.platform === 'win32') {
    return `"${arg.replace(/"/g, '""')}"`
  }
  return `'${arg.replace(/'/g, "'\\''")}'`
}

export function escapeCommandArgs(args: string[]): string[] {
  return args.map(escapeShellArg)
}

export function buildSafeCommand(command: string, args: string[]): string {
  const escapedArgs = escapeCommandArgs(args)
  return `${command} ${escapedArgs.join(' ')}`
}

export function validateCommand(command: string): boolean {
  const allowedCommands = [
    'ls', 'cat', 'grep', 'find', 'mkdir', 'rm', 'cp', 'mv', 'cd', 'touch', 'chmod', 'chown',
    'npm', 'yarn', 'pnpm', 'git', 'node', 'python3', 'ruby', 'python',
    'code', 'open', 'pwd', 'echo', 'date', 'whoami', 'id',
    'npx', 'bun', 'deno', 'tsc', 'eslint', 'prettier', 'jest', 'vitest'
  ]
  
  const cmdName = command.split(' ')[0].trim()
  return allowedCommands.includes(cmdName)
}

export function sanitizeCommand(command: string): string {
  return command.replace(/[;&|<>(){}[`$\x00]/g, '')
}

export interface SafeExecResult {
  stdout: string
  stderr: string
  exitCode: number
  success: boolean
}

export async function safeExecAsync(
  command: string, 
  options: {
    cwd?: string
    timeout?: number
    env?: NodeJS.ProcessEnv
    maxBuffer?: number
  } = {}
): Promise<SafeExecResult> {
  const {
    cwd = process.cwd(),
    timeout = 30000,
    env = process.env,
    maxBuffer = 10 * 1024 * 1024
  } = options

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let killed = false

    const child = spawn(command, [], {
      cwd,
      env,
      shell: true,
      windowsHide: true
    })

    const timeoutId = setTimeout(() => {
      killed = true
      child.kill('SIGKILL')
      resolve({
        stdout,
        stderr: stderr + '\nProcess timed out',
        exitCode: -1,
        success: false
      })
    }, timeout)

    child.stdout?.on('data', (data: Buffer) => {
      if (stdout.length < maxBuffer) {
        stdout += data.toString()
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      if (stderr.length < maxBuffer) {
        stderr += data.toString()
      }
    })

    child.on('error', (error: Error) => {
      clearTimeout(timeoutId)
      resolve({
        stdout,
        stderr: stderr + '\n' + error.message,
        exitCode: -1,
        success: false
      })
    })

    child.on('close', (code: number | null) => {
      clearTimeout(timeoutId)
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

export function safeExecSync(command: string, options: any = {}): string {
  const { execSync } = require('child_process')
  try {
    return execSync(command, {
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 30000,
      ...options
    })
  } catch (error: any) {
    throw new Error(`Command execution failed: ${error.message}`)
  }
}
