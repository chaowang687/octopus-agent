import React, { useState, useEffect } from 'react'

interface Plugin {
  name: string
  version: string
  description: string
  enabled: boolean
  installed: boolean
}

const Plugins: React.FC = () => {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [installUrl, setInstallUrl] = useState('')

  useEffect(() => {
    const fetchPlugins = async () => {
      try {
        setLoading(true)
        const pluginList = await window.electron.plugins.listPlugins()
        setPlugins(pluginList)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchPlugins()
  }, [])

  const handleInstallPlugin = async () => {
    if (!installUrl) return
    try {
      setLoading(true)
      await window.electron.plugins.installPlugin(installUrl)
      const pluginList = await window.electron.plugins.listPlugins()
      setPlugins(pluginList)
      setInstallUrl('')
    } catch (error: any) {
      alert(`Installation failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: () => Promise<any>) => {
    try {
      setLoading(true)
      await action()
      const pluginList = await window.electron.plugins.listPlugins()
      setPlugins(pluginList)
    } catch (error: any) {
      alert(`Action failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (loading && plugins.length === 0) return <div className="loading-screen">Loading plugins...</div>

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>Plugin Management</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Extend functionality with plugins.</p>
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Install Section */}
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Install New Plugin</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={installUrl}
              onChange={(e) => setInstallUrl(e.target.value)}
              placeholder="https://example.com/plugin.zip"
              style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none' }}
            />
            <button className="btn btn-primary" onClick={handleInstallPlugin} disabled={loading || !installUrl}>Install</button>
          </div>
        </div>

        {/* Plugin List */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {plugins.map(plugin => (
            <div key={plugin.name} style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{plugin.name}</h3>
                <span style={{
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: plugin.enabled ? '#e6f4ea' : '#f1f3f4',
                  color: plugin.enabled ? '#1e8e3e' : '#5f6368',
                  fontWeight: 500
                }}>
                  {plugin.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', flex: 1 }}>
                {plugin.description}
              </p>
              
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                v{plugin.version}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                <button 
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => handleAction(async () => 
                    plugin.enabled 
                      ? window.electron.plugins.disablePlugin(plugin.name)
                      : window.electron.plugins.enablePlugin(plugin.name)
                  )}
                  disabled={loading}
                >
                  {plugin.enabled ? 'Disable' : 'Enable'}
                </button>
                <button 
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => handleAction(() => window.electron.plugins.updatePlugin(plugin.name))}
                  disabled={loading}
                >
                  Update
                </button>
                <button 
                  className="btn"
                  style={{ flex: 1, backgroundColor: '#fce8e6', color: '#d93025', borderColor: 'transparent' }}
                  onClick={() => {
                    if (confirm(`Uninstall ${plugin.name}?`)) {
                      handleAction(() => window.electron.plugins.uninstallPlugin(plugin.name))
                    }
                  }}
                  disabled={loading}
                >
                  Uninstall
                </button>
              </div>
            </div>
          ))}
          
          {plugins.length === 0 && !loading && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
              No plugins installed.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Plugins
