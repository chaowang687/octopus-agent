import React, { useState, useEffect, useCallback } from 'react'

// ============================================
// 协作阶段配置
// ============================================
const phaseConfig = {
  requirements: {
    label: '需求分析',
    color: '#8b5cf6',
    icon: '📋',
    description: '明确项目需求和目标'
  },
  architecture: {
    label: '架构设计',
    color: '#3b82f6',
    icon: '🏗️',
    description: '设计系统架构和技术选型'
  },
  implementation: {
    label: '实现方案',
    color: '#10b981',
    icon: '⚙️',
    description: '制定具体实现计划'
  },
  review: {
    label: '方案评审',
    color: '#f59e0b',
    icon: '✅',
    description: '最终方案确认'
  }
}

// ============================================
// 协作请求接口
// ============================================
interface CollaborationRequest {
  id: string
  taskId: string
  phase: string
  title: string
  description: string
  content: any
  alternatives?: string[]
  editableParams?: string[]
  timestamp: number
  status: 'pending' | 'approved' | 'rejected' | 'modified'
  userResponse?: string
  modifiedParams?: any
}

interface CollaborationModalProps {
  request: CollaborationRequest | null
  onApprove: (requestId: string, response?: string) => void
  onReject: (requestId: string, reason?: string) => void
  onModify: (requestId: string, modifiedParams: any, response?: string) => void
  onContinue: (requestId: string, instruction: string) => void
}

const CollaborationModal: React.FC<CollaborationModalProps> = ({
  request,
  onApprove,
  onReject,
  onModify,
  onContinue
}) => {
  const [userInstruction, setUserInstruction] = useState('')
  const [modifiedParams, setModifiedParams] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState<'content' | 'alternatives' | 'params'>('content')

  useEffect(() => {
    if (request) {
      setUserInstruction('')
      setModifiedParams({})
    }
  }, [request?.id])

  if (!request) return null

  const config = phaseConfig[request.phase as keyof typeof phaseConfig] || phaseConfig.implementation

  // 渲染方案内容
  const renderContent = (content: any) => {
    if (!content) return <p style={{ color: 'var(--text-secondary)' }}>暂无内容</p>
    
    if (typeof content === 'string') {
      return (
        <pre style={{ 
          whiteSpace: 'pre-wrap', 
          fontSize: '14px', 
          lineHeight: 1.6,
          maxHeight: '300px',
          overflow: 'auto',
          backgroundColor: 'var(--bg-tertiary)',
          padding: '16px',
          borderRadius: '8px'
        }}>
          {content}
        </pre>
      )
    }

    // 对象类型
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Object.entries(content).map(([key, value]) => (
          <div key={key}>
            <div style={{ 
              fontWeight: 600, 
              marginBottom: '4px',
              color: 'var(--text-primary)'
            }}>
              {key}
            </div>
            <div style={{ 
              backgroundColor: 'var(--bg-tertiary)', 
              padding: '12px', 
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              {typeof value === 'object' 
                ? JSON.stringify(value, null, 2) 
                : String(value)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const handleSubmitInstruction = () => {
    if (userInstruction.trim()) {
      onContinue(request.id, userInstruction.trim())
      setUserInstruction('')
    }
  }

  const handleQuickAction = (action: string) => {
    const quickResponses: Record<string, string> = {
      'expand': '请进一步细化这个方案',
      'simpler': '请提供一个更简单的方案',
      'alternative': '请提供另一个替代方案',
      'detail': '请补充更多技术细节'
    }
    if (quickResponses[action]) {
      onContinue(request.id, quickResponses[action])
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: `${config.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              {config.icon}
            </div>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <span style={{
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: `${config.color}20`,
                  color: config.color,
                  fontWeight: 600
                }}>
                  {config.label}
                </span>
              </div>
              <h2 style={{ 
                margin: 0, 
                fontSize: '20px', 
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}>
                {request.title}
              </h2>
              <p style={{ 
                margin: '4px 0 0', 
                fontSize: '14px', 
                color: 'var(--text-secondary)' 
              }}>
                {request.description || config.description}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          {(['content', 'alternatives', 'params'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 20px',
                backgroundColor: activeTab === tab ? 'var(--bg-primary)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? `2px solid ${config.color}` : '2px solid transparent',
                color: activeTab === tab ? config.color : 'var(--text-secondary)',
                fontWeight: activeTab === tab ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab === 'content' ? '方案内容' : 
               tab === 'alternatives' ? '替代方案' : '可编辑参数'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflow: 'auto',
          maxHeight: '400px'
        }}>
          {activeTab === 'content' && (
            <div>
              {renderContent(request.content)}
            </div>
          )}

          {activeTab === 'alternatives' && (
            <div>
              {request.alternatives && request.alternatives.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {request.alternatives.map((alt, index) => (
                    <div key={index} style={{
                      padding: '16px',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                        方案 {index + 1}
                      </div>
                      <pre style={{ 
                        margin: 0, 
                        whiteSpace: 'pre-wrap',
                        fontSize: '14px'
                      }}>
                        {alt}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>
                  暂无替代方案
                </p>
              )}
            </div>
          )}

          {activeTab === 'params' && (
            <div>
              {request.editableParams && request.editableParams.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {request.editableParams.map(param => (
                    <div key={param}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                      }}>
                        {param}
                      </label>
                      <input
                        type="text"
                        value={modifiedParams[param] || ''}
                        onChange={(e) => setModifiedParams(prev => ({
                          ...prev,
                          [param]: e.target.value
                        }))}
                        placeholder={`请输入${param}`}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>
                  当前阶段无可编辑参数
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div style={{ 
            marginBottom: '16px',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => handleQuickAction('expand')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              细化方案
            </button>
            <button
              onClick={() => handleQuickAction('simpler')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              简化方案
            </button>
            <button
              onClick={() => handleQuickAction('alternative')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              替代方案
            </button>
            <button
              onClick={() => handleQuickAction('detail')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              技术细节
            </button>
          </div>

          {/* User Instruction Input */}
          <div style={{ marginBottom: '16px' }}>
            <textarea
              value={userInstruction}
              onChange={(e) => setUserInstruction(e.target.value)}
              placeholder="输入您的修改意见或继续指令..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => onReject(request.id, '用户拒绝当前方案')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#ef444420',
                  color: '#ef4444',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                拒绝方案
              </button>
              {Object.keys(modifiedParams).length > 0 && (
                <button
                  onClick={() => onModify(request.id, modifiedParams)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#f59e0b20',
                    color: '#f59e0b',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  提交修改
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => handleSubmitInstruction()}
                disabled={!userInstruction.trim()}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: userInstruction.trim() ? 'pointer' : 'not-allowed',
                  opacity: userInstruction.trim() ? 1 : 0.5
                }}
              >
                继续完善
              </button>
              <button
                onClick={() => onApprove(request.id)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: config.color,
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: `0 4px 12px ${config.color}40`
                }}
              >
                确认方案
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CollaborationModal
