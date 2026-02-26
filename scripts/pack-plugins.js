#!/usr/bin/env node

/**
 * 插件打包脚本
 * 用于将插件打包成可分发的格式
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PLUGINS_DIR = path.join(__dirname, '..', 'plugins')
const DIST_DIR = path.join(__dirname, '..', 'dist', 'plugins')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function packPlugin(pluginPath) {
  const manifestPath = path.join(pluginPath, 'manifest.json')
  
  if (!fs.existsSync(manifestPath)) {
    console.log(`Skipping ${pluginPath}: no manifest.json`)
    return null
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  const packageName = `${manifest.id}-${manifest.version}.zip`
  const outputPath = path.join(DIST_DIR, packageName)

  ensureDir(DIST_DIR)

  try {
    execSync(`cd "${pluginPath}" && zip -r "${outputPath}" .`, { stdio: 'pipe' })
    console.log(`✓ Packed: ${manifest.id}@${manifest.version} -> ${packageName}`)
    return { id: manifest.id, version: manifest.version, path: outputPath }
  } catch (error) {
    console.error(`✗ Failed to pack ${manifest.id}:`, error.message)
    return null
  }
}

function packAllPlugins() {
  console.log('=== Packing all plugins ===\n')
  
  ensureDir(DIST_DIR)

  const categories = fs.readdirSync(PLUGINS_DIR).filter(f => 
    fs.statSync(path.join(PLUGINS_DIR, f)).isDirectory() && f !== 'templates'
  )

  const results = []

  for (const category of categories) {
    const categoryPath = path.join(PLUGINS_DIR, category)
    const plugins = fs.readdirSync(categoryPath).filter(f =>
      fs.statSync(path.join(categoryPath, f)).isDirectory()
    )

    for (const plugin of plugins) {
      const pluginPath = path.join(categoryPath, plugin)
      const result = packPlugin(pluginPath)
      if (result) {
        results.push(result)
      }
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Total plugins packed: ${results.length}`)
  
  return results
}

function packSinglePlugin(pluginId) {
  console.log(`=== Packing plugin: ${pluginId} ===\n`)
  
  const categories = fs.readdirSync(PLUGINS_DIR).filter(f => 
    fs.statSync(path.join(PLUGINS_DIR, f)).isDirectory()
  )

  for (const category of categories) {
    const pluginPath = path.join(PLUGINS_DIR, category, pluginId)
    if (fs.existsSync(pluginPath)) {
      const result = packPlugin(pluginPath)
      if (result) {
        console.log(`\n✓ Plugin packed successfully: ${result.path}`)
        return result
      }
    }
  }

  console.error(`✗ Plugin not found: ${pluginId}`)
  return null
}

const args = process.argv.slice(2)

if (args.length === 0) {
  packAllPlugins()
} else if (args[0] === '--plugin' || args[0] === '-p') {
  if (args[1]) {
    packSinglePlugin(args[1])
  } else {
    console.error('Usage: node pack-plugins.js --plugin <plugin-id>')
    process.exit(1)
  }
} else {
  console.log(`
Usage:
  node pack-plugins.js           Pack all plugins
  node pack-plugins.js -p <id>   Pack a specific plugin
  `)
}
