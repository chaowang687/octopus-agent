import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { toolRegistry } from '../ToolRegistry'

toolRegistry.register({
  name: 'build_project',
  description: 'Build a project (npm run build, yarn build, etc.)',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'packageManager', type: 'string', description: 'Package manager (npm, yarn, pnpm)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageManager = params?.packageManager || 'npm'
      
      const command = `${packageManager} run build`
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000
      })
      
      return { 
        success: true, 
        message: 'Project built successfully',
        output: result 
      }
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
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageManager = params?.packageManager || 'npm'
      const port = params?.port
      
      let command = `${packageManager} run dev`
      
      if (port) {
        command += ` -- --port ${port}`
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10000
      })
      
      return { 
        success: true, 
        message: `Development server started${port ? ` on port ${port}` : ''}`,
        output: result 
      }
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
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageManager = params?.packageManager || 'npm'
      const isWatch = params?.watch || false
      
      let command = `${packageManager} test`
      
      if (isWatch) {
        command += ' -- --watch'
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 120000
      })
      
      return { 
        success: true, 
        message: 'Tests completed',
        output: result 
      }
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
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageManager = params?.packageManager || 'npm'
      const shouldFix = params?.fix || false
      
      let command = `${packageManager} run lint`
      
      if (shouldFix) {
        command += ' -- --fix'
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000
      })
      
      return { 
        success: true, 
        message: 'Linting completed',
        output: result 
      }
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
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageManager = params?.packageManager || 'npm'
      
      const command = `${packageManager} run typecheck`
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000
      })
      
      return { 
        success: true, 
        message: 'Type checking completed',
        output: result 
      }
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
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageManager = params?.packageManager || 'npm'
      
      const command = `${packageManager} start`
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10000
      })
      
      return { 
        success: true, 
        message: 'Project started',
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

console.log('[DevTools] Build and run tools loaded')
