/**
 * Unified Workflow Engine
 * 统一工作流引擎 - 整合所有工作流相关功能
 */

import { EventEmitter } from 'events'
import { WorkflowExecutor } from './WorkflowExecutor'
import { WorkflowScheduler } from './WorkflowScheduler'
import { WorkflowStateMachine } from './WorkflowStateMachine'

export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  version?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables?: Record<string, any>
}

export interface WorkflowNode {
  id: string
  type: 'task' | 'condition' | 'loop' | 'parallel' | 'start' | 'end'
  data: any
  position?: { x: number; y: number }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  condition?: string
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  currentNode?: string
  variables: Record<string, any>
  result?: any
  error?: string
  startTime?: number
  endTime?: number
}

export interface WorkflowOptions {
  maxConcurrent?: number
  timeout?: number
  retryCount?: number
}

/**
 * 统一工作流引擎
 */
export class UnifiedWorkflowEngine extends EventEmitter {
  private executor: WorkflowExecutor
  private scheduler: WorkflowScheduler
  private stateMachine: WorkflowStateMachine
  private workflows: Map<string, WorkflowDefinition> = new Map()
  private executions: Map<string, WorkflowExecution> = new Map()

  constructor(options: WorkflowOptions = {}) {
    super()

    this.executor = new WorkflowExecutor(options)
    this.scheduler = new WorkflowScheduler(options)
    this.stateMachine = new WorkflowStateMachine()

    this.setupEventHandlers()
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.executor.on('node', (data) => this.emit('node', data))
    this.executor.on('edge', (data) => this.emit('edge', data))
    this.scheduler.on('schedule', (data) => this.emit('schedule', data))
  }

  /**
   * 注册工作流
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow)
    this.emit('workflow:registered', workflow)
  }

  /**
   * 获取工作流
   */
  getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id)
  }

  /**
   * 执行工作流
   */
  async execute(workflowId: string, input?: any): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`)
    }

    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}`,
      workflowId,
      status: 'running',
      variables: { ...workflow.variables, ...input },
      startTime: Date.now()
    }

    this.executions.set(execution.id, execution)

    try {
      this.emit('execution:start', execution)

      const result = await this.executor.execute(workflow, execution, {
        onNodeExecute: (nodeId, data) => {
          execution.currentNode = nodeId
          this.emit('node:execute', { executionId: execution.id, nodeId, data })
        }
      })

      execution.status = 'completed'
      execution.result = result
      execution.endTime = Date.now()
      this.emit('execution:complete', execution)

      return execution
    } catch (error) {
      execution.status = 'failed'
      execution.error = error instanceof Error ? error.message : 'Unknown error'
      execution.endTime = Date.now()
      this.emit('execution:failed', execution)

      return execution
    }
  }

  /**
   * 取消执行
   */
  cancel(executionId: string): boolean {
    const execution = this.executions.get(executionId)
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled'
      execution.endTime = Date.now()
      this.executor.cancel(executionId)
      this.emit('execution:cancelled', execution)
      return true
    }
    return false
  }

  /**
   * 获取执行状态
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId)
  }

  /**
   * 获取所有执行
   */
  getAllExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values())
  }

  /**
   * 验证工作流
   */
  validate(workflowId: string): { valid: boolean; errors: string[] } {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      return { valid: false, errors: ['Workflow not found'] }
    }

    const errors: string[] = []

    // 检查是否有开始和结束节点
    const hasStart = workflow.nodes.some(n => n.type === 'start')
    const hasEnd = workflow.nodes.some(n => n.type === 'end')
    if (!hasStart) errors.push('Missing start node')
    if (!hasEnd) errors.push('Missing end node')

    // 检查边的连接性
    const nodeIds = new Set(workflow.nodes.map(n => n.id))
    for (const edge of workflow.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push(`Invalid source node: ${edge.source}`)
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`Invalid target node: ${edge.target}`)
      }
    }

    return { valid: errors.length === 0, errors }
  }
}

export const unifiedWorkflowEngine = new UnifiedWorkflowEngine()