import React, { useState, useEffect } from 'react'

const ChatWorkflow: React.FC = () => {
  const [todoListIDE, setTodoListIDE] = useState(true)
  const [todoListSOLO, setTodoListSOLO] = useState(true)
  const [autoCollapse, setAutoCollapse] = useState(true)
  const [autoFixIDE, setAutoFixIDE] = useState(true)
  const [autoFixSOLO, setAutoFixSOLO] = useState(false)
  const [codeReviewIDE, setCodeReviewIDE] = useState('all')
  const [codeReviewSOLO, setCodeReviewSOLO] = useState('all')
  const [jumpToNext, setJumpToNext] = useState(true)
  const [autoRunMCPIDE, setAutoRunMCPIDE] = useState(false)
  const [autoRunMCPSOLO, setAutoRunMCPSOLO] = useState(true)
  const [commandModeIDE, setCommandModeIDE] = useState('sandbox')
  const [commandModeSOLO, setCommandModeSOLO] = useState('sandbox')
  const [whitelistCommand, setWhitelistCommand] = useState('')
  const [whitelist, setWhitelist] = useState<string[]>([])
  const [notifyBanner, setNotifyBanner] = useState(true)
  const [notifySound, setNotifySound] = useState(true)

  // Load settings on mount
  useEffect(() => {
    if (window.electron && window.electron.agent) {
      window.electron.agent.getWorkflowSettings().then((settings: any) => {
        if (settings) {
          if (settings.todoList) {
            setTodoListIDE(settings.todoList.ide)
            setTodoListSOLO(settings.todoList.solo)
          }
          if (settings.autoCollapse) {
            setAutoCollapse(settings.autoCollapse.solo)
          }
          if (settings.autoFix) {
            setAutoFixIDE(settings.autoFix.ide)
            setAutoFixSOLO(settings.autoFix.solo)
          }
          if (settings.codeReview) {
            setCodeReviewIDE(settings.codeReview.ide)
            setCodeReviewSOLO(settings.codeReview.solo)
            setJumpToNext(settings.codeReview.jumpToNext)
          }
          if (settings.autoRunMCP) {
            setAutoRunMCPIDE(settings.autoRunMCP.ide)
            setAutoRunMCPSOLO(settings.autoRunMCP.solo)
          }
          if (settings.commandMode) {
            setCommandModeIDE(settings.commandMode.ide)
            setCommandModeSOLO(settings.commandMode.solo)
            setWhitelist(settings.commandMode.whitelist || [])
          }
          if (settings.notifications) {
            setNotifyBanner(settings.notifications.banner)
            setNotifySound(settings.notifications.sound)
          }
        }
      }).catch((err: any) => console.error('Failed to load workflow settings:', err))
    }
  }, [])

  // Save settings when any state changes
  useEffect(() => {
    const settings = {
      todoList: {
        ide: todoListIDE,
        solo: todoListSOLO
      },
      autoCollapse: {
        solo: autoCollapse
      },
      autoFix: {
        ide: autoFixIDE,
        solo: autoFixSOLO
      },
      codeReview: {
        ide: codeReviewIDE,
        solo: codeReviewSOLO,
        jumpToNext: jumpToNext
      },
      autoRunMCP: {
        ide: autoRunMCPIDE,
        solo: autoRunMCPSOLO
      },
      commandMode: {
        ide: commandModeIDE,
        solo: commandModeSOLO,
        whitelist: whitelist
      },
      notifications: {
        banner: notifyBanner,
        sound: notifySound
      }
    }

    // Debounce save to avoid too many IPC calls
    const timer = setTimeout(() => {
      if (window.electron && window.electron.agent) {
        window.electron.agent.updateWorkflowSettings(settings)
          .catch((err: any) => console.error('Failed to save workflow settings:', err))
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [
    todoListIDE, todoListSOLO, 
    autoCollapse, 
    autoFixIDE, autoFixSOLO, 
    codeReviewIDE, codeReviewSOLO, jumpToNext, 
    autoRunMCPIDE, autoRunMCPSOLO,
    commandModeIDE, commandModeSOLO, whitelist,
    notifyBanner, notifySound
  ])

  const handleAddWhitelist = () => {
    if (whitelistCommand.trim() && !whitelist.includes(whitelistCommand.trim())) {
      setWhitelist([...whitelist, whitelistCommand.trim()])
      setWhitelistCommand('')
    }
  }

  const handleRemoveWhitelist = (cmd: string) => {
    setWhitelist(whitelist.filter(c => c !== cmd))
  }

  return (
    <div style={{ padding: '24px', color: 'var(--text-primary)', height: '100%', overflowY: 'auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>对话流</h1>

      {/* 待办清单 Section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>待办清单</h2>
        
        <div style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}>
          {/* 待办清单 Item */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>待办清单</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>允许智能体使用待办清单来跟踪任务进度</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '100px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>IDE</span>
                <ToggleSwitch checked={todoListIDE} onChange={setTodoListIDE} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>SOLO</span>
                <ToggleSwitch checked={todoListSOLO} onChange={setTodoListSOLO} />
              </div>
            </div>
          </div>

          {/* 对话流节点自动折叠 Item */}
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>对话流节点自动折叠</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'help' }}>ⓘ</span>
                <span style={{ fontSize: '10px', backgroundColor: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71', padding: '2px 6px', borderRadius: '4px' }}>SOLO Only</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>启用后，已完成任务的对话将自动折叠并生成摘要，可一键展开查看</div>
            </div>
            <ToggleSwitch checked={autoCollapse} onChange={setAutoCollapse} />
          </div>
        </div>
      </div>

      {/* 自动修复代码规范问题 Section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>自动修复代码规范问题</h2>
        
        <div style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          padding: '16px 20px',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>自动修复</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>自动修复对话过程中的识别到的代码问题</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '100px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>IDE</span>
              <ToggleSwitch checked={autoFixIDE} onChange={setAutoFixIDE} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>SOLO</span>
              <ToggleSwitch checked={autoFixSOLO} onChange={setAutoFixSOLO} />
            </div>
          </div>
        </div>
      </div>

      {/* 代码审查 Section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>代码审查</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          智能体生成的代码会自动写入磁盘。审查代码时，你可以决定是否保留或撤销这些改动。
        </p>
        
        <div style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}>
          {/* IDE Dropdown */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>IDE</span>
            <select 
              value={codeReviewIDE}
              onChange={(e) => setCodeReviewIDE(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '13px',
                outline: 'none',
                minWidth: '160px'
              }}
            >
              <option value="all">审查所有变更</option>
              <option value="none">不审查</option>
            </select>
          </div>

          {/* SOLO Dropdown */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>SOLO</span>
            <select 
              value={codeReviewSOLO}
              onChange={(e) => setCodeReviewSOLO(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '13px',
                outline: 'none',
                minWidth: '160px'
              }}
            >
              <option value="all">审查所有变更</option>
              <option value="none">不审查</option>
            </select>
          </div>

          {/* 审查后跳转 Item */}
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>审查后跳转到下一处变更</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>保留或撤销变更后，自动跳转到文件内的下一处变更</div>
            </div>
            <ToggleSwitch checked={jumpToNext} onChange={setJumpToNext} />
          </div>
        </div>
      </div>

      {/* 自动运行 Section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>自动运行</h2>
        
        <div style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          padding: '16px 20px',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>自动运行MCP</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>使用智能体时，自动运行MCP工具</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '100px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>IDE</span>
              <ToggleSwitch checked={autoRunMCPIDE} onChange={setAutoRunMCPIDE} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>SOLO</span>
              <ToggleSwitch checked={autoRunMCPSOLO} onChange={setAutoRunMCPSOLO} />
            </div>
          </div>
        </div>
      </div>

      {/* 命令运行方式 Section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>命令运行方式</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '2px 4px', borderRadius: '4px' }}>沙箱运行（支持白名单）</span>：命令在安全沙箱中自动执行，根据系统权限进行限制；白名单命令可以绕过沙箱直接执行。
        </p>
        
        <div style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}>
          {/* IDE Dropdown */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>IDE</span>
            <select 
              value={commandModeIDE}
              onChange={(e) => setCommandModeIDE(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '13px',
                outline: 'none',
                minWidth: '160px'
              }}
            >
              <option value="sandbox">沙箱运行 (推荐)</option>
              <option value="direct">直接运行 (慎用)</option>
              <option value="ask">每次询问</option>
            </select>
          </div>

          {/* SOLO Dropdown */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>SOLO</span>
            <select 
              value={commandModeSOLO}
              onChange={(e) => setCommandModeSOLO(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '13px',
                outline: 'none',
                minWidth: '160px'
              }}
            >
              <option value="sandbox">沙箱运行 (推荐)</option>
              <option value="direct">直接运行 (慎用)</option>
              <option value="ask">每次询问</option>
            </select>
          </div>

          {/* 白名单管理 */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>白名单作用于</span>
              <span style={{ fontSize: '12px', backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>IDE</span>
              <span style={{ fontSize: '12px', backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>SOLO</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'help' }}>ⓘ</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input 
                value={whitelistCommand}
                onChange={(e) => setWhitelistCommand(e.target.value)}
                placeholder="请输入命令"
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWhitelist()}
              />
              <button 
                onClick={handleAddWhitelist}
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '0 12px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                +
              </button>
            </div>

            {whitelist.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {whitelist.map((cmd, idx) => (
                  <div key={idx} style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <span>{cmd}</span>
                    <span 
                      onClick={() => handleRemoveWhitelist(cmd)}
                      style={{ cursor: 'pointer', opacity: 0.6 }}
                    >✕</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 任务状态通知 Section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>任务状态通知</h2>
        
        <div style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>允许在任务完成或失败时接收通知</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                允许在任务完成或失败时接收通知 请在 Mac 的系统设置 &gt; 通知中开启通知，以便及时收到提醒
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '100px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>横幅</span>
                <ToggleSwitch checked={notifyBanner} onChange={setNotifyBanner} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>声音</span>
                <ToggleSwitch checked={notifySound} onChange={setNotifySound} />
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
  <div 
    onClick={() => onChange(!checked)}
    style={{
      width: '40px',
      height: '20px',
      backgroundColor: checked ? '#2ecc71' : '#4a4a4a',
      borderRadius: '10px',
      position: 'relative',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    }}
  >
    <div style={{
      width: '16px',
      height: '16px',
      backgroundColor: 'white',
      borderRadius: '50%',
      position: 'absolute',
      top: '2px',
      left: checked ? '22px' : '2px',
      transition: 'left 0.2s',
      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
    }} />
  </div>
)

export default ChatWorkflow