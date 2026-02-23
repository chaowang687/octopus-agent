import React, { useState } from 'react'
import { ErrorInfo } from '../../types/MultiAgentTypes'
import './ErrorHandler.css'

interface ErrorHandlerProps {
  errors: ErrorInfo[]
  onRetry?: (errorId: string) => void
  onDismiss?: (errorId: string) => void
  onClearAll?: () => void
}

export const ErrorHandler: React.FC<ErrorHandlerProps> = ({
  errors,
  onRetry,
  onDismiss,
  onClearAll
}) => {
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set())
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'major' | 'minor'>('all')
  
  const toggleExpand = (index: number) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }
  
  const getSeverityIcon = (severity: string): string => {
    const iconMap: Record<string, string> = {
      critical: '🔴',
      major: '🟠',
      minor: '🟡'
    }
    return iconMap[severity] || '⚪'
  }
  
  const getSeverityText = (severity: string): string => {
    const textMap: Record<string, string> = {
      critical: '严重',
      major: '重要',
      minor: '次要'
    }
    return textMap[severity] || severity
  }
  
  const getSeverityColor = (severity: string): string => {
    const colorMap: Record<string, string> = {
      critical: '#ef4444',
      major: '#f97316',
      minor: '#eab308'
    }
    return colorMap[severity] || '#6b7280'
  }
  
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }
  
  const filteredErrors = filterSeverity === 'all' 
    ? errors 
    : errors.filter(e => e.severity === filterSeverity)
  
  const severityCounts = {
    critical: errors.filter(e => e.severity === 'critical').length,
    major: errors.filter(e => e.severity === 'major').length,
    minor: errors.filter(e => e.severity === 'minor').length
  }
  
  if (errors.length === 0) {
    return null
  }
  
  return (
    <div className="error-handler">
      <div className="error-header">
        <div className="header-left">
          <h3 className="error-title">
            <span className="title-icon">⚠️</span>
            错误日志
          </h3>
          <div className="error-count">{errors.length} 个错误</div>
        </div>
        
        <div className="header-right">
          <button 
            className="clear-all-btn"
            onClick={onClearAll}
            disabled={!onClearAll}
          >
            清空全部
          </button>
        </div>
      </div>
      
      <div className="error-filters">
        <button 
          className={`filter-btn ${filterSeverity === 'all' ? 'filter-active' : ''}`}
          onClick={() => setFilterSeverity('all')}
        >
          全部
          <span className="filter-count">{errors.length}</span>
        </button>
        <button 
          className={`filter-btn ${filterSeverity === 'critical' ? 'filter-active' : ''}`}
          onClick={() => setFilterSeverity('critical')}
        >
          严重
          <span className="filter-count">{severityCounts.critical}</span>
        </button>
        <button 
          className={`filter-btn ${filterSeverity === 'major' ? 'filter-active' : ''}`}
          onClick={() => setFilterSeverity('major')}
        >
          重要
          <span className="filter-count">{severityCounts.major}</span>
        </button>
        <button 
          className={`filter-btn ${filterSeverity === 'minor' ? 'filter-active' : ''}`}
          onClick={() => setFilterSeverity('minor')}
        >
          次要
          <span className="filter-count">{severityCounts.minor}</span>
        </button>
      </div>
      
      <div className="error-list">
        {filteredErrors.length === 0 ? (
          <div className="errors-empty">
            <div className="empty-icon">✓</div>
            <div className="empty-text">没有符合条件的错误</div>
          </div>
        ) : (
          filteredErrors.map((error, index) => {
            const isExpanded = expandedErrors.has(index)
            const severityColor = getSeverityColor(error.severity)
            
            return (
              <div 
                key={index}
                className={`error-item error-${error.severity} ${isExpanded ? 'error-expanded' : ''}`}
                style={{ borderLeftColor: severityColor }}
              >
                <div 
                  className="error-summary"
                  onClick={() => toggleExpand(index)}
                >
                  <div className="summary-left">
                    <div className="error-icon">{getSeverityIcon(error.severity)}</div>
                    
                    <div className="error-info">
                      <div className="error-agent">{error.agentId}</div>
                      <div className="error-message">
                        {error.error.length > 80 
                          ? error.error.slice(0, 80) + '...' 
                          : error.error}
                      </div>
                    </div>
                  </div>
                  
                  <div className="summary-right">
                    <div className="error-severity" style={{ color: severityColor }}>
                      {getSeverityText(error.severity)}
                    </div>
                    <div className="error-time">{formatTimestamp(error.timestamp)}</div>
                    <div className="expand-icon">
                      {isExpanded ? '▼' : '▶'}
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="error-detail">
                    <div className="detail-section">
                      <div className="detail-label">错误详情</div>
                      <div className="detail-content">{error.error}</div>
                    </div>
                    
                    <div className="detail-row">
                      <div className="detail-item">
                        <div className="detail-label">智能体</div>
                        <div className="detail-value">{error.agentId}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">轮次</div>
                        <div className="detail-value">第 {error.round} 轮</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">严重程度</div>
                        <div className="detail-value" style={{ color: severityColor }}>
                          {getSeverityText(error.severity)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="error-actions">
                      {onRetry && (
                        <button 
                          className="error-action-btn error-retry"
                          onClick={() => onRetry(`${error.agentId}-${error.timestamp}`)}
                        >
                          🔄 重试
                        </button>
                      )}
                      {onDismiss && (
                        <button 
                          className="error-action-btn error-dismiss"
                          onClick={() => onDismiss(`${error.agentId}-${error.timestamp}`)}
                        >
                          ✕ 忽略
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
