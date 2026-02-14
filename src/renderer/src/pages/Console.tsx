import React, { useState, useRef, useEffect } from 'react'

const Console: React.FC = () => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<string[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const initOutput = [
      'Agent Coder Console v0.1.0',
      'Type "help" to see available commands.',
      '----------------------------------------'
    ]
    setOutput(initOutput)
  }, [])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        setInput(history[history.length - 1 - newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setInput('')
      }
    }
  }

  const handleExecuteCommand = async () => {
    if (!input.trim()) return

    const cmd = input.trim()
    setHistory(prev => [...prev, cmd])
    setHistoryIndex(-1)
    setOutput(prev => [...prev, `$ ${cmd}`])
    setInput('')

    try {
      const args = cmd.split(' ')
      const commandName = args[0]
      let result = ''

      switch (commandName) {
        case 'help':
          result = `
Available commands:
  help        - Show this help message
  clear       - Clear terminal
  tools       - List available tools
  api         - Manage API keys (list)
  sys         - System info
  exec <cmd>  - Execute shell command
`
          break
        case 'clear':
          setOutput([])
          return
        case 'tools':
          const tools = await window.electron.tools.listTools()
          result = `Available Tools:\n${tools.map(t => `  - ${t}`).join('\n')}`
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
            result = `Configured Keys: ${configured.length ? configured.join(', ') : 'None'}`
          } else {
            result = 'Usage: api list'
          }
          break
        case 'sys':
          const info = await window.electron.system.getSystemInfo()
          result = `System Info:
  OS: ${info.os.platform} ${info.os.version}
  CPU: ${info.cpu.brand} (${info.cpu.cores} cores)
  Mem: ${Math.round(info.memory.total / 1024 / 1024 / 1024)}GB Total`
          break
        case 'exec':
          if (args.length < 2) {
            result = 'Usage: exec <command> [args...]'
          } else {
            const execCmd = args[1]
            const execArgs = args.slice(2)
            const res = await window.electron.system.executeCommand(execCmd, execArgs)
            result = res.success ? res.output : `Error: ${res.error}`
          }
          break
        default:
          result = `Command not found: ${commandName}`
      }
      
      if (result) {
        setOutput(prev => [...prev, result])
      }
    } catch (error: any) {
      setOutput(prev => [...prev, `Error: ${error.message}`])
    }
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      padding: '20px',
      backgroundColor: 'var(--bg-primary)' 
    }}>
      <div style={{ 
        flex: 1, 
        backgroundColor: '#1e1e1e', 
        borderRadius: '12px', 
        padding: '20px',
        color: '#d4d4d4',
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: '14px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-md)'
      }} onClick={() => document.getElementById('console-input')?.focus()}>
        <div ref={outputRef} style={{ flex: 1 }}>
          {output.map((line, i) => (
            <div key={i} style={{ whiteSpace: 'pre-wrap', marginBottom: '4px', lineHeight: '1.5' }}>
              {line}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
          <span style={{ color: '#4caf50', marginRight: '8px' }}>➜</span>
          <span style={{ color: '#00bcd4', marginRight: '8px' }}>~</span>
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
              fontFamily: 'inherit',
              fontSize: 'inherit'
            }}
            autoFocus
          />
        </div>
      </div>
    </div>
  )
}

export default Console
