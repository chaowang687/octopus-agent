import React, { useState, useEffect, useRef } from 'react'
import ChatSidebar from '../components/ChatSidebar'
import { chatDataService, ChatSession } from '../services/ChatDataService'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  status?: 'sending' | 'sent' | 'completed' | 'error'
  thinking?: string
  attachments?: Attachment[]
}

interface Attachment {
  type: 'image' | 'file' | 'link'
  path: string
  name: string
  preview?: string
  url?: string
}

interface TaskStep {
  key: string
  id: string
  tool: string
  description: string
  status: 'pending' | 'running' | 'success' | 'error'
  error?: string
  retryCount?: number
  maxRetries?: number
  durationMs?: number
  artifacts?: any[]
}

interface TaskProgressEvent {
  taskId: string
  type: string
  timestamp: number
  requestedModel?: string
  modelUsed?: string
  durationMs?: number
  iteration?: number
  maxIterations?: number
  planSteps?: Array<{ id: string; tool: string; description: string }>
  stepId?: string
  tool?: string
  description?: string
  parameters?: any
  artifacts?: any[]
  resultSummary?: string
  final?: boolean
  error?: string
  retryCount?: number
  maxRetries?: number
  taskDir?: string
}

const ImageAttachment: React.FC<{ filePath: string; alt: string }> = ({ filePath, alt }) => {
  const [src, setSrc] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!filePath) return
      const res = await window.electron.gallery.getDataUrl(filePath)
      if (!cancelled && res?.success && res.dataUrl) {
        setSrc(res.dataUrl)
      }
    }
    run()
    return () => { cancelled = true }
  }, [filePath])

  if (!src) {
    return <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{alt}</div>
  }
  return <img src={src} alt={alt} style={{ maxWidth: '200px', borderRadius: '4px' }} />
}

