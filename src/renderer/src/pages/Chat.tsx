import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ChatSidebar from '../components/ChatSidebar'
import CreateGroupModal from '../components/CreateGroupModal'
import ReasoningVisualizer from '../components/ReasoningVisualizer'
import InterventionModal from '../components/InterventionModal'
import { chatDataService, ChatSession, Agent } from '../services/ChatDataService'

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
  // 思考过程内容
  thinkingReasoning?: string
  // plan_created事件字段
  reasoning?: string
  stepCount?: number
  round?: number
  // execution_progress事件字段
  // 多智能体协作相关
  agentId?: string
  agentName?: string
  role?: string
  content?: string
  phase?: string
  from?: string
  to?: string
  message?: string
  progress?: string
  nextStep?: string
  quality?: string
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
  const navigate = useNavigate()
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
  // 任务进度历史记录
  const [taskHistory, setTaskHistory] = useState<{
    id: string
    title: string
    status: string
    timestamp: number
    logs: string[]
  }[]>(() => {
    // 从localStorage加载历史记录
    try {
      const saved = localStorage.getItem('trae_task_history')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [taskDir, setTaskDir] = useState<string>('')
  const currentTaskIdRef = useRef<string | null>(null)
  
  // === 新增：推理可视化状态 ===
  const [reasoningSteps, setReasoningSteps] = useState<any[]>([])
  const [showReasoningVisualizer, setShowReasoningVisualizer] = useState(false)
  
  // === 新增：干预审批弹窗状态 ===
  const [interventionRequest, setInterventionRequest] = useState<any>(null)
  
  const [activeTab, setActiveTab] = useState<'progress' | 'files' | 'history'>('progress')

  // 双系统状态
  const [systemState, setSystemState] = useState<'system1' | 'system2' | 'switching'>('system1')
  const [taskComplexity, setTaskComplexity] = useState<'low' | 'medium' | 'high'>('low')
  const [showSystemIndicator, setShowSystemIndicator] = useState(false)
  const [system1Response, setSystem1Response] = useState<string>('')
  const [showSystem1Response, setShowSystem1Response] = useState(false)

  // 多智能体协作状态
  const [isMultiAgentMode, setIsMultiAgentMode] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)  // 用于刷新侧边栏
  const [agentCollaboration, setAgentCollaboration] = useState<{
    agents: { id: string; name: string; role: string; status: string }[]
    currentPhase: string
  } | null>(null)
  
  // 多对话框协作模式 - 每个智能体独立对话框
  const [multiDialogueMode, setMultiDialogueMode] = useState(false)
  const [dialogueSessions, setDialogueSessions] = useState<{
    agentId: string
    sessionId: string
    status: string
  }[]>([])
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0)

  // 监听agent打开页面的事件
  useEffect(() => {
    const api = (window as any).electron
    if (api?.events?.onAgentOpenPage) {
      const unsubscribe = api.events.onAgentOpenPage((url: string) => {
        console.log('[Chat] Received agent-open-page event:', url)
        // 将URL存储到sessionStorage，主页会读取并打开
        sessionStorage.setItem('pendingOpenUrl', url)
        // 跳转到浏览器页面
        navigate('/')
      })
      return () => {
        if (unsubscribe) unsubscribe()
      }
    }
  }, [navigate])
  
  const [selectedModel, setSelectedModel] = useState('openai')
  // 当前使用的模型名称（自动判断后显示）
  const [currentModelName, setCurrentModelName] = useState<string>('DeepSeek (快速响应)')
  const [models] = useState<{ id: string; name: string }[]>([
    { id: 'openai', name: 'OpenAI GPT-4' },
    { id: 'claude', name: 'Claude 3.5 Sonnet' },
    { id: 'minimax', name: 'MiniMax' },
    { id: 'deepseek', name: 'DeepSeek V3' },
    { id: 'doubao', name: 'Doubao' }
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
        const startLog = `[${time}] 任务开始${modelInfo}`
        setTaskLogs([startLog])
        setTaskSteps([])
        setTaskDir(evt.taskDir || '')
        setShowTaskPreview(true) // Auto-show task panel on start
        if (evt.taskDir) {
          setTaskLogs(prev => [...prev, `[${time}] 工作目录：${evt.taskDir}`])
        }
        
        // 创建任务历史记录
        const newHistoryItem = {
          id: taskId,
          title: evt.taskDir ? evt.taskDir.split('/').pop() || '新任务' : '新任务',
          status: '进行中',
          timestamp: evt.timestamp,
          logs: [startLog]
        }
        setTaskHistory(prev => {
          const updated = [newHistoryItem, ...prev].slice(0, 20) // 保留最近20条
          localStorage.setItem('trae_task_history', JSON.stringify(updated))
          return updated
        })
        return
      }

      if (evt.type === 'thinking') {
        const d = formatDuration(evt.durationMs)
        // 显示思考内容和思考时长
        const thinkingContent = evt.thinkingReasoning || ''
        const thinkingPreview = thinkingContent.length > 200 ? thinkingContent.slice(0, 200) + '...' : thinkingContent
        
        if (d || thinkingContent) {
          // 同时添加到消息和日志
          const thinkingMsg = `深度思考中 ${d ? `(${d})` : ''}：${thinkingPreview}`
          setMessages(prev => [...prev, {
            id: `thinking-${evt.timestamp}`,
            role: 'assistant',
            content: thinkingMsg,
            timestamp: new Date(),
            thinking: thinkingContent  // 保存完整思考内容
          }])
          
          // 添加到日志面板
          setTaskLogs(prev => [...prev, `[${time}] ${thinkingMsg}`])
        }
        return
      }

      if (evt.type === 'iteration_start') {
        setTaskLogs(prev => [...prev, `[${time}] 迭代 ${evt.iteration}/${evt.maxIterations}`])
        return
      }

      if (evt.type === 'plan_generated') {
        const planSteps = evt.planSteps || []
        const thinkingContent = evt.thinkingReasoning || ''
        
        // 显示思考内容到日志
        if (thinkingContent) {
          const thinkingPreview = thinkingContent.length > 300 ? thinkingContent.slice(0, 300) + '...' : thinkingContent
          setTaskLogs(prev => [...prev, `[${time}] 思考过程：${thinkingPreview}`])
        }
        
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
        if (evt.final && !evt.error?.includes('Failed to parse plan')) {
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
        const doneLog = `[${time}] 任务完成`
        setTaskLogs(prev => [...prev, doneLog])
        
        // 更新任务历史记录
        setTaskHistory(prev => {
          const updated = prev.map(item => 
            item.id === taskId 
              ? { ...item, status: '已完成', logs: [...item.logs, doneLog] }
              : item
          )
          localStorage.setItem('trae_task_history', JSON.stringify(updated))
          return updated
        })
        return
      }

      // 处理多智能体消息 - 在聊天界面显示各智能体的发言
      if (evt.type === 'agent_message') {
        console.log('[Chat] 收到 agent_message:', evt.agentName, 'content length:', evt.content?.length)
        
        // 获取智能体头像 - 与ChatDataService中的agent一致
        const agentAvatarMap: Record<string, string> = {
          'agent-pm': 'https://api.dicebear.com/7.x/avataaars/svg?seed=PM',
          'agent-dev': 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev',
          'agent-ui': 'https://api.dicebear.com/7.x/avataaars/svg?seed=UI',
          'agent-solo-coder': 'https://api.dicebear.com/7.x/avataaars/svg?seed=SoloCoder',
          'agent-test-generator': 'https://api.dicebear.com/7.x/avataaars/svg?seed=Test',
          'agent-code-reviewer': 'https://api.dicebear.com/7.x/avataaars/svg?seed=Review',
          'system': 'https://api.dicebear.com/7.x/bottts/svg?seed=System',
          'document_generator': 'https://api.dicebear.com/7.x/avataaars/svg?seed=PM',
          'ui_designer': 'https://api.dicebear.com/7.x/avataaars/svg?seed=UI',
          'code_generator': 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev',
          'test_generator': 'https://api.dicebear.com/7.x/avataaars/svg?seed=Test',
          'code_reviewer': 'https://api.dicebear.com/7.x/avataaars/svg?seed=Review'
        }
        
        const agentId = evt.agentId || 'system'
        const avatar = agentAvatarMap[agentId] || 'https://api.dicebear.com/7.x/bottts/svg?seed=Agent'
        
        // 获取智能体名称
        const agentName = evt.agentName || '智能体'
        
        // 获取完整内容
        const fullContent = evt.content || ''
        
        console.log('[Chat] agentName:', agentName, 'content:', fullContent.slice(0, 100))
        
        setMessages(prev => [...prev, {
          id: `agent-${evt.timestamp}-${agentId}`,
          role: 'assistant',
          content: `**${agentName}**${evt.role ? ` (${evt.role})` : ''}:\n\n${fullContent}`,
          timestamp: new Date(),
          status: 'completed'
        }])
        
        // 显示内容预览到日志
        const contentPreview = fullContent.length > 150 ? fullContent.slice(0, 150) + '...' : fullContent
        const agentLog = `[${time}] ${agentName}: ${contentPreview}`
        setTaskLogs(prev => [...prev, agentLog])
        
        // 更新任务历史记录
        setTaskHistory(prev => {
          const updated = prev.map(item => 
            item.id === taskId 
              ? { ...item, logs: [...item.logs, agentLog] }
              : item
          )
          localStorage.setItem('trae_task_history', JSON.stringify(updated))
          return updated
        })
        return
      }

      // 处理系统切换事件
      if (evt.type === 'system_switch') {
        const switchLog = `[${time}] 🔄 ${evt.message}`
        setTaskLogs(prev => [...prev, switchLog])
        setMessages(prev => [...prev, {
          id: `system-${evt.timestamp}`,
          role: 'assistant',
          content: evt.message,
          timestamp: new Date(),
          status: 'completed'
        }])
        
        // 更新任务历史记录
        setTaskHistory(prev => {
          const updated = prev.map(item => 
            item.id === taskId 
              ? { ...item, logs: [...item.logs, switchLog] }
              : item
          )
          localStorage.setItem('trae_task_history', JSON.stringify(updated))
          return updated
        })
        return
      }

      // 处理进度检查事件
      if (evt.type === 'progress_check') {
        const progressLog = `[${time}] 📊 进度评估: ${evt.progress} - 质量: ${evt.quality}`
        setTaskLogs(prev => [...prev, progressLog])
        if (evt.nextStep) {
          const nextLog = `[${time}] 📋 下一步: ${evt.nextStep}`
          setTaskLogs(prev => [...prev, nextLog])
          
          // 更新任务历史记录
          setTaskHistory(prev => {
            const updated = prev.map(item => 
              item.id === taskId 
                ? { ...item, logs: [...item.logs, progressLog, nextLog] }
                : item
            )
            localStorage.setItem('trae_task_history', JSON.stringify(updated))
            return updated
          })
        } else {
          setTaskHistory(prev => {
            const updated = prev.map(item => 
              item.id === taskId 
                ? { ...item, logs: [...item.logs, progressLog] }
                : item
            )
            localStorage.setItem('trae_task_history', JSON.stringify(updated))
            return updated
          })
        }
        return
      }

      if (evt.type === 'task_cancelled') {
        setTaskStatus('cancelled')
        const cancelLog = `[${time}] 已取消`
        setTaskLogs(prev => [...prev, cancelLog])
        
        // 更新任务历史记录
        setTaskHistory(prev => {
          const updated = prev.map(item => 
            item.id === taskId 
              ? { ...item, status: 'cancelled', logs: [...item.logs, cancelLog] }
              : item
          )
          localStorage.setItem('trae_task_history', JSON.stringify(updated))
          return updated
        })
        return
      }

      // 处理任务错误
      if (evt.type === 'task_error') {
        setTaskStatus('error')
        const errorLog = `[${time}] 任务失败: ${evt.error || '未知错误'}`
        setTaskLogs(prev => [...prev, errorLog])
        
        // 更新任务历史记录
        setTaskHistory(prev => {
          const updated = prev.map(item => 
            item.id === taskId 
              ? { ...item, status: 'error', logs: [...item.logs, errorLog] }
              : item
          )
          localStorage.setItem('trae_task_history', JSON.stringify(updated))
          return updated
        })
        return
      }

      // 处理进度更新事件 - 显示子任务和进度百分比
      if (evt.type === 'progress') {
        const progress = evt.progress || 0
        const phase = evt.phase || ''
        const agent = evt.agent || ''
        const message = evt.message || ''
        const subTasks = evt.subTasks || []
        
        // 构建进度日志
        let progressLog = `[${time}] 📊 ${agent} - ${phase}: ${progress}%`
        if (message) {
          progressLog += ` - ${message}`
        }
        setTaskLogs(prev => [...prev, progressLog])
        
        // 如果有子任务，显示子任务详情
        if (subTasks.length > 0) {
          const subTaskDetails = subTasks.map((t: any) => {
            const statusIcon = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : t.status === 'failed' ? '❌' : '⬜'
            return `  ${statusIcon} ${t.name} (${t.progress || 0}%)`
          }).join('\n')
          setTaskLogs(prev => [...prev, subTaskDetails])
        }
        
        // 更新任务历史记录
        setTaskHistory(prev => {
          const updated = prev.map(item => 
            item.id === taskId 
              ? { ...item, logs: [...item.logs, progressLog] }
              : item
          )
          localStorage.setItem('trae_task_history', JSON.stringify(updated))
          return updated
        })
        
        // 在聊天界面也显示进度消息
        const progressMessage: Message = {
          id: `progress-${evt.timestamp}`,
          role: 'assistant',
          content: `📊 **${agent}** - ${phase}\n\n进度: ${progress}%\n\n${message}\n\n${subTasks.map((t: any) => {
            const statusIcon = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : t.status === 'failed' ? '❌' : '⬜'
            return `${statusIcon} ${t.name}: ${t.progress || 0}%`
          }).join('\n')}`,
          timestamp: new Date(),
          status: 'completed'
        }
        setMessages(prev => [...prev, progressMessage])
        return
      }

      // 处理计划创建事件 - 显示思考内容
      if (evt.type === 'plan_created') {
        const reasoning = evt.reasoning || ''
        const stepCount = evt.stepCount || 0
        const round = evt.round || 1
        
        const reasoningPreview = reasoning.length > 300 ? reasoning.slice(0, 300) + '...' : reasoning
        
        // 添加思考内容到日志
        if (reasoning) {
          setTaskLogs(prev => [...prev, `[${time}] 💭 深度思考 (第${round}轮): ${reasoningPreview}`])
        }
        setTaskLogs(prev => [...prev, `[${time}] 📋 生成执行计划: ${stepCount} 个步骤`])
        
        // 在聊天界面显示思考过程
        setMessages(prev => [...prev, {
          id: `plan-${evt.timestamp}`,
          role: 'assistant',
          content: `💭 **深度思考 (第${round}轮)**\n\n${reasoning}\n\n📋 **执行计划**: ${stepCount} 个步骤`,
          timestamp: new Date(),
          status: 'completed'
        }])
        return
      }

      // 处理执行进度事件
      if (evt.type === 'execution_progress') {
        const stepId = evt.stepId || ''
        const tool = evt.tool || ''
        const description = evt.description || ''
        const stepDuration = formatDuration(evt.durationMs)
        
        if (evt.type === 'step_start') {
          setTaskLogs(prev => [...prev, `[${time}] 🔧 执行步骤: ${description || stepId}`])
        } else if (evt.type === 'step_success') {
          setTaskLogs(prev => [...prev, `[${time}] ✅ 完成: ${description || stepId} ${stepDuration ? `(${stepDuration})` : ''}`])
        } else if (evt.type === 'step_error') {
          const errorLog = `[${time}] ❌ 失败: ${description || stepId} - ${evt.error || ''}`
          setTaskLogs(prev => [...prev, errorLog])
        }
        return
      }

      // === 新增：推理步骤可视化 ===
      if (evt.type === 'reasoning_step' && evt.reasoningStep) {
        const step = evt.reasoningStep
        
        console.log('[Chat] 收到推理步骤:', step)
        
        // 收集推理步骤用于可视化组件
        setReasoningSteps(prev => [...prev, step])
        
        // 如果有推理步骤，显示可视化组件（使用函数式更新）
        setShowReasoningVisualizer(prev => {
          if (!prev) {
            console.log('[Chat] 显示推理可视化面板')
            return true
          }
          return prev
        })
        
        let stepIcon = ''
        let stepLabel = ''
        
        switch (step.type) {
          case 'think':
            stepIcon = '💭'
            stepLabel = '思考'
            break
          case 'act':
            stepIcon = '🔧'
            stepLabel = '执行'
            break
          case 'observe':
            stepIcon = '👁️'
            stepLabel = '观察'
            break
          case 'reflect':
            stepIcon = '🔄'
            stepLabel = '反思'
            break
          case 'final':
            stepIcon = '✅'
            stepLabel = '完成'
            break
          default:
            stepIcon = '📝'
            stepLabel = step.type
        }
        
        const stepLog = `[${time}] ${stepIcon} ${stepLabel}: ${step.thought || step.action || step.observation || ''}`
        setTaskLogs(prev => [...prev, stepLog])
        
        // 在聊天界面显示推理步骤
        const reasoningMessage: Message = {
          id: `reasoning-${evt.timestamp}-${step.id}`,
          role: 'assistant',
          content: `${stepIcon} **${stepLabel}**\n\n${step.thought || ''}\n\n${step.action ? `🔧 动作: ${step.action}` : ''}\n\n${step.observation ? `👁️ 观察: ${step.observation}` : ''}`,
          timestamp: new Date(),
          status: 'completed'
        }
        setMessages(prev => [...prev, reasoningMessage])
        return
      }

      // === 新增：干预请求（审批弹窗）===
      if (evt.type === 'intervention_request' && evt.intervention) {
        const intervention = evt.intervention
        const riskEmoji = intervention.riskLevel === 'critical' ? '🔴' : 
                          intervention.riskLevel === 'high' ? '🟠' : 
                          intervention.riskLevel === 'medium' ? '🟡' : '🟢'
        
        const interventionLog = `[${time}] ${riskEmoji} 需要审批: ${intervention.title}`
        setTaskLogs(prev => [...prev, interventionLog])
        
        // 设置干预请求状态，显示审批弹窗
        setInterventionRequest(intervention)
        
        // 在聊天界面显示干预请求
        const interventionMessage: Message = {
          id: `intervention-${evt.timestamp}`,
          role: 'assistant',
          content: `${riskEmoji} **需要审批**\n\n**${intervention.title}**\n\n${intervention.description}\n\n风险等级: ${intervention.riskLevel}\n\n请在弹窗中确认是否允许执行。`,
          timestamp: new Date(),
          status: 'completed'
        }
        setMessages(prev => [...prev, interventionMessage])
        
        // 可以在这里触发弹窗显示
        console.log('[Chat] 收到干预请求:', intervention)
        return
      }

      // === 新增：干预响应 ===
      if (evt.type === 'intervention_approved' || evt.type === 'intervention_denied') {
        const result = evt.type === 'intervention_approved' ? '✅ 已批准' : '❌ 已拒绝'
        const responseLog = `[${time}] ${result}`
        setTaskLogs(prev => [...prev, responseLog])
        
        const responseMessage: Message = {
          id: `intervention-response-${evt.timestamp}`,
          role: 'assistant',
          content: evt.type === 'intervention_approved' 
            ? '✅ **用户已批准** - 继续执行...'
            : '❌ **用户已拒绝** - 停止执行',
          timestamp: new Date(),
          status: 'completed'
        }
        setMessages(prev => [...prev, responseMessage])
        return
      }

      // === 新增：自我纠正 ===
      if (evt.type === 'correction_attempt' || evt.type === 'self_correction') {
        const strategy = evt.correctionStrategy || 'unknown'
        const explanation = evt.correctionExplanation || ''
        
        let strategyIcon = '🔧'
        let strategyLabel = strategy
        
        switch (strategy) {
          case 'retry_same':
            strategyIcon = '🔄'
            strategyLabel = '重试（相同）'
            break
          case 'retry_with_modification':
            strategyIcon = '🔧'
            strategyLabel = '修改后重试'
            break
          case 'use_alternative_tool':
            strategyIcon = '🔀'
            strategyLabel = '使用替代工具'
            break
          case 'simplify_task':
            strategyIcon = '📦'
            strategyLabel = '简化任务'
            break
          case 'skip':
            strategyIcon = '⏭️'
            strategyLabel = '跳过'
            break
          case 'starting':
            strategyIcon = '🚀'
            strategyLabel = '开始自纠正'
            break
        }
        
        const correctionLog = `[${time}] ${strategyIcon} ${strategyLabel}: ${explanation}`
        setTaskLogs(prev => [...prev, correctionLog])
        
        // 在聊天界面显示纠正过程
        const correctionMessage: Message = {
          id: `correction-${evt.timestamp}`,
          role: 'assistant',
          content: `${strategyIcon} **${strategyLabel}**\n\n${explanation}`,
          timestamp: new Date(),
          status: 'completed'
        }
        setMessages(prev => [...prev, correctionMessage])
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

    // 评估任务复杂度
    const complexity = assessTaskComplexity(input)
    console.log(`[Chat] 任务复杂度: ${complexity}, 内容: ${input.slice(0, 50)}...`)
    setTaskComplexity(complexity)

    // 根据复杂度选择系统
    const targetSystem = complexity === 'low' ? 'system1' : 'system2'
    handleSystemSwitch(targetSystem)
    
    // 后端 task.execute 会使用 MultiDialogueCoordinator 处理多智能体协作
    // 前端通过 progress 事件接收各个智能体的输出
    
    // 根据系统更新当前使用的模型名称
    if (targetSystem === 'system1') {
      setCurrentModelName('DeepSeek (快速响应)')
    } else {
      setCurrentModelName('豆包 (深度思考)')
    }

    let contentToSend = input
    if (attachments.length > 0) {
      const attachmentText = attachments.map(att => `[Attachment: ${att.path}]`).join('\n')
      contentToSend = `${input}\n\n${attachmentText}`.trim()
    }

    if (currentSession) {
      if (currentSession.type === 'direct' && currentSession.members.length > 0) {
        const agent = chatDataService.getAgent(currentSession.members[0])
        if (agent) {
          const personaInstruction = `\n\n<system_instruction>\nYour Persona: ${agent.name}\nDescription: ${agent.description}\nSystem Prompt: ${agent.systemPrompt}\nAct strictly according to this persona.\n</system_instruction>`
          contentToSend += personaInstruction
        }
      } else if (currentSession.type === 'group') {
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

    // 添加系统指示
    const systemInstruction = `\n\n<system_instruction>\nCurrent System: ${targetSystem === 'system1' ? 'System 1 (Fast)' : 'System 2 (Slow)'}\nTask Complexity: ${complexity}\nIf System 1, provide quick response and use cached knowledge.\nIf System 2, generate detailed plan and coordinate multiple agents.\n</system_instruction>`
    contentToSend += systemInstruction

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
    setShowTaskPreview(targetSystem === 'system2') // 系统2自动显示任务面板
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

      // 系统1快速响应模拟
      if (targetSystem === 'system1') {
        setSystem1Response('正在快速分析...')
        setShowSystem1Response(true)
        
        // 模拟系统1快速响应
        setTimeout(() => {
          setSystem1Response('已识别为简单任务，正在准备快速响应...')
        }, 300)
      }

      const thinkingMessage: Message = {
        id: `thinking-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        thinking: targetSystem === 'system1' ? '快速分析中...' : '深度思考中...'
      }
      setMessages(prev => [...prev, thinkingMessage])

      const agentId = currentSession && currentSession.members.length > 0 ? currentSession.members[0] : undefined
      const sessionId = currentSession ? currentSession.id : undefined
      
      // 统一使用 task.execute，让后端认知引擎决定使用 System1 还是 System2
      // 这样可以实现 LLM 意图判断来决定处理方式
      console.log(`[Chat] 使用 task.execute，后端将根据LLM意图判断决定处理方式`)
      const taskApi: any = window.electron.task
      const result = await taskApi.execute(contentToSend, { 
        agentId, 
        sessionId,
        system: targetSystem,
        complexity,
        taskDir: `/Users/wangchao/Desktop/${input.slice(0, 15).replace(/[^\\w]/g, '_')}`
      })
      
      setMessages(prev => prev.filter(msg => msg.id !== thinkingMessage.id))
      setShowSystem1Response(false)
      
      if (result.success) {
        const aiResponse: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
          status: 'completed'
        }
        setMessages(prev => [...prev, aiResponse])
        
        // 多对话框模式：当前智能体完成后，提示切换到下一个
        if (multiDialogueMode && dialogueSessions.length > 0) {
          const currentIndexVal = currentDialogueIndex
          const currentAgent = dialogueSessions[currentIndexVal]
          
          if (currentAgent && currentIndexVal < dialogueSessions.length - 1) {
            // 还有下一个对话框
            const nextIndex = currentIndexVal + 1
            const nextAgent = dialogueSessions[nextIndex]
            
            // 更新当前状态为完成
            setDialogueSessions(prev => prev.map((d, i) => 
              i === currentIndexVal ? { ...d, status: 'completed' } : d
            ))
            
            // 添加交接提示消息
            const handoffMessage: Message = {
              id: `handoff-${Date.now()}`,
              role: 'assistant',
              content: `✅ ${currentAgent.agentId} 已完成工作。\n\n🔄 正在切换到下一个对话框：${nextAgent.agentId}...\n\n请在侧边栏点击对应的对话框查看。`,
              timestamp: new Date(),
              status: 'completed'
            }
            setMessages(prev => [...prev, handoffMessage])
            
            // 突出显示下一个对话框（通过更新会话）
            setTimeout(() => {
              const nextSessionData = chatDataService.getSessions().find(s => s.id === nextAgent.sessionId)
              if (nextSessionData) {
                setCurrentSession(nextSessionData)
                setCurrentDialogueIndex(nextIndex)
                setRefreshKey(prev => prev + 1)
              }
            }, 2000)
          } else {
            // 所有对话框完成
            setDialogueSessions(prev => prev.map((d, i) => 
              i === currentIndexVal ? { ...d, status: 'completed' } : d
            ))
            
            const finalMessage: Message = {
              id: `final-${Date.now()}`,
              role: 'assistant',
              content: `🎉 所有智能体已完成协作任务！\n\n项目开发流程已完成。您可以：\n1. 点击侧边栏查看各个智能体的输出\n2. 继续与任何智能体对话了解更多细节\n3. 开始新的任务`,
              timestamp: new Date(),
              status: 'completed'
            }
            setMessages(prev => [...prev, finalMessage])
            setMultiDialogueMode(false)
          }
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      console.error('Failed to send message:', error)
      setMessages(prev => prev.filter(msg => !msg.thinking))
      setShowSystem1Response(false)
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

  // 智能任务复杂度评估 - 基于情绪直觉系统自动判断
  // System 1: 快速直觉响应 - 简单问答、文件操作、简单任务
  // System 2: 深度思考 - 复杂开发、架构设计、多步骤任务
  const assessTaskComplexity = (input: string): 'low' | 'medium' | 'high' => {
    const text = input.trim().toLowerCase()
    const length = text.length

    // ===== System 2 触发条件（深度思考任务）=====
    // 复杂开发类 - 这些必须用 System 2
    const complexDev = /(开发|构建|重构|实现|设计|架构|集成|部署|测试|bug|修复|优化|编程|代码|前端|后端|全栈)/i.test(text)
    // 界面/UI设计类
    const uiDesign = /(界面|页面|ui|ux|设计|原型|草图|界面)/i.test(text)
    // 创建项目/应用类
    const createApp = /(创建|开发|做一个|写一个|搭建|构建)/i.test(text)
    // 多步骤任务
    const multiStep = text.split(/和|然后|并且|以及|首先|其次|最后|再/).length >= 3
    // 技术复杂性
    const technical = /(api|框架|数据库|缓存|安全|性能|并发|分布式|微服务|容器|ci\/cd|机器学习|算法|组件|页面)/i.test(text)
    // 复杂需求
    const complexRequirements = length > 100 && (complexDev || uiDesign || createApp)

    // 重要：设计、开发类任务必须使用 System 2
    if (complexDev || uiDesign || createApp || complexRequirements || (technical && length > 80)) {
      if (length > 200 || multiStep) {
        return 'high'
      }
      return 'medium'
    }

    // ===== System 1 触发条件（快速直觉任务）=====
    // 简单问答类
    const simpleQA = /(什么是|怎么|如何|怎样|能不能|可以帮我|帮我|帮我看看|查看|查看一下|解释一下|说一说|告诉我)/i.test(text)
    // 简单操作类
    const simpleAction = /(创建文件夹|新建文件夹|写文件|保存文件|打开文件|删除文件|复制文件|移动文件)/i.test(text)
    // 简短请求
    const shortRequest = length < 50 && !/(开发|构建|实现|设计|架构)/i.test(text)
    // 单一任务
    const singleTask = text.split(/和|然后|并且|以及/).length <= 2

    // 如果是简单任务，使用 System 1
    if ((simpleQA && length < 150) || simpleAction || shortRequest || (singleTask && length < 80)) {
      return 'low'
    }

    // 默认使用 System 2 更安全
    return 'medium'
  }

  // 系统切换处理
  const handleSystemSwitch = (targetSystem: 'system1' | 'system2') => {
    setSystemState('switching')
    setTimeout(() => {
      setSystemState(targetSystem)
      setShowSystemIndicator(true)
      setTimeout(() => setShowSystemIndicator(false), 2000)
    }, 500)
  }

  // 上下文共享展示
  const [sharedContext, setSharedContext] = useState<any>({
    projectFiles: [],
    conversationHistory: [],
    currentState: {}
  })

  // 知识蒸馏反馈
  const [knowledgeDistillation, setKnowledgeDistillation] = useState({
    lastDistillation: null as Date | null,
    distilledItems: 0,
    system1Accuracy: 85
  })

  // 协同进化状态
  const [coevolutionState, setCoevolutionState] = useState({
    system1Performance: 0.75,
    system2Efficiency: 0.85,
    collaborationScore: 0.8
  })

  const handleScreenshot = async () => {
    try {
      const result = await window.electron.system.captureScreen()
      if (result.success && result.image) {
        const newAttachment: Attachment = {
          type: 'image',
          path: 'Screenshot', 
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
        path: file.path,
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

  return (
    <div 
      className="chat-page" 
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ChatSidebar 
        currentSessionId={currentSession?.id} 
        onSelectSession={setCurrentSession}
        refreshKey={refreshKey}
      />

      <div className="chat-main-wrapper">
        {/* Drag Overlay */}
        {isDragging && (
          <div className="drag-overlay">
            <div className="drag-overlay-content">
              拖入文件以添加到上下文
            </div>
          </div>
        )}

        {/* 双系统状态指示器 - 自动判断 */}
        {showSystemIndicator && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '10px 16px',
            borderRadius: '8px',
            backgroundColor: systemState === 'system1' ? '#4CAF50' : '#2196F3',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            {systemState === 'system1' ? '⚡️ 系统1 (快速响应) - 已自动激活' : '🧠 系统2 (深度思考) - 已自动激活'}
          </div>
        )}

        {/* 系统1快速响应区域 */}
        {showSystem1Response && (
          <div style={{
            position: 'fixed',
            bottom: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 20px',
            borderRadius: '12px',
            backgroundColor: 'rgba(76, 175, 80, 0.9)',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            ⚡️ {system1Response}
          </div>
        )}

        {/* Main Chat Area */}
        <div className="chat-container">
          {/* Header */}
          <div className="chat-header-bar">
            <div className="chat-header-title">
              {currentSession?.type === 'direct' ? '👤' : '👥'}
              {currentSession?.name || '新会话'}
              {multiDialogueMode && (
                <span style={{
                  marginLeft: '8px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '500',
                  backgroundColor: '#E8EAF6',
                  color: '#3F51B5'
                }}>
                  🔄 多对话框
                </span>
              )}
              <span style={{
                marginLeft: '12px',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '500',
                backgroundColor: systemState === 'system1' ? '#E8F5E9' : '#E3F2FD',
                color: systemState === 'system1' ? '#2E7D32' : '#1565C0'
              }}>
                {systemState === 'system1' ? '系统1' : '系统2'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* 自动系统指示器 - 显示当前激活的系统及使用的模型 */}
              <div style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: systemState === 'system1' ? '#E8F5E9' : '#E3F2FD',
                color: systemState === 'system1' ? '#2E7D32' : '#1565C0',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {systemState === 'switching' ? (
                  <>🔄 切换中...</>
                ) : systemState === 'system1' ? (
                  <>⚡ 系统1 · {currentModelName} <span style={{ fontSize: '10px', opacity: 0.7 }}>(自动)</span></>
                ) : (
                  <>🧠 系统2 · {currentModelName} <span style={{ fontSize: '10px', opacity: 0.7 }}>(自动)</span></>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-messages-area">
            {messages.length === 0 && !loading ? (
              <div className="chat-empty-state">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Trae" className="chat-empty-icon" />
                <div className="chat-empty-text">开始一个新的对话或任务</div>
              </div>
            ) : (
              messages.map(message => (
                <div key={message.id} className={`message-row ${message.role}`}>
                  <div className="message-avatar">
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
                  <div className="message-bubble">
                    {message.thinking && (
                      <div className="thinking-block">
                        <span>⚡️</span> {message.thinking}
                      </div>
                    )}
                    
                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="message-attachments">
                        {message.attachments.map((att, i) => (
                          att.type === 'image' ? (
                            <div key={i} style={{ width: '100px', height: '100px', borderRadius: '6px', overflow: 'hidden' }}>
                               {att.preview ? (
                                  <img src={att.preview} alt={att.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                               ) : (
                                  <ImageAttachment filePath={att.path} alt={att.name} />
                               )}
                            </div>
                          ) : (
                            <div key={i} style={{ 
                              fontSize: '12px', padding: '6px 10px', 
                              backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '6px',
                              display: 'flex', alignItems: 'center', gap: '6px'
                            }}>
                              {att.type === 'link' ? '🔗' : '📄'}
                              <span style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{att.name}</span>
                            </div>
                          )
                        ))}
                      </div>
                    )}

                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {message.content}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="chat-input-wrapper">
            {/* 系统1快速操作工具栏 */}
            {systemState === 'system1' && (
              <div style={{
                display: 'flex',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: '#f8f8f8',
                borderRadius: '8px 8px 0 0',
                borderBottom: '1px solid #e0e0e0'
              }}>
                <button 
                  onClick={() => {
                    setInput(prev => prev + '\n// 快速代码补全示例\nfunction helloWorld() {\n  console.log("Hello, World!");\n}\n');
                  }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                    background: 'white',
                    color: '#1d1d1f',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                  代码补全
                </button>
                <button 
                  onClick={() => {
                    setInput(prev => prev + '\n// 代码格式化\nconst formattedCode = code.replace(/\s+/g, " ").trim();\n');
                  }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                    background: 'white',
                    color: '#1d1d1f',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                  格式化
                </button>
                <button 
                  onClick={() => {
                    setInput(prev => prev + '\n// 常用代码片段\nconst fetchData = async (url) => {\n  try {\n    const response = await fetch(url);\n    const data = await response.json();\n    return data;\n  } catch (error) {\n    console.error("Error:", error);\n  }\n};\n');
                  }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                    background: 'white',
                    color: '#1d1d1f',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  代码片段
                </button>
                <button 
                  onClick={() => {
                    setInput(prev => prev + '\n// 快速问答示例\n// Q: 如何使用Promise？\n// A: const promise = new Promise((resolve, reject) => {\n//      setTimeout(() => resolve("Success"), 1000);\n//    });\n//    promise.then(result => console.log(result));\n');
                  }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                    background: 'white',
                    color: '#1d1d1f',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  快速问答
                </button>
              </div>
            )}

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="chat-attachments-preview">
                {attachments.map((att, index) => (
                  <div key={index} className="chat-attachment-tag">
                    {att.type === 'image' ? '🖼️' : att.type === 'link' ? '🔗' : '📄'} {att.name}
                    <span style={{ cursor: 'pointer', color: '#999' }} onClick={() => removeAttachment(index)}>×</span>
                  </div>
                ))}
              </div>
            )}

            <div className="chat-input-box">
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentSession?.type === 'group' ? "输入任务让团队协作..." : "输入消息..."}
                disabled={loading || !currentSession}
              />
              <div className="chat-toolbar">
                <div className="chat-tools-left">
                  <button className="chat-tool-btn" title="Add File" onClick={handleAddFile}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                      <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                  </button>
                  <button className="chat-tool-btn" title="Screenshot" onClick={handleScreenshot}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                  </button>
                </div>
                <div className="chat-tools-right">
                   {loading ? (
                      <button className="chat-tool-btn" title="Stop" onClick={handleCancelTask} style={{ color: '#ff3b30' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="6" y="6" width="12" height="12"></rect>
                        </svg>
                      </button>
                   ) : (
                      <button 
                        className="chat-tool-btn" 
                        title="Send" 
                        onClick={() => handleSendMessage()}
                        disabled={!input.trim() && attachments.length === 0}
                        style={{ color: (input.trim() || attachments.length > 0) ? '#0071e3' : '#ccc' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"></line>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                      </button>
                   )}
                   <button 
                      className="chat-tool-btn" 
                      title="Toggle Task Panel" 
                      onClick={() => setShowTaskPreview(v => !v)}
                      style={{ color: showTaskPreview ? '#0071e3' : '#86868b' }}
                   >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path>
                      </svg>
                   </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Task Sidebar */}
        {showTaskPreview && (
          <div className="task-sidebar">
            <div className="task-sidebar-header">
              <div className="task-sidebar-title">
                {systemState === 'system2' ? '系统2 - 任务规划中心' : '任务工作区'}
                {systemState === 'system2' && (
                  <span style={{
                    marginLeft: '12px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: '500',
                    backgroundColor: '#E3F2FD',
                    color: '#1565C0'
                  }}>
                    🧠 深度思考
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                 <div className="task-preview-tabs">
                    <div 
                      className={`task-preview-tab ${activeTab === 'progress' ? 'active' : ''}`}
                      onClick={() => setActiveTab('progress')}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      日志
                    </div>
                    <div 
                      className={`task-preview-tab ${activeTab === 'files' ? 'active' : ''}`}
                      onClick={() => setActiveTab('files')}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      文件
                    </div>
                    <div 
                      className={`task-preview-tab ${activeTab === 'history' ? 'active' : ''}`}
                      onClick={() => setActiveTab('history')}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      历史
                    </div>
                    {systemState === 'system2' && (
                      <div 
                        className={`task-preview-tab ${activeTab === 'agents' ? 'active' : ''}`}
                        onClick={() => setActiveTab('agents' as any)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        智能体
                      </div>
                    )}
                 </div>
                 <button className="task-preview-close" onClick={() => setShowTaskPreview(false)}>×</button>
              </div>
            </div>

            <div className="task-sidebar-content">
              {activeTab === 'progress' ? (
                <>
                  <div className="task-status-row">
                     <div className="task-status-icon">
                       {taskStatus === 'running' ? '⚡️' : taskStatus === 'done' ? '✅' : taskStatus === 'error' ? '❌' : '⏸'}
                     </div>
                     <div className="task-status-text">
                       <div className={`task-status-dot ${taskStatus === 'running' ? 'running' : taskStatus === 'done' ? 'success' : taskStatus === 'error' ? 'error' : ''}`}></div>
                       {taskStatus === 'running' ? '进行中' : taskStatus === 'done' ? '已完成' : taskStatus === 'error' ? '失败' : '空闲'}
                     </div>
                  </div>
                  <div className="task-preview-logs">
                    {taskLogs.length === 0 ? (
                      <div className="log-entry info">等待任务开始...</div>
                    ) : (
                      taskLogs.map((l, idx) => (
                        <div key={idx} className={`task-log-entry ${l.includes('失败') || l.includes('Error') ? 'error' : l.includes('完成') ? 'success' : ''}`}>
                          {l}
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </>
              ) : activeTab === 'files' ? (
                <div style={{ padding: '20px', color: '#86868b', fontSize: '13px', textAlign: 'center' }}>
                  暂无生成文件
                </div>
              ) : activeTab === 'history' ? (
                <div style={{ padding: '12px', overflow: 'auto', height: '100%' }}>
                  {taskHistory.length === 0 ? (
                    <div style={{ 
                      padding: '40px 20px', 
                      color: '#86868b', 
                      fontSize: '13px', 
                      textAlign: 'center' 
                    }}>
                      <div style={{ fontSize: '24px', marginBottom: '12px' }}>📋</div>
                      暂无任务历史记录
                      <div style={{ fontSize: '11px', marginTop: '8px', color: '#aaa' }}>
                        完成后自动保存
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {taskHistory.map((task, idx) => (
                        <div 
                          key={task.id}
                          style={{
                            padding: '12px',
                            borderRadius: '8px',
                            backgroundColor: '#f8f8f8',
                            borderLeft: `4px solid ${
                              task.status === 'done' ? '#4CAF50' : 
                              task.status === 'error' ? '#f44336' : '#FF9800'
                            }`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onClick={() => {
                            // 点击加载历史任务日志
                            setTaskLogs(task.logs || [])
                            setTaskTitle(task.title)
                            setTaskStatus(task.status as any)
                            setActiveTab('progress')
                          }}
                        >
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '6px'
                          }}>
                            <div style={{ 
                              fontSize: '13px', 
                              fontWeight: '500',
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {task.title || `任务 ${idx + 1}`}
                            </div>
                            <div style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: task.status === 'done' ? '#E8F5E9' : 
                                              task.status === 'error' ? '#FFEBEE' : '#FFF3E0',
                              color: task.status === 'done' ? '#2E7D32' : 
                                    task.status === 'error' ? '#C62828' : '#E65100'
                            }}>
                              {task.status === 'done' ? '✅ 完成' : 
                               task.status === 'error' ? '❌ 失败' : '⚡ 进行中'}
                            </div>
                          </div>
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#86868b',
                            display: 'flex',
                            justifyContent: 'space-between'
                          }}>
                            <span>{new Date(task.timestamp).toLocaleDateString('zh-CN')}</span>
                            <span>{task.logs?.length || 0} 条日志</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeTab === 'agents' ? (
                <div style={{ padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '500' }}>智能体协作状态</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: '#f5f5f5',
                      borderLeft: '4px solid #2196F3'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>代码生成智能体</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        状态: 就绪
                        <br />
                        模型: DeepSeek-Coder-7B
                        <br />
                        工具: 文件读写
                      </div>
                    </div>
                    <div style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: '#f5f5f5',
                      borderLeft: '4px solid #4CAF50'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>测试生成智能体</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        状态: 就绪
                        <br />
                        模型: 代码模型微调
                        <br />
                        工具: 运行测试
                      </div>
                    </div>
                    <div style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: '#f5f5f5',
                      borderLeft: '4px solid #FF9800'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>代码审查智能体</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        状态: 就绪
                        <br />
                        模型: 代码模型微调
                        <br />
                        工具: 静态分析
                      </div>
                    </div>
                    <div style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: '#f5f5f5',
                      borderLeft: '4px solid #9C27B0'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>文档生成智能体</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        状态: 就绪
                        <br />
                        模型: 通用模型
                        <br />
                        工具: 文件读写
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px', color: '#86868b', fontSize: '13px', textAlign: 'center' }}>
                  暂无数据
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* === 新增：推理可视化组件 === */}
      {showReasoningVisualizer && reasoningSteps.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          width: '400px',
          maxHeight: '500px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>推理过程</span>
            <button
              onClick={() => {
                setShowReasoningVisualizer(false)
                setReasoningSteps([])
              }}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#666'
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: '12px', maxHeight: '440px', overflow: 'auto' }}>
            <ReasoningVisualizer steps={reasoningSteps} isActive={taskStatus === 'running'} />
          </div>
        </div>
      )}
      
      {/* === 新增：干预审批弹窗 === */}
      <InterventionModal
        request={interventionRequest}
        onApprove={async (requestId: string, response?: string) => {
          console.log('[Chat] 批准干预请求:', requestId)
          setInterventionRequest(null)
          // 可以添加调用后端API来确认批准
        }}
        onDeny={async (requestId: string, reason?: string) => {
          console.log('[Chat] 拒绝干预请求:', requestId, reason)
          setInterventionRequest(null)
          // 可以添加调用后端API来确认拒绝
        }}
        onModify={async (requestId: string, modifiedValue: any, response?: string) => {
          console.log('[Chat] 修改干预请求:', requestId, modifiedValue)
          setInterventionRequest(null)
        }}
      />
      
      {/* 创建群组弹窗 */}
      {showCreateGroupModal && (
        <CreateGroupModal
          onClose={() => setShowCreateGroupModal(false)}
          onCreated={() => {
            setShowCreateGroupModal(false)
            setRefreshKey(prev => prev + 1)
          }}
        />
      )}
    </div>
  )
}

export default Chat