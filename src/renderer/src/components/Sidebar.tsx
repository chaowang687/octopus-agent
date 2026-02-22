import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'

const Sidebar: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<'ide' | 'solo'>('ide')

  useEffect(() => {
    if (window.electron && window.electron.projectManager) {
      window.electron.projectManager.getMode().then((res: any) => {
        if (res.success && res.mode) {
          setCurrentMode(res.mode)
        }
      })
    }
  }, [])

  const toggleMode = () => {
    const newMode = currentMode === 'ide' ? 'solo' : 'ide'
    setCurrentMode(newMode)
    if (window.electron && window.electron.projectManager) {
      window.electron.projectManager.setMode(newMode)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-avatar-container">
        <div className="sidebar-avatar">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
        </div>
      </div>
      
      <nav className="sidebar-nav-container">
        <ul className="sidebar-nav">
          <li>
            <NavLink to="/" className="sidebar-nav-link" end title="主页">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/chat" className="sidebar-nav-link" title="AI 对话">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/chat-workflow" className="sidebar-nav-link" title="对话流">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/projects" className="sidebar-nav-link" title="项目管理">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/resource-allocation" className="sidebar-nav-link" title="资源分配优化">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/tools" className="sidebar-nav-link" title="开发工具">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/api" className="sidebar-nav-link" title="API 管理">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/console" className="sidebar-nav-link" title="控制台">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/plugins" className="sidebar-nav-link" title="插件管理">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/gallery" className="sidebar-nav-link" title="图库">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <path d="M21 15l-5-5L5 21"></path>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/solocoder" className="sidebar-nav-link" title="SOLO Hub">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/multimodal" className="sidebar-nav-link" title="多模态工具">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="4"></circle>
                <line x1="21.17" y1="8" x2="12" y2="8"></line>
                <line x1="3.95" y1="6.06" x2="8.54" y2="14"></line>
                <line x1="10.88" y1="21.94" x2="15.46" y2="14"></line>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/memory" className="sidebar-nav-link" title="记忆管理">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </NavLink>
          </li>
          <li>
            <NavLink to="/omni-agent" className="sidebar-nav-link" title="全能智能管家">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
                <path d="M12 12L2.3 12a10 10 0 0 0 9.7 10v-10z"></path>
                <path d="M12 12l9.7 0a10 10 0 0 1-9.7 10v-10z"></path>
              </svg>
            </NavLink>
          </li>
        </ul>
      </nav>
      
      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', paddingBottom: '16px' }}>
        {/* Mode Switcher */}
        <div 
          onClick={toggleMode}
          title={`Switch to ${currentMode === 'ide' ? 'SOLO' : 'IDE'} Mode`}
          style={{
            width: '36px',
            height: '20px',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '10px',
            position: 'relative',
            cursor: 'pointer',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{
            position: 'absolute',
            fontSize: '10px',
            fontWeight: 'bold',
            color: 'var(--text-secondary)',
            left: currentMode === 'ide' ? '20px' : '4px',
            opacity: 0.8
          }}>
            {currentMode === 'ide' ? 'S' : 'I'}
          </div>
          <div style={{
            width: '16px',
            height: '16px',
            backgroundColor: currentMode === 'ide' ? '#3b82f6' : '#8b5cf6',
            borderRadius: '50%',
            position: 'absolute',
            left: currentMode === 'ide' ? '2px' : '18px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '10px'
          }}>
            {currentMode === 'ide' ? 'I' : 'S'}
          </div>
        </div>

        <NavLink to="/system" className="sidebar-nav-link" title="系统设置">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </NavLink>
      </div>
    </aside>
  )
}

export default Sidebar
