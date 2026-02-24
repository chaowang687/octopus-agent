import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import UpdateModal from './UpdateModal'
import './UpdateModal.css'

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const NewFileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
)

const OpenFileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

const SaveFileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
)

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const LayoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
)

interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'user' | 'guest'
  createdAt: number
  lastLoginAt?: number
  permissions: {
    projects: { [projectId: string]: 'owner' | 'editor' | 'viewer' }
    canCreateProjects: boolean
    canManageUsers: boolean
  }
}

interface HeaderProps {
  currentUser?: User | null
  onLogout?: () => Promise<void>
  activeToolTab?: 'editor' | 'terminal' | 'changes' | 'browser'
  setActiveToolTab?: (tab: 'editor' | 'terminal' | 'changes' | 'browser') => void
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, activeToolTab = 'editor', setActiveToolTab }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 检查是否在 IDE 页面（根路径）
  const isIDEPage = location.pathname === '/'

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout()
      navigate('/login')
    }
  }

  const handleUserManagement = () => {
    navigate('/user-management')
  }

  const handleNewFile = () => {
    console.log('New file')
  }

  const handleOpenFile = async () => {
    try {
      const result = await window.electron.dialog.openFile()
      if (!result.canceled && result.filePaths.length > 0) {
        console.log('Opened file:', result.filePaths[0])
      }
    } catch (error) {
      console.error('Error opening file:', error)
    }
  }

  const handleSaveFile = () => {
    console.log('Save file')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Search:', searchQuery)
  }

  return (
    // 对于 IDE 页面显示完整顶栏，其他页面显示与背景同色的空顶栏
    <>
      {isIDEPage ? (
        <header className="header" style={{
          height: '40px',
          background: '#252526',
          borderBottom: '1px solid #3e3e42',
          position: 'relative',
          zIndex: 10,
          // 保留可拖拽区域
          WebkitAppRegion: 'drag',
          display: 'flex',
          alignItems: 'center'
        }}>
          {/* 标签栏 */}
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, WebkitAppRegion: 'no-drag' }}>
            {/* 实时跟随 */}
            <button style={{
              padding: '0 16px',
              height: '40px',
              background: '#0e639c',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              实时跟随
              <div style={{ 
                position: 'absolute', 
                right: '8px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                width: '1px',
                height: '20px',
                background: 'rgba(255, 255, 255, 0.3)'
              }} />
            </button>
            
            {/* 浏览器 */}
            <button 
              style={{
                padding: '0 16px',
                height: '40px',
                background: activeToolTab === 'browser' ? '#0e639c' : 'transparent',
                border: 'none',
                color: activeToolTab === 'browser' ? '#ffffff' : '#cccccc',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }} 
              onClick={() => setActiveToolTab?.('browser')}
              onMouseEnter={(e) => e.currentTarget.style.background = activeToolTab === 'browser' ? '#0e639c' : '#3a3a3d'}
              onMouseLeave={(e) => e.currentTarget.style.background = activeToolTab === 'browser' ? '#0e639c' : 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <div style={{ 
                position: 'absolute', 
                right: '8px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                width: '1px',
                height: '20px',
                background: activeToolTab === 'browser' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'
              }} />
            </button>
            
            {/* 代码变更 */}
            <button 
              style={{
                padding: '0 16px',
                height: '40px',
                background: activeToolTab === 'changes' ? '#0e639c' : 'transparent',
                border: 'none',
                color: activeToolTab === 'changes' ? '#ffffff' : '#cccccc',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }} 
              onClick={() => setActiveToolTab?.('changes')}
              onMouseEnter={(e) => e.currentTarget.style.background = activeToolTab === 'changes' ? '#0e639c' : '#3a3a3d'}
              onMouseLeave={(e) => e.currentTarget.style.background = activeToolTab === 'changes' ? '#0e639c' : 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <div style={{ 
                position: 'absolute', 
                right: '8px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                width: '1px',
                height: '20px',
                background: activeToolTab === 'changes' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'
              }} />
            </button>
            
            {/* 终端 */}
            <button 
              style={{
                padding: '0 16px',
                height: '40px',
                background: activeToolTab === 'terminal' ? '#0e639c' : 'transparent',
                border: 'none',
                color: activeToolTab === 'terminal' ? '#ffffff' : '#cccccc',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }} 
              onClick={() => setActiveToolTab?.('terminal')}
              onMouseEnter={(e) => e.currentTarget.style.background = activeToolTab === 'terminal' ? '#0e639c' : '#3a3a3d'}
              onMouseLeave={(e) => e.currentTarget.style.background = activeToolTab === 'terminal' ? '#0e639c' : 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <div style={{ 
                position: 'absolute', 
                right: '8px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                width: '1px',
                height: '20px',
                background: activeToolTab === 'terminal' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'
              }} />
            </button>
            
            {/* 编辑器 */}
            <button 
              style={{
                padding: '0 16px',
                height: '40px',
                background: activeToolTab === 'editor' ? '#0e639c' : 'transparent',
                border: 'none',
                color: activeToolTab === 'editor' ? '#ffffff' : '#cccccc',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }} 
              onClick={() => setActiveToolTab?.('editor')}
              onMouseEnter={(e) => e.currentTarget.style.background = activeToolTab === 'editor' ? '#0e639c' : '#3a3a3d'}
              onMouseLeave={(e) => e.currentTarget.style.background = activeToolTab === 'editor' ? '#0e639c' : 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </button>
            
            {/* 加号 */}
            <button style={{
              padding: '0 16px',
              height: '40px',
              background: 'transparent',
              border: 'none',
              color: '#cccccc',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }} onMouseEnter={(e) => e.currentTarget.style.background = '#3a3a3d'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              +
            </button>
          </div>
          
          {/* 右侧收起IDE面板图标 */}
          <div style={{ padding: '0 16px', WebkitAppRegion: 'no-drag' }}>
            <button style={{
              padding: '4px',
              background: 'transparent',
              border: 'none',
              color: '#cccccc',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }} onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'} onMouseLeave={(e) => e.currentTarget.style.color = '#cccccc'}>
              ⌂
            </button>
          </div>
        </header>
      ) : (
        // 其他页面显示与背景同色的空顶栏
        <header className="header" style={{
          height: '40px',
          background: '#f8f9fa', // 与背景同色
          borderBottom: '1px solid #e9ecef',
          position: 'relative',
          zIndex: 10,
          // 保留可拖拽区域
          WebkitAppRegion: 'drag'
        }} />
      )}
    </>
  )
}

export default Header
