import { toolRegistry } from './ToolRegistry'
import { taskLogger } from './TaskLogger'
import { LLMService } from '../services/LLMService'

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

export class WorkflowEngine {
  private nodes: Node[]
  private edges: Edge[]
  private executionResults: Record<string, any> = {}
  private status: WorkflowStatus = WorkflowStatus.PENDING
  private errors: string[] = []
  private isPaused: boolean = false
  private pausePromise: { resolve: () => void } | null = null
  private llmService: LLMService

  constructor(nodes: Node[], edges: Edge[]) {
    this.nodes = nodes
    this.edges = edges
    this.llmService = new LLMService()
  }

  // 执行工作流
  async execute(taskId: string = `workflow_${Date.now()}`): Promise<WorkflowResult> {
    this.status = WorkflowStatus.RUNNING
    this.executionResults = {}
    this.errors = []

    try {
      // 记录工作流开始 - 为避免push错误，暂时注释掉日志记录
      // taskLogger.startTask({
      //   taskId,
      //   projectName: 'Workflow Execution',
      //   instruction: 'Workflow execution initiated',
      //   originalInstruction: 'Workflow execution initiated',
      //   taskDir: './temp'
      // })

      console.log(`[WorkflowEngine] 开始执行工作流，共 ${this.nodes.length} 个节点，${this.edges.length} 条连线`)
      
      // 按拓扑顺序执行节点
      const executionOrder = this.getExecutionOrder()
      console.log(`[WorkflowEngine] 执行顺序: ${executionOrder.join(', ')}`)

      for (const [index, nodeId] of executionOrder.entries()) {
        const node = this.nodes.find(n => n.id === nodeId)
        if (!node) {
          console.warn(`[WorkflowEngine] 警告: 未找到节点 ${nodeId}`)
          continue
        }
        
        console.log(`[WorkflowEngine] 正在执行节点 ${index + 1}/${executionOrder.length}: ${node.id} (${node.data.type})`)
        await this.executeNode(node)
      }

      this.status = WorkflowStatus.COMPLETED
      
      console.log(`[WorkflowEngine] 工作流执行完成，共处理 ${Object.keys(this.executionResults).length} 个节点`)
      
      // 记录工作流完成 - 为避免push错误，暂时注释掉日志记录
      // taskLogger.endTask('completed')
      
      return {
        status: this.status,
        outputs: this.executionResults
      }
    } catch (error) {
      this.status = WorkflowStatus.FAILED
      const errorMessage = (error as Error).message
      const errorStack = (error as Error).stack
      this.errors.push(errorMessage)
      
      console.error(`[WorkflowEngine] 工作流执行失败:`, error)
      
      // 记录工作流失败 - 为避免push错误，暂时注释掉日志记录
      // taskLogger.endTask('failed')
      
      return {
        status: this.status,
        outputs: this.executionResults,
        errors: this.errors,
        errorDetails: {
          message: errorMessage,
          stack: errorStack
        }
      }
    }
  }

  // 执行单个节点
  private async executeNode(node: Node): Promise<void> {
    // 检查是否暂停
    await this.checkPause()
    
    const nodeData = node.data as any
    const toolName = this.getToolNameFromNodeType(nodeData.type)
    const tool = toolRegistry.getTool(toolName)

    if (!tool) {
      const errorMsg = `工具 ${toolName} 未注册`
      this.errors.push(errorMsg)
      this.status = WorkflowStatus.FAILED  // 设置状态为失败
      console.error(errorMsg)
      throw new Error(errorMsg)  // 抛出错误以中断工作流
    }

    // 记录节点开始执行，需要先启动一个迭代
     const inputs = this.getNodeInputs(node.id)
     
     console.log(`[WorkflowEngine] 开始执行节点 ${node.id} (${nodeData.type})，工具: ${toolName}`)
     console.log(`[WorkflowEngine] 节点输入参数:`, inputs)

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
        console.log(`[WorkflowEngine] 框智能体节点参数构建完成:`, { title, model, inputFiles: toolArgs.inputFiles })
      }

      // 特殊处理prompt节点，记录大模型调用
      if (nodeData.type === 'prompt') {
        // 构建prompt节点的参数
        toolArgs = {
          input: nodeData.input || '',
          model: nodeData.model || 'qwen3',
          systemPrompt: nodeData.systemPrompt || '',
          ...inputs
        }
        console.log(`[WorkflowEngine] Prompt节点参数构建完成:`, { model: toolArgs.model, inputLength: toolArgs.input.length })
      }
 
      // 记录工具调用 - 安全地检查日志记录器状态 - 为避免push错误，暂时注释掉
      console.log(`[WorkflowEngine] 调用工具: ${toolName}，参数:`, toolArgs)
      // if (taskLogger.getCurrentLog()) {
      //   taskLogger.logToolCall({
      //     tool: toolName,
      //     parameters: toolArgs
      //   })
      // }

