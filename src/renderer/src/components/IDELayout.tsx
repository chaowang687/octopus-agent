import React, { useState, useCallback, useEffect } from 'react'
import FileTree, { FileNode } from './FileTree'
import CodeEditor from './CodeEditor'
import './IDELayout.css'

export interface IDELayoutProps {
  projectName: string
  projectPath: string
  projectVersion?: string
  onRunScript?: (scriptName: string) => void
  onOpenInVSCode?: () => void
  onOpenInFinder?: () => void
  onBack?: () => void
  scripts?: Record<string, string>
}

interface Tab {
  path: string
  name: string
  content: string
  modified: boolean
  language: string
}

interface TerminalLine {
  type: 'input' | 'output' | 'error'
  content: string
  timestamp: number
}

type BottomPanelTab = 'terminal' | 'output' | 'problems' | 'debug'
type SidebarTab = 'explorer' | 'search' | 'git' | 'extensions'

const IDELayout: React.FC<IDELayoutProps> = ({
  projectName,
  projectPath,
  projectVersion,
  onRunScript,
  onOpenInVSCode,
  onOpenInFinder,
  onBack,
  scripts = {}
}) => {
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [fileLoading, setFileLoading] = useState(false)
  const [openTabs, setOpenTabs] = useState<Tab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('explorer')
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomPanelTab>('terminal')
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200)
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true)
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { type: 'output', content: `欢迎使用 ${projectName} 终端`, timestamp: Date.now() },
    { type: 'output', content: '输入命令开始操作...', timestamp: Date.now() }
  ])
  const [terminalInput, setTerminalInput] = useState('')
  const [problems, setProblems] = useState<{ file: string; line: number; message: string; type: 'error' | 'warning' }[]>([])
  const [output, setOutput] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ path: string; matches: number }[]>([])
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isResizingBottom, setIsResizingBottom] = useState(false)

  const getLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const languageMap: Record<string, string> = {
      'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'rb': 'ruby', 'java': 'java', 'c': 'c', 'cpp': 'cpp',
      'h': 'c', 'hpp': 'cpp', 'cs': 'csharp', 'go': 'go', 'rs': 'rust',
      'php': 'php', 'swift': 'swift', 'kt': 'kotlin', 'scala': 'scala',
      'r': 'r', 'sql': 'sql', 'html': 'html', 'css': 'css', 'scss': 'scss',
      'less': 'less', 'json': 'json', 'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml',
      'md': 'markdown', 'sh': 'shell', 'bash': 'shell', 'zsh': 'shell',
      'vue': 'vue', 'svelte': 'svelte', 'dockerfile': 'dockerfile', 'makefile': 'makefile'
    }
    return languageMap[ext] || 'plaintext'
  }

  const buildFileTree = useCallback(async (dirPath: string): Promise<FileNode | null> => {
    try {
      const ignorePatterns = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.DS_Store', 'Thumbs.db', '.cache', 'coverage', 'vendor', '.venv', 'venv', 'env', 'Pods', '.gradle', 'target', 'bin', 'obj']
      
      const buildTree = async (path: string, depth: number = 0): Promise<FileNode> => {
        if (depth > 8) {
          return { name: path.split('/').pop() || path, path, type: 'directory', children: [] }
        }
        
        const result = await window.electron.fs.listEntries(path)
        if (!result.success || !result.entries) {
          return { name: path.split('/').pop() || path, path, type: 'directory', children: [] }
        }

        const children: FileNode[] = []
        
        for (const entry of result.entries) {
          const entryLower = entry.name.toLowerCase()
          
          if (ignorePatterns.some(pattern => entryLower === pattern.toLowerCase())) continue
          if (entry.name.startsWith('.')) continue
          
          const fullPath = `${path}/${entry.name}`
          
          try {
            if (entry.isDirectory) {
              const childNode = await buildTree(fullPath, depth + 1)
              children.push(childNode)
            } else if (entry.isFile) {
              const ext = entry.name.split('.').pop() || ''
              children.push({ name: entry.name, path: fullPath, type: 'file', extension: ext })
            }
          } catch (e) {
            console.warn('无法处理:', fullPath, e)
          }
        }

        children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
          return a.name.localeCompare(b.name)
        })

        return { name: path.split('/').pop() || path, path, type: 'directory', children }
      }

      return await buildTree(dirPath)
    } catch (error) {
      console.error('构建文件树失败:', error)
      return null
    }
  }, [])

  useEffect(() => {
    buildFileTree(projectPath).then(setFileTree)
  }, [projectPath, buildFileTree])

  const handleFileSelect = useCallback(async (node: FileNode) => {
    if (node.type === 'file') {
      setSelectedFile(node.path)
      setFileLoading(true)
      
      try {
        const result = await window.electron.fs.readFile(node.path)
        if (result.success && result.content !== undefined) {
          setFileContent(result.content)
          
          const existingTab = openTabs.find(tab => tab.path === node.path)
          if (!existingTab) {
            setOpenTabs(prev => [...prev, {
              path: node.path,
              name: node.name,
              content: result.content,
              modified: false,
              language: getLanguage(node.path)
            }])
          }
          setActiveTab(node.path)
        }
      } catch (error) {
        console.error('读取文件失败:', error)
      } finally {
        setFileLoading(false)
      }
    }
  }, [openTabs])

  const handleContentChange = useCallback((content: string) => {
    setFileContent(content)
    setOpenTabs(prev => prev.map(tab => 
      tab.path === activeTab ? { ...tab, content, modified: true } : tab
    ))
  }, [activeTab])

  const handleSave = useCallback(async (content: string) => {
    if (!activeTab) return
    
    try {
      const result = await window.electron.fs.writeFile(activeTab, content)
      if (result.success) {
        setOpenTabs(prev => prev.map(tab => 
          tab.path === activeTab ? { ...tab, modified: false } : tab
        ))
        setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] 已保存: ${activeTab}`])
      }
    } catch (error) {
      console.error('保存文件失败:', error)
    }
  }, [activeTab])

  const closeTab = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenTabs(prev => prev.filter(tab => tab.path !== path))
    if (activeTab === path) {
      const remainingTabs = openTabs.filter(tab => tab.path !== path)
      setActiveTab(remainingTabs.length > 0 ? remainingTabs[0].path : null)
      if (remainingTabs.length > 0) {
        setFileContent(remainingTabs[0].content)
        setSelectedFile(remainingTabs[0].path)
      }
    }
  }, [activeTab, openTabs])

  const handleTerminalCommand = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && terminalInput.trim()) {
      const command = terminalInput.trim()
      setTerminalLines(prev => [...prev, 
        { type: 'input', content: `$ ${command}`, timestamp: Date.now() }
      ])
      
      if (command === 'clear') {
        setTerminalLines([])
      } else if (command.startsWith('npm run ') && onRunScript) {
        const scriptName = command.replace('npm run ', '')
        onRunScript(scriptName)
        setTerminalLines(prev => [...prev, 
          { type: 'output', content: `正在执行: npm run ${scriptName}`, timestamp: Date.now() }
        ])
      } else {
        setTerminalLines(prev => [...prev, 
          { type: 'output', content: `命令已发送: ${command}`, timestamp: Date.now() }
        ])
      }
      
      setTerminalInput('')
    }
  }, [terminalInput, onRunScript])

  const handleSidebarResize = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = Math.max(180, Math.min(500, e.clientX))
      setSidebarWidth(newWidth)
    }
  }, [isResizingSidebar])

  const handleBottomResize = useCallback((e: MouseEvent) => {
    if (isResizingBottom) {
      const newHeight = Math.max(100, Math.min(400, window.innerHeight - e.clientY - 24))
      setBottomPanelHeight(newHeight)
    }
  }, [isResizingBottom])

  useEffect(() => {
    const handleMouseUp = () => {
      setIsResizingSidebar(false)
      setIsResizingBottom(false)
    }
    
    window.addEventListener('mousemove', handleSidebarResize)
    window.addEventListener('mousemove', handleBottomResize)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleSidebarResize)
      window.removeEventListener('mousemove', handleBottomResize)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleSidebarResize, handleBottomResize])

  const activeTabData = openTabs.find(tab => tab.path === activeTab)
  const errorCount = problems.filter(p => p.type === 'error').length
  const warningCount = problems.filter(p => p.type === 'warning').length

  return (
    <div className="ide-layout">
      <div className="ide-titlebar">
        <div className="ide-titlebar-left">
          {onBack && (
            <button className="ide-back-btn" onClick={onBack} title="返回项目列表">
              <span className="icon">←</span>
            </button>
          )}
          <div className="ide-project-info">
            <span className="ide-project-name">{projectName}</span>
            {projectVersion && <span className="ide-project-version">v{projectVersion}</span>}
          </div>
        </div>
        
        <div className="ide-titlebar-center">
          <div className="ide-tabs-container">
            {openTabs.slice(0, 5).map(tab => (
              <div
                key={tab.path}
                className={`ide-titlebar-tab ${activeTab === tab.path ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.path)
                  setFileContent(tab.content)
                  setSelectedFile(tab.path)
                }}
              >
                <span className="tab-name">{tab.name}</span>
                {tab.modified && <span className="tab-modified">●</span>}
                <button 
                  className="tab-close" 
                  onClick={(e) => closeTab(tab.path, e)}
                >
                  ×
                </button>
              </div>
            ))}
            {openTabs.length > 5 && (
              <div className="ide-tabs-more">+{openTabs.length - 5}</div>
            )}
          </div>
        </div>
        
        <div className="ide-titlebar-right">
          {Object.keys(scripts).length > 0 && (
            <select 
              className="ide-run-select"
              onChange={(e) => e.target.value && onRunScript?.(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>运行脚本</option>
              {Object.keys(scripts).map(script => (
                <option key={script} value={script}>{script}</option>
              ))}
            </select>
          )}
          {onOpenInVSCode && (
            <button className="ide-titlebar-btn" onClick={onOpenInVSCode} title="在 VSCode 中打开">
              <span className="icon">💻</span>
            </button>
          )}
          {onOpenInFinder && (
            <button className="ide-titlebar-btn" onClick={onOpenInFinder} title="在 Finder 中显示">
              <span className="icon">📁</span>
            </button>
          )}
        </div>
      </div>

      <div className="ide-main">
        <div className="ide-activity-bar">
          <button 
            className={`ide-activity-btn ${sidebarTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setSidebarTab('explorer')}
            title="资源管理器"
          >
            <span className="icon">📁</span>
          </button>
          <button 
            className={`ide-activity-btn ${sidebarTab === 'search' ? 'active' : ''}`}
            onClick={() => setSidebarTab('search')}
            title="搜索"
          >
            <span className="icon">🔍</span>
          </button>
          <button 
            className={`ide-activity-btn ${sidebarTab === 'git' ? 'active' : ''}`}
            onClick={() => setSidebarTab('git')}
            title="源代码管理"
          >
            <span className="icon">🔀</span>
          </button>
          <button 
            className={`ide-activity-btn ${sidebarTab === 'extensions' ? 'active' : ''}`}
            onClick={() => setSidebarTab('extensions')}
            title="扩展"
          >
            <span className="icon">🧩</span>
          </button>
          <div className="ide-activity-spacer" />
          <button className="ide-activity-btn" title="设置">
            <span className="icon">⚙️</span>
          </button>
        </div>

        <div className="ide-sidebar" style={{ width: sidebarWidth }}>
          <div className="ide-sidebar-header">
            {sidebarTab === 'explorer' && '资源管理器'}
            {sidebarTab === 'search' && '搜索'}
            {sidebarTab === 'git' && '源代码管理'}
            {sidebarTab === 'extensions' && '扩展'}
          </div>
          
          <div className="ide-sidebar-content">
            {sidebarTab === 'explorer' && (
              <>
                <div className="ide-sidebar-section">
                  <div className="ide-section-header">
                    <span className="icon">▼</span>
                    <span>{projectName.toUpperCase()}</span>
                  </div>
                  {fileTree ? (
                    <FileTree 
                      root={fileTree} 
                      onFileSelect={handleFileSelect}
                      selectedPath={selectedFile || undefined}
                    />
                  ) : (
                    <div className="ide-loading">加载文件树...</div>
                  )}
                </div>
              </>
            )}
            
            {sidebarTab === 'search' && (
              <div className="ide-search-panel">
                <input
                  type="text"
                  className="ide-search-input"
                  placeholder="搜索文件内容..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div className="ide-search-results">
                    {searchResults.map(result => (
                      <div key={result.path} className="ide-search-result">
                        <span className="result-path">{result.path}</span>
                        <span className="result-matches">{result.matches} 个匹配</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {sidebarTab === 'git' && (
              <div className="ide-git-panel">
                <div className="ide-git-status">
                  <span className="git-branch">main</span>
                  <span className="git-status-text">无待提交更改</span>
                </div>
                <button className="ide-git-btn">提交更改</button>
                <button className="ide-git-btn">推送到远程</button>
              </div>
            )}
            
            {sidebarTab === 'extensions' && (
              <div className="ide-extensions-panel">
                <div className="ide-extension-item">
                  <span className="ext-icon">🤖</span>
                  <div className="ext-info">
                    <span className="ext-name">AI 助手</span>
                    <span className="ext-desc">智能代码补全</span>
                  </div>
                  <span className="ext-status enabled">已启用</span>
                </div>
                <div className="ide-extension-item">
                  <span className="ext-icon">🎨</span>
                  <div className="ext-info">
                    <span className="ext-name">主题美化</span>
                    <span className="ext-desc">自定义主题</span>
                  </div>
                  <span className="ext-status">未安装</span>
                </div>
              </div>
            )}
          </div>
          
          <div 
            className="ide-sidebar-resize"
            onMouseDown={() => setIsResizingSidebar(true)}
          />
        </div>

        <div className="ide-content">
          <div className="ide-editor-area" style={{ height: bottomPanelVisible ? `calc(100% - ${bottomPanelHeight}px)` : '100%' }}>
            {openTabs.length > 0 ? (
              <div className="ide-editor-tabs">
                {openTabs.map(tab => (
                  <div
                    key={tab.path}
                    className={`ide-editor-tab ${activeTab === tab.path ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(tab.path)
                      setFileContent(tab.content)
                      setSelectedFile(tab.path)
                    }}
                  >
                    <span className="tab-icon">{tab.language === 'typescript' ? '🔷' : tab.language === 'javascript' ? '🟨' : '📄'}</span>
                    <span className="tab-name">{tab.name}</span>
                    {tab.modified && <span className="tab-modified">●</span>}
                    <button className="tab-close" onClick={(e) => closeTab(tab.path, e)}>×</button>
                  </div>
                ))}
              </div>
            ) : null}
            
            <div className="ide-editor-content">
              {fileLoading ? (
                <div className="ide-loading-overlay">
                  <div className="ide-spinner" />
                  <span>加载中...</span>
                </div>
              ) : activeTab ? (
                <CodeEditor
                  filePath={activeTab}
                  content={fileContent}
                  language={activeTabData?.language || 'plaintext'}
                  theme="vs-dark"
                  onChange={handleContentChange}
                  onSave={handleSave}
                />
              ) : (
                <div className="ide-welcome">
                  <div className="ide-welcome-icon">🚀</div>
                  <h2>欢迎使用 IDE 模式</h2>
                  <p>从左侧文件树中选择文件开始编辑</p>
                  <div className="ide-shortcuts">
                    <div className="shortcut">
                      <kbd>⌘</kbd><kbd>S</kbd>
                      <span>保存文件</span>
                    </div>
                    <div className="shortcut">
                      <kbd>⌘</kbd><kbd>P</kbd>
                      <span>快速打开文件</span>
                    </div>
                    <div className="shortcut">
                      <kbd>⌘</kbd><kbd>`</kbd>
                      <span>切换终端</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {bottomPanelVisible && (
            <div className="ide-bottom-panel" style={{ height: bottomPanelHeight }}>
              <div 
                className="ide-panel-resize"
                onMouseDown={() => setIsResizingBottom(true)}
              />
              
              <div className="ide-panel-tabs">
                <button 
                  className={`ide-panel-tab ${bottomPanelTab === 'terminal' ? 'active' : ''}`}
                  onClick={() => setBottomPanelTab('terminal')}
                >
                  <span className="icon">💻</span>
                  终端
                </button>
                <button 
                  className={`ide-panel-tab ${bottomPanelTab === 'output' ? 'active' : ''}`}
                  onClick={() => setBottomPanelTab('output')}
                >
                  <span className="icon">📋</span>
                  输出
                </button>
                <button 
                  className={`ide-panel-tab ${bottomPanelTab === 'problems' ? 'active' : ''}`}
                  onClick={() => setBottomPanelTab('problems')}
                >
                  <span className="icon">⚠️</span>
                  问题
                  {errorCount > 0 && <span className="badge error">{errorCount}</span>}
                  {warningCount > 0 && <span className="badge warning">{warningCount}</span>}
                </button>
                <button 
                  className={`ide-panel-tab ${bottomPanelTab === 'debug' ? 'active' : ''}`}
                  onClick={() => setBottomPanelTab('debug')}
                >
                  <span className="icon">🐛</span>
                  调试
                </button>
                <div className="ide-panel-spacer" />
                <button 
                  className="ide-panel-btn"
                  onClick={() => setBottomPanelVisible(false)}
                  title="关闭面板"
                >
                  ×
                </button>
              </div>
              
              <div className="ide-panel-content">
                {bottomPanelTab === 'terminal' && (
                  <div className="ide-terminal">
                    <div className="ide-terminal-output">
                      {terminalLines.map((line, i) => (
                        <div key={i} className={`terminal-line ${line.type}`}>
                          {line.content}
                        </div>
                      ))}
                    </div>
                    <div className="ide-terminal-input">
                      <span className="terminal-prompt">$</span>
                      <input
                        type="text"
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        onKeyDown={handleTerminalCommand}
                        placeholder="输入命令..."
                        autoFocus
                      />
                    </div>
                  </div>
                )}
                
                {bottomPanelTab === 'output' && (
                  <div className="ide-output">
                    {output.length === 0 ? (
                      <div className="ide-empty-output">暂无输出</div>
                    ) : (
                      output.map((line, i) => (
                        <div key={i} className="output-line">{line}</div>
                      ))
                    )}
                  </div>
                )}
                
                {bottomPanelTab === 'problems' && (
                  <div className="ide-problems">
                    {problems.length === 0 ? (
                      <div className="ide-empty-problems">
                        <span className="icon">✓</span>
                        没有发现问题
                      </div>
                    ) : (
                      problems.map((problem, i) => (
                        <div key={i} className={`problem-item ${problem.type}`}>
                          <span className="problem-icon">{problem.type === 'error' ? '❌' : '⚠️'}</span>
                          <span className="problem-file">{problem.file}:{problem.line}</span>
                          <span className="problem-message">{problem.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
                
                {bottomPanelTab === 'debug' && (
                  <div className="ide-debug">
                    <div className="ide-debug-toolbar">
                      <button className="debug-btn" title="继续">▶️</button>
                      <button className="debug-btn" title="单步跳过">⏭️</button>
                      <button className="debug-btn" title="单步进入">⬇️</button>
                      <button className="debug-btn" title="单步跳出">⬆️</button>
                      <button className="debug-btn" title="重启">🔄</button>
                      <button className="debug-btn" title="停止">⏹️</button>
                    </div>
                    <div className="ide-debug-content">
                      <div className="debug-section">
                        <div className="debug-section-title">变量</div>
                        <div className="debug-empty">暂无调试会话</div>
                      </div>
                      <div className="debug-section">
                        <div className="debug-section-title">调用堆栈</div>
                        <div className="debug-empty">暂无调用堆栈</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ide-statusbar">
        <div className="ide-statusbar-left">
          <span className="status-item">
            <span className="icon">🔀</span>
            main
          </span>
          <span className="status-item">
            <span className="icon">✓</span>
            无错误
          </span>
        </div>
        <div className="ide-statusbar-center">
          {activeTabData && (
            <span className="status-item">{activeTabData.path}</span>
          )}
        </div>
        <div className="ide-statusbar-right">
          {activeTabData && (
            <>
              <span className="status-item">{activeTabData.language}</span>
              <span className="status-item">UTF-8</span>
              <span className="status-item">LF</span>
            </>
          )}
          <span className="status-item clickable" onClick={() => setBottomPanelVisible(!bottomPanelVisible)}>
            <span className="icon">💻</span>
            终端
          </span>
        </div>
      </div>
    </div>
  )
}

export default IDELayout
