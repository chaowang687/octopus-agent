import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// 偏好设置相关的 IPC 处理器
export function registerPreferencesHandlers() {
  const preferencesPath = path.join(process.cwd(), 'preferences.json')

  // 获取偏好设置
  ipcMain.handle('preferences:get', (_, section?: string) => {
    try {
      if (fs.existsSync(preferencesPath)) {
        const preferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'))
        if (section) {
          return { success: true, data: preferences[section] || {} }
        }
        return { success: true, data: preferences }
      }
      return { success: true, data: {} }
    } catch (error: any) {
      console.error('获取偏好设置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 设置偏好设置
  ipcMain.handle('preferences:set', (_, section: string, key: string, value: any) => {
    try {
      let preferences: any = {}
      if (fs.existsSync(preferencesPath)) {
        preferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'))
      }
      if (!preferences[section]) {
        preferences[section] = {}
      }
      preferences[section][key] = value
      fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2))
      return { success: true }
    } catch (error: any) {
      console.error('设置偏好设置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 设置多个偏好设置
  ipcMain.handle('preferences:setMultiple', (_, section: string, values: any) => {
    try {
      let preferences: any = {}
      if (fs.existsSync(preferencesPath)) {
        preferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'))
      }
      if (!preferences[section]) {
        preferences[section] = {}
      }
      Object.assign(preferences[section], values)
      fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2))
      return { success: true }
    } catch (error: any) {
      console.error('设置多个偏好设置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 重置偏好设置
  ipcMain.handle('preferences:reset', (_, section?: string) => {
    try {
      if (fs.existsSync(preferencesPath)) {
        let preferences: any = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'))
        if (section) {
          delete preferences[section]
        } else {
          preferences = {}
        }
        fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2))
      }
      return { success: true }
    } catch (error: any) {
      console.error('重置偏好设置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 导出偏好设置
  ipcMain.handle('preferences:export', () => {
    try {
      if (fs.existsSync(preferencesPath)) {
        const content = fs.readFileSync(preferencesPath, 'utf8')
        return { success: true, content }
      }
      return { success: false, error: 'Preferences file not found' }
    } catch (error: any) {
      console.error('导出偏好设置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 导入偏好设置
  ipcMain.handle('preferences:import', (_, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        fs.writeFileSync(preferencesPath, content)
        return { success: true }
      }
      return { success: false, error: 'Import file not found' }
    } catch (error: any) {
      console.error('导入偏好设置失败:', error)
      return { success: false, error: error.message }
    }
  })
}