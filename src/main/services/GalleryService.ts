import { app, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface GalleryItem {
  id: string
  filePath: string
  filename: string
  mime?: string
  size: number
  createdAt: number
  sourceUrl?: string
  tags?: string[]
}

export class GalleryService {
  private getRootDir() {
    return path.join(app.getPath('userData'), 'gallery')
  }

  private getImagesDir() {
    return path.join(this.getRootDir(), 'images')
  }

  private getIndexPath() {
    return path.join(this.getRootDir(), 'index.json')
  }

  private ensure() {
    const root = this.getRootDir()
    const images = this.getImagesDir()
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true })
    if (!fs.existsSync(images)) fs.mkdirSync(images, { recursive: true })
    const indexPath = this.getIndexPath()
    if (!fs.existsSync(indexPath)) fs.writeFileSync(indexPath, JSON.stringify({ items: [] }, null, 2))
  }

  private readIndex(): { items: GalleryItem[] } {
    this.ensure()
    try {
      const raw = fs.readFileSync(this.getIndexPath(), 'utf8')
      const parsed = JSON.parse(raw)
      const items = Array.isArray(parsed?.items) ? parsed.items : []
      return { items }
    } catch {
      return { items: [] }
    }
  }

  private writeIndex(items: GalleryItem[]) {
    this.ensure()
    fs.writeFileSync(this.getIndexPath(), JSON.stringify({ items }, null, 2))
  }

  list(): GalleryItem[] {
    const { items } = this.readIndex()
    return items.sort((a, b) => b.createdAt - a.createdAt)
  }

  importFile(sourcePath: string, sourceUrl?: string, mime?: string): GalleryItem {
    this.ensure()
    if (!fs.existsSync(sourcePath)) {
      throw new Error('File not found')
    }

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const ext = path.extname(sourcePath) || '.jpg'
    const filename = `${id}${ext}`
    const destPath = path.join(this.getImagesDir(), filename)

    fs.copyFileSync(sourcePath, destPath)
    const stat = fs.statSync(destPath)

    const item: GalleryItem = {
      id,
      filePath: destPath,
      filename,
      mime,
      size: stat.size,
      createdAt: Date.now(),
      sourceUrl
    }

    const { items } = this.readIndex()
    items.unshift(item)
    this.writeIndex(items)
    return item
  }

  importBuffer(buffer: Buffer, ext: string, sourceUrl?: string, mime?: string): GalleryItem {
    this.ensure()
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const safeExt = ext && ext.startsWith('.') ? ext : `.${ext || 'jpg'}`
    const filename = `${id}${safeExt}`
    const destPath = path.join(this.getImagesDir(), filename)
    fs.writeFileSync(destPath, buffer)
    const stat = fs.statSync(destPath)

    const item: GalleryItem = {
      id,
      filePath: destPath,
      filename,
      mime,
      size: stat.size,
      createdAt: Date.now(),
      sourceUrl
    }

    const { items } = this.readIndex()
    items.unshift(item)
    this.writeIndex(items)
    return item
  }

  delete(id: string) {
    const { items } = this.readIndex()
    const found = items.find(i => i.id === id)
    const next = items.filter(i => i.id !== id)
    if (found?.filePath && fs.existsSync(found.filePath)) {
      fs.unlinkSync(found.filePath)
    }
    this.writeIndex(next)
    return true
  }

  reveal(filePath: string) {
    if (!filePath) return false
    shell.showItemInFolder(filePath)
    return true
  }

  getDataUrlByPath(filePath: string) {
    if (!filePath || !fs.existsSync(filePath)) throw new Error('File not found')
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
      : ext === '.gif' ? 'image/gif'
      : 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  }

  addTag(id: string, tag: string) {
    const { items } = this.readIndex()
    const item = items.find(i => i.id === id)
    if (item) {
      const tags = new Set(item.tags || [])
      tags.add(tag)
      item.tags = Array.from(tags)
      this.writeIndex(items)
      return { success: true, tags: item.tags }
    }
    return { success: false, error: 'Item not found' }
  }

  removeTag(id: string, tag: string) {
    const { items } = this.readIndex()
    const item = items.find(i => i.id === id)
    if (item && item.tags) {
      item.tags = item.tags.filter(t => t !== tag)
      this.writeIndex(items)
      return { success: true, tags: item.tags }
    }
    return { success: false, error: 'Item not found' }
  }

  getTags(): string[] {
    const { items } = this.readIndex()
    const tags = new Set<string>()
    items.forEach(item => {
      if (item.tags) {
        item.tags.forEach(t => tags.add(t))
      }
    })
    return Array.from(tags).sort()
  }

  renameItem(id: string, newNameBase: string) {
    const { items } = this.readIndex()
    const item = items.find(i => i.id === id)
    if (!item) return { success: false, error: 'Item not found' }

    try {
      const oldPath = item.filePath
      const dir = path.dirname(oldPath)
      const ext = path.extname(oldPath)
      
      // Sanitize new name
      const safeName = newNameBase.replace(/[^\w\u4e00-\u9fa5\s-]/g, '').trim() || 'image'
      const newFilename = `${safeName}${ext}`
      const newPath = path.join(dir, newFilename)

      if (fs.existsSync(newPath) && newPath !== oldPath) {
        // Append timestamp if collision
        const uniqueName = `${safeName}-${Date.now()}${ext}`
        const uniquePath = path.join(dir, uniqueName)
        fs.renameSync(oldPath, uniquePath)
        item.filePath = uniquePath
        item.filename = uniqueName
      } else {
        fs.renameSync(oldPath, newPath)
        item.filePath = newPath
        item.filename = newFilename
      }

      this.writeIndex(items)
      return { success: true, item }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}

export const galleryService = new GalleryService()
