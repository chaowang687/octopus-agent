import React, { useState } from 'react'

// ReAct步骤类型
type ReActStepType = 'think' | 'act' | 'observe' | 'reflect' | 'final'

// ReAct步骤接口
interface ReActStep {
  id: string
  type: ReActStepType
  thought?: string
  action?: string
  actionInput?: any
  observation?: string
  reflection?: string
  result?: any
  confidence?: number
  error?: string
  timestamp: number
  durationMs?: number
}

// 步骤类型配置
const stepTypeConfig = {
  think: { 
    color: '#8b5cf6', 
    bg: '#8b5cf620', 
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    ),
    label: '思考'
  },
  act: { 
    color: '#3b82f6', 
    bg: '#3b82f620', 
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    ),
    label: '执行'
  },
  observe: { 
    color: '#22c55e', 
    bg: '#22c55e20', 
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    ),
    label: '观察'
  },
  reflect: { 
    color: '#f59e0b', 
    bg: '#f59e0b20', 
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 4 23 10 17 10"></polyline>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
      </svg>
    ),
    label: '反思'
  },
  final: { 
    color: '#ec4899', 
    bg: '#ec489920', 
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    ),
    label: '完成'
  }
}

interface ReasoningVisualizerProps {
  steps: ReActStep[]
  isActive?: boolean
  currentStep?: number
}

const ReasoningVisualizer: React.FC<ReasoningVisualizerProps> = ({ 
  steps, 
  isActive = false,
  currentStep = -1
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<ReActStepType | 'all'>('all')

  const toggleExpand = (stepId: string) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId)
    } else {
      newExpanded.add(stepId)
    }
    setExpandedSteps(newExpanded)
  }

  const filteredSteps = filter === 'all' 
    ? steps 
    : steps.filter(s => s.type === filter)

  const formatDuration = (ms?: number) => {
    if (!ms) return ''
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <div className="reasoning-visualizer" style={{
      backgroundColor: 'var(--bg-primary)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: isActive ? '#3b82f620' : 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: isActive ? 'pulse 2s infinite' : 'none'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#3b82f6' : 'var(--text-secondary)'} strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              {isActive ? '推理进行中...' : 'ReAct 推理过程'}
            </h4>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {filteredSteps.length} 步骤 · {isActive ? '实时更新' : '已完成'}
            </span>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'think', 'act', 'observe', 'final'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: filter === type 
                  ? (type === 'all' ? 'var(--bg-tertiary)' : stepTypeConfig[type as ReActStepType].bg)
                  : 'transparent',
                color: filter === type 
                  ? (type === 'all' ? 'var(--text-primary)' : stepTypeConfig[type as ReActStepType].color)
                  : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              {type === 'all' ? '全部' : stepTypeConfig[type as ReActStepType].label}
            </button>
          ))}
        </div>
      </div>

      {/* Steps Timeline */}
      <div style={{ maxHeight: '400px', overflow: 'auto', padding: '16px' }}>
        {filteredSteps.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: 'var(--text-secondary)'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 16px', opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <p>暂无推理过程</p>
            <p style={{ fontSize: '12px' }}>发送消息开始与AI进行推理交互</p>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Timeline Line */}
            <div style={{
              position: 'absolute',
              left: '19px',
              top: '0',
              bottom: '0',
              width: '2px',
              backgroundColor: 'var(--border-color)'
            }} />

            {filteredSteps.map((step, index) => {
              const config = stepTypeConfig[step.type]
              const isExpanded = expandedSteps.has(step.id)
              const isCurrent = index === currentStep

              return (
                <div 
                  key={step.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: index < filteredSteps.length - 1 ? '16px' : '0',
                    position: 'relative'
                  }}
                >
                  {/* Step Indicator */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    minWidth: '40px',
                    borderRadius: '50%',
                    backgroundColor: isCurrent ? config.bg : config.color + '20',
                    border: `2px solid ${isCurrent ? config.color : config.color + '40'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: config.color,
                    zIndex: 1,
                    animation: isCurrent ? 'pulse 1.5s infinite' : 'none'
                  }}>
                    {config.icon}
                  </div>

                  {/* Step Content */}
                  <div style={{
                    flex: 1,
                    backgroundColor: isCurrent ? config.bg : 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: `1px solid ${isCurrent ? config.color + '40' : 'var(--border-color)'}`,
                    overflow: 'hidden',
                    transition: 'all 0.2s'
                  }}>
                    {/* Step Header */}
                    <div 
                      onClick={() => toggleExpand(step.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: config.color,
                          textTransform: 'uppercase'
                        }}>
                          {config.label}
                        </span>
                        {step.durationMs && (
                          <span style={{
                            fontSize: '11px',
                            color: 'var(--text-secondary)'
                          }}>
                            {formatDuration(step.durationMs)}
                          </span>
                        )}
                      </div>
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="var(--text-secondary)" 
                        strokeWidth="2"
                        style={{
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s'
                        }}
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>

                    {/* Step Details */}
                    {isExpanded && (
                      <div style={{
                        padding: '12px 16px',
                        borderTop: '1px solid var(--border-color)',
                        fontSize: '13px',
                        lineHeight: 1.6
                      }}>
                        {/* Thought */}
                        {step.thought && (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ 
                              fontWeight: 500, 
                              marginBottom: '4px',
                              color: 'var(--text-secondary)',
                              fontSize: '11px',
                              textTransform: 'uppercase'
                            }}>
                              推理
                            </div>
                            <div style={{ color: 'var(--text-primary)' }}>
                              {step.thought}
                            </div>
                          </div>
                        )}

                        {/* Action */}
                        {step.action && (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ 
                              fontWeight: 500, 
                              marginBottom: '4px',
                              color: '#3b82f6',
                              fontSize: '11px',
                              textTransform: 'uppercase'
                            }}>
                              执行动作
                            </div>
                            <code style={{
                              backgroundColor: 'var(--bg-tertiary)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}>
                              {step.action}
                            </code>
                            {step.actionInput && (
                              <pre style={{
                                margin: '8px 0 0 0',
                                padding: '8px',
                                backgroundColor: 'var(--bg-tertiary)',
                                borderRadius: '4px',
                                fontSize: '11px',
                                overflow: 'auto'
                              }}>
                                {JSON.stringify(step.actionInput, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}

                        {/* Observation */}
                        {step.observation && (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ 
                              fontWeight: 500, 
                              marginBottom: '4px',
                              color: '#22c55e',
                              fontSize: '11px',
                              textTransform: 'uppercase'
                            }}>
                              观察结果
                            </div>
                            <div style={{ 
                              color: step.error ? '#ef4444' : 'var(--text-primary)',
                              backgroundColor: step.error ? '#ef444420' : 'transparent',
                              padding: step.error ? '8px' : '0',
                              borderRadius: '4px'
                            }}>
                              {step.observation}
                            </div>
                          </div>
                        )}

                        {/* Error */}
                        {step.error && (
                          <div style={{
                            marginTop: '12px',
                            padding: '8px 12px',
                            backgroundColor: '#ef444420',
                            borderRadius: '4px',
                            color: '#ef4444',
                            fontSize: '12px'
                          }}>
                            错误: {step.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {steps.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          fontSize: '12px',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>思考: {steps.filter(s => s.type === 'think').length}</span>
            <span>执行: {steps.filter(s => s.type === 'act').length}</span>
            <span>观察: {steps.filter(s => s.type === 'observe').length}</span>
          </div>
          <div>
            总耗时: {formatDuration(steps.reduce((acc, s) => acc + (s.durationMs || 0), 0))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export default ReasoningVisualizer
