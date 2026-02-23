import React from 'react'
import { TaskState } from '../../types/MultiAgentTypes'
import './TaskControlPanel.css'

interface TaskControlPanelProps {
  taskState: TaskState
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
}

export const TaskControlPanel: React.FC<TaskControlPanelProps> = ({
  taskState,
  onPause,
  onResume,
  onCancel
}) => {
  const formatDuration = (startTime?: number, endTime?: number): string => {
    if (!startTime) return '-'
    const end = endTime || Date.now()
    const duration = end - startTime
    
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`
    } else {
      return `${seconds}秒`
    }
  }
  
  const getPhaseLabel = (phase: string): string => {
    const phaseMap: Record<string, string> = {
      requirements: '需求分析',
      architecture: '架构设计',
      implementation: '代码实现',
      testing: '测试验证',
      review: '代码审查',
      handover: '阶段交接'
    }
    return phaseMap[phase] || phase
  }
  
  return (
    <div className="task-control-panel">
      <div className="control-header">
        <h3 className="control-title">任务控制</h3>
        <div className={`task-status task-${taskState.isPaused ? 'paused' : taskState.isCancelled ? 'cancelled' : 'running'}`}>
          {taskState.isPaused && '⏸️ 已暂停'}
          {taskState.isCancelled && '❌ 已取消'}
          {!taskState.isPaused && !taskState.isCancelled && '▶️ 运行中'}
        </div>
      </div>
      
      <div className="control-info">
        <div className="info-row">
          <span className="info-label">当前阶段:</span>
          <span className="info-value">{getPhaseLabel(taskState.currentPhase)}</span>
        </div>
        
        <div className="info-row">
          <span className="info-label">总体进度:</span>
          <span className="info-value">{Math.round(taskState.progress)}%</span>
        </div>
        
        <div className="info-row">
          <span className="info-label">运行时长:</span>
          <span className="info-value">{formatDuration(taskState.startTime, taskState.endTime)}</span>
        </div>
      </div>
      
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill"
          style={{ width: `${taskState.progress}%` }}
        />
      </div>
      
      <div className="control-buttons">
        {!taskState.isPaused && !taskState.isCancelled && (
          <button 
            className="control-btn control-pause"
            onClick={onPause}
            disabled={!onPause}
          >
            <span className="btn-icon">⏸️</span>
            <span>暂停任务</span>
          </button>
        )}
        
        {taskState.isPaused && !taskState.isCancelled && (
          <button 
            className="control-btn control-resume"
            onClick={onResume}
            disabled={!onResume}
          >
            <span className="btn-icon">▶️</span>
            <span>恢复任务</span>
          </button>
        )}
        
        {!taskState.isCancelled && (
          <button 
            className="control-btn control-cancel"
            onClick={onCancel}
            disabled={!onCancel}
          >
            <span className="btn-icon">❌</span>
            <span>取消任务</span>
          </button>
        )}
      </div>
      
      {taskState.isPaused && (
        <div className="pause-notice">
          <div className="notice-icon">ℹ️</div>
          <div className="notice-text">
            任务已暂停，您可以随时恢复或取消任务
          </div>
        </div>
      )}
      
      {taskState.isCancelled && (
        <div className="cancel-notice">
          <div className="notice-icon">⚠️</div>
          <div className="notice-text">
            任务已取消，无法恢复
          </div>
        </div>
      )}
    </div>
  )
}
