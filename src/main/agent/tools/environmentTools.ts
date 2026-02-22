import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { toolRegistry } from '../ToolRegistry'

toolRegistry.register({
  name: 'check_node_version',
  description: 'Check Node.js version',
  parameters: [],
  handler: async () => {
    try {
      const result = execSync('node --version', { 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000
      })
      
      const version = result.trim()
      const versionMatch = version.match(/v(\d+\.\d+\.\d+)/)
      
      if (versionMatch) {
        const [major, minor, patch] = versionMatch[1].split('.').map(Number)
        
        return {
          success: true,
          version: version,
          major,
          minor,
          patch,
          isValid: true
        }
      }
      
      return { 
        success: false, 
        error: 'Invalid Node.js version format',
        version: result.trim()
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: 'Node.js is not installed or not in PATH' 
      }
    }
  }
})

toolRegistry.register({
  name: 'check_npm_version',
  description: 'Check npm version',
  parameters: [],
  handler: async () => {
    try {
      const result = execSync('npm --version', { 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000
      })
      
      const version = result.trim()
      const versionMatch = version.match(/(\d+\.\d+\.\d+)/)
      
      if (versionMatch) {
        const [major, minor, patch] = versionMatch[0].split('.').map(Number)
        
        return {
          success: true,
          version: version,
          major,
          minor,
          patch,
          isValid: true
        }
      }
      
      return { 
        success: false, 
        error: 'Invalid npm version format',
        version: result.trim()
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: 'npm is not installed or not in PATH' 
      }
    }
  }
})

toolRegistry.register({
  name: 'check_yarn_version',
  description: 'Check Yarn version',
  parameters: [],
  handler: async () => {
    try {
      const result = execSync('yarn --version', { 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000
      })
      
      const version = result.trim()
      const versionMatch = version.match(/(\d+\.\d+\.\d+)/)
      
      if (versionMatch) {
        const [major, minor, patch] = versionMatch[0].split('.').map(Number)
        
        return {
          success: true,
          version: version,
          major,
          minor,
          patch,
          isValid: true
        }
      }
      
      return { 
        success: false, 
        error: 'Invalid Yarn version format',
        version: result.trim()
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: 'Yarn is not installed or not in PATH' 
      }
    }
  }
})

toolRegistry.register({
  name: 'check_pnpm_version',
  description: 'Check pnpm version',
  parameters: [],
  handler: async () => {
    try {
      const result = execSync('pnpm --version', { 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000
      })
      
      const version = result.trim()
      const versionMatch = version.match(/(\d+\.\d+\.\d+)/)
      
      if (versionMatch) {
        const [major, minor, patch] = versionMatch[0].split('.').map(Number)
        
        return {
          success: true,
          version: version,
          major,
          minor,
          patch,
          isValid: true
        }
      }
      
      return { 
        success: false, 
        error: 'Invalid pnpm version format',
        version: result.trim()
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: 'pnpm is not installed or not in PATH' 
      }
    }
  }
})

toolRegistry.register({
  name: 'check_python_version',
  description: 'Check Python version',
  parameters: [],
  handler: async () => {
    try {
      const result = execSync('python3 --version', { 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000
      })
      
      const version = result.trim()
      const versionMatch = version.match(/(\d+\.\d+\.\d+)/)
      
      if (versionMatch) {
        const [major, minor, patch] = versionMatch[0].split('.').map(Number)
        
        return {
          success: true,
          version: version,
          major,
          minor,
          patch,
          isValid: true
        }
      }
      
      return { 
        success: false, 
        error: 'Invalid Python version format',
        version: result.trim()
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: 'Python is not installed or not in PATH' 
      }
    }
  }
})

