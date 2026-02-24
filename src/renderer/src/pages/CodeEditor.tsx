import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import './CodeEditor.css'

// 代码文件模型
interface CodeFile {
  id: string
  name: string
  language: string
  content: string
  path?: string
  createdAt: string
  updatedAt: string
}

// 支持的编程语言
const supportedLanguages = [
  { value: 'javascript', label: 'JavaScript', extension: '.js' },
  { value: 'typescript', label: 'TypeScript', extension: '.ts' },
  { value: 'python', label: 'Python', extension: '.py' },
  { value: 'java', label: 'Java', extension: '.java' },
  { value: 'csharp', label: 'C#', extension: '.cs' },
  { value: 'cpp', label: 'C++', extension: '.cpp' },
  { value: 'go', label: 'Go', extension: '.go' },
  { value: 'rust', label: 'Rust', extension: '.rs' },
  { value: 'html', label: 'HTML', extension: '.html' },
  { value: 'css', label: 'CSS', extension: '.css' },
  { value: 'json', label: 'JSON', extension: '.json' },
  { value: 'yaml', label: 'YAML', extension: '.yaml' },
  { value: 'markdown', label: 'Markdown', extension: '.md' },
  { value: 'sql', label: 'SQL', extension: '.sql' },
  { value: 'bash', label: 'Bash', extension: '.sh' }
]

