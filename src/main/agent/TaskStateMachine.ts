/**
 * Task State Machine
 * 实现任务状态机与断点恢复
 */

import { TaskStateManager, TaskState } from './TaskStateManager';

export type TaskStatus = 'idle' | 'planning' | 'executing' | 'paused' | 'error' | 'completed';

export interface TaskEvent {
  type: 'start' | 'pause' | 'resume' | 'cancel' | 'complete' | 'error';
  data?: any;
}

export class TaskStateMachine {
  private stateManager: TaskStateManager;
  private currentState: TaskState;
  private status: TaskStatus = 'idle';

  constructor(taskId: string) {
    this.stateManager = new TaskStateManager();
    this.currentState = {
      taskId,
      currentStepId: '',
      variables: {},
      executionLog: [],
      status: 'idle'
    };
  }

  /**
   * 处理事件
   */
  handleEvent(event: TaskEvent): void {
    switch (event.type) {
      case 'start':
        this.transitionTo('planning');
        break;
      case 'pause':
        this.transitionTo('paused');
        break;
      case 'resume':
        this.transitionTo('executing');
        break;
      case 'cancel':
        this.transitionTo('idle');
        break;
      case 'complete':
        this.transitionTo('completed');
        break;
      case 'error':
        this.transitionTo('error', event.data);
        break;
    }
  }

  /**
   * 状态转换
   */
  private transitionTo(status: TaskStatus, error?: any): void {
    this.status = status;
    this.currentState.status = status as any;
    
    if (error) {
      this.currentState.error = error;
    }

    // 保存检查点
    this.stateManager.saveCheckpoint(this.currentState.taskId, this.currentState);
  }

  /**
   * 保存检查点
   */
  saveCheckpoint(): void {
    this.stateManager.saveCheckpoint(this.currentState.taskId, this.currentState);
  }

  /**
   * 恢复检查点
   */
  restoreCheckpoint(): void {
    const restoredState = this.stateManager.restoreCheckpoint(this.currentState.taskId);
    if (restoredState) {
      this.currentState = restoredState;
      this.status = restoredState.status as TaskStatus;
    }
  }

  /**
   * 获取当前状态
   */
  getCurrentState(): TaskState {
    return { ...this.currentState };
  }

  /**
   * 获取当前状态
   */
  getStatus(): TaskStatus {
    return this.status;
  }

  /**
   * 更新变量
   */
  updateVariables(variables: Record<string, any>): void {
    this.currentState.variables = { ...this.currentState.variables, ...variables };
  }

  /**
   * 添加日志
   */
  addLog(message: string): void {
    this.currentState.executionLog.push(message);
  }
}