toolRegistry.register({
  name: 'check_git_version',
  description: 'Check Git version',
  parameters: [],
  handler: async () => {
    try {
      const result = execSync('git --version', { 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000
      })
      
      const version = result.trim()
      const versionMatch = version.match(/(\d+\.\d+\.\d+)/)
      
      if (versionMatch) {
        const [major, minor, patch] = versionMatch[0].split('.').map(Number)
        
        return {
          success: true,
          version: version,
          major,
          minor,
          patch,
          isValid: true
        }
      }
      
      return { 
        success: false, 
        error: 'Invalid Git version format',
        version: result.trim()
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: 'Git is not installed or not in PATH' 
      }
    }
  }
})

toolRegistry.register({
  name: 'validate_environment',
  description: 'Validate development environment for a specific project type',
  parameters: [
    { name: 'projectType', type: 'string', description: 'Project type (react, vue, next, node, express, electron)', required: true },
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectType = params?.projectType
      const projectPath = params?.projectPath
      
      if (!projectType) return { error: 'Missing parameter: projectType' }
      
      const requirements: any = {
        required: [],
        installed: [],
        missing: [],
        warnings: []
      }
      
      const checkNode = async () => {
        try {
          const result = execSync('node --version', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 })
          const version = result.trim()
          const versionMatch = version.match(/v(\d+\.\d+\.\d+)/)
          if (versionMatch) {
            const [major, minor] = versionMatch[1].split('.').map(Number)
            const minMajor = 14
            const minMinor = 0
            
            if (major > minMajor || (major === minMajor && minor >= minMinor)) {
              requirements.installed.push({ tool: 'Node.js', version })
            } else {
              requirements.missing.push({ tool: 'Node.js', required: `>= ${minMajor}.${minMinor}.0`, current: version })
            }
          }
        } catch {
          requirements.missing.push({ tool: 'Node.js', required: '>= 14.0.0', current: 'Not installed' })
        }
      }
      
      const checkNpm = async () => {
        try {
          const result = execSync('npm --version', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 })
          const version = result.trim()
          requirements.installed.push({ tool: 'npm', version })
        } catch {
          requirements.missing.push({ tool: 'npm', required: '>= 6.0.0', current: 'Not installed' })
        }
      }
      
      const checkGit = async () => {
        try {
          const result = execSync('git --version', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 })
          const version = result.trim()
          requirements.installed.push({ tool: 'Git', version })
        } catch {
          requirements.warnings.push({ tool: 'Git', message: 'Git is recommended for version control' })
        }
      }
      
      const checkTypeScript = async () => {
        try {
          const result = execSync('tsc --version', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 })
          const version = result.trim()
          requirements.installed.push({ tool: 'TypeScript', version })
        } catch {
          if (projectType === 'react' || projectType === 'vue' || projectType === 'next') {
            requirements.warnings.push({ tool: 'TypeScript', message: 'TypeScript is recommended for this project type' })
          }
        }
      }
      
      const checkProjectDependencies = async () => {
        if (!projectPath) return
        
        const packageJsonPath = path.join(projectPath, 'package.json')
        if (!fs.existsSync(packageJsonPath)) return
        
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
          const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
          
          for (const [dep, version] of Object.entries(dependencies)) {
            try {
              const result = execSync(`npm list ${dep}`, { 
                encoding: 'utf8', 
                stdio: 'pipe',
                timeout: 10000
              })
              if (result.includes('empty')) {
                requirements.missing.push({ tool: dep, required: version, current: 'Not installed' })
              } else {
                requirements.installed.push({ tool: dep, version })
              }
            } catch {
              requirements.warnings.push({ tool: dep, message: 'Could not verify installation' })
            }
          }
        } catch {
          requirements.warnings.push({ tool: 'package.json', message: 'Could not read package.json' })
        }
      }
      
      await checkNode()
      await checkNpm()
      await checkGit()
      await checkTypeScript()
      await checkProjectDependencies()
      
      const isValid = requirements.missing.length === 0
      
      return {
        success: true,
        isValid,
        message: isValid 
          ? 'Environment is valid and ready for development'
          : `Environment is missing ${requirements.missing.length} required tool(s)`,
        requirements
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

console.log('[DevTools] Environment management tools loaded')
