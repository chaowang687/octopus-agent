import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { llmService } from '../../services/LLMService'

// API 相关的 IPC 处理器
export function registerApiHandlers() {
  // 设置 API 密钥
  ipcMain.handle('api:setKey', (_, model: string, key: string, userId?: string) => {
    try {
      if (userId) {
        llmService.setUserId(userId)
      }
      const success = llmService.setApiKey(model, key)
      return { success }
    } catch (error: any) {
      console.error('设置 API 密钥失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取 API 密钥
  ipcMain.handle('api:getKey', (_, model: string, userId?: string) => {
    try {
      if (userId) {
        llmService.setUserId(userId)
      }
      const key = llmService.getApiKey(model)
      return { success: true, key }
    } catch (error: any) {
      console.error('获取 API 密钥失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 删除 API 密钥
  ipcMain.handle('api:deleteKey', (_, model: string, userId?: string) => {
    try {
      if (userId) {
        llmService.setUserId(userId)
      }
      const success = llmService.deleteApiKey(model)
      return { success }
    } catch (error: any) {
      console.error('删除 API 密钥失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 测试 API 密钥
  ipcMain.handle('api:testKey', () => {
    try {
      // 这里可以添加 API 密钥测试逻辑
      return { success: true, valid: true }
    } catch (error: any) {
      console.error('测试 API 密钥失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取 Token 使用量统计
  ipcMain.handle('api:getTokenUsage', () => {
    try {
      const summary = llmService.getTokenUsageSummary()
      return { success: true, data: summary }
    } catch (error: any) {
      console.error('获取 Token 使用量失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 读取文件
  ipcMain.handle('api:readFile', (_, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        return { success: true, content }
      }
      return { success: false, error: 'File not found' }
    } catch (error: any) {
      console.error('读取文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 写入文件
  ipcMain.handle('api:writeFile', (_, filePath: string, content: string) => {
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

  // 获取 Git 状态
  ipcMain.handle('api:getGitStatus', async (_, projectPath: string) => {
    try {
      const status = execSync('git status', { cwd: projectPath, encoding: 'utf8' })
      return { success: true, status }
    } catch (error: any) {
      console.error('获取 Git 状态失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取计划版本
  ipcMain.handle('api:getPlanVersions', async (_, projectPath: string) => {
    try {
      const log = execSync('git log --oneline', { cwd: projectPath, encoding: 'utf8' })
      const versions = log.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split(' ', 2)
          return { hash: parts[0], message: parts[1] || '' }
        })
      return { success: true, versions }
    } catch (error: any) {
      console.error('获取计划版本失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 提交计划
  ipcMain.handle('api:commitPlan', async (_, projectPath: string, message: string) => {
    try {
      execSync('git add .', { cwd: projectPath })
      execSync(`git commit -m "${message}"`, { cwd: projectPath })
      return { success: true }
    } catch (error: any) {
      console.error('提交计划失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 初始化 Git
  ipcMain.handle('api:initGit', async (_, projectPath: string) => {
    try {
      execSync('git init', { cwd: projectPath })
      return { success: true }
    } catch (error: any) {
      console.error('初始化 Git 失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 恢复计划版本
  ipcMain.handle('api:restorePlanVersion', async (_, projectPath: string, versionId: string) => {
    try {
      execSync(`git checkout ${versionId}`, { cwd: projectPath })
      return { success: true }
    } catch (error: any) {
      console.error('恢复计划版本失败:', error)
      return { success: false, error: error.message }
    }
  })
}