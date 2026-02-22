import * as fs from 'fs'
import * as path from 'path'
import { toolRegistry } from '../ToolRegistry'

toolRegistry.register({
  name: 'read_package_json',
  description: 'Read and parse package.json file',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const packageJsonPath = path.join(projectPath, 'package.json')
      
      if (!fs.existsSync(packageJsonPath)) {
        return { error: `package.json not found at ${packageJsonPath}` }
      }
      
      const content = fs.readFileSync(packageJsonPath, 'utf8')
      const packageJson = JSON.parse(content)
      
      return {
        success: true,
        packageJson,
        path: packageJsonPath
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'write_package_json',
  description: 'Write package.json file',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'data', type: 'object', description: 'Package.json data object', required: true },
    { name: 'format', type: 'boolean', description: 'Format with 2-space indentation', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const data = params?.data
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!data) return { error: 'Missing parameter: data' }
      
      const packageJsonPath = path.join(projectPath, 'package.json')
      const format = params?.format !== false
      
      const content = format ? JSON.stringify(data, null, 2) : JSON.stringify(data)
      
      fs.writeFileSync(packageJsonPath, content, 'utf8')
      
      return {
        success: true,
        message: 'package.json written successfully',
        path: packageJsonPath
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'update_package_json',
  description: 'Update specific fields in package.json',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'updates', type: 'object', description: 'Fields to update (e.g., {name: "new-name", version: "1.0.0"})', required: true }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const updates = params?.updates
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!updates) return { error: 'Missing parameter: updates' }
      
      const packageJsonPath = path.join(projectPath, 'package.json')
      
      if (!fs.existsSync(packageJsonPath)) {
        return { error: `package.json not found at ${packageJsonPath}` }
      }
      
      const content = fs.readFileSync(packageJsonPath, 'utf8')
      const packageJson = JSON.parse(content)
      
      Object.assign(packageJson, updates)
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
      
      return {
        success: true,
        message: 'package.json updated successfully',
        path: packageJsonPath,
        updatedFields: Object.keys(updates)
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'add_dependency',
  description: 'Add a dependency to package.json',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'package', type: 'string', description: 'Package name', required: true },
    { name: 'version', type: 'string', description: 'Package version (optional)', required: false },
    { name: 'dev', type: 'boolean', description: 'Add as dev dependency', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const packageName = params?.package
      const version = params?.version
      const isDev = params?.dev || false
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!packageName) return { error: 'Missing parameter: package' }
      
      const packageJsonPath = path.join(projectPath, 'package.json')
      
      if (!fs.existsSync(packageJsonPath)) {
        return { error: `package.json not found at ${packageJsonPath}` }
      }
      
      const content = fs.readFileSync(packageJsonPath, 'utf8')
      const packageJson = JSON.parse(content)
      
      const targetKey = isDev ? 'devDependencies' : 'dependencies'
      if (!packageJson[targetKey]) {
        packageJson[targetKey] = {}
      }
      
      packageJson[targetKey][packageName] = version || 'latest'
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
      
      return {
        success: true,
        message: `Added ${packageName} to ${targetKey}`,
        path: packageJsonPath
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'add_script',
  description: 'Add a script to package.json',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'name', type: 'string', description: 'Script name', required: true },
    { name: 'command', type: 'string', description: 'Script command', required: true }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const scriptName = params?.name
      const scriptCommand = params?.command
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!scriptName) return { error: 'Missing parameter: name' }
      if (!scriptCommand) return { error: 'Missing parameter: command' }
      
      const packageJsonPath = path.join(projectPath, 'package.json')
      
      if (!fs.existsSync(packageJsonPath)) {
        return { error: `package.json not found at ${packageJsonPath}` }
      }
      
      const content = fs.readFileSync(packageJsonPath, 'utf8')
      const packageJson = JSON.parse(content)
      
      if (!packageJson.scripts) {
        packageJson.scripts = {}
      }
      
      packageJson.scripts[scriptName] = scriptCommand
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
      
      return {
        success: true,
        message: `Added script "${scriptName}" to package.json`,
        path: packageJsonPath
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'read_env',
  description: 'Read and parse .env file',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'filename', type: 'string', description: 'Env filename (default: .env)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const filename = params?.filename || '.env'
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const envPath = path.join(projectPath, filename)
      
      if (!fs.existsSync(envPath)) {
        return { 
          success: true, 
          exists: false,
          message: `.env file not found at ${envPath}`,
          env: {}
        }
      }
      
      const content = fs.readFileSync(envPath, 'utf8')
      const env: Record<string, string> = {}
      
      content.split('\n').forEach(line => {
        const trimmedLine = line.trim()
        if (!trimmedLine || trimmedLine.startsWith('#')) return
        
        const [key, ...valueParts] = trimmedLine.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim()
          env[key.trim()] = value.replace(/^"|"$/g, '')
        }
      })
      
      return {
        success: true,
        exists: true,
        env,
        path: envPath
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'write_env',
  description: 'Write .env file',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'data', type: 'object', description: 'Environment variables object', required: true },
    { name: 'filename', type: 'string', description: 'Env filename (default: .env)', required: false },
    { name: 'append', type: 'boolean', description: 'Append to existing file instead of overwriting', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const data = params?.data
      const filename = params?.filename || '.env'
      const shouldAppend = params?.append || false
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!data) return { error: 'Missing parameter: data' }
      
      const envPath = path.join(projectPath, filename)
      
      const lines = Object.entries(data).map(([key, value]) => {
        const strValue = String(value)
        if (strValue.includes(' ') || strValue.includes('"') || strValue.includes("'")) {
          return `${key}="${strValue}"`
        }
        return `${key}=${strValue}`
      })
      
      const content = lines.join('\n') + '\n'
      
      if (shouldAppend && fs.existsSync(envPath)) {
        fs.appendFileSync(envPath, content, 'utf8')
      } else {
        fs.writeFileSync(envPath, content, 'utf8')
      }
      
      return {
        success: true,
        message: shouldAppend ? 'Appended to .env file' : 'Wrote .env file',
        path: envPath
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'update_env',
  description: 'Update specific environment variables in .env file',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'updates', type: 'object', description: 'Environment variables to update', required: true },
    { name: 'filename', type: 'string', description: 'Env filename (default: .env)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const updates = params?.updates
      const filename = params?.filename || '.env'
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!updates) return { error: 'Missing parameter: updates' }
      
      const envPath = path.join(projectPath, filename)
      const env: Record<string, string> = {}
      
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8')
        content.split('\n').forEach(line => {
          const trimmedLine = line.trim()
          if (!trimmedLine || trimmedLine.startsWith('#')) return
          
          const [key, ...valueParts] = trimmedLine.split('=')
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim()
            env[key.trim()] = value.replace(/^"|"$/g, '')
          }
        })
      }
      
      Object.assign(env, updates)
      
      const lines = Object.entries(env).map(([key, value]) => {
        const strValue = String(value)
        if (strValue.includes(' ') || strValue.includes('"') || strValue.includes("'")) {
          return `${key}="${strValue}"`
        }
        return `${key}=${strValue}`
      })
      
      const content = lines.join('\n') + '\n'
      fs.writeFileSync(envPath, content, 'utf8')
      
      return {
        success: true,
        message: 'Updated .env file',
        path: envPath,
        updatedKeys: Object.keys(updates)
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'read_tsconfig',
  description: 'Read and parse tsconfig.json file',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const tsconfigPath = path.join(projectPath, 'tsconfig.json')
      
      if (!fs.existsSync(tsconfigPath)) {
        return { error: `tsconfig.json not found at ${tsconfigPath}` }
      }
      
      const content = fs.readFileSync(tsconfigPath, 'utf8')
      const tsconfig = JSON.parse(content)
      
      return {
        success: true,
        tsconfig,
        path: tsconfigPath
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'write_tsconfig',
  description: 'Write tsconfig.json file',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'data', type: 'object', description: 'tsconfig.json data object', required: true }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const data = params?.data
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!data) return { error: 'Missing parameter: data' }
      
      const tsconfigPath = path.join(projectPath, 'tsconfig.json')
      
      const content = JSON.stringify(data, null, 2)
      fs.writeFileSync(tsconfigPath, content, 'utf8')
      
      return {
        success: true,
        message: 'tsconfig.json written successfully',
        path: tsconfigPath
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

console.log('[DevTools] Configuration file tools loaded')
