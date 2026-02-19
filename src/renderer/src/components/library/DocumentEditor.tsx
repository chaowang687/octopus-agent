import React, { useState, useEffect } from 'react'

interface DocumentEditorProps {
  documentId?: string
  initialContent?: string
  onSave: (content: string, metadata?: any) => Promise<void>
  onCancel?: () => void
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  documentId,
  initialContent = '',
  onSave,
  onCancel
}) => {
  const [content, setContent] = useState(initialContent)
  const [title, setTitle] = useState('新文档')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setContent(initialContent)
  }, [initialContent])

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(content, {
        title,
        tags,
        updatedAt: Date.now()
      })
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const renderMarkdown = (markdown: string) => {
    const lines = markdown.split('\n')
    return lines.map((line, index) => {
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl font-bold my-4">{line.slice(2)}</h1>
      } else if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-semibold my-3">{line.slice(3)}</h2>
      } else if (line.startsWith('### ')) {
        return <h3 key={index} className="text-lg font-medium my-2">{line.slice(4)}</h3>
      } else if (line.startsWith('- ')) {
        return <li key={index} className="ml-4">{line.slice(2)}</li>
      } else if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={index} className="font-bold my-2">{line.slice(2, -2)}</p>
      } else if (line.trim() === '') {
        return <br key={index} />
      } else {
        return <p key={index} className="my-2">{line}</p>
      }
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-lg h-full flex flex-col">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold text-gray-900 border-none focus:outline-none flex-1"
            placeholder="文档标题"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setPreview(!preview)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                preview
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {preview ? '编辑' : '预览'}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-lg transition-colors ${
                saving
                  ? 'bg-blue-300 text-blue-700 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">标签:</span>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="添加标签"
            />
            <button
              onClick={handleAddTag}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition-colors"
            >
              添加
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {!preview ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 px-6 py-4 resize-none focus:outline-none font-mono text-sm"
            placeholder="开始编写文档... (支持 Markdown 格式)"
            spellCheck={false}
          />
        ) : (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="prose max-w-none">
              {renderMarkdown(content)}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div>
            {documentId && <span>ID: {documentId}</span>}
            <span className="ml-4">
              字数: {content.length}
            </span>
          </div>
          <div>
            <span className="mr-4">支持 Markdown 格式</span>
            <span># 标题</span>
            <span className="mx-2">|</span>
            <span>**粗体**</span>
            <span className="mx-2">|</span>
            <span>- 列表</span>
          </div>
        </div>
      </div>
    </div>
  )
}
