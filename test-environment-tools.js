#!/usr/bin/env node

/**
 * 测试环境检查工具
 * 用于验证环境检查工具是否正常工作
 */

const path = require('path');
const fs = require('fs');

console.log('========================================');
console.log('测试环境检查工具');
console.log('========================================');

// 检查环境工具文件是否存在
const environmentToolPath = path.join(__dirname, 'src/main/agent/tools/environment.ts');
if (fs.existsSync(environmentToolPath)) {
  console.log('✓ 环境工具文件存在:', environmentToolPath);
} else {
  console.log('✗ 环境工具文件不存在:', environmentToolPath);
  process.exit(1);
}

// 检查工具导入是否正确
const toolsPath = path.join(__dirname, 'src/main/agent/tools.ts');
if (fs.existsSync(toolsPath)) {
  const toolsContent = fs.readFileSync(toolsPath, 'utf8');
  if (toolsContent.includes("import './tools/environment'")) {
    console.log('✓ 环境工具已正确导入到 tools.ts');
  } else {
    console.log('✗ 环境工具未导入到 tools.ts');
  }
} else {
  console.log('✗ tools.ts 文件不存在');
}

// 检查安装脚本是否存在
const installScriptPath = path.join(__dirname, 'scripts/install.sh');
if (fs.existsSync(installScriptPath)) {
  console.log('✓ 安装脚本存在:', installScriptPath);
  // 检查脚本是否可执行
  const stats = fs.statSync(installScriptPath);
  if (stats.mode & 0o111) {
    console.log('✓ 安装脚本具有执行权限');
  } else {
    console.log('⚠️  安装脚本缺少执行权限');
  }
} else {
  console.log('✗ 安装脚本不存在:', installScriptPath);
}

// 检查 package.json 中的安装脚本
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.scripts && packageJson.scripts.install) {
    console.log('✓ package.json 中已添加安装脚本');
    console.log('  脚本命令:', packageJson.scripts.install);
  } else {
    console.log('✗ package.json 中未添加安装脚本');
  }
} else {
  console.log('✗ package.json 文件不存在');
}

// 检查环境兼容性
console.log('\n========================================');
console.log('环境兼容性检查');
console.log('========================================');

// 检查 Node.js 版本
console.log('Node.js 版本:', process.version);
const nodeMajor = parseInt(process.version.replace('v', '').split('.')[0]);
if (nodeMajor >= 18) {
  console.log('✓ Node.js 版本满足要求 (18+)');
} else {
  console.log('⚠️  Node.js 版本建议 18+');
}

// 检查 npm 版本
try {
  const { execSync } = require('child_process');
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log('npm 版本:', npmVersion);
  const npmMajor = parseInt(npmVersion.split('.')[0]);
  if (npmMajor >= 9) {
    console.log('✓ npm 版本满足要求 (9+)');
  } else {
    console.log('⚠️  npm 版本建议 9+');
  }
} catch {
  console.log('⚠️  无法检查 npm 版本');
}

// 检查 Git 版本
try {
  const { execSync } = require('child_process');
  const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
  console.log('Git 版本:', gitVersion);
  console.log('✓ Git 已安装');
} catch {
  console.log('⚠️  Git 未安装，部分功能可能受限');
}

// 检查 Desktop 目录权限
const desktopDir = path.join(require('os').homedir(), 'Desktop');
if (fs.existsSync(desktopDir)) {
  try {
    fs.accessSync(desktopDir, fs.constants.W_OK);
    console.log('✓ 有权限在 Desktop 目录创建文件夹');
  } catch {
    console.log('⚠️  无权限在 Desktop 目录创建文件夹，将使用备用路径');
  }
} else {
  console.log('⚠️  Desktop 目录不存在');
}

// 检查项目目录权限
const projectDir = __dirname;
try {
  fs.accessSync(projectDir, fs.constants.W_OK);
  console.log('✓ 有权限在项目目录写入文件');
} catch {
  console.log('⚠️  无权限在项目目录写入文件');
}

console.log('\n========================================');
console.log('测试完成！');
console.log('========================================');
console.log('\n使用方法:');
console.log('1. 运行安装脚本: npm run install');
console.log('2. 开发模式运行: npm run dev');
console.log('3. 构建项目: npm run build');
console.log('\n环境检查工具已就绪，智能体现在可以使用以下工具:');
console.log('- check_environment: 检查环境信息');
console.log('- install_dependencies: 安装项目依赖');
console.log('- check_compatibility: 检查环境兼容性');
console.log('- check_permissions: 检查指定路径的权限');
console.log('- check_and_fix_permissions: 检查并修复系统权限问题');
console.log('- fix_desktop_permissions: 修复Desktop目录权限问题');
console.log('- check_permission_status: 检查系统关键目录的权限状态');

// 检查权限修复工具文件是否存在
const permissionFixerPath = path.join(__dirname, 'src/main/agent/tools/permission-fixer.ts');
if (fs.existsSync(permissionFixerPath)) {
  console.log('✓ 权限修复工具文件存在:', permissionFixerPath);
} else {
  console.log('✗ 权限修复工具文件不存在:', permissionFixerPath);
}
console.log('\n这些工具将帮助智能体自主处理路径权限、依赖安装和环境兼容性问题。');
console.log('========================================');
