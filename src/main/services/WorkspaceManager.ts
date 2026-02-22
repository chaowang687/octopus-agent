import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { PATHS } from '../config/paths'

export interface FileInfo {
  path: string
  name: string
  isDirectory: boolean
  size: number
  modifiedAt: number
}

export interface WorkspaceFile {
  path: string
  content: string
}

export interface WorkspaceStats {
  totalFiles: number
  totalDirectories: number
  totalSize: number
  lastModified: number
}

export class WorkspaceManager {
  private workspaceRoot: string
  private sessionId: string

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session_${Date.now()}`
    
    // 尝试使用项目目录下的workspaces，如果失败则使用临时目录
    try {
      this.workspaceRoot = path.join(PATHS.PROJECT_ROOT, 'workspaces', this.sessionId)
      this.ensureWorkspaceExists()
    } catch (error) {
      // 如果失败，使用系统临时目录
      console.warn(`[WorkspaceManager] 使用项目目录失败，回退到临时目录:`, error)
      this.workspaceRoot = path.join(os.tmpdir(), '本地化TRAE-workspaces', this.sessionId)
      this.ensureWorkspaceExists()
    }
  }

  /**
   * 确保工作区目录存在
   */
  private ensureWorkspaceExists(): void {
    try {
      if (!fs.existsSync(this.workspaceRoot)) {
        fs.mkdirSync(this.workspaceRoot, { recursive: true, mode: 0o755 })
        console.log(`[WorkspaceManager] 创建工作区: ${this.workspaceRoot}`)
      }
    } catch (error: any) {
      // 如果创建失败，尝试使用备用路径
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        console.warn(`[WorkspaceManager] 权限不足，尝试使用备用路径`)
        this.workspaceRoot = path.join(os.tmpdir(), '本地化TRAE-workspaces', this.sessionId)
        if (!fs.existsSync(this.workspaceRoot)) {
          fs.mkdirSync(this.workspaceRoot, { recursive: true, mode: 0o755 })
        }
        console.log(`[WorkspaceManager] 使用备用工作区: ${this.workspaceRoot}`)
      } else {
        throw error
      }
    }
  }

  /**
   * 获取工作区根目录
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot
  }

  /**
   * 获取会话ID
   */
  getSessionId(): string {
    return this.sessionId
  }

  /**
   * 写入文件
   * @param relativePath 相对路径
   * @param content 文件内容
   */
  async writeFile(relativePath: string, content: string): Promise<string> {
    const fullPath = path.join(this.workspaceRoot, relativePath)
    const dirPath = path.dirname(fullPath)

    // 确保目录存在
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    fs.writeFileSync(fullPath, content, 'utf-8')
    console.log(`[WorkspaceManager] 写入文件: ${fullPath}`)
    return fullPath
  }

  /**
   * 批量写入多个文件
   * @param files 文件数组，包含path和content
   */
  async writeFiles(files: WorkspaceFile[]): Promise<string[]> {
    const writtenPaths: string[] = []
    for (const file of files) {
      const fullPath = await this.writeFile(file.path, file.content)
      writtenPaths.push(fullPath)
    }
    return writtenPaths
  }

  /**
   * 读取文件
   * @param relativePath 相对路径
   */
  async readFile(relativePath: string): Promise<string> {
    // 安全检查：防止路径遍历攻击
    const fullPath = this.getSafePath(relativePath)
    if (!fs.existsSync(fullPath)) {
      throw new Error(`文件不存在: ${relativePath}`)
    }
    return fs.readFileSync(fullPath, 'utf-8')
  }

  /**
   * 读取多个文件
   * @param relativePaths 相对路径数组
   */
  async readFiles(relativePaths: string[]): Promise<WorkspaceFile[]> {
    const files: WorkspaceFile[] = []
    for (const relativePath of relativePaths) {
      try {
        const content = await this.readFile(relativePath)
        files.push({ path: relativePath, content })
      } catch (error) {
        console.warn(`[WorkspaceManager] 读取文件失败: ${relativePath}`, error)
      }
    }
    return files
  }

  /**
   * 检查文件是否存在
   * @param relativePath 相对路径
   */
  async exists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.workspaceRoot, relativePath)
    return fs.existsSync(fullPath)
  }

  /**
   * 列出目录中的所有文件
   * @param relativePath 相对路径，默认为根目录
   * @param recursive 是否递归
   */
  async listFiles(relativePath: string = '', recursive: boolean = true): Promise<FileInfo[]> {
    const fullPath = path.join(this.workspaceRoot, relativePath)
    const files: FileInfo[] = []

    if (!fs.existsSync(fullPath)) {
      return files
    }

    const items = fs.readdirSync(fullPath, { withFileTypes: true })
    
    for (const item of items) {
      const itemPath = path.join(relativePath, item.name)
      const itemFullPath = path.join(fullPath, item.name)
      const stats = fs.statSync(itemFullPath)

      files.push({
        path: itemPath,
        name: item.name,
        isDirectory: item.isDirectory(),
        size: stats.size,
        modifiedAt: stats.mtimeMs
      })

      // 递归处理子目录
      if (recursive && item.isDirectory()) {
        const subFiles = await this.listFiles(itemPath, true)
        files.push(...subFiles)
      }
    }

    return files
  }

  /**
   * 获取工作区统计信息
   */
  async getStats(): Promise<WorkspaceStats> {
    const files = await this.listFiles('', true)
    const directories = files.filter(f => f.isDirectory)
    const regularFiles = files.filter(f => !f.isDirectory)

    return {
      totalFiles: regularFiles.length,
      totalDirectories: directories.length,
      totalSize: regularFiles.reduce((sum, f) => sum + f.size, 0),
      lastModified: Math.max(...files.map(f => f.modifiedAt), 0)
    }
  }

  /**
   * 验证文件是否存在，返回存在和不存在的文件列表
   * @param expectedPaths 期望存在的文件路径数组
   */
  async verifyFiles(expectedPaths: string[]): Promise<{ exists: string[]; missing: string[] }> {
    const exists: string[] = []
    const missing: string[] = []

    for (const relativePath of expectedPaths) {
      const found = await this.exists(relativePath)
      if (found) {
        exists.push(relativePath)
      } else {
        missing.push(relativePath)
      }
    }

    return { exists, missing }
  }

  /**
   * 安全路径检查 - 防止路径遍历攻击
   * @param relativePath 相对路径
   */
  private getSafePath(relativePath: string): string {
    const fullPath = path.join(this.workspaceRoot, relativePath)
    const normalizedPath = path.normalize(fullPath)
    
    // 确保路径在工作区目录内
    if (!normalizedPath.startsWith(this.workspaceRoot)) {
      throw new Error('路径遍历攻击检测：禁止访问工作区外部的文件')
    }
    
    return normalizedPath
  }

  /**
   * 删除工作区（清理）
   */
  async cleanup(): Promise<void> {
    if (fs.existsSync(this.workspaceRoot)) {
      fs.rmSync(this.workspaceRoot, { recursive: true, force: true })
      console.log(`[WorkspaceManager] 清理工作区: ${this.workspaceRoot}`)
    }
  }

  /**
   * 获取项目结构（树形）
   */
  async getProjectStructure(relativePath: string = ''): Promise<any> {
    const fullPath = path.join(this.workspaceRoot, relativePath)
    
    if (!fs.existsSync(fullPath)) {
      return null
    }

    const stats = fs.statSync(fullPath)
    
    if (!stats.isDirectory()) {
      return {
        name: path.basename(fullPath),
        type: 'file',
        path: relativePath,
        size: stats.size
      }
    }

    const children = fs.readdirSync(fullPath, { withFileTypes: true })
    const structure: any = {
      name: path.basename(fullPath) || this.sessionId,
      type: 'directory',
      path: relativePath,
      children: []
    }

    for (const child of children) {
      // 跳过隐藏文件和node_modules
      if (child.name.startsWith('.') || child.name === 'node_modules') {
        continue
      }
      const childPath = path.join(relativePath, child.name)
      const childStructure = await this.getProjectStructure(childPath)
      if (childStructure) {
        structure.children.push(childStructure)
      }
    }

    return structure
  }
}

// 导出单例
export const workspaceManager = new WorkspaceManager()
