import React, { useState, useEffect } from 'react'
import DualSystemSidebar from '../components/DualSystemSidebar'

interface ApiKey {
  model: string;
  key: string;
  isValid: boolean;
}

const ApiManagement: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const currentUserStr = localStorage.getItem('currentUser')
        const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null
        const userId = currentUser?.id || null
        setCurrentUserId(userId)
        
        const [openaiKey, claudeKey, minimaxKey, deepseekKey, doubaoKey, agent5Key] = await Promise.all([
          window.electron.api.getApiKey('openai', userId),
          window.electron.api.getApiKey('claude', userId),
          window.electron.api.getApiKey('minimax', userId),
          window.electron.api.getApiKey('deepseek', userId),
          window.electron.api.getApiKey('doubao', userId),
          window.electron.api.getApiKey('agent5', userId)
        ])
        
        const keys: ApiKey[] = [
          { model: 'openai', key: openaiKey || '', isValid: !!openaiKey },
          { model: 'claude', key: claudeKey || '', isValid: !!claudeKey },
          { model: 'minimax', key: minimaxKey || '', isValid: !!minimaxKey },
          { model: 'deepseek', key: deepseekKey || '', isValid: !!deepseekKey },
          { model: 'doubao', key: doubaoKey || '', isValid: !!doubaoKey },
          { model: 'agent5', key: agent5Key || '', isValid: !!agent5Key }
        ]
        
        setApiKeys(keys)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchApiKeys()
  }, [])

  const handleSetApiKey = async (model: string, key: string) => {
    try {
      await window.electron.api.setApiKey(model, key, currentUserId)
      setApiKeys(prev => prev.map(k => k.model === model ? { ...k, key, isValid: true } : k))
    } catch (error) {
      console.error(error)
    }
  }

  const handleTestApiKey = async (model: string, key: string) => {
    try {
      const result = await window.electron.api.testApiKey(model, key)
      setApiKeys(prev => prev.map(k => k.model === model ? { ...k, isValid: result } : k))
      alert(result ? 'Connection Successful' : 'Connection Failed')
    } catch (error) {
      alert('Connection Failed')
    }
  }

  if (loading) return <div className="loading-screen">Loading...</div>

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 双系统协同状态侧边栏 */}
      <DualSystemSidebar />
      
      {/* 主内容区域 */}
      <div style={{ flex: 1, padding: '40px', maxWidth: '800px', margin: '0 auto', overflow: 'auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>API Management</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Configure access tokens for AI models.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {apiKeys.map(key => (
          <div key={key.model} style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, textTransform: 'capitalize' }}>
                  {key.model === 'agent5' ? 'Agent5 (Qwen3)' : key.model}
                </h3>
                <span style={{
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: key.isValid ? '#e6f4ea' : '#f1f3f4',
                  color: key.isValid ? '#1e8e3e' : '#5f6368',
                }}>
                  {key.isValid ? 'Active' : 'Not Configured'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="password"
                value={key.key}
                onChange={(e) => setApiKeys(prev => prev.map(k => k.model === key.model ? { ...k, key: e.target.value } : k))}
                placeholder={`Enter ${key.model === 'agent5' ? 'Agent5' : key.model} API Key`}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button 
                className="btn btn-secondary"
                onClick={() => handleTestApiKey(key.model, key.key)}
              >
                Test
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => handleSetApiKey(key.model, key.key)}
              >
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}

export default ApiManagement
