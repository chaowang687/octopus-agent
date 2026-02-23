import React, { useState } from 'react'
import { AgentMessage, MessageType, PHASE_CONFIG } from '../../types/MultiAgentTypes'
import './CollaborationHistory.css'

interface CollaborationHistoryProps {
  messages: AgentMessage[]
}

export const CollaborationHistory: React.FC<CollaborationHistoryProps> = ({
  messages
}) => {
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set())
  const [filterType, setFilterType] = useState<MessageType | 'all'>('all')
  
  const toggleExpand = (index: number) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }
  
  const expandAll = () => {
    setExpandedMessages(new Set(messages.map((_, i) => i)))
  }
  
  const collapseAll = () => {
    setExpandedMessages(new Set())
  }
  
  const getMessageIcon = (messageType: MessageType): string => {
    const iconMap: Record<MessageType, string> = {
      system: '⚙️',
      response: '💬',
      question: '❓',
      handover: '🔄',
      warning: '⚠️'
    }
    return iconMap[messageType] || '💬'
  }
  
  const getMessageTypeText = (messageType: MessageType): string => {
    const textMap: Record<MessageType, string> = {
      system: '系统消息',
      response: '响应',
      question: '问题',
      handover: '交接',
      warning: '警告'
    }
    return textMap[messageType] || '消息'
  }
  
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) {
      return '刚刚'
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小时前`
    } else {
      return date.toLocaleDateString('zh-CN')
    }
  }
  
  const filteredMessages = filterType === 'all' 
    ? messages 
    : messages.filter(m => m.messageType === filterType)
  
  const messageTypes: (MessageType | 'all')[] = ['all', 'system', 'response', 'question', 'handover', 'warning']
  
  return (
    <div className="collaboration-history">
      <div className="history-header">
        <h3 className="history-title">协作历史</h3>
        <div className="history-actions">
          <button 
            className="history-action-btn"
            onClick={expandAll}
          >
            全部展开
          </button>
          <button 
            className="history-action-btn"
            onClick={collapseAll}
          >
            全部折叠
          </button>
        </div>
      </div>
      
      <div className="history-filters">
        {messageTypes.map(type => (
          <button
            key={type}
            className={`filter-btn ${filterType === type ? 'filter-active' : ''}`}
            onClick={() => setFilterType(type)}
          >
            {type === 'all' ? '全部' : getMessageTypeText(type)}
            {type !== 'all' && (
              <span className="filter-count">
                {messages.filter(m => m.messageType === type).length}
              </span>
            )}
          </button>
        ))}
      </div>
      
      <div className="history-timeline">
        {filteredMessages.length === 0 ? (
          <div className="history-empty">
            <div className="empty-icon">📭</div>
            <div className="empty-text">暂无协作历史</div>
          </div>
        ) : (
          filteredMessages.map((message, index) => {
            const config = PHASE_CONFIG[message.phase] || PHASE_CONFIG.requirements
            const isExpanded = expandedMessages.has(index)
            
            return (
              <div 
                key={index}
                className={`history-item history-${message.messageType} ${isExpanded ? 'history-expanded' : ''}`}
              >
                <div className="timeline-line" />
                
                <div className="timeline-dot" style={{ backgroundColor: config.color }} />
                
                <div className="message-card">
                  <div 
                    className="message-header"
                    onClick={() => toggleExpand(index)}
                  >
                    <div className="message-meta">
                      <div className="message-icon">{getMessageIcon(message.messageType)}</div>
                      
                      <div className="message-info">
                        <div className="message-agent">{message.agentName}</div>
                        <div className="message-phase" style={{ color: config.color }}>
                          {config.label}
                        </div>
                      </div>
                    </div>
                    
                    <div className="message-right">
                      <div className="message-time">{formatTimestamp(message.timestamp)}</div>
                      <div className="expand-icon">
                        {isExpanded ? '▼' : '▶'}
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="message-body">
                      <div className="message-content">
                        {message.content}
                      </div>
                      
                      {message.priority && (
                        <div className={`message-priority priority-${message.priority}`}>
                          {message.priority === 'high' && '🔴 高优先级'}
                          {message.priority === 'medium' && '🟡 中优先级'}
                          {message.priority === 'low' && '🟢 低优先级'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
