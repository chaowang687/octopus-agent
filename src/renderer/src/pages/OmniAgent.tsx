import React, { useState, useEffect } from 'react'
import OmniAgentPanel from '../components/OmniAgentPanel'

const OmniAgent: React.FC = () => {
  const [showPanel, setShowPanel] = useState(false)

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🤖 全能智能体管家</h1>
        <p className="page-description">
          智能任务执行、项目管理和权限控制
        </p>
      </div>

      <div className="page-content">
        {!showPanel ? (
          <div className="welcome-section">
            <div className="welcome-card">
              <h2>欢迎使用全能智能体管家</h2>
              <p>
                全能智能体管家是一个强大的AI助手，可以帮助您：
              </p>
              <ul className="feature-list">
                <li>🎯 智能任务规划和执行</li>
                <li>🧠 深度推理和自我纠正</li>
                <li>📁 跨项目协作和管理</li>
                <li>🔐 多级权限控制</li>
                <li>📊 任务历史追踪</li>
                <li>🛠️ 工具集成和调用</li>
              </ul>
              <button 
                className="start-button"
                onClick={() => setShowPanel(true)}
              >
                开始使用
              </button>
            </div>
          </div>
        ) : (
          <OmniAgentPanel onClose={() => setShowPanel(false)} />
        )}
      </div>
    </div>
  )
}

export default OmniAgent
