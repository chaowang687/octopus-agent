/**
 * Task State Manager
 * 实现任务状态管理和断点恢复
 */

export interface TaskState {
  taskId: string;
  currentStepId: string;
  variables: Record<string, any>;
  executionLog: string[];
  status: 'idle' | 'planning' | 'executing' | 'paused' | 'error' | 'completed';
  error?: string;
}

export interface TaskCheckpoint {
  taskId: string;
  currentStepId: string;
  variableSnapshot: Record<string, any>;
  executionLog: string[];
  timestamp: string;
}

export class TaskStateManager {
  private checkpoints: Map<string, TaskCheckpoint[]> = new Map();

  /**
   * 保存检查点
   */
  saveCheckpoint(taskId: string, state: TaskState): void {
    const checkpoint: TaskCheckpoint = {
      taskId,
      currentStepId: state.currentStepId,
      variableSnapshot: { ...state.variables },
      executionLog: [...state.executionLog],
      timestamp: new Date().toISOString()
    };

    if (!this.checkpoints.has(taskId)) {
      this.checkpoints.set(taskId, []);
    }

    const taskCheckpoints = this.checkpoints.get(taskId)!;
    taskCheckpoints.push(checkpoint);

    // 只保留最近10个检查点
    if (taskCheckpoints.length > 10) {
      taskCheckpoints.shift();
    }
  }

  /**
   * 恢复检查点
   */
  restoreCheckpoint(taskId: string): TaskState | null {
    const taskCheckpoints = this.checkpoints.get(taskId);
    if (!taskCheckpoints || taskCheckpoints.length === 0) {
      return null;
    }

    const latestCheckpoint = taskCheckpoints[taskCheckpoints.length - 1];

    return {
      taskId: latestCheckpoint.taskId,
      currentStepId: latestCheckpoint.currentStepId,
      variables: latestCheckpoint.variableSnapshot,
      executionLog: latestCheckpoint.executionLog,
      status: 'paused'
    };
  }

  /**
   * 获取任务历史
   */
  getTaskHistory(taskId: string): TaskCheckpoint[] {
    return this.checkpoints.get(taskId) || [];
  }

  /**
   * 清除任务检查点
   */
  clearCheckpoints(taskId: string): void {
    this.checkpoints.delete(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): string[] {
    return Array.from(this.checkpoints.keys());
  }
}

/**
 * 创建任务状态管理器实例
 */
export function createTaskStateManager(): TaskStateManager {
  return new TaskStateManager();
}