import React, { useState, useEffect } from 'react'
import { StructuredOutput } from '../../types/MultiAgentTypes'
import './StructuredOutputViewer.css'

interface TaskItem {
  id: string
  text: string
  status: 'pending' | 'in_progress' | 'completed'
}

interface StructuredOutputViewerProps {
  output: StructuredOutput
}

export const StructuredOutputViewer: React.FC<StructuredOutputViewerProps> = ({
  output
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'tasks' | 'files'>('content')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  
  useEffect(() => {
    const allTasks: TaskItem[] = []
    
    output.completedTasks.forEach((task, index) => {
      allTasks.push({
        id: `completed-${index}`,
        text: task,
        status: 'completed'
      })
    })
    
    output.nextSteps.forEach((task, index) => {
      allTasks.push({
        id: `pending-${index}`,
        text: task,
        status: 'pending'
      })
    })
    
    setTasks(allTasks)
    setCompletedCount(output.completedTasks.length)
  }, [output.completedTasks, output.nextSteps])
  
  const totalTasks = tasks.length
  const progress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0
  
  const getStatusIcon = (status: TaskItem['status']) => {
    switch (status) {
      case 'completed':
        return <span className="status-icon completed">✓</span>
      case 'in_progress':
        return <span className="status-icon in-progress">◐</span>
      default:
        return <span className="status-icon pending">○</span>
    }
  }
  
  const getStatusClass = (status: TaskItem['status']) => {
    switch (status) {
      case 'completed':
        return 'task-completed'
      case 'in_progress':
        return 'task-in-progress'
      default:
        return 'task-pending'
    }
  }
  
  return (
    <div className="structured-output-viewer">
      <div className="viewer-header">
        <div className="agent-info">
          <div className="agent-name">{output.agentName}</div>
          <div className="agent-phase">{output.phase}</div>
        </div>
      </div>
      
      <div className="viewer-tabs">
        <button 
          className={`tab-btn ${activeTab === 'content' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('content')}
        >
          📄 内容
        </button>
        <button 
          className={`tab-btn ${activeTab === 'tasks' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          📋 任务
          <span className="tab-badge">{completedCount}/{totalTasks}</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'files' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          📁 文件
          <span className="tab-badge">{output.outputFiles.length}</span>
        </button>
      </div>
      
      <div className="viewer-content">
        {activeTab === 'content' && (
          <div className="content-tab">
            <div className="content-display">
              {output.content}
            </div>
          </div>
        )}
        
        {activeTab === 'tasks' && (
          <div className="tasks-tab">
            {totalTasks > 0 && (
              <div className="progress-section">
                <div className="progress-header">
                  <span className="progress-label">整体进度</span>
                  <span className="progress-text">{completedCount}/{totalTasks} 已完成</span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar" style={{ width: `${progress}%` }}>
                    <span className="progress-percent">{progress}%</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="tasks-list-container">
              {tasks.length > 0 ? (
                <div className="tasks-list">
                  {tasks.map((task) => (
                    <div key={task.id} className={`task-item ${getStatusClass(task.status)}`}>
                      {getStatusIcon(task.status)}
                      <div className="task-content">
                        <span className="task-text">{task.text}</span>
                        <span className="task-status-label">
                          {task.status === 'completed' ? '已完成' : task.status === 'in_progress' ? '进行中' : '待处理'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tasks-empty">
                  <span className="empty-icon">📝</span>
                  <span className="empty-text">暂无任务</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'files' && (
          <div className="files-tab">
            {output.outputFiles.length > 0 ? (
              <div className="files-list">
                {output.outputFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <div className="file-icon">📄</div>
                    <div className="file-info">
                      <div className="file-name">{file.split('/').pop()}</div>
                      <div className="file-path">{file}</div>
                    </div>
                    <div className="file-status">
                      <span className="status-dot"></span>
                      已生成
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="files-empty">
                <span className="empty-icon">📁</span>
                <span className="empty-text">暂无输出文件</span>
                <span className="empty-hint">文件将在任务完成后生成</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
