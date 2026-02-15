import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MCPMarketplaceModal from '../components/MCPMarketplaceModal'

const SoloHub: React.FC = () => {
  const [activeAgent, setActiveAgent] = useState<'coder' | 'builder'>('coder')
  const [isMCPModalOpen, setIsMCPModalOpen] = useState(false)
  const [enabledTools, setEnabledTools] = useState({
    search: true,
    read: true,
    edit: true,
    terminal: true,
    preview: true,
    webSearch: true
  })
  const navigate = useNavigate()

  useEffect(() => {
    // @ts-ignore
    if (window.electron && window.electron.ipcRenderer) {
      // @ts-ignore
      window.electron.ipcRenderer.invoke('agent:getToolState').then((state: any) => {
        if (state) {
          setEnabledTools(state)
        }
      }).catch((err: any) => console.error('Failed to load tool state:', err))
    }
  }, [])

  const toggleTool = (tool: keyof typeof enabledTools) => {
    setEnabledTools(prev => ({
      ...prev,
      [tool]: !prev[tool]
    }))
  }

  const handleSave = async () => {
    try {
      // @ts-ignore
      if (window.electron && window.electron.ipcRenderer) {
        // @ts-ignore
        window.electron.ipcRenderer.invoke('agent:updateToolState', enabledTools)
        alert('配置已保存，智能体能力已更新')
      }
    } catch (e) {
      console.error(e)
      alert('保存失败')
    }
  }

  const handleCancel = () => {
    // Reload state
    // @ts-ignore
    if (window.electron && window.electron.ipcRenderer) {
        // @ts-ignore
        window.electron.ipcRenderer.invoke('agent:getToolState').then((state: any) => {
          if (state) {
            setEnabledTools(state)
          }
        })
      }
  }

  const handleStartSoloCoder = async () => {
    try {
      const instruction = window.prompt('用自然语言描述你想让 SOLO Coder 完成的任务')
      if (!instruction || !instruction.trim()) return
      const api = (window as any).electron?.task
      if (!api?.execute) {
        alert('任务执行引擎不可用')
        return
      }
      await api.execute(instruction.trim(), {
        model: 'deepseek',
        agentId: 'agent-solo-coder',
        sessionId: 'solo-coder-session'
      })
      navigate('/chat')
    } catch (e) {
      console.error(e)
      alert('启动 SOLO Coder 任务失败')
    }
  }

  const handleStartSoloBuilder = async () => {
    try {
      const instruction = window.prompt('用自然语言描述你要构建的 Web 应用')
      if (!instruction || !instruction.trim()) return
      const api = (window as any).electron?.task
      if (!api?.execute) {
        alert('任务执行引擎不可用')
        return
      }
      await api.execute(instruction.trim(), {
        model: 'openai',
        agentId: 'agent-solo-builder',
        sessionId: 'solo-builder-session'
      })
      navigate('/chat')
    } catch (e) {
      console.error(e)
      alert('启动 SOLO Builder 任务失败')
    }
  }

  return (
    <div style={{ padding: '24px', color: 'var(--text-primary)', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>智能体 /</span> SOLO Hub
        </h1>
      </div>

      {/* Agent Selection Section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>选择智能体</h2>
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* SOLO Coder Card */}
          <div 
            onClick={() => setActiveAgent('coder')}
            style={{
              flex: 1,
              backgroundColor: activeAgent === 'coder' ? 'rgba(124, 58, 237, 0.1)' : 'var(--bg-secondary)',
              border: `1px solid ${activeAgent === 'coder' ? '#7c3aed' : 'var(--border-color)'}`,
              borderRadius: '8px',
              padding: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ 
                width: '32px', height: '32px', backgroundColor: '#e8ddff', borderRadius: '6px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' 
              }}>
                💻
              </div>
              <div style={{ fontWeight: 600 }}>SOLO Coder</div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              面向复杂项目开发的智能体。高效完成从需求迭代到架构重构的全流程开发工作。
            </div>
          </div>

          {/* SOLO Builder Card */}
          <div 
            onClick={() => setActiveAgent('builder')}
            style={{
              flex: 1,
              backgroundColor: activeAgent === 'builder' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
              border: `1px solid ${activeAgent === 'builder' ? '#10b981' : 'var(--border-color)'}`,
              borderRadius: '8px',
              padding: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ 
                width: '32px', height: '32px', backgroundColor: '#d1fae5', borderRadius: '6px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' 
              }}>
                🏗️
              </div>
              <div style={{ fontWeight: 600 }}>SOLO Builder</div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              快速构建专业且功能完善的 Web 应用。从自然语言需求生成 PRD、代码并提供预览。
            </div>
          </div>
        </div>
      </div>

      {/* Agent Specific Actions */}
      {activeAgent === 'coder' && (
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '16px'
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>用 SOLO Coder 开干当前项目</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '500px' }}>
              描述你在当前代码仓库中的任务需求，SOLO Coder 将自动规划步骤、调用文件和终端工具并完成实现。
            </p>
            <button
              onClick={handleStartSoloCoder}
              style={{
                padding: '10px 24px',
                backgroundColor: '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>🚀</span> 用 SOLO Coder 开干
            </button>
          </div>
        </div>
      )}
      {activeAgent === 'builder' && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ 
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '8px', 
            border: '1px solid var(--border-color)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>开始构建新的 Web 应用</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '500px' }}>
              只需描述你的想法，SOLO Builder 将自动规划、生成 PRD、编写代码并启动预览。
            </p>
            <button
              onClick={handleStartSoloBuilder}
              style={{
                padding: '10px 24px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>✨</span> 启动 Builder 向导
            </button>
          </div>
        </div>
      )}

      {/* Tools Section (Shared) */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>能力配置 ({activeAgent === 'coder' ? 'Coder' : 'Builder'})</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'help' }}>ⓘ</span>
        </div>

        {/* MCP Servers */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>工具 - MCP</h3>
          <div style={{ 
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '8px', 
            border: '1px solid var(--border-color)',
            padding: '20px'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>什么是 MCP Servers?</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
              Model Context Protocol (MCP) 允许大语言模型访问自定义工具和服务。MCP Servers 是支持该协议的服务，提供工具和功能来扩展智能体的能力。添加后，智能体会自动调用合适的工具完成任务。
            </p>
            <button 
              onClick={() => setIsMCPModalOpen(true)}
              style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              color: 'var(--text-primary)'
            }}>
              <span>+</span> 添加 MCP Servers
            </button>
          </div>
        </div>

        {/* Built-in Tools */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <input type="checkbox" checked readOnly style={{ width: '16px', height: '16px', opacity: 0.5 }} />
            <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>工具 - 内置</h3>
          </div>

          <div style={{ 
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '8px', 
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            {[
              { id: 'read', icon: '👓', name: 'Read', desc: 'Retrieve and view files' },
              { id: 'edit', icon: '📄', name: 'Edit', desc: 'Add, delete and edit files' },
              { id: 'terminal', icon: '💻', name: 'Terminal', desc: 'Run commands in the terminal and get t...' },
              { id: 'preview', icon: '👁️', name: 'Preview', desc: 'Provide a preview entry after generating...' },
              { id: 'webSearch', icon: '🌐', name: 'Web search', desc: 'Search for web content related to user t...' }
            ].map((tool, index) => (
              <div key={tool.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderBottom: index < 4 ? '1px solid var(--border-color)' : 'none'
              }}>
                <input 
                  type="checkbox" 
                  checked={enabledTools[tool.id as keyof typeof enabledTools]} 
                  onChange={() => toggleTool(tool.id as keyof typeof enabledTools)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <div style={{ 
                  width: '24px', 
                  height: '24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '16px'
                }}>
                  {tool.icon}
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px' }}>{tool.name}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{tool.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CUE Features Section (New) */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>CUE 智能编程助手</h2>
        <div style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}>
          {[
            { name: '智能代码补全', desc: '基于上下文的实时代码建议', enabled: true },
            { name: '多行修改', desc: '一次性应用跨越多行的代码变更', enabled: true },
            { name: '智能导入', desc: '自动检测并导入缺失的依赖', enabled: true },
            { name: '智能重命名', desc: '上下文感知的变量和函数重命名', enabled: true }
          ].map((feature, idx) => (
            <div key={idx} style={{
              padding: '12px 16px',
              borderBottom: idx < 3 ? '1px solid var(--border-color)' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{feature.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{feature.desc}</div>
              </div>
              <div style={{
                width: '36px', height: '20px', backgroundColor: feature.enabled ? '#3b82f6' : '#ccc',
                borderRadius: '10px', position: 'relative', cursor: 'pointer'
              }}>
                <div style={{
                  width: '16px', height: '16px', backgroundColor: 'white', borderRadius: '50%',
                  position: 'absolute', top: '2px', left: feature.enabled ? '18px' : '2px', transition: 'left 0.2s'
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '40px' }}>
        <button 
          onClick={handleSave}
          style={{
          padding: '8px 32px',
          backgroundColor: 'white',
          color: 'black',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer'
        }}>
          保存
        </button>
        <button 
          onClick={handleCancel}
          style={{
          padding: '8px 32px',
          backgroundColor: '#333',
          color: 'white',
          border: '1px solid #444',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer'
        }}>
          取消
        </button>
      </div>

      <MCPMarketplaceModal 
        isOpen={isMCPModalOpen} 
        onClose={() => setIsMCPModalOpen(false)} 
      />
    </div>
  )
}

export default SoloHub
