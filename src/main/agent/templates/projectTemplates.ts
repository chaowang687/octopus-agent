export interface ProjectTemplate {
  type: string
  name: string
  description: string
  files: Array<{
    path: string
    content: string
  }>
}

export const projectTemplates: Record<string, ProjectTemplate> = {
  'react': {
    type: 'react',
    name: 'React + TypeScript + Vite',
    description: 'React应用模板，使用TypeScript和Vite',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'my-react-app',
          version: '0.1.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview'
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0'
          },
          devDependencies: {
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            '@vitejs/plugin-react': '^4.2.1',
            typescript: '^5.0.2',
            vite: '^5.0.0'
          }
        }, null, 2)
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true
          },
          include: ['src'],
          references: [{ path: './tsconfig.node.json' }]
        }, null, 2)
      },
      {
        path: 'tsconfig.node.json',
        content: JSON.stringify({
          compilerOptions: {
            composite: true,
            skipLibCheck: true,
            module: 'ESNext',
            moduleResolution: 'bundler',
            allowSyntheticDefaultImports: true
          },
          include: ['vite.config.ts']
        }, null, 2)
      },
      {
        path: 'vite.config.ts',
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
})`
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`
      },
      {
        path: 'src/App.tsx',
        content: `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app">
      <h1>欢迎使用React应用</h1>
      <p>计数: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        增加
      </button>
    </div>
  )
}

export default App`
      },
      {
        path: 'src/index.css',
        content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

button {
  padding: 0.5rem 1rem;
  font-size: 1rem;
  cursor: pointer;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
}

button:hover {
  background-color: #0056b3;
}`
      }
    ]
  },
  'node': {
    type: 'node',
    name: 'Node.js 应用',
    description: 'Node.js应用模板',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'my-node-app',
          version: '1.0.0',
          description: 'A Node.js application',
          main: 'index.js',
          scripts: {
            start: 'node index.js',
            dev: 'nodemon index.js'
          },
          dependencies: {},
          devDependencies: {
            nodemon: '^3.0.1'
          }
        }, null, 2)
      },
      {
        path: 'index.js',
        content: `console.log('欢迎使用Node.js应用！')

module.exports = {
  start: () => {
    console.log('应用已启动')
  }
}`
      }
    ]
  },
  'html': {
    type: 'html',
    name: 'HTML + CSS 应用',
    description: 'HTML和CSS应用模板',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HTML应用</title>
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <div class="container">
      <h1>欢迎使用HTML应用</h1>
      <p>这是一个简单的HTML应用</p>
    </div>
  </body>
</html>`
      },
      {
        path: 'style.css',
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #333;
}

p {
  font-size: 1.2rem;
  color: #666;
}`
      }
    ]
  },
  'electron': {
    type: 'electron',
    name: 'Electron 应用',
    description: 'Electron应用模板',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'my-electron-app',
          version: '1.0.0',
          description: 'An Electron application',
          main: 'main.js',
          scripts: {
            start: 'electron .',
            build: 'electron-builder'
          },
          dependencies: {},
          devDependencies: {
            electron: '^27.0.0',
            'electron-builder': '^24.6.4'
          }
        }, null, 2)
      },
      {
        path: 'main.js',
        content: `const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})`
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Electron应用</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        margin: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      h1 {
        color: white;
        font-size: 3rem;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
      }
    </style>
  </head>
  <body>
    <h1>欢迎使用Electron应用</h1>
  </body>
</html>`
      }
    ]
  },
  'vue': {
    type: 'vue',
    name: 'Vue 3 + TypeScript + Vite',
    description: 'Vue 3应用模板，使用TypeScript和Vite',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'my-vue-app',
          version: '0.0.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview'
          },
          dependencies: {
            vue: '^3.3.4'
          },
          devDependencies: {
            '@vitejs/plugin-vue': '^4.2.3',
            typescript: '^5.0.2',
            vite: '^5.0.0',
            'vue-tsc': '^1.8.5'
          }
        }, null, 2)
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            module: 'ESNext',
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'preserve',
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true
          },
          include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.tsx', 'src/**/*.vue'],
          references: [{ path: './tsconfig.node.json' }]
        }, null, 2)
      },
      {
        path: 'tsconfig.node.json',
        content: JSON.stringify({
          compilerOptions: {
            composite: true,
            skipLibCheck: true,
            module: 'ESNext',
            moduleResolution: 'bundler',
            allowSyntheticDefaultImports: true
          },
          include: ['vite.config.ts']
        }, null, 2)
      },
      {
        path: 'vite.config.ts',
        content: `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000
  }
})`
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`
      },
      {
        path: 'src/main.ts',
        content: `import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')`
      },
      {
        path: 'src/App.vue',
        content: `<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div class="app">
    <h1>欢迎使用Vue应用</h1>
    <p>计数: {{ count }}</p>
    <button @click="count++">
      增加
    </button>
  </div>
</template>

<style scoped>
.app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

button {
  padding: 0.5rem 1rem;
  font-size: 1rem;
  cursor: pointer;
  background-color: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
}

button:hover {
  background-color: #35a372;
}
</style>`
      },
      {
        path: 'src/style.css',
        content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`
      }
    ]
  }
}

export function getProjectTemplate(type: string): ProjectTemplate | null {
  return projectTemplates[type] || null
}

export function getAllTemplates(): ProjectTemplate[] {
  return Object.values(projectTemplates)
}

export function getTemplateTypes(): string[] {
  return Object.keys(projectTemplates)
}
