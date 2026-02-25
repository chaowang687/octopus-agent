/**
 * Task Executor
 * 任务执行器 - 负责执行任务步骤
 */

import { EventEmitter } from 'events'
import { TaskStep, TaskProgress } from './TaskEngine'
import { toolRegistry } from '../ToolRegistry'

export interface ExecutorOptions {
  maxConcurrent?: number
  timeout?: number
  retryCount?: number
  onProgress?: (progress: TaskProgress) => void
}

export class TaskExecutor extends EventEmitter {
  private options: ExecutorOptions
  private runningTasks: Map<string, AbortController> = new Map()

  constructor(options: ExecutorOptions = {}) {
    super()
    this.options = {
      maxConcurrent: options.maxConcurrent || 3,
      timeout: options.timeout || 300000,
      retryCount: options.retryCount || 3,
      onProgress: options.onProgress
    }
  }

  /**
   * 执行任务步骤
   */
  async executeSteps(steps: TaskStep[], options?: ExecutorOptions): Promise<any[]> {
    const results: any[] = []
    const mergedOptions = { ...this.options, ...options }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      
      this.emitProgress(step.id, 'running', i / steps.length)

      try {
        const result = await this.executeStep(step, mergedOptions)
        step.status = 'completed'
        step.result = result
        results.push(result)
        
        this.emitProgress(step.id, 'completed', (i + 1) / steps.length, result)
      } catch (error) {
        step.status = 'failed'
        step.error = error instanceof Error ? error.message : 'Unknown error'
        results.push({ error: step.error })
        
        this.emitProgress(step.id, 'failed', i / steps.length, null, error)
        
        // 如果是严重错误，可以选择停止
        if (this.isCriticalError(error)) {
          break
        }
      }
    }

    return results
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: TaskStep, options: ExecutorOptions): Promise<any> {
    const controller = new AbortController()
    this.runningTasks.set(step.id, controller)

    try {
      // 如果有指定工具，使用工具执行
      if (step.tool) {
        const tool = toolRegistry.getTool(step.tool)
        if (tool) {
          return await this.executeWithTimeout(
            () => tool.handler(step.parameters || {}),
            options.timeout || 300000
          )
        }
      }

      // 否则返回默认结果
      return { success: true, message: 'Step completed' }
    } finally {
      this.runningTasks.delete(step.id)
    }
  }

  /**
   * 带超时的执行
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Execution timeout'))
      }, timeout)

      fn()
        .then(result => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }

  /**
   * 发送进度事件
   */
  private emitProgress(
    stepId: string, 
    status: string, 
    progress: number, 
    result?: any, 
    error?: any
  ): void {
    const progressEvent: TaskProgress = {
      taskId: '',
      stepId,
      status,
      progress,
      result
    }

    this.emit('progress', progressEvent)
    this.options.onProgress?.(progressEvent)
  }

  /**
   * 判断是否为严重错误
   */
  private isCriticalError(error: any): boolean {
    if (error instanceof Error) {
      const criticalPatterns = [
        'permission denied',
        'access denied',
        'authentication failed',
        'network error'
      ]
      return criticalPatterns.some(pattern => 
        error.message.toLowerCase().includes(pattern)
      )
    }
    return false
  }

  /**
   * 取消任务
   */
  cancel(taskId: string): void {
    const controller = this.runningTasks.get(taskId)
    if (controller) {
      controller.abort()
      this.runningTasks.delete(taskId)
    }
  }
}