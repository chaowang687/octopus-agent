/**
 * 任务状态管理器
 * 提供任务暂停、继续、保存、恢复功能
 */

import * as fs from 'fs'
import * as path from 'path'

export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed'

export interface TaskState {
  id: string
  name: string
  instruction: string
  currentPhase: string
  phaseIndex: number
  status: TaskStatus
  
  // 各阶段结果
  analysisResult?: string
  designResult?: string
  codeResult?: string
  testResult?: string
  reviewResult?: string
  
  // 项目信息
  projectPath?: string
  projectType?: string
  projectName?: string
  
  // 创建和更新时间
  createdAt: number
  updatedAt: number
  
  // 智能体历史消息
  agentMessages: Array<{
    agentId: string
    agentName: string
    role: string
    content: string
    timestamp: number
    phase: string
  }>
}

export class TaskStateManager {
  private stateDir: string
  private currentTask: TaskState | null = null
  
  constructor(stateDir: string = path.join(process.cwd(), '.task-states')) {
    this.stateDir = stateDir
    this.ensureStateDir()
  }
  
  private ensureStateDir(): void {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true, mode: 0o755 })
    }
  }
  
  /**
   * 创建新任务
   */
  createTask(id: string, name: string, instruction: string): TaskState {
    const task: TaskState = {
      id,
      name,
      instruction,
      currentPhase: 'init',
      phaseIndex: 0,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentMessages: []
    }
    
    this.currentTask = task
    this.saveTask(task)
    return task
  }
  
  /**
   * 保存任务状态
   */
  saveTask(task: TaskState): void {
    task.updatedAt = Date.now()
    const filePath = path.join(this.stateDir, `${task.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(task, null, 2), 'utf-8')
    this.currentTask = task
  }
  
  /**
   * 加载任务状态
   */
  loadTask(id: string): TaskState | null {
    const filePath = path.join(this.stateDir, `${id}.json`)
    if (!fs.existsSync(filePath)) {
      return null
    }
    
    try {
      const data = fs.readFileSync(filePath, 'utf-8')
      const task = JSON.parse(data) as TaskState
      this.currentTask = task
      return task
    } catch (error) {
      console.error('[TaskStateManager] 加载任务失败:', error)
      return null
    }
  }
  
  /**
   * 获取当前任务
   */
  getCurrentTask(): TaskState | null {
    return this.currentTask
  }
  
  /**
   * 更新任务阶段
   */
  updatePhase(phase: string, phaseIndex: number): void {
    if (!this.currentTask) return
    this.currentTask.currentPhase = phase
    this.currentTask.phaseIndex = phaseIndex
    this.saveTask(this.currentTask)
  }
  
  /**
   * 保存阶段结果
   */
  savePhaseResult(phase: string, result: string): void {
    if (!this.currentTask) return
    
    switch (phase) {
      case 'analysis':
        this.currentTask.analysisResult = result
        break
      case 'design':
        this.currentTask.designResult = result
        break
      case 'implementation':
        this.currentTask.codeResult = result
        break
      case 'testing':
        this.currentTask.testResult = result
        break
      case 'review':
        this.currentTask.reviewResult = result
        break
    }
    
    this.saveTask(this.currentTask)
  }
  
  /**
   * 暂停任务
   */
  pauseTask(): boolean {
    if (!this.currentTask) return false
    this.currentTask.status = 'paused'
    this.saveTask(this.currentTask)
    return true
  }
  
  /**
   * 继续任务
   */
  resumeTask(): boolean {
    if (!this.currentTask) return false
    if (this.currentTask.status !== 'paused') return false
    this.currentTask.status = 'running'
    this.saveTask(this.currentTask)
    return true
  }
  
  /**
   * 更新任务状态
   */
  updateStatus(status: TaskStatus): void {
    if (!this.currentTask) return
    this.currentTask.status = status
    this.saveTask(this.currentTask)
  }
  
  /**
   * 添加智能体消息
   */
  addAgentMessage(message: {
    agentId: string
    agentName: string
    role: string
    content: string
    phase: string
  }): void {
    if (!this.currentTask) return
    
    this.currentTask.agentMessages.push({
      ...message,
      timestamp: Date.now()
    })
    this.saveTask(this.currentTask)
  }
  
  /**
   * 获取所有保存的任务
   */
  getAllTasks(): TaskState[] {
    try {
      const files = fs.readdirSync(this.stateDir)
      const tasks: TaskState[] = []
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = fs.readFileSync(path.join(this.stateDir, file), 'utf-8')
          tasks.push(JSON.parse(data))
        }
      }
      
      return tasks.sort((a, b) => b.updatedAt - a.updatedAt)
    } catch (error) {
      console.error('[TaskStateManager] 获取任务列表失败:', error)
      return []
    }
  }
  
  /**
   * 删除任务
   */
  deleteTask(id: string): boolean {
    const filePath = path.join(this.stateDir, `${id}.json`)
    if (!fs.existsSync(filePath)) return false
    
    try {
      fs.unlinkSync(filePath)
      if (this.currentTask?.id === id) {
        this.currentTask = null
      }
      return true
    } catch (error) {
      console.error('[TaskStateManager] 删除任务失败:', error)
      return false
    }
  }
  
  /**
   * 清除所有任务
   */
  clearAll(): void {
    try {
      const files = fs.readdirSync(this.stateDir)
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.stateDir, file))
        }
      }
      this.currentTask = null
    } catch (error) {
      console.error('[TaskStateManager] 清除任务失败:', error)
    }
  }
}
