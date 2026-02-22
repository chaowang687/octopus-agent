import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'

// 文件系统相关的 IPC 处理器
export function registerFileSystemHandlers() {
  // 读取文件
  ipcMain.handle('fs:readFile', (_, path: string) => {
    try {
      if (fs.existsSync(path)) {
        const content = fs.readFileSync(path, 'utf8')
        return { success: true, content }
      }
      return { success: false, error: 'File not found' }
    } catch (error: any) {
      console.error('读取文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 写入文件
  ipcMain.handle('fs:writeFile', (_, filePath: string, content: string) => {
    try {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, content)
      return { success: true }
    } catch (error: any) {
      console.error('写入文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 编辑文件
  ipcMain.handle('fs:editFile', (_, path: string, oldContent: string, newContent: string) => {
    try {
      if (fs.existsSync(path)) {
        const currentContent = fs.readFileSync(path, 'utf8')
        if (currentContent.includes(oldContent)) {
          const updatedContent = currentContent.replace(oldContent, newContent)
          fs.writeFileSync(path, updatedContent)
          return { success: true }
        }
        return { success: false, error: 'Old content not found' }
      }
      return { success: false, error: 'File not found' }
    } catch (error: any) {
      console.error('编辑文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 比较文件
  ipcMain.handle('fs:compareFiles', (_, path1: string, path2: string) => {
    try {
      if (fs.existsSync(path1) && fs.existsSync(path2)) {
        const content1 = fs.readFileSync(path1, 'utf8')
        const content2 = fs.readFileSync(path2, 'utf8')
        const isEqual = content1 === content2
        return { success: true, isEqual }
      }
      return { success: false, error: 'One or both files not found' }
    } catch (error: any) {
      console.error('比较文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 检查文件是否存在
  ipcMain.handle('fs:exists', (_, path: string) => {
    try {
      const exists = fs.existsSync(path)
      return { success: true, exists }
    } catch (error: any) {
      console.error('检查文件存在失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 列出文件
  ipcMain.handle('fs:listFiles', (_, path: string) => {
    try {
      if (fs.existsSync(path)) {
        const files = fs.readdirSync(path)
        return { success: true, files }
      }
      return { success: false, error: 'Path not found' }
    } catch (error: any) {
      console.error('列出文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 列出目录
  ipcMain.handle('fs:listDirectories', (_, dirPath: string) => {
    try {
      if (fs.existsSync(dirPath)) {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        const directories = entries
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)
          .filter(name => !name.startsWith('.'))
        return { success: true, directories }
      }
      return { success: false, error: 'Path not found' }
    } catch (error: any) {
      console.error('列出目录失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取项目信息
  ipcMain.handle('fs:getProjectInfo', (_, projectPath: string) => {
    try {
      if (!fs.existsSync(projectPath)) {
        return { success: false, error: 'Project path not found' }
      }

      const packageJsonPath = path.join(projectPath, 'package.json')
      let projectInfo: any = {
        name: path.basename(projectPath),
        description: '',
        version: '1.0.0',
        scripts: {},
        dependencies: {},
        devDependencies: {}
      }

      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
          projectInfo = {
            name: packageJson.name || path.basename(projectPath),
            description: packageJson.description || '',
            version: packageJson.version || '1.0.0',
            scripts: packageJson.scripts || {},
            dependencies: packageJson.dependencies || {},
            devDependencies: packageJson.devDependencies || {}
          }
        } catch (error) {
          console.error('解析package.json失败:', error)
        }
      }

      // 获取项目文件统计
      const getFilesRecursively = (dir: string, baseDir: string = dir): string[] => {
        let files: string[] = []
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            files = files.concat(getFilesRecursively(fullPath, baseDir))
          } else if (entry.isFile() && !entry.name.startsWith('.')) {
            files.push(fullPath)
          }
        }
        
        return files
      }

      const files = getFilesRecursively(projectPath)
      const stats = fs.statSync(projectPath)

      return {
        success: true,
        project: {
          ...projectInfo,
          path: projectPath,
          fileCount: files.length,
          createdAt: stats.birthtimeMs,
          modifiedAt: stats.mtimeMs
        }
      }
    } catch (error: any) {
      console.error('获取项目信息失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 扫描projects目录
  ipcMain.handle('fs:scanProjectsDirectory', async (_, projectsDir: string) => {
    try {
      if (!fs.existsSync(projectsDir)) {
        return { success: false, error: 'Projects directory not found', projects: [] }
      }

      const entries = fs.readdirSync(projectsDir, { withFileTypes: true })
      const directories = entries
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
        .map(entry => entry.name)

      const projects = []
      for (const dirName of directories) {
        const projectPath = path.join(projectsDir, dirName)
        
        if (!fs.existsSync(projectPath)) {
          continue
        }

        const packageJsonPath = path.join(projectPath, 'package.json')
        let projectInfo: any = {
          name: dirName,
          description: '',
          version: '1.0.0',
          scripts: {},
          dependencies: {},
          devDependencies: {}
        }

        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
            projectInfo = {
              name: packageJson.name || dirName,
              description: packageJson.description || '',
              version: packageJson.version || '1.0.0',
              scripts: packageJson.scripts || {},
              dependencies: packageJson.dependencies || {},
              devDependencies: packageJson.devDependencies || {}
            }
          } catch (error) {
            console.error('解析package.json失败:', error)
          }
        }

        const getFilesRecursively = (dir: string): string[] => {
          let files: string[] = []
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true })
            
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name)
              if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                files = files.concat(getFilesRecursively(fullPath))
              } else if (entry.isFile() && !entry.name.startsWith('.')) {
                files.push(fullPath)
              }
            }
          } catch (error) {
            console.error('读取目录失败:', dir, error)
          }
          
          return files
        }

        const files = getFilesRecursively(projectPath)
        const stats = fs.statSync(projectPath)

        projects.push({
          ...projectInfo,
          path: projectPath,
          fileCount: files.length,
          createdAt: stats.birthtimeMs,
          modifiedAt: stats.mtimeMs
        })
      }

      return { success: true, projects }
    } catch (error: any) {
      console.error('扫描项目目录失败:', error)
      return { success: false, error: error.message, projects: [] }
    }
  })

  // 执行npm脚本
  ipcMain.handle('fs:runNpmScript', async (_, projectPath: string, scriptName: string) => {
    try {
      if (!fs.existsSync(projectPath)) {
        return { success: false, error: 'Project directory not found' }
      }

      const packageJsonPath = path.join(projectPath, 'package.json')
      if (!fs.existsSync(packageJsonPath)) {
        return { success: false, error: 'package.json not found' }
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      const scripts = packageJson.scripts || {}

      if (!scripts[scriptName]) {
        return { success: false, error: `Script "${scriptName}" not found in package.json` }
      }

      return new Promise((resolve) => {
        const npmProcess = spawn('npm', ['run', scriptName], {
          cwd: projectPath,
          shell: true,
          detached: true,
          stdio: 'ignore'
        })

        npmProcess.unref()

        console.log(`正在执行npm脚本: ${scriptName} 在目录: ${projectPath}`)

        resolve({ 
          success: true, 
          message: `脚本 "${scriptName}" 已在后台启动`,
          scriptName,
          projectPath
        })
      })
    } catch (error: any) {
      console.error('执行npm脚本失败:', error)
      return { success: false, error: error.message }
    }
  })
}