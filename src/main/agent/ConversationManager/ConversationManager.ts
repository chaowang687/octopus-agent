/**
 * 对话管理器核心
 * 整合所有组件，提供完整的对话管理功能
 * 对标MiniMax Agent
 */

import { EventEmitter } from 'events'
import { OmniAgent, OmniAgentOptions, OmniAgentResult } from '../OmniAgent'
import { ContextManager } from './ContextManager'
import { IntentAnalyzer } from './IntentAnalyzer'
import { StateTracker } from './StateTracker'
import { ResultProcessor } from './ResultProcessor'
import {
  Session,
  SessionOptions,
  Message,
  ConversationResponse,
  ConversationManagerConfig,
  ConversationEvent,
  ConversationEventType
} from './types'

export class ConversationManager extends EventEmitter {
  private omniAgent: OmniAgent
  private contextManager: ContextManager
  private intentAnalyzer: IntentAnalyzer
  private stateTracker: StateTracker
  private resultProcessor: ResultProcessor
  private memoryService: any
  private sessions: Map<string, Session> = new Map()
  private config: ConversationManagerConfig

  constructor(config: ConversationManagerConfig) {
    super()
    
    this.config = config
    this.omniAgent = config.omniAgent
    this.memoryService = config.memoryService
    
    this.contextManager = new ContextManager({
      maxHistorySize: config.maxHistorySize || 100,
      contextWindowSize: config.contextWindowSize || 20,
      enableRelevanceScoring: true
    })
    
    this.intentAnalyzer = new IntentAnalyzer({
      enableEntityExtraction: true,
      enableConfidenceScoring: true,
      model: 'gpt-4o-mini'
    })
    
    this.stateTracker = new StateTracker({
      enableStateHistory: true,
      maxHistorySize: 100
    })
    
    this.resultProcessor = new ResultProcessor({
      enableMarkdown: true,
      enableCodeHighlighting: true,
      enableActionExecution: true
    })

    this.setupEventListeners()
  }

  async createSession(userId: string, options?: SessionOptions): Promise<Session> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    
    const session: Session = {
      id: sessionId,
      userId,
      projectId: options?.projectId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'active',
      metadata: {
        enableMemory: options?.enableMemory ?? true,
        enableIntentAnalysis: options?.enableIntentAnalysis ?? true,
        maxHistorySize: options?.maxHistorySize || 100,
        contextWindowSize: options?.contextWindowSize || 20,
        customSettings: options?.customSettings
      }
    }

    this.sessions.set(sessionId, session)
    this.stateTracker.initializeState(sessionId)

    this.emitEvent('session_created', sessionId, { session })

