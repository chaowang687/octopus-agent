import React, { useState, useEffect } from 'react'

interface PlanStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  executor?: string
  startTime?: number
  endTime?: number
  dependencies: string[]
  decisionPoints: Array<{
    id: string
    title: string
    status: 'pending' | 'completed'
    selectedOption?: string
  }>
  logs: string[]
  metadata?: {
    estimatedTime?: number
    actualTime?: number
    priority?: 'low' | 'medium' | 'high'
  }
}

interface Plan {
  id: string
  title: string
  content: string
  steps: PlanStep[]
  metadata: {
    goal: string
    priority: 'low' | 'medium' | 'high'
    estimatedTime: number
    actualTime?: number
    risks: string[]
    resources: string[]
    tags: string[]
  }
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  createdAt: number
  updatedAt: number
}

interface Progress {
  totalSteps: number
  completedSteps: number
  inProgressSteps: number
  failedSteps: number
  percentage: number
  estimatedTimeRemaining?: number
}

interface PlanViewerProps {
  planId: string
  onStepClick?: (step: PlanStep) => void
  onEdit?: () => void
  onExecute?: () => void
}

export const PlanViewer: React.FC<PlanViewerProps> = ({
  planId,
  onStepClick,
  onEdit,
  onExecute
}) => {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadPlan()
    loadProgress()
  }, [planId])

  const loadPlan = async () => {
    try {
      const response = await window.electron.library.getDocument(planId)
      if (response.success && response.data) {
        const doc = response.data
        const planData: Plan = {
          id: doc.id,
          title: doc.title,
          content: doc.content,
          steps: parseStepsFromContent(doc.content),
          metadata: doc.metadata || {
            goal: '',
            priority: 'medium',
            estimatedTime: 3600,
            risks: [],
            resources: [],
            tags: []
          },
          status: doc.metadata?.status || 'draft',
          createdAt: doc.metadata?.createdAt || Date.now(),
          updatedAt: doc.metadata?.updatedAt || Date.now()
        }
        setPlan(planData)
      }
    } catch (error) {
      console.error('加载计划失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProgress = async () => {
    try {
      if (plan && plan.steps.length > 0) {
        const completedSteps = plan.steps.filter((s: PlanStep) => s.status === 'completed').length
        const inProgressSteps = plan.steps.filter((s: PlanStep) => s.status === 'in_progress').length
        const failedSteps = plan.steps.filter((s: PlanStep) => s.status === 'failed').length
        const totalSteps = plan.steps.length

        setProgress({
          totalSteps,
          completedSteps,
          inProgressSteps,
          failedSteps,
          percentage: totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0
        })
      }
    } catch (error) {
      console.error('加载进度失败:', error)
    }
  }

  const parseStepsFromContent = (content: string): PlanStep[] => {
    const steps: PlanStep[] = []
    const lines = content.split('\n')
    let currentStep: Partial<PlanStep> | null = null

    for (const line of lines) {
      if (line.startsWith('### 步骤')) {
        if (currentStep && currentStep.id) {
          steps.push(currentStep as PlanStep)
        }
        const stepTitle = line.replace('### 步骤', '').trim()
        currentStep = {
          id: `step_${steps.length + 1}`,
          title: stepTitle,
          description: '',
          status: 'pending',
          dependencies: [],
          decisionPoints: [],
          logs: []
        }
      } else if (currentStep && line.startsWith('**任务**')) {
        const taskIndex = lines.indexOf(line)
        currentStep.description = lines.slice(taskIndex + 1, taskIndex + 5).join('\n').trim()
      }
    }

    if (currentStep && currentStep.id) {
      steps.push(currentStep as PlanStep)
    }

    return steps
  }

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId)
    } else {
      newExpanded.add(stepId)
    }
    setExpandedSteps(newExpanded)
  }

  const getStatusEmoji = (status: PlanStep['status']): string => {
    const emojis: Record<PlanStep['status'], string> = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅',
      failed: '❌',
      skipped: '⏭️'
    }
    return emojis[status] || '⏳'
  }

  const getStatusColor = (status: PlanStep['status']): string => {
    const colors: Record<PlanStep['status'], string> = {
      pending: 'text-gray-500',
      in_progress: 'text-blue-500',
      completed: 'text-green-500',
      failed: 'text-red-500',
      skipped: 'text-gray-400'
    }
    return colors[status] || 'text-gray-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        计划不存在
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{plan.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            创建于 {new Date(plan.createdAt).toLocaleString('zh-CN')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            编辑
          </button>
          <button
            onClick={onExecute}
            disabled={plan.status !== 'draft'}
            className={`px-4 py-2 rounded-lg transition-colors ${
              plan.status === 'draft'
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            开始执行
          </button>
        </div>
      </div>

      {progress && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">执行进度</span>
            <span className="text-sm font-bold text-blue-600">
              {progress.percentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>总步骤: {progress.totalSteps}</span>
            <span>已完成: {progress.completedSteps}</span>
            <span>进行中: {progress.inProgressSteps}</span>
            <span>失败: {progress.failedSteps}</span>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">目标</h2>
        <p className="text-gray-700">{plan.metadata.goal}</p>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">步骤</h2>
        <div className="space-y-3">
          {plan.steps.map((step: PlanStep, index: number) => (
            <div
              key={step.id}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleStep(step.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xl ${getStatusColor(step.status)}`}>
                    {getStatusEmoji(step.status)}
                  </span>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">
                      步骤{index + 1}: {step.title}
                    </div>
                    <div className="text-sm text-gray-500">
                      状态: {step.status}
                      {step.executor && ` | 执行者: ${step.executor}`}
                    </div>
                  </div>
                </div>
                <span className="text-gray-400">
                  {expandedSteps.has(step.id) ? '▼' : '▶'}
                </span>
              </button>

              {expandedSteps.has(step.id) && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">任务</h3>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {step.description}
                    </p>
                  </div>

                  {step.dependencies.length > 0 && (
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">依赖</h3>
                      <div className="flex flex-wrap gap-1">
                        {step.dependencies.map((depId: string) => {
                          const depStep = plan.steps.find((s: PlanStep) => s.id === depId)
                          return depStep ? (
                            <span
                              key={depId}
                              className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                            >
                              {depStep.title}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                  )}

                  {step.decisionPoints.length > 0 && (
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">决策点</h3>
                      <div className="space-y-2">
                        {step.decisionPoints.map((dp) => (
                          <div
                            key={dp.id}
                            className="flex items-center gap-2 p-2 bg-yellow-50 rounded border border-yellow-200"
                          >
                            <span className="text-sm">
                              {dp.status === 'pending' ? '⏳' : '✅'}
                            </span>
                            <span className="text-sm text-gray-700">
                              {dp.title}
                            </span>
                            {dp.status === 'completed' && dp.selectedOption && (
                              <span className="text-xs text-green-600">
                                已选择: {dp.selectedOption}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {step.logs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">执行日志</h3>
                      <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono max-h-32 overflow-y-auto">
                        {step.logs.slice(-5).map((log: string, idx: number) => (
                          <div key={idx} className="mb-1">
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => onStepClick?.(step)}
                    className="mt-3 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                  >
                    查看详情
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {plan.metadata.risks.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">风险与缓解</h2>
          <div className="space-y-2">
            {plan.metadata.risks.map((risk: string, index: number) => (
              <div
                key={index}
                className="p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="text-sm text-red-800">{risk}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.metadata.resources.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">资源需求</h2>
          <div className="flex flex-wrap gap-2">
            {plan.metadata.resources.map((resource: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {resource}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
