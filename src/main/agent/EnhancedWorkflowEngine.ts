import { toolRegistry } from './ToolRegistry'
import { taskLogger } from './TaskLogger'

// 类型定义，避免直接依赖reactflow
export interface Node {
  id: string
  type: string
  data: any
  position: { x: number; y: number }
}

export interface Edge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

// 工作流执行状态
export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// 工作流执行结果
export interface WorkflowResult {
  status: WorkflowStatus
  outputs: Record<string, any>
  errors?: string[]
}

// 工作流节点执行上下文
export interface WorkflowNodeContext {
  nodeId: string
  nodeType: string
  inputs: Record<string, any>
  outputs: Record<string, any>
}

export class EnhancedWorkflowEngine {
  private nodes: Node[]
  private edges: Edge[]
  private executionResults: Record<string, any> = {}
  private status: WorkflowStatus = WorkflowStatus.PENDING
  private errors: string[] = []
  private isPaused: boolean = false
  private pausePromise: { resolve: () => void } | null = null

  constructor(nodes: Node[], edges: Edge[]) {
    this.nodes = nodes
    this.edges = edges
  }

  // 执行工作流
  async execute(taskId: string = `workflow_${Date.now()}`): Promise<WorkflowResult> {
    // 确保数组和对象正确初始化
    this.executionResults = this.executionResults || {}
    this.errors = this.errors || []
    this.status = WorkflowStatus.RUNNING

    try {
      console.log(`[EnhancedWorkflowEngine] 开始执行工作流，节点数: ${this.nodes?.length || 0}, 边数: ${this.edges?.length || 0}`)

      if (!this.nodes || this.nodes.length === 0) {
        throw new Error('工作流没有节点')
      }

      // 记录工作流开始
      try {
        taskLogger.startTask({
          taskId,
          projectName: 'Workflow Execution',
          instruction: 'Workflow execution initiated',
          originalInstruction: 'Workflow execution initiated',
          taskDir: './temp'
        })
      } catch (e) {
        console.warn('[EnhancedWorkflowEngine] 记录日志失败:', e)
      }

      // 按拓扑顺序执行节点
      const executionOrder = this.getExecutionOrder()
      console.log(`[EnhancedWorkflowEngine] 执行顺序: ${executionOrder.join(' -> ')}`)

      for (const nodeId of executionOrder) {
        const node = this.nodes.find(n => n.id === nodeId)
        if (!node) {
          console.warn(`[EnhancedWorkflowEngine] 跳过未找到的节点: ${nodeId}`)
          continue
        }

        try {
          await this.executeNode(node)
        } catch (nodeError) {
          console.error(`[EnhancedWorkflowEngine] 节点 ${node.id} 执行失败:`, nodeError)
          // 继续执行而不是中断
          this.errors = this.errors || []
          this.errors.push(`节点 ${node.id} 执行失败: ${(nodeError as Error).message}`)
        }
      }

      this.status = this.errors && this.errors.length > 0 ? WorkflowStatus.FAILED : WorkflowStatus.COMPLETED
      
      console.log(`[EnhancedWorkflowEngine] 工作流执行完成，状态: ${this.status}, 错误数: ${this.errors?.length || 0}`)
      
      // 记录工作流完成
      try {
        taskLogger.endTask(this.status === WorkflowStatus.COMPLETED ? 'completed' : 'failed')
      } catch (e) {
        console.warn('[EnhancedWorkflowEngine] 记录日志失败:', e)
      }
      
      return {
        status: this.status,
        outputs: this.executionResults || {},
        errors: this.errors
      }
    } catch (error) {
      this.status = WorkflowStatus.FAILED
      const errorMsg = (error as Error).message
      
      // 确保errors数组存在
      this.errors = this.errors || []
      this.errors.push(errorMsg)
      
      console.error('[EnhancedWorkflowEngine] 工作流执行失败:', error)
      
      // 记录工作流失败
      try {
        taskLogger.endTask('failed')
      } catch (e) {
        console.warn('[EnhancedWorkflowEngine] 记录日志失败:', e)
      }
      
      return {
        status: this.status,
        outputs: this.executionResults || {},
        errors: this.errors
      }
    }
  }

