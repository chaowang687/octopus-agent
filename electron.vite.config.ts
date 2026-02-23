import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: true,
          pure_funcs: ['console.debug']
        },
        format: {
          comments: false
        }
      },
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        },
        external: ['electron-updater'],
        output: {
          format: 'cjs',
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('bcryptjs')) {
                return 'crypto'
              }
            }
          }
        }
      }
    }
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      minify: 'terser',
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
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: true
        }
      },
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'react-vendor'
              }
              if (id.includes('react-markdown') || id.includes('remark') || id.includes('react-syntax-highlighter')) {
                return 'markdown'
              }
              if (id.includes('chart.js') || id.includes('react-chartjs')) {
                return 'chart'
              }
            }
          }
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
