import React, { useState, useEffect } from 'react'

// 步骤状态
export type StepStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'skipped'

// 执行步骤接口 - 对应后端PlanStep
export interface PlanStep {
  id: string
  tool: string
  parameters: any
  description: string
  status: StepStatus
  reasoning?: string
  alternatives?: string[]
  dependsOn?: string[]
  editableParams?: {
    targetFiles?: string[]
    codeSnippet?: string
    instruction?: string
    command?: string
  }
  result?: any
  error?: string
  startTime?: number
  endTime?: number
}

// 执行计划接口 - 对应后端Plan
export interface ExecutionPlan {
  planId: string
  originalGoal: string
  steps: PlanStep[]
  reasoning: string
  decisionRationale?: string
  alternativesConsidered?: string[]
  currentStepId: string | null
  autoExecute: boolean
  createdAt: number
  updatedAt: number
}

// 属性标签映射
const toolLabelMap: Record<string, string> = {
  'create_directory': '创建目录',
  'create_file': '创建文件',
  'write_file': '写入文件',
  'execute_command': '执行命令',
  'respond_to_user': '回复用户',
  'batch_download_images': '批量下载图片',
  'read_file': '读取文件'
}

// 获取工具中文标签
const getToolLabel = (tool: string): string => {
  return toolLabelMap[tool] || tool
}

// 状态颜色映射
const statusColorMap: Record<StepStatus, string> = {
  'pending': '#94a3b8',    // gray-400
  'running': '#f59e0b',    // amber-500
  'paused': '#8b5cf6',     // violet-500
  'completed': '#10b981',  // emerald-500
  'failed': '#ef4444',     // red-500
  'skipped': '#6b7280'     // gray-500
}

// 状态标签映射
const statusLabelMap: Record<StepStatus, string> = {
  'pending': '待执行',
  'running': '执行中',
  'paused': '等待确认',
  'completed': '已完成',
  'failed': '失败',
  'skipped': '已跳过'
}

// 步骤卡片组件
interface StepCardProps {
  step: PlanStep
  index: number
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: (updates: Partial<PlanStep>) => void
  onDelete: () => void
  isDragging?: boolean
}

