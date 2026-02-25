import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { app } from 'electron'

export class ProjectManager {
  private taskDir: string = ''
  private taskId: string = ''
  private static projectCounter: number = 0
  private static counterFilePath: string = ''

  constructor() {
    if (app) {
      ProjectManager.counterFilePath = path.join(app.getPath('userData'), 'project_counter.json')
    }
  }

  getTaskDir(): string {
    return this.taskDir
  }

  getTaskId(): string {
    return this.taskId
  }

  generateTaskId(): string {
    try {
      if (ProjectManager.counterFilePath && fs.existsSync(ProjectManager.counterFilePath)) {
        const data = JSON.parse(fs.readFileSync(ProjectManager.counterFilePath, 'utf8'))
        ProjectManager.projectCounter = data.counter || 0
      }
    } catch (error) {
      console.log('[ProjectManager] 读取项目计数器失败，使用内存计数器')
    }

    ProjectManager.projectCounter = (ProjectManager.projectCounter + 1) % 10000
    
    try {
      if (ProjectManager.counterFilePath) {
        fs.writeFileSync(
          ProjectManager.counterFilePath,
          JSON.stringify({ counter: ProjectManager.projectCounter }),
          'utf8'
        )
      }
    } catch (error) {
      console.log('[ProjectManager] 保存项目计数器失败')
    }

    const taskId = String(ProjectManager.projectCounter).padStart(4, '0')
    console.log(`[ProjectManager] 生成项目ID: ${taskId}`)
    return taskId
  }

  async initializeProjectDirectory(
    taskName: string,
    userTaskDir?: string
  ): Promise<{ taskDir: string; taskId: string }> {
    let defaultProjectPath: string
    
    if (userTaskDir) {
      this.taskDir = userTaskDir
      this.taskId = this.generateTaskId()
      
      try {
        if (!fs.existsSync(this.taskDir)) {
          fs.mkdirSync(this.taskDir, { recursive: true, mode: 0o755 })
          console.log(`[ProjectManager] 用户指定的项目目录创建成功: ${this.taskDir}`)
        }
      } catch (error) {
        console.error(`[ProjectManager] 用户指定目录创建失败: ${error}`)
        defaultProjectPath = this.getDefaultProjectPath()
        this.taskDir = this.createSafeProjectDir(defaultProjectPath, taskName)
      }
      console.log(`[ProjectManager] 使用用户指定的项目目录: ${this.taskDir}`)
    } else {
      defaultProjectPath = this.getDefaultProjectPath()
      
      if (!fs.existsSync(defaultProjectPath)) {
        fs.mkdirSync(defaultProjectPath, { recursive: true, mode: 0o755 })
      }
      
      this.taskId = this.generateTaskId()
      this.taskDir = this.createSafeProjectDir(defaultProjectPath, taskName)
      
      console.log(`[ProjectManager] 项目将创建在: ${defaultProjectPath}`)
    }

    try {
      if (!fs.existsSync(this.taskDir)) {
        fs.mkdirSync(this.taskDir, { recursive: true, mode: 0o755 })
        console.log(`[ProjectManager] 项目目录创建成功: ${this.taskDir}`)
      }
    } catch (error) {
      console.error('[ProjectManager] 创建工作目录失败:', error)
      this.taskDir = this.createFallbackDir()
    }

    return {
      taskDir: this.taskDir,
      taskId: this.taskId
    }
  }

  private getDefaultProjectPath(): string {
    if (app) {
      return path.join(app.getPath('userData'), 'projects')
    }
    return path.join(os.homedir(), 'Documents', 'projects')
  }

  private createSafeProjectDir(basePath: string, taskName: string): string {
    let safeTaskName = taskName
      .replace(/[^\x00-\x7F]/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .trim()
      .slice(0, 50)
    
    if (!safeTaskName || /^_+$/.test(safeTaskName)) {
      safeTaskName = `project_${Date.now()}`
    }
    
    return path.join(basePath, `${this.taskId}_${safeTaskName}`)
  }

  private createFallbackDir(): string {
    const fallbackDir = path.join(
      os.tmpdir(), 
      `project_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    )
    
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true })
    }
    
    return fallbackDir
  }

  createSubdirectory(name: string): string {
    const subDir = path.join(this.taskDir, name)
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true })
    }
    return subDir
  }

  fileExists(filename: string): boolean {
    return fs.existsSync(path.join(this.taskDir, filename))
  }

  readFile(filename: string): string | null {
    const filePath = path.join(this.taskDir, filename)
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8')
      }
    } catch (error) {
      console.error(`[ProjectManager] 读取文件失败: ${filename}`, error)
    }
    return null
  }

  writeFile(filename: string, content: string): boolean {
    const filePath = path.join(this.taskDir, filename)
    try {
      fs.writeFileSync(filePath, content, 'utf8')
      return true
    } catch (error) {
      console.error(`[ProjectManager] 写入文件失败: ${filename}`, error)
      return false
    }
  }

  listFiles(): string[] {
    try {
      if (fs.existsSync(this.taskDir)) {
        return fs.readdirSync(this.taskDir)
      }
    } catch (error) {
      console.error('[ProjectManager] 列出文件失败:', error)
    }
    return []
  }

  cleanup(): void {
    this.taskDir = ''
    this.taskId = ''
  }
}

export const projectManager = new ProjectManager()
