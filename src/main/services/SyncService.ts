import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import axios, { AxiosInstance } from 'axios'

export interface SyncConfig {
  enabled: boolean
  autoSync: boolean
  syncInterval: number // 毫秒
  syncServer: string
  apiKey: string
  conflictResolution: 'local' | 'remote' | 'manual'
  syncOnStartup: boolean
  syncOnShutdown: boolean
}

export interface SyncItem {
  id: string
  type: string
  path: string
  localHash: string
  remoteHash?: string
  lastSynced: number
  lastModified: number
  status: 'synced' | 'pending' | 'conflict' | 'error'
}

export interface SyncResult {
  success: boolean
  syncedItems: number
  conflicts: number
  errors: string[]
  timestamp: number
}

export interface SyncConflict {
  id: string
  type: string
  path: string
  localData: any
  remoteData: any
  localModified: number
  remoteModified: number
}

export class SyncService {
  private syncDir: string
  private config: SyncConfig
  private syncTimer?: NodeJS.Timeout
  private syncItems: Map<string, SyncItem> = new Map()
  private apiClient: AxiosInstance

  constructor(config?: Partial<SyncConfig>) {
    this.syncDir = ''
    this.config = {
      enabled: false,
      autoSync: false,
      syncInterval: 5 * 60 * 1000, // 5分钟
      syncServer: 'https://api.example.com/sync',
      apiKey: '',
      conflictResolution: 'local',
      syncOnStartup: false,
      syncOnShutdown: false,
      ...config
    }

    this.apiClient = axios.create({
      baseURL: this.config.syncServer,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })
  }

  /**
   * 初始化同步服务
   */
  initialize(): void {
    if (!this.syncDir && app) {
      this.syncDir = path.join(app.getPath('userData'), 'sync')
      this.initializeSyncDirectory()
      this.loadSyncItems()
      this.startAutoSync()
    }
  }

  private initializeSyncDirectory(): void {
    if (!fs.existsSync(this.syncDir)) {
      fs.mkdirSync(this.syncDir, { recursive: true })
      console.log('[SyncService] 创建同步目录:', this.syncDir)
    }
  }

  private loadSyncItems(): void {
    try {
      const syncItemsPath = path.join(this.syncDir, 'sync-items.json')
      if (fs.existsSync(syncItemsPath)) {
        const data = fs.readFileSync(syncItemsPath, 'utf-8')
        const itemsArray: SyncItem[] = JSON.parse(data)
        itemsArray.forEach(item => {
          this.syncItems.set(item.id, item)
        })
        console.log('[SyncService] 加载同步项:', this.syncItems.size, '个')
      }
    } catch (error) {
      console.error('[SyncService] 加载同步项失败:', error)
    }
  }

  private saveSyncItems(): void {
    try {
      const syncItemsPath = path.join(this.syncDir, 'sync-items.json')
      const itemsArray = Array.from(this.syncItems.values())
      fs.writeFileSync(syncItemsPath, JSON.stringify(itemsArray, null, 2))
    } catch (error) {
      console.error('[SyncService] 保存同步项失败:', error)
    }
  }

