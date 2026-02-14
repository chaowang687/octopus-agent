import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
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

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [systemInfo, setSystemInfo] = useState<any>(null)

  useEffect(() => {
    const initApp = async () => {
      try {
        const api = (window as any).electron?.system
        if (api?.getSystemInfo) {
          const info = await api.getSystemInfo()
          setSystemInfo(info)
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
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  )
}

export default App
