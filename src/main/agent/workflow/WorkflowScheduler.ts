/**
 * Workflow Scheduler
 * 工作流调度器
 */

import { EventEmitter } from 'events'
import { WorkflowExecution, WorkflowOptions } from './UnifiedWorkflowEngine'

export class WorkflowScheduler extends EventEmitter {
  private queue: WorkflowExecution[] = []
  private running: Set<string> = new Set()
  private maxConcurrent: number

  constructor(options: WorkflowOptions = {}) {
    super()
    this.maxConcurrent = options.maxConcurrent || 3
  }

  /**
   * 调度工作流执行
   */
  async schedule(execution: WorkflowExecution): Promise<void> {
    this.queue.push(execution)
    this.emit('schedule:queued', execution)
    
    await this.processQueue()
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.running.size < this.maxConcurrent) {
      const execution = this.queue.shift()
      
      if (execution) {
        this.running.add(execution.id)
        this.emit('schedule:started', execution)
      }
    }
  }

  /**
   * 完成执行
   */
  complete(executionId: string): void {
    this.running.delete(executionId)
    this.processQueue()
  }

  /**
   * 获取队列状态
   */
  getStatus(): { queued: number; running: number } {
    return {
      queued: this.queue.length,
      running: this.running.size
    }
  }
}