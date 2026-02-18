import React, { useState, useEffect, useRef } from 'react'

// ============================================
// 类型定义
// ============================================

// 任务状态
export type TaskStatus = 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled'

// 任务类型
export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority?: 'low' | 'medium' | 'high' | 'critical'
  assignee?: string
  createdAt: number
  updatedAt: number
  dueDate?: number
  tags?: string[]
  subtasks?: Task[]
  parentId?: string
  dependencies?: string[]
  metadata?: {
    progress?: number
    effort?: number
    risk?: 'low' | 'medium' | 'high'
    impactAnalysis?: ImpactAnalysis
  }
}

// 影响分析
export interface ImpactAnalysis {
  risk: 'low' | 'medium' | 'high'
  affectedFiles: number
  affectedModules: string[]
  complexity: number
  recommendations?: string[]
}

// 执行计划节点（树形结构）
export interface PlanNode {
  id: string
  title: string
  description: string
  type: 'goal' | 'milestone' | 'task' | 'subtask'
  status: TaskStatus
  children?: PlanNode[]
  impactAnalysis?: ImpactAnalysis
  dependencies?: string[]
  startTime?: number
  endTime?: number
  result?: any
}

// 状态转换记录
export interface StateTransition {
  id: string
  taskId: string
  fromStatus: TaskStatus
  toStatus: TaskStatus
  timestamp: number
  triggeredBy: 'user' | 'system' | 'agent'
  reason?: string
  metadata?: any
}

// ============================================
// 工具函数
// ============================================

// 状态颜色映射
const statusColors: Record<TaskStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
  running: { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
  waiting_approval: { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' },
  completed: { bg: '#d1fae5', text: '#059669', border: '#6ee7b7' },
  failed: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
  cancelled: { bg: '#f3f4f6', text: '#9ca3af', border: '#d1d5db' }
}

// 优先级颜色
const priorityColors: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#7c3aed'
}

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return date.toLocaleDateString('zh-CN')
}

// 格式化持续时间
const formatDuration = (start: number, end?: number): string => {
  const duration = (end || Date.now()) - start
  if (duration < 1000) return '<1秒'
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}秒`
  if (duration < 3600000) return `${Math.floor(duration / 60000)}分${Math.floor((duration % 60000) / 1000)}秒`
  return `${Math.floor(duration / 3600000)}小时${Math.floor((duration % 3600000) / 60000)}分`
}

// ============================================
// 组件：状态徽章
// ============================================

interface StatusBadgeProps {
  status: TaskStatus
  size?: 'sm' | 'md' | 'lg'
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const statusLabels: Record<TaskStatus, string> = {
    pending: '待处理',
    running: '进行中',
    waiting_approval: '待审批',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  
  const statusIcons: Record<TaskStatus, string> = {
    pending: '⏳',
    running: '⚡',
    waiting_approval: '👀',
    completed: '✅',
    failed: '❌',
    cancelled: '🚫'
  }

  const sizeStyles = {
    sm: { padding: '2px 6px', fontSize: '10px' },
    md: { padding: '4px 10px', fontSize: '12px' },
    lg: { padding: '6px 14px', fontSize: '14px' }
  }

  const colors = statusColors[status]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: sizeStyles[size].padding,
        fontSize: sizeStyles[size].fontSize,
        fontWeight: 500,
        borderRadius: '12px',
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`
      }}
    >
      {statusIcons[status]} {statusLabels[status]}
    </span>
  )
}

// ============================================
// 组件：任务卡片（TaskCard）- 对话式任务看板
// ============================================

