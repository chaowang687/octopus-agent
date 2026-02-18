#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('📚 Starting API documentation generation...\n')

const docsDir = path.join(__dirname, '..', 'docs', 'api')

if (fs.existsSync(docsDir)) {
  console.log('🧹 Cleaning existing documentation directory...')
  fs.rmSync(docsDir, { recursive: true, force: true })
}

try {
  console.log('🔨 Generating documentation with TypeDoc...')
  execSync('npx typedoc', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  })

  console.log('\n✅ Documentation generated successfully!')
  console.log(`📂 Output directory: ${docsDir}`)
  console.log('\nTo view the documentation:')
  console.log('  1. Open docs/api/index.html in your browser')
  console.log('  2. Or run: npx serve docs/api')
} catch (error) {
  console.error('\n❌ Failed to generate documentation:', error.message)
  process.exit(1)
}