const CodeEditor: React.FC = () => {
  const [files, setFiles] = useState<CodeFile[]>([])
  const [currentFile, setCurrentFile] = useState<CodeFile | null>(null)
  const [editingFile, setEditingFile] = useState<CodeFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [activeView, setActiveView] = useState<'list' | 'editor'>('list')
  const navigate = useNavigate()
  const { id: fileId } = useParams<{ id: string }>()
  const editorRef = useRef<HTMLTextAreaElement>(null)

  // 加载文件列表
  useEffect(() => {
    loadFiles()
  }, [])

  // 加载指定文件
  useEffect(() => {
    if (fileId) {
      loadFile(fileId)
    }
  }, [fileId])

  const loadFiles = async () => {
    try {
      setLoading(true)
      setError(null)
      // 模拟数据
      const mockFiles: CodeFile[] = [
        {
          id: '1',
          name: 'app.js',
          language: 'javascript',
          content: 'console.log("Hello, World!");\n\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet("Code Editor"));',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          name: 'index.ts',
          language: 'typescript',
          content: 'interface User {\n  id: number;\n  name: string;\n  email: string;\n}\n\nconst user: User = {\n  id: 1,\n  name: "John Doe",\n  email: "john@example.com"\n};\n\nconsole.log(user);',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '3',
          name: 'app.py',
          language: 'python',
          content: 'def fibonacci(n):\n    if n <= 1:\n        return n\n    else:\n        return fibonacci(n-1) + fibonacci(n-2)\n\nprint([fibonacci(i) for i in range(10)])',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
      setFiles(mockFiles)
      
      // 如果有文件ID，加载对应文件
      if (fileId) {
        const file = mockFiles.find(f => f.id === fileId)
        if (file) {
          setCurrentFile(file)
          setActiveView('editor')
        }
      }
    } catch (err) {
      setError('加载文件失败')
      console.error('加载文件失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadFile = async (id: string) => {
    try {
      const file = files.find(f => f.id === id)
      if (file) {
        setCurrentFile(file)
        setActiveView('editor')
      }
    } catch (err) {
      setError('加载文件失败')
      console.error('加载文件失败:', err)
    }
  }

  const handleCreateFile = () => {
    const newFile: CodeFile = {
      id: `file_${Date.now()}`,
      name: 'new-file.js',
      language: 'javascript',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    setEditingFile(newFile)
    setIsEditorOpen(true)
  }

  const handleEditFile = (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (file) {
      setEditingFile(file)
      setIsEditorOpen(true)
    }
  }

  const handleDeleteFile = (fileId: string) => {
    if (confirm('确定要删除这个文件吗？')) {
      setFiles(prev => prev.filter(f => f.id !== fileId))
    }
  }

  const handleSaveFile = () => {
    if (editingFile) {
      const updatedFile = {
        ...editingFile,
        updatedAt: new Date().toISOString()
      }
      
      setFiles(prev => {
        const existingIndex = prev.findIndex(f => f.id === updatedFile.id)
        if (existingIndex >= 0) {
          const newFiles = [...prev]
          newFiles[existingIndex] = updatedFile
          return newFiles
        } else {
          return [...prev, updatedFile]
        }
      })
      
      setIsEditorOpen(false)
      setEditingFile(null)
    }
  }

  const handleFileChange = (content: string) => {
    if (editingFile) {
      setEditingFile(prev => {
        if (!prev) return prev
        return {
          ...prev,
          content
        }
      })
    }
  }

  const handleFileNameChange = (name: string) => {
    if (editingFile) {
      setEditingFile(prev => {
        if (!prev) return prev
        return {
          ...prev,
          name
        }
      })
    }
  }

  const handleLanguageChange = (language: string) => {
    if (editingFile) {
      const selectedLanguage = supportedLanguages.find(lang => lang.value === language)
      const extension = selectedLanguage?.extension || '.txt'
      
      // 更新文件名扩展名
      const nameParts = editingFile.name.split('.')
      const baseName = nameParts.length > 1 ? nameParts.slice(0, -1).join('.') : editingFile.name
      const newName = `${baseName}${extension}`
      
      setEditingFile(prev => {
        if (!prev) return prev
        return {
          ...prev,
          language,
          name: newName
        }
      })
    }
  }

  const runCode = async () => {
    if (currentFile) {
      try {
        // 这里可以实现代码运行逻辑
        console.log('运行代码:', currentFile.content)
        alert('代码已执行（模拟）')
      } catch (error) {
        console.error('运行代码失败:', error)
        alert('运行代码失败')
      }
    }
  }

  const shareCodeSnippet = async () => {
    if (currentFile) {
      try {
        // 复制代码到剪贴板
        await navigator.clipboard.writeText(currentFile.content)
        
        // 生成分享链接（模拟）
        const shareUrl = `https://trae.dev/snippet/${currentFile.id}`
        
        // 显示分享选项
        const shareOptions = {
          title: currentFile.name,
          text: `查看代码片段: ${currentFile.name}`,
          url: shareUrl
        }
        
        // 尝试使用 Web Share API
        if (navigator.share) {
          await navigator.share(shareOptions)
        } else {
          // 回退方案：复制分享链接
          await navigator.clipboard.writeText(shareUrl)
          alert('代码片段链接已复制到剪贴板')
        }
      } catch (error) {
        console.error('分享代码片段失败:', error)
        alert('分享代码片段失败')
      }
    }
  }

  const copyCodeToClipboard = async () => {
    if (currentFile) {
      try {
        await navigator.clipboard.writeText(currentFile.content)
        alert('代码已复制到剪贴板')
      } catch (error) {
        console.error('复制代码失败:', error)
        alert('复制代码失败')
      }
    }
  }

  if (loading) {
    return (
      <div className="code-editor-container">
        <div className="loading">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="code-editor-container">
        <div className="error">{error}</div>
        <button onClick={loadFiles}>重试</button>
      </div>
    )
  }

  if (isEditorOpen && editingFile) {
    return (
      <div className="code-editor">
        <div className="editor-header">
          <div className="file-info">
            <input
              type="text"
              value={editingFile.name}
              onChange={(e) => handleFileNameChange(e.target.value)}
              className="file-name-input"
              placeholder="文件名"
            />
            <select
              value={editingFile.language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="language-select"
            >
              {supportedLanguages.map(lang => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <div className="editor-actions">
            <button onClick={() => setIsEditorOpen(false)} className="cancel-button">
              取消
            </button>
            <button onClick={handleSaveFile} className="save-button">
              保存
            </button>
          </div>
        </div>
        
        <div className="editor-content">
          <Editor
            height="80vh"
            defaultLanguage={editingFile.language}
            value={editingFile.content}
            onChange={(value) => handleFileChange(value || '')}
            options={{
              lineNumbers: 'on',
              minimap: { enabled: true },
              folding: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontSize: 14,
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              theme: 'vs-dark'
            }}
          />
        </div>
      </div>
    )
  }

  if (activeView === 'editor' && currentFile) {
    return (
      <div className="code-viewer">
        <div className="viewer-header">
          <div className="file-info">
            <h1>{currentFile.name}</h1>
            <span className="file-language">
              {supportedLanguages.find(lang => lang.value === currentFile.language)?.label}
            </span>
          </div>
          <div className="viewer-actions">
            <button onClick={runCode} className="run-button">
              运行
            </button>
            <button onClick={copyCodeToClipboard} className="copy-button">
              复制
            </button>
            <button onClick={shareCodeSnippet} className="share-button">
              分享
            </button>
            <button onClick={() => handleEditFile(currentFile.id)} className="edit-button">
              编辑
            </button>
            <button onClick={() => setActiveView('list')} className="back-button">
              返回列表
            </button>
          </div>
        </div>
        
        <div className="viewer-content">
          <Editor
            height="80vh"
            defaultLanguage={currentFile.language}
            value={currentFile.content}
            options={{
              lineNumbers: 'on',
              minimap: { enabled: true },
              folding: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontSize: 14,
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              theme: 'vs-dark',
              readOnly: true
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="code-editor-container">
      <div className="code-editor-header">
        <h1>代码编辑器</h1>
        <button className="create-button" onClick={handleCreateFile}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          新建文件
        </button>
      </div>

      <div className="code-files-list">
        {files.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            <p>暂无代码文件</p>
            <button onClick={handleCreateFile}>创建第一个文件</button>
          </div>
        ) : (
          files.map((file) => (
            <div key={file.id} className="code-file-card">
              <div className="code-file-header">
                <h3 onClick={() => navigate(`/code-editor/${file.id}`)} style={{ cursor: 'pointer' }}>
                  {file.name}
                </h3>
                <div className="file-language">
                  {supportedLanguages.find(lang => lang.value === file.language)?.label}
                </div>
              </div>
              <div className="code-file-meta">
                <span>更新于: {new Date(file.updatedAt).toLocaleString()}</span>
              </div>
              <div className="code-file-actions">
                <button onClick={() => navigate(`/code-editor/${file.id}`)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                  查看
                </button>
                <button onClick={() => handleEditFile(file.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  编辑
                </button>
                <button onClick={() => handleDeleteFile(file.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default CodeEditor