export const StepCard: React.FC<StepCardProps> = ({
  step,
  index,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  isDragging = false
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editDescription, setEditDescription] = useState(step.description)
  const [editCommand, setEditCommand] = useState(step.editableParams?.command || '')

  const handleSave = () => {
    onEdit({
      description: editDescription,
      editableParams: {
        ...step.editableParams,
        command: editCommand
      }
    })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditDescription(step.description)
    setEditCommand(step.editableParams?.command || '')
    setIsEditing(false)
  }

  return (
    <div
      className={`step-card ${isDragging ? 'dragging' : ''}`}
      style={{
        backgroundColor: 'var(--bg-secondary, #fff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '8px',
        opacity: isDragging ? 0.6 : 1,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.2s ease',
        boxShadow: isDragging ? '0 8px 16px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.1)'
      }}
    >
      {/* 头部 - 始终显示 */}
      <div
        onClick={onToggleExpand}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          {/* 序号 */}
          <span style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-color, #3b82f6)',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {index + 1}
          </span>
          
          {/* 状态指示器 */}
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: statusColorMap[step.status],
            flexShrink: 0,
            animation: step.status === 'running' ? 'pulse 1.5s infinite' : 'none'
          }} />
          
          {/* 标题和工具 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-primary, #1f2937)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {step.description}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'var(--text-secondary, #6b7280)',
              marginTop: '2px'
            }}>
              {getToolLabel(step.tool)}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: statusColorMap[step.status] + '20',
            color: statusColorMap[step.status],
            fontWeight: 500
          }}>
            {statusLabelMap[step.status]}
          </span>
          <button
            onClick={() => setIsEditing(!isEditing)}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '4px',
              cursor: 'pointer',
              color: 'var(--text-secondary, #6b7280)'
            }}
          >
            编辑
          </button>
          <button
            onClick={onDelete}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: 'transparent',
              border: '1px solid #fee2e2',
              borderRadius: '4px',
              cursor: 'pointer',
              color: '#ef4444'
            }}
          >
            删除
          </button>
        </div>
      </div>

      {/* 展开区域 - 显示详情和决策解释 */}
      {isExpanded && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color, #e5e7eb)'
        }}>
          {/* 决策解释 */}
          {step.reasoning && (
            <div style={{
              marginBottom: '12px',
              padding: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              borderRadius: '6px',
              borderLeft: '3px solid #3b82f6'
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#3b82f6',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                🤖 AI决策理由
              </div>
              <div style={{
                fontSize: '13px',
                color: 'var(--text-primary, #374151)',
                fontFamily: 'monospace',
                lineHeight: '1.5'
              }}>
                {step.reasoning}
              </div>
            </div>
          )}

          {/* 替代方案 */}
          {step.alternatives && step.alternatives.length > 0 && (
            <div style={{
              marginBottom: '12px',
              padding: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              borderRadius: '6px',
              borderLeft: '3px solid #10b981'
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#10b981',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                📋 考虑的替代方案
              </div>
              <ul style={{
                fontSize: '13px',
                color: 'var(--text-primary, #374151)',
                margin: 0,
                paddingLeft: '16px'
              }}>
                {step.alternatives.map((alt, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{alt}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 编辑模式 */}
          {isEditing && (
            <div style={{
              padding: '12px',
              backgroundColor: 'var(--bg-tertiary, #f9fafb)',
              borderRadius: '6px'
            }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-secondary, #6b7280)',
                  marginBottom: '4px'
                }}>
                  步骤描述
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '13px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-secondary, #fff)',
                    color: 'var(--text-primary, #1f2937)'
                  }}
                />
              </div>
              
              {step.tool === 'execute_command' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-secondary, #6b7280)',
                    marginBottom: '4px'
                  }}>
                    命令
                  </label>
                  <input
                    type="text"
                    value={editCommand}
                    onChange={e => setEditCommand(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '13px',
                      border: '1px solid var(--border-color, #e5e7eb)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-secondary, #fff)',
                      color: 'var(--text-primary, #1f2937)',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleCancel}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary, #6b7280)'
                  }}
                >
                  取消
                </button>
                <button
onClick={handleSave}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: 'var(--primary-color, #3b82f6)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#fff'
                  }}
                >
                  保存
                </button>
              </div>
            </div>
          )}

          {/* 执行结果 */}
          {step.result && (
            <div style={{
              padding: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              borderRadius: '6px',
              fontSize: '12px',
              color: 'var(--text-primary, #374151)',
              fontFamily: 'monospace',
              maxHeight: '100px',
              overflow: 'auto'
            }}>
              <strong>执行结果:</strong> {JSON.stringify(step.result).slice(0, 200)}...
            </div>
          )}

          {/* 错误信息 */}
          {step.error && (
            <div style={{
              padding: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#ef4444',
              marginTop: '8px'
            }}>
              <strong>错误:</strong> {step.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 计划编辑器主组件
interface PlanEditorProps {
  plan: ExecutionPlan | null
  onPlanUpdate?: (updatedPlan: ExecutionPlan) => void
  onExecute?: () => void
  onPause?: () => void
}

export const PlanEditor: React.FC<PlanEditorProps> = ({
  plan,
  onPlanUpdate,
  onExecute,
  onPause
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  // 初始化时展开第一个步骤
  useEffect(() => {
    if (plan?.steps && plan.steps.length > 0) {
      setExpandedSteps(new Set([plan.steps[0].id]))
    }
  }, [plan?.planId])

  const toggleExpand = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev)
      if (newSet.has(stepId)) {
        newSet.delete(stepId)
      } else {
        newSet.add(stepId)
      }
      return newSet
    })
  }

  const handleStepUpdate = (stepId: string, updates: Partial<PlanStep>) => {
    if (!plan || !onPlanUpdate) return
    
    const updatedSteps = plan.steps.map(s => 
      s.id === stepId ? { ...s, ...updates } : s
    )
    
    onPlanUpdate({
      ...plan,
      steps: updatedSteps,
      updatedAt: Date.now()
    })
  }

  const handleStepDelete = (stepId: string) => {
    if (!plan || !onPlanUpdate) return
    
    const updatedSteps = plan.steps.filter(s => s.id !== stepId)
    
    onPlanUpdate({
      ...plan,
      steps: updatedSteps,
      updatedAt: Date.now()
    })
  }

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (!plan || !onPlanUpdate) return
    
    const newSteps = [...plan.steps]
    const [removed] = newSteps.splice(fromIndex, 1)
    newSteps.splice(toIndex, 0, removed)
    
    onPlanUpdate({
      ...plan,
      steps: newSteps,
      updatedAt: Date.now()
    })
  }

  // 按状态分组（看板模式）
  const stepsByStatus = plan?.steps.reduce((acc, step) => {
    if (!acc[step.status]) {
      acc[step.status] = []
    }
    acc[step.status].push(step)
    return acc
  }, {} as Record<StepStatus, PlanStep[]>) || {}

  if (!plan) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: 'var(--text-secondary, #6b7280)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
        <div>暂无执行计划</div>
        <div style={{ fontSize: '12px', marginTop: '4px' }}>
          输入任务后，AI将生成执行计划
        </div>
      </div>
    )
  }

  return (
    <div className="plan-editor" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 头部 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color, #e5e7eb)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-secondary, #f9fafb)'
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>
            执行计划
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #6b7280)', marginTop: '2px' }}>
            {plan.steps.length} 步骤 · {plan.reasoning?.slice(0, 50)}...
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* 视图切换 */}
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary, #f3f4f6)', borderRadius: '6px', padding: '2px' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: viewMode === 'list' ? 'var(--bg-secondary, #fff)' : 'transparent',
                color: viewMode === 'list' ? 'var(--primary-color, #3b82f6)' : 'var(--text-secondary, #6b7280)',
                boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              📝 列表
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: viewMode=== 'kanban' ? 'var(--bg-secondary, #fff)' : 'transparent',
                color: viewMode === 'kanban' ? 'var(--primary-color, #3b82f6)' : 'var(--text-secondary, #6b7280)',
                boxShadow: viewMode === 'kanban' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              📊 看板
            </button>
          </div>
          
          {/* 执行控制 */}
          {plan.autoExecute ? (
            <button
              onClick={onPause}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: '#f59e0b',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#fff'
              }}
            >
              ⏸ 暂停
            </button>
          ) : (
            <button
              onClick={onExecute}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: 'var(--primary-color, #3b82f6)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#fff'
              }}
            >
              ▶ 执行
            </button>
          )}
        </div>
      </div>

      {/* 整体决策解释 */}
      {plan.decisionRationale && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          borderBottom: '1px solid var(--border-color, #e5e7eb)'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#3b82f6',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            🎯 整体规划思路
          </div>
          <div style={{
            fontSize: '13px',
            color: 'var(--text-primary, #374151)',
            lineHeight: '1.5'
          }}>
            {plan.decisionRationale}
          </div>
        </div>
      )}

      {/* 内容区域 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {viewMode === 'list' ? (
          /* 列表视图 */
          <div className="step-list">
            {plan.steps.map((step, index) => (
              <div
                key={step.id}
                className="step-item"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}
              >
                {/* 拖拽手柄和连接线 */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '24px',
                  flexShrink: 0
                }}>
                  {/* 上下拖拽按钮 */}
                  <button
                    onClick={() => index > 0 && handleReorder(index, index - 1)}
                    disabled={index === 0}
                    style={{
                      width: '20px',
                      height: '16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                      opacity: index === 0 ? 0.3 : 0.6,
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ▲
                  </button>
                  
                  {/* 连接线 */}
                  {index < plan.steps.length - 1 && (
                    <div style={{
                      width: '2px',
                      flex: 1,
                      backgroundColor: 'var(--border-color, #e5e7eb)',
                      minHeight: '20px'
                    }} />
                  )}
                  
                  <button
                    onClick={() => index < plan.steps.length - 1 && handleReorder(index, index + 1)}
                    disabled={index === plan.steps.length - 1}
                    style={{
                      width: '20px',
                      height: '16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: index === plan.steps.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: index === plan.steps.length - 1 ? 0.3 : 0.6,
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ▼
                  </button>
                </div>

                {/* 步骤卡片 */}
                <div style={{ flex: 1 }}>
                  <StepCard
                    step={step}
                    index={index}
                    isExpanded={expandedSteps.has(step.id)}
                    onToggleExpand={() => toggleExpand(step.id)}
                    onEdit={(updates) => handleStepUpdate(step.id, updates)}
                    onDelete={() => handleStepDelete(step.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 看板视图 */
          <div className="kanban-view" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            height: '100%'
          }}>
            {/* 待执行列 */}
            <KanbanColumn
              title="待执行"
              status="pending"
              steps={stepsByStatus.pending || []}
              expandedSteps={expandedSteps}
              onToggleExpand={toggleExpand}
              onStepUpdate={handleStepUpdate}
              onStepDelete={handleStepDelete}
            />
            {/* 执行中列 */}
            <KanbanColumn
              title="执行中"
              status="running"
              steps={stepsByStatus.running || []}
              expandedSteps={expandedSteps}
              onToggleExpand={toggleExpand}
              onStepUpdate={handleStepUpdate}
              onStepDelete={handleStepDelete}
            />
            {/* 已完成列 */}
            <KanbanColumn
              title="已完成"
              status="completed"
              steps={[
                ...(stepsByStatus.completed || []),
                ...(stepsByStatus.failed || []),
                ...(stepsByStatus.skipped || [])
              ]}
              expandedSteps={expandedSteps}
              onToggleExpand={toggleExpand}
              onStepUpdate={handleStepUpdate}
              onStepDelete={handleStepDelete}
            />
          </div>
        )}
      </div>

      {/* 动画样式 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .step-card:hover {
          border-color: var(--primary-color, #3b82f6) !important;
        }
      `}</style>
    </div>
  )
}

// 看板列组件
interface KanbanColumnProps {
  title: string
  status: StepStatus
  steps: PlanStep[]
  expandedSteps: Set<string>
  onToggleExpand: (id: string) => void
  onStepUpdate: (id: string, updates: Partial<PlanStep>) => void
  onStepDelete: (id: string) => void
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  status,
  steps,
  expandedSteps,
  onToggleExpand,
  onStepUpdate,
  onStepDelete
}) => {
  return (
    <div style={{
      backgroundColor: 'var(--bg-tertiary, #f3f4f6)',
      borderRadius: '8px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '200px'
    }}>
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--text-secondary, #6b7280)',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: statusColorMap[status]
        }} />
        {title}
        <span style={{
          marginLeft: 'auto',
          fontSize: '11px',
          backgroundColor: 'var(--bg-secondary, #fff)',
          padding: '2px 6px',
          borderRadius: '10px'
        }}>
          {steps.length}
        </span>
      </div>
      
      <div style={{ flex: 1, overflow: 'auto' }}>
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            isExpanded={expandedSteps.has(step.id)}
            onToggleExpand={() => onToggleExpand(step.id)}
            onEdit={(updates) => onStepUpdate(step.id, updates)}
            onDelete={() => onStepDelete(step.id)}
          />
        ))}
      </div>
    </div>
  )
}

// 导出组件和类型
export { PlanEditor, StepCard }
export type { PlanStep, ExecutionPlan, StepStatus }
