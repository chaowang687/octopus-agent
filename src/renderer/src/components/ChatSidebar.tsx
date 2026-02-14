import React, { useState, useEffect } from 'react'
import { chatDataService, ChatSession, Agent } from '../services/ChatDataService'
import CreateAgentModal from './CreateAgentModal'
import CreateGroupModal from './CreateGroupModal'

interface ChatSidebarProps {
  currentSessionId?: string
  onSelectSession: (session: ChatSession) => void
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ currentSessionId, onSelectSession }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [showCreateAgent, setShowCreateAgent] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])

  const refreshData = () => {
    setSessions([...chatDataService.getSessions()])
    setAgents(chatDataService.getAgents())
  }

  useEffect(() => {
    refreshData()
    // Auto-select first session if none selected
    const list = chatDataService.getSessions()
    if (list.length > 0 && !currentSessionId) {
      onSelectSession(list[0])
    }
  }, [])

  // Helper to get session avatar/name
  const getSessionDisplay = (session: ChatSession) => {
    if (session.type === 'group') {
      // Generate group avatar from members
      const memberAvatars = session.members.slice(0, 4).map(mid => {
        const agent = agents.find(a => a.id === mid)
        return agent?.avatar || ''
      }).filter(Boolean)
      
      return {
        name: session.name,
        avatar: session.members.length > 1 ? memberAvatars : (memberAvatars[0] || ''),
        isGroup: true
      }
    } else {
      // Direct chat: find the other participant (usually the agent)
      const agentId = session.members[0]
      const agent = agents.find(a => a.id === agentId)
      return {
        name: agent?.name || session.name,
        avatar: agent?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${session.name}`,
        isGroup: false
      }
    }
  }

  const handleCreateNewChat = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId)
    if (!agent) return
    // Check if session exists
    const existing = sessions.find(s => s.type === 'direct' && s.members.includes(agentId))
    if (existing) {
      onSelectSession(existing)
    } else {
      const newSession = chatDataService.createSession(agent.name, [agentId], 'direct')
      refreshData()
      onSelectSession(newSession)
    }
    setShowMenu(false)
  }

  return (
    <div style={{
      width: '280px',
      height: '100%',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* 顶部搜索栏 */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{
          flex: 1,
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: '4px',
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>🔍</span>
          <input 
            placeholder="搜索" 
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '12px',
              width: '100%',
              color: 'var(--text-primary)'
            }}
          />
        </div>
        <button 
          onClick={() => setShowMenu(!showMenu)}
          style={{
            width: '24px',
            height: '24px',
            background: 'var(--bg-tertiary)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)'
          }}
        >+</button>
      </div>

      {/* Dropdown Menu */}
      {showMenu && (
        <div style={{
          position: 'absolute',
          top: '48px',
          right: '12px',
          width: '160px',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 100,
          padding: '4px 0'
        }}>
          <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-tertiary)' }}>发起对话</div>
          {agents.map(agent => (
            <div 
              key={agent.id}
              onClick={() => handleCreateNewChat(agent.id)}
              className="menu-item"
              style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
            >
              <img src={agent.avatar} style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
              {agent.name}
            </div>
          ))}
          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }}></div>
          <div 
            onClick={() => { setShowCreateAgent(true); setShowMenu(false) }}
            className="menu-item"
            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px' }}
          >
            👤 新建 AI 角色
          </div>
          <div 
            onClick={() => { setShowCreateGroup(true); setShowMenu(false) }}
            className="menu-item"
            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px' }}
          >
            👥 创建协作小组
          </div>
        </div>
      )}

      <style>{`
        .menu-item:hover {
          background-color: var(--bg-tertiary);
        }
      `}</style>

      {/* 会话列表 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {sessions.map(session => {
          const display = getSessionDisplay(session)
          const isActive = session.id === currentSessionId
          
          return (
            <div 
              key={session.id}
              onClick={() => onSelectSession(session)}
              style={{
                padding: '12px',
                display: 'flex',
                gap: '10px',
                cursor: 'pointer',
                backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {/* 头像 */}
              <div style={{ position: 'relative' }}>
                {Array.isArray(display.avatar) ? (
                  <div style={{ 
                    width: '40px', height: '40px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '2px', gap: '1px'
                  }}>
                    {display.avatar.map((src, i) => (
                      <img key={i} src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ))}
                  </div>
                ) : (
                  <img 
                    src={display.avatar} 
                    alt={display.name}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-tertiary)',
                      objectFit: 'cover'
                    }} 
                  />
                )}
                {session.unread > 0 && (
                  <div style={{
                    position: 'absolute', top: '-5px', right: '-5px',
                    backgroundColor: '#ff3b30', color: 'white', fontSize: '10px', fontWeight: 'bold',
                    minWidth: '16px', height: '16px', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                    border: '1px solid var(--bg-secondary)'
                  }}>
                    {session.unread}
                  </div>
                )}
              </div>

              {/* 信息 */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ 
                    fontSize: '14px', 
                    fontWeight: 500, 
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {display.name}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{session.lastTime}</span>
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {session.lastMessage || (display.isGroup ? '群组已创建' : '开始对话...')}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showCreateAgent && <CreateAgentModal onClose={() => setShowCreateAgent(false)} onCreated={refreshData} />}
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} onCreated={refreshData} />}
    </div>
  )
}

export default ChatSidebar
