/**
 * Workflow State Machine
 * 工作流状态机
 */

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'

export interface WorkflowState {
  status: WorkflowStatus
  currentNode?: string
  previousNode?: string
  error?: string
  metadata?: Record<string, any>
}

export class WorkflowStateMachine {
  private states: Map<string, WorkflowState> = new Map()

  /**
   * 创建状态
   */
  create(executionId: string, initialState?: Partial<WorkflowState>): void {
    this.states.set(executionId, {
      status: 'pending',
      ...initialState
    })
  }

  /**
   * 获取状态
   */
  get(executionId: string): WorkflowState | undefined {
    return this.states.get(executionId)
  }

  /**
   * 转换状态
   */
  transition(executionId: string, newStatus: WorkflowStatus, metadata?: Record<string, any>): boolean {
    const state = this.states.get(executionId)
    if (!state) {
      return false
    }

    // 验证状态转换是否有效
    if (!this.isValidTransition(state.status, newStatus)) {
      return false
    }

    state.status = newStatus
    if (metadata) {
      state.metadata = { ...state.metadata, ...metadata }
    }

    return true
  }

  /**
   * 验证状态转换
   */
  private isValidTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
    const validTransitions: Record<WorkflowStatus, WorkflowStatus[]> = {
      'pending': ['running', 'cancelled'],
      'running': ['completed', 'failed', 'cancelled', 'paused'],
      'paused': ['running', 'cancelled'],
      'completed': [],
      'failed': ['running'], // 允许重试
      'cancelled': []
    }

    return validTransitions[from]?.includes(to) || false
  }

  /**
   * 删除状态
   */
  delete(executionId: string): boolean {
    return this.states.delete(executionId)
  }

  /**
   * 清理所有状态
   */
  clear(): void {
    this.states.clear()
  }
}