interface TaskCardProps {
  task: Task
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void
  onClick?: (task: Task) => void
  onApprove?: (taskId: string) => void
  onRetry?: (taskId: string) => void
  expanded?: boolean
  onExpandChange?: (expanded: boolean) => void
  showTimeline?: boolean
  transitions?: StateTransition[]
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onStatusChange,
  onClick,
  onApprove,
  onRetry,
  expanded = false,
  onExpandChange,
  showTimeline = false,
  transitions = []
}) => {
  const [localExpanded, setLocalExpanded] = useState(expanded)
  const isExpanded = expanded !== undefined ? expanded : localExpanded

  const toggleExpand = () => {
    if (onExpandChange) {
      onExpandChange(!isExpanded)
    } else {
      setLocalExpanded(!isExpanded)
    }
  }

  // 计算执行时长
  const duration = task.metadata?.progress !== undefined && task.updatedAt > task.createdAt
    ? formatDuration(task.createdAt, task.updatedAt)
    : null

  return (
    <div
      onClick={() => onClick?.(task)}
      style={{
        backgroundColor: 'var(--bg-secondary, #fff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        borderLeft: `4px solid ${statusColors[task.status].border.replace('border:', '')}`
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            {/* 优先级指示器 */}
            {task.priority && (
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: priorityColors[task.priority]
                }}
                title={`优先级: ${task.priority}`}
              />
            )}
            {/* 标题 */}
            <h3 style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary, #1f2937)',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {task.title}
            </h3>
          </div>
          {task.description && (
            <p style={{
              fontSize: '13px',
              color: 'var(--text-secondary, #6b7280)',
              margin: '4px 0 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {task.description}
            </p>
          )}
        </div>
        
        {/* 状态徽章 */}
        <StatusBadge status={task.status} size="sm" />
      </div>

      {/* 元信息行 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '12px',
        color: 'var(--text-secondary, #9ca3af)',
        marginBottom: '12px'
      }}>
        <span>📅 {formatTime(task.createdAt)}</span>
        {duration && <span>⏱️ {duration}</span>}
        {task.assignee && <span>👤 {task.assignee}</span>}
        {task.metadata?.progress !== undefined && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <div style={{
              width: '60px',
              height: '4px',
              backgroundColor: '#e5e7eb',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${task.metadata.progress}%`,
                height: '100%',
                backgroundColor: statusColors[task.status].text,
                borderRadius: '2px'
              }} />
            </div>
            {task.metadata.progress}%
          </span>
        )}
      </div>

      {/* 影响分析摘要 */}
      {task.metadata?.impactAnalysis && (
        <div style={{
          padding: '10px',
          backgroundColor: task.metadata.impactAnalysis.risk === 'high' 
            ? 'rgba(239, 68, 68, 0.08)' 
            : task.metadata.impactAnalysis.risk === 'medium'
            ? 'rgba(245, 158, 11, 0.08)'
            : 'rgba(16, 185, 129, 0.08)',
          borderRadius: '8px',
          marginBottom: '12px',
          borderLeft: `3px solid ${
            task.metadata.impactAnalysis.risk === 'high' 
              ? '#ef4444' 
              : task.metadata.impactAnalysis.risk === 'medium'
              ? '#f59e0b'
              : '#10b981'
          }`
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '4px'
          }}>
            📊 影响范围分析
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            display: 'flex',
            gap: '12px'
          }}>
            <span>📁 {task.metadata.impactAnalysis.affectedFiles} 个文件</span>
            <span>📦 {task.metadata.impactAnalysis.affectedModules.slice(0, 3).join(', ')}</span>
            <span>⚠️ 风险: {task.metadata.impactAnalysis.risk}</span>
          </div>
        </div>
      )}

      {/* 标签 */}
      {task.tags && task.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {task.tags.map((tag, idx) => (
            <span
              key={idx}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                backgroundColor: 'var(--bg-tertiary, #f3f4f6)',
                borderRadius: '4px',
                color: 'var(--text-secondary)'
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 展开内容 */}
      {isExpanded && (
        <div style={{
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color, #e5e7eb)'
        }}>
          {/* 子任务列表 */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '8px'
              }}>
                子任务 ({task.subtasks.length})
              </div>
              {task.subtasks.map((subtask, idx) => (
                <div
                  key={subtask.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 0',
                    fontSize: '13px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={subtask.status === 'completed'}
                    readOnly
                    style={{ accentColor: statusColors[subtask.status].text }}
                  />
                  <span style={{
                    textDecoration: subtask.status === 'completed' ? 'line-through' : 'none',
                    color: subtask.status === 'completed' ? 'var(--text-secondary)' : 'inherit'
                  }}>
                    {subtask.title}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {task.status === 'waiting_approval' && onApprove && (
              <button
                onClick={(e) => { e.stopPropagation(); onApprove(task.id) }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ✅ 批准执行
              </button>
            )}
            {task.status === 'failed' && onRetry && (
              <button
                onClick={(e) => { e.stopPropagation(); onRetry(task.id) }}
                style={{
                  padding: '6px 12px',
fontSize: '12px',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                🔄 重试
              </button>
            )}
            {task.status === 'running' && onStatusChange && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, 'cancelled') }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: 'transparent',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ⏹ 取消
              </button>
            )}
          </div>
        </div>
      )}

      {/* 展开/收起按钮 */}
      <div
        onClick={(e) => { e.stopPropagation(); toggleExpand() }}
        style={{
          textAlign: 'center',
          paddingTop: '8px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          cursor: 'pointer'
        }}
      >
        {isExpanded ? '▲ 收起' : '▼ 展开详情'}
      </div>
    </div>
  )
}

// ============================================
// 组件：任务流程（TaskFlow）- 对话式任务看板容器
// ============================================

interface TaskFlowProps {
  tasks: Task[]
  onTaskClick?: (task: Task) => void
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void
  onApprove?: (taskId: string) => void
  onRetry?: (taskId: string) => void
  viewMode?: 'list' | 'kanban' | 'timeline'
  groupBy?: 'status' | 'priority' | 'assignee' | 'none'
  showImpactAnalysis?: boolean
}

export const TaskFlow: React.FC<TaskFlowProps> = ({
  tasks,
  onTaskClick,
  onStatusChange,
  onApprove,
  onRetry,
  viewMode = 'list',
  groupBy = 'none',
  showImpactAnalysis = true
}) => {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

  // 按状态分组
  const groupedTasks = groupBy !== 'none'
    ? tasks.reduce((acc, task) => {
        const key = groupBy === 'status' 
          ? task.status 
          : groupBy === 'priority' 
          ? task.priority || 'low'
          : task.assignee || 'unassigned'
        
        if (!acc[key]) acc[key] = []
        acc[key].push(task)
        return acc
      }, {} as Record<string, Task[]>)
    : { all: tasks }

  const groupLabels: Record<string, string> = {
    pending: '待处理',
    running: '进行中',
    waiting_approval: '待审批',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    low: '低优先级',
    medium: '中优先级',
    high: '高优先级',
    critical: '紧急',
    unassigned: '未分配',
    all: '全部任务'
  }

  // 看板列定义
  const kanbanColumns: TaskStatus[] = ['pending', 'running', 'waiting_approval', 'completed', 'failed']

  if (viewMode === 'kanban') {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        padding: '16px'
      }}>
        {kanbanColumns.map(status => {
          const columnTasks = tasks.filter(t => t.status === status)
          return (
            <div
              key={status}
              style={{
                backgroundColor: 'var(--bg-tertiary, #f9fafb)',
                borderRadius: '12px',
                padding: '12px',
                minHeight: '200px'
              }}
            >
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: statusColors[status].text
                }} />
                {groupLabels[status] || status}
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '11px',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}>
                  {columnTasks.length}
                </span>
              </div>
              <div>
                {columnTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={onTaskClick}
                    onStatusChange={onStatusChange}
                    onApprove={onApprove}
                    onRetry={onRetry}
                    expanded={expandedTaskId === task.id}
                    onExpandChange={(expanded) => setExpandedTaskId(expanded ? task.id : null)}
                    showImpactAnalysis={showImpactAnalysis}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // 列表视图
  return (
    <div style={{ padding: '16px' }}>
      {Object.entries(groupedTasks).map(([groupKey, groupTasks]) => (
        <div key={groupKey} style={{ marginBottom: '24px' }}>
          {groupBy !== 'none' && (
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--border-color, #e5e7eb)'
            }}>
              {groupLabels[groupKey] || groupKey}
              <span style={{
                marginLeft: '8px',
                fontSize: '12px',
                fontWeight: 400,
                color: 'var(--text-secondary)'
              }}>
                ({groupTasks.length})
              </span>
            </div>
          )}
          {groupTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              onStatusChange={onStatusChange}
              onApprove={onApprove}
              onRetry={onRetry}
              expanded={expandedTaskId === task.id}
              onExpandChange={(expanded) => setExpandedTaskId(expanded ? task.id : null)}
              showImpactAnalysis={showImpactAnalysis}
            />
          ))}
        </div>
      ))}
      
      {tasks.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <div>暂无任务</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>
            在聊天中发起任务即可创建任务卡片
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskFlow
