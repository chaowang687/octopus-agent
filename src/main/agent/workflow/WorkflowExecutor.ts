/**
 * Workflow Executor
 * 工作流执行器
 */

import { EventEmitter } from 'events'
import { WorkflowDefinition, WorkflowExecution, WorkflowNode } from './UnifiedWorkflowEngine'

export interface ExecutorOptions {
  timeout?: number
  retryCount?: number
}

export interface ExecuteCallbacks {
  onNodeExecute?: (nodeId: string, data: any) => void
}

export class WorkflowExecutor extends EventEmitter {
  private options: ExecutorOptions
  private runningExecutions: Map<string, AbortController> = new Map()

  constructor(options: ExecutorOptions = {}) {
    super()
    this.options = {
      timeout: options.timeout || 300000,
      retryCount: options.retryCount || 3
    }
  }

  /**
   * 执行工作流
   */
  async execute(
    workflow: WorkflowDefinition, 
    execution: WorkflowExecution,
    callbacks?: ExecuteCallbacks
  ): Promise<any> {
    // 找到开始节点
    const startNode = workflow.nodes.find(n => n.type === 'start')
    if (!startNode) {
      throw new Error('No start node found')
    }

    // 执行工作流
    return await this.executeNode(workflow, execution, startNode.id, callbacks)
  }

  /**
   * 执行节点
   */
  private async executeNode(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    nodeId: string,
    callbacks?: ExecuteCallbacks
  ): Promise<any> {
    const node = workflow.nodes.find(n => n.id === nodeId)
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`)
    }

    callbacks?.onNodeExecute?.(nodeId, node.data)

    try {
      switch (node.type) {
        case 'start':
          return await this.executeNext(workflow, execution, nodeId, callbacks)
        
        case 'task':
          return await this.executeTask(node, execution, callbacks)
        
        case 'condition':
          return await this.executeCondition(workflow, execution, node, callbacks)
        
        case 'loop':
          return await this.executeLoop(workflow, execution, node, callbacks)
        
        case 'parallel':
          return await this.executeParallel(workflow, execution, node, callbacks)
        
        case 'end':
          return execution.variables
        
        default:
          throw new Error(`Unknown node type: ${node.type}`)
      }
    } catch (error) {
      this.emit('error', { nodeId, error })
      throw error
    }
  }

  /**
   * 执行下一个节点
   */
  private async executeNext(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    nodeId: string,
    callbacks?: ExecuteCallbacks
  ): Promise<any> {
    const edges = workflow.edges.filter(e => e.source === nodeId)
    
    if (edges.length === 0) {
      // 没有后续节点，查找结束节点
      const endNode = workflow.nodes.find(n => n.type === 'end')
      if (endNode) {
        return await this.executeNode(workflow, execution, endNode.id, callbacks)
      }
      return execution.variables
    }

    // 执行第一个后续节点
    return await this.executeNode(workflow, execution, edges[0].target, callbacks)
  }

  /**
   * 执行任务节点
   */
  private async executeTask(
    node: WorkflowNode,
    execution: WorkflowExecution,
    callbacks?: ExecuteCallbacks
  ): Promise<any> {
    const { tool, parameters } = node.data
    
    if (tool) {
      // 执行工具
      // 这里需要调用工具注册表
      // const result = await toolRegistry.execute(tool, parameters)
      execution.variables['lastResult'] = { success: true }
    }

    return await this.executeNextByNode(execution, node.id, callbacks as ExecuteCallbacks)
  }

  /**
   * 执行条件节点
   */
  private async executeCondition(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    node: WorkflowNode,
    callbacks?: ExecuteCallbacks
  ): Promise<any> {
    const { condition } = node.data
    
    // 评估条件
    const result = this.evaluateCondition(condition, execution.variables)
    
    // 根据结果选择分支
    const edges = workflow.edges.filter(e => e.source === node.id)
    const trueEdge = edges.find(e => e.condition === 'true' || !e.condition)
    const falseEdge = edges.find(e => e.condition === 'false')
    
    const targetNodeId = result ? trueEdge?.target : falseEdge?.target
    
    if (targetNodeId) {
      return await this.executeNode(workflow, execution, targetNodeId, callbacks)
    }
    
    return execution.variables
  }

  /**
   * 执行循环节点
   */
  private async executeLoop(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    node: WorkflowNode,
    callbacks?: ExecuteCallbacks
  ): Promise<any> {
    const { maxIterations = 10 } = node.data
    const loopNodeId = node.data.loopNode
    
    for (let i = 0; i < maxIterations; i++) {
      execution.variables['loopIndex'] = i
      
      if (loopNodeId) {
        await this.executeNode(workflow, execution, loopNodeId, callbacks)
      }
    }
    
    return await this.executeNextByNode(execution, node.id, callbacks as ExecuteCallbacks)
  }

  /**
   * 执行并行节点
   */
  private async executeParallel(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    node: WorkflowNode,
    callbacks?: ExecuteCallbacks
  ): Promise<any> {
    const parallelNodeIds = node.data.parallelNodes || []
    
    const results = await Promise.all(
      parallelNodeIds.map(nodeId => 
        this.executeNode(workflow, execution, nodeId, callbacks)
      )
    )
    
    execution.variables['parallelResults'] = results
    
    return await this.executeNextByNode(execution, node.id, callbacks as ExecuteCallbacks)
  }

  /**
   * 评估条件
   */
  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    try {
      // 简单的条件评估
      // 实际应该使用更安全的表达式求值
      const keys = Object.keys(variables)
      const values = Object.values(variables)
      
      // eslint-disable-next-line no-new-func
      const fn = new Function(...keys, `return ${condition}`)
      return fn(...values)
    } catch {
      return false
    }
  }

  /**
   * 从节点执行下一个
   */
  private async executeNextByNode(
    execution: WorkflowExecution,
    nodeId: string,
    callbacks?: ExecuteCallbacks
  ): Promise<any> {
    // 这是一个占位符实现
    // 实际需要访问 workflow 对象
    return execution.variables
  }

  /**
   * 取消执行
   */
  cancel(executionId: string): void {
    const controller = this.runningExecutions.get(executionId)
    if (controller) {
      controller.abort()
      this.runningExecutions.delete(executionId)
    }
  }
}