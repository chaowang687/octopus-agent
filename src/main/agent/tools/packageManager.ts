import { execSync } from 'child_process'
import { toolRegistry } from '../ToolRegistry'

toolRegistry.register({
  name: 'npm_install',
  description: 'Install npm dependencies for a project',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'packages', type: 'array', description: 'Optional list of packages to install', required: false },
    { name: 'dev', type: 'boolean', description: 'Install as dev dependencies', required: false },
    { name: 'global', type: 'boolean', description: 'Install globally', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packages = params?.packages
      const isDev = params?.dev || false
      const isGlobal = params?.global || false
      
      let command = 'npm install'
      
      if (packages && Array.isArray(packages) && packages.length > 0) {
        const packageList = packages.join(' ')
        if (isDev) {
          command = `npm install --save-dev ${packageList}`
        } else if (isGlobal) {
          command = `npm install -g ${packageList}`
        } else {
          command = `npm install --save ${packageList}`
        }
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000
      })
      
      return { 
        success: true, 
        message: packages ? `Installed packages: ${packages.join(', ')}` : 'Dependencies installed',
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'yarn_install',
  description: 'Install yarn dependencies for a project',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'packages', type: 'array', description: 'Optional list of packages to install', required: false },
    { name: 'dev', type: 'boolean', description: 'Install as dev dependencies', required: false },
    { name: 'global', type: 'boolean', description: 'Install globally', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packages = params?.packages
      const isDev = params?.dev || false
      const isGlobal = params?.global || false
      
      let command = 'yarn install'
      
      if (packages && Array.isArray(packages) && packages.length > 0) {
        const packageList = packages.join(' ')
        if (isDev) {
          command = `yarn add -D ${packageList}`
        } else if (isGlobal) {
          command = `yarn global add ${packageList}`
        } else {
          command = `yarn add ${packageList}`
        }
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000
      })
      
      return { 
        success: true, 
        message: packages ? `Installed packages: ${packages.join(', ')}` : 'Dependencies installed',
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'pnpm_install',
  description: 'Install pnpm dependencies for a project',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'packages', type: 'array', description: 'Optional list of packages to install', required: false },
    { name: 'dev', type: 'boolean', description: 'Install as dev dependencies', required: false },
    { name: 'global', type: 'boolean', description: 'Install globally', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packages = params?.packages
      const isDev = params?.dev || false
      const isGlobal = params?.global || false
      
      let command = 'pnpm install'
      
      if (packages && Array.isArray(packages) && packages.length > 0) {
        const packageList = packages.join(' ')
        if (isDev) {
          command = `pnpm add -D ${packageList}`
        } else if (isGlobal) {
          command = `pnpm add -g ${packageList}`
        } else {
          command = `pnpm add ${packageList}`
        }
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000
      })
      
      return { 
        success: true, 
        message: packages ? `Installed packages: ${packages.join(', ')}` : 'Dependencies installed',
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'npm_uninstall',
  description: 'Uninstall npm packages',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'packages', type: 'array', description: 'List of packages to uninstall', required: true }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const packages = params?.packages
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!packages || !Array.isArray(packages) || packages.length === 0) {
        return { error: 'Missing parameter: packages' }
      }
      
      const packageList = packages.join(' ')
      const result = execSync(`npm uninstall ${packageList}`, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000
      })
      
      return { 
        success: true, 
        message: `Uninstalled packages: ${packages.join(', ')}`,
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'npm_update',
  description: 'Update npm packages',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'packages', type: 'array', description: 'Optional list of packages to update', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const packages = params?.packages
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      let command = 'npm update'
      
      if (packages && Array.isArray(packages) && packages.length > 0) {
        command += ` ${packages.join(' ')}`
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000
      })
      
      return { 
        success: true, 
        message: packages ? `Updated packages: ${packages.join(', ')}` : 'All packages updated',
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

console.log('[DevTools] Package management tools loaded')
