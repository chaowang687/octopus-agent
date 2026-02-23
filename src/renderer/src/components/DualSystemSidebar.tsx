import React, { useState, useEffect } from 'react'

interface TokenUsage {
  model: string
  total: number
  prompt: number
  completion: number
}

const DualSystemSidebar: React.FC = () => {
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTokenUsage = async () => {
      try {
        if (window.electron?.api) {
          const result = await window.electron.api.invoke('api:getTokenUsage')
          if (result.success) {
            setTokenUsage(result.data || [])
          }
        }
      } catch (error) {
        console.error('获取 Token 使用量失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTokenUsage()
    const interval = setInterval(fetchTokenUsage, 10000)
    return () => clearInterval(interval)
  }, [])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const getModelName = (model: string): string => {
    const nameMap: Record<string, string> = {
      'doubao-seed-2-0-lite-260215': 'Doubao Lite',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-3.5-turbo': 'GPT-3.5',
      'claude-3-opus': 'Claude 3 Opus',
      'claude-3-sonnet': 'Claude 3 Sonnet',
      'claude-3-haiku': 'Claude 3 Haiku',
      'deepseek-chat': 'DeepSeek Chat',
      'deepseek-coder': 'DeepSeek Coder'
    }
    return nameMap[model] || model
  }

  const getTotalTokens = (): number => {
    return tokenUsage.reduce((sum, u) => sum + u.total, 0)
  }

  return (
    <div style={{
      width: '280px',
      backgroundColor: 'var(--bg-primary)',
      borderRight: '1px solid var(--border-color)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      height: '100%',
      overflowY: 'auto'
    }}>
      {/* 标题 */}
      <div>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: 600, 
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          模型使用量统计
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          Token Usage by Model
        </p>
      </div>

      {/* 总计 */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding: '16px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>总 Token 使用量</div>
        <div style={{ 
          fontSize: '24px', 
          fontWeight: 700,
          color: 'var(--accent-color)'
        }}>
          {loading ? '...' : formatNumber(getTotalTokens())}
        </div>
      </div>

      {/* 各模型使用量 */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding: '16px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px' }}>各模型使用量</div>
        
        {loading ? (
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>加载中...</div>
        ) : tokenUsage.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>暂无数据</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tokenUsage.map((usage, index) => (
              <div key={usage.model}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                  fontSize: '12px'
                }}>
                  <span style={{ fontWeight: 500 }}>{getModelName(usage.model)}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {formatNumber(usage.total)} tokens
                  </span>
                </div>
                <div style={{
                  height: '4px',
                  backgroundColor: 'var(--border-color)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${getTotalTokens() > 0 ? (usage.total / getTotalTokens()) * 100 : 0}%`,
                    backgroundColor: ['#4285f4', '#34a853', '#fbbc04', '#ea4335', '#9c27b0', '#00bcd4'][index % 6],
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  marginTop: '2px',
                  fontSize: '10px',
                  color: 'var(--text-tertiary)'
                }}>
                  <span>输入: {formatNumber(usage.prompt)}</span>
                  <span>输出: {formatNumber(usage.completion)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 说明 */}
      <div style={{
        marginTop: 'auto',
        padding: '12px',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        fontSize: '11px',
        color: 'var(--text-tertiary)'
      }}>
        💡 Token 统计说明<br/>
        • 输入 Token: 发送的请求内容<br/>
        • 输出 Token: AI 返回的内容<br/>
        • 按模型分别统计
      </div>
    </div>
  )
}

export default DualSystemSidebar
