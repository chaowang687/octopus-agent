import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { ToolDefinition, ToolContext } from './ToolRegistry'

interface OperationRecord {
  id: string
  type: 'file_write' | 'file_delete' | 'command_exec' | 'directory_create'
  timestamp: number
  details: any
  backupPath?: string
}

interface SafetyCheckResult {
  safe: boolean
  reason?: string
  severity?: 'low' | 'medium' | 'high'
  requiresApproval: boolean
}

export class ToolExecutionEngine {
  private operationRecords: Map<string, OperationRecord[]> = new Map()
  private backupDir: string
  private readonly maxRecordsPerTask = 200
  private dangerousCommands: Set<string> = new Set([
    'rm', 'rmdir', 'del', 'format', 'dd', 'shred', 'wipe',
    'sudo', 'su', 'chmod', 'chown', 'kill', 'reboot', 'shutdown'
  ])

  constructor() {
    this.backupDir = ''
  }

  /**
   * 初始化工具执行引擎
   */
  initialize(): void {
    if (!this.backupDir && app) {
      this.backupDir = path.join(app.getPath('userData'), 'backups')
      this.ensureBackupDirectory()
    }
  }

  private ensureBackupDirectory() {
    if (!this.backupDir && app) {
      this.backupDir = path.join(app.getPath('userData'), 'backups')
    }
    if (this.backupDir && !fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
    }
  }

  // 安全检查
  checkSafety(tool: ToolDefinition, params: any): SafetyCheckResult {
    const result: SafetyCheckResult = {
      safe: true,
      requiresApproval: false
    }

    switch (tool.name) {
      case 'execute_command':
        const command = params.command || ''
        const commandLower = command.toLowerCase()
        
        // 检查危险命令
        for (const dangerousCmd of this.dangerousCommands) {
          if (commandLower.includes(dangerousCmd)) {
            result.safe = false
            result.reason = `Potentially dangerous command detected: ${dangerousCmd}`
            result.severity = 'high'
            result.requiresApproval = true
            break
          }
        }
        
        // 检查路径遍历
        if (command.includes('..') && (command.includes('rm') || command.includes('del'))) {
          result.safe = false
          result.reason = 'Path traversal detected in potentially dangerous command'
          result.severity = 'high'
          result.requiresApproval = true
        }
        break

      case 'write_file':
        const filePath = params.path || ''
        
        // 检查敏感目录
        if (app) {
          const sensitiveDirs = [
            app.getPath('userData'),
            app.getPath('appData'),
            app.getPath('home')
          ]
          
          for (const dir of sensitiveDirs) {
            if (filePath.startsWith(dir)) {
              result.safe = false
              result.reason = 'Writing to sensitive directory'
              result.severity = 'medium'
              result.requiresApproval = true
              break
            }
          }
        }
        break

      case 'delete_file':
      case 'remove_directory':
        result.safe = false
        result.reason = 'File/directory deletion requires approval'
        result.severity = 'medium'
        result.requiresApproval = true
        break
    }

    return result
  }

  // 执行工具
  async executeTool(
    tool: ToolDefinition,
    params: any,
    ctx: ToolContext
  ): Promise<any> {
    // 1. 安全检查
    const safetyResult = this.checkSafety(tool, params)
    if (!safetyResult.safe && safetyResult.requiresApproval) {
      // 这里应该显示用户审批弹窗，现在简化处理
      console.warn(`Potentially dangerous operation detected: ${safetyResult.reason}`)
      // 暂时允许执行，实际应用中应该等待用户审批
    }

    // 2. 记录操作前状态（用于回滚）
    const operationId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const taskId = ctx.taskId || 'unknown'
    
    if (!this.operationRecords.has(taskId)) {
      this.operationRecords.set(taskId, [])
    }

    // 3. 执行操作
    let result: any
    try {
      // 备份文件（如果是写操作）
      if (tool.name === 'write_file' && params.path) {
        const backupPath = await this.backupFile(params.path, taskId)
        this.addOperationRecord(taskId, {
          id: operationId,
          type: 'file_write',
          timestamp: Date.now(),
          details: {
            path: params.path,
            contentLength: params.content?.length || 0
          },
          backupPath
        })
      }

      // 执行工具
      result = await tool.handler(params, ctx)

      // 记录成功的操作
      if (result.success !== false) {
        // write_file 已在执行前记录了可回滚信息，避免重复记录导致内存增长
        if (tool.name !== 'write_file') {
          this.addOperationRecord(taskId, {
            id: operationId,
            type: this.getOperationType(tool.name),
            timestamp: Date.now(),
            details: {
              tool: tool.name,
              params: this.sanitizeParams(params)
            }
          })
        }
      }

      return result
    } catch (error: any) {
      // 记录失败的操作
      this.addOperationRecord(taskId, {
        id: operationId,
        type: this.getOperationType(tool.name),
        timestamp: Date.now(),
        details: {
          tool: tool.name,
          params: this.sanitizeParams(params),
          error: error.message
        }
      })

      throw error
    }
  }

