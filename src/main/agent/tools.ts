import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { app, BrowserWindow } from 'electron'
import { execSync } from 'child_process'
import axios from 'axios'
import * as si from 'systeminformation'
import { toolRegistry } from './ToolRegistry'
import { browserService } from '../services/BrowserService'
import { galleryService } from '../services/GalleryService'

import { getMainWindow } from '../index'
import { registerOpenTool } from '../integration/OpenTool'
import { safeCodeExecutionService } from '../services/SafeCodeExecutionService'
import * as commandUtils from '../utils/commandUtils'

import './tools/packageManager'
import './tools/projectInit'
import './tools/buildTools'
import './tools/codeQuality'
import './tools/environmentTools'
import './tools/configTools'
import './tools/DocumentTools'

/**
 * 清理路径中的不安全字符
 * @param input 输入字符串
 * @returns 清理后的安全字符串
 */
function sanitizePath(input: string): string {
  // 移除所有控制字符和不安全字符
  return input.replace(/[\x00-\x1F\x7F\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim()
}

/**
 * 安全创建目录
 * @param dirPath 目录路径
 * @returns 成功创建的目录路径
 */
function safeMkdir(dirPath: string): string {
  try {
    // 尝试创建目录
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 })
    return dirPath
  } catch (error: any) {
    console.error(`[Tools] 创建目录失败: ${error.message}`)
    // 如果创建失败，使用临时目录
    try {
      const tempDir = path.join(os.tmpdir(), `temp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`)
      fs.mkdirSync(tempDir, { recursive: true, mode: 0o755 })
      console.log(`[Tools] 使用临时目录: ${tempDir}`)
      return tempDir
    } catch (tempError) {
      console.error(`[Tools] 创建临时目录也失败: ${tempError}`)
      // 如果临时目录也失败，使用应用程序数据目录
      try {
        const appDataPath = app.getPath('userData')
        const fallbackDir = path.join(appDataPath, 'temp_dirs', `dir_${Date.now()}`)
        fs.mkdirSync(fallbackDir, { recursive: true, mode: 0o755 })
        console.log(`[Tools] 使用应用程序数据目录: ${fallbackDir}`)
        return fallbackDir
      } catch (appDataError) {
        console.error(`[Tools] 创建应用程序数据目录也失败: ${appDataError}`)
        throw new Error('无法创建任何目录，请检查文件系统权限')
      }
    }
  }
}

registerOpenTool()

// 导入环境检查工具
import './tools/environment'

// 导入权限修复工具
import './tools/permission-fixer'

// 辅助函数：获取主窗口
function getMainWin(): BrowserWindow | null {
  return getMainWindow()
}

