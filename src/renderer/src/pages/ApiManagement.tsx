import React, { useState, useEffect } from 'react'

interface ApiKey {
  model: string;
  key: string;
  isValid: boolean;
}

const ApiManagement: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKey, setNewKey] = useState<{ model: string; key: string }>({ model: 'openai', key: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const [openaiKey, claudeKey, minimaxKey, deepseekKey] = await Promise.all([
          window.electron.api.getApiKey('openai'),
          window.electron.api.getApiKey('claude'),
          window.electron.api.getApiKey('minimax'),
          window.electron.api.getApiKey('deepseek')
        ])
        
        const keys: ApiKey[] = [
          { model: 'openai', key: openaiKey || '', isValid: !!openaiKey },
          { model: 'claude', key: claudeKey || '', isValid: !!claudeKey },
          { model: 'minimax', key: minimaxKey || '', isValid: !!minimaxKey },
          { model: 'deepseek', key: deepseekKey || '', isValid: !!deepseekKey }
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
      await window.electron.api.setApiKey(model, key)
      setApiKeys(prev => prev.map(k => k.model === model ? { ...k, key, isValid: true } : k))
    } catch (error) {
      console.error(error)
    }
  }

  const handleTestApiKey = async (model: string, key: string) => {
    try {
      const result = await window.electron.api.testApiKey(model, key)
      setApiKeys(prev => prev.map(k => k.model === model ? { ...k, isValid: result.success } : k))
      alert(result.success ? 'Connection Successful' : 'Connection Failed')
    } catch (error) {
      alert('Connection Failed')
    }
  }

  if (loading) return <div className="loading-screen">Loading...</div>

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
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
                <h3 style={{ fontSize: '16px', fontWeight: 600, textTransform: 'capitalize' }}>{key.model}</h3>
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
                placeholder={`Enter ${key.model} API Key`}
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
  )
}

export default ApiManagement
