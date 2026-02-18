import React, { useState, useRef, useEffect } from 'react'

// ============================================
// 类型定义
// ============================================

// 任务状态
export type TaskStatus = 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled'

// 状态转换记录
export interface StateTransition {
  id: string
  taskId: string
  stepId?: string
  stepName?: string
  fromStatus: TaskStatus
  toStatus: TaskStatus
  timestamp: number
  duration?: number
  triggeredBy: 'user' | 'system' | 'agent'
  reason?: string
  metadata?: {
    tool?: string
    parameters?: any
    result?: any
    error?: string
    logs?: string[]
  }
}

// 执行步骤（用于时间轴）
export interface TimelineStep {
  id: string
  name: string
  status: TaskStatus
  startTime: number
  endTime?: number
  duration?: number
  tool?: string
  result?: any
  error?: string
  logs?: string[]
}

// ============================================
// 工具函数
// ============================================

// 状态颜色
const statusColors: Record<TaskStatus, string> = {
  pending: '#9ca3af',
  running: '#f59e0b',
  waiting_approval: '#3b82f6',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#6b7280'
}

// 状态标签
const statusLabels: Record<TaskStatus, string> = {
  pending: '待处理',
  running: '进行中',
  waiting_approval: '待审批',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消'
}

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  })
}

