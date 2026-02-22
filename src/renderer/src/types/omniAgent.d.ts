/**
 * 全能智能体管家前端类型定义
 */

export interface OmniAgentOptions {
  agentType?: 'general' | 'coding' | 'design' | 'analysis' | 'management' | 'creative'
  permissionLevel?: 'read_only' | 'execute' | 'modify' | 'admin' | 'super_admin'
  enableMultimodal?: boolean
  enableDeepReasoning?: boolean
  enableSelfCorrection?: boolean
  enableProjectContext?: boolean
  projectId?: string
  maxIterations?: number
  timeoutMs?: number
}

export interface OmniAgentResult {
  success: boolean
  taskId: string
  answer?: string
  reasoning?: string
  multimodalResult?: any
  reasoningResult?: any
  decisionTrace?: any
  artifacts?: {
    text?: string
    images?: string[]
    code?: string
    files?: Record<string, string>
  }
  statistics?: {
    totalDurationMs: number
    reasoningDurationMs: number
    multimodalDurationMs: number
    toolsUsed: string[]
    permissionsUsed: string[]
  }
  error?: string
}

export interface ProjectContext {
  projectId: string
  name: string
  path: string
  type: 'web' | 'mobile' | 'desktop' | 'api' | 'library'
  techStack: string[]
  lastModified: number
  metadata?: Record<string, any>
}

export interface TaskContext {
  taskId: string
  projectId?: string
  taskType: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  startTime: number
  deadline?: number
  metadata?: Record<string, any>
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  components: {
    reasoning: boolean
    multimodal: boolean
    cognitive: boolean
    tools: boolean
    permissions: boolean
    projects: boolean
  }
}