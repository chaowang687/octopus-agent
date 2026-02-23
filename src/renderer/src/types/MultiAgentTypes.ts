export type AgentType = 'pm' | 'ui' | 'dev' | 'test' | 'review'

export type AgentStatus = 'idle' | 'waiting' | 'working' | 'completed' | 'failed'

export type PhaseType = 
  | 'requirements' 
  | 'architecture' 
  | 'implementation' 
  | 'testing' 
  | 'review' 
  | 'handover'
  | 'pm_analysis'
  | 'ui_design'
  | 'dev_implementation'
  | 'dev_planning'
  | 'dev_fallback'
  | 'dev_manual_plan'
  | 'dev_planning_error'
  | 'fallback_strategy'
  | 'pm_delivery'
  | 'code_review'
  | 'reviewing'

export type MessageType = 'system' | 'response' | 'question' | 'handover' | 'warning'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'

export type Priority = 'low' | 'medium' | 'high'

export interface AgentMessage {
  agentId: string
  agentName: string
  role: string
  content: string
  timestamp: number
  phase: PhaseType
  messageType?: MessageType
  priority?: Priority
}

export interface AgentConfig {
  id: AgentType
  name: string
  role: string
  model: string
  systemPrompt: string
}

export interface AgentState {
  id: AgentType
  name: string
  role: string
  status: AgentStatus
  context: Record<string, any>
  lastOutput?: string
  iteration?: number
  model?: string
}

export interface ProgressDetail {
  phase: string
  agent?: string
  progress: number
  message?: string
  subTasks?: {
    name: string
    status: TaskStatus
    progress: number
  }[]
}

export interface SubTask {
  name: string
  status: TaskStatus
  progress: number
}

export interface CollaborationRequest {
  id: string
  taskId: string
  phase: PhaseType
  title: string
  description: string
  content: any
  alternatives?: string[]
  editableParams?: string[]
  timestamp: number
  status: 'pending' | 'approved' | 'rejected' | 'modified'
  userResponse?: string
  approvedOption?: string
  modifiedParams?: any
}

export interface StructuredOutput {
  agentName: string
  phase: string
  content: string
  nextSteps: string[]
  completedTasks: string[]
  outputFiles: string[]
}

export interface FileOutput {
  path: string
  name: string
  type: 'markdown' | 'code' | 'config' | 'other'
  size?: number
  createdAt: number
}

export interface ErrorInfo {
  agentId: string
  error: string
  timestamp: number
  round: number
  severity: 'critical' | 'major' | 'minor'
}

export interface TaskState {
  isPaused: boolean
  isCancelled: boolean
  currentPhase: PhaseType
  progress: number
  startTime?: number
  endTime?: number
}

export interface CollaborationEvent {
  type: 'collaboration:request' | 'collaboration:response' | 'session:updated' | 'decision:requested' | 'decision:completed'
  data: any
}

export interface PhaseConfig {
  name: string
  label: string
  color: string
  icon: string
  description: string
  agentType: AgentType
}

export const PHASE_CONFIG: Record<PhaseType, PhaseConfig> = {
  requirements: {
    name: 'requirements',
    label: '需求分析',
    color: '#8b5cf6',
    icon: '📋',
    description: '明确项目需求和目标',
    agentType: 'pm'
  },
  pm_analysis: {
    name: 'pm_analysis',
    label: '需求分析',
    color: '#8b5cf6',
    icon: '📋',
    description: '项目经理分析需求',
    agentType: 'pm'
  },
  architecture: {
    name: 'architecture',
    label: '架构设计',
    color: '#3b82f6',
    icon: '🏗️',
    description: '设计系统架构和技术选型',
    agentType: 'ui'
  },
  ui_design: {
    name: 'ui_design',
    label: 'UI设计',
    color: '#3b82f6',
    icon: '🎨',
    description: 'UI设计师设计界面',
    agentType: 'ui'
  },
  implementation: {
    name: 'implementation',
    label: '代码实现',
    color: '#10b981',
    icon: '⚙️',
    description: '实现具体功能代码',
    agentType: 'dev'
  },
  dev_implementation: {
    name: 'dev_implementation',
    label: '代码实现',
    color: '#10b981',
    icon: '⚙️',
    description: '开发工程师实现代码',
    agentType: 'dev'
  },
  dev_planning: {
    name: 'dev_planning',
    label: '开发规划',
    color: '#10b981',
    icon: '📝',
    description: '开发工程师规划工作',
    agentType: 'dev'
  },
  dev_fallback: {
    name: 'dev_fallback',
    label: '降级策略',
    color: '#f59e0b',
    icon: '⚠️',
    description: '使用降级策略执行',
    agentType: 'dev'
  },
  dev_manual_plan: {
    name: 'dev_manual_plan',
    label: '手动规划',
    color: '#8b5cf6',
    icon: '✏️',
    description: '使用手动干预的计划',
    agentType: 'dev'
  },
  dev_planning_error: {
    name: 'dev_planning_error',
    label: '规划错误',
    color: '#ef4444',
    icon: '❌',
    description: '开发规划失败',
    agentType: 'dev'
  },
  fallback_strategy: {
    name: 'fallback_strategy',
    label: '降级策略',
    color: '#f59e0b',
    icon: '⚠️',
    description: '使用降级策略',
    agentType: 'pm'
  },
  testing: {
    name: 'testing',
    label: '测试验证',
    color: '#f59e0b',
    icon: '🧪',
    description: '测试功能和质量验证',
    agentType: 'test'
  },
  review: {
    name: 'review',
    label: '代码审查',
    color: '#ef4444',
    icon: '✅',
    description: '代码审查和质量评估',
    agentType: 'review'
  },
  code_review: {
    name: 'code_review',
    label: '代码审查',
    color: '#ef4444',
    icon: '✅',
    description: '代码审查',
    agentType: 'review'
  },
  reviewing: {
    name: 'reviewing',
    label: '审查中',
    color: '#ef4444',
    icon: '🔍',
    description: '正在进行审查',
    agentType: 'review'
  },
  pm_delivery: {
    name: 'pm_delivery',
    label: '交付决策',
    color: '#10b981',
    icon: '📦',
    description: '项目经理决定是否交付',
    agentType: 'pm'
  },
  handover: {
    name: 'handover',
    label: '阶段交接',
    color: '#6b7280',
    icon: '🔄',
    description: '智能体之间交接任务',
    agentType: 'pm'
  }
}

export const AGENT_CONFIG: Record<AgentType, AgentConfig> = {
  pm: {
    id: 'pm',
    name: '项目经理',
    role: '需求分析、项目规划、进度管理、质量把控',
    model: 'deepseek-coder',
    systemPrompt: ''
  },
  ui: {
    id: 'ui',
    name: 'UI设计师',
    role: '界面视觉设计、交互体验优化',
    model: 'deepseek-coder',
    systemPrompt: ''
  },
  dev: {
    id: 'dev',
    name: '全栈开发工程师',
    role: '代码架构设计、实现与调试',
    model: 'deepseek-coder',
    systemPrompt: ''
  },
  test: {
    id: 'test',
    name: '测试工程师',
    role: '测试用例设计、测试执行、质量评估',
    model: 'deepseek-coder',
    systemPrompt: ''
  },
  review: {
    id: 'review',
    name: '代码审查员',
    role: '代码审查，安全分析，质量评估',
    model: 'deepseek-coder',
    systemPrompt: ''
  }
}
