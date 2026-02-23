const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const SCRIPT_DIR = __dirname
const PROJECT_ROOT = path.dirname(SCRIPT_DIR)

process.chdir(PROJECT_ROOT)

console.log('========================================')
console.log('Octopus Agent 安装脚本')
console.log('========================================')

function execCommand(command, options = {}) {
  try {
    return execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options
    })
  } catch (error) {
    if (!options.ignoreError) {
      throw error
    }
    return null
  }
}

function checkCommandExists(command) {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${command}`, { stdio: 'pipe' })
    } else {
      execSync(`command -v ${command}`, { stdio: 'pipe' })
    }
    return true
  } catch {
    return false
  }
}

console.log('\n1. 环境检查...')

console.log('检查 Node.js 版本...')
if (checkCommandExists('node')) {
  const nodeVersion = execCommand('node -v', { silent: true }).trim()
  console.log(`✓ Node.js 版本: ${nodeVersion}`)
  
  const nodeMajor = parseInt(nodeVersion.match(/v(\d+)/)?.[1] || 0)
  if (nodeMajor < 18) {
    console.log('⚠️  Node.js 版本建议 18+，当前版本可能不兼容')
  }
} else {
  console.log('✗ Node.js 未安装，请先安装 Node.js 18+')
  process.exit(1)
}

console.log('检查 npm 版本...')
if (checkCommandExists('npm')) {
  const npmVersion = execCommand('npm -v', { silent: true }).trim()
  console.log(`✓ npm 版本: ${npmVersion}`)
} else {
  console.log('✗ npm 未安装，请先安装 npm')
  process.exit(1)
}

console.log('检查 Git...')
if (checkCommandExists('git')) {
  const gitVersion = execCommand('git --version', { silent: true }).trim()
  console.log(`✓ Git 版本: ${gitVersion}`)
} else {
  console.log('⚠️  Git 未安装，部分功能可能受限')
}

console.log('\n2. 权限检查...')

const desktopDir = path.join(os.homedir(), 'Desktop')
console.log('检查 Desktop 目录权限...')
if (fs.existsSync(desktopDir)) {
  try {
    fs.accessSync(desktopDir, fs.constants.W_OK)
    console.log('✓ 有权限在 Desktop 目录创建文件夹')
  } catch {
    console.log('⚠️  无权限在 Desktop 目录创建文件夹，将使用临时目录作为备用')
  }
} else {
  console.log('⚠️  Desktop 目录不存在，将使用临时目录作为备用')
}

console.log('检查项目目录权限...')
try {
  fs.accessSync(PROJECT_ROOT, fs.constants.W_OK)
  console.log('✓ 有权限在项目目录写入文件')
} catch {
  console.log('✗ 无权限在项目目录写入文件，请检查权限设置')
  process.exit(1)
}

console.log('\n3. 依赖安装...')

const nodeModulesPath = path.join(PROJECT_ROOT, 'node_modules')
const packageLockPath = path.join(PROJECT_ROOT, 'package-lock.json')

console.log('清理旧的依赖...')
if (fs.existsSync(nodeModulesPath)) {
  console.log('删除旧的 node_modules 目录...')
  fs.rmSync(nodeModulesPath, { recursive: true, force: true })
}

if (fs.existsSync(packageLockPath)) {
  console.log('删除旧的 package-lock.json 文件...')
  fs.unlinkSync(packageLockPath)
}

console.log('安装依赖...')
execCommand('npm install')

console.log('\n4. 构建检查...')

console.log('运行类型检查...')
try {
  execCommand('npm run typecheck')
} catch (error) {
  console.log('⚠️  类型检查发现一些问题，但不影响运行')
}

console.log('运行 lint 检查...')
try {
  execCommand('npm run lint')
} catch (error) {
  console.log('⚠️  Lint 检查发现一些问题，但不影响运行')
}

console.log('\n5. 配置检查...')

const configDir = path.join(PROJECT_ROOT, 'src', 'main', 'config')
console.log('检查配置文件...')
if (!fs.existsSync(configDir)) {
  console.log('创建配置目录...')
  fs.mkdirSync(configDir, { recursive: true })
}

console.log('\n========================================')
console.log('安装完成！')
console.log('========================================')
console.log('\n使用方法:')
console.log('- 开发模式: npm run dev')
console.log('- 构建项目: npm run build')
console.log('- 运行测试: npm run test')
console.log('\n构建命令:')
console.log('- macOS: npm run dist:mac')
console.log('- Windows: npm run dist:win')
console.log('- Linux: npm run dist:linux')
console.log('\n注意事项:')
console.log('1. 如果在 Desktop 目录创建文件夹失败，系统会自动使用备用路径')
console.log('2. 首次运行时，请在 API 管理中配置 API 密钥')
console.log('3. 如遇到权限问题，请尝试使用管理员权限运行')
console.log('\n祝你使用愉快！')
console.log('========================================')
