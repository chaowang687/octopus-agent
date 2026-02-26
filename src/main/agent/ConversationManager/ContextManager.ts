/**
 * 上下文管理器
 * 负责管理对话历史、会话状态和上下文窗口
 */

import { EventEmitter } from 'events'
import { Message, ConversationContext, MemoryContext } from './types'

export interface ContextManagerOptions {
  maxHistorySize?: number
  contextWindowSize?: number
  enableRelevanceScoring?: boolean
}

export class ContextManager extends EventEmitter {
  private sessions: Map<string, Message[]> = new Map()
  private maxHistorySize: number
  private contextWindowSize: number
  private enableRelevanceScoring: boolean

  constructor(options: ContextManagerOptions = {}) {
    super()
    this.maxHistorySize = options.maxHistorySize || 100
    this.contextWindowSize = options.contextWindowSize || 20
    this.enableRelevanceScoring = options.enableRelevanceScoring !== false
  }

  addMessage(sessionId: string, message: Message): void {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, [])
    }

    const history = this.sessions.get(sessionId)!
    history.push(message)

    if (history.length > this.maxHistorySize) {
      history.shift()
    }

    this.emit('message_added', { sessionId, message })
  }

  getContext(sessionId: string, windowSize?: number): ConversationContext {
    const history = this.sessions.get(sessionId) || []
    const size = windowSize || this.contextWindowSize

    const contextWindow = history.slice(-size)
    const relevantHistory = this.enableRelevanceScoring
      ? this.getRelevantHistory(sessionId, contextWindow)
      : contextWindow

    return {
      sessionId,
      userId: history[0]?.metadata?.userId || 'unknown',
      projectId: history[0]?.metadata?.projectId,
      messages: history,
      currentTurn: history.length,
      state: {
        sessionId,
        currentPhase: 'active',
        taskStatus: 'idle',
        lastIntent: '',
        lastAction: '',
        contextWindow: contextWindow.map(m => m.content),
        metadata: {
          turnCount: history.length,
          taskCount: 0,
          errorCount: 0,
          lastUpdated: Date.now()
        }
      },
      relevantHistory,
      memoryContext: {
        shortTerm: [],
        mediumTerm: [],
        longTerm: []
      }
    }
  }

  getRelevantHistory(sessionId: string, query: string | Message[]): Message[] {
    const history = this.sessions.get(sessionId) || []
    
    if (typeof query === 'string') {
      const keywords = this.extractKeywords(query)
      return history
        .filter(msg => 
          keywords.some(keyword => 
            msg.content.toLowerCase().includes(keyword.toLowerCase())
          )
        )
        .slice(-10)
    } else {
      return query
    }
  }

  manageWindow(sessionId: string, maxSize: number): void {
    const history = this.sessions.get(sessionId)
    if (!history) return

    if (history.length > maxSize) {
      const removed = history.splice(0, history.length - maxSize)
      this.emit('window_pruned', { sessionId, removed })
    }
  }

  clearHistory(sessionId: string): void {
    this.sessions.delete(sessionId)
    this.emit('history_cleared', { sessionId })
  }

  getHistory(sessionId: string, limit?: number): Message[] {
    const history = this.sessions.get(sessionId) || []
    return limit ? history.slice(-limit) : history
  }

  getSessionCount(): number {
    return this.sessions.size
  }

  getTotalMessages(): number {
    let total = 0
    this.sessions.forEach(history => {
      total += history.length
    })
    return total
  }

  private extractKeywords(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1)

    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'or', 'but',
      '的', '是', '在', '和', '与', '或', '但是', '这', '那'
    ])

    return words.filter(word => !stopWords.has(word))
  }
}
