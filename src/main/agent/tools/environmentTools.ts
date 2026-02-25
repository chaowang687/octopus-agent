import * as fs from 'fs'
import * as path from 'path'
import { toolRegistry } from '../ToolRegistry'
import { executeAsync } from '../../utils/AsyncCommandExecutor'

const VERSION_CHECK_TIMEOUT = 5000
const DEPENDENCY_CHECK_TIMEOUT = 10000

interface VersionInfo {
  success: boolean
  version?: string
  major?: number
  minor?: number
  patch?: number
  isValid?: boolean
  error?: string
}

interface ToolResult {
  success?: boolean
  error?: string
  message?: string
  [key: string]: any
}

async function checkVersion(command: string): Promise<VersionInfo> {
  try {
    const result = await executeAsync(command, { timeout: VERSION_CHECK_TIMEOUT })
    
    if (!result.success) {
      return { success: false, error: 'Command failed' }
    }
    
    const version = result.stdout.trim()
    const versionMatch = version.match(/v?(\d+\.\d+\.\d+)/)
    
    if (versionMatch) {
      const [major, minor, patch] = versionMatch[1].split('.').map(Number)
      return { success: true, version, major, minor, patch, isValid: true }
    }
    
    return { success: false, error: 'Invalid version format', version }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

toolRegistry.register({
  name: 'check_node_version',
  description: 'Check Node.js version',
  parameters: [],
  handler: async (): Promise<VersionInfo> => {
    const result = await checkVersion('node --version')
    if (result.success && result.major !== undefined) {
      const minMajor = 14
      result.isValid = result.major >= minMajor
      if (!result.isValid) {
        result.error = `Node.js version ${result.major}.${result.minor}.${result.patch} is below minimum required (14.0.0)`
      }
    }
    return result
  }
})

toolRegistry.register({
  name: 'check_npm_version',
  description: 'Check npm version',
  parameters: [],
  handler: async (): Promise<VersionInfo> => {
    return checkVersion('npm --version')
  }
})

toolRegistry.register({
  name: 'check_yarn_version',
  description: 'Check Yarn version',
  parameters: [],
  handler: async (): Promise<VersionInfo> => {
    return checkVersion('yarn --version')
  }
})

toolRegistry.register({
  name: 'check_pnpm_version',
  description: 'Check pnpm version',
  parameters: [],
  handler: async (): Promise<VersionInfo> => {
    return checkVersion('pnpm --version')
  }
})

toolRegistry.register({
  name: 'check_python_version',
  description: 'Check Python version',
  parameters: [],
  handler: async (): Promise<VersionInfo> => {
    return checkVersion('python3 --version')
  }
})

toolRegistry.register({
  name: 'check_git_version',
  description: 'Check Git version',
  parameters: [],
  handler: async (): Promise<VersionInfo> => {
    return checkVersion('git --version')
  }
})

toolRegistry.register({
  name: 'validate_environment',
  description: 'Validate development environment for a specific project type',
  parameters: [
    { name: 'projectType', type: 'string', description: 'Project type (react, vue, next, node, express, electron)', required: true },
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: false }
  ],
  handler: async (params: any): Promise<ToolResult> => {
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
        const result = await checkVersion('node --version')
        if (result.success && result.major !== undefined) {
          const minMajor = 14
          if (result.major >= minMajor) {
            requirements.installed.push({ tool: 'Node.js', version: result.version })
          } else {
            requirements.missing.push({ tool: 'Node.js', required: `>= 14.0.0`, current: result.version })
          }
        } else {
          requirements.missing.push({ tool: 'Node.js', required: '>= 14.0.0', current: 'Not installed' })
        }
      }
      
      const checkNpm = async () => {
        const result = await checkVersion('npm --version')
        if (result.success) {
          requirements.installed.push({ tool: 'npm', version: result.version })
        } else {
          requirements.missing.push({ tool: 'npm', required: '>= 6.0.0', current: 'Not installed' })
        }
      }
      
      const checkGit = async () => {
        const result = await checkVersion('git --version')
        if (result.success) {
          requirements.installed.push({ tool: 'Git', version: result.version })
        } else {
          requirements.warnings.push({ tool: 'Git', message: 'Git is recommended for version control' })
        }
      }
      
      const checkTypeScript = async () => {
        const result = await checkVersion('tsc --version')
        if (result.success) {
          requirements.installed.push({ tool: 'TypeScript', version: result.version })
        } else {
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
          const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf8')
          const packageJson = JSON.parse(packageJsonContent)
          const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
          
          const depChecks = Object.entries(dependencies).map(async ([dep, version]) => {
            try {
              const result = await executeAsync(`npm list ${dep}`, { 
                cwd: projectPath,
                timeout: DEPENDENCY_CHECK_TIMEOUT
              })
              if (result.stdout.includes('empty')) {
                requirements.missing.push({ tool: dep, required: version, current: 'Not installed' })
              } else {
                requirements.installed.push({ tool: dep, version: version as string })
              }
            } catch {
              requirements.warnings.push({ tool: dep, message: 'Could not verify installation' })
            }
          })
          
          await Promise.all(depChecks)
        } catch {
          requirements.warnings.push({ tool: 'package.json', message: 'Could not read package.json' })
        }
      }
      
      await Promise.all([
        checkNode(),
        checkNpm(),
        checkGit(),
        checkTypeScript()
      ])
      
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

toolRegistry.register({
  name: 'check_all_versions',
  description: 'Check all tool versions in parallel',
  parameters: [],
  handler: async (): Promise<ToolResult> => {
    const [node, npm, yarn, pnpm, python, git] = await Promise.all([
      checkVersion('node --version'),
      checkVersion('npm --version'),
      checkVersion('yarn --version'),
      checkVersion('pnpm --version'),
      checkVersion('python3 --version'),
      checkVersion('git --version')
    ])
    
    return {
      success: true,
      versions: {
        node: node.success ? node.version : 'Not installed',
        npm: npm.success ? npm.version : 'Not installed',
        yarn: yarn.success ? yarn.version : 'Not installed',
        pnpm: pnpm.success ? pnpm.version : 'Not installed',
        python: python.success ? python.version : 'Not installed',
        git: git.success ? git.version : 'Not installed'
      },
      details: { node, npm, yarn, pnpm, python, git }
    }
  }
})

console.log('[DevTools] Environment management tools loaded (async)')
