import React, { useState, useEffect } from 'react'
import { PlanViewer } from '../components/library/PlanViewer'
import { DocumentEditor } from '../components/library/DocumentEditor'
import { CollaborationWorkspace } from '../components/library/CollaborationWorkspace'

interface Document {
  id: string
  type: 'requirement' | 'plan' | 'decision' | 'skill' | 'context' | 'log'
  title: string
  content: string
  metadata: {
    status: 'draft' | 'active' | 'completed' | 'archived'
    projectId?: string
    tags: string[]
    createdAt: number
    updatedAt: number
    version: number
  }
  relations: {
    dependencies: string[]
    related: string[]
    decisions: string[]
  }
}

type View = 'library' | 'editor' | 'plan' | 'collaboration'

const LibraryPage: React.FC = () => {
  const [view, setView] = useState<View>('library')
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [collaborationSessionId, setCollaborationSessionId] = useState<string | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const response = await window.electron.library.searchDocuments({})
      if (response.success) {
        setDocuments(response.data || [])
      }
    } catch (error) {
      console.error('加载文档失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDocument = (type: Document['type']) => {
    const newDoc: Document = {
      id: '',
      type,
      title: '新文档',
      content: '',
      metadata: {
        status: 'draft',
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      },
      relations: {
        dependencies: [],
        related: [],
        decisions: []
      }
    }
    setSelectedDocument(newDoc)
    setView('editor')
  }

  const handleEditDocument = (doc: Document) => {
    setSelectedDocument(doc)
    setView('editor')
  }

  const handleViewPlan = (doc: Document) => {
    setSelectedDocument(doc)
    setView('plan')
  }

  const handleStartCollaboration = async () => {
    try {
      const response = await window.electron.library.startCollaboration({
        requirement: '新需求',
        userId: 'user'
      })
      if (response.success) {
        setCollaborationSessionId(response.data)
        setView('collaboration')
      }
    } catch (error) {
      console.error('启动协作失败:', error)
      alert('启动协作失败')
    }
  }

  const handleSaveDocument = async (content: string, metadata?: any) => {
    try {
      if (selectedDocument?.id) {
        await window.electron.library.updateDocument(selectedDocument.id, {
          content,
          metadata
        })
      } else {
        await window.electron.library.createDocument({
          type: selectedDocument?.type || 'requirement',
          title: metadata?.title || '新文档',
          content,
          metadata: {
            ...selectedDocument?.metadata,
            ...metadata
          },
          relations: selectedDocument?.relations || {
            dependencies: [],
            related: [],
            decisions: []
          }
        })
      }
      await loadDocuments()
      setView('library')
      setSelectedDocument(null)
    } catch (error) {
      console.error('保存文档失败:', error)
      throw error
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('确定要删除这个文档吗？')) return

    try {
      await window.electron.library.deleteDocument(docId)
      await loadDocuments()
    } catch (error) {
      console.error('删除文档失败:', error)
      alert('删除失败')
    }
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesType = filterType === 'all' || doc.type === filterType
    const matchesStatus = filterStatus === 'all' || doc.metadata.status === filterStatus
    const matchesSearch = searchQuery === '' || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesType && matchesStatus && matchesSearch
  })

  const getDocumentTypeLabel = (type: Document['type']) => {
    const labels = {
      requirement: '需求',
      plan: '计划',
      decision: '决策',
      skill: '技能',
      context: '上下文',
      log: '日志'
    }
    return labels[type] || type
  }

  const getDocumentTypeColor = (type: Document['type']) => {
    const colors = {
      requirement: 'bg-blue-100 text-blue-700',
      plan: 'bg-green-100 text-green-700',
      decision: 'bg-yellow-100 text-yellow-700',
      skill: 'bg-purple-100 text-purple-700',
      context: 'bg-gray-100 text-gray-700',
      log: 'bg-orange-100 text-orange-700'
    }
    return colors[type] || 'bg-gray-100 text-gray-700'
  }

  const getStatusColor = (status: Document['metadata']['status']) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      active: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      archived: 'bg-gray-200 text-gray-600'
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  if (view === 'editor' && selectedDocument) {
    return (
      <div className="h-screen flex flex-col">
        <header className="bg-white shadow-sm px-6 py-4">
          <button
            onClick={() => setView('library')}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <span>←</span>
            <span>返回文库</span>
          </button>
        </header>
        <main className="flex-1 overflow-hidden">
          <DocumentEditor
            documentId={selectedDocument.id}
            initialContent={selectedDocument.content}
            onSave={handleSaveDocument}
            onCancel={() => setView('library')}
          />
        </main>
      </div>
    )
  }

  if (view === 'plan' && selectedDocument) {
    return (
      <div className="h-screen flex flex-col">
        <header className="bg-white shadow-sm px-6 py-4">
          <button
            onClick={() => setView('library')}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <span>←</span>
            <span>返回文库</span>
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <div className="max-w-6xl mx-auto">
            <PlanViewer
              planId={selectedDocument.id}
              onStepClick={(step: any) => console.log('Step clicked:', step)}
              onEdit={() => handleEditDocument(selectedDocument)}
              onExecute={() => console.log('Execute plan')}
            />
          </div>
        </main>
      </div>
    )
  }

  if (view === 'collaboration' && collaborationSessionId) {
    return (
      <CollaborationWorkspace
        sessionId={collaborationSessionId}
        onClose={() => setView('library')}
      />
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">📚 文库系统</h1>
            <button
              onClick={handleStartCollaboration}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              开始协作
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => loadDocuments()}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              刷新
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">文档类型</h2>
          <div className="space-y-1">
            <button
              onClick={() => setFilterType('all')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                filterType === 'all' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterType('requirement')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                filterType === 'requirement' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              需求
            </button>
            <button
              onClick={() => setFilterType('plan')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                filterType === 'plan' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              计划
            </button>
            <button
              onClick={() => setFilterType('decision')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                filterType === 'decision' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              决策
            </button>
            <button
              onClick={() => setFilterType('skill')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                filterType === 'skill' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              技能
            </button>
            <button
              onClick={() => setFilterType('context')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                filterType === 'context' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              上下文
            </button>
            <button
              onClick={() => setFilterType('log')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                filterType === 'log' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              日志
            </button>
          </div>

          <h2 className="text-sm font-semibold text-gray-900 mb-3 mt-6">状态</h2>
          <div className="space-y-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                filterStatus === 'all' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterStatus('draft')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                filterStatus === 'draft' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              草稿
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                filterStatus === 'active' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              进行中
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                filterStatus === 'completed' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              已完成
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 bg-white border-b border-gray-200">
            <div className="flex gap-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索文档..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <span className="text-4xl mb-4">📭</span>
                <p>没有找到文档</p>
                <button
                  onClick={() => handleCreateDocument('requirement')}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  创建第一个文档
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocuments.map((doc: Document) => (
                  <div
                    key={doc.id}
                    className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDocumentTypeColor(doc.type)}`}>
                          {getDocumentTypeLabel(doc.type)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.metadata.status)}`}>
                          {doc.metadata.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {doc.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {doc.content.slice(0, 100)}...
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {doc.metadata.tags.slice(0, 2).map((tag: string, index: number) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                          {doc.metadata.tags.length > 2 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                              +{doc.metadata.tags.length - 2}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(doc.metadata.updatedAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-gray-200 px-4 py-2 flex justify-end gap-2">
                      {doc.type === 'plan' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewPlan(doc)
                          }}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors"
                        >
                          查看
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditDocument(doc)
                        }}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteDocument(doc.id)
                        }}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default LibraryPage
