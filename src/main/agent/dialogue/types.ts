export interface ProgressDetail {
  phase: string
  agent: string
  progress: number
  subTasks: {
    name: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    progress: number
  }[]
  message: string
}

export interface DialogueAgent {
  id: string
  name: string
  role: string
  model: string
  systemPrompt: string
}

export interface DialogueState {
  id: string
  name: string
  agent: DialogueAgent
  status: 'idle' | 'waiting' | 'working' | 'completed' | 'failed'
  context: Record<string, any>
  lastOutput?: string
  iteration?: number
}

export interface TestResult {
  passed: boolean
  issues: string[]
  severity: 'critical' | 'major' | 'minor'
}

export interface IterationRound {
  round: number
  pmAnalysis?: string
  uiOutput?: string
  devOutput?: string
  testResult?: TestResult
  reviewResult?: string
  delivered: boolean
}

export interface AgentExecutionCache {
  result: any
  timestamp: number
}

export interface FileCacheEntry {
  content: string
  timestamp: number
}

export interface ErrorRecord {
  agentId: string
  error: string
  timestamp: number
  round: number
}

export type ReasoningEngineType = 'enhanced-react' | 'thought-tree' | 'unified' | 'standard'

export interface ExecutionOptions {
  model?: string
  reasoningEngine?: ReasoningEngineType
  enableCache?: boolean
  timeout?: number
}

export interface AgentExecutionResult {
  success: boolean
  content?: string
  error?: string
  cached?: boolean
  executionTime?: number
}
