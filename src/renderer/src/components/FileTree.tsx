import React, { useState, useEffect, useCallback, memo } from 'react'
import './FileTree.css'

interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  isExpanded?: boolean
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | 'unchanged'
}

interface FileTreeProps {
  onFileClick?: (filePath: string) => void
  onDirectoryClick?: (directoryPath: string) => void
}

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const FileTree: React.FC<FileTreeProps> = ({ onFileClick, onDirectoryClick }) => {
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 模拟文件树数据
    const mockFileTree: FileNode[] = [
      {
        id: '1',
        name: 'src',
        path: '/src',
        type: 'directory',
        isExpanded: true,
        children: [
          {
            id: '2',
            name: 'main',
            path: '/src/main',
            type: 'directory',
            isExpanded: true,
            children: [
              {
                id: '3',
                name: 'agent',
                path: '/src/main/agent',
                type: 'directory',
                isExpanded: false,
                children: [
                  {
                    id: '4',
                    name: 'MultiAgentCoordinator.ts',
                    path: '/src/main/agent/MultiAgentCoordinator.ts',
                    type: 'file',
                    gitStatus: 'modified'
                  },
                  {
                    id: '5',
                    name: 'OmniAgent.ts',
                    path: '/src/main/agent/OmniAgent.ts',
                    type: 'file'
                  }
                ]
              },
              {
                id: '6',
                name: 'services',
                path: '/src/main/services',
                type: 'directory',
                isExpanded: false,
                children: [
                  {
                    id: '7',
                    name: 'BackupService.ts',
                    path: '/src/main/services/BackupService.ts',
                    type: 'file'
                  }
                ]
              }
            ]
          },
          {
            id: '8',
            name: 'renderer',
            path: '/src/renderer',
            type: 'directory',
            isExpanded: true,
            children: [
              {
                id: '9',
                name: 'src',
                path: '/src/renderer/src',
                type: 'directory',
                isExpanded: true,
                children: [
                  {
                    id: '10',
                    name: 'components',
                    path: '/src/renderer/src/components',
                    type: 'directory',
                    isExpanded: true,
                    children: [
                      {
                        id: '11',
                        name: 'Header.tsx',
                        path: '/src/renderer/src/components/Header.tsx',
                        type: 'file',
                        gitStatus: 'modified'
                      },
                      {
                        id: '12',
                        name: 'IDELayout.tsx',
                        path: '/src/renderer/src/components/IDELayout.tsx',
                        type: 'file',
                        gitStatus: 'added'
                      },
                      {
                        id: '13',
                        name: 'FileTree.tsx',
                        path: '/src/renderer/src/components/FileTree.tsx',
                        type: 'file',
                        gitStatus: 'untracked'
                      }
                    ]
                  },
                  {
                    id: '14',
                    name: 'pages',
                    path: '/src/renderer/src/pages',
                    type: 'directory',
                    isExpanded: false,
                    children: [
                      {
                        id: '15',
                        name: 'Chat.tsx',
                        path: '/src/renderer/src/pages/Chat.tsx',
                        type: 'file'
                      },
                      {
                        id: '16',
                        name: 'CodeEditor.tsx',
                        path: '/src/renderer/src/pages/CodeEditor.tsx',
                        type: 'file'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: '17',
        name: 'package.json',
        path: '/package.json',
        type: 'file'
      },
      {
        id: '18',
        name: 'tsconfig.json',
        path: '/tsconfig.json',
        type: 'file'
      }
    ]

    // 模拟加载
    setTimeout(() => {
      setFileTree(mockFileTree)
      setLoading(false)
    }, 500)
  }, [])

  const toggleDirectory = (node: FileNode) => {
    const updateTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(n => {
        if (n.id === node.id) {
          return { ...n, isExpanded: !n.isExpanded }
        }
        if (n.children) {
          return { ...n, children: updateTree(n.children) }
        }
        return n
      })
    }
    setFileTree(updateTree(fileTree))
  }

  const handleNodeClick = (node: FileNode) => {
    if (node.type === 'file' && onFileClick) {
      onFileClick(node.path)
    } else if (node.type === 'directory' && onDirectoryClick) {
      onDirectoryClick(node.path)
    }
  }

  const renderFileNode = (node: FileNode, level: number = 0) => {
    const indent = level * 16
    const hasChildren = node.type === 'directory' && node.children && node.children.length > 0

    return (
      <div key={node.id} style={{ marginLeft: indent }}>
        <div
          className={`file-tree-node ${node.type} ${node.gitStatus || ''}`}
          onClick={() => handleNodeClick(node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#cccccc',
            borderRadius: '2px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#3a3a3d'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          {hasChildren && (
            <div
              className="file-tree-toggle"
              onClick={(e) => {
                e.stopPropagation()
                toggleDirectory(node)
              }}
              style={{
                marginRight: '4px',
                cursor: 'pointer',
                color: '#888888'
              }}
            >
              {node.isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </div>
          )}
          {!hasChildren && <div style={{ width: '12px', marginRight: '4px' }} />}
          <div className="file-tree-icon" style={{ marginRight: '8px', color: '#888888' }}>
            {node.type === 'directory' ? <FolderIcon /> : <FileIcon />}
          </div>
          <div className="file-tree-name" style={{ flex: 1 }}>
            {node.name}
          </div>
          {node.gitStatus && (
            <div
              className={`git-status ${node.gitStatus}`}
              style={{
                marginLeft: '8px',
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '3px',
                backgroundColor: getGitStatusColor(node.gitStatus),
                color: '#000000'
              }}
            >
              {getGitStatusText(node.gitStatus)}
            </div>
          )}
        </div>
        {node.isExpanded && node.children && node.children.map(child => renderFileNode(child, level + 1))}
      </div>
    )
  }

  const getGitStatusColor = (status: string): string => {
    switch (status) {
      case 'modified': return '#ffcc00'
      case 'added': return '#4caf50'
      case 'deleted': return '#f44336'
      case 'untracked': return '#ff9800'
      default: return '#999999'
    }
  }

  const getGitStatusText = (status: string): string => {
    switch (status) {
      case 'modified': return 'M'
      case 'added': return 'A'
      case 'deleted': return 'D'
      case 'untracked': return 'U'
      default: return ''
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '16px', color: '#888888', fontSize: '12px' }}>
        加载文件树...
      </div>
    )
  }

  return (
    <div className="file-tree" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #3e3e42', fontSize: '12px', fontWeight: '600', color: '#ffffff' }}>
        项目文件
      </div>
      <div style={{ padding: '8px 0' }}>
        {fileTree.map(node => renderFileNode(node))}
      </div>
    </div>
  )
}

export default FileTree