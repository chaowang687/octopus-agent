/**
 * 对话管理器类型定义
 */

import { OmniAgentResult, TaskType, PermissionLevel } from '../OmniAgent'

export interface MemoryEntry {
  id: string
  type: 'short' | 'medium' | 'long'
  content: any
  timestamp: number
  expiresAt?: number
  metadata?: Record<string, any>
}

// ============================================
// 会话相关类型
// ============================================

export interface Session {
  id: string
  userId: string
  projectId?: string
  createdAt: number
  updatedAt: number
  status: 'active' | 'inactive' | 'archived'
  metadata: SessionMetadata
}

export interface SessionMetadata {
  enableMemory: boolean
  enableIntentAnalysis: boolean
  maxHistorySize: number
  contextWindowSize: number
  customSettings?: Record<string, any>
}

export interface SessionOptions {
  projectId?: string
  enableMemory?: boolean
  enableIntentAnalysis?: boolean
  maxHistorySize?: number
  contextWindowSize?: number
  customSettings?: Record<string, any>
}

// ============================================
// 消息相关类型
// ============================================

export interface Message {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: MessageMetadata
}

export interface MessageMetadata {
  userId?: string
  projectId?: string
  intent?: string
  entities?: Entity[]
  taskType?: TaskType
  priority?: 'low' | 'medium' | 'high' | 'critical'
  confidence?: number
  processingTime?: number
}

export interface ProcessedMessage {
  original: string
  normalized: string
  intent: IntentAnalysis
  entities: Entity[]
  metadata: MessageMetadata
}

// ============================================
// 意图分析相关类型
// ============================================

export interface IntentAnalysis {
  primaryIntent: string
  secondaryIntents: string[]
  confidence: number
  taskType: TaskType
  priority: 'low' | 'medium' | 'high' | 'critical'
  requiresAction: boolean
  suggestedActions: string[]
}

export interface Entity {
  type: string
  value: string
  confidence: number
  start: number
  end: number
  metadata?: Record<string, any>
}

export type IntentType = 
  | 'question'
  | 'task'
  | 'request'
  | 'greeting'
  | 'farewell'
  | 'clarification'
  | 'confirmation'
  | 'correction'
  | 'unknown'

// ============================================
// 上下文相关类型
// ============================================

export interface ConversationContext {
  sessionId: string
  userId: string
  projectId?: string
  messages: Message[]
  currentTurn: number
  state: ConversationState
  relevantHistory: Message[]
  memoryContext: MemoryContext
}

export interface MemoryContext {
  shortTerm: MemoryEntry[]
  mediumTerm: MemoryEntry[]
  longTerm: MemoryEntry[]
}

// ============================================
// 状态相关类型
// ============================================

export interface ConversationState {
  sessionId: string
  currentPhase: string
  taskStatus: 'idle' | 'processing' | 'completed' | 'failed'
  lastIntent: string
  lastAction: string
  contextWindow: string[]
  metadata: StateMetadata
}

export interface StateMetadata {
  turnCount: number
  taskCount: number
  errorCount: number
  lastUpdated: number
}

export interface StateChange {
  sessionId: string
  from: string
  to: string
  timestamp: number
  reason: string
}

// ============================================
// 响应相关类型
// ============================================

export interface ConversationResponse {
  sessionId: string
  messageId: string
  content: string
  role: 'assistant'
  timestamp: number
  metadata: ResponseMetadata
}

export interface ResponseMetadata {
  intent: string
  taskType: TaskType
  processingTime: number
  reasoning?: string
  artifacts?: any
  actions?: ActionResult[]
  confidence: number
  memoryStored?: boolean
}

export interface ProcessedResult {
  original: OmniAgentResult
  formatted: FormattedOutput
  actions: ActionResult[]
  memoryEntries: MemoryEntry[]
}

export interface FormattedOutput {
  text: string
  markdown?: string
  html?: string
  codeBlocks?: CodeBlock[]
  tables?: Table[]
  images?: string[]
}

export interface CodeBlock {
  language: string
  code: string
  startLine: number
  endLine: number
}

export interface Table {
  headers: string[]
  rows: string[][]
  caption?: string
}

export interface ActionResult {
  type: string
  success: boolean
  result?: any
  error?: string
  timestamp: number
}

export interface Action {
  type: string
  parameters: Record<string, any>
  priority: 'low' | 'medium' | 'high'
}

// ============================================
// 验证相关类型
// ============================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  normalized?: string
}

// ============================================
// 配置相关类型
// ============================================

export interface ConversationManagerConfig {
  memoryService: any
  omniAgent: any
  maxHistorySize?: number
  contextWindowSize?: number
  enableIntentAnalysis?: boolean
  enableStateTracking?: boolean
  enableMemory?: boolean
  maxRetries?: number
  timeoutMs?: number
}

// ============================================
// 事件相关类型
// ============================================

export interface ConversationEvent {
  type: string
  sessionId: string
  timestamp: number
  data: any
}

export type ConversationEventType = 
  | 'session_created'
  | 'session_deleted'
  | 'message_received'
  | 'message_processed'
  | 'intent_analyzed'
  | 'context_updated'
  | 'state_changed'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'error'
  | 'memory_stored'
  | 'memory_retrieved'
  | 'history_cleared'
