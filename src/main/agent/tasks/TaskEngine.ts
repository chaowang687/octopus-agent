/**
 * Modular Task Engine
 * 模块化任务引擎 - 整合任务拆解、执行和调度
 * 
 * 支持旧版 API 兼容:
 * - executeTask(instruction, model, options)
 * - cancelTask()
 * - on('progress', callback)
 */

import { EventEmitter } from 'events'
import { TaskDecomposer } from './TaskDecomposer'
import { TaskExecutor } from './TaskExecutor'
import { TaskScheduler } from './TaskScheduler'
import { TaskState, createTaskStateManager } from '../TaskStateManager'
import { llmService } from '../../services/LLMService'
import { toolRegistry } from '../ToolRegistry'

export interface Task {
  id: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  steps: TaskStep[]
  createdAt: number
  updatedAt: number
  result?: any
  error?: string
  model?: string
  agentId?: string
  sessionId?: string
  system?: string
}

export interface TaskStep {
  id: string
  description: string
  tool?: string
  parameters?: any
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
}

export interface TaskOptions {
  maxConcurrent?: number
  timeout?: number
  retryCount?: number
  onProgress?: (progress: TaskProgress) => void
}

export interface TaskProgress {
  taskId: string
  stepId: string
  status: string
  progress: number
  result?: any
}

/**
 * 统一任务引擎
 * 整合任务拆解、执行和调度功能
 */
export class ModularTaskEngine extends EventEmitter {
  private decomposer: TaskDecomposer
  private executor: TaskExecutor
  private scheduler: TaskScheduler
  private tasks: Map<string, Task> = new Map()

  constructor(options: TaskOptions = {}) {
    super()
    
    this.decomposer = new TaskDecomposer()
    this.executor = new TaskExecutor(options)
    this.scheduler = new TaskScheduler(options)

    this.setupEventHandlers()
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.decomposer.on('step', (step) => this.emit('step', step))
    this.executor.on('progress', (progress) => this.emit('progress', progress))
    this.scheduler.on('task', (task) => this.emit('task', task))
  }

  /**
   * 执行任务 (新版 API)
   */
  async executeTask(description: string, options?: TaskOptions): Promise<Task> {
    return this._execute(description, undefined, options)
  }

  /**
   * 执行任务 (旧版 API 兼容)
   * @deprecated 请使用新版 API
   */
  async executeTaskWithModel(
    instruction: string, 
    model?: string, 
    options?: any
  ): Promise<any> {
    return this._execute(instruction, model, options)
  }

  /**
   * 内部执行方法
   */
  private async _execute(
    description: string, 
    model?: string, 
    options?: any
  ): Promise<Task> {
    const task: Task = {
      id: `task_${Date.now()}`,
      description,
      status: 'pending',
      priority: 'medium',
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: model || options?.model,
      agentId: options?.agentId,
      sessionId: options?.sessionId,
      system: options?.system
    }

    this.tasks.set(task.id, task)

    try {
      task.status = 'running'
      this.emit('task:start', task)

      // 发送进度事件 (兼容旧版)
      this.emitProgress({
        taskId: task.id,
        type: 'task_start',
        timestamp: Date.now(),
        requestedModel: model,
        modelUsed: model || 'default'
      })

      // 1. 拆解任务
      const steps = await this.decomposer.decompose(description)
      task.steps = steps
      this.emit('task:decomposed', task)

      this.emitProgress({
        taskId: task.id,
        type: 'plan_created',
        timestamp: Date.now(),
        planSteps: steps.map(s => ({ id: s.id, tool: s.tool || '', description: s.description }))
      })

      // 2. 执行任务
      const result = await this.executor.executeSteps(steps, options)
      
      // 3. 调度结果
      await this.scheduler.schedule(result)

      task.status = 'completed'
      task.result = result
      task.updatedAt = Date.now()
      this.emit('task:completed', task)

      // 发送完成事件 (兼容旧版)
      this.emitProgress({
        taskId: task.id,
        type: 'task_done',
        timestamp: Date.now(),
        final: true,
        resultSummary: JSON.stringify(result).substring(0, 200)
      })

      return task
    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : 'Unknown error'
      task.updatedAt = Date.now()
      this.emit('task:failed', task)

      // 发送错误事件 (兼容旧版)
      this.emitProgress({
        taskId: task.id,
        type: 'step_error',
        timestamp: Date.now(),
        error: task.error
      })

      return task
    }
  }

  /**
   * 发送进度事件 (兼容旧版)
   */
  private emitProgress(event: any): void {
    this.emit('progress', event)
    this.emit('task:progress', event)
  }

  /**
   * 取消任务 (新版 API)
   */
  cancelTask(taskId?: string): boolean {
    if (taskId) {
      return this._cancelById(taskId)
    }
    // 取消所有运行中的任务
    let cancelled = false
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'running') {
        cancelled = this._cancelById(id) || cancelled
      }
    }
    return cancelled
  }

  private _cancelById(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (task && task.status === 'running') {
      task.status = 'cancelled'
      task.updatedAt = Date.now()
      this.executor.cancel(taskId)
      this.emit('task:cancelled', task)
      
      // 发送取消事件 (兼容旧版)
      this.emitProgress({
        taskId: task.id,
        type: 'task_cancelled',
        timestamp: Date.now()
      })
      
      return true
    }
    return false
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values())
  }

  /**
   * 清理已完成的任务
   */
  cleanup(completedOlderThan?: number): number {
    const now = Date.now()
    let cleaned = 0

    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        if (!completedOlderThan || (now - task.updatedAt) > completedOlderThan) {
          this.tasks.delete(id)
          cleaned++
        }
      }
    }

    return cleaned
  }
}

// 导出单例
export const taskEngine = new ModularTaskEngine()