import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface BackupConfig {
  enabled: boolean
  autoBackup: boolean
  backupInterval: number // 毫秒
  maxBackups: number
  backupLocation: string
  compressionEnabled: boolean
  encryptionEnabled: boolean
  encryptionKey?: string
}

export interface BackupInfo {
  id: string
  timestamp: number
  size: number
  compressed: boolean
  encrypted: boolean
  checksum: string
  userId?: string
  description?: string
  filePath: string
}

export interface BackupRestoreResult {
  success: boolean
  restoredItems: number
  errors: string[]
  warnings: string[]
}

export class BackupService {
  private backupDir: string
  private config: BackupConfig
  private backupTimer?: NodeJS.Timeout
  private backupHistory: BackupInfo[] = []
  private initialized: boolean = false

  constructor(config?: Partial<BackupConfig>) {
    // 使用当前工作目录作为初始目录
    this.backupDir = path.join(process.cwd(), 'backups')
    this.config = {
      enabled: true,
      autoBackup: true,
      backupInterval: 24 * 60 * 60 * 1000, // 24小时
      maxBackups: 10,
      backupLocation: this.backupDir,
      compressionEnabled: true,
      encryptionEnabled: false,
      ...config
    }
  }

  initialize() {
    if (this.initialized) return
    
    try {
      this.initializeBackupDirectory()
      this.loadBackupHistory()
      this.startAutoBackup()
      this.initialized = true
      console.log('[BackupService] 服务初始化完成')
    } catch (error) {
      console.error('[BackupService] 初始化失败:', error)
    }
  }

