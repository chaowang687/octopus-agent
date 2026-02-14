import React, { useState, useEffect } from 'react'

interface Tool {
  id: string
  name: string
  description: string
  available: boolean
  version: string | null
  path: string | null
}

const Tools: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [configModal, setConfigModal] = useState<{
    open: boolean
    toolId: string | null
    detecting: boolean
    detectResult?: string
  }>({
    open: false, 
    toolId: null, 
    detecting: false 
  })
  const [customPath, setCustomPath] = useState('')

  const fetchTools = async () => {
    try {
      const toolsList = await window.electron.tools.detectTools()
      setTools(toolsList)
    } catch (error) {
      // Fallback for demo / error handling
      console.error('Failed to detect tools:', error)
      const defaultTools = [
        {
          id: 'vscode',
          name: 'VS Code',
          description: 'Visual Studio Code编辑器',
          available: false,
          version: '',
          path: ''
        },
        {
          id: 'unity',
          name: 'Unity',
          description: 'Unity游戏引擎',
          available: false,
          version: '',
          path: ''
        },
        {
      id: 'sourcetree',
      name: 'SourceTree',
      description: 'Git GUI 客户端',
      available: false,
      version: '',
      path: ''
    }
      ]
      setTools(defaultTools)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTools()
  }, [])

  const handleOpenPath = async (toolId: string, toolPath: string) => {
    try {
      await window.electron.tools.openPath(toolPath, toolId)
    } catch (error) {
      console.error(error)
    }
  }

  const handleConfigure = async (toolId: string) => {
    setConfigModal({ open: true, toolId, detecting: true, detectResult: '' })
    setCustomPath('')

    try {
      // Auto detect
      const result = await window.electron.tools.findPath(toolId)
      
      if (result.success && result.path) {
        setCustomPath(result.path)
        setConfigModal(prev => ({ 
          ...prev, 
          detecting: false,
          detectResult: 'success' 
        }))
      } else {
        setConfigModal(prev => ({ 
          ...prev, 
          detecting: false,
          detectResult: 'failed'
        }))
      }
    } catch (error) {
      console.error(error)
      setConfigModal(prev => ({ 
        ...prev, 
        detecting: false,
        detectResult: 'failed'
      }))
    }
  }

  const handleSaveConfig = async () => {
    if (!configModal.toolId || !customPath) return
    try {
      await window.electron.tools.configureTool(configModal.toolId, customPath)
      await fetchTools()
      setConfigModal({ open: false, toolId: null, detecting: false })
    } catch (error) {
      console.error(error)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-secondary)'
      }}>
        加载开发工具...
      </div>
    )
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>开发工具</h2>
        <p style={{ color: 'var(--text-secondary)' }}>管理您的本地开发环境集成。</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {tools.map(tool => (
          <div key={tool.id} style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '24px',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{tool.name}</h3>
              <span style={{
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '999px',
                backgroundColor: tool.available ? 'var(--success-bg, #e6f4ea)' : 'var(--error-bg, #fce8e6)',
                color: tool.available ? 'var(--success-text, #1e8e3e)' : 'var(--error-text, #d93025)',
                fontWeight: 500
              }}>
                {tool.available ? '已就绪' : '未找到'}
              </span>
            </div>
            
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', flex: 1 }}>
              {tool.description}
            </p>

            {tool.available && tool.path && (
              <div style={{ 
                fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace',
                backgroundColor: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }} title={tool.path}>
                {tool.path}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              {tool.available ? (
                <button 
                  className="btn-primary"
                  style={{ 
                    flex: 1, padding: '8px', borderRadius: '6px', border: 'none',
                    cursor: 'pointer', backgroundColor: 'var(--accent-color)', color: 'white'
                  }}
                  onClick={() => handleOpenPath(tool.id, tool.path || '')}
                >
                  启动
                </button>
              ) : (
                <button 
                  className="btn-secondary"
                  style={{ 
                    flex: 1, padding: '8px', borderRadius: '6px', 
                    border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                    cursor: 'pointer', color: 'var(--text-primary)'
                  }}
                  onClick={() => handleConfigure(tool.id)}
                >
                  我已安装
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {configModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)', 
            padding: '32px', 
            borderRadius: '16px',
            width: '480px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>
              配置 {configModal.toolId === 'vscode' ? 'VS Code' : configModal.toolId === 'unity' ? 'Unity' : configModal.toolId}
            </h3>
            
            {configModal.detecting ? (
              <div style={{ 
                padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                color: 'var(--text-secondary)'
              }}>
                <div className="spinner" style={{ 
                  width: '24px', height: '24px', 
                  border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', 
                  borderRadius: '50%', animation: 'spin 1s linear infinite'
                }} />
                <div>正在自动检测安装位置...</div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  {configModal.detectResult === 'success' 
                    ? '✅ 已自动检测到安装路径，请确认保存。' 
                    : '⚠️ 未能自动检测到应用，请输入应用程序的绝对路径。'}
                </p>
                
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder={configModal.toolId === 'unity' ? '/Applications/Unity/Hub/Editor/.../Unity.app' : '/Applications/App.app'}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '24px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                  autoFocus={configModal.detectResult !== 'success'}
                />
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => setConfigModal({open: false, toolId: null, detecting: false})}
                    style={{
                      padding: '8px 16px', borderRadius: '6px', 
                      border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                      cursor: 'pointer', color: 'var(--text-primary)'
                    }}
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleSaveConfig}
                    disabled={!customPath.trim()}
                    style={{
                      padding: '8px 16px', borderRadius: '6px', 
                      border: 'none', backgroundColor: 'var(--accent-color)', color: 'white',
                      cursor: 'pointer', opacity: !customPath.trim() ? 0.5 : 1
                    }}
                  >
                    保存
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default Tools