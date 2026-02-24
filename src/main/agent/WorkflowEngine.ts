import { toolRegistry } from './ToolRegistry'

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

  constructor(nodes: Node[], edges: Edge[]) {
    this.nodes = nodes
    this.edges = edges
  }

  // 执行工作流
  async execute(): Promise<WorkflowResult> {
    this.status = WorkflowStatus.RUNNING
    this.executionResults = {}
    this.errors = []

    try {
      // 按拓扑顺序执行节点
      const executionOrder = this.getExecutionOrder()

      for (const nodeId of executionOrder) {
        const node = this.nodes.find(n => n.id === nodeId)
        if (!node) continue

        await this.executeNode(node)
      }

      this.status = WorkflowStatus.COMPLETED
      return {
        status: this.status,
        outputs: this.executionResults
      }
    } catch (error) {
      this.status = WorkflowStatus.FAILED
      this.errors.push((error as Error).message)
      return {
        status: this.status,
        outputs: this.executionResults,
        errors: this.errors
      }
    }
  }

  // 执行单个节点
  private async executeNode(node: Node): Promise<void> {
    const nodeData = node.data as any
    const toolName = this.getToolNameFromNodeType(nodeData.type)
    const tool = toolRegistry.getTool(toolName)

    if (!tool) {
      this.errors.push(`工具 ${toolName} 未注册`)
      return
    }

    // 获取输入参数
    const inputs = this.getNodeInputs(node.id)
    console.log(`执行节点 ${node.id} (${toolName})，输入参数:`, inputs)

    try {
      // 调用工具
      const result = await tool.handler(inputs)
      this.executionResults[node.id] = result
      console.log(`节点 ${node.id} 执行成功，结果:`, result)
    } catch (error) {
      const errorMsg = `节点 ${node.id} 执行失败: ${(error as Error).message}`
      this.errors.push(errorMsg)
      console.error(errorMsg)
    }
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

    // 构建邻接表和入度
    for (const edge of this.edges) {
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