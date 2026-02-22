import { Tool } from '@langchain/core/tools'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 文件写入工具 - 用于智能体创建项目文件
 */
export class FileWriteTool extends Tool {
  name = 'file_write'
  description = '写入文件到指定路径。如果目录不存在，会自动创建。参数：filePath（文件路径）、content（文件内容）'

  schema = z.object({
    filePath: z.string().describe('文件路径，可以是绝对路径或相对路径'),
    content: z.string().describe('文件内容')
  })

  async _call(input: { filePath: string; content: string }): Promise<string> {
    const { filePath, content } = input

    try {
      // 获取绝对路径
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.resolve(process.cwd(), filePath)

      // 确保目录存在
      const dirPath = path.dirname(absolutePath)
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 })
      }

      // 写入文件
      fs.writeFileSync(absolutePath, content, 'utf-8')

      console.log(`[FileWriteTool] 文件写入成功: ${absolutePath}`)
      return `文件写入成功: ${absolutePath}`
    } catch (error: any) {
      console.error(`[FileWriteTool] 文件写入失败:`, error)
      throw new Error(`文件写入失败: ${error.message}`)
    }
  }
}

/**
 * 目录创建工具 - 用于智能体创建项目目录
 */
export class DirectoryCreateTool extends Tool {
  name = 'directory_create'
  description = '创建目录结构。参数：dirPath（目录路径）'

  schema = z.object({
    dirPath: z.string().describe('目录路径，可以是绝对路径或相对路径')
  })

  async _call(input: { dirPath: string }): Promise<string> {
    const { dirPath } = input

    try {
      // 获取绝对路径
      const absolutePath = path.isAbsolute(dirPath) 
        ? dirPath 
        : path.resolve(process.cwd(), dirPath)

      // 创建目录
      fs.mkdirSync(absolutePath, { recursive: true, mode: 0o755 })

      console.log(`[DirectoryCreateTool] 目录创建成功: ${absolutePath}`)
      return `目录创建成功: ${absolutePath}`
    } catch (error: any) {
      console.error(`[DirectoryCreateTool] 目录创建失败:`, error)
      throw new Error(`目录创建失败: ${error.message}`)
    }
  }
}

/**
 * 文件读取工具 - 用于智能体读取现有文件
 */
export class FileReadTool extends Tool {
  name = 'file_read'
  description = '读取文件内容。参数：filePath（文件路径）'

  schema = z.object({
    filePath: z.string().describe('文件路径，可以是绝对路径或相对路径')
  })

  async _call(input: { filePath: string }): Promise<string> {
    const { filePath } = input

    try {
      // 获取绝对路径
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.resolve(process.cwd(), filePath)

      // 读取文件
      const content = fs.readFileSync(absolutePath, 'utf-8')

      console.log(`[FileReadTool] 文件读取成功: ${absolutePath}`)
      return content
    } catch (error: any) {
      console.error(`[FileReadTool] 文件读取失败:`, error)
      throw new Error(`文件读取失败: ${error.message}`)
    }
  }
}

/**
 * 目录列表工具 - 用于智能体查看目录内容
 */
export class DirectoryListTool extends Tool {
  name = 'directory_list'
  description = '列出目录中的文件和子目录。参数：dirPath（目录路径，默认为当前目录）'

  schema = z.object({
    dirPath: z.string().optional().describe('目录路径，可以是绝对路径或相对路径，默认为当前目录')
  })

  async _call(input: { dirPath?: string }): Promise<string> {
    const { dirPath = '.' } = input

    try {
      // 获取绝对路径
      const absolutePath = path.isAbsolute(dirPath) 
        ? dirPath 
        : path.resolve(process.cwd(), dirPath)

      // 检查目录是否存在
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`目录不存在: ${absolutePath}`)
      }

      // 读取目录
      const items = fs.readdirSync(absolutePath, { withFileTypes: true })

      // 格式化输出
      const result = items.map(item => {
        const itemPath = path.join(absolutePath, item.name)
        const stats = fs.statSync(itemPath)
        return `${item.isDirectory() ? '[DIR]' : '[FILE]'} ${item.name} (${stats.size} bytes)`
      }).join('\n')

      console.log(`[DirectoryListTool] 目录列表: ${absolutePath}`)
      return result || '目录为空'
    } catch (error: any) {
      console.error(`[DirectoryListTool] 目录列表失败:`, error)
      throw new Error(`目录列表失败: ${error.message}`)
    }
  }
}

/**
 * 项目创建工具集 - 用于智能体创建完整项目
 */
export class ProjectCreationTool extends Tool {
  name = 'project_create'
  description = '创建一个完整的项目。参数：projectName（项目名称）、projectType（项目类型，如react、vue、node等）、files（文件列表，每个文件包含path和content）'

  schema = z.object({
    projectName: z.string().describe('项目名称'),
    projectType: z.string().describe('项目类型，如react、vue、node等'),
    files: z.array(z.object({
      path: z.string().describe('文件路径，相对于项目根目录'),
      content: z.string().describe('文件内容')
    })).describe('文件列表')
  })

  async _call(input: { projectName: string; projectType: string; files: Array<{ path: string; content: string }> }): Promise<string> {
    const { projectName, projectType, files } = input

    try {
      // 获取工作区路径
      const workspaceRoot = process.env.WORKSPACE_ROOT || process.cwd()
      const projectPath = path.join(workspaceRoot, projectName)

      console.log(`[ProjectCreationTool] 开始创建项目: ${projectPath}`)

      // 创建项目目录
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true, mode: 0o755 })
      }

      // 创建文件
      const createdFiles: string[] = []
      for (const file of files) {
        const filePath = path.join(projectPath, file.path)
        const dirPath = path.dirname(filePath)

        // 确保目录存在
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 })
        }

        // 写入文件
        fs.writeFileSync(filePath, file.content, 'utf-8')
        createdFiles.push(filePath)
      }

      console.log(`[ProjectCreationTool] 项目创建成功: ${projectPath}`)
      console.log(`[ProjectCreationTool] 创建文件数: ${createdFiles.length}`)

      return `项目创建成功: ${projectPath}\n创建文件数: ${createdFiles.length}\n文件列表:\n${createdFiles.map(f => `  - ${f}`).join('\n')}`
    } catch (error: any) {
      console.error(`[ProjectCreationTool] 项目创建失败:`, error)
      throw new Error(`项目创建失败: ${error.message}`)
    }
  }
}

/**
 * 获取所有文件操作工具
 */
export function getFileOperationTools(): Tool[] {
  return [
    new FileWriteTool(),
    new DirectoryCreateTool(),
    new FileReadTool(),
    new DirectoryListTool(),
    new ProjectCreationTool()
  ]
}
