import React, { useState, useEffect } from 'react'

interface BackupFile {
  name: string
  path: string
  size: number
  date: number
}

export const BackupManager: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [backups, setBackups] = useState<BackupFile[]>([])

  useEffect(() => {
    loadBackups()
  }, [])

  const loadBackups = async () => {
    try {
      const result = await window.electron.backup.list()
      if (result.success && result.files) {
        setBackups(result.files)
      }
    } catch (error: any) {
      console.error('加载备份文件失败:', error)
    }
  }

  const handleExport = async () => {
    setLoading(true)
    setMessage('')
    try {
      const result = await window.electron.backup.export('', '')
      if (result.success) {
        setMessage(`数据已导出`)
        setMessageType('success')
      } else {
        setMessage(result.error || '导出失败')
        setMessageType('error')
      }
    } catch (error: any) {
      setMessage(error.message || '导出失败')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    setLoading(true)
    setMessage('')
    try {
      const result = await window.electron.backup.import('')
      if (result.success) {
        setMessage(result.message || '导入成功')
        setMessageType('success')
        loadBackups()
      } else {
        setMessage(result.error || '导入失败')
        setMessageType('error')
      }
    } catch (error: any) {
      setMessage(error.message || '导入失败')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleAutoBackup = async () => {
    setLoading(true)
    setMessage('')
    try {
      const result = await window.electron.backup.autoBackup()
      if (result.success) {
        setMessage(`自动备份已保存`)
        setMessageType('success')
        loadBackups()
      } else {
        setMessage(result.error || '自动备份失败')
        setMessageType('error')
      }
    } catch (error: any) {
      setMessage(error.message || '自动备份失败')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBackup = async (fileName: string) => {
    if (!confirm('确定要删除这个备份吗？')) {
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const result = await window.electron.backup.delete(fileName)
      if (result.success) {
        setMessage('备份已删除')
        setMessageType('success')
        loadBackups()
      } else {
        setMessage(result.error || '删除失败')
        setMessageType('error')
      }
    } catch (error: any) {
      setMessage(error.message || '删除失败')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>
        数据备份与恢复
      </h2>

      <div style={{
        padding: '16px',
        marginBottom: '20px',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffc107',
        borderRadius: '4px',
        color: '#856404'
      }}>
        <strong>⚠️ 注意：</strong>
        数据保存在本地，建议定期导出备份。备份文件包含所有用户数据、项目、API 密钥和设置。
      </div>

      {message && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          backgroundColor: messageType === 'success' ? '#d4edda' : messageType === 'error' ? '#f8d7da' : '#d1ecf1',
          border: messageType === 'success' ? '1px solid #c3e6cb' : messageType === 'error' ? '1px solid #f5c6cb' : '1px solid #bee5eb',
          borderRadius: '4px',
          color: messageType === 'success' ? '#155724' : messageType === 'error' ? '#721c24' : '#0c5460'
        }}>
          {message}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '30px'
      }}>
        <button
          onClick={handleExport}
          disabled={loading}
          style={{
            padding: '16px',
            background: loading ? '#999' : '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.3s'
          }}
        >
          📤 导出数据
        </button>

        <button
          onClick={handleImport}
          disabled={loading}
          style={{
            padding: '16px',
            background: loading ? '#999' : '#48bb78',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.3s'
          }}
        >
          📥 导入数据
        </button>

        <button
          onClick={handleAutoBackup}
          disabled={loading}
          style={{
            padding: '16px',
            background: loading ? '#999' : '#ed8936',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.3s'
          }}
        >
          💾 立即备份
        </button>
      </div>

      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
        本地备份文件
      </h3>

      {backups.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#999',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          暂无备份文件
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '12px'
        }}>
          {backups.map((backup) => (
            <div key={backup.name} style={{
              padding: '16px',
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {backup.name}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {formatDate(backup.date)} · {formatSize(backup.size)}
                </div>
              </div>
              <button
                onClick={() => handleDeleteBackup(backup.name)}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: loading ? '#999' : '#f56565',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.3s'
                }}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
