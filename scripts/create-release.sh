#!/bin/bash

# GitHub Release 创建脚本
# 使用方法: ./scripts/create-release.sh <version> <title> [notes]

set -e

VERSION=$1
TITLE=$2
NOTES=${3:-"Release version ${VERSION}"}

if [ -z "$VERSION" ]; then
    echo "错误: 请提供版本号"
    echo "使用方法: ./scripts/create-release.sh <version> <title> [notes]"
    echo "示例: ./scripts/create-release.sh v0.1.1 'Octopus Agent v0.1.1'"
    exit 1
fi

if [ -z "$TITLE" ]; then
    echo "错误: 请提供发布标题"
    echo "使用方法: ./scripts/create-release.sh <version> <title> [notes]"
    echo "示例: ./scripts/create-release.sh v0.1.1 'Octopus Agent v0.1.1'"
    exit 1
fi

echo "=========================================="
echo "创建 GitHub Release"
echo "=========================================="
echo "版本: $VERSION"
echo "标题: $TITLE"
echo "备注: $NOTES"
echo "=========================================="

# 检查是否已安装 gh CLI
if ! command -v gh &> /dev/null; then
    echo "错误: 未安装 GitHub CLI"
    echo "请运行: brew install gh"
    exit 1
fi

# 检查是否已登录
if ! gh auth status &> /dev/null; then
    echo "错误: 未登录 GitHub"
    echo "请运行: gh auth login"
    exit 1
fi

# 检查 release 目录是否存在
if [ ! -d "release/mac-arm64" ]; then
    echo "错误: 未找到构建产物"
    echo "请先运行: npm run dist"
    exit 1
fi

# 查找构建产物
DMG_FILE=$(find release/mac-arm64 -name "*.dmg" | head -1)
ZIP_FILE=$(find release/mac-arm64 -name "*.zip" | head -1)
YAML_FILE=$(find release/mac-arm64 -name "latest-mac.yml" | head -1)

if [ -z "$DMG_FILE" ]; then
    echo "错误: 未找到 .dmg 文件"
    exit 1
fi

if [ -z "$ZIP_FILE" ]; then
    echo "错误: 未找到 .zip 文件"
    exit 1
fi

if [ -z "$YAML_FILE" ]; then
    echo "错误: 未找到 latest-mac.yml 文件"
    exit 1
fi

echo "找到构建产物:"
echo "  - $DMG_FILE"
echo "  - $ZIP_FILE"
echo "  - $YAML_FILE"
echo ""

# 创建 Git 标签
echo "创建 Git 标签..."
git tag -a "$VERSION" -m "$TITLE"
git push origin "$VERSION"

echo "标签已推送: $VERSION"
echo ""

# 创建 GitHub Release
echo "创建 GitHub Release..."
gh release create "$VERSION" \
    --title "$TITLE" \
    --notes "$NOTES" \
    "$DMG_FILE" \
    "$ZIP_FILE" \
    "$YAML_FILE"

echo ""
echo "=========================================="
echo "✅ Release 创建成功!"
echo "=========================================="
echo "版本: $VERSION"
echo "标题: $TITLE"
echo "链接: $(gh repo view --json url -q .url)/releases/tag/$VERSION"
echo "=========================================="