  // 执行单个节点
  private async executeNode(node: Node): Promise<void> {
    // 确保errors数组存在
    this.errors = this.errors || []
    
    // 检查是否暂停
    await this.checkPause()
    
    const nodeData = node.data as any
    const toolName = this.getToolNameFromNodeType(nodeData.type)
    
    console.log(`[EnhancedWorkflowEngine] 执行节点: ${node.id}, 类型: ${nodeData.type}, 工具: ${toolName}`)
    
    const tool = toolRegistry.getTool(toolName)

    if (!tool) {
      const errorMsg = `工具 ${toolName} 未注册`
      this.errors.push(errorMsg)
      console.error(`[EnhancedWorkflowEngine] ${errorMsg}`)
      try {
        taskLogger.logError(errorMsg, { nodeId: node.id, toolName })
      } catch (e) {
        console.warn('[EnhancedWorkflowEngine] 记录日志失败:', e)
      }
      return
    }

    // 获取输入参数
    const inputs = this.getNodeInputs(node.id)
    console.log(`[EnhancedWorkflowEngine] 节点输入参数:`, inputs)

    // 记录节点开始执行
    try {
      taskLogger.startAgent({
        agentId: node.id,
        agentName: nodeData.label || node.id,
        agentRole: nodeData.type || node.type || 'workflow_node',
        iterationNumber: 1
      })
    } catch (e) {
      console.warn('[EnhancedWorkflowEngine] 记录日志失败:', e)
    }

    console.log(`执行节点 ${node.id} (${toolName})，输入参数:`, inputs)

    try {
      // 构建完整的参数
      let toolArgs: any = { ...inputs }
      
      // 特殊处理框智能体节点
      if (nodeData.type === 'boxNode') {
        toolArgs = {
          title: nodeData.label || '框智能体',
          processingRule: nodeData.processingRule,
          inputFiles: (nodeData.inputContent || []).map((item: any) => item.path).filter(Boolean),
          outputDir: nodeData.outputDir,
          model: nodeData.model || 'qwen3',
          ...inputs
        }
      }

      // 特殊处理prompt节点
      if (nodeData.type === 'prompt') {
        toolArgs = {
          input: nodeData.input || '',
          model: nodeData.model || 'qwen3',
          systemPrompt: nodeData.systemPrompt || '',
          ...inputs
        }
        console.log(`[EnhancedWorkflowEngine] Prompt节点参数:`, { model: toolArgs.model, inputLength: toolArgs.input.length })
      }

      // 调用工具
      const startTime = Date.now()
      console.log(`[EnhancedWorkflowEngine] 开始执行工具: ${toolName}`)
      const result = await tool.handler(toolArgs)
      const endTime = Date.now()
      const latency = endTime - startTime
      
      this.executionResults[node.id] = result
      
      // 记录节点执行成功
      try {
        const normalizedResult = typeof result === 'string' ? result : JSON.stringify(result)
        taskLogger.endAgent(node.id, 'completed', {
          messages: [`latency=${latency}ms`, normalizedResult]
        })
      } catch (e) {
        console.warn('[EnhancedWorkflowEngine] 记录日志失败:', e)
      }
      
      console.log(`节点 ${node.id} 执行成功，结果:`, typeof result === 'string' ? result.substring(0, 100) + '...' : result)
    } catch (error) {
      const errorMsg = `节点 ${node.id} 执行失败: ${(error as Error).message}`
      this.errors.push(errorMsg)
      console.error(`[EnhancedWorkflowEngine] ${errorMsg}`, error)
      
      // 记录节点执行失败
      try {
        taskLogger.endAgent(node.id, 'failed', {
          messages: [(error as Error).message]
        })
      } catch (e) {
        console.warn('[EnhancedWorkflowEngine] 记录日志失败:', e)
      }
    }
  }

  // 检查是否暂停
  private async checkPause(): Promise<void> {
    if (this.isPaused) {
      console.log('工作流已暂停，等待恢复...')
      await new Promise<void>((resolve) => {
        this.pausePromise = { resolve }
      })
      console.log('工作流已恢复')
    }
  }

  // 暂停工作流
  pause(): void {
    if (this.status === WorkflowStatus.RUNNING) {
      this.status = WorkflowStatus.PAUSED
      this.isPaused = true
      console.log('工作流已暂停')
    }
  }

  // 恢复工作流
  resume(): void {
    if (this.status === WorkflowStatus.PAUSED) {
      this.status = WorkflowStatus.RUNNING
      this.isPaused = false
      if (this.pausePromise) {
        this.pausePromise.resolve()
        this.pausePromise = null
      }
      console.log('工作流已恢复')
    }
  }

  // 检查是否处于暂停状态
  isPausedStatus(): boolean {
    return this.status === WorkflowStatus.PAUSED
  }

  // 获取节点输入参数
  private getNodeInputs(nodeId: string): Record<string, any> {
    const inputs: Record<string, any> = {}

    // 查找所有指向该节点的连线
    const incomingEdges = this.edges.filter(e => e.target === nodeId)

    for (const edge of incomingEdges) {
      const sourceNodeId = edge.source
      const sourceResult = this.executionResults[sourceNodeId]

      if (sourceResult) {
        inputs[edge.sourceHandle || sourceNodeId] = sourceResult
      }
    }

    // 节点自身的输入数据
    const node = this.nodes.find(n => n.id === nodeId)
    if (node && node.data.input) {
      inputs['input'] = node.data.input
    }

    return inputs
  }

  // 根据节点类型获取工具名称
  private getToolNameFromNodeType(nodeType: string): string {
    switch (nodeType) {
      case 'marketResearch':
        return 'market_research'
      case 'productManager':
        return 'product_manager'
      case 'uiDesigner':
        return 'ui_designer'
      case 'architect':
        return 'architect'
      case 'frontendEngineer':
        return 'frontend_engineer'
      case 'backendEngineer':
        return 'backend_engineer'
      case 'uiTester':
        return 'ui_tester'
      case 'functionalTester':
        return 'functional_tester'
      case 'boxNode':
        return 'box_node'
      case 'prompt':
        return 'prompt_node'
      case 'productDoc':
        return 'product_doc'
      case 'designDoc':
        return 'design_doc'
      case 'uiInterface':
        return 'ui_interface'
      case 'codeFile':
        return 'code_file'
      case 'projectSpec':
        return 'project_spec'
      default:
        return nodeType
    }
  }

  // 获取执行顺序（拓扑排序）
  private getExecutionOrder(): string[] {
    const visited: Set<string> = new Set()
    const order: string[] = []
    const visiting: Set<string> = new Set() // 用于检测循环依赖

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return
      if (visiting.has(nodeId)) {
        throw new Error(`检测到循环依赖: ${nodeId}`)
      }

      visiting.add(nodeId)

      // 先访问所有前置节点
      const incomingEdges = this.edges.filter(e => e.target === nodeId)
      for (const edge of incomingEdges) {
        visit(edge.source)
      }

      visiting.delete(nodeId)
      visited.add(nodeId)
      order.push(nodeId)
    }

    for (const node of this.nodes) {
      if (!visited.has(node.id)) {
        visit(node.id)
      }
    }

    return order
  }

  // 获取当前状态
  getStatus(): WorkflowStatus {
    return this.status
  }
}
