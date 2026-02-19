import { ipcMain } from 'electron'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'

// 网络相关的 IPC 处理器
export function registerWebHandlers() {
  // 抓取网页
  ipcMain.handle('web:crawlPage', async (_, url: string, options?: any) => {
    try {
      const response = await axios.get(url, {
        timeout: options?.timeout || 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
        }
      })
      return { success: true, content: response.data, status: response.status }
    } catch (error: any) {
      console.error('抓取网页失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 提交表单
  ipcMain.handle('web:submitForm', async (_, url: string, formData: any, options?: any) => {
    try {
      const response = await axios.post(url, formData, {
        timeout: options?.timeout || 30000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      return { success: true, content: response.data, status: response.status }
    } catch (error: any) {
      console.error('提交表单失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 下载文件
  ipcMain.handle('web:downloadFile', async (_, url: string, savePath: string, options?: any) => {
    try {
      const response = await axios.get(url, {
        timeout: options?.timeout || 60000,
        responseType: 'stream'
      })

      const dir = path.dirname(savePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      const writer = fs.createWriteStream(savePath)
      response.data.pipe(writer)

      return new Promise((resolve) => {
        writer.on('finish', () => {
          resolve({ success: true, path: savePath })
        })
        writer.on('error', (error) => {
          resolve({ success: false, error: error.message })
        })
      })
    } catch (error: any) {
      console.error('下载文件失败:', error)
      return { success: false, error: error.message }
    }
  })
}