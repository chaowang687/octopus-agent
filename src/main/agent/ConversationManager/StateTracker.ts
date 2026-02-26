/**
 * 状态跟踪器
 * 负责跟踪对话状态和任务状态
 */

import { EventEmitter } from 'events'
import { ConversationState, StateChange, StateMetadata } from './types'

export interface StateTrackerOptions {
  enableStateHistory?: boolean
  maxHistorySize?: number
}

export class StateTracker extends EventEmitter {
  private states: Map<string, ConversationState> = new Map()
  private stateHistory: Map<string, StateChange[]> = new Map()
  private enableStateHistory: boolean
  private maxHistorySize: number

  constructor(options: StateTrackerOptions = {}) {
    super()
    this.enableStateHistory = options.enableStateHistory !== false
    this.maxHistorySize = options.maxHistorySize || 100
  }

  updateState(sessionId: string, updates: Partial<ConversationState>): void {
    const currentState = this.getState(sessionId)
    const newState = this.mergeState(currentState, updates)

    if (currentState && this.hasStateChanged(currentState, newState)) {
      this.recordStateChange(sessionId, currentState.currentPhase, newState.currentPhase, 'state_update')
    }

    this.states.set(sessionId, newState)
    this.emit('state_updated', { sessionId, state: newState })
  }

  getState(sessionId: string): ConversationState | null {
    return this.states.get(sessionId) || null
  }

  initializeState(sessionId: string): ConversationState {
    const state: ConversationState = {
      sessionId,
      currentPhase: 'idle',
      taskStatus: 'idle',
      lastIntent: '',
      lastAction: '',
      contextWindow: [],
      metadata: {
        turnCount: 0,
        taskCount: 0,
        errorCount: 0,
        lastUpdated: Date.now()
      }
    }

    this.states.set(sessionId, state)
    this.emit('state_initialized', { sessionId, state })
    return state
  }

  detectChanges(sessionId: string): StateChange[] {
    const history = this.stateHistory.get(sessionId) || []
    return history.slice(-10)
  }

  recordStateChange(
    sessionId: string,
    from: string,
    to: string,
    reason: string
  ): void {
    if (!this.enableStateHistory) return

    if (!this.stateHistory.has(sessionId)) {
      this.stateHistory.set(sessionId, [])
    }

    const history = this.stateHistory.get(sessionId)!
    const change: StateChange = {
      sessionId,
      from,
      to,
      timestamp: Date.now(),
      reason
    }

    history.push(change)

    if (history.length > this.maxHistorySize) {
      history.shift()
    }

    this.emit('state_changed', change)
  }

  incrementTurnCount(sessionId: string): void {
    const state = this.getState(sessionId)
    if (state) {
      state.metadata.turnCount++
      state.metadata.lastUpdated = Date.now()
      this.states.set(sessionId, state)
    }
  }

  incrementTaskCount(sessionId: string): void {
    const state = this.getState(sessionId)
    if (state) {
      state.metadata.taskCount++
      state.metadata.lastUpdated = Date.now()
      this.states.set(sessionId, state)
    }
  }

  incrementErrorCount(sessionId: string): void {
    const state = this.getState(sessionId)
    if (state) {
      state.metadata.errorCount++
      state.metadata.lastUpdated = Date.now()
      this.states.set(sessionId, state)
    }
  }

  updateTaskStatus(
    sessionId: string,
    status: 'idle' | 'processing' | 'completed' | 'failed'
  ): void {
    const state = this.getState(sessionId)
    if (state) {
      const oldStatus = state.taskStatus
      state.taskStatus = status
      state.metadata.lastUpdated = Date.now()
      this.states.set(sessionId, state)

      if (oldStatus !== status) {
        this.recordStateChange(sessionId, oldStatus, status, 'task_status_change')
      }
    }
  }

  updateContextWindow(sessionId: string, messages: string[]): void {
    const state = this.getState(sessionId)
    if (state) {
      state.contextWindow = messages
      state.metadata.lastUpdated = Date.now()
      this.states.set(sessionId, state)
    }
  }

  clearState(sessionId: string): void {
    this.states.delete(sessionId)
    this.stateHistory.delete(sessionId)
    this.emit('state_cleared', { sessionId })
  }

  getAllStates(): ConversationState[] {
    return Array.from(this.states.values())
  }

  getStateCount(): number {
    return this.states.size
  }

  private mergeState(
    current: ConversationState | null,
    updates: Partial<ConversationState>
  ): ConversationState {
    if (!current) {
      return this.initializeState(updates.sessionId || '')
    }

    return {
      ...current,
      ...updates,
      metadata: {
        ...current.metadata,
        ...(updates.metadata || {})
      }
    }
  }

  private hasStateChanged(
    current: ConversationState,
    newState: ConversationState
  ): boolean {
    return (
      current.currentPhase !== newState.currentPhase ||
      current.taskStatus !== newState.taskStatus ||
      current.lastIntent !== newState.lastIntent ||
      current.lastAction !== newState.lastAction
    )
  }
}
