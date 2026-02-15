import * as fs from 'fs'
import * as path from 'path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { execSync } from 'child_process'
import axios from 'axios'
import * as si from 'systeminformation'
import { toolRegistry } from './ToolRegistry'
import { browserService } from '../services/BrowserService'
import { galleryService } from '../services/GalleryService'

// 导入主窗口获取函数
import { getMainWindow } from '../index'

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
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
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
        fs.mkdirSync(dirPath, { recursive: true })
        return { success: true, message: `Directory created at ${dirPath}` }
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
  handler: async (params: any, ctx) => {
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
      let cmd = `grep -r -n -I "${pattern}" "${searchPath}"`
      if (include) {
        cmd += ` --include="${include}"`
      }
      
      // Limit output
      cmd += ` | head -n 20`
      
      const output = execSync(cmd, { encoding: 'utf8' })
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

// Command Execution Tool
toolRegistry.register({
  name: 'execute_command',
  description: 'Execute a shell command',
  parameters: [
    { name: 'command', type: 'string', description: 'Command to execute', required: true },
    { name: 'cwd', type: 'string', description: 'Working directory', required: false }
  ],
  handler: async (params: any) => {
    try {
      const command = params?.command
      const cwd = params?.cwd
      
      if (!command) return { error: 'Missing parameter: command' }

      const result = execSync(command, { 
        encoding: 'utf8',
        cwd: cwd || process.cwd()
      })
      return { output: result }
    } catch (error: any) {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
        execSync('npm init -y', { cwd: projectPath })
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
  handler: async (params: any, ctx) => {
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
      
      const output = execSync('git status', { cwd, encoding: 'utf8' })
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
      
      execSync('git init', { cwd })
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
      
      execSync(`git add ${files}`, { cwd })
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

      execSync(`git commit -m "${message}"`, { cwd })
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
  handler: async (params: any, ctx) => {
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
