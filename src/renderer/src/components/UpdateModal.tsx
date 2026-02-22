import React, { useState, useEffect } from 'react'

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const SyncIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
)

const CloseCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
)

const ReloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
)

interface UpdateInfo {
  version: string
  releaseDate: string
  releaseNotes: string
  files: Array<{
    url: string
    sha512: string
    size: number
  }>
}

interface UpdateModalProps {
  visible: boolean
  onClose: () => void
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ visible, onClose }) => {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadSpeed, setDownloadSpeed] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [autoCheck, setAutoCheck] = useState(false)

  useEffect(() => {
    if (visible && autoCheck) {
      checkForUpdates()
    }
  }, [visible, autoCheck])

  useEffect(() => {
    const cleanupChecking = window.electron.update.onChecking(() => {
      setStatus('checking')
    })

    const cleanupAvailable = window.electron.update.onAvailable((info: UpdateInfo) => {
      setStatus('available')
      setUpdateInfo(info)
    })

    const cleanupNotAvailable = window.electron.update.onNotAvailable((info: any) => {
      setStatus('not-available')
      setCurrentVersion(info.version)
    })

    const cleanupError = window.electron.update.onError((error: any) => {
      setStatus('error')
      setErrorMessage(error.message || '更新检查失败')
    })

    const cleanupProgress = window.electron.update.onProgress((progress: any) => {
      setStatus('downloading')
      setDownloadProgress(progress.percent)
      setDownloadSpeed(progress.speed)
    })

    const cleanupDownloaded = window.electron.update.onDownloaded((info: UpdateInfo) => {
      setStatus('downloaded')
      setUpdateInfo(info)
    })

    return () => {
      cleanupChecking()
      cleanupAvailable()
      cleanupNotAvailable()
      cleanupError()
      cleanupProgress()
      cleanupDownloaded()
    }
  }, [])

  const checkForUpdates = async () => {
    setStatus('checking')
    setErrorMessage('')
    
    try {
      const result = await window.electron.update.check()
      if (result.success) {
        const infoResult = await window.electron.update.getInfo()
        if (infoResult.success) {
          setCurrentVersion(infoResult.currentVersion)
        }
      } else {
        setStatus('error')
        setErrorMessage(result.error || '检查更新失败')
      }
    } catch (error: any) {
      setStatus('error')
      setErrorMessage(error.message || '检查更新失败')
    }
  }

  const downloadUpdate = async () => {
    setStatus('downloading')
    setErrorMessage('')
    
    try {
      const result = await window.electron.update.download()
      if (!result.success) {
        setStatus('error')
        setErrorMessage(result.error || '下载更新失败')
      }
    } catch (error: any) {
      setStatus('error')
      setErrorMessage(error.message || '下载更新失败')
    }
  }

  const installUpdate = async () => {
    try {
      await window.electron.update.install()
    } catch (error: any) {
      setStatus('error')
      setErrorMessage(error.message || '安装更新失败')
    }
  }

  const renderContent = () => {
    switch (status) {
      case 'idle':
        return (
          <div className="update-content">
            <p>检查是否有新版本可用</p>
            <button 
              className="btn btn-primary" 
              onClick={checkForUpdates}
              style={{ width: '100%' }}
            >
              <SyncIcon /> 检查更新
            </button>
          </div>
        )

      case 'checking':
        return (
          <div className="update-content">
            <div className="loading-spinner">
              <SyncIcon />
              <span>正在检查更新...</span>
            </div>
          </div>
        )

      case 'available':
        return (
          <div className="update-content">
            <div className="alert alert-success">
              <CheckCircleIcon />
              <div>
                <strong>发现新版本</strong>
                <p>版本 {updateInfo?.version} 已可用</p>
              </div>
            </div>
            
            <div className="update-info">
              <div className="info-row">
                <span className="label">当前版本:</span>
                <span className="value">{currentVersion}</span>
              </div>
              <div className="info-row">
                <span className="label">新版本:</span>
                <span className="value">{updateInfo?.version}</span>
              </div>
              <div className="info-row">
                <span className="label">发布日期:</span>
                <span className="value">{updateInfo?.releaseDate}</span>
              </div>
            </div>

            {updateInfo?.releaseNotes && (
              <div className="release-notes">
                <strong>更新说明：</strong>
                <p>{updateInfo.releaseNotes}</p>
              </div>
            )}

            <button 
              className="btn btn-primary" 
              onClick={downloadUpdate}
              style={{ width: '100%' }}
            >
              <DownloadIcon /> 下载更新
            </button>
          </div>
        )

      case 'not-available':
        return (
          <div className="update-content">
            <div className="alert alert-success">
              <CheckCircleIcon />
              <div>
                <strong>已是最新版本</strong>
                <p>当前版本 {currentVersion} 已是最新版本</p>
              </div>
            </div>
            <button 
              className="btn btn-secondary" 
              onClick={checkForUpdates}
              style={{ width: '100%' }}
            >
              <ReloadIcon /> 重新检查
            </button>
          </div>
        )

      case 'downloading':
        return (
          <div className="update-content">
            <p>正在下载更新...</p>
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <span className="progress-text">{downloadProgress}%</span>
            </div>
            {downloadSpeed && (
              <p className="download-speed">下载速度: {downloadSpeed}</p>
            )}
          </div>
        )

      case 'downloaded':
        return (
          <div className="update-content">
            <div className="alert alert-success">
              <CheckCircleIcon />
              <div>
                <strong>更新已下载</strong>
                <p>更新已准备就绪，请保存当前工作后安装</p>
              </div>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={installUpdate}
              style={{ width: '100%' }}
            >
              <CheckCircleIcon /> 立即安装并重启
            </button>
          </div>
        )

      case 'error':
        return (
          <div className="update-content">
            <div className="alert alert-error">
              <CloseCircleIcon />
              <div>
                <strong>更新失败</strong>
                <p>{errorMessage}</p>
              </div>
            </div>
            <button 
              className="btn btn-secondary" 
              onClick={checkForUpdates}
              style={{ width: '100%' }}
            >
              <ReloadIcon /> 重试
            </button>
          </div>
        )

      default:
        return null
    }
  }

  if (!visible) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <SyncIcon /> 应用更新
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default UpdateModal
