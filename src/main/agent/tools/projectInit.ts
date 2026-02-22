import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { toolRegistry } from '../ToolRegistry'

toolRegistry.register({
  name: 'create_react_app',
  description: 'Create a new React application using Create React App',
  parameters: [
    { name: 'projectName', type: 'string', description: 'Name of the React project', required: true },
    { name: 'projectPath', type: 'string', description: 'Parent directory to create project in', required: false },
    { name: 'typescript', type: 'boolean', description: 'Use TypeScript template', required: false },
    { name: 'useNpm', type: 'boolean', description: 'Use npm instead of yarn', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectName = params?.projectName
      if (!projectName) return { error: 'Missing parameter: projectName' }
      
      const projectPath = params?.projectPath || process.cwd()
      const useTypescript = params?.typescript || false
      const useNpm = params?.useNpm || false
      
      let command = `npx create-react-app ${projectName}`
      
      if (useTypescript) {
        command += ' --template typescript'
      }
      
      if (useNpm) {
        command += ' --use-npm'
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000
      })
      
      const fullPath = path.join(projectPath, projectName)
      
      return { 
        success: true, 
        message: `React project created at ${fullPath}`,
        projectPath: fullPath,
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'create_vue_app',
  description: 'Create a new Vue application using Vue CLI',
  parameters: [
    { name: 'projectName', type: 'string', description: 'Name of the Vue project', required: true },
    { name: 'projectPath', type: 'string', description: 'Parent directory to create project in', required: false },
    { name: 'typescript', type: 'boolean', description: 'Use TypeScript', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectName = params?.projectName
      if (!projectName) return { error: 'Missing parameter: projectName' }
      
      const projectPath = params?.projectPath || process.cwd()
      const useTypescript = params?.typescript || false
      
      let command = `npm create vue@latest ${projectName} -- --yes`
      
      if (useTypescript) {
        command += ' --typescript'
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000
      })
      
      const fullPath = path.join(projectPath, projectName)
      
      return { 
        success: true, 
        message: `Vue project created at ${fullPath}`,
        projectPath: fullPath,
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'create_next_app',
  description: 'Create a new Next.js application',
  parameters: [
    { name: 'projectName', type: 'string', description: 'Name of the Next.js project', required: true },
    { name: 'projectPath', type: 'string', description: 'Parent directory to create project in', required: false },
    { name: 'typescript', type: 'boolean', description: 'Use TypeScript', required: false },
    { name: 'tailwind', type: 'boolean', description: 'Use Tailwind CSS', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectName = params?.projectName
      if (!projectName) return { error: 'Missing parameter: projectName' }
      
      const projectPath = params?.projectPath || process.cwd()
      const useTypescript = params?.typescript || false
      const useTailwind = params?.tailwind || false
      
      let command = `npx create-next-app@latest ${projectName} --yes`
      
      if (useTypescript) {
        command += ' --typescript'
      }
      
      if (useTailwind) {
        command += ' --tailwind'
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000
      })
      
      const fullPath = path.join(projectPath, projectName)
      
      return { 
        success: true, 
        message: `Next.js project created at ${fullPath}`,
        projectPath: fullPath,
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'create_node_project',
  description: 'Create a new Node.js project',
  parameters: [
    { name: 'projectName', type: 'string', description: 'Name of the Node.js project', required: true },
    { name: 'projectPath', type: 'string', description: 'Parent directory to create project in', required: false },
    { name: 'type', type: 'string', description: 'Project type (commonjs, module)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectName = params?.projectName
      if (!projectName) return { error: 'Missing parameter: projectName' }
      
      const projectPath = params?.projectPath || process.cwd()
      const moduleType = params?.type || 'commonjs'
      
      const fullPath = path.join(projectPath, projectName)
      
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
      }
      
      execSync('npm init -y', { 
        cwd: fullPath, 
        encoding: 'utf8',
        stdio: 'pipe' 
      })
      
      const packageJsonPath = path.join(fullPath, 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      
      if (moduleType === 'module') {
        packageJson.type = 'module'
      }
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
      
      const indexPath = path.join(fullPath, 'index.js')
      fs.writeFileSync(indexPath, 'console.log("Hello, World!");\n')
      
      return { 
        success: true, 
        message: `Node.js project created at ${fullPath}`,
        projectPath: fullPath 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'create_express_app',
  description: 'Create a new Express application',
  parameters: [
    { name: 'projectName', type: 'string', description: 'Name of the Express project', required: true },
    { name: 'projectPath', type: 'string', description: 'Parent directory to create project in', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectName = params?.projectName
      if (!projectName) return { error: 'Missing parameter: projectName' }
      
      const projectPath = params?.projectPath || process.cwd()
      const fullPath = path.join(projectPath, projectName)
      
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
      }
      
      execSync('npm init -y', { 
        cwd: fullPath, 
        encoding: 'utf8',
        stdio: 'pipe' 
      })
      
      execSync('npm install express', { 
        cwd: fullPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 120000
      })
      
      const indexPath = path.join(fullPath, 'index.js')
      const indexContent = `const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});
`
      fs.writeFileSync(indexPath, indexContent)
      
      const packageJsonPath = path.join(fullPath, 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      packageJson.scripts = {
        start: 'node index.js',
        dev: 'nodemon index.js'
      }
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
      
      return { 
        success: true, 
        message: `Express project created at ${fullPath}`,
        projectPath: fullPath 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'create_electron_app',
  description: 'Create a new Electron application',
  parameters: [
    { name: 'projectName', type: 'string', description: 'Name of the Electron project', required: true },
    { name: 'projectPath', type: 'string', description: 'Parent directory to create project in', required: false },
    { name: 'typescript', type: 'boolean', description: 'Use TypeScript', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectName = params?.projectName
      if (!projectName) return { error: 'Missing parameter: projectName' }
      
      const projectPath = params?.projectPath || process.cwd()
      const useTypescript = params?.typescript || false
      
      let command = `npm create electron-app@latest ${projectName} -- --yes`
      
      if (useTypescript) {
        command += ' --template=webpack-typescript'
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000
      })
      
      const fullPath = path.join(projectPath, projectName)
      
      return { 
        success: true, 
        message: `Electron project created at ${fullPath}`,
        projectPath: fullPath,
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

console.log('[DevTools] Project initialization tools loaded')
