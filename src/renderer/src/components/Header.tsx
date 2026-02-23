import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UpdateModal from './UpdateModal'
import './UpdateModal.css'

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
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
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout }) => {
  const navigate = useNavigate()
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout()
      navigate('/login')
    }
  }

  const handleUserManagement = () => {
    navigate('/user-management')
  }

  return (
    <header className="header" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 20px',
      height: '60px',
      background: '#fff',
      borderBottom: '1px solid #e0e0e0',
      position: 'relative',
      zIndex: 10
    }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
        Octopus Agent
        <button
          onClick={() => setShowUpdateModal(true)}
          style={{
            padding: '6px 12px',
            background: '#e3f2fd',
            color: '#1976d2',
            border: '1px solid #90caf9',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#bbdefb'
            e.currentTarget.style.borderColor = '#64b5f6'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#e3f2fd'
            e.currentTarget.style.borderColor = '#90caf9'
          }}
        >
          <DownloadIcon />
          检查更新
        </button>
      </div>
      
      {currentUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#667eea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              {currentUser.username.charAt(0).toUpperCase()}
            </div>
            <div style={{ fontSize: '14px', color: '#333' }}>
              <div style={{ fontWeight: 'bold' }}>{currentUser.username}</div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                {currentUser.role === 'admin' ? '管理员' : currentUser.role === 'user' ? '用户' : '访客'}
              </div>
            </div>
          </div>
          
          {currentUser.role === 'admin' && (
            <button
              onClick={handleUserManagement}
              style={{
                padding: '8px 16px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#45a049'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#4caf50'}
            >
              用户管理
            </button>
          )}
          
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background 0.3s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#da190b'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f44336'}
          >
            注销
          </button>
        </div>
      )}
      
      <UpdateModal visible={showUpdateModal} onClose={() => setShowUpdateModal(false)} />
    </header>
  )
}

export default Header
