import { execSync } from 'child_process'

export function escapeShellArg(arg: string): string {
  if (process.platform === 'win32') {
    return `"${arg.replace(/"/g, '""')}"`
  }
  return `'${arg.replace(/'/g, "'\\''")}'`
}

export function escapeCommandArgs(args: string[]): string[] {
  return args.map(escapeShellArg)
}

export function safeExecSync(command: string, options: any = {}): string {
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

export function buildSafeCommand(command: string, args: string[]): string {
  const escapedArgs = escapeCommandArgs(args)
  return `${command} ${escapedArgs.join(' ')}`
}

export function validateCommand(command: string): boolean {
  const allowedCommands = [
    'ls', 'cat', 'grep', 'find', 'mkdir', 'rm', 'cp', 'mv',
    'npm', 'yarn', 'pnpm', 'git', 'node', 'python3', 'ruby',
    'code', 'open', 'pwd', 'echo', 'date', 'whoami', 'id'
  ]
  
  const cmdName = command.split(' ')[0].trim()
  return allowedCommands.includes(cmdName)
}

export function sanitizeCommand(command: string): string {
  // 移除危险字符
  return command.replace(/[;&|<>(){}[`$\x00]/g, '')
}