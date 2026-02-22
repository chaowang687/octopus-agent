import React, { useState, useEffect } from 'react'
import { PlanViewer } from './PlanViewer'
import { DecisionDialog, DecisionOption } from './DecisionDialog'
import { ProjectManagement } from './ProjectManagement'

interface PlanStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  executor?: string
  dependencies: string[]
  decisionPoints: Array<{
    id: string
    title: string
    status: 'pending' | 'completed'
    selectedOption?: string
  }>
  logs: string[]
}

interface CollaborationSession {
  id: string
  requirementId: string
  planId: string
  status: 'planning' | 'awaiting_decision' | 'executing' | 'completed' | 'failed'
  userId: string
  projectId?: string
  createdAt: number
  updatedAt: number
}

interface CollaborationWorkspaceProps {
  sessionId: string
  onClose?: () => void
}

export const CollaborationWorkspace: React.FC<CollaborationWorkspaceProps> = ({
  sessionId,
  onClose
}) => {
  const [session, setSession] = useState<CollaborationSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [decisionDialog, setDecisionDialog] = useState<{
    isOpen: boolean
    decisionId: string
    stepTitle: string
    title: string
    description: string
    options: DecisionOption[]
  }>({
    isOpen: false,
    decisionId: '',
    stepTitle: '',
    title: '',
    description: '',
    options: []
  })
  const [showProjectManagement, setShowProjectManagement] = useState(false)

  useEffect(() => {
    loadSession()
    setupEventListeners()
    
    return () => {
      cleanupEventListeners()
    }
  }, [sessionId])

  const loadSession = async () => {
    try {
      const response = await window.electron.library.getCollaborationSession(sessionId)
      if (response.success) {
        setSession(response.data)
      }
    } catch (error) {
      console.error('加载协作会话失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupEventListeners = () => {
    if (window.electron.collaboration) {
      window.electron.collaboration.onEvent((event) => {
        handleCollaborationEvent(event)
      })
    }
  }

  const cleanupEventListeners = () => {
    if (window.electron.collaboration) {
      window.electron.collaboration.offEvent()
    }
  }

  const handleCollaborationEvent = (event: any) => {
    console.log('[CollaborationWorkspace] 收到事件:', event.type, event.data)

    switch (event.type) {
      case 'session:updated':
        setSession(event.data)
        break
      case 'decision:requested':
        showDecisionDialog(event.data)
        break
      case 'decision:completed':
        handleDecisionCompleted(event.data)
        break
      case 'session:completed':
        handleSessionCompleted(event.data)
        break
      case 'session:cancelled':
        handleSessionCancelled(event.data)
        break
    }
  }

  const showDecisionDialog = (data: any) => {
    setDecisionDialog({
      isOpen: true,
      decisionId: data.decisionId,
      stepTitle: data.decision.title,
      title: data.decision.title,
      description: data.decision.description,
      options: data.decision.options
    })
  }

  const handleDecisionCompleted = (data: any) => {
    console.log('[CollaborationWorkspace] 决策已完成:', data.decisionId)
    setDecisionDialog(prev => ({ ...prev, isOpen: false }))
    loadSession()
  }

  const handleSessionCompleted = (data: any) => {
    console.log('[CollaborationWorkspace] 会话已完成:', data.planId)
    loadSession()
  }

  const handleSessionCancelled = (data: any) => {
    console.log('[CollaborationWorkspace] 会话已取消:', data.reason)
    loadSession()
  }

  const handleDecisionSelect = async (optionId: string, reason?: string) => {
    try {
      const response = await window.electron.library.makeSessionDecision(
        sessionId,
        decisionDialog.decisionId,
        optionId,
        reason
      )
      
      if (response.success) {
        setDecisionDialog(prev => ({ ...prev, isOpen: false }))
      } else {
        alert('决策失败: ' + response.error)
      }
    } catch (error) {
      console.error('决策失败:', error)
      alert('决策失败，请重试')
    }
  }

  const handleDecisionCancel = () => {
    setDecisionDialog(prev => ({ ...prev, isOpen: false }))
  }

  const handleExecutePlan = async () => {
    if (!session) return

    try {
      const response = await window.electron.library.executePlan(sessionId)
      if (response.success) {
        console.log('[CollaborationWorkspace] 计划执行已启动')
      } else {
        alert('启动执行失败: ' + response.error)
      }
    } catch (error) {
      console.error('启动执行失败:', error)
      alert('启动执行失败，请重试')
    }
  }

  const handleStepClick = (step: PlanStep) => {
    console.log('[CollaborationWorkspace] 点击步骤:', step.id)
  }

  const handleEditPlan = () => {
    console.log('[CollaborationWorkspace] 编辑计划')
  }

  const handleLinkToProject = async () => {
    if (!session) return

    setShowProjectManagement(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (showProjectManagement) {
    return (
      <ProjectManagement
        onBack={() => setShowProjectManagement(false)}
      />
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        协作会话不存在
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">协作工作区</h1>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
              {session.status}
            </span>
            {session.projectId && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                已关联项目
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLinkToProject}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              {session.projectId ? '管理项目' : '关联项目'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          <PlanViewer
            planId={session.planId}
            onStepClick={handleStepClick}
            onEdit={handleEditPlan}
            onExecute={handleExecutePlan}
          />
        </div>
      </main>

      <DecisionDialog
        isOpen={decisionDialog.isOpen}
        decisionId={decisionDialog.decisionId}
        stepTitle={decisionDialog.stepTitle}
        title={decisionDialog.title}
        description={decisionDialog.description}
        options={decisionDialog.options}
        onSelect={handleDecisionSelect}
        onCancel={handleDecisionCancel}
      />
    </div>
  )
}
