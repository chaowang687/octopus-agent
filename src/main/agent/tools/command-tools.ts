import { toolRegistry } from '../ToolRegistry'
import { executeAsync, AsyncCommandExecutor } from '../../utils/AsyncCommandExecutor'

const executor = new AsyncCommandExecutor()

export function registerCommandTools(): void {
  toolRegistry.register({
    name: 'execute_command',
    description: 'Execute a system command',
    parameters: [
      { name: 'command', type: 'string', description: 'Command to execute', required: true },
      { name: 'cwd', type: 'string', description: 'Working directory', required: false },
      { name: 'timeout', type: 'number', description: 'Timeout in milliseconds', required: false }
    ],
    handler: async (params: any) => {
      try {
        const command = params?.command
        const cwd = params?.cwd || process.cwd()
        const timeout = params?.timeout || 60000

        if (!command) return { error: 'Missing parameter: command' }

        const result = await executeAsync(command, {
          cwd,
          timeout,
          maxBuffer: 10 * 1024 * 1024
        })

        if (result.success) {
          return { output: result.stdout, success: true }
        }
        
        return {
          error: result.stderr || result.stdout,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode
        }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  toolRegistry.register({
    name: 'execute_command_async',
    description: 'Execute a system command asynchronously with ability to abort',
    parameters: [
      { name: 'command', type: 'string', description: 'Command to execute', required: true },
      { name: 'cwd', type: 'string', description: 'Working directory', required: false },
      { name: 'timeout', type: 'number', description: 'Timeout in milliseconds', required: false }
    ],
    handler: async (params: any) => {
      try {
        const command = params?.command
        const cwd = params?.cwd || process.cwd()
        const timeout = params?.timeout || 60000

        if (!command) return { error: 'Missing parameter: command' }

        await executor.executeWithSignal(command, {
          cwd,
          timeout
        })

        return { 
          pid: executor.getActiveProcessCount(),
          success: true,
          message: 'Command started asynchronously'
        }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  toolRegistry.register({
    name: 'check_command',
    description: 'Check if a command is available',
    parameters: [
      { name: 'command', type: 'string', description: 'Command name to check', required: true }
    ],
    handler: async (params: any) => {
      try {
        const command = params?.command
        if (!command) return { error: 'Missing parameter: command' }

        const checkCmd = process.platform === 'win32' 
          ? `where ${command}` 
          : `which ${command}`
        
        const result = await executeAsync(checkCmd, { timeout: 5000 })
        return { available: result.success }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  toolRegistry.register({
    name: 'get_system_info',
    description: 'Get system information',
    parameters: [],
    handler: async () => {
      try {
        const os = require('os')
        return {
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          hostname: os.hostname(),
          homedir: os.homedir(),
          tmpdir: os.tmpdir()
        }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  toolRegistry.register({
    name: 'list_processes',
    description: 'List running processes',
    parameters: [
      { name: 'limit', type: 'number', description: 'Max number of processes to return', required: false }
    ],
    handler: async (params: any) => {
      try {
        const limit = params?.limit || 20
        
        const psCmd = process.platform === 'win32'
          ? 'tasklist'
          : 'ps aux'
        
        const result = await executeAsync(psCmd, { timeout: 10000 })
        
        if (!result.success) {
          return { error: result.stderr }
        }

        const lines = result.stdout.split('\n').slice(1, limit + 1)
        
        const processes = lines.map((line: string) => {
          const parts = line.trim().split(/\s+/)
          if (process.platform === 'win32') {
            return {
              name: parts[0],
              pid: parts[1],
              mem: parts[4]
            }
          }
          return {
            pid: parts[1],
            cpu: parts[2],
            mem: parts[3],
            command: parts.slice(10).join(' ')
          }
        }).filter((p: { pid?: string }) => p.pid)

        return { processes }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  toolRegistry.register({
    name: 'kill_process',
    description: 'Kill a process by PID',
    parameters: [
      { name: 'pid', type: 'number', description: 'Process ID to kill', required: true },
      { name: 'force', type: 'boolean', description: 'Force kill (SIGKILL)', required: false }
    ],
    handler: async (params: any) => {
      try {
        const pid = params?.pid
        const force = params?.force || false

        if (!pid) return { error: 'Missing parameter: pid' }

        const killCmd = process.platform === 'win32'
          ? `taskkill /PID ${pid}${force ? ' /F' : ''}`
          : `kill ${force ? '-9' : ''} ${pid}`

        const result = await executeAsync(killCmd, { timeout: 5000 })
        
        return { 
          success: result.success, 
          message: result.success ? `Process ${pid} killed` : result.stderr 
        }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })
}

registerCommandTools()
