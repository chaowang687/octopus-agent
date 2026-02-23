const fs = require('fs')
const path = require('path')

const SCRIPT_DIR = __dirname
const PROJECT_ROOT = path.dirname(SCRIPT_DIR)
const DIST_MAIN = path.join(PROJECT_ROOT, 'dist', 'main')

console.log('Preparing dist/main directory...')

if (!fs.existsSync(DIST_MAIN)) {
  fs.mkdirSync(DIST_MAIN, { recursive: true })
}

console.log('✓ Build preparation complete')
