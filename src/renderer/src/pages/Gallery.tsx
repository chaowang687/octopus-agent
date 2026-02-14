import React, { useEffect, useMemo, useState } from 'react'

interface GalleryItem {
  id: string
  filePath: string
  filename: string
  mime?: string
  size: number
  createdAt: number
  sourceUrl?: string
  tags?: string[]
}

const Gallery: React.FC = () => {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [allTags, setAllTags] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string>('所有')
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [addingTagId, setAddingTagId] = useState<string | null>(null)
  const [newTagValue, setNewTagValue] = useState('')
  
  // Renaming state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await window.electron.gallery.list()
      if (res?.success && Array.isArray(res.items)) {
        setItems(res.items)
        // Extract unique tags
        const tags = new Set<string>()
        res.items.forEach((item: GalleryItem) => {
          item.tags?.forEach(t => tags.add(t))
        })
        setAllTags(Array.from(tags).sort())
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = useMemo(() => {
    let result = items
    
    // Filter by Tab
    if (activeTab !== '所有') {
      result = result.filter(i => i.tags?.includes(activeTab))
    }

    // Filter by Query
    const q = query.trim().toLowerCase()
    if (q) {
      result = result.filter(i =>
        i.filename.toLowerCase().includes(q) ||
        (i.sourceUrl || '').toLowerCase().includes(q) ||
        (i.tags || []).some(t => t.toLowerCase().includes(q))
      )
    }
    
    return result
  }, [items, query, activeTab])

  useEffect(() => {
    const load = async () => {
      const next: Record<string, string> = {}
      const targets = filtered.slice(0, 60)
      for (const item of targets) {
        if (previews[item.id]) continue
        const res = await window.electron.gallery.getDataUrl(item.filePath)
        if (res?.success && res.dataUrl) {
          next[item.id] = res.dataUrl
        }
      }
      if (Object.keys(next).length > 0) {
        setPreviews(prev => ({ ...prev, ...next }))
      }
    }
    load()
  }, [filtered])

  const handleImport = async () => {
    const result = await window.electron.dialog.openFile()
    if (result?.canceled) return
    const paths: string[] = result?.filePaths || []
    if (paths.length === 0) return
    await window.electron.gallery.import(paths)
    await refresh()
  }

  const handleReveal = async (filePath: string) => {
    await window.electron.gallery.reveal(filePath)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这张图片吗？')) return
    await window.electron.gallery.delete(id)
    setItems(prev => prev.filter(i => i.id !== id))
    // Also remove from previews to clean up memory
    setPreviews(prev => {
      const { [id]: _removed, ...rest } = prev
      return rest
    })
  }

  const handleAddTag = async (id: string, tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed) return
    
    // Optimistic update
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newTags = Array.from(new Set([...(item.tags || []), trimmed]))
        return { ...item, tags: newTags }
      }
      return item
    }))
    
    if (!allTags.includes(trimmed)) {
      setAllTags(prev => [...prev, trimmed].sort())
    }

    await window.electron.gallery.addTag(id, trimmed)
    setNewTagValue('')
    setAddingTagId(null)
  }

  const handleRemoveTag = async (id: string, tag: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, tags: (item.tags || []).filter(t => t !== tag) }
      }
      return item
    }))
    await window.electron.gallery.removeTag(id, tag)
  }

  const handleKeyDownTag = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleAddTag(id, newTagValue)
    } else if (e.key === 'Escape') {
      setAddingTagId(null)
    }
  }

  // Rename Logic
  const getDisplayName = (filename: string) => {
    return filename.replace(/\.[^/.]+$/, '') // Remove extension
  }

  const startRenaming = (item: GalleryItem) => {
    setRenamingId(item.id)
    setRenameValue(getDisplayName(item.filename))
  }

  const submitRename = async (id: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null)
      return
    }
    
    const res = await window.electron.gallery.renameItem(id, renameValue.trim())
    if (res?.success && res.item) {
      setItems(prev => prev.map(i => i.id === id ? res.item : i))
    }
    setRenamingId(null)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      submitRename(id)
    } else if (e.key === 'Escape') {
      setRenamingId(null)
    }
  }

  if (loading) {
    return <div className="loading-screen">加载图库...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部 Header + 搜索 + Tabs */}
      <div style={{ 
        padding: '20px 40px 0 40px', 
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        zIndex: 10
      }}>
        {/* Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '16px' }}>
          <div style={{ 
            flex: 1, 
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '24px', 
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            maxWidth: '800px'
          }}>
            <span style={{ color: 'var(--text-tertiary)' }}>🔍</span>
            <input 
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索图片或标签..."
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '15px',
                width: '100%',
                color: 'var(--text-primary)'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={refresh}>刷新</button>
            <button className="btn btn-primary" onClick={handleImport}>导入</button>
          </div>
        </div>

        {/* Categories / Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '24px', 
          overflowX: 'auto', 
          paddingBottom: '1px', // Avoid scrollbar overlap with border
          whiteSpace: 'nowrap'
        }}>
          {['所有', ...allTags].map(tag => (
            <div 
              key={tag}
              onClick={() => setActiveTab(tag)}
              style={{
                padding: '10px 4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === tag ? 600 : 400,
                color: activeTab === tag ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === tag ? '3px solid var(--text-primary)' : '3px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content: Masonry-like Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 40px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🖼️</div>
            <p>没有找到相关图片</p>
          </div>
        ) : (
          <div style={{ 
            columnCount: 'auto', 
            columnWidth: '236px', // Pinterest standard column width
            columnGap: '16px' 
          }}>
            {filtered.map(item => (
              <div 
                key={item.id}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                style={{
                  breakInside: 'avoid',
                  marginBottom: '16px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  position: 'relative',
                  backgroundColor: 'var(--bg-secondary)',
                  cursor: 'zoom-in'
                }}
              >
                {/* Image */}
                <div style={{ position: 'relative' }}>
                  {previews[item.id] ? (
                    <img 
                      src={previews[item.id]} 
                      alt={item.filename}
                      style={{ width: '100%', display: 'block', borderRadius: '16px' }} 
                    />
                  ) : (
                    <div style={{ 
                      width: '100%', height: '200px', 
                      backgroundColor: 'var(--bg-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-tertiary)'
                    }}>加载中...</div>
                  )}
                  
                  {/* Hover Overlay Actions */}
                  {hoveredItem === item.id && (
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      borderRadius: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setAddingTagId(item.id); setTimeout(() => document.getElementById(`tag-input-${item.id}`)?.focus(), 0) }}
                          style={{
                            padding: '6px 12px', borderRadius: '20px', 
                            backgroundColor: '#e60023', color: 'white', border: 'none',
                            cursor: 'pointer', fontWeight: 600, fontSize: '12px'
                          }}
                        >
                          保存 / 标签
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); startRenaming(item); }}
                          style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            backgroundColor: 'white', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title="重命名"
                        >
                          ✎
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleReveal(item.filePath) }}
                          style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            backgroundColor: 'white', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title="在文件夹中显示"
                        >
                          📂
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                          style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            backgroundColor: 'white', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags & Meta (Visible below image) */}
                <div style={{ padding: '8px 4px' }}>
                  {/* Filename: Editable */}
                  <div style={{ marginBottom: '6px' }}>
                    {renamingId === item.id ? (
                      <input
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => submitRename(item.id)}
                        onKeyDown={e => handleRenameKeyDown(e, item.id)}
                        autoFocus
                        style={{
                          width: '100%', fontSize: '12px', fontWeight: 600,
                          padding: '4px', borderRadius: '4px', border: '1px solid var(--accent-color)',
                          outline: 'none', fontFamily: 'inherit'
                        }}
                      />
                    ) : (
                      <div 
                        onDoubleClick={() => startRenaming(item)}
                        style={{ 
                          fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          cursor: 'text'
                        }}
                        title={item.filename}
                      >
                        {getDisplayName(item.filename)}
                      </div>
                    )}
                  </div>
                  
                  {/* Tags List */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {item.tags?.map(tag => (
                      <span 
                        key={tag}
                        style={{ 
                          fontSize: '10px', 
                          padding: '2px 6px', 
                          backgroundColor: 'var(--bg-tertiary)', 
                          borderRadius: '4px',
                          color: 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        {tag}
                        {hoveredItem === item.id && (
                          <span 
                            onClick={(e) => { e.stopPropagation(); handleRemoveTag(item.id, tag) }}
                            style={{ cursor: 'pointer', fontWeight: 'bold' }}
                          >×</span>
                        )}
                      </span>
                    ))}
                    
                    {/* Add Tag Input Inline */}
                    {addingTagId === item.id && (
                      <input
                        id={`tag-input-${item.id}`}
                        value={newTagValue}
                        onChange={e => setNewTagValue(e.target.value)}
                        onKeyDown={e => handleKeyDownTag(e, item.id)}
                        onBlur={() => setAddingTagId(null)}
                        placeholder="输入标签..."
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          border: '1px solid var(--accent-color)',
                          borderRadius: '4px',
                          outline: 'none',
                          width: '60px'
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Gallery