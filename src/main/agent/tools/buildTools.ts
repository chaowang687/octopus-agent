import { toolRegistry } from '../ToolRegistry'
import { executeAsync, ExecResult } from '../../utils/AsyncCommandExecutor'

const BUILD_TIMEOUT = 300000
const DEV_SERVER_TIMEOUT = 10000
const TEST_TIMEOUT = 120000
const LINT_TIMEOUT = 60000
const START_TIMEOUT = 10000

interface ToolResult {
  success?: boolean
  error?: string
  message?: string
  output?: string
}

function handleResult(result: ExecResult): ToolResult {
  if (result.success) {
    return {
      success: true,
      output: result.stdout
    }
  }
  return {
    error: result.stderr || result.stdout || `Exit code: ${result.exitCode}`,
    output: result.stdout
  }
}

toolRegistry.register({
  name: 'build_project',
  description: 'Build a project (npm run build, yarn build, etc.)',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'packageManager', type: 'string', description: 'Package manager (npm, yarn, pnpm)', required: false }
  ],
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageManager = params?.packageManager || 'npm'
      const command = `${packageManager} run build`
      
      const result = await executeAsync(command, { 
        cwd: projectPath,
        timeout: BUILD_TIMEOUT
      })
      
      const toolResult = handleResult(result)
      if (toolResult.success) {
        toolResult.message = 'Project built successfully'
      }
      return toolResult
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'run_dev_server',
  description: 'Start development server (npm run dev, yarn dev, etc.)',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'packageManager', type: 'string', description: 'Package manager (npm, yarn, pnpm)', required: false },
    { name: 'port', type: 'number', description: 'Port to run on', required: false }
  ],
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageManager = params?.packageManager || 'npm'
      const port = params?.port
      
      let command = `${packageManager} run dev`
      if (port) {
        command += ` -- --port ${port}`
      }
      
      const result = await executeAsync(command, { 
        cwd: projectPath,
        timeout: DEV_SERVER_TIMEOUT
      })
      
      const toolResult = handleResult(result)
      if (toolResult.success) {
        toolResult.message = `Development server started${port ? ` on port ${port}` : ''}`
      }
      return toolResult
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'run_tests',
  description: 'Run project tests (npm test, yarn test, etc.)',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'packageManager', type: 'string', description: 'Package manager (npm, yarn, pnpm)', required: false },
    { name: 'watch', type: 'boolean', description: 'Run in watch mode', required: false }
  ],
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageManager = params?.packageManager || 'npm'
      const isWatch = params?.watch || false
      
      let command = `${packageManager} test`
      if (isWatch) {
        command += ' -- --watch'
      }
      
      const result = await executeAsync(command, { 
        cwd: projectPath,
        timeout: TEST_TIMEOUT
      })
      
      const toolResult = handleResult(result)
      if (toolResult.success) {
        toolResult.message = 'Tests completed'
      }
      return toolResult
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'run_lint',
  description: 'Run linter (npm run lint, yarn lint, etc.)',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'packageManager', type: 'string', description: 'Package manager (npm, yarn, pnpm)', required: false },
    { name: 'fix', type: 'boolean', description: 'Auto-fix linting issues', required: false }
  ],
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageManager = params?.packageManager || 'npm'
      const shouldFix = params?.fix || false
      
      let command = `${packageManager} run lint`
      if (shouldFix) {
        command += ' -- --fix'
      }
      
      const result = await executeAsync(command, { 
        cwd: projectPath,
        timeout: LINT_TIMEOUT
      })
      
      const toolResult = handleResult(result)
      if (toolResult.success) {
        toolResult.message = 'Linting completed'
      }
      return toolResult
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'run_typecheck',
  description: 'Run TypeScript type checking (npm run typecheck, etc.)',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'packageManager', type: 'string', description: 'Package manager (npm, yarn, pnpm)', required: false }
  ],
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageManager = params?.packageManager || 'npm'
      const command = `${packageManager} run typecheck`
      
      const result = await executeAsync(command, { 
        cwd: projectPath,
        timeout: LINT_TIMEOUT
      })
      
      const toolResult = handleResult(result)
      if (toolResult.success) {
        toolResult.message = 'Type checking completed'
      }
      return toolResult
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'start_project',
  description: 'Start a project (npm start, yarn start, etc.)',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'packageManager', type: 'string', description: 'Package manager (npm, yarn, pnpm)', required: false }
  ],
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageManager = params?.packageManager || 'npm'
      const command = `${packageManager} start`
      
      const result = await executeAsync(command, { 
        cwd: projectPath,
        timeout: START_TIMEOUT
      })
      
      const toolResult = handleResult(result)
      if (toolResult.success) {
        toolResult.message = 'Project started'
      }
      return toolResult
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

console.log('[DevTools] Build and run tools loaded (async)')