  private addOperationRecord(taskId: string, record: OperationRecord): void {
    const records = this.operationRecords.get(taskId)
    if (!records) return

    records.push(record)
    if (records.length > this.maxRecordsPerTask) {
      records.splice(0, records.length - this.maxRecordsPerTask)
    }
  }

  // 回滚操作
  async rollback(taskId: string): Promise<boolean> {
    const records = this.operationRecords.get(taskId)
    if (!records || records.length === 0) {
      return false
    }

    // 反向执行回滚
    for (const record of [...records].reverse()) {
      try {
        switch (record.type) {
          case 'file_write':
            if (record.backupPath && fs.existsSync(record.backupPath)) {
              const targetPath = record.details.path
              if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath)
              }
              fs.copyFileSync(record.backupPath, targetPath)
              console.log(`Rolled back file write: ${targetPath}`)
            }
            break

          case 'file_delete':
            // 无法直接回滚删除操作，需要从备份恢复
            break

          case 'directory_create':
            if (fs.existsSync(record.details.path)) {
              fs.rmSync(record.details.path, { recursive: true, force: true })
              console.log(`Rolled back directory creation: ${record.details.path}`)
            }
            break

          case 'command_exec':
            // 命令执行无法直接回滚，需要手动处理
            console.warn(`Cannot rollback command execution: ${record.details.params.command}`)
            break
        }
      } catch (error) {
        console.error(`Failed to rollback operation ${record.id}:`, error)
      }
    }

    // 清除操作记录
    this.operationRecords.delete(taskId)
    return true
  }

  // 备份文件
  private async backupFile(filePath: string, taskId: string): Promise<string | undefined> {
    if (!fs.existsSync(filePath)) {
      return undefined
    }

    const taskBackupDir = path.join(this.backupDir, taskId)
    if (!fs.existsSync(taskBackupDir)) {
      fs.mkdirSync(taskBackupDir, { recursive: true })
    }

    const backupPath = path.join(taskBackupDir, `${path.basename(filePath)}_${Date.now()}`)
    fs.copyFileSync(filePath, backupPath)
    return backupPath
  }

  // 获取操作类型
  private getOperationType(toolName: string): OperationRecord['type'] {
    switch (toolName) {
      case 'write_file':
        return 'file_write'
      case 'delete_file':
        return 'file_delete'
      case 'create_directory':
        return 'directory_create'
      case 'execute_command':
        return 'command_exec'
      default:
        return 'file_write'
    }
  }

  // 清理参数（移除敏感信息）
  private sanitizeParams(params: any): any {
    const sanitized: any = { ...params }
    
    // 移除可能的敏感信息
    if (sanitized.password) {
      sanitized.password = '***'
    }
    if (sanitized.token) {
      sanitized.token = '***'
    }
    if (sanitized.apiKey) {
      sanitized.apiKey = '***'
    }

    return sanitized
  }

  // 获取操作记录
  getOperationRecords(taskId: string): OperationRecord[] {
    return this.operationRecords.get(taskId) || []
  }

  // 清理备份
  cleanupBackups(days: number = 7) {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000)

    // 清理旧的备份目录
    if (fs.existsSync(this.backupDir)) {
      const backupDirs = fs.readdirSync(this.backupDir)
      
      for (const dir of backupDirs) {
        const dirPath = path.join(this.backupDir, dir)
        const stats = fs.statSync(dirPath)
        
        if (stats.isDirectory() && stats.mtime.getTime() < cutoffTime) {
          try {
            fs.rmSync(dirPath, { recursive: true, force: true })
            console.log(`Cleaned up old backup directory: ${dirPath}`)
          } catch (error) {
            console.error(`Failed to cleanup backup directory: ${dirPath}`, error)
          }
        }
      }
    }
  }
}

export const toolExecutionEngine = new ToolExecutionEngine()
