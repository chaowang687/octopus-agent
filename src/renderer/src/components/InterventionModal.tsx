import React, { useState, useEffect, useCallback } from 'react'

// 干预请求类型
interface InterventionRequest {
  id: string
  type: 'approval' | 'confirmation' | 'correction' | 'cancel' | 'pause' | 'resume' | 'custom'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  details?: any
  timestamp: number
  timeout?: number
  taskId?: string
  stepId?: string
}

// 风险级别配置
const riskLevelConfig = {
  low: { color: '#22c55e', bg: '#22c55e20', label: '低风险' },
  medium: { color: '#eab308', bg: '#eab30820', label: '中等风险' },
  high: { color: '#f97316', bg: '#f9731620', label: '高风险' },
  critical: { color: '#ef4444', bg: '#ef444420', label: '极高风险' }
}

interface InterventionModalProps {
  request: InterventionRequest | null
  onApprove: (requestId: string, response?: string) => void
  onDeny: (requestId: string, reason?: string) => void
  onModify: (requestId: string, modifiedValue: any, response?: string) => void
}

const InterventionModal: React.FC<InterventionModalProps> = ({
  request,
  onApprove,
  onDeny,
  onModify
}) => {
  const [modification, setModification] = useState('')
  const [reason, setReason] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    if (request?.timeout) {
      setCountdown(request.timeout / 1000)
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timer)
            // 超时自动拒绝
            if (request) {
              onDeny(request.id, '操作超时')
            }
            return null
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [request])

  if (!request) return null

  const config = riskLevelConfig[request.riskLevel]

  const handleApprove = () => {
    onApprove(request.id, modification || undefined)
    setModification('')
  }

  const handleDeny = () => {
    onDeny(request.id, reason || undefined)
    setReason('')
  }

  const handleModify = () => {
    try {
      const modifiedValue = modification ? JSON.parse(modification) : {}
      onModify(request.id, modifiedValue, `修改: ${modification}`)
      setModification('')
    } catch {
      onModify(request.id, { customResponse: modification }, `修改: ${modification}`)
      setModification('')
    }
  }

  return (
    <div className="modal-overlay" style={{
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
      <div className="intervention-modal" style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '12px',
        padding: '24px',
        width: '90%',
        maxWidth: '500px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        border: '1px solid var(--border-color)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: config.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {request.riskLevel === 'critical' || request.riskLevel === 'high' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              )}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{request.title}</h3>
              <span style={{
                fontSize: '12px',
                color: config.color,
                backgroundColor: config.bg,
                padding: '2px 8px',
                borderRadius: '4px'
              }}>
                {config.label}
              </span>
            </div>
          </div>
          {countdown !== null && (
            <div style={{
              fontSize: '14px',
              color: countdown < 30 ? '#ef4444' : 'var(--text-secondary)'
            }}>
              {countdown}s
            </div>
          )}
        </div>

        {/* Description */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.6 }}>
            {request.description}
          </p>
          {request.details?.tool && (
            <div style={{ marginTop: '12px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>工具: </span>
              <code style={{
                backgroundColor: 'var(--bg-tertiary)',
                padding: '2px 6px',
                borderRadius: '4px',
                color: '#3b82f6'
              }}>
                {request.details.tool}
              </code>
            </div>
          )}
          {request.details?.parameters && (
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>参数: </span>
              <pre style={{
                margin: '4px 0 0 0',
                backgroundColor: 'var(--bg-tertiary)',
                padding: '8px',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '100px'
              }}>
                {JSON.stringify(request.details.parameters, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Modification Input */}
        {request.type === 'correction' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              修改参数 (可选)
            </label>
            <textarea
              value={modification}
              onChange={(e) => setModification(e.target.value)}
              placeholder='输入JSON格式的参数修改...'
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '13px',
                resize: 'vertical'
              }}
            />
          </div>
        )}

        {/* Denial Reason */}
        {request.type !== 'correction' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              拒绝原因 (可选)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder='请输入拒绝原因...'
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleDeny}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            拒绝
          </button>
          {request.type === 'correction' ? (
            <button
              onClick={handleModify}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#eab308',
                color: '#000',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              修改并继续
            </button>
          ) : (
            <button
              onClick={handleApprove}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: request.riskLevel === 'critical' ? '#ef4444' : '#22c55e',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              {request.riskLevel === 'critical' ? '确认执行' : '批准'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default InterventionModal
