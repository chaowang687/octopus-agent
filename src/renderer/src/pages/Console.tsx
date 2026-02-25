import React, { useState, useRef, useEffect } from 'react'
import CodeEditor from '../components/CodeEditor'
import '../components/CodeEditor.css'

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'info'
  content: string
  timestamp: number
}

interface TaskProgress {
  status: 'idle' | 'running' | 'done' | 'cancelled' | 'error'
  logs: string[]
  files: string[]
}

interface OpenFile {
  path: string
  name: string
  content: string
  language: string
}

interface CommandExecResult {
  success: boolean
  output?: string
  error?: string
  queuedMs?: number
  startedAt?: number
  finishedAt?: number
  truncated?: boolean
}

interface ConsoleTab {
  id: string
  name: string
  output: TerminalLine[]
  input: string
  history: string[]
  historyIndex: number
  currentModel: string
  taskProgress: TaskProgress
  currentTaskId: string | null
}

const STORAGE_KEYS = {
  TABS: 'console_tabs',
  ACTIVE_TAB: 'console_active_tab',
  GLOBAL_HISTORY: 'console_global_history'
}

const Console: React.FC = () => {
  const [tabs, setTabs] = useState<ConsoleTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>(['deepseek'])
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadFromStorage()
    loadAvailableModels()
  }, [])

  const loadFromStorage = () => {
    try {
      const savedTabs = localStorage.getItem(STORAGE_KEYS.TABS)
      const savedActiveTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)
      
      if (savedTabs) {
        const parsedTabs = JSON.parse(savedTabs)
        setTabs(parsedTabs)
        if (savedActiveTab && parsedTabs.find((t: ConsoleTab) => t.id === savedActiveTab)) {
          setActiveTabId(savedActiveTab)
        } else if (parsedTabs.length > 0) {
          setActiveTabId(parsedTabs[0].id)
        }
      } else {
        createNewTab()
      }
    } catch (error) {
      console.error('Error loading from storage:', error)
      createNewTab()
    }
  }

  const saveToStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(tabs))
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTabId)
    } catch (error) {
      console.error('Error saving to storage:', error)
    }
  }

  useEffect(() => {
    if (tabs.length > 0) {
      saveToStorage()
    }
  }, [tabs, activeTabId])

  const createNewTab = () => {
    const newTab: ConsoleTab = {
      id: `tab_${Date.now()}`,
      name: `Console ${tabs.length + 1}`,
      output: [
        { type: 'info', content: 'Agent Coder Console v0.3.0', timestamp: Date.now() },
        { type: 'info', content: 'Type "help" to see available commands.', timestamp: Date.now() },
        { type: 'info', content: '----------------------------------------', timestamp: Date.now() }
      ],
      input: '',
      history: [],
      historyIndex: -1,
      currentModel: 'deepseek',
      taskProgress: { status: 'idle', logs: [], files: [] },
      currentTaskId: null
    }
    
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
  }

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (tabs.length === 1) return
    
    const newTabs = tabs.filter(t => t.id !== tabId)
    setTabs(newTabs)
    
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[newTabs.length - 1].id)
    }
  }

  const renameTab = (tabId: string) => {
    const newName = prompt('Enter new tab name:')
    if (newName) {
      setTabs(prev => prev.map(t => 
        t.id === tabId ? { ...t, name: newName } : t
      ))
    }
  }

  const getActiveTab = () => tabs.find(t => t.id === activeTabId)
  const updateActiveTab = (updates: Partial<ConsoleTab>) => {
    setTabs(prev => prev.map(t => 
      t.id === activeTabId ? { ...t, ...updates } : t
    ))
  }

  const activeTab = getActiveTab()

  useEffect(() => {
    const api = (window as any).electron?.task?.onProgress
    if (!api || !activeTab) return

    const unsubscribe = window.electron.task.onProgress((evt: any) => {
      if (!activeTab.currentTaskId || evt.taskId !== activeTab.currentTaskId) return
      
      const time = new Date(evt.timestamp || Date.now()).toLocaleTimeString()
      
      updateActiveTab({
        taskProgress: {
          ...activeTab.taskProgress,
          logs: [...activeTab.taskProgress.logs, `[${time}] ${evt.type}`],
          status: evt.type === 'task_done' ? 'done' : 
                  evt.type === 'task_error' ? 'error' :
                  evt.type === 'task_cancelled' ? 'cancelled' : 'running'
        }
      })
    })

    return unsubscribe
  }, [activeTabId, activeTab?.currentTaskId])

  const loadAvailableModels = async () => {
    try {
      const modelsToCheck = ['openai', 'claude', 'minimax', 'deepseek', 'doubao', 'agent5']
      const configuredModels: string[] = []
      
      for (const model of modelsToCheck) {
        const key = await window.electron.api.getApiKey(model)
        if (key) {
          configuredModels.push(model)
        }
      }
      
      setAvailableModels(configuredModels.length > 0 ? configuredModels : ['deepseek'])
    } catch (error) {
      console.error('加载模型列表失败:', error)
    }
  }

  const getModelDisplayName = (model: string): string => {
    const names: Record<string, string> = {
      'openai': 'OpenAI',
      'claude': 'Claude',
      'minimax': 'MiniMax',
      'deepseek': 'DeepSeek',
      'doubao': '豆包',
      'agent5': 'Agent5 (Qwen3)'
    }
    return names[model] || model
  }

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [activeTab?.output])

  const addOutput = (type: TerminalLine['type'], content: string) => {
    if (!activeTab) return
    updateActiveTab({
      output: [...activeTab.output, { type, content, timestamp: Date.now() }]
    })
  }

  const openFile = async (filePath: string) => {
    try {
      const result = await window.electron.fs.readFile(filePath)
      if (result.success && result.content !== undefined) {
        const ext = filePath.split('.').pop()?.toLowerCase() || ''
        const languageMap: Record<string, string> = {
          'ts': 'typescript', 'tsx': 'typescriptreact',
          'js': 'javascript', 'jsx': 'javascriptreact',
          'json': 'json', 'md': 'markdown',
          'css': 'css', 'py': 'python', 'rs': 'rust',
          'go': 'go', 'sh': 'shell', 'html': 'html',
          'cs': 'csharp'
        }
        const language = languageMap[ext] || 'plaintext'
        const fileName = filePath.split('/').pop() || filePath

        const fileContent = result.content || ''
        const existingFile = openFiles.find(f => f.path === filePath)
        if (!existingFile) {
          setOpenFiles(prev => [...prev, { path: filePath, name: fileName, content: fileContent, language }])
        } else {
          setOpenFiles(prev => prev.map(f => f.path === filePath ? { ...f, content: fileContent } : f))
        }
        setActiveFile(filePath)
        setShowEditor(true)
        addOutput('info', 'Opened file: ' + filePath)
      } else {
        addOutput('error', 'Failed to open file: ' + filePath)
      }
    } catch (error: any) {
      addOutput('error', 'Error: ' + error.message)
    }
  }

  const listFiles = async (dirPath: string = '.') => {
    try {
      const result = await window.electron.fs.listEntries(dirPath)
      if (result.success && result.entries) {
        const files = result.entries
          .filter((e: any) => !e.name.startsWith('.'))
          .map((e: any) => e.isDirectory ? '📁 ' + e.name + '/' : '📄 ' + e.name)
          .join('\n')
        addOutput('output', files || '(empty directory)')
      } else {
        addOutput('error', 'Failed to list directory')
      }
    } catch (error: any) {
      addOutput('error', 'Error: ' + error.message)
    }
  }

  const handleExecuteCommand = async () => {
    if (!activeTab || !activeTab.input.trim()) return

    const cmd = activeTab.input.trim()
    
    const newHistory = [cmd, ...activeTab.history.filter(h => h !== cmd)]
    updateActiveTab({
      history: newHistory,
      historyIndex: -1
    })
    
    addOutput('input', '$ ' + cmd)
    updateActiveTab({ input: '' })

    try {
      const args = cmd.split(' ')
      const commandName = args[0]

      switch (commandName) {
        case 'help':
          addOutput('output', 
            'Available commands:\n' +
            '  help              - Show this help message\n' +
            '  test              - Test if commands work\n' +
            '  clear             - Clear terminal\n' +
            '  open <file>       - Open a file in editor\n' +
            '  ls [dir]         - List directory contents\n' +
            '  close             - Close editor\n' +
            '  tools             - List available tools\n' +
            '  api               - Manage API keys (list)\n' +
            '  sys               - System info\n' +
            '  exec <cmd>        - Execute shell command\n' +
            '\n🌐 Web Crawler Commands:\n' +
            '  search <query>   - Search the web (Baidu)\n' +
            '  crawl <url>      - Crawl webpage content\n' +
            '  browse <url>     - Open URL in browser\n' +
            '\nTab Management:\n' +
            '  tab:new           - Create new tab\n' +
            '  tab:close         - Close current tab\n' +
            '  tab:rename <name> - Rename current tab\n' +
            '  tab:list          - List all tabs\n' +
            '  tab:switch <n>    - Switch to tab n\n' +
            '\nHistory Commands:\n' +
            '  history           - Show command history\n' +
            '  history:search <q>- Search command history\n' +
            '  history:clear     - Clear command history\n' +
            '\nSession Commands:\n' +
            '  session:save      - Save current session\n' +
            '  session:load      - Load saved session\n' +
            '  session:export    - Export session to file\n' +
            '  session:import    - Import session from file\n' +
            '\nTask Commands:\n' +
            '  model             - List available models\n' +
            '  model <name>      - Select model (openai/claude/minimax/deepseek/doubao/agent5)\n' +
            '  task <instruction>- Execute a coding task\n' +
            '  task:status      - Show current task status\n' +
            '  task:logs        - Show task logs\n' +
            '  task:files       - Show generated files\n' +
            '  task:dir         - Show task directory\n' +
            '  task:dir <path>  - Manually set task directory\n' +
            '  task:cancel      - Cancel current task\n' +
            '  task:reset       - Reset task state (for stuck tasks)'
          )
          break
        case 'test':
          addOutput('output', '✅ Test command works! 🎉')
          addOutput('info', 'If you see this, the code is up to date!')
          addOutput('info', 'Now try: search React')
          break
        case 'clear':
          updateActiveTab({
            output: [
              { type: 'info', content: 'Agent Coder Console v0.3.0', timestamp: Date.now() },
              { type: 'info', content: 'Type "help" to see available commands.', timestamp: Date.now() },
              { type: 'info', content: '----------------------------------------', timestamp: Date.now() }
            ]
          })
          return
        case 'open':
          if (args.length < 2) {
            addOutput('error', 'Usage: open <file>')
          } else {
            await openFile(args[1])
          }
          break
        case 'ls':
          await listFiles(args[1])
          break
        case 'close':
          setShowEditor(false)
          addOutput('info', 'Editor closed')
          break
        case 'tools':
          const toolsResult = await window.electron.tools.listTools()
          if (toolsResult.success && toolsResult.tools) {
            addOutput('output', 'Available Tools:\n' + toolsResult.tools.map((t: any) => '  - ' + t).join('\n'))
          } else {
            addOutput('error', 'Failed to list tools')
          }
          break
        case 'api':
          if (args[1] === 'list') {
            const keys = await Promise.all([
              window.electron.api.getApiKey('openai'),
              window.electron.api.getApiKey('claude'),
              window.electron.api.getApiKey('minimax'),
              window.electron.api.getApiKey('deepseek')
            ])
            const models = ['openai', 'claude', 'minimax', 'deepseek']
            const configured = models.filter((_, i) => !!keys[i])
            addOutput('output', 'Configured Keys: ' + (configured.length ? configured.join(', ') : 'None'))
          } else {
            addOutput('error', 'Usage: api list')
          }
          break
        case 'sys':
          const info = await window.electron.system.getSystemInfo()
          addOutput('output', 
            'System Info:\n' +
            '  OS: ' + info.os.platform + ' ' + info.os.version + '\n' +
            '  CPU: ' + info.cpu.brand + ' (' + info.cpu.cores + ' cores)\n' +
            '  Mem: ' + Math.round(info.memory.total / 1024 / 1024 / 1024) + 'GB Total'
          )
          break
        case 'exec':
          if (args.length < 2) {
            addOutput('error', 'Usage: exec <command> [args...]')
          } else {
            const execCmd = args[1]
            const execArgs = args.slice(2)
            const res = await window.electron.system.executeCommand(execCmd, execArgs) as CommandExecResult
            if (typeof res.queuedMs === 'number') {
              addOutput('info', `⏱ queue ${res.queuedMs}ms`)
            }
            addOutput('output', res.success ? (res.output || '') : 'Error: ' + (res.error || 'unknown'))
            if (res.truncated) {
              addOutput('info', 'Output truncated to protect UI performance.')
            }
          }
          break
        case 'search':
          if (args.length < 2) {
            addOutput('error', 'Usage: search <query>')
          } else {
            const query = args.slice(1).join(' ')
            addOutput('info', `🔍 Searching for: ${query}`)
            try {
              addOutput('info', '=== STEP 1: Calling tool ===')
              // @ts-ignore
              const res = await window.electron.tools.executeToolCommand('search_web', 'handler', [{ query }])
              
              addOutput('info', '=== STEP 2: Raw result ===')
              addOutput('output', JSON.stringify(res, null, 2))
              
              addOutput('info', '=== STEP 3: Result analysis ===')
              addOutput('info', `Type: ${typeof res}`)
              addOutput('info', `Keys: ${Object.keys(res || {}).join(', ')}`)
              
              addOutput('info', '=== STEP 4: Trying all possible paths ===')
              
              let foundResults = null
              
              if (res && res.success && res.output && res.output.results) {
                addOutput('info', '✓ Found at res.output.results')
                foundResults = res.output.results
              } else if (res && res.success && res.result && res.result.results) {
                addOutput('info', '✓ Found at res.result.results')
                foundResults = res.result.results
              } else if (res && res.success && res.results) {
                addOutput('info', '✓ Found at res.results')
                foundResults = res.results
              } else if (res && res.success && res.output) {
                addOutput('info', '✓ Found at res.output')
                foundResults = res.output
              } else if (res && res.results) {
                addOutput('info', '✓ Found at res.results (no success flag)')
                foundResults = res.results
              } else {
                addOutput('error', '✗ Could not find results in any path')
              }
              
              addOutput('info', '=== STEP 5: Final results ===')
              if (foundResults) {
                addOutput('info', `Results type: ${typeof foundResults}`)
                addOutput('info', `Is array: ${Array.isArray(foundResults)}`)
                if (Array.isArray(foundResults)) {
                  addOutput('info', `Results length: ${foundResults.length}`)
                }
                addOutput('output', JSON.stringify(foundResults, null, 2))
              } else {
                addOutput('error', 'No results found')
              }
              
            } catch (e: any) {
              addOutput('error', '=== ERROR ===')
              addOutput('error', e.message)
              addOutput('error', JSON.stringify(e, null, 2))
            }
          }
          break
        case 'crawl':
          if (args.length < 2) {
            addOutput('error', 'Usage: crawl <url>')
          } else {
            const url = args[1]
            addOutput('info', `🕷️ Crawling: ${url}`)
            try {
              addOutput('info', '[Debug] Calling fetch_webpage tool...')
              // @ts-ignore
              const res = await window.electron.tools.executeToolCommand('fetch_webpage', 'handler', [{ url }])
              
              addOutput('info', `[Debug] Raw result: ${JSON.stringify(res, null, 2)}`)
              addOutput('info', `[Debug] Result keys: ${Object.keys(res || {}).join(', ')}`)
              
              let content = null
              
              if (res && res.success) {
                addOutput('info', '[Debug] res.success is true')
                if (res.output && res.output.content) {
                  addOutput('info', '[Debug] Using res.output.content')
                  content = res.output.content
                } else if (res.result && res.result.content) {
                  addOutput('info', '[Debug] Using res.result.content')
                  content = res.result.content
                } else if (res.content) {
                  addOutput('info', '[Debug] Using res.content')
                  content = res.content
                } else if (res.output) {
                  addOutput('info', '[Debug] Using res.output')
                  content = res.output
                }
              } else if (res && res.content) {
                addOutput('info', '[Debug] Using res.content (no success flag)')
                content = res.content
              }
              
              if (content) {
                addOutput('output', `✅ Successfully crawled!`)
                addOutput('info', `📄 Content length: ${content.length} characters`)
                addOutput('output', `\n📝 Preview (first 500 chars):\n`)
                addOutput('output', content.substring(0, 500) + (content.length > 500 ? '...' : ''))
              } else {
                addOutput('error', 'Crawl failed')
              }
            } catch (e: any) {
              addOutput('error', 'Error crawling: ' + e.message)
              addOutput('error', `[Error Details] ${JSON.stringify(e, null, 2)}`)
            }
          }
          break
        case 'browse':
          if (args.length < 2) {
            addOutput('error', 'Usage: browse <url>')
          } else {
            const url = args[1]
            addOutput('info', `🌐 Opening in browser: ${url}`)
            try {
              // 使用 sessionStorage 传递 URL 给浏览器页面
              sessionStorage.setItem('pendingOpenUrl', url)
              addOutput('output', '✅ URL sent to browser! Switch to the Browser page to view.')
            } catch (e: any) {
              addOutput('error', 'Error opening URL: ' + e.message)
            }
          }
          break
        case 'tab:new':
          createNewTab()
          addOutput('info', 'New tab created')
          break
        case 'tab:close':
          if (tabs.length > 1) {
            closeTab(activeTabId, { stopPropagation: () => {} } as React.MouseEvent)
          } else {
            addOutput('error', 'Cannot close the last tab')
          }
          break
        case 'tab:rename':
          if (args.length < 2) {
            addOutput('error', 'Usage: tab:rename <name>')
          } else {
            setTabs(prev => prev.map(t => 
              t.id === activeTabId ? { ...t, name: args[1] } : t
            ))
            addOutput('info', 'Tab renamed to: ' + args[1])
          }
          break
        case 'tab:list':
          addOutput('output', 'Tabs:\n' + tabs.map((t, i) => 
            `  ${i + 1}. ${t.name}${t.id === activeTabId ? ' (active)' : ''}`
          ).join('\n'))
          break
        case 'tab:switch':
          if (args.length < 2) {
            addOutput('error', 'Usage: tab:switch <n>')
          } else {
            const index = parseInt(args[1]) - 1
            if (index >= 0 && index < tabs.length) {
              setActiveTabId(tabs[index].id)
              addOutput('info', 'Switched to tab: ' + tabs[index].name)
            } else {
              addOutput('error', 'Invalid tab number')
            }
          }
          break
        case 'history':
          if (activeTab.history.length === 0) {
            addOutput('info', 'No command history')
          } else {
            addOutput('output', 'Command History:\n' + 
              activeTab.history.map((h, i) => `  ${i + 1}. ${h}`).join('\n'))
          }
          break
        case 'history:search':
          if (args.length < 2) {
            addOutput('error', 'Usage: history:search <query>')
          } else {
            const query = args[1].toLowerCase()
            const results = activeTab.history.filter(h => h.toLowerCase().includes(query))
            if (results.length === 0) {
              addOutput('info', 'No matching commands found')
            } else {
              addOutput('output', 'Matching Commands:\n' + 
                results.map((h, i) => `  ${i + 1}. ${h}`).join('\n'))
            }
          }
          break
        case 'history:clear':
          updateActiveTab({ history: [] })
          addOutput('info', 'Command history cleared')
          break
        case 'session:save':
          try {
            const sessionName = args[1] || `session_${Date.now()}`
            localStorage.setItem(`console_session_${sessionName}`, JSON.stringify(tabs))
            addOutput('info', `Session saved as: ${sessionName}`)
          } catch (error: any) {
            addOutput('error', 'Failed to save session: ' + error.message)
          }
          break
        case 'session:load':
          try {
            const sessionName = args[1]
            if (!sessionName) {
              const sessions = Object.keys(localStorage).filter(k => k.startsWith('console_session_'))
              if (sessions.length === 0) {
                addOutput('info', 'No saved sessions')
              } else {
                addOutput('output', 'Saved Sessions:\n' + 
                  sessions.map((s, i) => `  ${i + 1}. ${s.replace('console_session_', '')}`).join('\n'))
              }
            } else {
              const sessionData = localStorage.getItem(`console_session_${sessionName}`)
              if (sessionData) {
                const loadedTabs = JSON.parse(sessionData)
                setTabs(loadedTabs)
                setActiveTabId(loadedTabs[0].id)
                addOutput('info', `Session loaded: ${sessionName}`)
              } else {
                addOutput('error', 'Session not found: ' + sessionName)
              }
            }
          } catch (error: any) {
            addOutput('error', 'Failed to load session: ' + error.message)
          }
          break
        case 'session:export':
          try {
            const exportData = JSON.stringify(tabs, null, 2)
            const blob = new Blob([exportData], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `console_session_${Date.now()}.json`
            a.click()
            URL.revokeObjectURL(url)
            addOutput('info', 'Session exported')
          } catch (error: any) {
            addOutput('error', 'Failed to export session: ' + error.message)
          }
          break
        case 'session:import':
          try {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.json'
            input.onchange = async (e: any) => {
              const file = e.target.files[0]
              if (file) {
                const text = await file.text()
                const importedTabs = JSON.parse(text)
                setTabs(importedTabs)
                setActiveTabId(importedTabs[0].id)
                addOutput('info', 'Session imported from: ' + file.name)
              }
            }
            input.click()
          } catch (error: any) {
            addOutput('error', 'Failed to import session: ' + error.message)
          }
          break
        case 'model':
          if (args.length === 1) {
            const modelList = availableModels.map(m => 
              `  - ${getModelDisplayName(m)}${m === activeTab?.currentModel ? ' (current)' : ''}`
            ).join('\n')
            addOutput('output', 'Available models:\n' + modelList)
          } else {
            const targetModel = args[1]
            if (availableModels.includes(targetModel)) {
              updateActiveTab({ currentModel: targetModel })
              addOutput('output', `Model selected: ${getModelDisplayName(targetModel)}`)
            } else {
              addOutput('error', `Model not available: ${targetModel}`)
            }
          }
          break
        case 'task':
          if (args.length < 2) {
            addOutput('error', 'Usage: task <instruction>')
          } else {
            const instruction = args.slice(1).join(' ')
            await executeTask(instruction)
          }
          break
        case 'task:status':
          showTaskStatus()
          break
        case 'task:logs':
          showTaskLogs()
          break
        case 'task:files':
          showTaskFiles()
          break
        case 'task:dir':
          if (args.length > 1) {
            await setTaskDirectory(args[1])
          } else {
            showTaskDirectory()
          }
          break
        case 'task:cancel':
          await cancelTask()
          break
        case 'task:reset':
          resetTaskState()
          break
        default:
          addOutput('error', 'Command not found: ' + commandName)
      }
    } catch (error: any) {
      addOutput('error', 'Error: ' + error.message)
    }
  }

  const executeTask = async (instruction: string, force: boolean = false) => {
    if (!activeTab) return
    
    let taskDir = ''
    try {
      if (activeTab.taskProgress.status === 'running' && !force) {
        addOutput('error', 'A task is already running. Use "task:reset" to reset or "task:cancel" to cancel.')
        return
      }

      addOutput('info', `Starting task with model: ${getModelDisplayName(activeTab.currentModel)}`)
      addOutput('info', `Task instruction: ${instruction}`)

      const taskId = `task_${Date.now()}`
      updateActiveTab({ currentTaskId: taskId })

      addOutput('info', `Task ID: ${taskId}`)

      updateActiveTab({
        taskProgress: {
          status: 'running',
          logs: [],
          files: []
        }
      })

      addOutput('info', 'Executing task...')
      
      const result = await window.electron.task.execute(instruction, {
        model: activeTab.currentModel,
        agentId: 'agent-solo-coder',
        sessionId: 'console-session'
      })

      addOutput('info', `Task execution result: ${JSON.stringify(result)}`)

      if (result.success) {
        addOutput('output', 'Task completed successfully!')
        
        if (result.result?.taskDir) {
          taskDir = result.result.taskDir
          addOutput('info', `Task directory: ${taskDir}`)
          await scanTaskDirectory(taskDir)
        }
        
        updateActiveTab({
          taskProgress: {
            ...activeTab.taskProgress,
            status: 'done'
          }
        })
      } else {
        addOutput('error', `Task failed: ${result.error}`)
        updateActiveTab({
          taskProgress: {
            ...activeTab.taskProgress,
            status: 'error'
          }
        })
      }
    } catch (error: any) {
      addOutput('error', `Error executing task: ${error.message}`)
      console.error('Task execution error:', error)
      updateActiveTab({
        taskProgress: {
          ...activeTab.taskProgress,
          status: 'error'
        }
      })
    }
  }

  const scanTaskDirectory = async (dirPath: string) => {
    try {
      addOutput('info', `Scanning directory: ${dirPath}`)
      const result = await window.electron.fs.listEntries(dirPath)
      
      if (result.success && result.entries && activeTab) {
        const allFiles: string[] = []
        await collectFiles(dirPath, result.entries, allFiles)
        
        if (allFiles.length > 0) {
          updateActiveTab({
            taskProgress: {
              ...activeTab.taskProgress,
              files: allFiles
            }
          })
          addOutput('info', `Found ${allFiles.length} files in task directory`)
        }
      }
    } catch (error: any) {
      addOutput('error', `Error scanning directory: ${error.message}`)
    }
  }

  const collectFiles = async (basePath: string, entries: any[], allFiles: string[]) => {
    for (const entry of entries) {
      const fullPath = basePath + '/' + entry.name
      if (entry.isDirectory) {
        const subResult = await window.electron.fs.listEntries(fullPath)
        if (subResult.success && subResult.entries) {
          await collectFiles(fullPath, subResult.entries, allFiles)
        }
      } else if (entry.isFile) {
        if (!entry.name.startsWith('.')) {
          allFiles.push(fullPath)
        }
      }
    }
  }

  const showTaskStatus = () => {
    if (!activeTab) return
    const statusText = {
      idle: 'Idle',
      running: 'Running',
      done: 'Completed',
      cancelled: 'Cancelled',
      error: 'Error'
    }[activeTab.taskProgress.status]
    
    addOutput('output', 
      `Task Status:\n` +
      `  Status: ${statusText}\n` +
      `  Logs: ${activeTab.taskProgress.logs.length}\n` +
      `  Files: ${activeTab.taskProgress.files.length}\n` +
      `  Model: ${getModelDisplayName(activeTab.currentModel)}`
    )
  }

  const showTaskLogs = () => {
    if (!activeTab) return
    if (activeTab.taskProgress.logs.length === 0) {
      addOutput('info', 'No task logs available')
      return
    }
    addOutput('output', 'Task Logs:\n' + activeTab.taskProgress.logs.map(log => '  ' + log).join('\n'))
  }

  const showTaskFiles = () => {
    if (!activeTab) return
    if (activeTab.taskProgress.files.length === 0) {
      addOutput('info', 'No files generated')
      return
    }
    
    const fileList = activeTab.taskProgress.files.map((file, index) => {
      const fileName = file.split('/').pop()
      return `  ${index + 1}. 📄 ${fileName}\n     ${file}`
    }).join('\n\n')
    
    addOutput('output', `Generated Files (${activeTab.taskProgress.files.length}):\n\n${fileList}`)
  }

  const cancelTask = async () => {
    if (!activeTab) return
    if (activeTab.taskProgress.status !== 'running') {
      addOutput('info', 'No running task to cancel')
      return
    }
    try {
      await window.electron.task.cancel()
      addOutput('info', 'Task cancelled')
      updateActiveTab({
        taskProgress: {
          ...activeTab.taskProgress,
          status: 'cancelled'
        }
      })
    } catch (error: any) {
      addOutput('error', `Error cancelling task: ${error.message}`)
    }
  }

  const resetTaskState = () => {
    if (!activeTab) return
    addOutput('info', 'Resetting task state...')
    updateActiveTab({
      taskProgress: {
        status: 'idle',
        logs: [],
        files: []
      },
      currentTaskId: null
    })
    addOutput('info', 'Task state reset')
  }

  const showTaskDirectory = () => {
    if (!activeTab) return
    if (activeTab.taskProgress.files.length > 0) {
      const firstFile = activeTab.taskProgress.files[0]
      const taskDir = firstFile.substring(0, firstFile.lastIndexOf('/'))
      
      addOutput('output', 'Task Directory:\n  📁 ' + taskDir)
      addOutput('info', 'Use "ls ' + taskDir + '" to list directory contents')
      addOutput('info', 'Use "open <file_path>" to open a file in editor')
    } else {
      addOutput('info', 'No task files available yet.')
      addOutput('info', 'You can manually set task directory with: task:dir <path>')
    }
  }

  const setTaskDirectory = async (dirPath: string) => {
    try {
      addOutput('info', `Setting task directory: ${dirPath}`)
      await scanTaskDirectory(dirPath)
    } catch (error: any) {
      addOutput('error', `Error setting task directory: ${error.message}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!activeTab) return
    
    if (e.key === 'Enter') {
      handleExecuteCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (activeTab.history.length > 0) {
        const newIndex = activeTab.historyIndex + 1
        if (newIndex < activeTab.history.length) {
          updateActiveTab({
            historyIndex: newIndex,
            input: activeTab.history[activeTab.history.length - 1 - newIndex]
          })
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (activeTab.historyIndex > 0) {
        const newIndex = activeTab.historyIndex - 1
        updateActiveTab({ historyIndex: newIndex })
        if (newIndex >= 0) {
          updateActiveTab({
            input: activeTab.history[activeTab.history.length - 1 - newIndex]
          })
        } else {
          updateActiveTab({ input: '' })
        }
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeTab) return
    updateActiveTab({ input: e.target.value })
  }

  const handleFileContentChange = (content: string) => {
    if (activeFile) {
      setOpenFiles(prev => prev.map(f => f.path === activeFile ? { ...f, content } : f))
    }
  }

  const handleFileSave = async (content: string) => {
    if (activeFile) {
      try {
        const result = await window.electron.fs.writeFile(activeFile, content)
        if (result.success) {
          addOutput('info', 'File saved: ' + activeFile)
        } else {
          addOutput('error', 'Failed to save file')
        }
      } catch (error: any) {
        addOutput('error', 'Error saving file: ' + error.message)
      }
    }
  }

  const activeFileData = openFiles.find(f => f.path === activeFile)

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      backgroundColor: '#0a0a0a' as const
    }}>
      <div style={{ 
        display: 'flex', 
        backgroundColor: '#0f0f0f' as const, 
        borderBottom: '1px solid #1a1a1a',
        padding: '4px 8px',
        gap: '4px',
        alignItems: 'center'
      }}>
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => renameTab(tab.id)}
              style={{
                padding: '4px 12px',
                backgroundColor: isActive ? '#0a0a0a' as const : '#0f0f0f' as const,
                border: isActive ? '1px solid #1a1a1a' : 'none',
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                fontSize: '12px',
                color: isActive ? '#9ca3af' as const : '#4b5563' as const,
                fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace",
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {tab.name}
              {tabs.length > 1 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    console.log('Closing tab:', tab.id)
                    closeTab(tab.id, e)
                  }}
                  style={{
                    color: '#6b7280' as const,
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginLeft: '8px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
                    e.currentTarget.style.color = '#ef4444'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#6b7280'
                  }}
                >
                  ×
                </span>
              )}
            </div>
          )
        })}
        <button
          onClick={(e) => {
            e.preventDefault()
            console.log('Creating new tab')
            createNewTab()
          }}
          style={{
            background: 'transparent',
            border: '1px solid #374151',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '4px 12px',
            fontSize: '16px',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#1f2937'
            e.currentTarget.style.borderColor = '#4b5563'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.borderColor = '#374151'
            e.currentTarget.style.color = '#9ca3af'
          }}
        >
          +
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ 
          color: '#4b5563', 
          fontSize: '11px',
          fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace"
        }}>
          {activeTab ? `${getModelDisplayName(activeTab.currentModel)}` : ''}
        </span>
      </div>
      
      {showEditor && activeFileData && (
        <div style={{ 
          height: '50%', 
          borderBottom: '1px solid #1a1a1a'
        }}>
          {openFiles.length > 1 && (
            <div style={{ 
              display: 'flex', 
              backgroundColor: '#0f0f0f' as const, 
              borderBottom: '1px solid #1a1a1a',
              padding: '4px 8px',
              gap: '4px'
            }}>
              {openFiles.map(file => {
                const isActive = activeFile === file.path
                return (
                  <div
                    key={file.path}
                    onClick={() => setActiveFile(file.path)}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: isActive ? '#0a0a0a' as const : '#0f0f0f' as const,
                      border: isActive ? '1px solid #1a1a1a' : 'none',
                      borderRadius: '4px 4px 0 0',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: isActive ? '#9ca3af' as const : '#4b5563' as const,
                      fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace"
                    }}
                  >
                    {file.name}
                  </div>
                )
              })}
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setShowEditor(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#4b5563',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '14px'
                }}
              >
                ×
              </button>
            </div>
          )}
          <CodeEditor
            filePath={activeFileData.path}
            content={activeFileData.content}
            language={activeFileData.language}
            theme="vs-dark"
            onChange={handleFileContentChange}
            onSave={handleFileSave}
          />
        </div>
      )}
      
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div 
          ref={outputRef}
          style={{ 
            flex: 1, 
            padding: '16px',
            overflowY: 'auto',
            fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace",
            fontSize: '13px'
          }}
          onClick={() => document.getElementById('console-input')?.focus()}
        >
          {activeTab?.output.map((line, i) => (
            <div 
              key={i} 
              style={{ 
                whiteSpace: 'pre-wrap', 
                marginBottom: '4px', 
                lineHeight: '1.5',
                color: line.type === 'input' ? '#22c55e' : 
                       line.type === 'error' ? '#ef4444' : 
                       line.type === 'info' ? '#6b7280' : '#d1d5db'
              }}
            >
              {line.content}
            </div>
          ))}
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          padding: '12px 16px',
          borderTop: '1px solid #1a1a1a',
          backgroundColor: '#0f0f0f' as const
        }}>
          <span style={{ 
            color: '#22c55e' as const, 
            marginRight: '8px',
            fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace",
            fontSize: '13px'
          }}>
            ➜
          </span>
          <input
            id="console-input"
            type="text"
            value={activeTab?.input || ''}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#fff' as const,
              outline: 'none',
              fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace",
              fontSize: '13px'
            }}
            placeholder="输入命令..."
            autoFocus
          />
        </div>
      </div>
    </div>
  )
}

export default Console