const Chat: React.FC = () => {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [selectedPreviewKey, setSelectedPreviewKey] = useState<string>('')
  const [selectedPreviewName, setSelectedPreviewName] = useState<string>('')

  const [showTaskPreview, setShowTaskPreview] = useState(false)
  const [taskTitle, setTaskTitle] = useState<string>('')
  const [taskStatus, setTaskStatus] = useState<'idle' | 'running' | 'done' | 'cancelled' | 'error'>('idle')
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([])
  const [taskLogs, setTaskLogs] = useState<string[]>([])
  const [taskDir, setTaskDir] = useState<string>('')
  const currentTaskIdRef = useRef<string | null>(null)
  
  const [activeTab, setActiveTab] = useState<'progress' | 'files'>('progress')
  
  const [selectedModel, setSelectedModel] = useState('openai')
  const [models] = useState<{ id: string; name: string }[]>([
    { id: 'openai', name: 'OpenAI GPT-4' },
    { id: 'claude', name: 'Claude 3.5 Sonnet' },
    { id: 'minimax', name: 'MiniMax' },
    { id: 'deepseek', name: 'DeepSeek V3' }
  ])
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load session messages when session changes
  useEffect(() => {
    if (currentSession) {
      // Ensure messages are properly typed
      const loadedMessages = (currentSession.messages || []).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }))
      setMessages(loadedMessages)
      
      // If it's a direct chat, try to sync the model selection with the agent's preference
      if (currentSession.type === 'direct' && currentSession.members.length > 0) {
        const agent = chatDataService.getAgent(currentSession.members[0])
        if (agent?.model) {
          setSelectedModel(agent.model)
        }
      }
    } else {
      setMessages([])
    }
  }, [currentSession?.id]) // Only reload if ID changes

  // Persist messages to ChatDataService whenever they change
  useEffect(() => {
    if (currentSession && messages.length > 0) {
      chatDataService.saveMessages(currentSession.id, messages)
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    // Check available models
    const checkModels = async () => {
      const modelsToCheck = ['openai', 'claude', 'minimax', 'deepseek']
      const configuredModels: string[] = []
      
      for (const model of modelsToCheck) {
        const key = await window.electron.api.getApiKey(model)
        if (key) {
          configuredModels.push(model)
        }
      }
      
      if (!configuredModels.includes('openai') && configuredModels.length > 0) {
        setSelectedModel(configuredModels[0])
      }
    }
    checkModels()
  }, [])

  useEffect(() => {
    const api = (window as any).electron?.task?.onProgress
    if (!api) return

    const unsubscribe = window.electron.task.onProgress((evt: TaskProgressEvent) => {
      // ... (Keep existing task progress logic unchanged)
      const toolLabel = (tool?: string) => {
        if (!tool) return '工具'
        const map: Record<string, string> = {
          search_images: '批量图片搜索',
          search_web: '网页搜索',
          fetch_webpage: '网页抓取',
          download_image: '下载图片',
          read_image: '图片读取',
          glob_paths: 'Glob',
          read_file: '文件读取',
          write_file: '文件写入',
          create_directory: '创建目录',
          list_files: '列出文件',
          execute_command: '执行命令',
          respond_to_user: '回复'
        }
        return map[tool] || tool
      }

      const formatDuration = (ms?: number) => {
        if (!ms || ms <= 0) return ''
        return `${(ms / 1000).toFixed(2)}s`
      }

      const summarizeParams = (tool?: string, params?: any) => {
        if (!tool || !params) return ''
        if (tool === 'search_images' || tool === 'search_web') return params.query ? String(params.query) : ''
        if (tool === 'glob_paths') return params.pattern ? String(params.pattern) : ''
        if (tool === 'fetch_webpage') return params.url ? String(params.url) : ''
        if (tool === 'download_image') return params.url ? String(params.url) : ''
        if (tool === 'read_image') return params.path ? String(params.path) : ''
        return ''
      }

      const taskId = evt.taskId
      if (!currentTaskIdRef.current || evt.type === 'task_start') {
        currentTaskIdRef.current = taskId
      }
      if (currentTaskIdRef.current !== taskId) return

      const time = new Date(evt.timestamp).toLocaleTimeString()
      if (evt.type === 'task_start') {
        setTaskStatus('running')
        const modelInfo =
          evt.requestedModel && evt.modelUsed && evt.requestedModel !== evt.modelUsed
            ? `（模型已切换：${evt.requestedModel} → ${evt.modelUsed}）`
            : evt.modelUsed
              ? `（模型：${evt.modelUsed}）`
              : ''
        setTaskLogs([`[${time}] 任务开始${modelInfo}`])
        setTaskSteps([])
        setTaskDir(evt.taskDir || '')
        if (evt.taskDir) {
          setTaskLogs(prev => [...prev, `[${time}] 工作目录：${evt.taskDir}`])
        }
        return
      }

      if (evt.type === 'thinking') {
        const d = formatDuration(evt.durationMs)
        if (d) {
          setMessages(prev => [...prev, {
            id: `thinking-${evt.timestamp}`,
            role: 'assistant',
            content: `已思考 ${d}`,
            timestamp: new Date()
          }])
        }
        return
      }

      if (evt.type === 'iteration_start') {
        setTaskLogs(prev => [...prev, `[${time}] 迭代 ${evt.iteration}/${evt.maxIterations}`])
        return
      }

      if (evt.type === 'plan_generated') {
        const planSteps = evt.planSteps || []
        setTaskLogs(prev => [...prev, `[${time}] 生成计划：${planSteps.length} 步`])
        setTaskSteps(planSteps.map(s => ({
          key: `${evt.iteration || 1}:${s.id}`,
          id: s.id,
          tool: s.tool,
          description: s.description,
          status: 'pending'
        })))
        return
      }

      if (evt.type === 'step_start' && evt.stepId) {
        const key = `${evt.iteration || 1}:${evt.stepId}`
        setTaskSteps(prev => prev.map(s => s.key === key ? { ...s, status: 'running' } : s))
        return
      }

      if (evt.type === 'retry' && evt.stepId) {
        const key = `${evt.iteration || 1}:${evt.stepId}`
        setTaskSteps(prev => prev.map(s => s.key === key ? { ...s, retryCount: evt.retryCount, maxRetries: evt.maxRetries } : s))
        return
      }

      if (evt.type === 'step_success' && evt.stepId) {
        const key = `${evt.iteration || 1}:${evt.stepId}`
        setTaskSteps(prev => prev.map(s => s.key === key ? {
          ...s,
          status: 'success',
          error: undefined,
          retryCount: evt.retryCount,
          maxRetries: evt.maxRetries,
          durationMs: evt.durationMs,
          artifacts: evt.artifacts
        } : s))

        // Only show artifacts (images/files) in chat, suppress technical step completion messages
        // BUT: if the tool is "respond_to_user" or similar, we SHOULD show the message
        const isInteractiveTool = evt.tool === 'respond_to_user' || evt.tool === 'ask_user'
        const artifacts = Array.isArray(evt.artifacts) ? evt.artifacts : []
        
        if (isInteractiveTool || artifacts.length > 0) {
            const attachments: Attachment[] = []
            let hasVisualContent = false

            for (const a of artifacts as any[]) {
              if (a?.type === 'image') {
                attachments.push({
                  type: 'image',
                  path: a.path || '',
                  name: a.name || (a.path ? String(a.path).split('/').pop() : 'Image'),
                  preview: a.dataUrl
                })
                hasVisualContent = true
                continue
              }
              if (a?.type === 'file') {
                attachments.push({
                  type: 'file',
                  path: a.path || '',
                  name: a.name || (a.path ? String(a.path).split('/').pop() : 'File')
                })
                continue
              }
              if (a?.type === 'link') {
                attachments.push({
                  type: 'link',
                  path: a.url || '',
                  name: a.name || a.url || 'Link',
                  url: a.url
                })
              }
            }
            
            // For interactive tools, try to get the text content
            let content = ''
            if (isInteractiveTool) {
               const p = evt.parameters
               if (p && typeof p === 'object') {
                  content = p.content || p.question || p.message || ''
               }
               if (!content && evt.resultSummary) {
                  content = String(evt.resultSummary)
               }
            } else if (attachments.length > 0 && !hasVisualContent) {
               content = '生成了以下文件：'
            }

            if (content || attachments.length > 0) {
                setMessages(prev => [...prev, {
                  id: `step-success-${evt.timestamp}-${evt.stepId}`,
                  role: 'assistant',
                  content: content,
                  timestamp: new Date(),
                  attachments: attachments.length > 0 ? attachments : undefined
                }])
            }
        }
        return
      }

      if (evt.type === 'step_error' && evt.stepId) {
        const key = `${evt.iteration || 1}:${evt.stepId}`
        setTaskSteps(prev => prev.map(s => s.key === key ? { ...s, status: evt.final ? 'error' : 'running', error: evt.error, durationMs: evt.durationMs } : s))
        setTaskLogs(prev => [...prev, `[${time}] 步骤失败：${evt.stepId}${evt.error ? ` - ${evt.error}` : ''}`])
        // Only show fatal errors in chat if it's not a retryable step
        if (evt.final && !evt.error?.includes('Failed to parse plan')) {
           // Silence common technical errors from chat, keep them in logs
           const isTechnicalError = evt.error?.includes('Failed to parse') || evt.error?.includes('context length')
           if (!isTechnicalError) {
              const label = toolLabel(evt.tool)
              const d = formatDuration(evt.durationMs)
              setMessages(prev => [...prev, {
                id: `step-error-${evt.timestamp}-${evt.stepId}`,
                role: 'assistant',
                content: `已失败 ${label}${evt.error ? `\n${evt.error}` : ''}${d ? `\n${d}` : ''}`,
                timestamp: new Date(),
                status: 'error'
              }])
           }
        }
        return
      }

      if (evt.type === 'task_done') {
        setTaskStatus('done')
        setTaskLogs(prev => [...prev, `[${time}] 任务完成`])
        return
      }

      if (evt.type === 'task_cancelled') {
        setTaskStatus('cancelled')
        setTaskLogs(prev => [...prev, `[${time}] 已取消`])
        return
      }
    })

    return unsubscribe
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return

    let contentToSend = input
    // If there are attachments, append them to the message content
    if (attachments.length > 0) {
      const attachmentText = attachments.map(att => `[Attachment: ${att.path}]`).join('\n')
      contentToSend = `${input}\n\n${attachmentText}`.trim()
    }

    // --- Dynamic System Prompt Injection ---
    if (currentSession) {
      if (currentSession.type === 'direct' && currentSession.members.length > 0) {
        // Direct Chat: Inject Agent's Persona
        const agent = chatDataService.getAgent(currentSession.members[0])
        if (agent) {
          const personaInstruction = `\n\n<system_instruction>\nYour Persona: ${agent.name}\nDescription: ${agent.description}\nSystem Prompt: ${agent.systemPrompt}\nAct strictly according to this persona.\n</system_instruction>`
          contentToSend += personaInstruction
        }
      } else if (currentSession.type === 'group') {
        // Group Chat: Inject Orchestration Context
        const members = currentSession.members.map(mid => chatDataService.getAgent(mid)).filter(Boolean)
        const teamDesc = members.map(m => `- ${m?.name}: ${m?.description}`).join('\n')
        const groupInstruction = `\n\n<system_instruction>\nYou are the orchestrator of a cross-functional team.
Team Members:
${teamDesc}

Your goal is to coordinate these agents to solve the user's request. 
Analyze the request and decide which role fits best, or simulate the collaboration.
If a specific expert is needed (e.g., coding), assume the persona of that expert (e.g., Developer).
If design is needed, assume the persona of the Designer.
Always clarify who is speaking (e.g., "作为项目经理，我认为...") or orchestrate the workflow.
</system_instruction>`
        contentToSend += groupInstruction
      }
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input, 
      timestamp: new Date(),
      status: 'sending',
      attachments: [...attachments]
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setAttachments([])
    setLoading(true)
    setShowTaskPreview(true)
    setTaskTitle(input.trim() || '新任务')
    setTaskStatus('running')
    setTaskSteps([])
    setTaskLogs([])
    currentTaskIdRef.current = null
    
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id ? { ...msg, status: 'sent' } : msg
      ))

      const thinkingMessage: Message = {
        id: `thinking-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        thinking: '正在思考...'
      }
      setMessages(prev => [...prev, thinkingMessage])

      // Use the selected model (which might have been auto-set by the agent preference)
      const result = await window.electron.chat.sendMessage(selectedModel, contentToSend)
      
      setMessages(prev => prev.filter(msg => msg.id !== thinkingMessage.id))
      
      if (result.success) {
        const aiResponse: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
          status: 'completed'
        }
        setMessages(prev => [...prev, aiResponse])
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      console.error('Failed to send message:', error)
      setMessages(prev => prev.filter(msg => !msg.thinking))
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id ? { ...msg, status: 'error' } : msg
      ))
      
      const messageText = String(error?.message || error || '')
      if (messageText.toLowerCase().includes('cancel')) {
        const cancelMessage: Message = {
          id: `cancel-${Date.now()}`,
          role: 'assistant',
          content: '已取消当前任务。',
          timestamp: new Date(),
          status: 'completed'
        }
        setMessages(prev => [...prev, cancelMessage])
        return
      }

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `出错了：${error.message}`,
        timestamp: new Date(),
        status: 'error'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // ... (Keep existing file/screenshot/drag handlers unchanged)
  // --- File & Screenshot Handling ---

  const handleScreenshot = async () => {
    try {
      // Hide window briefly to take screenshot (optional, might need main process support)
      const result = await window.electron.system.captureScreen()
      if (result.success && result.image) {
        const newAttachment: Attachment = {
          type: 'image',
          path: 'Screenshot', // Virtual path or temp path
          name: `Screenshot ${new Date().toLocaleTimeString()}`,
          preview: result.image
        }
        setAttachments(prev => [...prev, newAttachment])
      }
    } catch (error) {
      console.error('Screenshot failed:', error)
    }
  }

  const handleAddFile = async () => {
    try {
      const result = await window.electron.dialog.openFile()
      if (!result.canceled && result.filePaths.length > 0) {
        const newAttachments: Attachment[] = result.filePaths.map((path: string) => ({
          type: 'file',
          path: path,
          name: path.split('/').pop() || 'File'
        }))
        setAttachments(prev => [...prev, ...newAttachments])
      }
    } catch (error) {
      console.error('Add file failed:', error)
    }
  }

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newAttachments: Attachment[] = Array.from(e.dataTransfer.files).map((file: any) => ({
        type: file.type.startsWith('image/') ? 'image' : 'file',
        path: file.path, // Electron exposes path on File object
        name: file.name,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      }))
      setAttachments(prev => [...prev, ...newAttachments])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleCancelTask = async () => {
    if (!loading) return
    try {
      await window.electron.chat.cancel()
    } catch (error) {
      console.error('Cancel task failed:', error)
    } finally {
      setMessages(prev => prev.filter(msg => !msg.thinking))
      setTaskStatus('cancelled')
      const cancelMessage: Message = {
        id: `cancel-${Date.now()}`,
        role: 'assistant',
        content: '已取消当前任务。',
        timestamp: new Date(),
        status: 'completed'
      }
      setMessages(prev => [...prev, cancelMessage])
      setLoading(false)
    }
  }

  const renderAttachments = (artifacts: any[]) => {
    if (!artifacts || artifacts.length === 0) return null
    
    // Group images for grid layout
    const images = artifacts.filter(a => a.type === 'image').slice(0, 9)
    const others = artifacts.filter(a => a.type !== 'image')
    
    return (
      <div className="mt-2 flex flex-col gap-2">
        {images.length > 0 && (
          <>
            <div className="task-preview-grid">
              {images.map((att, i) => {
                const key = String(att?.path || att?.taskCopyPath || att?.name || att?.dataUrl || i)
                const selected = selectedPreviewKey === key
                return (
                  <div
                    key={key}
                    className={`task-preview-grid-item ${selected ? 'selected' : ''}`}
                    title={att.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedPreviewKey(key)
                      setSelectedPreviewName(String(att?.name || ''))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedPreviewKey(key)
                        setSelectedPreviewName(String(att?.name || ''))
                      }
                    }}
                  >
                    <img src={att.dataUrl || att.preview} alt={att.name} />
                  </div>
                )
              })}
            </div>
            {selectedPreviewKey && selectedPreviewName && images.some(att => String(att?.path || att?.taskCopyPath || att?.name || att?.dataUrl) === selectedPreviewKey) && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>已选择：{selectedPreviewName}</div>
            )}
          </>
        )}
        
        {others.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {others.map((att, i) => (
              <div key={i} className="text-xs bg-base-300 px-2 py-1 rounded flex items-center gap-1">
                <span>{att.type === 'file' ? '📄' : '🔗'}</span>
                <span className="truncate max-w-[150px]">{att.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div 
      className="chat-page" 
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ flexDirection: 'row' }}
    >
      <ChatSidebar 
        currentSessionId={currentSession?.id} 
        onSelectSession={setCurrentSession} 
      />

      <div className="chat-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', height: '100%', overflow: 'hidden' }}>
        
        {/* Drag Overlay */}
        {isDragging && (
          <div className="drag-overlay">
            <div className="drag-overlay-content">
              Drop files here to add to context
            </div>
          </div>
        )}

        {/* Task Preview */}
        {showTaskPreview && (
          <div className="task-preview">
            <div className="task-preview-tabs">
              <div 
                className={`task-preview-tab ${activeTab === 'progress' ? 'active' : ''}`}
                onClick={() => setActiveTab('progress')}
              >
                当前进程
              </div>
              <div 
                className={`task-preview-tab ${activeTab === 'files' ? 'active' : ''}`}
                onClick={() => setActiveTab('files')}
              >
                文件
              </div>
              <div style={{ flex: 1 }}></div>
              <button className="task-preview-close" onClick={() => setShowTaskPreview(false)}>×</button>
            </div>

            <div className="task-preview-body">
              {activeTab === 'progress' ? (
                <>
                  <div className="task-status-row">
                     <div className="task-status-icon">
                       {taskStatus === 'running' ? '⚡️' : taskStatus === 'done' ? '✅' : taskStatus === 'error' ? '❌' : '⏸'}
                     </div>
                     <div className="task-status-text">
                       <div className={`task-status-dot ${taskStatus === 'running' ? 'running' : taskStatus === 'done' ? 'success' : taskStatus === 'error' ? 'error' : ''}`}></div>
                       {taskStatus === 'running' ? '进行中' : taskStatus === 'done' ? '已完成' : taskStatus === 'error' ? '失败' : '空闲'}
                       {taskSteps.length > 0 && ` ${taskSteps[taskSteps.length - 1].description}`}
                     </div>
                  </div>
                  <div className="task-preview-logs">
                    {taskLogs.length === 0 ? (
                      <div className="log-entry info">等待任务开始...</div>
                    ) : (
                      taskLogs.map((l, idx) => (
                        <div key={idx} className={`log-entry ${l.includes('失败') || l.includes('Error') ? 'error' : ''}`}>
                          {l}
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </>
              ) : (
                <div style={{ padding: '20px', color: '#86868b', fontSize: '13px', textAlign: 'center' }}>
                  暂无生成文件
                </div>
              )}
            </div>
          </div>
        )}

        <div className="chat-messages">
          {messages.length === 0 && !loading ? (
             <div style={{ 
               height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
               flexDirection: 'column', color: 'var(--text-tertiary)', gap: '12px' 
             }}>
               <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Trae" style={{ width: '64px', opacity: 0.5 }} />
               <div>选择左侧会话或新建聊天</div>
             </div>
          ) : (
            messages.map(message => (
              <div key={message.id} className={`message ${message.role}`}>
                <div className={`avatar ${message.role}`}>
                  {message.role === 'user' ? (
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=User" alt="U" />
                  ) : (
                    <img src={
                      currentSession?.type === 'direct' 
                        ? (chatDataService.getAgent(currentSession.members[0])?.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=Agent")
                        : "https://api.dicebear.com/7.x/bottts/svg?seed=Group"
                    } alt="AI" />
                  )}
                </div>
                <div className="message-content">
                  {message.thinking ? (
                    <div className="thinking-indicator">
                      <span>{message.thinking}</span>
                    </div>
                  ) : (
                    <>
                      {/* Display Attachments in Message */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {message.attachments.filter(a => a.type === 'image').length > 0 && (
                            <div className="task-preview-grid">
                              {message.attachments
                                .filter(a => a.type === 'image')
                                .slice(0, 9)
                                .map((att, i) => {
                                  const key = String(att.path || att.name || i)
                                  const selected = selectedPreviewKey === key
                                  return (
                                    <div
                                      key={key}
                                      className={`task-preview-grid-item ${selected ? 'selected' : ''}`}
                                      title={att.name}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => {
                                        setSelectedPreviewKey(key)
                                        setSelectedPreviewName(att.name)
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault()
                                          setSelectedPreviewKey(key)
                                          setSelectedPreviewName(att.name)
                                        }
                                      }}
                                    >
                                      {att.preview ? (
                                        <img src={att.preview} alt={att.name} />
                                      ) : (
                                        <ImageAttachment filePath={att.path} alt={att.name} />
                                      )}
                                    </div>
                                  )
                                })}
                            </div>
                          )}

                          {message.attachments.filter(a => a.type !== 'image').length > 0 && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {message.attachments.filter(a => a.type !== 'image').map((att, i) => (
                                att.type === 'link' && att.url ? (
                                  <a
                                    key={`${att.type}-${i}`}
                                    href={att.url}
                                    onClick={(e) => { e.preventDefault(); window.electron.system.openExternal(att.url!) }}
                                    style={{
                                      fontSize: '12px',
                                      padding: '4px 8px',
                                      backgroundColor: 'rgba(0,0,0,0.1)',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      color: 'inherit',
                                      textDecoration: 'none'
                                    }}
                                  >
                                    🔗 {att.name}
                                  </a>
                                ) : (
                                  <div key={`${att.type}-${i}`} style={{ 
                                    fontSize: '12px', 
                                    padding: '4px 8px', 
                                    backgroundColor: 'rgba(0,0,0,0.1)', 
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    📄 {att.name}
                                  </div>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {message.content}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-footer">
          {/* Attachments Preview Area */}
          {attachments.length > 0 && (
            <div className="attachments-preview">
              {attachments.map((att, index) => (
                <div key={index} className="attachment-item">
                  {att.type === 'image' ? '🖼️' : att.type === 'link' ? '🔗' : '📄'} {att.name}
                  <span className="attachment-remove" onClick={() => removeAttachment(index)}>×</span>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div className="chat-toolbar">
            <button className="toolbar-btn" title="Add File" onClick={handleAddFile}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
            </button>
            <button className="toolbar-btn" title="Screenshot" onClick={handleScreenshot}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </button>

            {loading && (
              <button className="toolbar-btn" title="Stop" onClick={handleCancelTask}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="12" height="12"></rect>
                </svg>
              </button>
            )}

            <button className="toolbar-btn" title="Task Preview" onClick={() => setShowTaskPreview(v => !v)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16"></path>
                <path d="M4 12h16"></path>
                <path d="M4 20h16"></path>
              </svg>
            </button>
            
            <div style={{ flex: 1 }}></div>

            <div className="model-selector">
               <select 
                  value={selectedModel} 
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none', cursor: 'pointer' }}
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
            </div>
          </div>

          {/* Input Area */}
          <div className="chat-input-area">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentSession?.type === 'group' ? "输入任务让团队协作..." : "输入消息..."}
              disabled={loading || !currentSession}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Chat