import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

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
}