import * as fs from 'fs'
import * as path from 'path'
import { dialog } from 'electron'
import { app } from 'electron'
import { userService } from './UserService'
import { projectService } from '../services/ProjectService'
import { llmService } from './LLMService'

export interface BackupData {
  version: string
  exportedAt: number
  users: any[]
  projects: any[]
  apiKeys: any[]
  settings: any
}

export class BackupService {
  private backupDir: string

  constructor() {
    this.backupDir = path.join(app.getPath('userData'), 'backups')
    this.initializeBackupDir()
  }

  private initializeBackupDir() {
    try {
      const userDataPath = app.getPath('userData')
      console.log(`[BackupService] 用户数据目录: ${userDataPath}`)
      
      if (!fs.existsSync(userDataPath)) {
        console.log(`[BackupService] 用户数据目录不存在，创建: ${userDataPath}`)
        try {
          fs.mkdirSync(userDataPath, { recursive: true, mode: 0o755 })
        } catch (error) {
          console.error('[BackupService] 无法创建用户数据目录，尝试使用临时目录')
          this.backupDir = path.join(app.getPath('temp'), 'octopus-agent-backups')
          return
        }
      }
      
      if (!fs.existsSync(this.backupDir)) {
        console.log(`[BackupService] 备份目录不存在，创建: ${this.backupDir}`)
        try {
          fs.mkdirSync(this.backupDir, { recursive: true, mode: 0o755 })
        } catch (error) {
          console.error('[BackupService] 无法创建备份目录，尝试使用临时目录')
          this.backupDir = path.join(app.getPath('temp'), 'octopus-agent-backups')
          if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true, mode: 0o755 })
          }
          return
        }
      }
      
      console.log(`[BackupService] 备份目录已准备: ${this.backupDir}`)
    } catch (error) {
      console.error('[BackupService] 初始化备份目录失败，使用临时目录:', error)
      this.backupDir = path.join(app.getPath('temp'), 'octopus-agent-backups')
      if (!fs.existsSync(this.backupDir)) {
        try {
          fs.mkdirSync(this.backupDir, { recursive: true, mode: 0o755 })
          console.log(`[BackupService] 临时备份目录已创建: ${this.backupDir}`)
        } catch (fallbackError) {
          console.error('[BackupService] 无法创建临时备份目录:', fallbackError)
        }
      }
    }
  }

  async exportData(): Promise<{ success: boolean; data?: BackupData; error?: string }> {
    try {
      console.log('[BackupService] 开始导出数据')

      const users = userService.getAllUsers()
      const projects = await this.getAllProjects()
      const apiKeys = await this.getAllApiKeys()
      const settings = await this.getSettings()

      const backupData: BackupData = {
        version: '1.0.0',
        exportedAt: Date.now(),
        users,
        projects,
        apiKeys,
        settings
      }

      console.log('[BackupService] 数据导出成功')
      return { success: true, data: backupData }
    } catch (error: any) {
      console.error('[BackupService] 导出数据失败:', error)
      return { success: false, error: error.message }
    }
  }

  async importData(backupData: BackupData): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      console.log('[BackupService] 开始导入数据')

      if (!backupData.version) {
        return { success: false, error: '无效的备份文件' }
      }

      let importedCount = 0

      if (backupData.users && backupData.users.length > 0) {
        console.log(`[BackupService] 导入 ${backupData.users.length} 个用户`)
        for (const user of backupData.users) {
          try {
            const existingUser = userService.getUserByUsername(user.username)
            if (!existingUser) {
              userService.restoreUser(user)
              importedCount++
            }
          } catch (error) {
            console.error('[BackupService] 导入用户失败:', error)
          }
        }
      }

      if (backupData.projects && backupData.projects.length > 0) {
        console.log(`[BackupService] 导入 ${backupData.projects.length} 个项目`)
        for (const project of backupData.projects) {
          try {
            await this.restoreProject(project)
          } catch (error) {
            console.error('[BackupService] 导入项目失败:', error)
          }
        }
      }

      if (backupData.apiKeys && backupData.apiKeys.length > 0) {
        console.log(`[BackupService] 导入 ${backupData.apiKeys.length} 个 API 密钥`)
        for (const apiKey of backupData.apiKeys) {
          try {
            await this.restoreApiKey(apiKey)
          } catch (error) {
            console.error('[BackupService] 导入 API 密钥失败:', error)
          }
        }
      }

      if (backupData.settings) {
        console.log('[BackupService] 导入设置')
        await this.restoreSettings(backupData.settings)
      }

      console.log(`[BackupService] 数据导入成功，共导入 ${importedCount} 个用户`)
      return { 
        success: true, 
        message: `成功导入 ${importedCount} 个用户、${backupData.projects?.length || 0} 个项目、${backupData.apiKeys?.length || 0} 个 API 密钥`
      }
    } catch (error: any) {
      console.error('[BackupService] 导入数据失败:', error)
      return { success: false, error: error.message }
    }
  }

  async exportToFile(): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const result = await this.exportData()
      if (!result.success || !result.data) {
        return { success: false, error: result.error || '导出数据失败' }
      }

      const { filePath } = await dialog.showSaveDialog({
        title: '导出数据',
        defaultPath: path.join(app.getPath('downloads'), `octopus-agent-backup-${Date.now()}.json`),
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      })

      if (!filePath) {
        return { success: false, error: '用户取消了导出' }
      }

      const jsonData = JSON.stringify(result.data, null, 2)
      fs.writeFileSync(filePath, jsonData, 'utf-8')

      console.log(`[BackupService] 数据已导出到: ${filePath}`)
      return { success: true, filePath }
    } catch (error: any) {
      console.error('[BackupService] 导出文件失败:', error)
      return { success: false, error: error.message }
    }
  }

  async importFromFile(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        title: '导入数据',
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (!filePaths || filePaths.length === 0) {
        return { success: false, error: '用户取消了导入' }
      }

      const filePath = filePaths[0]
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const backupData: BackupData = JSON.parse(fileContent)

      const result = await this.importData(backupData)
      return result
    } catch (error: any) {
      console.error('[BackupService] 导入文件失败:', error)
      return { success: false, error: error.message }
    }
  }

  async autoBackup(): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const result = await this.exportData()
      if (!result.success || !result.data) {
        return { success: false, error: result.error || '导出数据失败' }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `auto-backup-${timestamp}.json`
      const filePath = path.join(this.backupDir, fileName)

      const jsonData = JSON.stringify(result.data, null, 2)
      fs.writeFileSync(filePath, jsonData, 'utf-8', { mode: 0o600 })

      console.log(`[BackupService] 自动备份已保存到: ${filePath}`)
      return { success: true, filePath }
    } catch (error: any) {
      console.error('[BackupService] 自动备份失败:', error)
      return { success: false, error: error.message }
    }
  }

  async getBackupFiles(): Promise<{ success: boolean; files?: Array<{ name: string; path: string; size: number; date: number }>; error?: string }> {
    try {
      console.log('[BackupService] 获取备份文件列表')

      if (!fs.existsSync(this.backupDir)) {
        console.log('[BackupService] 备份目录不存在，返回空列表')
        return { success: true, files: [] }
      }

      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(this.backupDir, file)
          const stats = fs.statSync(filePath)
          return {
            name: file,
            path: filePath,
            size: stats.size,
            date: stats.mtimeMs
          }
        })
        .sort((a, b) => b.date - a.date)

      console.log(`[BackupService] 找到 ${files.length} 个备份文件`)
      return { success: true, files }
    } catch (error: any) {
      console.error('[BackupService] 获取备份文件失败:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteBackupFile(fileName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const filePath = path.join(this.backupDir, fileName)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`[BackupService] 已删除备份文件: ${fileName}`)
        return { success: true }
      }
      return { success: false, error: '备份文件不存在' }
    } catch (error: any) {
      console.error('[BackupService] 删除备份文件失败:', error)
      return { success: false, error: error.message }
    }
  }

  private async getAllProjects(): Promise<any[]> {
    try {
      const projectsPath = path.join(app.getPath('userData'), 'projects')
      if (!fs.existsSync(projectsPath)) {
        return []
      }

      const files = fs.readdirSync(projectsPath)
      const projects: any[] = []

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(projectsPath, file)
          const content = fs.readFileSync(filePath, 'utf-8')
          projects.push(JSON.parse(content))
        }
      }

      return projects
    } catch (error) {
      console.error('[BackupService] 获取项目失败:', error)
      return []
    }
  }

  private async getAllApiKeys(): Promise<any[]> {
    try {
      const apiKeysPath = path.join(app.getPath('userData'), 'api-keys.json')
      if (!fs.existsSync(apiKeysPath)) {
        return []
      }

      const content = fs.readFileSync(apiKeysPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      console.error('[BackupService] 获取 API 密钥失败:', error)
      return []
    }
  }

  private async getSettings(): Promise<any> {
    try {
      const settingsPath = path.join(app.getPath('userData'), 'settings.json')
      if (!fs.existsSync(settingsPath)) {
        return {}
      }

      const content = fs.readFileSync(settingsPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      console.error('[BackupService] 获取设置失败:', error)
      return {}
    }
  }

  private async restoreProject(project: any): Promise<void> {
    const projectsPath = path.join(app.getPath('userData'), 'projects')
    if (!fs.existsSync(projectsPath)) {
      fs.mkdirSync(projectsPath, { recursive: true, mode: 0o700 })
    }

    const filePath = path.join(projectsPath, `${project.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8', { mode: 0o600 })
  }

  private async restoreApiKey(apiKey: any): Promise<void> {
    const apiKeysPath = path.join(app.getPath('userData'), 'api-keys.json')
    let apiKeys: any[] = []

    if (fs.existsSync(apiKeysPath)) {
      const content = fs.readFileSync(apiKeysPath, 'utf-8')
      apiKeys = JSON.parse(content)
    }

    apiKeys.push(apiKey)
    fs.writeFileSync(apiKeysPath, JSON.stringify(apiKeys, null, 2), 'utf-8', { mode: 0o600 })
  }

  private async restoreSettings(settings: any): Promise<void> {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8', { mode: 0o600 })
  }
}

export const backupService = new BackupService()
