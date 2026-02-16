import React, { useState, useEffect } from 'react'
import { chatDataService, ChatSession, Agent } from '../services/ChatDataService'
import CreateAgentModal from './CreateAgentModal'
import CreateGroupModal from './CreateGroupModal'

interface ChatSidebarProps {
  currentSessionId?: string
  onSelectSession: (session: ChatSession) => void
  refreshKey?: number  // 添加刷新键
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ currentSessionId, onSelectSession, refreshKey }) => {
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

  // 当refreshKey变化时刷新会话列表
  useEffect(() => {
    if (refreshKey !== undefined) {
      refreshData()
    }
  }, [refreshKey])

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
    <div className="session-sidebar">
      {/* 顶部搜索栏 */}
      <div className="sidebar-search-container">
        <div className="sidebar-search-input-wrapper">
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>🔍</span>
          <input 
            placeholder="搜索" 
            className="sidebar-search-input"
          />
        </div>
        <button 
          onClick={() => setShowMenu(!showMenu)}
          className="sidebar-add-btn"
        >+</button>
      </div>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} 
            onClick={() => setShowMenu(false)}
          ></div>
          <div style={{
            position: 'absolute',
            top: '50px',
            right: '12px',
            width: '180px',
            backgroundColor: '#ffffff',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100,
            padding: '4px 0',
            overflow: 'hidden'
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
        </>
      )}

      <style>{`
        .menu-item:hover {
          background-color: var(--bg-tertiary);
        }
      `}</style>

      {/* 会话列表 */}
      <div className="sidebar-session-list">
        {sessions.map(session => {
          const display = getSessionDisplay(session)
          const isActive = session.id === currentSessionId
          
          return (
            <div 
              key={session.id}
              onClick={() => onSelectSession(session)}
              className={`sidebar-session-item ${isActive ? 'active' : ''}`}
            >
              {/* 头像 */}
              <div className="session-avatar">
                {Array.isArray(display.avatar) ? (
                  <div className="session-avatar-group">
                    {display.avatar.map((src, i) => (
                      <img key={i} src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ))}
                  </div>
                ) : (
                  <img 
                    src={display.avatar} 
                    alt={display.name}
                  />
                )}
                {session.unread > 0 && (
                  <div className="session-unread-badge">
                    {session.unread}
                  </div>
                )}
              </div>

              {/* 信息 */}
              <div className="session-info">
                <div className="session-header">
                  <span className="session-name">
                    {display.name}
                  </span>
                  <span className="session-time">{session.lastTime}</span>
                </div>
                <div className="session-preview">
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
