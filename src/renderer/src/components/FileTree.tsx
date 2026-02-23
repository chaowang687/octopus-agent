import React, { useState, useEffect, useCallback } from 'react'
import './FileTree.css'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  extension?: string
  size?: number
  modifiedAt?: number
}

interface FileTreeProps {
  rootPath: string
  onFileSelect: (file: FileNode) => void
  onFileDoubleClick?: (file: FileNode) => void
  selectedPath?: string
  expandedPaths?: Set<string>
  onExpandChange?: (path: string, expanded: boolean) => void
}

const getFileIcon = (node: FileNode): string => {
  if (node.type === 'directory') return '📁'
  
  const ext = node.extension || ''
  const iconMap: Record<string, string> = {
    '.ts': '📘',
    '.tsx': '⚛️',
    '.js': '📒',
    '.jsx': '⚛️',
    '.json': '📋',
    '.md': '📝',
    '.css': '🎨',
    '.scss': '🎨',
    '.html': '🌐',
    '.py': '🐍',
    '.go': '🐹',
    '.rs': '🦀',
    '.java': '☕',
    '.cpp': '⚙️',
    '.c': '⚙️',
    '.h': '📄',
    '.sh': '📜',
    '.yml': '⚙️',
    '.yaml': '⚙️',
    '.toml': '⚙️',
    '.env': '🔐',
    '.gitignore': '📝',
    '.dockerignore': '🐳',
    '.png': '🖼️',
    '.jpg': '🖼️',
    '.jpeg': '🖼️',
    '.gif': '🖼️',
    '.svg': '🎨',
    '.ico': '🖼️',
    '.woff': '🔤',
    '.woff2': '🔤',
    '.ttf': '🔤',
    '.eot': '🔤',
  }
  
  return iconMap[ext] || '📄'
}

