#!/bin/bash

# 复制 vm2 所需文件到 dist/main 目录
# 这个脚本用于开发模式，因为 vite 的 closeBundle hook 只在构建时运行

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

VM2_LIB="$PROJECT_ROOT/node_modules/vm2/lib"
DIST_MAIN="$PROJECT_ROOT/dist/main"

echo "Copying vm2 files to dist/main/..."
mkdir -p "$DIST_MAIN"

# 复制 bridge.js
cp "$VM2_LIB/bridge.js" "$DIST_MAIN/bridge.js"
if [ $? -eq 0 ]; then
  echo "✓ bridge.js copied"
else
  echo "✗ Failed to copy bridge.js"
  exit 1
fi

# 复制 setup-sandbox.js
cp "$VM2_LIB/setup-sandbox.js" "$DIST_MAIN/setup-sandbox.js"
if [ $? -eq 0 ]; then
  echo "✓ setup-sandbox.js copied"
else
  echo "✗ Failed to copy setup-sandbox.js"
  exit 1
fi

echo "✓ All vm2 files copied successfully"
