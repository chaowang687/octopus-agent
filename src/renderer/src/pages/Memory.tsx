import React, { useState, useEffect } from 'react'

// 记忆类型
type MemoryType = 'conversation' | 'fact' | 'preference' | 'skill' | 'project' | 'custom'

// 记忆条目
interface MemoryEntry {
  id: string
  type: MemoryType
  content: string
  metadata: {
    source?: string
    tags?: string[]
    importance?: number
    createdAt: number
    updatedAt?: number
    lastAccessedAt?: number
    accessCount?: number
  }
}

// 记忆类型配置
const memoryTypeConfig = {
  conversation: { color: '#8b5cf6', bg: '#8b5cf620', label: '对话' },
  fact: { color: '#3b82f6', bg: '#3b82f620', label: '事实' },
  preference: { color: '#f59e0b', bg: '#f59e0b20', label: '偏好' },
  skill: { color: '#22c55e', bg: '#22c55e20', label: '技能' },
  project: { color: '#ec4899', bg: '#ec489920', label: '项目' },
  custom: { color: '#6b7280', bg: '#6b728020', label: '自定义' }
}

const MemoryPage: React.FC = () => {
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [filter, setFilter] = useState<MemoryType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalEntries: 0,
    byType: {} as Record<MemoryType, number>
  })

  // 模拟加载记忆数据
  useEffect(() => {
    loadMemories()
  }, [])

  const loadMemories = async () => {
    setIsLoading(true)
    try {
      // 尝试从主进程获取记忆数据
      if (window.electron?.memory) {
        const result = await window.electron.memory.getAll()
        if (result.success) {
          setMemories(result.memories || [])
          setStats(result.stats || { totalEntries: 0, byType: {} })
        }
      }
    } catch (error) {
      console.error('Failed to load memories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredMemories = memories.filter(m => {
    const matchesFilter = filter === 'all' || m.type === filter
    const matchesSearch = !searchQuery || 
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.metadata.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleDelete = async (id: string) => {
    try {
      if (window.electron?.memory) {
        await window.electron.memory.delete(id)
        setMemories(prev => prev.filter(m => m.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete memory:', error)
    }
  }

  const handleClear = async (type?: MemoryType) => {
    if (!confirm(type ? `确定要清空所有${memoryTypeConfig[type].label}记忆吗？` : '确定要清空所有记忆吗？')) {
      return
    }
    try {
      if (window.electron?.memory) {
        await window.electron.memory.clear(type)
        if (type) {
          setMemories(prev => prev.filter(m => m.type !== type))
        } else {
          setMemories([])
        }
      }
    } catch (error) {
      console.error('Failed to clear memories:', error)
    }
  }

  return (
    <div className="memory-page" style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
              长期记忆
            </h1>
            <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
              AI跨会话学习与知识保持
            </p>
          </div>
          <button
            onClick={() => handleClear()}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #ef4444',
              backgroundColor: 'transparent',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            清空全部
          </button>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#8b5cf6' }}>
              {stats.totalEntries}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>记忆总数</div>
          </div>
          {Object.entries(stats.byType).map(([type, count]) => (
            <div key={type} style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: 700, 
                color: memoryTypeConfig[type as MemoryType].color 
              }}>
                {count}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {memoryTypeConfig[type as MemoryType].label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search and Filter */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '20px',
        backgroundColor: 'var(--bg-secondary)',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="var(--text-secondary)" 
            strokeWidth="2"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索记忆内容或标签..."
            style={{
              width: '100%',
              padding: '10px 12px 10px 42px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '14px'
            }}
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as MemoryType | 'all')}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <option value="all">全部类型</option>
          {Object.entries(memoryTypeConfig).map(([type, config]) => (
            <option key={type} value={type}>{config.label}</option>
          ))}
        </select>
      </div>

      {/* Memory List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            加载中...
          </div>
        ) : filteredMemories.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px', 
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px dashed var(--border-color)'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 16px', opacity: 0.5 }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
            <p>暂无记忆数据</p>
            <p style={{ fontSize: '12px' }}>与AI的对话和交互将会被自动记忆</p>
          </div>
        ) : (
          filteredMemories.map(memory => {
            const config = memoryTypeConfig[memory.type]
            return (
              <div 
                key={memory.id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: config.color,
                        backgroundColor: config.bg,
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {config.label}
                      </span>
                      {memory.metadata.tags?.map(tag => (
                        <span key={tag} style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          backgroundColor: 'var(--bg-tertiary)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                      {memory.content}
                    </p>
                    <div style={{ 
                      display: 'flex', 
                      gap: '16px', 
                      marginTop: '12px', 
                      fontSize: '12px', 
                      color: 'var(--text-secondary)' 
                    }}>
                      <span>创建于: {formatDate(memory.metadata.createdAt)}</span>
                      {memory.metadata.accessCount && (
                        <span>访问: {memory.metadata.accessCount}次</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(memory.id)}
                    style={{
                      padding: '6px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      marginLeft: '12px'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default MemoryPage