// 格式化时长
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}分${seconds}秒`
}

// ============================================
// 组件：时间轴节点
// ============================================

interface TimelineNodeProps {
  step: TimelineStep
  isActive: boolean
  isFirst: boolean
  isLast: boolean
  onClick?: (step: TimelineStep) => void
  showDetails?: boolean
}

const TimelineNode: React.FC<TimelineNodeProps> = ({
  step,
  isActive,
  isFirst,
  isLast,
  onClick,
  showDetails = false
}) => {
  const [hovered, setHovered] = useState(false)
  const nodeColor = statusColors[step.status]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        flex: showDetails ? 'none' : 1,
        minWidth: showDetails ? 'auto' : '60px'
      }}
    >
      {/* 连接线 - 上半部分 */}
      {!isFirst && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '3px',
            height: '20px',
            backgroundColor: step.status === 'completed' ? nodeColor : '#e5e7eb',
            borderRadius: '2px'
          }}
        />
      )}

      {/* 节点圆圈 */}
      <div
        onClick={() => onClick?.(step)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: hovered || isActive ? '36px' : '28px',
          height: hovered || isActive ? '36px' : '28px',
          borderRadius: '50%',
          backgroundColor: nodeColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: hovered || isActive 
            ? `0 0 0 4px ${nodeColor}30, 0 4px 12px rgba(0,0,0,0.15)` 
            : '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 1,
          border: '3px solid var(--bg-primary, #fff)'
        }}
      >
        {step.status === 'running' && (
          <div style={{
            width: '12px',
            height: '12px',
            border: '2px solid #fff',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        )}
        {step.status === 'completed' && (
          <span style={{ color: '#fff', fontSize: '14px' }}>✓</span>
        )}
        {step.status === 'failed' && (
          <span style={{ color: '#fff', fontSize: '14px' }}>✕</span>
        )}
        {step.status === 'pending' && (
          <span style={{ color: '#fff', fontSize: '10px' }}>○</span>
        )}
      </div>

      {/* 连接线 - 下半部分 */}
      {!isLast && (
        <div
          style={{
            position: 'absolute',
            top: hovered || isActive ? '36px' : '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '3px',
            flex: 1,
            minHeight: '30px',
            backgroundColor: '#e5e7eb',
            borderRadius: '2px'
          }}
        />
      )}

      {/* 节点标签 */}
      <div
        style={{
          marginTop: '8px',
          textAlign: 'center',
          maxWidth: '100px'
        }}
      >
        <div
          style={{
            fontSize: showDetails ? '13px' : '11px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {step.name}
        </div>
        {step.duration && (
          <div style={{
            fontSize: '10px',
            color: 'var(--text-secondary)',
            marginTop: '2px'
          }}>
{formatDuration(step.duration)}
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {hovered && showDetails && step.status !== 'pending' && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '8px',
            padding: '12px',
            backgroundColor: 'var(--bg-secondary, #fff)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            zIndex: 100,
            minWidth: '200px',
            maxWidth: '300px',
            border: '1px solid var(--border-color)'
          }}
        >
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: nodeColor,
            marginBottom: '8px'
          }}>
            {statusLabels[step.status]}: {step.name}
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            display: 'grid',
            gap: '4px'
          }}>
            <div>🕐 {formatTime(step.startTime)} - {step.endTime ? formatTime(step.endTime) : '进行中'}</div>
            {step.duration && <div>⏱️ 耗时: {formatDuration(step.duration)}</div>}
            {step.tool && <div>🔧 工具: {step.tool}</div>}
            {step.error && (
              <div style={{ color: '#ef4444' }}>
                ❌ {step.error.slice(0, 100)}
              </div>
            )}
          </div>
          {step.logs && step.logs.length > 0 && (
            <div style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-color)',
              maxHeight: '100px',
              overflow: 'auto'
            }}>
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '4px'
              }}>
                📋 日志
              </div>
              {step.logs.slice(0, 5).map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {log}
                </div>
              ))}
              {step.logs.length > 5 && (
                <div style={{ fontSize: '10px', color: 'var(--primary-color)' }}>
                  +{step.logs.length - 5} 条日志
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// 组件：状态流时间轴（StateTimeline）
// ============================================

interface StateTimelineProps {
  steps: TimelineStep[]
  currentStepId?: string
  onStepClick?: (step: TimelineStep) => void
  showDetails?: boolean
  horizontal?: boolean
  height?: number
}

export const StateTimeline: React.FC<StateTimelineProps> = ({
  steps,
  currentStepId,
  onStepClick,
  showDetails = true,
  horizontal = true,
  height = 180
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeStep, setActiveStep] = useState<string | null>(currentStepId || null)

  // 自动滚动到当前步骤
  useEffect(() => {
    if (currentStepId && containerRef.current) {
      const index = steps.findIndex(s => s.id === currentStepId)
      if (index >= 0) {
        const scrollPosition = (index / Math.max(steps.length - 1, 1)) * (containerRef.current.scrollWidth - containerRef.current.clientWidth)
        containerRef.current.scrollTo({ left: scrollPosition, behavior: 'smooth' })
      }
    }
  }, [currentStepId, steps])

  if (steps.length === 0) {
    return (
      <div style={{
        height: height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        fontSize: '13px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
          <div>暂无执行记录</div>
        </div>
      </div>
    )
  }

  if (!horizontal) {
    // 垂直时间轴模式
    return (
      <div style={{
        padding: '16px',
        height: height,
        overflow: 'auto'
      }}>
        {steps.map((step, index) => (
          <TimelineNode
            key={step.id}
            step={step}
            isActive={step.id === currentStepId || step.status === 'running'}
            isFirst={index === 0}
            isLast={index === steps.length - 1}
            onClick={onStepClick}
            showDetails={showDetails}
          />
        ))}
      </div>
    )
  }

  // 水平时间轴模式
  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: height,
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '20px 16px',
        backgroundColor: 'var(--bg-secondary, #f9fafb)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          minWidth: 'max-content',
          padding: '0 20px',
          gap: '8px'
        }}
      >
        {steps.map((step, index) => (
          <TimelineNode
            key={step.id}
            step={step}
            isActive={step.id === currentStepId || step.status === 'running'}
            isFirst={index === 0}
            isLast={index === steps.length - 1}
            onClick={(s) => {
              setActiveStep(s.id)
              onStepClick?.(s)
            }}
            showDetails={showDetails}
          />
        ))}
      </div>

      {/* 进度摘要 */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid var(--border-color)'
      }}>
        {(['completed', 'running', 'failed', 'pending'] as const).map(status => {
          const count = steps.filter(s => s.status === status).length
          if (count === 0) return null
          return (
            <div
              key={status}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: statusColors[status]
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: statusColors[status]
              }} />
              {statusLabels[status]}: {count}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// 组件：转换历史详情
// ============================================

interface TransitionHistoryProps {
  transitions: StateTransition[]
  maxHeight?: number
}

export const TransitionHistory: React.FC<TransitionHistoryProps> = ({
  transitions,
  maxHeight = 300
}) => {
  const sortedTransitions = [...transitions].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div style={{
      maxHeight: maxHeight,
      overflow: 'auto',
      padding: '12px'
    }}>
      {sortedTransitions.map((transition, index) => (
        <div
          key={transition.id}
          style={{
            display:'flex',
            gap: '12px',
            padding: '10px',
            borderRadius: '8px',
            marginBottom: '8px',
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: `3px solid ${statusColors[transition.toStatus]}`
          }}
        >
          {/* 时间 */}
          <div style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            minWidth: '60px'
          }}>
            {formatTime(transition.timestamp)}
          </div>

          {/* 状态变化 */}
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px'
            }}>
              <span style={{
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: statusColors[transition.fromStatus] + '20',
                color: statusColors[transition.fromStatus]
              }}>
                {statusLabels[transition.fromStatus]}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>→</span>
              <span style={{
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: statusColors[transition.toStatus] + '20',
                color: statusColors[transition.toStatus]
              }}>
                {statusLabels[transition.toStatus]}
              </span>
            </div>
            
            {/* 触发者和原因 */}
            <div style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginTop: '4px'
            }}>
              {transition.stepName && <span>📍 {transition.stepName} </span>}
              <span>
                触发: {transition.triggeredBy === 'user' ? '👤 用户' : 
                       transition.triggeredBy === 'agent' ? '🤖 Agent' : '⚙️系统'}
              </span>
              {transition.reason && <span> - {transition.reason}</span>}
            </div>

            {/* 错误信息 */}
            {transition.metadata?.error && (
              <div style={{
                marginTop: '6px',
                padding: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#ef4444'
              }}>
                ❌ {transition.metadata.error}
              </div>
            )}
          </div>

          {/* 耗时 */}
          {transition.duration && (
            <div style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap'
            }}>
              {formatDuration(transition.duration)}
            </div>
          )}
        </div>
      ))}

      {transitions.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '24px',
          color: 'var(--text-secondary)',
          fontSize: '13px'
        }}>
          暂无状态转换记录
        </div>
      )}
    </div>
  )
}

export default StateTimeline
