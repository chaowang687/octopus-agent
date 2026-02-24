import React, { useState, useEffect, useRef } from 'react'
import './Terminal.css'

interface TerminalTab {
  id: string
  name: string
  commands: Array<{
    input: string
    output: string
    timestamp: number
  }>
  cwd: string
}

const Terminal: React.FC = () => {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    {
      id: '1',
      name: 'Terminal 1',
      commands: [],
      cwd: '/Users/wangchao/Desktop/本地化TRAE'
    }
  ])
  const [activeTabId, setActiveTabId] = useState('1')
  const [input, setInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0]

  useEffect(() => {
    // 自动滚动到底部
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [activeTab.commands])

  const handleAddTab = () => {
    const newTab: TerminalTab = {
      id: Date.now().toString(),
      name: `Terminal ${tabs.length + 1}`,
      commands: [],
      cwd: activeTab.cwd
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newTab.id)
  }

  const handleCloseTab = (tabId: string) => {
    if (tabs.length === 1) return
    
    const newTabs = tabs.filter(tab => tab.id !== tabId)
    setTabs(newTabs)
    
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[newTabs.length - 1].id)
    }
  }

  const handleTabSwitch = (tabId: string) => {
    setActiveTabId(tabId)
  }

  const executeCommand = async (command: string) => {
    if (!command.trim()) return

    // 添加到命令历史
    setCommandHistory(prev => [command, ...prev.filter(cmd => cmd !== command)])
    setHistoryIndex(-1)

    // 更新当前标签的命令历史
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        return {
          ...tab,
          commands: [
            ...tab.commands,
            {
              input: command,
              output: '',
              timestamp: Date.now()
            }
          ]
        }
      }
      return tab
    }))

    try {
      // 执行命令
      const result = await window.electron.system.executeCommand(command, [])
      
      // 更新命令输出
      setTabs(prev => prev.map(tab => {
        if (tab.id === activeTabId) {
          const updatedCommands = [...tab.commands]
          const lastCommand = updatedCommands[updatedCommands.length - 1]
          if (lastCommand) {
            lastCommand.output = result.stdout || result.stderr || 'Command executed'
          }
          return {
            ...tab,
            commands: updatedCommands
          }
        }
        return tab
      }))
    } catch (error) {
      // 更新错误输出
      setTabs(prev => prev.map(tab => {
        if (tab.id === activeTabId) {
          const updatedCommands = [...tab.commands]
          const lastCommand = updatedCommands[updatedCommands.length - 1]
          if (lastCommand) {
            lastCommand.output = error instanceof Error ? error.message : 'Command failed'
          }
          return {
            ...tab,
            commands: updatedCommands
          }
        }
        return tab
      }))
    }

    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(input)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setInput('')
      }
    }
  }

  return (
    <div className="terminal-container">
      {/* 终端标签栏 */}
      <div className="terminal-tabs">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`terminal-tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => handleTabSwitch(tab.id)}
          >
            <span className="terminal-tab-name">{tab.name}</span>
            <button
              className="terminal-tab-close"
              onClick={(e) => {
                e.stopPropagation()
                handleCloseTab(tab.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button className="terminal-tab-add" onClick={handleAddTab}>
          +
        </button>
      </div>

      {/* 终端头部 */}
      <div className="terminal-header">
        <div className="terminal-title">终端</div>
        <div className="terminal-controls">
          <div className="terminal-control-btn">⚙️</div>
        </div>
      </div>

      {/* 终端内容 */}
      <div className="terminal-content" ref={terminalRef}>
        <div className="terminal-welcome">
          <div className="terminal-welcome-text">
            <p>Welcome to TRAE Terminal</p>
            <p>Type commands to execute</p>
          </div>
        </div>

        {activeTab.commands.map((cmd, index) => (
          <div key={index} className="terminal-command-block">
            <div className="terminal-line">
              <span className="terminal-prompt">{activeTab.cwd}$</span>
              <span className="terminal-command">{cmd.input}</span>
            </div>
            {cmd.output && (
              <div className="terminal-output">
                {cmd.output.split('\n').map((line, lineIndex) => (
                  <div key={lineIndex} className="terminal-line">
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* 输入行 */}
        <div className="terminal-input-line">
          <span className="terminal-prompt">{activeTab.cwd}$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="terminal-input"
            autoFocus
            placeholder="输入命令..."
          />
        </div>
      </div>
    </div>
  )
}

export default Terminal