#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

DIST_MAIN="$PROJECT_ROOT/dist/main"

echo "Preparing dist/main directory..."
mkdir -p "$DIST_MAIN"

echo "✓ Build preparation complete"
