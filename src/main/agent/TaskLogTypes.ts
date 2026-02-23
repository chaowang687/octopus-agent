export interface TaskLogEntry {
  id: string
  timestamp: number
  type: TaskLogType
  level: 'info' | 'warning' | 'error' | 'success'
  category: string
  message: string
  details?: any
  duration?: number
  parentStepId?: string
}

export type TaskLogType = 
  | 'task_start'
  | 'task_end'
  | 'iteration_start'
  | 'iteration_end'
  | 'llm_call'
  | 'llm_response'
  | 'tool_call'
  | 'tool_result'
  | 'think'
  | 'act'
  | 'observe'
  | 'error'
  | 'retry'
  | 'correction'
  | 'agent_message'
  | 'system_event'
  | 'routing'
  | 'distillation'

export interface ReActTraceLog {
  traceId: string
  taskId: string
  startTime: number
  endTime?: number
  totalDuration?: number
  success: boolean
  steps: ReActStepLog[]
  finalAnswer?: string
  error?: string
}

export interface ReActStepLog {
  stepId: string
  stepNumber: number
  type: 'think' | 'act' | 'observe' | 'final'
  timestamp: number
  duration?: number
  
  think?: {
    reasoning: string
    plan?: string
  }
  
  act?: {
    tool: string
    parameters: any
    description?: string
  }
  
  observe?: {
    result: any
    success: boolean
    error?: string
    artifacts?: string[]
  }
  
  llmCall?: {
    model: string
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
    latency: number
  }
}

export interface TaskExecutionLog {
  taskId: string
  projectName: string
  instruction: string
  originalInstruction: string
  taskDir: string
  startTime: number
  endTime?: number
  totalDuration?: number
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  
  routing: {
    targetSystem: 'system1' | 'system2'
    reasoning?: string
    confidence?: number
  }
  
  distillation?: {
    enabled: boolean
    skillName?: string
    cacheHit?: boolean
    knowledgeInjected?: boolean
  }
  
  iterations: IterationLog[]
  
  summary: {
    totalSteps: number
    totalToolCalls: number
    totalLLMCalls: number
    totalTokens: number
    errorCount: number
    retryCount: number
    correctionCount: number
  }
  
  logs: TaskLogEntry[]
}

export interface IterationLog {
  iterationNumber: number
  startTime: number
  endTime?: number
  duration?: number
  
  agents: AgentExecutionLog[]
  
  result: {
    completed: boolean
    delivered: boolean
    summary: string
  }
}

export interface AgentExecutionLog {
  agentId: string
  agentName: string
  agentRole: string
  startTime: number
  endTime?: number
  duration?: number
  
  phases: {
    planning?: ReActTraceLog
    execution?: ReActTraceLog
    review?: ReActTraceLog
  }
  
  outputs: {
    files?: string[]
    messages: string[]
    artifacts?: string[]
  }
  
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export interface TaskLogStorage {
  saveLog(log: TaskExecutionLog): Promise<void>
  loadLog(taskId: string): Promise<TaskExecutionLog | null>
  listLogs(limit?: number): Promise<TaskExecutionLog[]>
  deleteLog(taskId: string): Promise<void>
  searchLogs(query: string): Promise<TaskExecutionLog[]>
}
