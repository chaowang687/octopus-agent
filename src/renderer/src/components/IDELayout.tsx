import React, { useState, useCallback, useEffect, useRef } from 'react'
import FileTree, { FileNode } from './FileTree'
import CodeEditor from './CodeEditor'
import './IDELayout.css'

export interface IDELayoutProps {
  projectName: string
  projectPath: string
  projectVersion?: string
  onRunScript?: (scriptName: string) => void
  onOpenInVSCode?: () => void
  onOpenInFinder?: () => void
  onBack?: () => void
  scripts?: Record<string, string>
}

interface Tab {
  path: string
  name: string
  content: string
  modified: boolean
  language: string
}

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'info'
  content: string
  timestamp: number
}

const IDELayout: React.FC<IDELayoutProps> = ({
  projectName,
  projectPath,
  projectVersion,
  onRunScript,
  onBack
}) => {
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [fileLoading, setFileLoading] = useState(false)
  const [openTabs, setOpenTabs] = useState<Tab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [terminalHeight, setTerminalHeight] = useState(200)
  const [showTerminal, setShowTerminal] = useState(true)
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([])
  const [terminalInput, setTerminalInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isResizingTerminal, setIsResizingTerminal] = useState(false)
  const terminalOutputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const initOutput: TerminalLine[] = [
      { type: 'info', content: 'AGENT CODER IDE v0.2.0', timestamp: Date.now() },
      { type: 'info', content: 'Type "help" for available commands.', timestamp: Date.now() },
      { type: 'info', content: '----------------------------------------', timestamp: Date.now() }
    ]
    setTerminalLines(initOutput)
  }, [])

  useEffect(() => {
    if (terminalOutputRef.current) {
      terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight
    }
  }, [terminalLines])

  const getLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const languageMap: Record<string, string> = {
      'ts': 'typescript', 'tsx': 'typescriptreact',
      'js': 'javascript', 'jsx': 'javascriptreact',
      'json': 'json', 'md': 'markdown',
      'css': 'css', 'py': 'python', 'rs': 'rust',
      'go': 'go', 'sh': 'shell', 'html': 'html',
      'vue': 'vue', 'svelte': 'svelte', 'dockerfile': 'dockerfile',
      'cs': 'csharp'
    }
    return languageMap[ext] || 'plaintext'
  }

  const buildFileTree = useCallback(async (dirPath: string): Promise<FileNode> => {
    try {
      const ignorePatterns = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.DS_Store', 'Thumbs.db', '.cache', 'coverage', 'vendor', '.venv', 'venv', 'env', 'Pods', '.gradle', 'target', 'bin', 'obj']
      
      const buildTree = async (path: string, depth: number = 0): Promise<FileNode> => {
        if (depth > 8) {
          return { name: path.split('/').pop() || path, path, type: 'directory', children: [] }
        }
        
        const result = await window.electron.fs.listEntries(path)
        if (!result.success || !result.entries) {
          return { name: path.split('/').pop() || path, path, type: 'directory', children: [] }
        }

        const children: FileNode[] = []
        
        for (const entry of result.entries) {
          const entryLower = entry.name.toLowerCase()
          
          if (ignorePatterns.some(pattern => entryLower === pattern.toLowerCase())) continue
          if (entry.name.startsWith('.')) continue
          
          const fullPath = `${path}/${entry.name}`
          
          try {
            if (entry.isDirectory) {
              const childNode = await buildTree(fullPath, depth + 1)
              children.push(childNode)
            } else if (entry.isFile) {
              const ext = entry.name.split('.').pop() || ''
              children.push({ name: entry.name, path: fullPath, type: 'file', extension: ext })
            }
          } catch (e) {
          }
        }

        children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
          return a.name.localeCompare(b.name)
        })

        return { name: path.split('/').pop() || path, path, type: 'directory', children }
      }

      return await buildTree(dirPath)
    } catch (error) {
      return { name: dirPath.split('/').pop() || dirPath, path: dirPath, type: 'directory', children: [] }
    }
  }, [])

  useEffect(() => {
    buildFileTree(projectPath).then(setFileTree)
  }, [projectPath, buildFileTree])

  const handleFileSelect = useCallback(async (node: FileNode) => {
    if (node.type === 'file') {
      setSelectedFile(node.path)
      setFileLoading(true)
      
      try {
        const result = await window.electron.fs.readFile(node.path)
        if (result.success && result.content !== undefined) {
          setFileContent(result.content)
          
          const existingTab = openTabs.find(tab => tab.path === node.path)
          if (!existingTab) {
            setOpenTabs(prev => [...prev, {
              path: node.path,
              name: node.name,
              content: result.content,
              modified: false,
              language: getLanguage(node.path)
            }])
          }
          setActiveTab(node.path)
        }
      } catch (error) {
      } finally {
        setFileLoading(false)
      }
    }
  }, [openTabs])

  const handleContentChange = useCallback((content: string) => {
    setFileContent(content)
    setOpenTabs(prev => prev.map(tab => 
      tab.path === activeTab ? { ...tab, content, modified: true } : tab
    ))
  }, [activeTab])

  const handleSave = useCallback(async (content: string) => {
    if (!activeTab) return
    
    try {
      const result = await window.electron.fs.writeFile(activeTab, content)
      if (result.success) {
        setOpenTabs(prev => prev.map(tab => 
          tab.path === activeTab ? { ...tab, modified: false } : tab
        ))
        addTerminalLine('info', 'File saved: ' + activeTab)
      }
    } catch (error: any) {
      addTerminalLine('error', 'Error saving file: ' + error.message)
    }
  }, [activeTab])

  const closeTab = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenTabs(prev => prev.filter(tab => tab.path !== path))
    if (activeTab === path) {
      const remainingTabs = openTabs.filter(tab => tab.path !== path)
      setActiveTab(remainingTabs.length > 0 ? remainingTabs[0].path : null)
      if (remainingTabs.length > 0) {
        setFileContent(remainingTabs[0].content)
        setSelectedFile(remainingTabs[0].path)
      }
    }
  }, [activeTab, openTabs])

  const addTerminalLine = (type: TerminalLine['type'], content: string) => {
    setTerminalLines(prev => [...prev, { type, content, timestamp: Date.now() }])
  }

  const openFileInEditor = async (filePath: string) => {
    try {
      const result = await window.electron.fs.readFile(filePath)
      if (result.success && result.content !== undefined) {
        setFileContent(result.content)
        
        const existingTab = openTabs.find(tab => tab.path === filePath)
        if (!existingTab) {
          setOpenTabs(prev => [...prev, {
            path: filePath,
            name: filePath.split('/').pop() || filePath,
            content: result.content,
            modified: false,
            language: getLanguage(filePath)
          }])
        }
        setActiveTab(filePath)
        setSelectedFile(filePath)
        addTerminalLine('info', 'Opened file: ' + filePath)
      } else {
        addTerminalLine('error', 'Failed to open file: ' + filePath)
      }
    } catch (error: any) {
      addTerminalLine('error', 'Error: ' + error.message)
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
        addTerminalLine('output', files || '(empty directory)')
      } else {
        addTerminalLine('error', 'Failed to list directory')
      }
    } catch (error: any) {
      addTerminalLine('error', 'Error: ' + error.message)
    }
  }

  const handleTerminalCommand = useCallback(async () => {
    if (!terminalInput.trim()) return

    const cmd = terminalInput.trim()
    setHistory(prev => [...prev, cmd])
    setHistoryIndex(-1)
    addTerminalLine('input', '$ ' + cmd)
    setTerminalInput('')

    try {
      const args = cmd.split(' ')
      const commandName = args[0]

      switch (commandName) {
        case 'help':
          addTerminalLine('output', 
            'Available commands:\n' +
            '  help              - Show this help message\n' +
            '  clear             - Clear terminal\n' +
            '  open <file>       - Open a file in editor\n' +
            '  ls [dir]         - List directory contents\n' +
            '  close             - Close current tab\n' +
            '  toggle            - Toggle terminal visibility\n' +
            '  tools             - List available tools\n' +
            '  api list          - List configured API keys\n' +
            '  sys               - System info\n' +
            '  exec <cmd>        - Execute shell command'
          )
          break
        case 'clear':
          setTerminalLines([])
          return
        case 'open':
          if (args.length < 2) {
            addTerminalLine('error', 'Usage: open <file>')
          } else {
            await openFileInEditor(args[1])
          }
          break
        case 'ls':
          await listFiles(args[1])
          break
        case 'close':
          if (activeTab) {
            const remainingTabs = openTabs.filter(tab => tab.path !== activeTab)
            setOpenTabs(remainingTabs)
            setActiveTab(remainingTabs.length > 0 ? remainingTabs[0].path : null)
            if (remainingTabs.length > 0) {
              setFileContent(remainingTabs[0].content)
              setSelectedFile(remainingTabs[0].path)
            }
            addTerminalLine('info', 'Tab closed')
          }
          break
        case 'toggle':
          setShowTerminal(prev => !prev)
          addTerminalLine('info', 'Terminal ' + (!showTerminal ? 'shown' : 'hidden'))
          break
        case 'tools':
          const toolsResult = await window.electron.tools.listTools()
          if (toolsResult.success && toolsResult.tools) {
            addTerminalLine('output', 'Available Tools:\n' + toolsResult.tools.map((t: any) => '  - ' + t).join('\n'))
          } else {
            addTerminalLine('error', 'Failed to list tools')
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
            addTerminalLine('output', 'Configured Keys: ' + (configured.length ? configured.join(', ') : 'None'))
          } else {
            addTerminalLine('error', 'Usage: api list')
          }
          break
        case 'sys':
          const info = await window.electron.system.getSystemInfo()
          addTerminalLine('output', 
            'System Info:\n' +
            '  OS: ' + info.os.platform + ' ' + info.os.version + '\n' +
            '  CPU: ' + info.cpu.brand + ' (' + info.cpu.cores + ' cores)\n' +
            '  Mem: ' + Math.round(info.memory.total / 1024 / 1024 / 1024) + 'GB Total'
          )
          break
        case 'exec':
          if (args.length < 2) {
            addTerminalLine('error', 'Usage: exec <command> [args...]')
          } else {
            const execCmd = args[1]
            const execArgs = args.slice(2)
            const res = await window.electron.system.executeCommand(execCmd, execArgs)
            addTerminalLine('output', res.success ? res.output : 'Error: ' + res.error)
          }
          break
        default:
          addTerminalLine('error', 'Command not found: ' + commandName)
      }
    } catch (error: any) {
      addTerminalLine('error', 'Error: ' + error.message)
    }
  }, [terminalInput, activeTab, openTabs, showTerminal])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTerminalCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex = historyIndex + 1
        if (newIndex < history.length) {
          setHistoryIndex(newIndex)
          setInput(history[history.length - 1 - newIndex])
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        if (newIndex >= 0) {
          setInput(history[history.length - 1 - newIndex])
        } else {
          setInput('')
        }
      }
    }
  }, [history, historyIndex, handleTerminalCommand])

  const setInput = (value: string) => {
    setTerminalInput(value)
  }

  const handleSidebarResize = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = Math.max(180, Math.min(400, e.clientX))
      setSidebarWidth(newWidth)
    }
  }, [isResizingSidebar])

  const handleTerminalResize = useCallback((e: MouseEvent) => {
    if (isResizingTerminal) {
      const newHeight = Math.max(100, Math.min(400, window.innerHeight - e.clientY))
      setTerminalHeight(newHeight)
    }
  }, [isResizingTerminal])

  useEffect(() => {
    const handleMouseUp = () => {
      setIsResizingSidebar(false)
      setIsResizingTerminal(false)
    }
    
    window.addEventListener('mousemove', handleSidebarResize)
    window.addEventListener('mousemove', handleTerminalResize)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleSidebarResize)
      window.removeEventListener('mousemove', handleTerminalResize)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleSidebarResize, handleTerminalResize])

  const activeTabData = openTabs.find(tab => tab.path === activeTab)

  return (
    <div className="ide-layout">
      <div className="ide-header">
        <div className="ide-header-left">
          {onBack && (
            <button className="ide-back-btn" onClick={onBack}>
              ←
            </button>
          )}
          <span className="ide-project-name">{projectName}</span>
          {projectVersion && <span className="ide-project-version">v{projectVersion}</span>}
        </div>
        <div className="ide-header-center">
          {openTabs.map(tab => (
            <div
              key={tab.path}
              className={`ide-tab ${activeTab === tab.path ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.path)
                setFileContent(tab.content)
                setSelectedFile(tab.path)
              }}
            >
              <span>{tab.name}</span>
              {tab.modified && <span className="tab-modified">•</span>}
              <button 
                className="tab-close" 
                onClick={(e) => closeTab(tab.path, e)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="ide-header-right">
          <button 
            className="ide-toggle-terminal"
            onClick={() => setShowTerminal(prev => !prev)}
          >
            {showTerminal ? '▼' : '▲'}
          </button>
        </div>
      </div>

      <div className="ide-main">
        <div className="ide-sidebar" style={{ width: sidebarWidth }}>
          <div className="ide-sidebar-header">
            <span>EXPLORER</span>
          </div>
          <div className="ide-sidebar-content">
            {fileTree ? (
              <FileTree 
                root={fileTree} 
                onFileSelect={handleFileSelect}
                selectedPath={selectedFile || undefined}
              />
            ) : (
              <div className="ide-loading">...</div>
            )}
          </div>
          <div 
            className="ide-sidebar-resize"
            onMouseDown={() => setIsResizingSidebar(true)}
          />
        </div>

        <div className="ide-content">
          <div className="ide-editor" style={{ height: showTerminal ? `calc(100% - ${terminalHeight}px)` : '100%' }}>
            {openTabs.length > 0 && activeTab ? (
              <CodeEditor
                filePath={activeTab}
                content={fileContent}
                language={activeTabData?.language || 'plaintext'}
                theme="vs-dark"
                onChange={handleContentChange}
                onSave={handleSave}
              />
            ) : (
              <div className="ide-welcome">
                <div className="ide-welcome-text">
                  <span>SELECT A FILE FROM THE EXPLORER</span>
                  <span className="ide-welcome-sub">or use "open &lt;file&gt;" in terminal</span>
                </div>
              </div>
            )}
          </div>

          {showTerminal && (
            <div className="ide-terminal-panel" style={{ height: terminalHeight }}>
              <div 
                className="ide-terminal-resize"
                onMouseDown={() => setIsResizingTerminal(true)}
              />
              <div className="ide-terminal-output" ref={terminalOutputRef}>
                {terminalLines.map((line, i) => (
                  <div 
                    key={i} 
                    className={`terminal-line ${line.type}`}
                  >
                    {line.content}
                  </div>
                ))}
              </div>
              <div className="ide-terminal-input-line">
                <span className="terminal-prompt">➜</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="enter command..."
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default IDELayout