  private initializeBackupDirectory(): void {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true, mode: 0o755 })
        console.log('[BackupService] 创建备份目录:', this.backupDir)
      } else {
        console.log('[BackupService] 备份目录已存在:', this.backupDir)
      }
    } catch (error: any) {
      console.error('[BackupService] 创建备份目录失败:', error)
      // 使用备用目录
      this.backupDir = path.join(process.cwd(), 'backups')
      try {
        if (!fs.existsSync(this.backupDir)) {
          fs.mkdirSync(this.backupDir, { recursive: true, mode: 0o755 })
          console.log('[BackupService] 使用备用备份目录:', this.backupDir)
        }
      } catch (backupError) {
        console.error('[BackupService] 备用目录也失败:', backupError)
      }
    }
  }

  private loadBackupHistory(): void {
    try {
      const historyPath = path.join(this.backupDir, 'backup-history.json')
      if (fs.existsSync(historyPath)) {
        const data = fs.readFileSync(historyPath, 'utf-8')
        this.backupHistory = JSON.parse(data)
        console.log('[BackupService] 加载备份历史:', this.backupHistory.length, '个备份')
      }
    } catch (error) {
      console.error('[BackupService] 加载备份历史失败:', error)
    }
  }

  private saveBackupHistory(): void {
    try {
      const historyPath = path.join(this.backupDir, 'backup-history.json')
      fs.writeFileSync(historyPath, JSON.stringify(this.backupHistory, null, 2))
    } catch (error) {
      console.error('[BackupService] 保存备份历史失败:', error)
    }
  }

  private startAutoBackup(): void {
    if (this.config.autoBackup && this.config.enabled) {
      this.backupTimer = setInterval(() => {
        this.createAutoBackup()
      }, this.config.backupInterval)
      console.log('[BackupService] 自动备份已启动，间隔:', this.config.backupInterval / 1000 / 60, '分钟')
    }
  }

  private stopAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer)
      this.backupTimer = undefined
      console.log('[BackupService] 自动备份已停止')
    }
  }

  async createBackup(description?: string, userId?: string): Promise<BackupInfo> {
    if (!this.initialized) {
      this.initialize()
    }

    const timestamp = Date.now()
    const backupId = `backup_${timestamp}_${crypto.randomBytes(8).toString('hex')}`
    const backupPath = path.join(this.backupDir, `${backupId}.json`)

    console.log('[BackupService] 开始创建备份:', backupId)

    try {
      const userDataPath = app.getPath('userData')
      const dataToBackup: any = {
        timestamp,
        backupId,
        version: app.getVersion(),
        data: {}
      }

      const itemsToBackup = [
        'users',
        'tokens',
        'workspaces',
        'preferences',
        'projects',
        'library',
        'knowledge-base'
      ]

      for (const item of itemsToBackup) {
        const itemPath = path.join(userDataPath, item)
        if (fs.existsSync(itemPath)) {
          dataToBackup.data[item] = this.readDirectory(itemPath)
        }
      }

      let backupContent = JSON.stringify(dataToBackup, null, 2)

      if (this.config.compressionEnabled) {
        backupContent = await this.compressData(backupContent)
      }

      if (this.config.encryptionEnabled && this.config.encryptionKey) {
        backupContent = this.encryptData(backupContent, this.config.encryptionKey)
      }

      fs.writeFileSync(backupPath, backupContent)

      const stats = fs.statSync(backupPath)
      const checksum = this.calculateChecksum(backupPath)

      const backupInfo: BackupInfo = {
        id: backupId,
        timestamp,
        size: stats.size,
        compressed: this.config.compressionEnabled,
        encrypted: this.config.encryptionEnabled,
        checksum,
        userId,
        description,
        filePath: backupPath
      }

      this.backupHistory.push(backupInfo)
      this.saveBackupHistory()
      this.cleanupOldBackups()

      console.log('[BackupService] 备份创建成功:', backupId, '大小:', stats.size, '字节')
      return backupInfo

    } catch (error: any) {
      console.error('[BackupService] 创建备份失败:', error)
      throw new Error(`创建备份失败: ${error.message}`)
    }
  }

  private async createAutoBackup(): Promise<void> {
    try {
      await this.createBackup('自动备份')
    } catch (error) {
      console.error('[BackupService] 自动备份失败:', error)
    }
  }

  async restoreBackup(backupId: string): Promise<BackupRestoreResult> {
    if (!this.initialized) {
      this.initialize()
    }

    const result: BackupRestoreResult = {
      success: false,
      restoredItems: 0,
      errors: [],
      warnings: []
    }

    console.log('[BackupService] 开始恢复备份:', backupId)

    try {
      const backupInfo = this.backupHistory.find(b => b.id === backupId)
      if (!backupInfo) {
        throw new Error('备份不存在')
      }

      const backupPath = backupInfo.filePath
      if (!fs.existsSync(backupPath)) {
        throw new Error('备份文件不存在')
      }

      let backupContent = fs.readFileSync(backupPath, 'utf-8')

      if (backupInfo.encrypted && this.config.encryptionKey) {
        backupContent = this.decryptData(backupContent, this.config.encryptionKey)
      }

      if (backupInfo.compressed) {
        backupContent = await this.decompressData(backupContent)
      }

      const backupData = JSON.parse(backupContent)
      const userDataPath = app.getPath('userData')

      for (const [key, value] of Object.entries(backupData.data)) {
        try {
          const itemPath = path.join(userDataPath, key)
          
          if (!fs.existsSync(itemPath)) {
            fs.mkdirSync(itemPath, { recursive: true })
          }

          if (typeof value === 'object' && value !== null) {
            for (const [fileName, fileContent] of Object.entries(value as any)) {
              const filePath = path.join(itemPath, fileName)
              fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2))
              result.restoredItems++
            }
          }
        } catch (error: any) {
          result.errors.push(`恢复 ${key} 失败: ${error.message}`)
        }
      }

      result.success = result.errors.length === 0
      console.log('[BackupService] 备份恢复完成:', result)
      return result

    } catch (error: any) {
      console.error('[BackupService] 恢复备份失败:', error)
      result.errors.push(`恢复失败: ${error.message}`)
      return result
    }
  }

  deleteBackup(backupId: string): boolean {
    if (!this.initialized) {
      this.initialize()
    }

    const backupInfo = this.backupHistory.find(b => b.id === backupId)
    if (!backupInfo) {
      return false
    }

    try {
      if (fs.existsSync(backupInfo.filePath)) {
        fs.unlinkSync(backupInfo.filePath)
      }

      this.backupHistory = this.backupHistory.filter(b => b.id !== backupId)
      this.saveBackupHistory()
      console.log('[BackupService] 删除备份:', backupId)
      return true
    } catch (error) {
      console.error('[BackupService] 删除备份失败:', error)
      return false
    }
  }

  getBackupList(): BackupInfo[] {
    if (!this.initialized) {
      this.initialize()
    }
    return this.backupHistory.sort((a, b) => b.timestamp - a.timestamp)
  }

  getBackupInfo(backupId: string): BackupInfo | null {
    if (!this.initialized) {
      this.initialize()
    }
    return this.backupHistory.find(b => b.id === backupId) || null
  }

  private cleanupOldBackups(): void {
    if (this.backupHistory.length <= this.config.maxBackups) {
      return
    }

    const backupsToDelete = this.backupHistory
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, this.backupHistory.length - this.config.maxBackups)

    for (const backup of backupsToDelete) {
      this.deleteBackup(backup.id)
    }

    console.log('[BackupService] 清理旧备份:', backupsToDelete.length, '个')
  }

  private readDirectory(dirPath: string): any {
    const result: any = {}

    try {
      const items = fs.readdirSync(dirPath)
      for (const item of items) {
        const itemPath = path.join(dirPath, item)
        const stats = fs.statSync(itemPath)

        if (stats.isDirectory()) {
          result[item] = this.readDirectory(itemPath)
        } else if (stats.isFile() && item.endsWith('.json')) {
          try {
            const content = fs.readFileSync(itemPath, 'utf-8')
            result[item] = JSON.parse(content)
          } catch (error) {
            console.warn('[BackupService] 读取文件失败:', itemPath)
          }
        }
      }
    } catch (error) {
      console.error('[BackupService] 读取目录失败:', dirPath, error)
    }

    return result
  }

  private async compressData(data: string): Promise<string> {
    return data
  }

  private async decompressData(data: string): Promise<string> {
    return data
  }

  private encryptData(data: string, key: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return iv.toString('hex') + ':' + encrypted
  }

  private decryptData(encryptedData: string, key: string): string {
    const parts = encryptedData.split(':')
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  private calculateChecksum(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath)
      return crypto.createHash('sha256').update(content).digest('hex')
    } catch (error) {
      console.error('[BackupService] 计算校验和失败:', error)
      return ''
    }
  }

  updateConfig(newConfig: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    if (newConfig.backupLocation) {
      this.backupDir = newConfig.backupLocation
    }

    if (newConfig.autoBackup !== undefined || newConfig.backupInterval !== undefined) {
      this.stopAutoBackup()
      if (this.initialized) {
        this.startAutoBackup()
      }
    }

    console.log('[BackupService] 配置已更新:', this.config)
  }

  getConfig(): BackupConfig {
    return { ...this.config }
  }

  async exportBackup(backupId: string, exportPath: string): Promise<boolean> {
    if (!this.initialized) {
      this.initialize()
    }

    try {
      const backupInfo = this.getBackupInfo(backupId)
      if (!backupInfo) {
        throw new Error('备份不存在')
      }

      const exportDir = path.dirname(exportPath)
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true })
      }

      fs.copyFileSync(backupInfo.filePath, exportPath)
      console.log('[BackupService] 导出备份:', backupId, '到:', exportPath)
      return true
    } catch (error) {
      console.error('[BackupService] 导出备份失败:', error)
      return false
    }
  }

  async importBackup(importPath: string): Promise<BackupInfo> {
    if (!this.initialized) {
      this.initialize()
    }

    try {
      if (!fs.existsSync(importPath)) {
        throw new Error('导入文件不存在')
      }

      const backupId = `imported_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
      const backupPath = path.join(this.backupDir, `${backupId}.json`)

      fs.copyFileSync(importPath, backupPath)

      const stats = fs.statSync(backupPath)
      const checksum = this.calculateChecksum(backupPath)

      const backupInfo: BackupInfo = {
        id: backupId,
        timestamp: Date.now(),
        size: stats.size,
        compressed: false,
        encrypted: false,
        checksum,
        description: '导入的备份',
        filePath: backupPath
      }

      this.backupHistory.push(backupInfo)
      this.saveBackupHistory()

      console.log('[BackupService] 导入备份成功:', backupId)
      return backupInfo
    } catch (error: any) {
      console.error('[BackupService] 导入备份失败:', error)
      throw new Error(`导入备份失败: ${error.message}`)
    }
  }

  destroy(): void {
    this.stopAutoBackup()
    console.log('[BackupService] 服务已销毁')
  }
}

export const backupService = new BackupService()
