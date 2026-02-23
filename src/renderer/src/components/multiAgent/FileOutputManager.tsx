import React, { useState } from 'react'
import { FileOutput } from '../../types/MultiAgentTypes'
import './FileOutputManager.css'

interface FileOutputManagerProps {
  files: FileOutput[]
  onOpenFile?: (filePath: string) => void
  onDownloadFile?: (filePath: string) => void
}

export const FileOutputManager: React.FC<FileOutputManagerProps> = ({
  files,
  onOpenFile,
  onDownloadFile
}) => {
  const [selectedFile, setSelectedFile] = useState<FileOutput | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  
  const getFileIcon = (type: string): string => {
    const iconMap: Record<string, string> = {
      markdown: '📄',
      code: '💻',
      config: '⚙️',
      other: '📁'
    }
    return iconMap[type] || iconMap.other
  }
  
  const getFileTypeText = (type: string): string => {
    const textMap: Record<string, string> = {
      markdown: 'Markdown',
      code: '代码文件',
      config: '配置文件',
      other: '其他'
    }
    return textMap[type] || textMap.other
  }
  
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }
  
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  const handleFileClick = (file: FileOutput) => {
    setSelectedFile(file)
  }
  
  const handleOpenFile = (file: FileOutput) => {
    if (onOpenFile) {
      onOpenFile(file.path)
    }
  }
  
  const handleDownloadFile = (file: FileOutput) => {
    if (onDownloadFile) {
      onDownloadFile(file.path)
    }
  }
  
  const groupedFiles = files.reduce((acc, file) => {
    if (!acc[file.type]) {
      acc[file.type] = []
    }
    acc[file.type].push(file)
    return acc
  }, {} as Record<string, FileOutput[]>)
  
  return (
    <div className="file-output-manager">
      <div className="file-manager-header">
        <h3 className="manager-title">输出文件</h3>
        <div className="manager-actions">
          <button 
            className={`view-mode-btn ${viewMode === 'list' ? 'view-active' : ''}`}
            onClick={() => setViewMode('list')}
            title="列表视图"
          >
            ☰
          </button>
          <button 
            className={`view-mode-btn ${viewMode === 'grid' ? 'view-active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="网格视图"
          >
            ⊞
          </button>
        </div>
      </div>
      
      {files.length === 0 ? (
        <div className="files-empty">
          <div className="empty-icon">📭</div>
          <div className="empty-text">暂无输出文件</div>
        </div>
      ) : (
        <div className={`files-container files-${viewMode}`}>
          {Object.entries(groupedFiles).map(([type, typeFiles]) => (
            <div key={type} className="file-group">
              <div className="file-group-header">
                <div className="group-icon">{getFileIcon(type)}</div>
                <div className="group-title">{getFileTypeText(type)}</div>
                <div className="group-count">{typeFiles.length} 个文件</div>
              </div>
              
              <div className={`file-list file-list-${viewMode}`}>
                {typeFiles.map((file, index) => (
                  <div 
                    key={index}
                    className={`file-item ${selectedFile === file ? 'file-selected' : ''}`}
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="file-icon">{getFileIcon(file.type)}</div>
                    
                    <div className="file-info">
                      <div className="file-name" title={file.name}>
                        {file.name}
                      </div>
                      <div className="file-meta">
                        <span className="file-size">{formatFileSize(file.size)}</span>
                        <span className="file-time">{formatTimestamp(file.createdAt)}</span>
                      </div>
                    </div>
                    
                    <div className="file-actions">
                      <button 
                        className="file-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenFile(file)
                        }}
                        title="打开文件"
                      >
                        👁️
                      </button>
                      <button 
                        className="file-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadFile(file)
                        }}
                        title="下载文件"
                      >
                        ⬇️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {selectedFile && (
        <div className="file-preview-panel">
          <div className="preview-header">
            <div className="preview-title">
              <span className="preview-icon">{getFileIcon(selectedFile.type)}</span>
              <span>{selectedFile.name}</span>
            </div>
            <button 
              className="preview-close"
              onClick={() => setSelectedFile(null)}
            >
              ✕
            </button>
          </div>
          
          <div className="preview-content">
            <div className="preview-info">
              <div className="info-row">
                <span className="info-label">类型:</span>
                <span className="info-value">{getFileTypeText(selectedFile.type)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">大小:</span>
                <span className="info-value">{formatFileSize(selectedFile.size)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">路径:</span>
                <span className="info-value" title={selectedFile.path}>
                  {selectedFile.path.length > 50 
                    ? '...' + selectedFile.path.slice(-50) 
                    : selectedFile.path}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">创建时间:</span>
                <span className="info-value">{formatTimestamp(selectedFile.createdAt)}</span>
              </div>
            </div>
            
            <div className="preview-actions">
              <button 
                className="preview-action-btn preview-primary"
                onClick={() => handleOpenFile(selectedFile)}
              >
                打开文件
              </button>
              <button 
                className="preview-action-btn preview-secondary"
                onClick={() => handleDownloadFile(selectedFile)}
              >
                下载文件
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
