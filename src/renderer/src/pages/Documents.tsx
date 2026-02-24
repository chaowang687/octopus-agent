import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cloudStorageService } from '../services/CloudStorageService'
import './Documents.css'

// 文档数据模型
interface Document {
  id: string
  title: string
  type: 'prd' | 'architecture' | 'test' | 'design' | 'general'
  createdAt: string
  updatedAt: string
  content: Block[]
  parentId?: string
  children?: string[]
}

// 块类型定义
type BlockType = 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'list' | 'task' | 'code' | 'quote' | 'divider' | 'image' | 'table'

// 块数据结构
interface Block {
  id: string
  type: BlockType
  content: string
  children?: Block[]
  checked?: boolean
  language?: string
  url?: string
}

// 文档模板
type DocumentTemplate = 'blank' | 'prd' | 'architecture' | 'test' | 'meeting-notes' | 'project-plan'

const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [activeView, setActiveView] = useState<'list' | 'editor'>('list')
  const [syncStatus, setSyncStatus] = useState<{ [key: string]: 'syncing' | 'synced' | 'error' }>({})
  const navigate = useNavigate()
  const { id: documentId } = useParams<{ id: string }>()
  const editorRef = useRef<HTMLDivElement>(null)

  // 加载文档列表
  useEffect(() => {
    loadDocuments()
  }, [])

  // 加载指定文档
  useEffect(() => {
    if (documentId) {
      loadDocument(documentId)
    }
  }, [documentId])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      // 模拟数据
      const mockDocuments: Document[] = [
        {
          id: '1',
          title: '产品需求文档',
          type: 'prd',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          content: [
            {
              id: '1-1',
              type: 'heading1',
              content: '产品需求文档'
            },
            {
              id: '1-2',
              type: 'paragraph',
              content: '这是一个产品需求文档，描述了产品的功能和特性。'
            },
            {
              id: '1-3',
              type: 'heading2',
              content: '功能需求'
            },
            {
              id: '1-4',
              type: 'list',
              content: '- 用户注册和登录\n- 文档管理\n- 工作流设计'
            }
          ]
        },
        {
          id: '2',
          title: '技术架构文档',
          type: 'architecture',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          content: [
            {
              id: '2-1',
              type: 'heading1',
              content: '技术架构文档'
            },
            {
              id: '2-2',
              type: 'paragraph',
              content: '这是一个技术架构文档，描述了系统的技术栈和架构设计。'
            }
          ]
        },
        {
          id: '3',
          title: '测试计划',
          type: 'test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          content: [
            {
              id: '3-1',
              type: 'heading1',
              content: '测试计划'
            },
            {
              id: '3-2',
              type: 'paragraph',
              content: '这是一个测试计划文档，描述了测试的范围和方法。'
            }
          ]
        }
      ]
      setDocuments(mockDocuments)
      
      // 如果有文档ID，加载对应文档
      if (documentId) {
        const doc = mockDocuments.find(d => d.id === documentId)
        if (doc) {
          setCurrentDocument(doc)
          setActiveView('editor')
        }
      }
    } catch (err) {
      setError('加载文档失败')
      console.error('加载文档失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadDocument = async (id: string) => {
    try {
      const doc = documents.find(d => d.id === id)
      if (doc) {
        setCurrentDocument(doc)
        setActiveView('editor')
      }
    } catch (err) {
      setError('加载文档失败')
      console.error('加载文档失败:', err)
    }
  }

  const handleCreateDocument = (template: DocumentTemplate = 'blank') => {
    const newDocument: Document = {
      id: `doc_${Date.now()}`,
      title: getTemplateTitle(template),
      type: getTemplateType(template),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content: getTemplateContent(template)
    }
    
    setEditingDocument(newDocument)
    setIsEditorOpen(true)
  }

  const getTemplateTitle = (template: DocumentTemplate): string => {
    const titles: Record<DocumentTemplate, string> = {
      blank: '新文档',
      prd: '产品需求文档',
      architecture: '技术架构文档',
      test: '测试计划',
      'meeting-notes': '会议纪要',
      'project-plan': '项目计划'
    }
    return titles[template]
  }

  const getTemplateType = (template: DocumentTemplate): Document['type'] => {
    const types: Record<DocumentTemplate, Document['type']> = {
      blank: 'general',
      prd: 'prd',
      architecture: 'architecture',
      test: 'test',
      'meeting-notes': 'general',
      'project-plan': 'general'
    }
    return types[template]
  }

  const getTemplateContent = (template: DocumentTemplate): Block[] => {
    switch (template) {
      case 'prd':
        return [
          { id: `block_${Date.now()}_1`, type: 'heading1', content: '产品需求文档' },
          { id: `block_${Date.now()}_2`, type: 'paragraph', content: '## 1. 产品概述\n描述产品的核心价值和目标用户。' },
          { id: `block_${Date.now()}_3`, type: 'paragraph', content: '## 2. 功能需求\n详细描述产品的功能模块和特性。' },
          { id: `block_${Date.now()}_4`, type: 'paragraph', content: '## 3. 非功能需求\n描述性能、安全、可靠性等非功能需求。' },
          { id: `block_${Date.now()}_5`, type: 'paragraph', content: '## 4. 界面设计\n描述产品的界面风格和交互设计。' }
        ]
      case 'architecture':
        return [
          { id: `block_${Date.now()}_1`, type: 'heading1', content: '技术架构文档' },
          { id: `block_${Date.now()}_2`, type: 'paragraph', content: '## 1. 技术栈\n描述系统使用的技术栈和依赖。' },
          { id: `block_${Date.now()}_3`, type: 'paragraph', content: '## 2. 系统架构\n描述系统的整体架构设计。' },
          { id: `block_${Date.now()}_4`, type: 'paragraph', content: '## 3. 模块设计\n描述各个模块的详细设计。' },
          { id: `block_${Date.now()}_5`, type: 'paragraph', content: '## 4. 数据库设计\n描述数据库的结构设计。' }
        ]
      case 'test':
        return [
          { id: `block_${Date.now()}_1`, type: 'heading1', content: '测试计划' },
          { id: `block_${Date.now()}_2`, type: 'paragraph', content: '## 1. 测试范围\n描述测试的覆盖范围。' },
          { id: `block_${Date.now()}_3`, type: 'paragraph', content: '## 2. 测试方法\n描述测试的方法和工具。' },
          { id: `block_${Date.now()}_4`, type: 'paragraph', content: '## 3. 测试用例\n描述具体的测试用例。' },
          { id: `block_${Date.now()}_5`, type: 'paragraph', content: '## 4. 测试环境\n描述测试的环境配置。' }
        ]
      case 'meeting-notes':
        return [
          { id: `block_${Date.now()}_1`, type: 'heading1', content: '会议纪要' },
          { id: `block_${Date.now()}_2`, type: 'paragraph', content: `### 会议信息\n- 时间：${new Date().toLocaleString()}\n- 地点：线上会议\n- 参会人员：` },
          { id: `block_${Date.now()}_3`, type: 'paragraph', content: '### 会议议程\n1. 议程项1\n2. 议程项2\n3. 议程项3' },
          { id: `block_${Date.now()}_4`, type: 'paragraph', content: '### 会议纪要\n' },
          { id: `block_${Date.now()}_5`, type: 'paragraph', content: '### 行动项\n- [ ] 行动项1\n- [ ] 行动项2' }
        ]
      case 'project-plan':
        return [
          { id: `block_${Date.now()}_1`, type: 'heading1', content: '项目计划' },
          { id: `block_${Date.now()}_2`, type: 'paragraph', content: '## 1. 项目概述\n描述项目的目标和范围。' },
          { id: `block_${Date.now()}_3`, type: 'paragraph', content: '## 2. 项目团队\n描述项目的团队成员和职责。' },
          { id: `block_${Date.now()}_4`, type: 'paragraph', content: '## 3. 项目 timeline\n描述项目的时间安排。' },
          { id: `block_${Date.now()}_5`, type: 'paragraph', content: '## 4. 项目风险\n描述项目可能面临的风险。' }
        ]
      default:
        return [
          { id: `block_${Date.now()}_1`, type: 'paragraph', content: '开始编辑文档...' }
        ]
    }
  }

  const handleEditDocument = (documentId: string) => {
    const doc = documents.find(d => d.id === documentId)
    if (doc) {
      setEditingDocument(doc)
      setIsEditorOpen(true)
    }
  }

  const handleDeleteDocument = (documentId: string) => {
    if (confirm('确定要删除这个文档吗？')) {
      setDocuments(prev => prev.filter(d => d.id !== documentId))
    }
  }

  const handleSaveDocument = async () => {
    if (editingDocument) {
      const updatedDocument = {
        ...editingDocument,
        updatedAt: new Date().toISOString()
      }
      
      setDocuments(prev => {
        const existingIndex = prev.findIndex(d => d.id === updatedDocument.id)
        if (existingIndex >= 0) {
          const newDocs = [...prev]
          newDocs[existingIndex] = updatedDocument
          return newDocs
        } else {
          return [...prev, updatedDocument]
        }
      })
      
      // 同步到云存储
      if (cloudStorageService.isInitialized()) {
        setSyncStatus(prev => ({ ...prev, [updatedDocument.id]: 'syncing' }))
        try {
          const result = await cloudStorageService.uploadDocument(updatedDocument.id, updatedDocument)
          if (result.success) {
            setSyncStatus(prev => ({ ...prev, [updatedDocument.id]: 'synced' }))
            // 3秒后清除同步状态
            setTimeout(() => {
              setSyncStatus(prev => {
                const newStatus = { ...prev }
                delete newStatus[updatedDocument.id]
                return newStatus
              })
            }, 3000)
          } else {
            setSyncStatus(prev => ({ ...prev, [updatedDocument.id]: 'error' }))
            console.error('文档同步失败:', result.error)
          }
        } catch (error) {
          setSyncStatus(prev => ({ ...prev, [updatedDocument.id]: 'error' }))
          console.error('文档同步失败:', error)
        }
      }
      
      setIsEditorOpen(false)
      setEditingDocument(null)
    }
  }

  const handleBlockChange = (blockId: string, content: string) => {
    if (editingDocument) {
      const updateBlock = (blocks: Block[]): Block[] => {
        return blocks.map(block => {
          if (block.id === blockId) {
            return { ...block, content }
          }
          if (block.children) {
            return { ...block, children: updateBlock(block.children) }
          }
          return block
        })
      }
      
      setEditingDocument(prev => {
        if (!prev) return prev
        return {
          ...prev,
          content: updateBlock(prev.content)
        }
      })
    }
  }

  const addBlock = (beforeId?: string, type: BlockType = 'paragraph') => {
    if (editingDocument) {
      const newBlock: Block = {
        id: `block_${Date.now()}`,
        type,
        content: type === 'heading1' ? '标题' : type === 'code' ? '```\n代码\n```' : ''
      }
      
      const addBlockToContent = (blocks: Block[]): Block[] => {
        if (!beforeId) {
          return [...blocks, newBlock]
        }
        
        const result: Block[] = []
        for (const block of blocks) {
          result.push(block)
          if (block.id === beforeId) {
            result.push(newBlock)
          }
          if (block.children) {
            block.children = addBlockToContent(block.children)
          }
        }
        return result
      }
      
      setEditingDocument(prev => {
        if (!prev) return prev
        return {
          ...prev,
          content: addBlockToContent(prev.content)
        }
      })
    }
  }

  const deleteBlock = (blockId: string) => {
    if (editingDocument) {
      const removeBlock = (blocks: Block[]): Block[] => {
        return blocks.filter(block => {
          if (block.id === blockId) {
            return false
          }
          if (block.children) {
            block.children = removeBlock(block.children)
          }
          return true
        })
      }
      
      setEditingDocument(prev => {
        if (!prev) return prev
        return {
          ...prev,
          content: removeBlock(prev.content)
        }
      })
    }
  }

  const renderBlock = (block: Block, index: number) => {
    switch (block.type) {
      case 'heading1':
        return (
          <div key={block.id} className="block heading1-block">
            <input
              type="text"
              value={block.content}
              onChange={(e) => handleBlockChange(block.id, e.target.value)}
              className="heading1-input"
              placeholder="标题 1"
            />
            <div className="block-actions">
              <button onClick={() => addBlock(block.id, 'paragraph')} title="添加段落">
                +
              </button>
              <button onClick={() => deleteBlock(block.id)} title="删除">
                ×
              </button>
            </div>
          </div>
        )
      case 'heading2':
        return (
          <div key={block.id} className="block heading2-block">
            <input
              type="text"
              value={block.content}
              onChange={(e) => handleBlockChange(block.id, e.target.value)}
              className="heading2-input"
              placeholder="标题 2"
            />
            <div className="block-actions">
              <button onClick={() => addBlock(block.id, 'paragraph')} title="添加段落">
                +
              </button>
              <button onClick={() => deleteBlock(block.id)} title="删除">
                ×
              </button>
            </div>
          </div>
        )
      case 'heading3':
        return (
          <div key={block.id} className="block heading3-block">
            <input
              type="text"
              value={block.content}
              onChange={(e) => handleBlockChange(block.id, e.target.value)}
              className="heading3-input"
              placeholder="标题 3"
            />
            <div className="block-actions">
              <button onClick={() => addBlock(block.id, 'paragraph')} title="添加段落">
                +
              </button>
              <button onClick={() => deleteBlock(block.id)} title="删除">
                ×
              </button>
            </div>
          </div>
        )
      case 'paragraph':
        return (
          <div key={block.id} className="block paragraph-block">
            <textarea
              value={block.content}
              onChange={(e) => handleBlockChange(block.id, e.target.value)}
              className="paragraph-input"
              placeholder="输入内容..."
              rows={Math.max(1, Math.ceil(block.content.split('\n').length / 2))}
            />
            <div className="block-actions">
              <button onClick={() => addBlock(block.id, 'paragraph')} title="添加段落">
                +
              </button>
              <button onClick={() => deleteBlock(block.id)} title="删除">
                ×
              </button>
            </div>
          </div>
        )
      case 'code':
        return (
          <div key={block.id} className="block code-block">
            <textarea
              value={block.content}
              onChange={(e) => handleBlockChange(block.id, e.target.value)}
              className="code-input"
              placeholder="输入代码..."
              rows={5}
            />
            <div className="block-actions">
              <button onClick={() => addBlock(block.id, 'paragraph')} title="添加段落">
                +
              </button>
              <button onClick={() => deleteBlock(block.id)} title="删除">
                ×
              </button>
            </div>
          </div>
        )
      case 'quote':
        return (
          <div key={block.id} className="block quote-block">
            <textarea
              value={block.content}
              onChange={(e) => handleBlockChange(block.id, e.target.value)}
              className="quote-input"
              placeholder="输入引用..."
              rows={3}
            />
            <div className="block-actions">
              <button onClick={() => addBlock(block.id, 'paragraph')} title="添加段落">
                +
              </button>
              <button onClick={() => deleteBlock(block.id)} title="删除">
                ×
              </button>
            </div>
          </div>
        )
      case 'list':
        return (
          <div key={block.id} className="block list-block">
            <textarea
              value={block.content}
              onChange={(e) => handleBlockChange(block.id, e.target.value)}
              className="list-input"
              placeholder="输入列表项，每行一个..."
              rows={3}
            />
            <div className="block-actions">
              <button onClick={() => addBlock(block.id, 'paragraph')} title="添加段落">
                +
              </button>
              <button onClick={() => deleteBlock(block.id)} title="删除">
                ×
              </button>
            </div>
          </div>
        )
      case 'task':
        return (
          <div key={block.id} className="block task-block">
            <div className="task-content">
              <input
                type="checkbox"
                checked={block.checked || false}
                onChange={(e) => {
                  if (editingDocument) {
                    const updateBlock = (blocks: Block[]): Block[] => {
                      return blocks.map(b => {
                        if (b.id === block.id) {
                          return { ...b, checked: e.target.checked }
                        }
                        if (b.children) {
                          return { ...b, children: updateBlock(b.children) }
                        }
                        return b
                      })
                    }
                    setEditingDocument(prev => {
                      if (!prev) return prev
                      return {
                        ...prev,
                        content: updateBlock(prev.content)
                      }
                    })
                  }
                }}
              />
              <input
                type="text"
                value={block.content}
                onChange={(e) => handleBlockChange(block.id, e.target.value)}
                className="task-input"
                placeholder="输入任务..."
              />
            </div>
            <div className="block-actions">
              <button onClick={() => addBlock(block.id, 'task')} title="添加任务">
                +
              </button>
              <button onClick={() => deleteBlock(block.id)} title="删除">
                ×
              </button>
            </div>
          </div>
        )
      case 'divider':
        return (
          <div key={block.id} className="block divider-block">
            <hr />
            <div className="block-actions">
              <button onClick={() => addBlock(block.id, 'paragraph')} title="添加段落">
                +
              </button>
              <button onClick={() => deleteBlock(block.id)} title="删除">
                ×
              </button>
            </div>
          </div>
        )
      default:
        return (
          <div key={block.id} className="block">
            <input
              type="text"
              value={block.content}
              onChange={(e) => handleBlockChange(block.id, e.target.value)}
            />
            <button onClick={() => deleteBlock(block.id)}>删除</button>
          </div>
        )
    }
  }

  const renderMarkdown = (content: string) => {
    const components = {
      code({ node, inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '')
        const language = match ? match[1] : ''
        
        if (!inline && match) {
          return (
            <div className="code-block-wrapper">
              <div className="code-block-header">
                <span className="code-language">{language}</span>
                <button 
                  className="copy-button"
                  onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}
                >
                  复制
                </button>
              </div>
              <SyntaxHighlighter
                style={oneDark}
                language={language}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: '0 0 6px 6px',
                  fontSize: '13px'
                }}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          )
        }
        
        return (
          <code className={`inline-code ${className}`} {...props}>
            {children}
          </code>
        )
      },
      
      a({ node, href, children, ...props }: any) {
        const isFilePath = href?.startsWith('/') || href?.includes(':')
        
        if (isFilePath) {
          return (
            <button 
              className="file-link-button"
              onClick={() => href && window.electron?.system?.openPath?.(href)}
            >
              📄 {children}
            </button>
          )
        }
        
        return (
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="message-link"
            {...props}
          >
            {children}
          </a>
        )
      },

      input({ node, type, checked, ...props }: any) {
        if (type === 'checkbox') {
          return (
            <input 
              type="checkbox" 
              checked={checked} 
              readOnly 
              className="task-checkbox"
              {...props} 
            />
          )
        }
        return <input type={type} {...props} />
      },

      li({ node, children, ...props }: any) {
        const hasCheckbox = String(children).includes('[ ]') || String(children).includes('[x]') || String(children).includes('[X]')
        
        if (hasCheckbox) {
          return (
            <li className="task-list-item" {...props}>
              {children}
            </li>
          )
        }
        
        return <li {...props}>{children}</li>
      },

      h1({ node, children, ...props }: any) {
        return <h1 className="message-h1" {...props}>{children}</h1>
      },
      
      h2({ node, children, ...props }: any) {
        return <h2 className="message-h2" {...props}>{children}</h2>
      },
      
      h3({ node, children, ...props }: any) {
        return <h3 className="message-h3" {...props}>{children}</h3>
      },

      table({ node, children, ...props }: any) {
        return (
          <div className="table-wrapper">
            <table className="message-table" {...props}>
              {children}
            </table>
          </div>
        )
      },

      blockquote({ node, children, ...props }: any) {
        return <blockquote className="message-blockquote" {...props}>{children}</blockquote>
      },

      hr({ node, ...props }: any) {
        return <hr className="message-hr" {...props} />
      }
    }

    return (
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    )
  }

  const renderDocumentContent = (blocks: Block[]) => {
    return blocks.map((block, index) => (
      <div key={block.id} className="block-container">
        {renderBlock(block, index)}
        {block.children && renderDocumentContent(block.children)}
      </div>
    ))
  }

  if (loading) {
    return (
      <div className="documents-container">
        <div className="loading">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="documents-container">
        <div className="error">{error}</div>
        <button onClick={loadDocuments}>重试</button>
      </div>
    )
  }

  if (isEditorOpen && editingDocument) {
    return (
      <div className="document-editor">
        <div className="editor-header">
          <input
            type="text"
            value={editingDocument.title}
            onChange={(e) => setEditingDocument(prev => prev ? { ...prev, title: e.target.value } : null)}
            className="document-title-input"
            placeholder="文档标题"
          />
          <div className="editor-actions">
            <button onClick={() => setIsEditorOpen(false)} className="cancel-button">
              取消
            </button>
            <button onClick={handleSaveDocument} className="save-button">
              保存
            </button>
          </div>
        </div>
        
        <div className="editor-content" ref={editorRef}>
          {renderDocumentContent(editingDocument.content)}
          <div className="add-block-button" onClick={() => addBlock()}>
            + 添加内容
          </div>
        </div>
        
        <div className="editor-toolbar">
          <button onClick={() => addBlock(undefined, 'heading1')} title="标题 1">
            H1
          </button>
          <button onClick={() => addBlock(undefined, 'heading2')} title="标题 2">
            H2
          </button>
          <button onClick={() => addBlock(undefined, 'heading3')} title="标题 3">
            H3
          </button>
          <button onClick={() => addBlock(undefined, 'code')} title="代码">
            代码
          </button>
          <button onClick={() => addBlock(undefined, 'quote')} title="引用">
            引用
          </button>
          <button onClick={() => addBlock(undefined, 'list')} title="列表">
            列表
          </button>
          <button onClick={() => addBlock(undefined, 'task')} title="任务">
            任务
          </button>
          <button onClick={() => addBlock(undefined, 'divider')} title="分隔线">
            分隔线
          </button>
        </div>
      </div>
    )
  }

  if (activeView === 'editor' && currentDocument) {
    return (
      <div className="document-viewer">
        <div className="viewer-header">
          <h1>{currentDocument.title}</h1>
          <div className="viewer-actions">
            <button onClick={() => handleEditDocument(currentDocument.id)} className="edit-button">
              编辑
            </button>
            <button onClick={() => setActiveView('list')} className="back-button">
              返回列表
            </button>
          </div>
        </div>
        
        <div className="viewer-content">
          {currentDocument.content.map((block) => (
            <div key={block.id} className="view-block">
              {block.type === 'heading1' && <h1>{block.content}</h1>}
              {block.type === 'heading2' && <h2>{block.content}</h2>}
              {block.type === 'heading3' && <h3>{block.content}</h3>}
              {block.type === 'paragraph' && renderMarkdown(block.content)}
              {block.type === 'code' && renderMarkdown(block.content)}
              {block.type === 'quote' && <blockquote>{block.content}</blockquote>}
              {block.type === 'list' && renderMarkdown(block.content)}
              {block.type === 'task' && (
                <div className="task-item">
                  <input type="checkbox" checked={block.checked || false} readOnly />
                  <span>{block.content}</span>
                </div>
              )}
              {block.type === 'divider' && <hr />}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="documents-container">
      <div className="documents-header">
        <h1>文档管理</h1>
        <div className="header-actions">
          <button className="create-button" onClick={() => handleCreateDocument()}>            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            新建文档
          </button>
          <div className="template-dropdown">
            <button className="template-button">
              模板
            </button>
            <div className="template-menu">
              <button onClick={() => handleCreateDocument('blank')}>空白文档</button>
              <button onClick={() => handleCreateDocument('prd')}>产品需求文档</button>
              <button onClick={() => handleCreateDocument('architecture')}>技术架构文档</button>
              <button onClick={() => handleCreateDocument('test')}>测试计划</button>
              <button onClick={() => handleCreateDocument('meeting-notes')}>会议纪要</button>
              <button onClick={() => handleCreateDocument('project-plan')}>项目计划</button>
            </div>
          </div>
        </div>
      </div>

      <div className="documents-list">
        {documents.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <p>暂无文档</p>
            <button onClick={() => handleCreateDocument()}>创建第一个文档</button>
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="document-card">
              <div className="document-card-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 onClick={() => navigate(`/documents/${doc.id}`)} style={{ cursor: 'pointer', margin: 0 }}>
                    {doc.title}
                  </h3>
                  {syncStatus[doc.id] && (
                    <div className={`sync-status ${syncStatus[doc.id]}`}>
                      {syncStatus[doc.id] === 'syncing' && '同步中...'}
                      {syncStatus[doc.id] === 'synced' && '已同步'}
                      {syncStatus[doc.id] === 'error' && '同步失败'}
                    </div>
                  )}
                </div>
                <div className="document-type">
                  {doc.type === 'prd' && '产品需求'}
                  {doc.type === 'architecture' && '技术架构'}
                  {doc.type === 'test' && '测试计划'}
                  {doc.type === 'design' && '设计文档'}
                  {doc.type === 'general' && '通用'}
                </div>
              </div>
              <div className="document-card-meta">
                <span>更新于: {new Date(doc.updatedAt).toLocaleString()}</span>
              </div>
              <div className="document-card-actions">
                <button onClick={() => navigate(`/documents/${doc.id}`)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                  查看
                </button>
                <button onClick={() => handleEditDocument(doc.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  编辑
                </button>
                <button onClick={() => handleDeleteDocument(doc.id)}>
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

export default Documents