      // 调用工具
      const startTime = Date.now()
      console.log(`[WorkflowEngine] 工具 ${toolName} 开始执行...`)
      const result = await tool.handler(toolArgs)
      const endTime = Date.now()
      const latency = endTime - startTime
      console.log(`[WorkflowEngine] 工具 ${toolName} 执行完成，耗时: ${latency}ms`)
      
      this.executionResults[node.id] = result
      
      // 记录节点执行成功 - 安全地检查日志记录器状态 - 为避免push错误，暂时注释掉
      // if (taskLogger.getCurrentLog()) {
      //   taskLogger.endAgent(node.id, 'completed', {
      //     files: result ? [typeof result === 'string' ? result : JSON.stringify(result)] : []
      //   })
      //   
      //   // 记录工具调用结果
      //   taskLogger.logToolCall({
      //     tool: toolName,
      //     parameters: toolArgs,
      //     result: result,
      //     duration: latency
      //   })
      // }
      
      console.log(`[WorkflowEngine] 节点 ${node.id} 执行成功，结果:`, typeof result === 'string' && result.length > 100 ? result.substring(0, 100) + '...' : result)
    } catch (error) {
      const errorMsg = `节点 ${node.id} 执行失败: ${(error as Error).message}`
      this.errors.push(errorMsg)
      this.status = WorkflowStatus.FAILED  // 设置状态为失败
      console.error(`[WorkflowEngine] 节点 ${node.id} 执行失败详情:`, error)
      console.error(`[WorkflowEngine] 失败节点信息:`, { nodeId: node.id, nodeType: nodeData.type, toolName, inputs })
      
      // 记录节点执行失败 - 安全地检查日志记录器状态 - 为避免push错误，暂时注释掉
      // if (taskLogger.getCurrentLog()) {
      //   taskLogger.endAgent(node.id, 'failed', {
      //     messages: [(error as Error).message]
      //   })
      //   
      //   // 记录工具调用失败
      //   taskLogger.logToolCall({
      //     tool: toolName,
      //     parameters: inputs,
      //     error: (error as Error).message
      //   })
      // }
      
      throw error  // 抛出错误以中断工作流执行
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
    const typeMap: Record<string, string> = {
      'marketResearch': 'market_research',
      'productManager': 'product_manager',
      'uiDesigner': 'ui_designer',
      'architect': 'architect',
      'frontendEngineer': 'frontend_engineer',
      'backendEngineer': 'backend_engineer',
      'uiTester': 'ui_tester',
      'functionalTester': 'functional_tester',
      'boxNode': 'box_node',
      'prompt': 'prompt_node',
      'productDoc': 'product_doc',
      'designDoc': 'design_doc',
      'uiInterface': 'ui_interface',
      'codeFile': 'code_file',
      'projectSpec': 'project_spec'
    }
    return typeMap[nodeType] || nodeType
  }

  // 获取执行顺序（拓扑排序）
  private getExecutionOrder(): string[] {
    const adjacencyList: Record<string, string[]> = {}
    const inDegree: Record<string, number> = {}

    // 初始化邻接表和入度
    for (const node of this.nodes) {
      adjacencyList[node.id] = []
      inDegree[node.id] = 0
    }

    // 构建邻接表和入度，跳过无效的边
    for (const edge of this.edges) {
      // 检查边的源节点和目标节点是否都存在
      if (adjacencyList[edge.source] === undefined) {
        console.warn(`[WorkflowEngine] 警告: 边的源节点 ${edge.source} 不存在，跳过此边`)
        continue
      }
      if (inDegree[edge.target] === undefined) {
        console.warn(`[WorkflowEngine] 警告: 边的目标节点 ${edge.target} 不存在，跳过此边`)
        continue
      }
      adjacencyList[edge.source].push(edge.target)
      inDegree[edge.target]++
    }

    // Kahn算法拓扑排序
    const queue: string[] = []
    const result: string[] = []

    // 将入度为0的节点加入队列
    for (const nodeId in inDegree) {
      if (inDegree[nodeId] === 0) {
        queue.push(nodeId)
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      result.push(nodeId)

      for (const neighbor of adjacencyList[nodeId]) {
        inDegree[neighbor]--
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor)
        }
      }
    }

    // 检查是否有环
    if (result.length !== this.nodes.length) {
      throw new Error('工作流中存在循环依赖')
    }

    return result
  }

  // 获取工作流状态
  getStatus(): WorkflowStatus {
    return this.status
  }

  // 获取执行结果
  getExecutionResults(): Record<string, any> {
    return this.executionResults
  }

  // 获取错误信息
  getErrors(): string[] {
    return this.errors
  }
}