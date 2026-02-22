import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'
import { copyFileSync } from 'fs'

// 插件：在每次构建后复制 vm2 所需文件
function copyBridgePlugin() {
  return {
    name: 'copy-bridge',
    writeBundle() {
      const vm2Lib = resolve(__dirname, 'node_modules/vm2/lib')
      const distMain = resolve(__dirname, 'dist/main')
      
      try {
        // 复制 bridge.js
        const bridgeSource = resolve(vm2Lib, 'bridge.js')
        const bridgeDest = resolve(distMain, 'bridge.js')
        copyFileSync(bridgeSource, bridgeDest)
        console.log('Copied vm2 bridge.js to dist/main/')
        
        // 复制 setup-sandbox.js
        const sandboxSource = resolve(vm2Lib, 'setup-sandbox.js')
        const sandboxDest = resolve(distMain, 'setup-sandbox.js')
        copyFileSync(sandboxSource, sandboxDest)
        console.log('Copied vm2 setup-sandbox.js to dist/main/')
      } catch (error) {
        console.warn('Failed to copy vm2 files:', error)
      }
    }
  }
}

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        },
        external: ['electron-updater']
      }
    },
    plugins: [copyBridgePlugin()]
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    server: {
      port: 5173,
      strictPort: true,
      host: 'localhost'
    }
  }
})
