import React, { useState } from 'react'
import './IDELayout.css'
import MainContent from './MainContent'

interface IDELayoutProps {
  activeToolTab: 'editor' | 'terminal' | 'changes' | 'browser'
  setActiveToolTab: (tab: 'editor' | 'terminal' | 'changes' | 'browser') => void
}

interface EditorTab {
  id: string
  title: string
  file: string
  content: string
}

const IDELayout: React.FC<IDELayoutProps> = ({ activeToolTab, setActiveToolTab }) => {
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
    'files',
    'src',
    'renderer',
    'tests',
    'unit'
  ]))

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

  // 窗口控制功能
  const handleMinimize = () => {
    window.electron.window.minimize()
  }

  const handleMaximize = () => {
    window.electron.window.maximize()
  }

  const handleClose = () => {
    window.electron.window.close()
  }

  return (
    <div className="ide-layout">
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
                <div className="code-body">
                  <pre className="code-text">
                    {editorTabs.find(tab => tab.id === activeEditorTabId)?.content || ''}
                  </pre>
                </div>
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
                <div className="changes-header">
                  <span className="changes-title">代码变更</span>
                </div>
                <div className="changes-content">
                  <div className="change-item">
                    <div className="change-header">
                      <span className="change-file">CloudStorageService.ts</span>
                      <span className="change-status">modified</span>
                    </div>
                    <div className="change-diff">
                      <pre className="diff-text">
{`-  region: string
+  region: string // Updated region property`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeToolTab === 'browser' && (
              <div className="browser">
                <MainContent />
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
              ref={(el) => (window.sidebarElement = el)}
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
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('files')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </span>
                    <span className="tree-label">文件</span>
                    <span className={`tree-expand ${expandedNodes.has('files') ? 'expanded' : ''}`}>
                      {expandedNodes.has('files') ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('src')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </span>
                    <span className="tree-label">src</span>
                    <span className={`tree-expand ${expandedNodes.has('src') ? 'expanded' : ''}`}>
                      {expandedNodes.has('src') ? '▼' : '▶'}
                    </span>
                  </div>
                  {expandedNodes.has('src') && (
                    <div className="tree-children">
                      <div className="tree-item directory">
                        <div className="tree-item-header" onClick={() => toggleNode('renderer')}>
                          <span className="tree-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                          </span>
                          <span className="tree-label">renderer</span>
                          <span className={`tree-expand ${expandedNodes.has('renderer') ? 'expanded' : ''}`}>
                            {expandedNodes.has('renderer') ? '▼' : '▶'}
                          </span>
                        </div>
                        {expandedNodes.has('renderer') && (
                          <div className="tree-children">
                            <div className="tree-item directory">
                              <div className="tree-item-header" onClick={() => toggleNode('renderer-src')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                                  </svg>
                                </span>
                                <span className="tree-label">src</span>
                                <span className={`tree-expand ${expandedNodes.has('renderer-src') ? 'expanded' : ''}`}>
                                  {expandedNodes.has('renderer-src') ? '▼' : '▶'}
                                </span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('index.html')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">index.html</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('sudoku-game')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </span>
                    <span className="tree-label">sudoku-game</span>
                    <span className={`tree-expand ${expandedNodes.has('sudoku-game') ? 'expanded' : ''}`}>
                      {expandedNodes.has('sudoku-game') ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('temp')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </span>
                    <span className="tree-label">temp</span>
                    <span className={`tree-expand ${expandedNodes.has('temp') ? 'expanded' : ''}`}>
                      {expandedNodes.has('temp') ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('templates')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </span>
                    <span className="tree-label">templates</span>
                    <span className={`tree-expand ${expandedNodes.has('templates') ? 'expanded' : ''}`}>
                      {expandedNodes.has('templates') ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('tests')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </span>
                    <span className="tree-label">tests</span>
                    <span className={`tree-expand ${expandedNodes.has('tests') ? 'expanded' : ''}`}>
                      {expandedNodes.has('tests') ? '▼' : '▶'}
                    </span>
                  </div>
                  {expandedNodes.has('tests') && (
                    <div className="tree-children">
                      <div className="tree-item directory">
                        <div className="tree-item-header" onClick={() => toggleNode('integration')}>
                          <span className="tree-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                          </span>
                          <span className="tree-label">integration</span>
                          <span className={`tree-expand ${expandedNodes.has('integration') ? 'expanded' : ''}`}>
                            {expandedNodes.has('integration') ? '▼' : '▶'}
                          </span>
                        </div>
                      </div>
                      <div className="tree-item directory">
                        <div className="tree-item-header" onClick={() => toggleNode('unit')}>
                          <span className="tree-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                          </span>
                          <span className="tree-label">unit</span>
                          <span className={`tree-expand ${expandedNodes.has('unit') ? 'expanded' : ''}`}>
                            {expandedNodes.has('unit') ? '▼' : '▶'}
                          </span>
                        </div>
                        {expandedNodes.has('unit') && (
                          <div className="tree-children">
                            <div className="tree-item directory">
                              <div className="tree-item-header" onClick={() => toggleNode('test-data')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                                  </svg>
                                </span>
                                <span className="tree-label">test-data</span>
                                <span className={`tree-expand ${expandedNodes.has('test-data') ? 'expanded' : ''}`}>
                                  {expandedNodes.has('test-data') ? '▼' : '▶'}
                                </span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('ErrorHandler.test.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">ErrorHandler.test.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('Executor.test.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">Executor.test.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('ImageProcessing.test.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">ImageProcessing.test.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('LLMStep.test.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">LLMStep.test.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('Planner.test.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">Planner.test.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('ProjectManagement.test.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">ProjectManagement.test.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('SkillManager.test.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">SkillManager.test.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('TaskEngine.test.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">TaskEngine.test.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('ToolRegistry.test.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">ToolRegistry.test.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('UnifiedReasoningEngine.test.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">UnifiedReasoningEngine.test.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('VerificationEngine.test.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">VerificationEngine.test.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('setup-electron-mock.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">setup-electron-mock.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                            <div className="tree-item file">
                              <div className="tree-item-header" onClick={() => handleFileClick('setup.ts')}>
                                <span className="tree-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                </span>
                                <span className="tree-label">setup.ts</span>
                                <span className="tree-file-type">TS</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('todo-app')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </span>
                    <span className="tree-label">todo-app</span>
                    <span className={`tree-expand ${expandedNodes.has('todo-app') ? 'expanded' : ''}`}>
                      {expandedNodes.has('todo-app') ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('users')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </span>
                    <span className="tree-label">users</span>
                    <span className={`tree-expand ${expandedNodes.has('users') ? 'expanded' : ''}`}>
                      {expandedNodes.has('users') ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('workspaces')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </span>
                    <span className="tree-label">workspaces</span>
                    <span className={`tree-expand ${expandedNodes.has('workspaces') ? 'expanded' : ''}`}>
                      {expandedNodes.has('workspaces') ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
                <div className="tree-item file">
                  <div className="tree-item-header" onClick={() => handleFileClick('.gitignore')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </span>
                    <span className="tree-label">.gitignore</span>
                  </div>
                </div>
                <div className="tree-item file">
                  <div className="tree-item-header" onClick={() => handleFileClick('本地电脑控制功能设计.md')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </span>
                    <span className="tree-label">本地电脑控制功能设计.md</span>
                    <span className="tree-file-type">MD</span>
                  </div>
                </div>
                <div className="tree-item file">
                  <div className="tree-item-header" onClick={() => handleFileClick('部署和安装流程设计.md')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </span>
                    <span className="tree-label">部署和安装流程设计.md</span>
                    <span className="tree-file-type">MD</span>
                  </div>
                </div>
                <div className="tree-item file">
                  <div className="tree-item-header" onClick={() => handleFileClick('测试策略设计.md')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </span>
                    <span className="tree-label">测试策略设计.md</span>
                    <span className="tree-file-type">MD</span>
                  </div>
                </div>
                <div className="tree-item file">
                  <div className="tree-item-header" onClick={() => handleFileClick('插件系统设计.md')}>
                    <span className="tree-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </span>
                    <span className="tree-label">插件系统设计.md</span>
                    <span className="tree-file-type">MD</span>
                  </div>
                </div>
              </div>
              <div className="sidebar-footer">
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('outline')}>
                    <span className="tree-icon">📑</span>
                    <span className="tree-label">大纲</span>
                    <span className={`tree-expand ${expandedNodes.has('outline') ? 'expanded' : ''}`}>
                      {expandedNodes.has('outline') ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
                <div className="tree-item directory">
                  <div className="tree-item-header" onClick={() => toggleNode('timeline')}>
                    <span className="tree-icon">📅</span>
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
