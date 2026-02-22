import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MainContent from './components/MainContent'
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
import ResourceAllocation from './pages/ResourceAllocation'
import OmniAgent from './pages/OmniAgent'

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

  useEffect(() => {
    const initApp = async () => {
      try {
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
        <div className="app">
          <Sidebar />
          <div className="main-wrapper">
            <Header />
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
                <Route path="/resource-allocation" element={<ResourceAllocation />} />
                <Route path="/omni-agent" element={<OmniAgent />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          </div>
        </div>
      </GlobalBrowserHandler>
    </Router>
  )
}

export default App
