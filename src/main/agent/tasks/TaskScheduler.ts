/**
 * Task Scheduler
 * 任务调度器 - 负责任务调度和资源管理
 */

import { EventEmitter } from 'events'
import { TaskOptions, Task } from './TaskEngine'

export interface ScheduleOptions {
  maxConcurrent?: number
  priority?: boolean
}

export class TaskScheduler extends EventEmitter {
  private queue: Task[] = []
  private running: Set<string> = new Set()
  private maxConcurrent: number
  private priority: boolean

  constructor(options: TaskOptions = {}) {
    super()
    this.maxConcurrent = options.maxConcurrent || 3
    this.priority = options.priority || false
  }

  /**
   * 调度任务
   */
  async schedule(task: Task): Promise<void> {
    this.queue.push(task)
    this.emit('task:queued', task)
    
    await this.processQueue()
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.running.size < this.maxConcurrent) {
      const task = this.priority 
        ? this.queue.shift() 
        : this.queue.pop()
      
      if (task) {
        this.running.add(task.id)
        this.executeTask(task)
      }
    }
  }

  /**
   * 执行任务
   */
  private async executeTask(task: Task): Promise<void> {
    this.emit('task:started', task)
    
    try {
      // 任务执行逻辑
      await this.runTask(task)
      
      this.running.delete(task.id)
      this.emit('task:completed', task)
    } catch (error) {
      this.running.delete(task.id)
      this.emit('task:failed', { task, error })
    }

    // 继续处理队列
    await this.processQueue()
  }

  /**
   * 运行任务（子类可以重写）
   */
  protected async runTask(task: Task): Promise<void> {
    // 默认实现，可以被重写
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): { queued: number; running: number; maxConcurrent: number } {
    return {
      queued: this.queue.length,
      running: this.running.size,
      maxConcurrent: this.maxConcurrent
    }
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = []
    this.emit('queue:cleared')
  }

  /**
   * 设置最大并发数
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max
  }
}