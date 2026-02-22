import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  tags?: string[]
  favorite?: boolean
}

interface Tag {
  id: string
  name: string
  count: number
}

const Notebook: React.FC = () => {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [contentInput, setContentInput] = useState('')

  // 加载笔记数据
  useEffect(() => {
    loadNotes()
  }, [])

  // 过滤笔记
  useEffect(() => {
    if (searchQuery) {
      const filtered = notes.filter(note => 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredNotes(filtered)
    } else {
      setFilteredNotes(notes)
    }
  }, [searchQuery, notes])

  // 加载笔记
  const loadNotes = () => {
    try {
      const savedNotes = localStorage.getItem('trae_notes')
      if (savedNotes) {
        const parsedNotes = JSON.parse(savedNotes)
        setNotes(parsedNotes)
        setFilteredNotes(parsedNotes)
        
        // 提取标签
        extractTags(parsedNotes)
      }
    } catch (error) {
      console.error('加载笔记失败:', error)
    }
  }

  // 提取标签
  const extractTags = (noteList: Note[]) => {
    const tagMap = new Map<string, number>()
    
    noteList.forEach(note => {
      if (note.tags) {
        note.tags.forEach(tag => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
        })
      }
    })
    
    const tagList = Array.from(tagMap.entries()).map(([name, count]) => ({
      id: name,
      name,
      count
    }))
    
    setTags(tagList)
  }

  // 保存笔记
  const saveNotes = (updatedNotes: Note[]) => {
    try {
      localStorage.setItem('trae_notes', JSON.stringify(updatedNotes))
      setNotes(updatedNotes)
      setFilteredNotes(updatedNotes)
      extractTags(updatedNotes)
    } catch (error) {
      console.error('保存笔记失败:', error)
    }
  }

  // 创建新笔记
  const createNote = () => {
    const newNote: Note = {
      id: `note_${Date.now()}`,
      title: '新笔记',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    
    const updatedNotes = [newNote, ...notes]
    saveNotes(updatedNotes)
    setSelectedNote(newNote)
    setTitleInput('新笔记')
  }

  return (
    <div className="notebook">
      <h1>笔记本</h1>
      <div className="notebook-content">
        <div className="notes-list">
          {filteredNotes.map(note => (
            <div key={note.id} className="note-item">
              <h3>{note.title}</h3>
              <p>{note.content.substring(0, 100)}...</p>
            </div>
          ))}
        </div>
        <div className="note-editor">
          {selectedNote && (
            <div>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="标题"
              />
              <textarea
                value={contentInput}
                onChange={(e) => setContentInput(e.target.value)}
                placeholder="内容"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Notebook