// File System Tools
toolRegistry.register({
  name: 'read_file',
  description: 'Read the content of a file',
  parameters: [
    { name: 'path', type: 'string', description: 'Absolute path to the file', required: true }
  ],
  handler: async (params: any) => {
    try {
      const path = params?.path
      if (!path) return { error: 'Missing parameter: path' }
      if (!fs.existsSync(path)) return { error: `File not found: ${path}` }
      const content = fs.readFileSync(path, 'utf8')
      return { content }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'write_file',
  description: 'Write content to a file',
  parameters: [
    { name: 'path', type: 'string', description: 'Absolute path to the file', required: true },
    { name: 'content', type: 'string', description: 'Content to write', required: true }
  ],
  handler: async (params: any) => {
    try {
      const filePath = params?.path
      const content = params?.content
      if (!filePath) return { error: 'Missing parameter: path' }
      if (content === undefined) return { error: 'Missing parameter: content' }
      
      const dir = path.dirname(filePath)
      // 使用安全的目录创建函数
      safeMkdir(dir)
      fs.writeFileSync(filePath, content)
      return { success: true }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'create_directory',
  description: 'Create a directory',
  parameters: [
    { name: 'path', type: 'string', description: 'Directory path to create', required: true }
  ],
  handler: async (params: any) => {
    try {
      const dirPath = params?.path
      if (!dirPath) return { error: 'Missing parameter: path' }
      
      if (!fs.existsSync(dirPath)) {
        // 使用安全的目录创建函数
        const createdDir = safeMkdir(dirPath)
        return { success: true, message: `Directory created at ${createdDir}` }
      }
      return { success: true, message: `Directory already exists at ${dirPath}` }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'list_files',
  description: 'List files in a directory',
  parameters: [
    { name: 'path', type: 'string', description: 'Directory path', required: true }
  ],
  handler: async (params: any) => {
    try {
      const dirPath = params?.path
      if (!dirPath) return { error: 'Missing parameter: path' }
      
      if (!fs.existsSync(dirPath)) return { error: `Directory not found: ${dirPath}` }
      const files = fs.readdirSync(dirPath)
      return { files }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'glob_paths',
  description: 'Find files by glob pattern (supports **, *, ?)',
  parameters: [
    { name: 'pattern', type: 'string', description: 'Glob pattern (e.g. "**/*.ts")', required: true },
    { name: 'cwd', type: 'string', description: 'Root directory for the glob (default: task directory)', required: false }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const pattern = params?.pattern
      const cwd = params?.cwd
      if (!pattern || typeof pattern !== 'string') return { error: 'Missing parameter: pattern' }
      const root = cwd || ctx?.taskDir || process.cwd()
      if (!fs.existsSync(root)) return { error: 'Directory not found' }

      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const toRegex = (glob: string) => {
        const parts = glob.split('/').filter(Boolean)
        const regexParts = parts.map(p => {
          if (p === '**') return '(?:.*)'
          return escapeRegex(p).replace(/\\\*/g, '[^/]*').replace(/\\\?/g, '[^/]')
        })
        return new RegExp('^' + regexParts.join('/') + '$')
      }

      const re = toRegex(pattern)
      const matches: string[] = []
      const walk = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const ent of entries) {
          const full = path.join(dir, ent.name)
          if (ent.isDirectory()) {
            walk(full)
          } else {
            const rel = path.relative(root, full).split(path.sep).join('/')
            if (re.test(rel)) matches.push(full)
          }
        }
      }
      walk(root)
      return { matches }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'search_files',
  description: 'Search for a string pattern in files (grep)',
  parameters: [
    { name: 'pattern', type: 'string', description: 'Regex or string pattern to search for', required: true },
    { name: 'path', type: 'string', description: 'Directory to search in', required: true },
    { name: 'include', type: 'string', description: 'File pattern to include (e.g. "*.ts")', required: false }
  ],
  handler: async (params: any) => {
    try {
      const pattern = params?.pattern
      const searchPath = params?.path
      const include = params?.include
      
      if (!pattern) return { error: 'Missing parameter: pattern' }
      if (!searchPath) return { error: 'Missing parameter: path' }

      if (!fs.existsSync(searchPath)) return { error: `Directory not found: ${searchPath}` }
      
      // Use grep for performance
      // -r: recursive
      // -n: line number
      // -I: ignore binary
      const safePattern = commandUtils.sanitizeCommand(pattern)
      const safeSearchPath = commandUtils.sanitizeCommand(searchPath)
      const safeInclude = include ? commandUtils.sanitizeCommand(include) : ''
      
      let cmd = `grep -r -n -I "${safePattern}" "${safeSearchPath}"`
      if (safeInclude) {
        cmd += ` --include="${safeInclude}"`
      }
      
      // Limit output
      cmd += ` | head -n 20`
      
      // Validate command
      if (!commandUtils.validateCommand('grep')) {
        return { error: 'Command not allowed' }
      }
      
      const output = commandUtils.safeExecSync(cmd)
      return { output: output || 'No matches found' }
    } catch (error: any) {
      // grep returns exit code 1 if no matches found, which execSync treats as error
      if (error.status === 1) return { output: 'No matches found' }
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'get_project_structure',
  description: 'Get a tree view of the project directory',
  parameters: [
    { name: 'path', type: 'string', description: 'Root directory path', required: true },
    { name: 'depth', type: 'number', description: 'Max depth (default 2)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const rootPath = params?.path
      const depth = params?.depth ?? 2
      
      if (!rootPath) return { error: 'Missing parameter: path' }
      
      if (!fs.existsSync(rootPath)) return { error: `Directory not found: ${rootPath}` }
      
      const getTree = (dir: string, currentDepth: number): any => {
        if (currentDepth > depth) return null
        
        const name = path.basename(dir)
        const stats = fs.statSync(dir)
        if (!stats.isDirectory()) return name
        
        const children = fs.readdirSync(dir)
          .filter(f => !f.startsWith('.') && f !== 'node_modules' && f !== 'dist' && f !== 'build')
          .map(child => getTree(path.join(dir, child), currentDepth + 1))
          .filter(Boolean)
          
        return { [name]: children }
      }
      
      const tree = getTree(rootPath, 0)
      return { structure: JSON.stringify(tree, null, 2) }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})
  
  // Command syntax validation helper
  function validateCommandSyntax(command: string): { valid: boolean, error?: string, suggestion?: string } {
    // Check for missing pipe operator in find commands
    if (command.includes('find') && command.includes('head') && !command.includes('|')) {
      return {
        valid: false,
        error: 'Missing pipe operator | between find and head commands',
        suggestion: command.replace(/head\s+\d+/i, '| head $&')
      }
    }
  
    // Check for missing && operator in cd commands
    if (command.includes('cd') && (command.includes('npm') || command.includes('yarn') || command.includes('pnpm')) && !command.includes('&&')) {
      return {
        valid: false,
        error: 'Missing && operator to chain cd and npm commands',
        suggestion: command.replace(/cd\s+\S+\s+(npm|yarn|pnpm)/i, 'cd $1 && $2')
      }
    }
  
    return { valid: true }
  }
  
  // Command Execution Tool
  toolRegistry.register({
  name: 'execute_command',
  description: 'Execute a shell command',
  parameters: [
    { name: 'command', type: 'string', description: 'Command to execute', required: true },
    { name: 'cwd', type: 'string', description: 'Working directory', required: false },
    { name: 'timeout', type: 'number', description: 'Timeout in milliseconds (default: 300000 for npm install, 60000 for others)', required: false }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const command = params?.command
      const cwd = params?.cwd
      const timeout = params?.timeout
      
      if (!command) return { error: 'Missing parameter: command' }

      // 检查取消信号
      if (ctx?.signal?.aborted) {
        return { error: 'Command cancelled by user' }
      }

      // 根据命令类型设置默认超时时间
      let defaultTimeout = 60000 // 默认60秒
      if (command.includes('npm install') || command.includes('npm ci') || command.includes('yarn install') || command.includes('pnpm install')) {
        defaultTimeout = 300000 // npm install 5分钟
      } else if (command.includes('npm run build') || command.includes('npm build') || command.includes('npm run dev')) {
        defaultTimeout = 180000 // 构建命令 3分钟
      }

      const finalTimeout = timeout || defaultTimeout

      // 扩展PATH环境变量，添加常见路径
      const extendedEnv = {
        ...process.env,
        PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${path.join(process.env.HOME || '', 'bin')}:${path.join(process.env.HOME || '', '.nvm/versions/node')}/current/bin`
      }

      // Sanitize and validate command
      const safeCommand = commandUtils.sanitizeCommand(command)
      
      // Validate command syntax before execution
      const syntaxValidation = validateCommandSyntax(safeCommand)
      if (!syntaxValidation.valid) {
        return { 
          error: `Command syntax error: ${syntaxValidation.error}\n\nCorrect syntax: ${syntaxValidation.suggestion}\n\nYour command: ${safeCommand}` 
        }
      }
      
      // Validate command
      const cmdName = safeCommand.split(' ')[0].trim()
      if (!commandUtils.validateCommand(cmdName)) {
        return { error: `Command not allowed: ${cmdName}` }
      }
      
      const result = commandUtils.safeExecSync(safeCommand, {
        encoding: 'utf8',
        cwd: cwd || process.cwd(),
        stdio: 'pipe',
        timeout: finalTimeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB缓冲区
        env: extendedEnv
      })
      return { output: result }
    } catch (error: any) {
      // 处理超时错误
      if (error.killed && error.signal === 'SIGTERM') {
        return { error: `Command timed out after ${params?.timeout || 'default'}ms. The command may still be running in the background.` }
      }
      // 处理取消信号
      if (ctx?.signal?.aborted) {
        return { error: 'Command cancelled by user' }
      }
      return { error: error.message }
    }
  }
})

// Web Tool
toolRegistry.register({
  name: 'fetch_webpage',
  description: 'Fetch text content from a URL using a headless browser (supports dynamic content)',
  parameters: [
    { name: 'url', type: 'string', description: 'URL to fetch', required: true }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const url = params?.url
      if (!url) return { error: 'Missing parameter: url' }

      const content = await browserService.fetchPageContent(url, ctx?.signal)
      return { content }
    } catch (error: any) {
      try {
        const url = params?.url
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        })
        return { content: response.data }
      } catch (axiosError: any) {
        return { error: `Browser fetch failed: ${error.message}. Axios fetch failed: ${axiosError.message}` }
      }
    }
  }
})

// Response Tool
toolRegistry.register({
  name: 'respond_to_user',
  description: '直接回复用户消息',
  parameters: [
    { name: 'message', type: 'string', description: '回复消息内容', required: true }
  ],
  handler: async (params: any) => {
    try {
      const message = params?.message
      if (!message) return { error: 'Missing parameter: message' }

      console.log('[respond_to_user] 回复用户:', message)
      return { 
        success: true,
        message: message,
        artifacts: [{ type: 'text', content: message }]
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'open_page',
  description: 'Open a URL in the user\'s visible browser tab. Use this when the user asks to "open", "visit", "browse" or "show" a website.',
  parameters: [
    { name: 'url', type: 'string', description: 'URL to open', required: true }
  ],
  handler: async (params: any) => {
    try {
      const url = params?.url
      if (!url) return { error: 'Missing parameter: url' }

      // Find the main window (visible and not destroyed)
      // 优先查找可见窗口，如果没有则查找任意非销毁窗口
      let windows = BrowserWindow.getAllWindows()
      console.log('[open_page] Found windows:', windows.length)
      
      let mainWindow = windows.find(w => w.isVisible() && !w.isDestroyed())
      console.log('[open_page] Visible window:', mainWindow ? 'found' : 'not found')
      
      // 如果没有可见窗口，尝试查找任意已加载的窗口
      if (!mainWindow) {
        mainWindow = windows.find(w => !w.isDestroyed() && w.webContents && !w.webContents.isLoading())
        console.log('[open_page] Loaded window:', mainWindow ? 'found' : 'not found')
      }
      
      // 如果还是没有，查找任意非销毁窗口
      if (!mainWindow) {
        mainWindow = windows.find(w => !w.isDestroyed())
        console.log('[open_page] Any window:', mainWindow ? 'found' : 'not found')
      }

      if (mainWindow) {
        console.log('[open_page] Sending agent-open-page event for URL:', url)
        mainWindow.webContents.send('agent-open-page', url)
        return { success: true, message: `Opened ${url} in browser` }
      } else {
        console.log('[open_page] No window found, windows count:', windows.length)
        return { error: 'No active browser window found' }
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'search_web',
  description: 'Search the web using Baidu and return relevant results (titles, links, snippets). Does NOT open the browser UI.',
  parameters: [
    { name: 'query', type: 'string', description: 'Search query', required: true }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const query = params?.query
      if (!query) return { error: 'Missing parameter: query' }

      const results = await browserService.search(query, ctx?.signal)
      return { results }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'search_images',
  description: 'Search images and return direct image URLs',
  parameters: [
    { name: 'query', type: 'string', description: 'Search query', required: true },
    { name: 'count', type: 'number', description: 'Max number of images (default 10)', required: false }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const query = params?.query
      const count = params?.count ?? 10
      if (!query || typeof query !== 'string') return { error: 'Missing parameter: query' }
      const results = await browserService.searchImages(query, count, ctx?.signal)
      return { results }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'batch_download_images',
  description: 'Search and download multiple images in batch',
  parameters: [
    { name: 'query', type: 'string', description: 'Search query', required: true },
    { name: 'count', type: 'number', description: 'Number of images to download (default: 9)', required: false },
    { name: 'dir', type: 'string', description: 'Directory to save images', required: false }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const query = params?.query;
      const rawCount = params?.count ?? 9;
      const count = Math.max(9, Number(rawCount) || 9);
      const dir = params?.dir;
      
      const searchTool = toolRegistry.getTool('search_images');
      if (!searchTool) return { error: 'search_images tool not found' };
      
      const candidateCount = Math.min(60, Math.max(count * 4, 30));
      const searchResult = await searchTool.handler({ query, count: candidateCount }, ctx);
      if (searchResult.error) return { error: searchResult.error };
      
      const images = (searchResult.results || []);
      const downloadTool = toolRegistry.getTool('download_image');
      if (!downloadTool) return { error: 'download_image tool not found' };

      const results: any[] = [];
      const errors: string[] = [];
      const artifacts: any[] = [];

      // Parallel download with concurrency limit of 3
      const chunks = [];
      for (let i = 0; i < images.length; i += 3) chunks.push(images.slice(i, i + 3));

      for (const chunk of chunks) {
        if (results.length >= count) break;
        await Promise.all(chunk.map(async (img: any, idx: number) => {
          if (results.length >= count) return;
          try {
            const safeTitle = (img.title || '').replace(/[^\w\u4e00-\u9fa5\s-]/g, '').trim().substring(0, 20);
            const filename = safeTitle ? `${safeTitle}-${Date.now()}-${idx}` : undefined;

            const res = await downloadTool.handler({ url: img.url, dir, filename }, ctx);
            if (res.success && res.path) {
              try {
                const st = fs.statSync(res.path);
                if (st.size < 10 * 1024) {
                  errors.push(`Too small (likely icon): ${img.url}`);
                  return;
                }
              } catch {}

              results.push(res.path);
              if (res.artifacts) artifacts.push(...res.artifacts);
            } else {
              errors.push(`Failed: ${img.url}`);
            }
          } catch (e) {
            errors.push(`Error: ${img.url}`);
          }
        }));
      }
      
      return { 
        success: true, 
        downloadedCount: results.length, 
        paths: results.slice(0, count),
        artifacts, // Pass artifacts up so they can be displayed in chat
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error: any) {
      return { error: error.message };
    }
  }
})

toolRegistry.register({
  name: 'download_image',
  description: 'Download an image from URL into task directory and return its path',
  parameters: [
    { name: 'url', type: 'string', description: 'Image URL', required: true },
    { name: 'filename', type: 'string', description: 'Optional filename', required: false },
    { name: 'dir', type: 'string', description: 'Optional directory (default: taskDir/imgs)', required: false }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const url = params?.url
      const filename = params?.filename
      const dir = params?.dir
      if (!url || typeof url !== 'string') return { error: 'Missing parameter: url' }

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        signal: ctx?.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })

      const contentType = String(response.headers?.['content-type'] || '').toLowerCase()
      const buf = Buffer.from(response.data)
      const extFromType = contentType.includes('png') ? '.png'
        : contentType.includes('jpeg') ? '.jpg'
        : contentType.includes('jpg') ? '.jpg'
        : contentType.includes('webp') ? '.webp'
        : contentType.includes('gif') ? '.gif'
        : ''

      const safe = (s: string) => s.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      const urlName = safe(path.basename(new URL(url).pathname) || 'image')
      const nameBase = safe((filename || urlName || 'image').replace(/\.[a-z0-9]+$/i, '')) || 'image'
      const ext = extFromType || (path.extname(urlName) || '.jpg')
      const mime = contentType || (ext === '.png' ? 'image/png'
        : ext === '.webp' ? 'image/webp'
        : ext === '.gif' ? 'image/gif'
        : 'image/jpeg')

      const item = galleryService.importBuffer(buf, ext, url, mime)
      const savePath = item.filePath

      const baseDir = dir || (ctx?.taskDir ? path.join(ctx.taskDir, 'imgs') : undefined)
      let taskCopyPath: string | undefined
      if (baseDir) {
        if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
        taskCopyPath = path.join(baseDir, `${nameBase}${ext}`)
        try {
          fs.copyFileSync(savePath, taskCopyPath)
        } catch {}
      }

      const dataUrl = buf.length <= 2 * 1024 * 1024 ? `data:${mime};base64,${buf.toString('base64')}` : undefined

      return {
        success: true,
        path: savePath,
        artifacts: [{
          type: 'image',
          path: savePath,
          name: path.basename(savePath),
          mime,
          dataUrl,
          galleryId: item.id,
          taskCopyPath
        }]
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'read_image',
  description: 'Read an image file and return a data URL for preview',
  parameters: [
    { name: 'path', type: 'string', description: 'Absolute path to the image', required: true }
  ],
  handler: async (params: any) => {
    try {
      const filePath =
        params?.path ||
        params?.filePath ||
        params?.filepath ||
        params?.imagePath
      if (!filePath || typeof filePath !== 'string') return { error: 'Missing parameter: path' }
      if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` }
      const buf = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const mime = ext === '.png' ? 'image/png'
        : ext === '.webp' ? 'image/webp'
        : ext === '.gif' ? 'image/gif'
        : 'image/jpeg'
      const dataUrl = `data:${mime};base64,${buf.toString('base64')}`
      return {
        success: true,
        dataUrl,
        artifacts: [{
          type: 'image',
          path: filePath,
          name: path.basename(filePath),
          mime,
          dataUrl
        }]
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// Project Tool
toolRegistry.register({
  name: 'create_project',
  description: 'Initialize a new project',
  parameters: [
    { name: 'path', type: 'string', description: 'Project path', required: true },
    { name: 'type', type: 'string', description: 'Project type (npm, etc.)', required: true }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.path
      const type = params?.type
      
      if (!projectPath) return { error: 'Missing parameter: path' }
      if (!type) return { error: 'Missing parameter: type' }

      if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true })
      
      if (type === 'npm') {
        execSync('npm init -y', { cwd: projectPath, stdio: 'pipe' })
        return { success: true, message: 'NPM project initialized' }
      }
      return { error: 'Unsupported project type' }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// Aliases / Compatibility Tools for planner hallucinations
toolRegistry.register({
  name: 'list_imgs',
  description: 'List image files in a directory (png,jpg,jpeg,webp,gif)',
  parameters: [
    { name: 'path', type: 'string', description: 'Directory path to scan', required: true }
  ],
  handler: async (params: any) => {
    try {
      const dirPath = params?.path
      if (!dirPath) return { error: 'Missing parameter: path' }
      if (!fs.existsSync(dirPath)) return { error: `Directory not found: ${dirPath}` }
      const exts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
      const files = fs.readdirSync(dirPath)
        .filter(f => exts.has(path.extname(f).toLowerCase()))
        .map(f => path.join(dirPath, f))
      return { files }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'check_file',
  description: 'Check if a file or directory exists and return metadata',
  parameters: [
    { name: 'path', type: 'string', description: 'Absolute path to check', required: true }
  ],
  handler: async (params: any) => {
    try {
      const target = params?.path
      if (!target) return { error: 'Missing parameter: path' }
      if (!fs.existsSync(target)) return { error: `File not found: ${target}` }
      const stat = fs.statSync(target)
      return {
        exists: true,
        isDirectory: stat.isDirectory(),
        size: stat.size,
        path: target
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'preview_image',
  description: 'Preview an image file (alias of read_image)',
  parameters: [
    { name: 'path', type: 'string', description: 'Absolute path to the image', required: true }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const readImage = toolRegistry.getTool('read_image')
      if (!readImage) return { error: 'read_image tool not available' }
      return await readImage.handler(params, ctx)
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// Git Tools
toolRegistry.register({
  name: 'git_status',
  description: 'Check git status',
  parameters: [
    { name: 'cwd', type: 'string', description: 'Repository path', required: true }
  ],
  handler: async (params: any) => {
    try {
      const cwd = params?.cwd
      if (!cwd) return { error: 'Missing parameter: cwd' }
      
      const output = execSync('git status', { cwd, encoding: 'utf8', stdio: 'pipe' })
      return { output }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'git_init',
  description: 'Initialize a git repository',
  parameters: [
    { name: 'cwd', type: 'string', description: 'Directory path', required: true }
  ],
  handler: async (params: any) => {
    try {
      const cwd = params?.cwd
      if (!cwd) return { error: 'Missing parameter: cwd' }
      
      execSync('git init', { cwd, stdio: 'pipe' })
      return { success: true }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'git_add',
  description: 'Stage files for commit',
  parameters: [
    { name: 'files', type: 'string', description: 'Files to add (e.g. .)', required: true },
    { name: 'cwd', type: 'string', description: 'Repository path', required: true }
  ],
  handler: async (params: any) => {
    try {
      const files = params?.files
      const cwd = params?.cwd
      
      if (!files) return { error: 'Missing parameter: files' }
      if (!cwd) return { error: 'Missing parameter: cwd' }
      
      execSync(`git add ${files}`, { cwd, stdio: 'pipe' })
      return { success: true }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'git_commit',
  description: 'Commit changes',
  parameters: [
    { name: 'message', type: 'string', description: 'Commit message', required: true },
    { name: 'cwd', type: 'string', description: 'Repository path', required: true }
  ],
  handler: async (params: any) => {
    try {
      const message = params?.message
      const cwd = params?.cwd
      
      if (!message) return { error: 'Missing parameter: message' }
      if (!cwd) return { error: 'Missing parameter: cwd' }

      execSync(`git commit -m "${message}"`, { cwd, stdio: 'pipe' })
      return { success: true }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// System Info Tool
toolRegistry.register({
  name: 'get_system_info',
  description: 'Get system information (CPU, Mem, OS)',
  parameters: [],
  handler: async () => {
    try {
      const cpu = await si.cpu()
      const mem = await si.mem()
      const osInfo = await si.osInfo()
      return {
        cpu: `${cpu.manufacturer} ${cpu.brand}`,
        memory: {
          total: mem.total,
          free: mem.free,
          used: mem.used
        },
        os: `${osInfo.distro} ${osInfo.release}`
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// Chat Tool (For responding to user without actions)
toolRegistry.register({
  name: 'respond_to_user',
  description: 'Use this tool to provide a direct answer or response to the user when no other action is needed, or to summarize actions.',
  parameters: [
    { name: 'message', type: 'string', description: 'The response message to show to the user', required: true }
  ],
  handler: async (params: any) => {
    const message = params?.message
    if (!message) return { success: false, error: 'Missing parameter: message' }
    return { success: true, message }
  }
})

toolRegistry.register({
  name: 'session_notes_read',
  description: 'Read persistent session notes for long-term memory',
  parameters: [
    { name: 'sessionId', type: 'string', description: 'Session identifier (project or conversation id)', required: true },
    { name: 'query', type: 'string', description: 'Optional keyword filter', required: false }
  ],
  handler: async (params: any) => {
    try {
      const sessionIdRaw = params?.sessionId
      const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw.trim() : ''
      if (!sessionId) return { error: 'Missing parameter: sessionId' }

      const root = path.join(app.getPath('userData'), 'sessions')
      const filePath = path.join(root, `${sessionId}.json`)
      if (!fs.existsSync(filePath)) {
        return { notes: [] }
      }

      let parsed: any
      try {
        const content = fs.readFileSync(filePath, 'utf8')
        parsed = JSON.parse(content)
      } catch {
        return { notes: [] }
      }

      let notes: any[] = Array.isArray(parsed?.notes) ? parsed.notes : []
      const queryRaw = params?.query
      const query = typeof queryRaw === 'string' ? queryRaw.trim().toLowerCase() : ''
      if (query) {
        notes = notes.filter(note => {
          const title = String(note?.title || '').toLowerCase()
          const content = String(note?.content || '').toLowerCase()
          const tags = Array.isArray(note?.tags) ? note.tags.join(' ').toLowerCase() : ''
          return title.includes(query) || content.includes(query) || tags.includes(query)
        })
      }
      return { notes }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'session_notes_write',
  description: 'Append a note to persistent session memory',
  parameters: [
    { name: 'sessionId', type: 'string', description: 'Session identifier (project or conversation id)', required: true },
    { name: 'note', type: 'string', description: 'Note content to store', required: true },
    { name: 'tags', type: 'array', description: 'Optional string tags for this note', required: false },
    { name: 'title', type: 'string', description: 'Optional short title for this note', required: false }
  ],
  handler: async (params: any) => {
    try {
      const sessionIdRaw = params?.sessionId
      const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw.trim() : ''
      if (!sessionId) return { error: 'Missing parameter: sessionId' }

      const noteContentRaw = params?.note
      const noteContent = typeof noteContentRaw === 'string' ? noteContentRaw : ''
      if (!noteContent) return { error: 'Missing parameter: note' }

      const titleRaw = params?.title
      const title = typeof titleRaw === 'string' ? titleRaw : ''
      const tagsParam = params?.tags
      const tags = Array.isArray(tagsParam) ? tagsParam.map((t: any) => String(t)) : undefined

      const root = path.join(app.getPath('userData'), 'sessions')
      const filePath = path.join(root, `${sessionId}.json`)
      if (!fs.existsSync(root)) {
        fs.mkdirSync(root, { recursive: true })
      }

      let data: any = {}
      if (fs.existsSync(filePath)) {
        try {
          const existing = fs.readFileSync(filePath, 'utf8')
          data = JSON.parse(existing)
        } catch {
          data = {}
        }
      }

      if (!Array.isArray(data.notes)) {
        data.notes = []
      }

      const now = new Date().toISOString()
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const note = {
        id,
        title: title || undefined,
        content: noteContent,
        tags,
        createdAt: now,
        updatedAt: now
      }

      data.notes.push(note)
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
      return { success: true, note }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// ========== 浏览器自动化工具 ==========

// 点击网页元素
toolRegistry.register({
  name: 'browser_click',
  description: 'Click an element on a webpage using CSS selector (in the main window webview)',
  parameters: [
    { name: 'url', type: 'string', description: 'URL of the page to interact with', required: false },
    { name: 'selector', type: 'string', description: 'CSS selector of the element to click', required: true }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const selector = params?.selector
      if (!selector) return { error: 'Missing parameter: selector' }

      const mainWindow = getMainWin()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-action', { action: 'click', selector })
        return { success: true, message: `Clicking element: ${selector}` }
      } else {
        // 如果没有主窗口，使用传统方式
        const url = params?.url || 'https://www.google.com'
        const result = await browserService.clickElement(url, selector, ctx?.signal)
        return result
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 在输入框中输入文字
toolRegistry.register({
  name: 'browser_type',
  description: 'Type text into an input field on a webpage (in the main window webview)',
  parameters: [
    { name: 'selector', type: 'string', description: 'CSS selector of the input element', required: true },
    { name: 'text', type: 'string', description: 'Text to type into the element', required: true }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const selector = params?.selector
      const text = params?.text
      if (!selector) return { error: 'Missing parameter: selector' }
      if (!text) return { error: 'Missing parameter: text' }

      const mainWindow = getMainWin()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-action', { action: 'type', selector, text })
        return { success: true, message: `Typing into: ${selector}` }
      } else {
        const url = params?.url || 'https://www.google.com'
        const result = await browserService.typeText(url, selector, text, ctx?.signal)
        return result
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 滚动页面
toolRegistry.register({
  name: 'browser_scroll',
  description: 'Scroll a webpage to a specific position (in the main window webview)',
  parameters: [
    { name: 'scrollTop', type: 'number', description: 'Pixel position to scroll to (vertical)', required: true }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const scrollTop = params?.scrollTop
      if (typeof scrollTop !== 'number') return { error: 'Missing parameter: scrollTop (number)' }

      const mainWindow = getMainWin()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-action', { action: 'scroll', scrollTop })
        return { success: true, message: `Scrolling to: ${scrollTop}` }
      } else {
        const url = params?.url || 'https://www.google.com'
        const result = await browserService.scrollPage(url, scrollTop, ctx?.signal)
        return result
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 截图
toolRegistry.register({
  name: 'browser_screenshot',
  description: 'Take a screenshot of a webpage and return as base64 image',
  parameters: [
    { name: 'url', type: 'string', description: 'URL of the page to screenshot', required: true }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const url = params?.url
      if (!url) return { error: 'Missing parameter: url' }

      const result = await browserService.takeScreenshot(url, ctx?.signal)
      if (result.success && result.dataUrl) {
        return {
          success: true,
          dataUrl: result.dataUrl,
          artifacts: [{
            type: 'image',
            dataUrl: result.dataUrl,
            name: 'screenshot.png'
          }]
        }
      }
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 获取页面元素
toolRegistry.register({
  name: 'browser_elements',
  description: 'Get all clickable/inputtable elements from a webpage with their CSS selectors',
  parameters: [
    { name: 'url', type: 'string', description: 'URL of the page to analyze', required: true }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const url = params?.url
      if (!url) return { error: 'Missing parameter: url' }

      const result = await browserService.getPageElements(url, ctx?.signal)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 执行JavaScript
toolRegistry.register({
  name: 'browser_exec',
  description: 'Execute custom JavaScript code on a webpage',
  parameters: [
    { name: 'url', type: 'string', description: 'URL of the page to run script on', required: true },
    { name: 'script', type: 'string', description: 'JavaScript code to execute', required: true }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const url = params?.url
      const script = params?.script
      if (!url) return { error: 'Missing parameter: url' }
      if (!script) return { error: 'Missing parameter: script' }

      const result = await browserService.executeScript(url, script, ctx?.signal)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 导航到URL
toolRegistry.register({
  name: 'browser_goto',
  description: 'Navigate to a URL in the user visible browser tab. Use this to open websites in the main window.',
  parameters: [
    { name: 'url', type: 'string', description: 'URL to navigate to', required: true }
  ],
  handler: async (params: any) => {
    try {
      const url = params?.url
      if (!url) return { error: 'Missing parameter: url' }

      // 使用主窗口而不是创建新窗口
      let windows = BrowserWindow.getAllWindows()
      let mainWindow = windows.find(w => w.isVisible() && !w.isDestroyed())
      if (!mainWindow) {
        mainWindow = windows.find(w => !w.isDestroyed())
      }

      if (mainWindow) {
        console.log('[browser_goto] Sending agent-open-page event for URL:', url)
        mainWindow.webContents.send('agent-open-page', url)
        return { success: true, message: `Opened ${url} in browser` }
      } else {
        return { error: 'No active browser window found' }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 等待元素出现
toolRegistry.register({
  name: 'browser_wait',
  description: 'Wait for a CSS selector to appear on a page',
  parameters: [
    { name: 'url', type: 'string', description: 'URL of the page', required: true },
    { name: 'selector', type: 'string', description: 'CSS selector to wait for', required: true },
    { name: 'timeout', type: 'number', description: 'Timeout in milliseconds (default 10000)', required: false }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const url = params?.url
      const selector = params?.selector
      const timeout = params?.timeout ?? 10000
      if (!url) return { error: 'Missing parameter: url' }
      if (!selector) return { error: 'Missing parameter: selector' }

      const result = await browserService.waitForSelector(url, selector, timeout, ctx?.signal)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 获取所有Tab
toolRegistry.register({
  name: 'browser_tabs',
  description: 'Get all open browser tabs/windows',
  parameters: [],
  handler: async () => {
    try {
      const result = await browserService.getTabs()
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 切换Tab
toolRegistry.register({
  name: 'browser_switch_tab',
  description: 'Switch to a specific tab by window ID',
  parameters: [
    { name: 'windowId', type: 'number', description: 'Window/Tab ID to switch to', required: true }
  ],
  handler: async (params: any) => {
    try {
      const windowId = params?.windowId
      if (typeof windowId !== 'number') return { error: 'Missing parameter: windowId' }

      const result = await browserService.switchTab(windowId)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 播放视频
toolRegistry.register({
  name: 'browser_play_video',
  description: 'Navigate to a video URL and attempt to play it automatically',
  parameters: [
    { name: 'url', type: 'string', description: 'Video URL to play', required: true }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const url = params?.url
      if (!url) return { error: 'Missing parameter: url' }

      const result = await browserService.playVideo(url, ctx?.signal)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 获取当前URL
toolRegistry.register({
  name: 'browser_current_url',
  description: 'Get the current URL of the active browser window',
  parameters: [],
  handler: async () => {
    try {
      const result = await browserService.getCurrentUrl()
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 模拟按键
toolRegistry.register({
  name: 'browser_press_key',
  description: 'Simulate pressing a keyboard key (Enter, Tab, Escape, etc.)',
  parameters: [
    { name: 'url', type: 'string', description: 'URL of the page', required: true },
    { name: 'key', type: 'string', description: 'Key to press (Enter, Tab, Escape, ArrowDown, etc.)', required: true },
    { name: 'selector', type: 'string', description: 'Optional CSS selector to focus before pressing key', required: false }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const url = params?.url
      const key = params?.key
      const selector = params?.selector
      if (!url) return { error: 'Missing parameter: url' }
      if (!key) return { error: 'Missing parameter: key' }

      const result = await browserService.pressKey(url, key, selector, ctx?.signal)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 下载文件
toolRegistry.register({
  name: 'browser_download',
  description: 'Download a file/image from URL to local path',
  parameters: [
    { name: 'url', type: 'string', description: 'URL of the file to download', required: true },
    { name: 'path', type: 'string', description: 'Local path to save the file', required: true },
    { name: 'referer', type: 'string', description: 'Optional referer URL for the request', required: false }
  ],
  handler: async (params: any, ctx?: any) => {
    try {
      const url = params?.url
      const savePath = params?.path
      const referer = params?.referer
      if (!url) return { error: 'Missing parameter: url' }
      if (!savePath) return { error: 'Missing parameter: path' }

      const result = await browserService.downloadResource(url, savePath, referer, ctx?.signal)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 获取Cookie
toolRegistry.register({
  name: 'browser_cookies_get',
  description: 'Get cookies for a URL',
  parameters: [
    { name: 'url', type: 'string', description: 'URL to get cookies for', required: true }
  ],
  handler: async (params: any) => {
    try {
      const url = params?.url
      if (!url) return { error: 'Missing parameter: url' }

      const result = await browserService.getCookies(url)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 设置Cookie
toolRegistry.register({
  name: 'browser_cookies_set',
  description: 'Set cookies for a URL (useful for maintaining login sessions)',
  parameters: [
    { name: 'url', type: 'string', description: 'URL to set cookies for', required: true },
    { name: 'cookies', type: 'array', description: 'Array of cookie objects {name, value, domain?, path?}', required: true }
  ],
  handler: async (params: any) => {
    try {
      const url = params?.url
      const cookies = params?.cookies
      if (!url) return { error: 'Missing parameter: url' }
      if (!Array.isArray(cookies)) return { error: 'Missing parameter: cookies (array)' }

      const result = await browserService.setCookies(url, cookies)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 清除Cookie
toolRegistry.register({
  name: 'browser_cookies_clear',
  description: 'Clear cookies for a URL or all cookies',
  parameters: [
    { name: 'url', type: 'string', description: 'URL to clear cookies for (optional, clears all if not provided)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const url = params?.url
      const result = await browserService.clearCookies(url)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// ========== 主窗口WebView控制工具 ==========
// 这些工具直接在应用的主浏览器中执行操作，而不是创建新窗口

// 导航到URL（在主webview中）
toolRegistry.register({
  name: 'webview_goto',
  description: 'Navigate to a URL in the main application browser (not a new window)',
  parameters: [
    { name: 'url', type: 'string', description: 'URL to navigate to', required: true }
  ],
  handler: async (params: any) => {
    try {
      const url = params?.url
      if (!url) return { error: 'Missing parameter: url' }

      const mainWin = getMainWin()
      if (!mainWin || mainWin.isDestroyed()) {
        return { error: 'Main window not available' }
      }

      mainWin.webContents.send('webview-action', { action: 'goto', url })
      return { success: true, message: `Navigating to ${url} in main browser` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 点击元素（在主webview中）
toolRegistry.register({
  name: 'webview_click',
  description: 'Click an element in the main application browser',
  parameters: [
    { name: 'selector', type: 'string', description: 'CSS selector of the element to click', required: true }
  ],
  handler: async (params: any) => {
    try {
      const selector = params?.selector
      if (!selector) return { error: 'Missing parameter: selector' }

      const mainWin = getMainWin()
      if (!mainWin || mainWin.isDestroyed()) {
        return { error: 'Main window not available' }
      }

      mainWin.webContents.send('webview-action', { action: 'click', selector })
      return { success: true, message: `Clicking element ${selector} in main browser` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 输入文字（在主webview中）
toolRegistry.register({
  name: 'webview_type',
  description: 'Type text into an input field in the main application browser',
  parameters: [
    { name: 'selector', type: 'string', description: 'CSS selector of the input element', required: true },
    { name: 'text', type: 'string', description: 'Text to type', required: true }
  ],
  handler: async (params: any) => {
    try {
      const selector = params?.selector
      const text = params?.text
      if (!selector) return { error: 'Missing parameter: selector' }
      if (!text) return { error: 'Missing parameter: text' }

      const mainWin = getMainWin()
      if (!mainWin || mainWin.isDestroyed()) {
        return { error: 'Main window not available' }
      }

      mainWin.webContents.send('webview-action', { action: 'type', selector, text })
      return { success: true, message: `Typing into ${selector} in main browser` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 滚动页面（在主webview中）
toolRegistry.register({
  name: 'webview_scroll',
  description: 'Scroll the page in the main application browser',
  parameters: [
    { name: 'scrollTop', type: 'number', description: 'Pixel position to scroll to (vertical)', required: true }
  ],
  handler: async (params: any) => {
    try {
      const scrollTop = params?.scrollTop
      if (typeof scrollTop !== 'number') return { error: 'Missing parameter: scrollTop' }

      const mainWin = getMainWin()
      if (!mainWin || mainWin.isDestroyed()) {
        return { error: 'Main window not available' }
      }

      mainWin.webContents.send('webview-action', { action: 'scroll', scrollTop })
      return { success: true, message: `Scrolling to ${scrollTop}px in main browser` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 播放视频（在主webview中）
toolRegistry.register({
  name: 'webview_play',
  description: 'Play video in the main application browser (click play button or press space)',
  parameters: [],
  handler: async () => {
    try {
      const mainWin = getMainWin()
      if (!mainWin || mainWin.isDestroyed()) {
        return { error: 'Main window not available' }
      }

      mainWin.webContents.send('webview-action', { action: 'play' })
      return { success: true, message: 'Playing video in main browser' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// 等待元素（在主webview中）
toolRegistry.register({
  name: 'webview_wait',
  description: 'Wait for an element to appear in the main application browser',
  parameters: [
    { name: 'selector', type: 'string', description: 'CSS selector to wait for', required: true }
  ],
  handler: async (params: any) => {
    try {
      const selector = params?.selector
      if (!selector) return { error: 'Missing parameter: selector' }

      const mainWin = getMainWin()
      if (!mainWin || mainWin.isDestroyed()) {
        return { error: 'Main window not available' }
      }

      mainWin.webContents.send('webview-action', { action: 'wait', selector })
      return { success: true, message: `Waiting for ${selector} in main browser` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
})

// ============================================
// 扩展工具生态系统 - Git版本控制工具
// ============================================

// Git状态查看
toolRegistry.register({
  name: 'git_status',
  description: 'Show the working tree status of a Git repository',
  parameters: [
    { name: 'repoPath', type: 'string', description: 'Path to the Git repository (default: current directory)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const repoPath = params?.repoPath || process.cwd()
      const result = execSync('git status --porcelain', { 
        cwd: repoPath, 
        encoding: 'utf8',
        timeout: 30000 
      })
      return { output: result || 'Working tree clean' }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// Git日志查看
toolRegistry.register({
  name: 'git_log',
  description: 'Show recent commit history',
  parameters: [
    { name: 'repoPath', type: 'string', description: 'Path to the Git repository', required: false },
    { name: 'maxCount', type: 'number', description: 'Number of commits to show (default: 10)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const repoPath = params?.repoPath || process.cwd()
      const maxCount = params?.maxCount || 10
      const result = execSync(`git log --oneline -${maxCount}`, { 
        cwd: repoPath, 
        encoding: 'utf8',
        timeout: 30000 
      })
      return { output: result }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// Git提交
toolRegistry.register({
  name: 'git_commit',
  description: 'Create a new commit with the specified message',
  parameters: [
    { name: 'message', type: 'string', description: 'Commit message', required: true },
    { name: 'repoPath', type: 'string', description: 'Path to the Git repository', required: false }
  ],
  handler: async (params: any) => {
    try {
      const message = params?.message
      if (!message) return { error: 'Missing parameter: message' }
      
      const repoPath = params?.repoPath || process.cwd()
      
      // 先检查是否有暂存的更改
      const status = execSync('git status --porcelain', { cwd: repoPath, encoding: 'utf8' })
      if (!status.trim()) {
        return { error: 'No changes to commit' }
      }
      
      // 添加所有更改
      execSync('git add -A', { cwd: repoPath, encoding: 'utf8' })
      
      // 创建提交
      const result = execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { 
        cwd: repoPath, 
        encoding: 'utf8',
        timeout: 30000 
      })
      return { success: true, output: result || 'Commit created successfully' }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// Git分支列表
toolRegistry.register({
  name: 'git_branch',
  description: 'List all local and remote branches',
  parameters: [
    { name: 'repoPath', type: 'string', description: 'Path to the Git repository', required: false }
  ],
  handler: async (params: any) => {
    try {
      const repoPath = params?.repoPath || process.cwd()
      const result = execSync('git branch -a', { 
        cwd: repoPath, 
        encoding: 'utf8',
        timeout: 30000 
      })
      return { output: result }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// Git差异查看
toolRegistry.register({
  name: 'git_diff',
  description: 'Show changes between commits, commit and working tree, etc',
  parameters: [
    { name: 'target', type: 'string', description: 'Diff target: "staged", "HEAD", or commit hash', required: false },
    { name: 'repoPath', type: 'string', description: 'Path to the Git repository', required: false }
  ],
  handler: async (params: any) => {
    try {
      const repoPath = params?.repoPath || process.cwd()
      const target = params?.target || 'staged'
      
      let cmd = 'git diff'
      if (target === 'staged') cmd = 'git diff --cached'
      else if (target !== 'HEAD') cmd = `git diff HEAD ${target}`
      
      const result = execSync(cmd, { 
        cwd: repoPath, 
        encoding: 'utf8',
        timeout: 30000 
      })
      return { output: result || 'No changes' }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// ============================================
// 扩展工具生态系统 - API测试工具
// ============================================

// HTTP请求工具
toolRegistry.register({
  name: 'http_request',
  description: 'Make HTTP requests (GET, POST, PUT, DELETE, PATCH)',
  parameters: [
    { name: 'url', type: 'string', description: 'Request URL', required: true },
    { name: 'method', type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE, PATCH)', required: false },
    { name: 'headers', type: 'object', description: 'Request headers as key-value pairs', required: false },
    { name: 'body', type: 'string', description: 'Request body (JSON string or plain text)', required: false },
    { name: 'timeout', type: 'number', description: 'Request timeout in milliseconds (default: 30000)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const url = params?.url
      if (!url) return { error: 'Missing parameter: url' }
      
      const method = params?.method || 'GET'
      const headers = params?.headers || {}
      const body = params?.body
      const timeout = params?.timeout || 30000
      
      const axiosInstance = axios.create({
        timeout,
        validateStatus: () => true // 不抛出任何状态码错误
      })
      
      const response = await axiosInstance({
        url,
        method: method.toUpperCase(),
        headers,
        data: body ? (() => { try { return JSON.parse(body) } catch { return body } })() : undefined
      })
      
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// ============================================
// 扩展工具生态系统 - 系统信息工具
// ============================================

// 获取系统信息
toolRegistry.register({
  name: 'system_info',
  description: 'Get system information (CPU, memory, disk, OS)',
  parameters: [],
  handler: async () => {
    try {
      const [cpu, mem, disk, osInfo] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.fsSize(),
        si.osInfo()
      ])
      
      return {
        cpu: {
          manufacturer: cpu.manufacturer,
          brand: cpu.brand,
          cores: cpu.cores,
          physicalCores: cpu.physicalCores,
          speed: cpu.speed
        },
        memory: {
          total: mem.total,
          used: mem.used,
          free: mem.free,
          usedPercent: (mem.used / mem.total * 100).toFixed(2)
        },
        disk: disk.map(d => ({
          fs: d.fs,
          type: d.type,
          size: d.size,
          used: d.used,
          available: d.available,
          usePercent: d.use
        })),
        os: {
          platform: osInfo.platform,
          distro: osInfo.distro,
          release: osInfo.release,
          arch: osInfo.arch,
          hostname: osInfo.hostname
        }
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 进程列表
toolRegistry.register({
  name: 'process_list',
  description: 'List running processes',
  parameters: [
    { name: 'limit', type: 'number', description: 'Number of processes to return (default: 20)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const limit = params?.limit || 20
      const processes = await si.processes()
      
      // 按CPU使用率排序并限制数量
      const sorted = processes.list
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, limit)
        .map(p => ({
          pid: p.pid,
          name: p.name,
          cpu: p.cpu.toFixed(2),
          memory: p.mem.toFixed(2),
          state: p.state
        }))
      
      return { processes: sorted }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 杀掉进程
toolRegistry.register({
  name: 'kill_process',
  description: 'Kill a process by PID',
  parameters: [
    { name: 'pid', type: 'number', description: 'Process ID to kill', required: true },
    { name: 'force', type: 'boolean', description: 'Force kill (SIGKILL)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const pid = params?.pid
      if (!pid) return { error: 'Missing parameter: pid' }
      
      const force = params?.force || false
      const signal = force ? 'SIGKILL' : 'SIGTERM'
      
      process.kill(pid, signal)
      return { success: true, message: `Process ${pid} killed with signal ${signal}` }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// ============================================
// 扩展工具生态系统 - 剪贴板工具
// ============================================

// 读取剪贴板
toolRegistry.register({
  name: 'clipboard_read',
  description: 'Read text from system clipboard',
  parameters: [],
  handler: async () => {
    try {
      const { clipboard } = require('electron')
      const text = clipboard.readText()
      return { text }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 写入剪贴板
toolRegistry.register({
  name: 'clipboard_write',
  description: 'Write text to system clipboard',
  parameters: [
    { name: 'text', type: 'string', description: 'Text to write to clipboard', required: true }
  ],
  handler: async (params: any) => {
    try {
      const text = params?.text
      if (!text) return { error: 'Missing parameter: text' }
      
      const { clipboard } = require('electron')
      clipboard.writeText(text)
      return { success: true, message: 'Text written to clipboard' }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// ============================================
// 扩展工具生态系统 - 搜索工具
// ============================================

// 全局搜索文件内容
toolRegistry.register({
  name: 'search_content',
  description: 'Search for text in files (grep-like functionality)',
  parameters: [
    { name: 'pattern', type: 'string', description: 'Search pattern (regex supported)', required: true },
    { name: 'path', type: 'string', description: 'Directory path to search in', required: false },
    { name: 'filePattern', type: 'string', description: 'File pattern to match (e.g., "*.ts", "*.js")', required: false },
    { name: 'ignoreCase', type: 'boolean', description: 'Case insensitive search', required: false },
    { name: 'maxResults', type: 'number', description: 'Maximum number of results', required: false }
  ],
  handler: async (params: any) => {
    try {
      const pattern = params?.pattern
      if (!pattern) return { error: 'Missing parameter: pattern' }
      
      const searchPath = params?.path || process.cwd()
      const filePattern = params?.filePattern || '*'
      const ignoreCase = params?.ignoreCase !== false
      const maxResults = params?.maxResults || 100
      
      const { execSync } = require('child_process')
      
      let cmd = `grep -r -n ${ignoreCase ? '-i' : ''}`
      if (filePattern !== '*') {
        cmd += ` --include="${filePattern}"`
      }
      cmd += ` -m ${maxResults} "${pattern.replace(/"/g, '\\"')}" "${searchPath}"`
      
      const result = execSync(cmd, { encoding: 'utf8', timeout: 60000 })
      
      const lines = result.split('\n').filter((l: string) => l.trim())
      const matches = lines.slice(0, maxResults).map((line: string) => {
        const colonIndex = line.indexOf(':')
        if (colonIndex === -1) return { line }
        return {
          file: line.substring(0, colonIndex),
          content: line.substring(colonIndex + 1)
        }
      })
      
      return { matches, total: matches.length }
    } catch (error: any) {
      if (error.status === 1) return { matches: [], total: 0 } // grep没找到匹配
      return { error: error.message }
    }
  }
})

// ============================================
// 扩展工具生态系统 - 代码执行工具
// ============================================

// 执行Node.js代码
toolRegistry.register({
  name: 'execute_node',
  description: 'Execute Node.js code and return the result',
  parameters: [
    { name: 'code', type: 'string', description: 'Node.js code to execute', required: true }
  ],
  handler: async (params: any) => {
    try {
      const code = params?.code
      if (!code) return { error: 'Missing parameter: code' }
      
      // 捕获console输出
      const logs: string[] = []
      const originalConsole = { ...console }
      console.log = (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
      console.error = (...args) => logs.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
      
      let result
      try {
        result = await safeCodeExecutionService.executeCode(code)
      } finally {
        Object.assign(console, originalConsole)
      }
      
      return {
        result: typeof result === 'undefined' ? undefined : (typeof result === 'object' ? JSON.stringify(result) : result),
        logs: logs.join('\n')
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 执行Python代码（如果可用）
toolRegistry.register({
  name: 'execute_python',
  description: 'Execute Python code (requires Python to be installed)',
  parameters: [
    { name: 'code', type: 'string', description: 'Python code to execute', required: true }
  ],
  handler: async (params: any) => {
    try {
      const code = params?.code
      if (!code) return { error: 'Missing parameter: code' }
      
      const { execSync } = require('child_process')
      
      // 检查python是否可用
      try {
        execSync('python3 --version', { encoding: 'utf8', timeout: 5000 })
      } catch {
        return { error: 'Python is not installed or not in PATH' }
      }
      
      // 创建临时文件执行
      const fs = require('fs')
      const path = require('path')
      const os = require('os')
      
      const tempFile = path.join(os.tmpdir(), `trae_exec_${Date.now()}.py`)
      fs.writeFileSync(tempFile, code)
      
      try {
        const result = execSync(`python3 "${tempFile}"`, { encoding: 'utf8', timeout: 60000 })
        return { output: result }
      } finally {
        fs.unlinkSync(tempFile)
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

console.log('[ToolRegistry] Extended tools loaded: Git, HTTP, System, Clipboard, Search, Code Execution')
