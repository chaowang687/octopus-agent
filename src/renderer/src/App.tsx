import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MainContent from './components/MainContent'
import CollaborationDialog from './components/CollaborationDialog'
import Tools from './pages/Tools'
import ApiManagement from './pages/ApiManagement'
import Console from './pages/Console'
import SystemControl from './pages/SystemControl'
import Plugins from './pages/Plugins'
import Chat from './pages/Chat'
import Gallery from './pages/Gallery'
import SoloCoder from './pages/SoloCoder'
import ChatWorkflow from './pages/ChatWorkflow'
import Memory from './pages/Memory'
import Multimodal from './pages/Multimodal'
import ProjectManagement from './pages/ProjectManagement'
import Library from './pages/Library'
import OmniAgent from './pages/OmniAgent'
import { Login } from './pages/Login'
import { UserManagement } from './pages/UserManagement'
import { BackupManager } from './components/BackupManager'

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

// 认证保护组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('authToken')
  const currentUser = localStorage.getItem('currentUser')

  if (!token || !currentUser) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// 全局浏览器事件监听组件
const GlobalBrowserHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate()

  useEffect(() => {
    // 监听来自主进程的打开页面事件
    const handleAgentOpenPage = (event: Event) => {
      const customEvent = event as CustomEvent
      const url = customEvent.detail?.url
      
      if (url) {
        console.log('[GlobalBrowserHandler] Received open-page event:', url)
        // 存储URL到sessionStorage
        sessionStorage.setItem('pendingOpenUrl', url)
        // 导航到主页
        navigate('/')
      }
    }

    // 监听window事件（来自preload）
    window.addEventListener('agent-open-page', handleAgentOpenPage)
    
    // 监听来自electron API的事件（如果有）
    const api = (window as any).electron?.events
    if (api?.onAgentOpenPage) {
      api.onAgentOpenPage((url: string) => {
        console.log('[GlobalBrowserHandler] Received from API:', url)
        sessionStorage.setItem('pendingOpenUrl', url)
        navigate('/')
      })
    }

    return () => {
      window.removeEventListener('agent-open-page', handleAgentOpenPage)
    }
  }, [navigate])

  return <>{children}</>
}

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    const initApp = async () => {
      try {
        const token = localStorage.getItem('authToken')
        const currentUserStr = localStorage.getItem('currentUser')

        if (token && currentUserStr) {
          const user = JSON.parse(currentUserStr)
          
          const result = await window.electron.auth.verify(token)
          if (result.success) {
            setIsAuthenticated(true)
            setCurrentUser(user)
          } else {
            localStorage.removeItem('authToken')
            localStorage.removeItem('currentUser')
          }
        }

        const api = (window as any).electron?.system
        if (api?.getSystemInfo) {
          await api.getSystemInfo()
        }
      } catch (error) {
        console.error('初始化应用失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initApp()
  }, [])

  const handleLoginSuccess = (token: string, user: User) => {
    setIsAuthenticated(true)
    setCurrentUser(user)
  }

  const handleLogout = async () => {
    const token = localStorage.getItem('authToken')
    if (token) {
      try {
        await window.electron.auth.logout(token)
      } catch (error) {
        console.error('注销失败:', error)
      }
    }
    
    localStorage.removeItem('authToken')
    localStorage.removeItem('currentUser')
    setIsAuthenticated(false)
    setCurrentUser(null)
  }

  if (isLoading) {
    return (
      <div className="loading">
        <h2>加载中...</h2>
      </div>
    )
  }

  return (
    <Router>
      <GlobalBrowserHandler>
        {/* 协作确认对话框 - 全局显示 */}
        <CollaborationDialog />
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? (
                <Navigate to="/" replace />
              ) : (
                <Login onLoginSuccess={handleLoginSuccess} />
              )
            } 
          />
          <Route
            path="/*"
            element={
              isAuthenticated ? (
                <div className="app">
                  <Sidebar />
                  <div className="main-wrapper">
                    <Header currentUser={currentUser} onLogout={handleLogout} />
                    <div className="page-content">
                      <Routes>
                        <Route path="/" element={<MainContent />} />
                        <Route path="/tools" element={<Tools />} />
                        <Route path="/api" element={<ApiManagement />} />
                        <Route path="/console" element={<Console />} />
                        <Route path="/system" element={<SystemControl />} />
                        <Route path="/plugins" element={<Plugins />} />
                        <Route path="/chat" element={<Chat />} />
                        <Route path="/gallery" element={<Gallery />} />
                        <Route path="/solocoder" element={<SoloCoder />} />
                        <Route path="/chat-workflow" element={<ChatWorkflow />} />
                        <Route path="/memory" element={<Memory />} />
                        <Route path="/multimodal" element={<Multimodal />} />
                        <Route path="/projects" element={<ProjectManagement />} />
                        <Route path="/library" element={<Library />} />
                        <Route path="/omni-agent" element={<OmniAgent />} />
                        <Route path="/backup" element={<BackupManager />} />
                        <Route 
                          path="/user-management" 
                          element={
                            currentUser?.role === 'admin' ? (
                              <UserManagement token={localStorage.getItem('authToken')!} currentUser={currentUser} />
                            ) : (
                              <Navigate to="/" replace />
                            )
                          } 
                        />
                        <Route path="*" element={<Navigate to="/" />} />
                      </Routes>
                    </div>
                  </div>
                </div>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </GlobalBrowserHandler>
    </Router>
  )
}

export default App
