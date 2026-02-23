import React, { useState, useEffect } from 'react'
import { 
  AgentMessage, 
  AgentState, 
  AgentType, 
  TaskState, 
  ProgressDetail, 
  FileOutput, 
  ErrorInfo,
  StructuredOutput,
  PhaseType
} from '../../types/MultiAgentTypes'
import { ProgressTracker } from './ProgressTracker'
import { AgentStatusPanel } from './AgentStatusPanel'
import { CollaborationHistory } from './CollaborationHistory'
import { FileOutputManager } from './FileOutputManager'
import { TaskControlPanel } from './TaskControlPanel'
import { StructuredOutputViewer } from './StructuredOutputViewer'
import { ErrorHandler } from './ErrorHandler'
import './MultiAgentDashboard.css'

interface MultiAgentDashboardProps {
  taskId?: string
  onTaskComplete?: (result: any) => void
  onTaskError?: (error: any) => void
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
}

export const MultiAgentDashboard: React.FC<MultiAgentDashboardProps> = ({
  taskId,
  onTaskComplete,
  onTaskError,
  onPause,
  onResume,
  onCancel
}) => {
  const [currentPhase, setCurrentPhase] = useState<PhaseType>('requirements')
  const [progress, setProgress] = useState(0)
  const [progressDetail, setProgressDetail] = useState<ProgressDetail | undefined>()
  const [agents, setAgents] = useState<Map<AgentType, AgentState>>(new Map())
  const [currentAgent, setCurrentAgent] = useState<AgentType>()
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [files, setFiles] = useState<FileOutput[]>([])
  const [errors, setErrors] = useState<ErrorInfo[]>([])
  const [taskState, setTaskState] = useState<TaskState>({
    isPaused: false,
    isCancelled: false,
    currentPhase: 'requirements',
    progress: 0,
    startTime: Date.now()
  })
  const [structuredOutput, setStructuredOutput] = useState<StructuredOutput | null>(null)
  const [activeView, setActiveView] = useState<'dashboard' | 'history' | 'files' | 'errors'>('dashboard')
  
  useEffect(() => {
    setupEventListeners()
    
    return () => {
      cleanupEventListeners()
    }
  }, [])
  
  const setupEventListeners = () => {
    const handleStreamEvent = (event: any) => {
      console.log('[MultiAgentDashboard] 收到 chat:stream 事件:', event)
      
      const data = event
      const eventType = data.type || data.eventType
      
      if (eventType === 'agent_status' || eventType === 'agent:status') {
        handleAgentStatusUpdate(data)
      } else if (eventType === 'agent_message' || eventType === 'agent:message') {
        handleAgentMessage({
          agentId: data.agentId,
          agentName: data.agentName,
          role: data.role,
          content: data.content || data.delta,
          timestamp: data.timestamp || Date.now(),
          phase: data.phase
        })
      } else if (eventType === 'progress_update' || eventType === 'progress:update') {
        handleProgressUpdate({
          phase: data.phase,
          progress: data.progress,
          message: data.message,
          subTasks: data.subTasks
        })
      } else if (eventType === 'file_created' || eventType === 'file:created') {
        handleFileCreated(data)
      } else if (eventType === 'error_occurred' || eventType === 'error:occurred') {
        handleErrorOccurred(data)
      } else if (eventType === 'task_paused' || eventType === 'task:paused') {
        setTaskState(prev => ({ ...prev, isPaused: true }))
      } else if (eventType === 'task_resumed' || eventType === 'task:resumed') {
        setTaskState(prev => ({ ...prev, isPaused: false }))
      } else if (eventType === 'task_cancelled' || eventType === 'task:cancelled') {
        setTaskState(prev => ({ ...prev, isCancelled: true, endTime: Date.now() }))
      } else if (eventType === 'task_completed' || eventType === 'task:completed') {
        setTaskState(prev => ({ ...prev, progress: 100, endTime: Date.now() }))
        onTaskComplete?.(data)
      } else if (eventType === 'structured_output' || eventType === 'structured:output') {
        handleStructuredOutput(data)
      } else if (data.agentId || data.agentName) {
        handleAgentMessage({
          agentId: data.agentId,
          agentName: data.agentName,
          role: data.role,
          content: data.content || data.delta,
          timestamp: data.timestamp || Date.now(),
          phase: data.phase
        })
      } else if (data.progress !== undefined) {
        handleProgressUpdate({
          phase: data.phase || 'implementation',
          progress: data.progress,
          message: data.message || data.description,
          subTasks: data.subTasks || data.planSteps
        })
      }
    }
    
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('chat:stream', handleStreamEvent)
      return () => {
        window.electron.ipcRenderer.removeListener('chat:stream', handleStreamEvent)
      }
    }
    
    return () => {}
  }
  
  const cleanupEventListeners = () => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.removeAllListeners('chat:stream')
    }
  }
  
  const handleAgentStatusUpdate = (data: any) => {
    const { agentId, agentType, status, context, lastOutput, iteration, model } = data
    
    const idMap: Record<string, AgentType> = {
      'agent-pm': 'pm',
      'agent-ui': 'ui',
      'agent-dev': 'dev',
      'agent-test-generator': 'test',
      'agent-code-reviewer': 'review'
    }
    
    const mappedAgentId = idMap[agentId] || (agentType ? agentType.replace('_generator', '').replace('_', '') as AgentType : 'pm')
    
    setAgents(prev => {
      const newAgents = new Map(prev)
      const existingAgent = newAgents.get(mappedAgentId)
      
      newAgents.set(mappedAgentId, {
        ...existingAgent,
        id: mappedAgentId,
        name: existingAgent?.name || getAgentName(mappedAgentId),
        role: existingAgent?.role || getAgentRole(mappedAgentId),
        status,
        context: context || existingAgent?.context || {},
        lastOutput: lastOutput || existingAgent?.lastOutput,
        iteration: iteration !== undefined ? iteration : existingAgent?.iteration,
        model: model || existingAgent?.model
      })
      
      return newAgents
    })
    
    if (status === 'working') {
      setCurrentAgent(mappedAgentId)
    }
  }
  
  const handleAgentMessage = (data: AgentMessage) => {
    setMessages(prev => [...prev, data])
    
    if (data.phase) {
      setCurrentPhase(data.phase)
    }
  }
  
  const handleProgressUpdate = (data: ProgressDetail) => {
    setProgress(data.progress)
    setProgressDetail(data)
    setTaskState(prev => ({ ...prev, progress: data.progress, currentPhase: data.phase as PhaseType }))
    setCurrentPhase(data.phase as PhaseType)
  }
  
  const handleFileCreated = (data: FileOutput) => {
    setFiles(prev => [...prev, data])
  }
  
  const handleErrorOccurred = (data: ErrorInfo) => {
    setErrors(prev => [...prev, data])
    onTaskError?.(data)
  }
  
  const handleStructuredOutput = (data: StructuredOutput) => {
    setStructuredOutput(data)
  }
  
  const getAgentName = (agentId: AgentType): string => {
    const names: Record<AgentType, string> = {
      pm: '项目经理',
      ui: 'UI设计师',
      dev: '全栈开发工程师',
      test: '测试工程师',
      review: '代码审查员'
    }
    return names[agentId] || agentId
  }
  
  const getAgentRole = (agentId: AgentType): string => {
    const roles: Record<AgentType, string> = {
      pm: '需求分析、项目规划、进度管理、质量把控',
      ui: '界面视觉设计、交互体验优化',
      dev: '代码架构设计、实现与调试',
      test: '测试用例设计、测试执行、质量评估',
      review: '代码审查，安全分析，质量评估'
    }
    return roles[agentId] || ''
  }
  
  const handlePause = async () => {
    try {
      await window.electron?.chat?.pause?.()
    } catch (error) {
      console.error('[MultiAgentDashboard] 暂停任务失败:', error)
    }
  }
  
  const handleResume = async () => {
    try {
      await window.electron?.chat?.resume?.()
    } catch (error) {
      console.error('[MultiAgentDashboard] 恢复任务失败:', error)
    }
  }
  
  const handleCancel = async () => {
    if (confirm('确定要取消当前任务吗？')) {
      try {
        await window.electron?.chat?.cancel?.()
      } catch (error) {
        console.error('[MultiAgentDashboard] 取消任务失败:', error)
      }
    }
  }
  
  const handleOpenFile = (filePath: string) => {
    console.log('[MultiAgentDashboard] 打开文件:', filePath)
  }
  
  const handleDownloadFile = (filePath: string) => {
    console.log('[MultiAgentDashboard] 下载文件:', filePath)
  }
  
  const handleRetryError = (errorId: string) => {
    console.log('[MultiAgentDashboard] 重试错误:', errorId)
  }
  
  const handleDismissError = (errorId: string) => {
    setErrors(prev => prev.filter(e => `${e.agentId}-${e.timestamp}` !== errorId))
  }
  
  const handleClearAllErrors = () => {
    setErrors([])
  }
  
  return (
    <div className="multi-agent-dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">多智能体协作工作台</h1>
        {taskId && (
          <div className="task-id">任务 ID: {taskId}</div>
        )}
      </div>
      
      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeView === 'dashboard' ? 'tab-active' : ''}`}
          onClick={() => setActiveView('dashboard')}
        >
          📊 仪表盘
        </button>
        <button 
          className={`tab-btn ${activeView === 'history' ? 'tab-active' : ''}`}
          onClick={() => setActiveView('history')}
        >
          📜 协作历史
          {messages.length > 0 && (
            <span className="tab-badge">{messages.length}</span>
          )}
        </button>
        <button 
          className={`tab-btn ${activeView === 'files' ? 'tab-active' : ''}`}
          onClick={() => setActiveView('files')}
        >
          📁 输出文件
          {files.length > 0 && (
            <span className="tab-badge">{files.length}</span>
          )}
        </button>
        <button 
          className={`tab-btn ${activeView === 'errors' ? 'tab-active' : ''}`}
          onClick={() => setActiveView('errors')}
        >
          ⚠️ 错误日志
          {errors.length > 0 && (
            <span className="tab-badge tab-badge-error">{errors.length}</span>
          )}
        </button>
      </div>
      
      <div className="dashboard-content">
        {activeView === 'dashboard' && (
          <div className="dashboard-grid">
            <div className="dashboard-section section-progress">
              <ProgressTracker 
                currentPhase={currentPhase}
                progress={progress}
                progressDetail={progressDetail}
              />
            </div>
            
            <div className="dashboard-section section-agents">
              <AgentStatusPanel 
                agents={agents}
                currentAgent={currentAgent}
              />
            </div>
            
            <div className="dashboard-section section-control">
              <TaskControlPanel 
                taskState={taskState}
                onPause={handlePause}
                onResume={handleResume}
                onCancel={handleCancel}
              />
            </div>
            
            {structuredOutput && (
              <div className="dashboard-section section-output">
                <StructuredOutputViewer output={structuredOutput} />
              </div>
            )}
          </div>
        )}
        
        {activeView === 'history' && (
          <div className="dashboard-section section-full">
            <CollaborationHistory messages={messages} />
          </div>
        )}
        
        {activeView === 'files' && (
          <div className="dashboard-section section-full">
            <FileOutputManager 
              files={files}
              onOpenFile={handleOpenFile}
              onDownloadFile={handleDownloadFile}
            />
          </div>
        )}
        
        {activeView === 'errors' && (
          <div className="dashboard-section section-full">
            <ErrorHandler 
              errors={errors}
              onRetry={handleRetryError}
              onDismiss={handleDismissError}
              onClearAll={handleClearAllErrors}
            />
          </div>
        )}
      </div>
    </div>
  )
}
