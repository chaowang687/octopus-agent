import React, { useState } from 'react'

const SystemControl: React.FC = () => {
  const [url, setUrl] = useState('')
  const [filePath, setFilePath] = useState('')
  const [appName, setAppName] = useState('')
  const [command, setCommand] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const executeAction = async (action: () => Promise<any>, successMsg: string) => {
    setLoading(true)
    try {
      await action()
      setResult(successMsg)
    } catch (error: any) {
      setResult(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenUrl = () => executeAction(
    async () => {
      if (!url) throw new Error('URL is required')
      await window.electron.system.openExternal(url)
    },
    `Opened URL: ${url}`
  )

  const handleOpenFile = () => executeAction(
    async () => {
      if (!filePath) throw new Error('Path is required')
      const exists = await window.electron.fs.exists(filePath)
      if (!exists) throw new Error('File not found')
      await window.electron.system.executeCommand('open', [filePath])
    },
    `Opened file: ${filePath}`
  )

  const handleOpenApp = () => executeAction(
    async () => {
      if (!appName) throw new Error('App name is required')
      const appPath = `/Applications/${appName}.app`
      const exists = await window.electron.fs.exists(appPath)
      if (!exists) throw new Error('App not found')
      await window.electron.system.executeCommand('open', [appPath])
    },
    `Opened app: ${appName}`
  )

  const handleExecuteCommand = async () => {
    if (!command) return
    setLoading(true)
    try {
      const output = await window.electron.system.executeCommand('bash', ['-c', command])
      setResult(output.success ? output.output : `Error: ${output.error}`)
    } catch (error: any) {
      setResult(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>System Control</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Directly interact with your local macOS environment.</p>
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Web */}
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Open Website</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none' }}
            />
            <button className="btn btn-primary" onClick={handleOpenUrl} disabled={loading}>Open</button>
          </div>
        </div>

        {/* File */}
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Open File</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="/Users/username/..."
              style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none' }}
            />
            <button className="btn btn-primary" onClick={handleOpenFile} disabled={loading}>Open</button>
          </div>
        </div>

        {/* App */}
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Launch App</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="App Name (e.g. Safari)"
              style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none' }}
            />
            <button className="btn btn-primary" onClick={handleOpenApp} disabled={loading}>Launch</button>
          </div>
        </div>

        {/* Command */}
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Execute Shell Command</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="ls -la"
              style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontFamily: 'monospace' }}
            />
            <button className="btn btn-secondary" onClick={handleExecuteCommand} disabled={loading}>Run</button>
          </div>
        </div>

        {/* Output */}
        {result && (
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-color)',
            fontFamily: 'monospace',
            fontSize: '13px',
            whiteSpace: 'pre-wrap',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {result}
          </div>
        )}
      </div>
    </div>
  )
}

export default SystemControl
