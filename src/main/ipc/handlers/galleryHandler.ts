import { ipcMain } from 'electron'
import { galleryService } from '../../services/GalleryService'

// 图库相关的 IPC 处理器
export function registerGalleryHandlers() {
  // 列出图库项目
  ipcMain.handle('gallery:list', async () => {
    try {
      const items = galleryService.list()
      return { success: true, items }
    } catch (error: any) {
      console.error('列出图库项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 导入图库项目
  ipcMain.handle('gallery:import', async (_evt, filePaths: string[]) => {
    try {
      const importedItems = filePaths.map(filePath => galleryService.importFile(filePath))
      return { success: true, items: importedItems }
    } catch (error: any) {
      console.error('导入图库项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 删除图库项目
  ipcMain.handle('gallery:delete', async (_evt, id: string) => {
    try {
      galleryService.delete(id)
      return { success: true }
    } catch (error: any) {
      console.error('删除图库项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取数据 URL
  ipcMain.handle('gallery:getDataUrl', async (_evt, filePath: string) => {
    try {
      const dataUrl = galleryService.getDataUrlByPath(filePath)
      return { success: true, dataUrl }
    } catch (error: any) {
      console.error('获取数据 URL 失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 显示项目
  ipcMain.handle('gallery:reveal', async (_evt, filePath: string) => {
    try {
      galleryService.reveal(filePath)
      return { success: true }
    } catch (error: any) {
      console.error('显示项目失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 添加标签
  ipcMain.handle('gallery:addTag', async (_evt, id: string, tag: string) => {
    try {
      await galleryService.addTag(id, tag)
      return { success: true }
    } catch (error: any) {
      console.error('添加标签失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 移除标签
  ipcMain.handle('gallery:removeTag', async (_evt, id: string, tag: string) => {
    try {
      await galleryService.removeTag(id, tag)
      return { success: true }
    } catch (error: any) {
      console.error('移除标签失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 重命名项目
  ipcMain.handle('gallery:renameItem', async (_evt, id: string, newName: string) => {
    try {
      await galleryService.renameItem(id, newName)
      return { success: true }
    } catch (error: any) {
      console.error('重命名项目失败:', error)
      return { success: false, error: error.message }
    }
  })
}