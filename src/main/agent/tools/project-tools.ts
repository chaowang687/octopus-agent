/**
 * Project Tools
 * 项目操作工具集
 */

import * as fs from 'fs'
import * as path from 'path'
import { toolRegistry } from '../ToolRegistry'

export function registerProjectTools(): void {
  // 创建项目
  toolRegistry.register({
    name: 'create_project',
    description: 'Create a new project',
    parameters: [
      { name: 'path', type: 'string', description: 'Project path', required: true },
      { name: 'type', type: 'string', description: 'Project type (npm, etc.)', required: true }
    ],
    handler: async (params: any) => {
      try {
        const projectPath = params?.path
        const projectType = params?.type
        
        if (!projectPath) return { error: 'Missing parameter: path' }
        if (!projectType) return { error: 'Missing parameter: type' }

        // 创建项目目录
        if (!fs.existsSync(projectPath)) {
          fs.mkdirSync(projectPath, { recursive: true })
        }

        // 根据项目类型创建文件
        switch (projectType) {
          case 'npm':
            fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({
              name: path.basename(projectPath),
              version: '1.0.0',
              description: '',
              main: 'index.js',
              scripts: {
                start: 'node index.js',
                test: 'echo \"Error: no test specified\" && exit 1'
              },
              keywords: [],
              author: '',
              license: 'ISC'
            }, null, 2))
            break
        }

        return { success: true, path: projectPath, type: projectType }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 初始化 Git 仓库
  toolRegistry.register({
    name: 'init_git',
    description: 'Initialize a Git repository',
    parameters: [
      { name: 'path', type: 'string', description: 'Project path', required: true }
    ],
    handler: async (params: any) => {
      try {
        const projectPath = params?.path
        
        if (!projectPath) return { error: 'Missing parameter: path' }

        // 创建 .gitignore
        const gitignore = `node_modules/
dist/
.env
*.log
.DS_Store
`
        fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignore)

        return { success: true, path: projectPath }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 检查项目依赖
  toolRegistry.register({
    name: 'check_dependencies',
    description: 'Check project dependencies',
    parameters: [
      { name: 'path', type: 'string', description: 'Project path', required: true }
    ],
    handler: async (params: any) => {
      try {
        const projectPath = params?.path
        
        if (!projectPath) return { error: 'Missing parameter: path' }

        const packageJsonPath = path.join(projectPath, 'package.json')
        
        if (!fs.existsSync(packageJsonPath)) {
          return { error: 'package.json not found' }
        }

        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
        const packageJson = JSON.parse(packageJsonContent)
        
        return {
          name: packageJson.name,
          version: packageJson.version,
          dependencies: Object.keys(packageJson.dependencies || {}).length,
          devDependencies: Object.keys(packageJson.devDependencies || {}).length
        }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 获取项目信息
  toolRegistry.register({
    name: 'get_project_info',
    description: 'Get project information',
    parameters: [
      { name: 'path', type: 'string', description: 'Project path', required: true }
    ],
    handler: async (params: any) => {
      try {
        const projectPath = params?.path
        
        if (!projectPath) return { error: 'Missing parameter: path' }

        if (!fs.existsSync(projectPath)) {
          return { error: 'Project path not found' }
        }

        const files = fs.readdirSync(projectPath)
        
        return {
          path: projectPath,
          files: files.slice(0, 20),
          totalFiles: files.length
        }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })
}

registerProjectTools()