  private startAutoSync(): void {
    if (this.config.autoSync && this.config.enabled) {
      this.syncTimer = setInterval(() => {
        this.performSync()
      }, this.config.syncInterval)
      console.log('[SyncService] 自动同步已启动，间隔:', this.config.syncInterval / 1000, '秒')
    }
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = undefined
      console.log('[SyncService] 自动同步已停止')
    }
  }

  async performSync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedItems: 0,
      conflicts: 0,
      errors: [],
      timestamp: Date.now()
    }

    if (!this.config.enabled || !this.config.apiKey) {
      result.errors.push('同步未启用或未配置 API 密钥')
      return result
    }

    console.log('[SyncService] 开始同步...')

    try {
      await this.collectSyncItems()
      const conflicts = await this.resolveConflicts()
      
      for (const [id, item] of this.syncItems.entries()) {
        try {
          await this.syncItem(item)
          result.syncedItems++
        } catch (error: any) {
          result.errors.push(`同步 ${item.path} 失败: ${error.message}`)
        }
      }

      result.conflicts = conflicts.length
      result.success = result.errors.length === 0

      this.saveSyncItems()
      console.log('[SyncService] 同步完成:', result)
      return result

    } catch (error: any) {
      console.error('[SyncService] 同步失败:', error)
      result.errors.push(`同步失败: ${error.message}`)
      return result
    }
  }

  private async collectSyncItems(): Promise<void> {
    const userDataPath = app.getPath('userData')
    const itemsToSync = [
      'users',
      'tokens',
      'workspaces',
      'preferences',
      'projects',
      'library',
      'knowledge-base'
    ]

    for (const itemType of itemsToSync) {
      const itemPath = path.join(userDataPath, itemType)
      if (fs.existsSync(itemPath)) {
        await this.collectItemsFromDirectory(itemPath, itemType)
      }
    }
  }

  private async collectItemsFromDirectory(dirPath: string, type: string): Promise<void> {
    try {
      const items = fs.readdirSync(dirPath)
      for (const item of items) {
        const itemPath = path.join(dirPath, item)
        const stats = fs.statSync(itemPath)

        if (stats.isDirectory()) {
          await this.collectItemsFromDirectory(itemPath, type)
        } else if (stats.isFile() && item.endsWith('.json')) {
          const relativePath = path.relative(app.getPath('userData'), itemPath)
          const hash = this.calculateHash(itemPath)

          const syncItem: SyncItem = {
            id: this.generateItemId(relativePath),
            type,
            path: relativePath,
            localHash: hash,
            lastSynced: 0,
            lastModified: stats.mtimeMs,
            status: 'pending'
          }

          this.syncItems.set(syncItem.id, syncItem)
        }
      }
    } catch (error) {
      console.error('[SyncService] 收集同步项失败:', dirPath, error)
    }
  }

  private async syncItem(item: SyncItem): Promise<void> {
    const userDataPath = app.getPath('userData')
    const itemPath = path.join(userDataPath, item.path)

    try {
      const remoteData = await this.fetchRemoteData(item.id)
      
      if (!remoteData) {
        await this.uploadItem(item)
        item.status = 'synced'
        item.lastSynced = Date.now()
        return
      }

      const remoteHash = this.calculateHashFromData(remoteData)
      item.remoteHash = remoteHash

      if (item.localHash === remoteHash) {
        item.status = 'synced'
        item.lastSynced = Date.now()
        return
      }

      if (item.lastModified > item.lastSynced) {
        await this.uploadItem(item)
        item.status = 'synced'
        item.lastSynced = Date.now()
      } else {
        await this.downloadItem(item, remoteData)
        item.status = 'synced'
        item.lastSynced = Date.now()
      }

    } catch (error: any) {
      console.error('[SyncService] 同步项失败:', item.path, error)
      item.status = 'error'
      throw error
    }
  }

  private async fetchRemoteData(itemId: string): Promise<any> {
    try {
      const response = await this.apiClient.get(`/items/${itemId}`)
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  }

  private async uploadItem(item: SyncItem): Promise<void> {
    const userDataPath = app.getPath('userData')
    const itemPath = path.join(userDataPath, item.path)

    if (!fs.existsSync(itemPath)) {
      return
    }

    const content = fs.readFileSync(itemPath, 'utf-8')
    const data = JSON.parse(content)

    await this.apiClient.put(`/items/${item.id}`, {
      type: item.type,
      path: item.path,
      data,
      hash: item.localHash,
      timestamp: Date.now()
    })

    console.log('[SyncService] 上传项:', item.path)
  }

  private async downloadItem(item: SyncItem, remoteData: any): Promise<void> {
    const userDataPath = app.getPath('userData')
    const itemPath = path.join(userDataPath, item.path)

    const dirPath = path.dirname(itemPath)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    fs.writeFileSync(itemPath, JSON.stringify(remoteData.data, null, 2))
    console.log('[SyncService] 下载项:', item.path)
  }

  private async resolveConflicts(): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = []

    for (const [id, item] of this.syncItems.entries()) {
      if (item.status === 'conflict') {
        try {
          const conflict = await this.createConflict(item)
          conflicts.push(conflict)

          switch (this.config.conflictResolution) {
            case 'local':
              await this.uploadItem(item)
              item.status = 'synced'
              break
            case 'remote':
              const remoteData = await this.fetchRemoteData(id)
              if (remoteData) {
                await this.downloadItem(item, remoteData)
                item.status = 'synced'
              }
              break
            case 'manual':
              await this.saveConflict(conflict)
              break
          }
        } catch (error) {
          console.error('[SyncService] 解决冲突失败:', item.path, error)
        }
      }
    }

    return conflicts
  }

  private async createConflict(item: SyncItem): Promise<SyncConflict> {
    const userDataPath = app.getPath('userData')
    const itemPath = path.join(userDataPath, item.path)

    const localData = JSON.parse(fs.readFileSync(itemPath, 'utf-8'))
    const remoteData = await this.fetchRemoteData(item.id)

    return {
      id: item.id,
      type: item.type,
      path: item.path,
      localData,
      remoteData,
      localModified: item.lastModified,
      remoteModified: remoteData?.timestamp || 0
    }
  }

  private async saveConflict(conflict: SyncConflict): Promise<void> {
    const conflictPath = path.join(this.syncDir, 'conflicts', `${conflict.id}.json`)
    const conflictDir = path.dirname(conflictPath)

    if (!fs.existsSync(conflictDir)) {
      fs.mkdirSync(conflictDir, { recursive: true })
    }

    fs.writeFileSync(conflictPath, JSON.stringify(conflict, null, 2))
    console.log('[SyncService] 保存冲突:', conflict.path)
  }

  getConflicts(): SyncConflict[] {
    const conflictDir = path.join(this.syncDir, 'conflicts')
    const conflicts: SyncConflict[] = []

    if (!fs.existsSync(conflictDir)) {
      return conflicts
    }

    const files = fs.readdirSync(conflictDir)
    for (const file of files) {
      try {
        const conflictPath = path.join(conflictDir, file)
        const content = fs.readFileSync(conflictPath, 'utf-8')
        conflicts.push(JSON.parse(content))
      } catch (error) {
        console.error('[SyncService] 读取冲突失败:', file)
      }
    }

    return conflicts
  }

  async resolveConflict(conflictId: string, resolution: 'local' | 'remote'): Promise<boolean> {
    const conflictPath = path.join(this.syncDir, 'conflicts', `${conflictId}.json`)
    
    if (!fs.existsSync(conflictPath)) {
      return false
    }

    try {
      const conflict: SyncConflict = JSON.parse(fs.readFileSync(conflictPath, 'utf-8'))
      const syncItem = this.syncItems.get(conflictId)

      if (!syncItem) {
        return false
      }

      if (resolution === 'local') {
        await this.uploadItem(syncItem)
      } else {
        await this.downloadItem(syncItem, conflict.remoteData)
      }

      syncItem.status = 'synced'
      syncItem.lastSynced = Date.now()
      this.saveSyncItems()

      fs.unlinkSync(conflictPath)
      console.log('[SyncService] 解决冲突:', conflictId, resolution)
      return true

    } catch (error) {
      console.error('[SyncService] 解决冲突失败:', conflictId, error)
      return false
    }
  }

  getSyncStatus(): SyncItem[] {
    return Array.from(this.syncItems.values())
  }

  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig }

    if (newConfig.apiKey) {
      this.apiClient.defaults.headers['Authorization'] = `Bearer ${newConfig.apiKey}`
    }

    if (newConfig.autoSync !== undefined || newConfig.syncInterval !== undefined) {
      this.stopAutoSync()
      this.startAutoSync()
    }

    console.log('[SyncService] 配置已更新:', this.config)
  }

  getConfig(): SyncConfig {
    return { ...this.config }
  }

  private generateItemId(path: string): string {
    return Buffer.from(path).toString('base64').replace(/=/g, '')
  }

  private calculateHash(filePath: string): string {
    const content = fs.readFileSync(filePath)
    return this.calculateHashFromData(content)
  }

  private calculateHashFromData(data: any): string {
    const crypto = require('crypto')
    const content = typeof data === 'string' ? data : JSON.stringify(data)
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  async syncOnStartup(): Promise<void> {
    if (this.config.syncOnStartup && this.config.enabled) {
      console.log('[SyncService] 启动时同步...')
      await this.performSync()
    }
  }

  async syncOnShutdown(): Promise<void> {
    if (this.config.syncOnShutdown && this.config.enabled) {
      console.log('[SyncService] 关闭时同步...')
      await this.performSync()
    }
  }

  destroy(): void {
    this.stopAutoSync()
    console.log('[SyncService] 服务已销毁')
  }
}

export const syncService = new SyncService()
