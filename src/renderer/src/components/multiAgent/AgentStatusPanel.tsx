import React from 'react'
import { AgentState, AgentType, AGENT_CONFIG } from '../../types/MultiAgentTypes'
import './AgentStatusPanel.css'

interface AgentStatusPanelProps {
  agents: Map<AgentType, AgentState>
  currentAgent?: AgentType
}

export const AgentStatusPanel: React.FC<AgentStatusPanelProps> = ({
  agents,
  currentAgent
}) => {
  const getStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      idle: '空闲',
      waiting: '等待中',
      working: '工作中',
      completed: '已完成',
      failed: '失败'
    }
    return statusMap[status] || status
  }
  
  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      idle: '#9ca3af',
      waiting: '#f59e0b',
      working: '#3b82f6',
      completed: '#10b981',
      failed: '#ef4444'
    }
    return colorMap[status] || '#9ca3af'
  }
  
  const isCurrentAgent = (agentId: AgentType): boolean => {
    return agentId === currentAgent
  }
  
  const agentTypes: AgentType[] = ['pm', 'ui', 'dev', 'test', 'review']
  
  return (
    <div className="agent-status-panel">
      <div className="panel-header">
        <h3 className="panel-title">智能体状态</h3>
        <div className="active-count">
          {Array.from(agents.values()).filter(a => a.status === 'working').length} / {agents.size} 活跃
        </div>
      </div>
      
      <div className="agents-grid">
        {agentTypes.map((agentType) => {
          const agent = agents.get(agentType)
          const config = AGENT_CONFIG[agentType]
          const isActive = isCurrentAgent(agentType)
          
          if (!agent) return null
          
          return (
            <div 
              key={agentType}
              className={`agent-card ${isActive ? 'agent-active' : ''}`}
            >
              <div className="agent-header">
                <div className="agent-icon-wrapper">
                  <div 
                    className="agent-status-indicator"
                    style={{ backgroundColor: getStatusColor(agent.status) }}
                  />
                  <div className="agent-icon">
                    {agentType === 'pm' && '📋'}
                    {agentType === 'ui' && '🎨'}
                    {agentType === 'dev' && '💻'}
                    {agentType === 'test' && '🧪'}
                    {agentType === 'review' && '✅'}
                  </div>
                </div>
                
                <div className="agent-info">
                  <div className="agent-name">{config.name}</div>
                  <div className="agent-role">{config.role}</div>
                </div>
              </div>
              
              <div className="agent-status">
                <div 
                  className="status-badge"
                  style={{ backgroundColor: `${getStatusColor(agent.status)}20`, color: getStatusColor(agent.status) }}
                >
                  {getStatusText(agent.status)}
                </div>
                
                {agent.model && (
                  <div className="model-badge" title={agent.model}>
                    🤖 {agent.model.replace('doubao-seed-2-0-lite-260215', '豆包Lite').replace('doubao-seed-2-0-pro-260215', '豆包Pro').replace('deepseek-coder', 'DeepSeek')}
                  </div>
                )}
                
                {agent.iteration !== undefined && agent.iteration > 0 && (
                  <div className="iteration-badge">
                    第 {agent.iteration} 次迭代
                  </div>
                )}
              </div>
              
              {agent.lastOutput && (
                <div className="agent-output">
                  <div className="output-label">最新输出</div>
                  <div className="output-text">{agent.lastOutput}</div>
                </div>
              )}
              
              {agent.context && Object.keys(agent.context).length > 0 && (
                <div className="agent-context">
                  <div className="context-label">上下文信息</div>
                  <div className="context-items">
                    {Object.entries(agent.context).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="context-item">
                        <span className="context-key">{key}:</span>
                        <span className="context-value">
                          {typeof value === 'string' ? value.slice(0, 30) + (value.length > 30 ? '...' : '') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
