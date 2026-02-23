import React, { useState, useEffect } from 'react'
import './TaskLogViewer.css'

interface TaskLogEntry {
  id: string
  timestamp: number
  type: string
  level: 'info' | 'warning' | 'error' | 'success'
  category: string
  message: string
  details?: any
  duration?: number
}

interface TaskExecutionLog {
  taskId: string
  projectName: string
  instruction: string
  originalInstruction: string
  taskDir: string
  startTime: number
  endTime?: number
  totalDuration?: number
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  routing: {
    targetSystem: 'system1' | 'system2'
    reasoning?: string
    confidence?: number
  }
  distillation?: {
    enabled: boolean
    skillName?: string
    cacheHit?: boolean
    knowledgeInjected?: boolean
  }
  summary: {
    totalSteps: number
    totalToolCalls: number
    totalLLMCalls: number
    totalTokens: number
    errorCount: number
    retryCount: number
    correctionCount: number
  }
  logs: TaskLogEntry[]
}

interface TaskLogViewerProps {
  taskId?: string
  onClose?: () => void
}

const TaskLogViewer: React.FC<TaskLogViewerProps> = ({ taskId, onClose }) => {
  const [logs, setLogs] = useState<TaskExecutionLog[]>([])
  const [selectedLog, setSelectedLog] = useState<TaskExecutionLog | null>(null)
  const [filter, setFilter] = useState<'all' | 'error' | 'tool' | 'llm'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'timeline' | 'summary'>('timeline')
  
  useEffect(() => {
    loadLogs()
  }, [])
  
  const loadLogs = async () => {
    try {
      const result = await window.electron.system.executeCommand('task-log', ['list'])
      if (result && result.logs) {
        setLogs(result.logs)
      }
    } catch (error) {
      console.error('加载日志失败:', error)
    }
  }
  
  const loadLog = async (id: string) => {
    try {
      const result = await window.electron.system.executeCommand('task-log', ['get', id])
      if (result && result.log) {
        setSelectedLog(result.log)
      }
    } catch (error) {
      console.error('加载日志详情失败:', error)
    }
  }
  
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }
  
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString()
  }
  
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString()
  }
  
  const getLevelIcon = (level: string): string => {
    switch (level) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      default: return 'ℹ️'
    }
  }
  
  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'task_start': return '🚀'
      case 'task_end': return '🏁'
      case 'llm_call': return '🤖'
      case 'llm_response': return '💬'
      case 'tool_call': return '🔧'
      case 'tool_result': return '📊'
      case 'think': return '💭'
      case 'act': return '⚡'
      case 'observe': return '👁️'
      case 'error': return '❌'
      case 'retry': return '🔄'
      case 'correction': return '🔧'
      case 'agent_message': return '👤'
      case 'routing': return '🔀'
      case 'distillation': return '📚'
      default: return '📝'
    }
  }
  
  const filteredLogs = selectedLog?.logs.filter(log => {
    if (filter === 'error') return log.level === 'error' || log.type === 'error'
    if (filter === 'tool') return log.type.includes('tool') || log.type === 'act'
    if (filter === 'llm') return log.type.includes('llm') || log.type === 'think'
    return true
  }).filter(log => {
    if (!searchQuery) return true
    return log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
           log.category.toLowerCase().includes(searchQuery.toLowerCase())
  }) || []
  
  return (
    <div className="task-log-viewer">
      <div className="log-header">
        <h2>📋 任务执行日志</h2>
        <div className="header-actions">
          <button onClick={loadLogs} className="refresh-btn">🔄 刷新</button>
          {onClose && <button onClick={onClose} className="close-btn">✕</button>}
        </div>
      </div>
      
      <div className="log-container">
        <div className="log-list">
          <div className="list-header">
            <span>任务列表 ({logs.length})</span>
          </div>
          <div className="list-content">
            {logs.map(log => (
              <div 
                key={log.taskId} 
                className={`log-item ${selectedLog?.taskId === log.taskId ? 'selected' : ''} ${log.status}`}
                onClick={() => loadLog(log.taskId)}
              >
                <div className="item-header">
                  <span className="status-icon">
                    {log.status === 'completed' ? '✅' : log.status === 'failed' ? '❌' : log.status === 'running' ? '🔄' : '⏹️'}
                  </span>
                  <span className="project-name">{log.projectName}</span>
                </div>
                <div className="item-meta">
                  <span className="date">{formatDate(log.startTime)}</span>
                  <span className="duration">{log.totalDuration ? formatDuration(log.totalDuration) : '运行中'}</span>
                </div>
                <div className="item-summary">
                  <span>步骤: {log.summary.totalSteps}</span>
                  <span>工具: {log.summary.totalToolCalls}</span>
                  <span>Token: {log.summary.totalTokens}</span>
                  {log.summary.errorCount > 0 && (
                    <span className="error-count">错误: {log.summary.errorCount}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {selectedLog && (
          <div className="log-detail">
            <div className="detail-header">
              <h3>{selectedLog.projectName}</h3>
              <span className={`status-badge ${selectedLog.status}`}>
                {selectedLog.status}
              </span>
            </div>
            
            <div className="detail-info">
              <div className="info-row">
                <span className="label">任务ID:</span>
                <span className="value">{selectedLog.taskId}</span>
              </div>
              <div className="info-row">
                <span className="label">工作目录:</span>
                <span className="value">{selectedLog.taskDir}</span>
              </div>
              <div className="info-row">
                <span className="label">路由:</span>
                <span className="value">
                  {selectedLog.routing.targetSystem === 'system1' ? '快速响应' : '深度思考'}
                  {selectedLog.routing.confidence && ` (${(selectedLog.routing.confidence * 100).toFixed(0)}%)`}
                </span>
              </div>
              {selectedLog.distillation?.enabled && (
                <div className="info-row">
                  <span className="label">蒸馏:</span>
                  <span className="value">
                    {selectedLog.distillation.skillName}
                    {selectedLog.distillation.cacheHit && ' (缓存)'}
                  </span>
                </div>
              )}
            </div>
            
            <div className="detail-tabs">
              <button 
                className={viewMode === 'timeline' ? 'active' : ''} 
                onClick={() => setViewMode('timeline')}
              >
                时间线
              </button>
              <button 
                className={viewMode === 'summary' ? 'active' : ''} 
                onClick={() => setViewMode('summary')}
              >
                统计
              </button>
            </div>
            
            <div className="filter-bar">
              <input
                type="text"
                placeholder="搜索日志..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
                <option value="all">全部</option>
                <option value="error">错误</option>
                <option value="tool">工具调用</option>
                <option value="llm">LLM调用</option>
              </select>
            </div>
            
            <div className="detail-content">
              {viewMode === 'timeline' ? (
                <div className="timeline">
                  {filteredLogs.map((log, index) => (
                    <div key={log.id} className={`timeline-item ${log.level}`}>
                      <div className="timeline-marker">
                        <span className="type-icon">{getTypeIcon(log.type)}</span>
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <span className="time">{formatTime(log.timestamp)}</span>
                          <span className="category">{log.category}</span>
                          {log.duration && (
                            <span className="duration">{formatDuration(log.duration)}</span>
                          )}
                        </div>
                        <div className="message">{log.message}</div>
                        {log.details && (
                          <details className="details">
                            <summary>详细信息</summary>
                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="summary-view">
                  <div className="summary-grid">
                    <div className="summary-card">
                      <span className="card-value">{selectedLog.summary.totalSteps}</span>
                      <span className="card-label">总步骤</span>
                    </div>
                    <div className="summary-card">
                      <span className="card-value">{selectedLog.summary.totalToolCalls}</span>
                      <span className="card-label">工具调用</span>
                    </div>
                    <div className="summary-card">
                      <span className="card-value">{selectedLog.summary.totalLLMCalls}</span>
                      <span className="card-label">LLM调用</span>
                    </div>
                    <div className="summary-card">
                      <span className="card-value">{selectedLog.summary.totalTokens}</span>
                      <span className="card-label">Token消耗</span>
                    </div>
                    <div className="summary-card error">
                      <span className="card-value">{selectedLog.summary.errorCount}</span>
                      <span className="card-label">错误</span>
                    </div>
                    <div className="summary-card warning">
                      <span className="card-value">{selectedLog.summary.retryCount}</span>
                      <span className="card-label">重试</span>
                    </div>
                    <div className="summary-card info">
                      <span className="card-value">{selectedLog.summary.correctionCount}</span>
                      <span className="card-label">自我纠正</span>
                    </div>
                    <div className="summary-card">
                      <span className="card-value">
                        {selectedLog.totalDuration ? formatDuration(selectedLog.totalDuration) : '-'}
                      </span>
                      <span className="card-label">总耗时</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TaskLogViewer
