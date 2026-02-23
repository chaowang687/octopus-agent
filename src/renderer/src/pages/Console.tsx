import React, { useState, useRef, useEffect } from 'react'
import CodeEditor from '../components/CodeEditor'
import '../components/CodeEditor.css'

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'info'
  content: string
  timestamp: number
}

interface OpenFile {
  path: string
  name: string
  content: string
  language: string
}

const Console: React.FC = () => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<TerminalLine[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const initOutput: TerminalLine[] = [
      { type: 'info', content: 'Agent Coder Console v0.2.0', timestamp: Date.now() },
      { type: 'info', content: 'Type "help" to see available commands.', timestamp: Date.now() },
      { type: 'info', content: '----------------------------------------', timestamp: Date.now() }
    ]
    setOutput(initOutput)
  }, [])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  const addOutput = (type: TerminalLine['type'], content: string) => {
    setOutput(prev => [...prev, { type, content, timestamp: Date.now() }])
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
          'go': 'go', 'sh': 'shell', 'html': 'html'
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
    if (!input.trim()) return

    const cmd = input.trim()
    setHistory(prev => [...prev, cmd])
    setHistoryIndex(-1)
    addOutput('input', '$ ' + cmd)
    setInput('')

    try {
      const args = cmd.split(' ')
      const commandName = args[0]

      switch (commandName) {
        case 'help':
          addOutput('output', 
            'Available commands:\n' +
            '  help              - Show this help message\n' +
            '  clear             - Clear terminal\n' +
            '  open <file>       - Open a file in editor\n' +
            '  ls [dir]         - List directory contents\n' +
            '  close             - Close editor\n' +
            '  tools             - List available tools\n' +
            '  api               - Manage API keys (list)\n' +
            '  sys               - System info\n' +
            '  exec <cmd>        - Execute shell command'
          )
          break
        case 'clear':
          setOutput([])
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
            const res = await window.electron.system.executeCommand(execCmd, execArgs)
            addOutput('output', res.success ? res.output : 'Error: ' + res.error)
          }
          break
        default:
          addOutput('error', 'Command not found: ' + commandName)
      }
    } catch (error: any) {
      addOutput('error', 'Error: ' + error.message)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleExecuteCommand()
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
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
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
      backgroundColor: '#0a0a0a'
    }}>
      {showEditor && activeFileData && (
        <div style={{ 
          height: '50%', 
          borderBottom: '1px solid #1a1a1a'
        }}>
          {openFiles.length > 1 && (
            <div style={{ 
              display: 'flex', 
              backgroundColor: '#0f0f0f', 
              borderBottom: '1px solid #1a1a1a',
              padding: '4px 8px',
              gap: '4px'
            }}>
              {openFiles.map(file => (
                <div
                  key={file.path}
                  onClick={() => setActiveFile(file.path)}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: activeFile === file.path ? '#0a0a0a' : '#0f0f0f',
                    border: activeFile === file.path ? '1px solid #1a1a1a' : 'none',
                    borderRadius: '4px 4px 0 0',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: activeFile === file.path ? '#9ca3af' : '#4b5563',
                    fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace"
                  }}
                >
                  {file.name}
                </div>
              ))}
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
          {output.map((line, i) => (
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
          backgroundColor: '#0f0f0f'
        }}>
          <span style={{ 
            color: '#22c55e', 
            marginRight: '8px',
            fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace",
            fontSize: '13px'
          }}>
            ➜
          </span>
          <input
            id="console-input"
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#fff',
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
