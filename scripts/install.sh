#!/bin/bash

# Octopus Agent 安装脚本
# 处理依赖安装、权限检查和环境兼容性

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "========================================"
echo "Octopus Agent 安装脚本"
echo "========================================"

# 1. 环境检查
echo "\n1. 环境检查..."

# 检查 Node.js 版本
echo "检查 Node.js 版本..."
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v)
  echo "✓ Node.js 版本: $NODE_VERSION"
  
  # 检查 Node.js 版本是否足够
  NODE_MAJOR=$(echo "$NODE_VERSION" | grep -oE 'v([0-9]+)' | grep -oE '[0-9]+')
  if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "⚠️  Node.js 版本建议 18+，当前版本可能不兼容"
  fi
else
  echo "✗ Node.js 未安装，请先安装 Node.js 18+"
  exit 1
fi

# 检查 npm 版本
echo "检查 npm 版本..."
if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm -v)
  echo "✓ npm 版本: $NPM_VERSION"
else
  echo "✗ npm 未安装，请先安装 npm"
  exit 1
fi

# 检查 git
echo "检查 Git..."
if command -v git &> /dev/null; then
  GIT_VERSION=$(git --version)
  echo "✓ Git 版本: $GIT_VERSION"
else
  echo "⚠️  Git 未安装，部分功能可能受限"
fi

# 2. 权限检查
echo "\n2. 权限检查..."

# 检查 Desktop 目录权限
DESKTOP_DIR="$HOME/Desktop"
echo "检查 Desktop 目录权限..."
if [ -d "$DESKTOP_DIR" ]; then
  if [ -w "$DESKTOP_DIR" ]; then
    echo "✓ 有权限在 Desktop 目录创建文件夹"
  else
    echo "⚠️  无权限在 Desktop 目录创建文件夹，将使用临时目录作为备用"
  fi
else
  echo "⚠️  Desktop 目录不存在，将使用临时目录作为备用"
fi

# 检查项目目录权限
echo "检查项目目录权限..."
if [ -w "$PROJECT_ROOT" ]; then
  echo "✓ 有权限在项目目录写入文件"
else
  echo "✗ 无权限在项目目录写入文件，请检查权限设置"
  exit 1
fi

# 3. 依赖安装
echo "\n3. 依赖安装..."

echo "清理旧的依赖..."
if [ -d "node_modules" ]; then
  echo "删除旧的 node_modules 目录..."
  rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
  echo "删除旧的 package-lock.json 文件..."
  rm -f package-lock.json
fi

echo "安装依赖..."
npm install

# 4. 构建检查
echo "\n4. 构建检查..."

echo "运行类型检查..."
npm run typecheck

echo "运行 lint 检查..."
npm run lint

# 5. 配置检查
echo "\n5. 配置检查..."

# 检查是否存在配置文件
echo "检查配置文件..."
if [ ! -d "src/main/config" ]; then
  echo "创建配置目录..."
  mkdir -p src/main/config
fi

# 6. 完成
echo "\n========================================"
echo "安装完成！"
echo "========================================"
echo "\n使用方法:"
echo "- 开发模式: npm run dev"
echo "- 构建项目: npm run build"
echo "- 运行测试: npm run test"
echo "\n注意事项:"
echo "1. 如果在 Desktop 目录创建文件夹失败，系统会自动使用备用路径"
echo "2. 首次运行时，请在 API 管理中配置 API 密钥"
echo "3. 如遇到权限问题，请尝试使用管理员权限运行"
echo "\n祝你使用愉快！"
echo "========================================"
