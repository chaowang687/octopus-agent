import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { app } from 'electron'
import { toolRegistry } from '../ToolRegistry'

/**
 * 环境检查工具
 * 提供环境检测、权限检查和依赖管理功能
 */

// 检查环境信息
function checkEnvironment() {
  const envInfo = {
    os: {
      platform: process.platform,
      version: os.version(),
      arch: process.arch,
      homedir: os.homedir(),
      tempdir: os.tmpdir()
    },
    node: {
      version: process.version,
      arch: process.arch,
      platform: process.platform
    },
    npm: {
      version: getNpmVersion()
    },
    git: {
      version: getGitVersion()
    },
    paths: {
      desktop: path.join(os.homedir(), 'Desktop'),
      userData: app.getPath('userData'),
      temp: os.tmpdir(),
      current: process.cwd()
    },
    permissions: {
      desktop: checkPathPermission(path.join(os.homedir(), 'Desktop')),
      userData: checkPathPermission(app.getPath('userData')),
      temp: checkPathPermission(os.tmpdir()),
      current: checkPathPermission(process.cwd())
    }
  }
  
  return envInfo
}

// 获取npm版本
function getNpmVersion() {
  try {
    const { execSync } = require('child_process')
    const output = execSync('npm --version', { encoding: 'utf8' }).trim()
    return output
  } catch {
    return 'not found'
  }
}

// 获取git版本
function getGitVersion() {
  try {
    const { execSync } = require('child_process')
    const output = execSync('git --version', { encoding: 'utf8' }).trim()
    return output
  } catch {
    return 'not found'
  }
}

// 检查路径权限
function checkPathPermission(checkPath: string) {
  try {
    if (!fs.existsSync(checkPath)) {
      return 'not_exists'
    }
    
    // 检查读权限
    fs.accessSync(checkPath, fs.constants.R_OK)
    
    // 检查写权限
    fs.accessSync(checkPath, fs.constants.W_OK)
    
    // 检查执行权限
    fs.accessSync(checkPath, fs.constants.X_OK)
    
    return 'full'
  } catch (error: any) {
    if (error.code === 'EACCES') {
      return 'no_access'
    }
    return 'error'
  }
}

// 检查依赖安装状态
function checkDependencies() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      return { success: false, error: 'package.json not found' }
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const dependencies = packageJson.dependencies || {}
    const devDependencies = packageJson.devDependencies || {}
    
    const nodeModulesPath = path.join(process.cwd(), 'node_modules')
    const hasNodeModules = fs.existsSync(nodeModulesPath)
    
    return {
      success: true,
      hasPackageJson: true,
      hasNodeModules: hasNodeModules,
      dependencies: Object.keys(dependencies).length,
      devDependencies: Object.keys(devDependencies).length,
      totalDependencies: Object.keys(dependencies).length + Object.keys(devDependencies).length
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 安装依赖
async function installDependencies() {
  try {
    const { execSync } = require('child_process')
    console.log('开始安装依赖...')
    
    // 清理旧依赖
    if (fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
      console.log('清理旧的 node_modules 目录...')
      require('fs-extra').removeSync(path.join(process.cwd(), 'node_modules'))
    }
    
    if (fs.existsSync(path.join(process.cwd(), 'package-lock.json'))) {
      console.log('清理旧的 package-lock.json 文件...')
      fs.unlinkSync(path.join(process.cwd(), 'package-lock.json'))
    }
    
    // 安装依赖
    console.log('执行 npm install...')
    execSync('npm install', { stdio: 'inherit', timeout: 600000 }) // 10分钟超时
    
    console.log('依赖安装完成！')
    return { success: true, message: 'Dependencies installed successfully' }
  } catch (error: any) {
    console.error('依赖安装失败:', error.message)
    return { success: false, error: error.message }
  }
}

// 检查环境兼容性
function checkCompatibility() {
  const envInfo = checkEnvironment()
  const issues: string[] = []
  
  // 检查 Node.js 版本
  const nodeVersion = envInfo.node.version
  const nodeMajor = parseInt(nodeVersion.replace('v', '').split('.')[0])
  if (nodeMajor < 18) {
    issues.push(`Node.js 版本过低 (${nodeVersion})，建议使用 18+`)
  }
  
  // 检查 npm 版本
  if (envInfo.npm.version === 'not found') {
    issues.push('npm 未安装')
  }
  
  // 检查 Git 版本
  if (envInfo.git.version === 'not found') {
    issues.push('Git 未安装，部分功能可能受限')
  }
  
  // 检查 Desktop 目录权限
  if (envInfo.permissions.desktop !== 'full') {
    issues.push('无权限在 Desktop 目录创建文件夹，将使用备用路径')
  }
  
  // 检查项目目录权限
  if (envInfo.permissions.current !== 'full') {
    issues.push('无权限在项目目录写入文件')
  }
  
  return {
    compatible: issues.length === 0,
    issues: issues,
    recommendations: [
      '确保 Node.js 版本为 18+',
      '确保 npm 版本为 9+',
      '确保 Git 已安装',
      '确保有足够的权限在 Desktop 目录创建文件夹',
      '确保有足够的权限在项目目录写入文件'
    ]
  }
}

// 注册环境检查工具
toolRegistry.register({
  name: 'check_environment',
  description: '检查环境信息，包括系统、Node.js、npm、Git 版本和权限状态',
  parameters: [],
  handler: async () => {
    try {
      const envInfo = checkEnvironment()
      const compatibility = checkCompatibility()
      const dependencies = checkDependencies()
      
      return {
        success: true,
        environment: envInfo,
        compatibility: compatibility,
        dependencies: dependencies
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 注册依赖安装工具
toolRegistry.register({
  name: 'install_dependencies',
  description: '安装项目依赖',
  parameters: [],
  handler: async () => {
    return installDependencies()
  }
})

// 注册兼容性检查工具
toolRegistry.register({
  name: 'check_compatibility',
  description: '检查环境兼容性，识别潜在问题',
  parameters: [],
  handler: async () => {
    try {
      const compatibility = checkCompatibility()
      return {
        success: true,
        compatibility: compatibility
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 注册权限检查工具
toolRegistry.register({
  name: 'check_permissions',
  description: '检查指定路径的权限',
  parameters: [
    { name: 'path', type: 'string', description: '要检查权限的路径', required: true }
  ],
  handler: async (params: any) => {
    try {
      const checkPath = params?.path
      if (!checkPath) return { error: 'Missing parameter: path' }
      
      const permission = checkPathPermission(checkPath)
      return {
        success: true,
        path: checkPath,
        permission: permission,
        hasAccess: permission === 'full'
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})