    return session
  }

  async processMessage(sessionId: string, message: string): Promise<ConversationResponse> {
    const startTime = Date.now()

    try {
      const session = this.getSession(sessionId)
      if (!session) {
        throw new Error(`Session ${sessionId} not found`)
      }

      this.emitEvent('message_received', sessionId, { message })

      const userMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        sessionId,
        role: 'user',
        content: message,
        timestamp: Date.now(),
        metadata: {
          userId: session.userId,
          projectId: session.projectId
        }
      }

      this.contextManager.addMessage(sessionId, userMessage)

      const intent = session.metadata.enableIntentAnalysis
        ? await this.intentAnalyzer.analyze(message)
        : null

      if (intent) {
        this.emitEvent('intent_analyzed', sessionId, { intent })
      }

      const context = this.contextManager.getContext(sessionId)
      this.stateTracker.updateState(sessionId, {
        lastIntent: intent?.primaryIntent || 'unknown',
        currentPhase: 'processing',
        taskStatus: 'processing'
      })

      this.stateTracker.incrementTurnCount(sessionId)

      const omniAgentOptions: OmniAgentOptions = {
        projectId: session.projectId,
        enableDeepReasoning: intent?.taskType === 'complex_reasoning',
        enableSelfCorrection: true,
        maxIterations: 20
      }

      const result = await this.omniAgent.executeTask(message, omniAgentOptions)

      this.stateTracker.updateTaskStatus(sessionId, result.success ? 'completed' : 'failed')

      if (!result.success) {
        this.stateTracker.incrementErrorCount(sessionId)
      }

      this.stateTracker.incrementTaskCount(sessionId)

      const processedResult = await this.resultProcessor.process(result, context)

      if (session.metadata.enableMemory && this.memoryService) {
        await this.storeMemories(sessionId, processedResult, context)
      }

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        sessionId,
        role: 'assistant',
        content: processedResult.formatted.text,
        timestamp: Date.now(),
        metadata: {
          intent: intent?.primaryIntent,
          taskType: intent?.taskType,
          confidence: intent?.confidence,
          processingTime: Date.now() - startTime
        }
      }

      this.contextManager.addMessage(sessionId, assistantMessage)

      const response: ConversationResponse = {
        sessionId,
        messageId: assistantMessage.id,
        content: processedResult.formatted.text,
        role: 'assistant',
        timestamp: Date.now(),
        metadata: {
          intent: intent?.primaryIntent || 'unknown',
          taskType: intent?.taskType || 'text_processing' as any,
          processingTime: Date.now() - startTime,
          reasoning: result.reasoning,
          artifacts: result.artifacts,
          actions: processedResult.actions,
          confidence: intent?.confidence || 0.8,
          memoryStored: session.metadata.enableMemory
        }
      }

      this.emitEvent('message_processed', sessionId, { response, result: processedResult })

      return response
    } catch (error: any) {
      this.emitEvent('error', sessionId, { error: error.message })
      throw error
    }
  }

  getSession(sessionId: string): Session | null {
    return this.sessions.get(sessionId) || null
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
    this.contextManager.clearHistory(sessionId)
    this.stateTracker.clearState(sessionId)
    this.emitEvent('session_deleted', sessionId, {})
  }

  getHistory(sessionId: string, limit?: number): Message[] {
    return this.contextManager.getHistory(sessionId, limit)
  }

  async clearHistory(sessionId: string): Promise<void> {
    this.contextManager.clearHistory(sessionId)
    this.stateTracker.initializeState(sessionId)
    this.emitEvent('history_cleared', sessionId, {})
  }

  getSessionCount(): number {
    return this.sessions.size
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values())
  }

  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active')
  }

  async storeMemories(
    sessionId: string,
    processedResult: any,
    context: any
  ): Promise<void> {
    if (!this.memoryService) return

    try {
      for (const entry of processedResult.memoryEntries) {
        await this.memoryService.store(
          entry.content,
          entry.type,
          {
            sessionId,
            timestamp: entry.timestamp
          }
        )
      }

      this.emitEvent('memory_stored', sessionId, { count: processedResult.memoryEntries.length })
    } catch (error: any) {
      this.emitEvent('error', sessionId, { error: `Memory storage failed: ${error.message}` })
    }
  }

  private setupEventListeners(): void {
    this.contextManager.on('message_added', (data) => {
      this.emit('context_updated', data)
    })

    this.intentAnalyzer.on('intent_analyzed', (data) => {
      this.emit('intent_detected', data)
    })

    this.stateTracker.on('state_changed', (data) => {
      this.emit('state_changed', data)
    })

    this.resultProcessor.on('result_processed', (data) => {
      this.emit('result_ready', data)
    })
  }

  private emitEvent(
    type: ConversationEventType,
    sessionId: string,
    data: any
  ): void {
    const event: ConversationEvent = {
      type,
      sessionId,
      timestamp: Date.now(),
      data
    }

    this.emit('event', event)
    this.emit(type, event)
  }

  async shutdown(): Promise<void> {
    const sessions = this.getAllSessions()
    for (const session of sessions) {
      await this.deleteSession(session.id)
    }
    this.removeAllListeners()
  }
}
