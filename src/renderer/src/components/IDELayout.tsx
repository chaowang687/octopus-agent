import React, { useState } from 'react'
import './IDELayout.css'
import MainContent from './MainContent'
import CodeEditor from './CodeEditor'
import ModernDiffViewer from './ModernDiffViewer'

interface IDELayoutProps {
  activeToolTab: 'editor' | 'terminal' | 'changes' | 'browser'
  setActiveToolTab: (tab: 'editor' | 'terminal' | 'changes' | 'browser') => void
  editorTheme?: 'vs-dark' | 'vs-light'
  setEditorTheme?: (theme: 'vs-dark' | 'vs-light') => void
}

interface EditorTab {
  id: string
  title: string
  file: string
  content: string
}

interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  extension?: string
  children?: FileNode[]
}

const IDELayout: React.FC<IDELayoutProps> = ({ activeToolTab, setActiveToolTab, editorTheme = 'vs-dark', setEditorTheme }) => {
  const [activeFile, setActiveFile] = useState('CloudStorageService.ts')
  const [isFileTreeExpanded, setIsFileTreeExpanded] = useState(true)
  const [isRightPanelExpanded, setIsRightPanelExpanded] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [editorTabs, setEditorTabs] = useState<EditorTab[]>([
    {
      id: '1',
      title: 'ErrorHandler.ts',
      file: 'ErrorHandler.ts',
      content: 'import * as fs from \'fs\''
    },
    {
      id: '2',
      title: 'IDELayout.tsx',
      file: 'IDELayout.tsx',
      content: 'import React, { useState } from \'react\''
    },
    {
      id: '3',
      title: 'CodeEditor.css',
      file: 'CodeEditor.css',
      content: '.code-editor {\n  height: 100%;\n}'
    },
    {
      id: '4',
      title: 'WindowDockService.ts',
      file: 'WindowDockService.ts',
      content: 'class WindowDockService {'
    },
    {
      id: '5',
      title: 'TaskL',
      file: 'TaskL.ts',
      content: 'interface Task {'
    }
  ])
  const [activeEditorTabId, setActiveEditorTabId] = useState('1')
  const [activeConsoleTab, setActiveConsoleTab] = useState<'problems' | 'output' | 'terminal' | 'debug'>('problems')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([
    'root',
    'src',
    'renderer',
    'components'
  ]))
  // State for rename functionality
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  // 初始化文件树数据
  const [fileTree, setFileTree] = useState<FileNode[]>([
    {
      id: 'root',
      name: '项目根目录',
      path: '/',
      type: 'directory',
      children: [
        {
          id: 'src',
          name: 'src',
          path: '/src',
          type: 'directory',
          children: [
            {
              id: 'main',
              name: 'main',
              path: '/src/main',
              type: 'directory',
              children: [
                {
                  id: 'main-ts',
                  name: 'index.ts',
                  path: '/src/main/index.ts',
                  type: 'file',
                  extension: 'TS'
                }
              ]
            },
            {
              id: 'preload',
              name: 'preload',
              path: '/src/preload',
              type: 'directory',
              children: [
                {
                  id: 'preload-ts',
                  name: 'index.ts',
                  path: '/src/preload/index.ts',
                  type: 'file',
                  extension: 'TS'
                }
              ]
            },
            {
              id: 'renderer',
              name: 'renderer',
              path: '/src/renderer',
              type: 'directory',
              children: [
                {
                  id: 'renderer-src',
                  name: 'src',
                  path: '/src/renderer/src',
                  type: 'directory',
                  children: [
                    {
                      id: 'components',
                      name: 'components',
                      path: '/src/renderer/src/components',
                      type: 'directory',
                      children: [
                        {
                          id: 'ide-layout',
                          name: 'IDELayout.tsx',
                          path: '/src/renderer/src/components/IDELayout.tsx',
                          type: 'file',
                          extension: 'TSX'
                        },
                        {
                          id: 'header',
                          name: 'Header.tsx',
                          path: '/src/renderer/src/components/Header.tsx',
                          type: 'file',
                          extension: 'TSX'
                        },
                        {
                          id: 'main-content',
                          name: 'MainContent.tsx',
                          path: '/src/renderer/src/components/MainContent.tsx',
                          type: 'file',
                          extension: 'TSX'
                        }
                      ]
                    },
                    {
                      id: 'app-ts',
                      name: 'App.tsx',
                      path: '/src/renderer/src/App.tsx',
                      type: 'file',
                      extension: 'TSX'
                    },
                    {
                      id: 'main-ts-renderer',
                      name: 'main.tsx',
                      path: '/src/renderer/src/main.tsx',
                      type: 'file',
                      extension: 'TSX'
                    },
                    {
                      id: 'index-html',
                      name: 'index.html',
                      path: '/src/renderer/index.html',
                      type: 'file',
                      extension: 'HTML'
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: 'config',
          name: 'config',
          path: '/config',
          type: 'directory',
          children: [
            {
              id: 'electron-config',
              name: 'electron.vite.config.ts',
              path: '/config/electron.vite.config.ts',
              type: 'file',
              extension: 'TS'
            }
          ]
        },
        {
          id: 'package-json',
          name: 'package.json',
          path: '/package.json',
          type: 'file',
          extension: 'JSON'
        },
        {
          id: 'readme-md',
          name: 'README.md',
          path: '/README.md',
          type: 'file',
          extension: 'MD'
        }
      ]
    }
  ])

  const handleFileClick = (fileName: string) => {
    setActiveFile(fileName)
  }

  const toggleFileTree = () => {
    setIsFileTreeExpanded(!isFileTreeExpanded)
  }

  const toggleRightPanel = () => {
    setIsRightPanelExpanded(!isRightPanelExpanded)
  }

  const toggleNode = (nodeId: string) => {
    const newExpandedNodes = new Set(expandedNodes)
    if (newExpandedNodes.has(nodeId)) {
      newExpandedNodes.delete(nodeId)
    } else {
      newExpandedNodes.add(nodeId)
    }
    setExpandedNodes(newExpandedNodes)
  }

  const handleResize = (newWidth: number) => {
    setSidebarWidth(newWidth)
  }

  // Handle rename functionality
  const handleRenameStart = (nodeId: string, nodeName: string) => {
    setRenamingNodeId(nodeId);
    setRenameValue(nodeName);
  };

  const handleRenameConfirm = (nodeId: string) => {
    if (renameValue.trim() !== '') {
      // Update the node name in the file tree
      const updateNodeName = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(n => {
          if (n.id === nodeId) {
            return { ...n, name: renameValue.trim() };
          } else if (n.children) {
            return { ...n, children: updateNodeName(n.children) };
          }
          return n;
        });
      };
      setFileTree(prev => updateNodeName(prev));
    }
    setRenamingNodeId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, nodeId: string) => {
    if (e.key === 'Enter') {
      handleRenameConfirm(nodeId);
    } else if (e.key === 'Escape') {
      setRenamingNodeId(null);
    }
  };

  // 递归渲染文件树节点
  const renderTreeNode = (node: FileNode, level: number = 0) => {
    const hasChildren = node.type === 'directory' && node.children && node.children.length > 0
    const indent = level * 8

    return (
      <div key={node.id} className="tree-node-wrapper" style={{ marginLeft: indent }}>
        <div
          className={`tree-item ${node.type} ${expandedNodes.has(node.id) ? 'expanded' : ''}`}
          onClick={() => node.type === 'directory' && toggleNode(node.id)}
          onDoubleClick={(e) => {
            e.stopPropagation(); // Prevent triggering the click event
            handleRenameStart(node.id, node.name);
          }} // Add double-click handler
        >
          <span className="tree-indent" style={{ width: indent }}></span>
          {hasChildren ? (
            <span className="tree-expand-icon">
              {expandedNodes.has(node.id) ? '▼' : '▶'}
            </span>
          ) : (
            <span className="tree-placeholder" style={{ width: '16px', display: 'inline-block' }}></span>
          )}
          <span className="tree-icon">
            {node.type === 'directory' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            )}
          </span>
          {renamingNodeId === node.id ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => handleRenameConfirm(node.id)}
              onKeyDown={(e) => handleKeyDown(e, node.id)}
              autoFocus
              className="rename-input"
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                padding: '2px 4px',
                border: '1px solid #0e639c',
                borderRadius: '2px',
                backgroundColor: '#3c3c3c',
                color: '#ffffff',
                fontSize: '13px'
              }}
            />
          ) : (
            <span className="tree-label">{node.name}</span>
          )}
          {node.type === 'file' && node.extension && (
            <span className="tree-file-type">{node.extension}</span>
          )}
        </div>
        {expandedNodes.has(node.id) && hasChildren && node.children && (
          <div className="tree-children-nested">
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  // 窗口控制功能
  const handleMinimize = () => {
    (window as any).electron.window.minimize()
  }

  const handleMaximize = () => {
    (window as any).electron.window.maximize()
  }

  const handleClose = () => {
    (window as any).electron.window.close()
  }

  return (
    <div className="ide-container">
      {/* 主内容区域 */}
      <div className="ide-content">
        {/* 左侧编辑区域 */}
        <div className={`ide-editor ${activeToolTab === 'browser' ? 'full-width' : ''}`}>
          {activeToolTab === 'editor' && (
            <>
              {/* 编辑器顶 tab 栏 */}
              <div className="editor-tabs">
                {editorTabs.map(tab => (
                  <div 
                    key={tab.id}
                    className={`editor-tab ${activeEditorTabId === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveEditorTabId(tab.id)}
                  >
                    <span className="tab-title">{tab.title}</span>
                    <button 
                      className="tab-close"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditorTabs(editorTabs.filter(t => t.id !== tab.id))
                        if (activeEditorTabId === tab.id && editorTabs.length > 1) {
                          setActiveEditorTabId(editorTabs.find(t => t.id !== tab.id)!.id)
                        }
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button className="editor-tab add-tab">
                  +
                </button>
              </div>
            </>
          )}
          <div className="editor-content">
            {activeToolTab === 'editor' && (
              <div className="code-editor">
                <CodeEditor 
                  filePath={editorTabs.find(tab => tab.id === activeEditorTabId)?.file}
                  content={editorTabs.find(tab => tab.id === activeEditorTabId)?.content || ''}
                  theme={editorTheme}
                  onChange={(value: string) => {
                    // 更新编辑器标签的内容
                    setEditorTabs(prevTabs => 
                      prevTabs.map(tab => 
                        tab.id === activeEditorTabId ? { ...tab, content: value } : tab
                      )
                    );
                  }}
                />
              </div>
            )}
            {activeToolTab === 'terminal' && (
              <div className="terminal">
                <div className="terminal-header">
                  <span className="terminal-title">终端</span>
                </div>
                <div className="terminal-content">
                  <div className="terminal-line">
                    <span className="prompt">$</span>
                    <span className="command">ls -la</span>
                  </div>
                  <div className="terminal-line">
                    <span className="output">total 16</span>
                  </div>
                  <div className="terminal-line">
                    <span className="output">drwxr-xr-x   5 user  staff   160 Feb 24 20:57 .</span>
                  </div>
                  <div className="terminal-line">
                    <span className="output">drwxr-xr-x  10 user  staff   320 Feb 24 20:57 ..</span>
                  </div>
                  <div className="terminal-line">
                    <span className="output">-rw-r--r--   1 user  staff  1024 Feb 24 20:57 CloudStorageService.ts</span>
                  </div>
                  <div className="terminal-line">
                    <span className="prompt">$</span>
                    <input className="terminal-input" placeholder="输入命令..." />
                  </div>
                </div>
              </div>
            )}
            {activeToolTab === 'changes' && (
              <div className="changes">
                <ModernDiffViewer 
                  changes={[
                    {
                      id: '1',
                      fileName: 'CloudStorageService.ts',
                      oldContent: 'import * as OSS from "ali-oss";\n\ninterface CloudConfig {\n  region: string\n  bucket: string\n}\n\nexport class CloudStorageService {}',
                      newContent: 'import * as OSS from "ali-oss";\n\ninterface CloudConfig {\n  region: string // Updated region property\n  bucket: string\n  endpoint: string\n}\n\nexport class CloudStorageService {}',
                      status: 'modified',
                      fileType: 'ts'
                    },
                    {
                      id: '2',
                      fileName: 'README.md',
                      oldContent: '# 项目说明\n\n这是一个示例项目',
                      newContent: '# 项目说明\n\n这是一个示例项目\n\n## 新增功能\n\n- 功能1\n- 功能2',
                      status: 'modified',
                      fileType: 'md'
                    },
                    {
                      id: '3',
                      fileName: 'package.json',
                      oldContent: '{\n  "name": "octopus-agent",\n  "version": "0.1.0"\n}',
                      newContent: '{\n  "name": "octopus-agent",\n  "version": "0.1.1",\n  "dependencies": {\n    "react-diff-viewer": "^3.1.1"\n  }\n}',
                      status: 'modified',
                      fileType: 'json'
                    }
                  ]}
                  theme={editorTheme === 'vs-dark' ? 'dark' : 'light'}
                />
              </div>
            )}
            {activeToolTab === 'browser' && (
              <div className="browser">
                <MainContent theme={editorTheme === 'vs-dark' ? 'dark' : 'light'} />
              </div>
            )}
          </div>
          {/* 问题/日志/终端视窗 */}
          {activeToolTab === 'editor' && (
            <div className="ide-console">
              <div className="console-tabs">
                <button 
                  className={`console-tab ${activeConsoleTab === 'problems' ? 'active' : ''}`}
                  onClick={() => setActiveConsoleTab('problems')}
                >
                  问题
                </button>
                <button 
                  className={`console-tab ${activeConsoleTab === 'output' ? 'active' : ''}`}
                  onClick={() => setActiveConsoleTab('output')}
                >
                  输出
                </button>
                <button 
                  className={`console-tab ${activeConsoleTab === 'terminal' ? 'active' : ''}`}
                  onClick={() => setActiveConsoleTab('terminal')}
                >
                  终端
                </button>
                <button 
                  className={`console-tab ${activeConsoleTab === 'debug' ? 'active' : ''}`}
                  onClick={() => setActiveConsoleTab('debug')}
                >
                  调试控制台
                </button>
              </div>
              <div className="console-content">
                {activeConsoleTab === 'problems' && (
                  <div className="problems-content">
                    <div className="problem-item">
                      <span className="problem-icon">⚠️</span>
                      <span className="problem-message">WebContents.stopLoading listener</span>
                      <span className="problem-file">node:electron/js2c/browser_init:2:89658</span>
                    </div>
                    <div className="problem-item">
                      <span className="problem-icon">❌</span>
                      <span className="problem-message">Unexpected error while loading URL</span>
                      <span className="problem-file">Renderer Console</span>
                    </div>
                  </div>
                )}
                {activeConsoleTab === 'output' && (
                  <div className="output-content">
                    <div className="output-line">at WebContents.stopLoading listener (node:electron/js2c/browser_init:2:89658)</div>
                    <div className="output-line">at WebContents.emit (node:events:526:35)</div>
                    <div className="output-line">error: WebContents</div>
                    <div className="output-line">url: 'https://baike.baidu.com/item/%E4%B8%93%E9%A2%98'</div>
                  </div>
                )}
                {activeConsoleTab === 'terminal' && (
                  <div className="terminal-content">
                    <div className="terminal-line">
                      <span className="prompt">$</span>
                      <span className="command">ls -la</span>
                    </div>
                    <div className="terminal-line">
                      <span className="output">total 16</span>
                    </div>
                    <div className="terminal-line">
                      <span className="prompt">$</span>
                      <input className="terminal-input" placeholder="输入命令..." />
                    </div>
                  </div>
                )}
                {activeConsoleTab === 'debug' && (
                  <div className="debug-content">
                    <div className="debug-line">[Renderer] Console [error] Unexpected error while loading URL</div>
                    <div className="debug-line">[Renderer] Console [info] [ChatSidebar] Render: {`{object Object}`}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右侧资源管理器 - 只在编辑器标签页显示 */}
        {activeToolTab === 'editor' && (
          <div className="ide-sidebar-container">
            <div 
              className={`ide-sidebar ${isFileTreeExpanded ? 'expanded' : 'collapsed'}`} 
              style={{ width: isFileTreeExpanded ? `${sidebarWidth}px` : '50px' }}
              ref={(el) => {
                if(el) (window as any).sidebarElement = el;
              }}
            >
              <div className="sidebar-header">
                <h3>资源管理器</h3>
                <div className="sidebar-actions">
                  <button className="sidebar-action-btn" title="刷新">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <polyline points="1 20 1 14 7 14"></polyline>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                  </button>
                  <button className="sidebar-action-btn" title="搜索">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </button>
                  <button className="sidebar-action-btn" title="更多">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="1"></circle>
                      <circle cx="19" cy="12" r="1"></circle>
                      <circle cx="5" cy="12" r="1"></circle>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="file-tree">
                {fileTree.map(node => renderTreeNode(node))}
              </div>
              <div className="sidebar-footer">
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('outline')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="21" y1="10" x2="7" y2="10"></line>
                        <line x1="21" y1="6" x2="3" y2="6"></line>
                        <line x1="21" y1="14" x2="3" y2="14"></line>
                        <line x1="21" y1="18" x2="7" y2="18"></line>
                      </svg>
                    </span>
                    <span className="tree-label">大纲</span>
                    <span className={`tree-expand ${expandedNodes.has('outline') ? 'expanded' : ''}`}>
                      {expandedNodes.has('outline') ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('timeline')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </span>
                    <span className="tree-label">时间线</span>
                    <span className={`tree-expand ${expandedNodes.has('timeline') ? 'expanded' : ''}`}>
                      {expandedNodes.has('timeline') ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {/* 拖拽调整宽度的手柄 */}
            {isFileTreeExpanded && (
              <div 
                className="sidebar-resizer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startWidth = sidebarWidth;
                  
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const deltaX = moveEvent.clientX - startX;
                    const newWidth = Math.max(200, Math.min(500, startWidth + deltaX));
                    handleResize(newWidth);
                  };
                  
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="ide-status-bar">
        <div className="status-left">
          <span className="status-item">
            <span className="status-icon">📁</span>
            项目: 本地化TRAE
          </span>
          <span className="status-item">
            <span className="status-icon">🌿</span>
            分支: main
          </span>
        </div>
        <div className="status-center">
          <span className="status-item">
            <span className="status-icon">📏</span>
            第 1 行, 第 1 列
          </span>
          <span className="status-item">
            <span className="status-icon">🔤</span>
            UTF-8
          </span>
        </div>
        <div className="status-right">
          <span className="status-item">
            <span className="status-icon">⚡</span>
            CPU: 45%
          </span>
          <span className="status-item">
            <span className="status-icon">💾</span>
            内存: 1.2GB
          </span>
        </div>
      </div>
    </div>
  )
}

export default IDELayout
