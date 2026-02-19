import { ipcMain, dialog } from 'electron'
import { execSync } from 'child_process'
import * as si from 'systeminformation'

// 系统相关的 IPC 处理器
export function registerSystemHandlers() {
  // 打开外部链接
  ipcMain.handle('system:openExternal', (_, url: string) => {
    try {
      const { shell } = require('electron')
      shell.openExternal(url)
      return { success: true }
    } catch (error: any) {
      console.error('打开外部链接失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 截取屏幕
  ipcMain.handle('system:captureScreen', async () => {
    try {
      const { desktopCapturer } = require('electron')
      const sources = await desktopCapturer.getSources({ types: ['screen'] })
      
      if (sources.length > 0) {
        // 这里可以返回屏幕截图信息
        return { success: true, sources: sources.map((s: any) => ({ id: s.id, name: s.name })) }
      }
      return { success: false, error: 'No screen sources found' }
    } catch (error: any) {
      console.error('截取屏幕失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 执行命令
  ipcMain.handle('system:executeCommand', (_, command: string, args: string[]) => {
    try {
      const result = execSync(`${command} ${args.join(' ')}`, { encoding: 'utf8' })
      return { success: true, output: result }
    } catch (error: any) {
      console.error('执行命令失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 执行复杂命令
  ipcMain.handle('system:executeComplexCommand', (_, command: string, options?: any) => {
    try {
      const { cwd = process.cwd() } = options || {}
      const result = execSync(command, { encoding: 'utf8', cwd })
      return { success: true, output: result }
    } catch (error: any) {
      console.error('执行复杂命令失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 执行 Shell 脚本
  ipcMain.handle('system:executeShellScript', (_, script: string, cwd?: string) => {
    try {
      const result = execSync(script, { encoding: 'utf8', cwd: cwd || process.cwd() })
      return { success: true, output: result }
    } catch (error: any) {
      console.error('执行脚本失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取系统信息
  ipcMain.handle('system:getSystemInfo', async () => {
    try {
      const systemInfo = {
        os: await si.osInfo(),
        cpu: await si.cpu(),
        memory: await si.mem(),
        disk: await si.diskLayout(),
        network: await si.networkInterfaces(),
        battery: await si.battery(),
        graphics: await si.graphics()
      }
      return { success: true, data: systemInfo }
    } catch (error: any) {
      console.error('获取系统信息失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 对话框 - 打开文件
  ipcMain.handle('dialog:openFile', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile']
      })
      if (canceled) {
        return { success: false, canceled: true }
      }
      return { success: true, filePath: filePaths[0] }
    } catch (error: any) {
      console.error('打开文件对话框失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 对话框 - 显示打开对话框
  ipcMain.handle('dialog:showOpenDialog', async (_, options: any) => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(options)
      if (canceled) {
        return { success: false, canceled: true }
      }
      return { success: true, filePaths }
    } catch (error: any) {
      console.error('显示打开对话框失败:', error)
      return { success: false, error: error.message }
    }
  })

  // WebView 开发工具
  ipcMain.handle('webview:openDevTools', () => {
    try {
      // 这里可以添加打开 WebView 开发工具的逻辑
      return { success: true }
    } catch (error: any) {
      console.error('打开 WebView 开发工具失败:', error)
      return { success: false, error: error.message }
    }
  })
}