const FileTreeNode: React.FC<{
  node: FileNode
  level: number
  onFileSelect: (file: FileNode) => void
  onFileDoubleClick?: (file: FileNode) => void
  selectedPath?: string
  expandedPaths: Set<string>
  onToggleExpand: (path: string) => void
  loadDirectory: (path: string) => Promise<FileNode[]>
}> = ({ 
  node, 
  level, 
  onFileSelect, 
  onFileDoubleClick, 
  selectedPath, 
  expandedPaths, 
  onToggleExpand,
  loadDirectory 
}) => {
  const [children, setChildren] = useState<FileNode[]>(node.children || [])
  const [loading, setLoading] = useState(false)
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedPath === node.path
  
  useEffect(() => {
    if (node.children) {
      setChildren(node.children)
    }
  }, [node.children])
  
  const handleClick = useCallback(() => {
    onFileSelect(node)
  }, [node, onFileSelect])
  
  const handleDoubleClick = useCallback(() => {
    if (node.type === 'file' && onFileDoubleClick) {
      onFileDoubleClick(node)
    }
  }, [node, onFileDoubleClick])
  
  const handleToggle = useCallback(async () => {
    if (node.type === 'directory') {
      onToggleExpand(node.path)
      
      if (!node.children && children.length === 0) {
        setLoading(true)
        try {
          const loadedChildren = await loadDirectory(node.path)
          setChildren(loadedChildren)
        } catch (error) {
          console.error('Failed to load directory:', error)
        } finally {
          setLoading(false)
        }
      }
    }
  }, [node, children.length, onToggleExpand, loadDirectory])
  
  const sortedChildren = [...children].sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1
    if (a.type === 'file' && b.type === 'directory') return 1
    return a.name.localeCompare(b.name)
  })
  
  return (
    <div className="file-tree-node">
      <div 
        className={`file-tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {node.type === 'directory' ? (
          <span className="expand-icon" onClick={handleToggle}>
            {loading ? '⏳' : isExpanded ? '▼' : '▶'}
          </span>
        ) : (
          <span className="expand-icon placeholder" />
        )}
        <span className="file-icon">{getFileIcon(node)}</span>
        <span className="file-name" title={node.path}>
          {node.name}
        </span>
      </div>
      
      {node.type === 'directory' && isExpanded && sortedChildren.length > 0 && (
        <div className="file-tree-children">
          {sortedChildren.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              onFileDoubleClick={onFileDoubleClick}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              loadDirectory={loadDirectory}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const FileTree: React.FC<FileTreeProps> = ({
  rootPath,
  onFileSelect,
  onFileDoubleClick,
  selectedPath,
  expandedPaths: externalExpandedPaths,
  onExpandChange
}) => {
  const [rootNode, setRootNode] = useState<FileNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internalExpandedPaths, setInternalExpandedPaths] = useState<Set<string>>(new Set())
  
  const expandedPaths = externalExpandedPaths || internalExpandedPaths
  
  const loadDirectory = useCallback(async (dirPath: string): Promise<FileNode[]> => {
    try {
      const result = await window.electron.fs.readDirectory(dirPath)
      if (result.success && result.entries) {
        return result.entries.map((entry: any) => ({
          name: entry.name,
          path: entry.path,
          type: entry.isDirectory ? 'directory' : 'file',
          extension: entry.name.includes('.') ? '.' + entry.name.split('.').pop() : '',
          size: entry.size,
          modifiedAt: entry.modifiedAt
        }))
      }
      return []
    } catch (error) {
      console.error('Failed to load directory:', error)
      return []
    }
  }, [])
  
  const handleToggleExpand = useCallback((path: string) => {
    if (externalExpandedPaths && onExpandChange) {
      onExpandChange(path, !externalExpandedPaths.has(path))
    } else {
      setInternalExpandedPaths(prev => {
        const next = new Set(prev)
        if (next.has(path)) {
          next.delete(path)
        } else {
          next.add(path)
        }
        return next
      })
    }
  }, [externalExpandedPaths, onExpandChange])
  
  useEffect(() => {
    const loadRoot = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const pathParts = rootPath.split('/')
        const rootName = pathParts[pathParts.length - 1] || rootPath
        
        const children = await loadDirectory(rootPath)
        
        setRootNode({
          name: rootName,
          path: rootPath,
          type: 'directory',
          children
        })
        
        setInternalExpandedPaths(new Set([rootPath]))
      } catch (err: any) {
        setError(err.message || 'Failed to load directory')
      } finally {
        setLoading(false)
      }
    }
    
    if (rootPath) {
      loadRoot()
    }
  }, [rootPath, loadDirectory])
  
  if (loading) {
    return (
      <div className="file-tree-loading">
        <span className="loading-spinner">⏳</span>
        <span>加载中...</span>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="file-tree-error">
        <span>❌ {error}</span>
      </div>
    )
  }
  
  if (!rootNode) {
    return (
      <div className="file-tree-empty">
        <span>请选择项目目录</span>
      </div>
    )
  }
  
  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span className="header-title">资源管理器</span>
        <div className="header-actions">
          <button 
            className="action-btn" 
            title="新建文件"
            onClick={() => {
              // TODO: 新建文件功能
            }}
          >
            📄
          </button>
          <button 
            className="action-btn" 
            title="新建文件夹"
            onClick={() => {
              // TODO: 新建文件夹功能
            }}
          >
            📁
          </button>
          <button 
            className="action-btn" 
            title="刷新"
            onClick={async () => {
              const children = await loadDirectory(rootPath)
              setRootNode(prev => prev ? { ...prev, children } : null)
            }}
          >
            🔄
          </button>
        </div>
      </div>
      <div className="file-tree-content">
        <FileTreeNode
          node={rootNode}
          level={0}
          onFileSelect={onFileSelect}
          onFileDoubleClick={onFileDoubleClick}
          selectedPath={selectedPath}
          expandedPaths={expandedPaths}
          onToggleExpand={handleToggleExpand}
          loadDirectory={loadDirectory}
        />
      </div>
    </div>
  )
}

export default FileTree
