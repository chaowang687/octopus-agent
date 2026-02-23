import { EventEmitter } from 'events'
import { toolRegistry } from './ToolRegistry'
import { llmService } from '../services/LLMService'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

interface Task {
  id: string
  instruction: string
  model: string
  agentOptions: {
    agentId?: string
    sessionId?: string
  }
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
}

interface Agent {
  id: string
  type: 'code_generator' | 'test_generator' | 'reviewer' | 'builder'
  capabilities: string[]
  model: string
  config: any
}

interface TaskPlan {
  task_id: string
  files: string[]
  operations: {
    type: 'read' | 'write' | 'execute' | 'search'
    target: string
    params: any
  }[]
  risks: string[]
  estimated_time: number
}

export class AgentScheduler extends EventEmitter {
  private tasks: Map<string, Task> = new Map()
  private agents: Map<string, Agent> = new Map()

  constructor() {
    super()
    this.initializeAgents()
  }

  private initializeAgents() {
    // 注册默认智能体
    this.agents.set('agent-solo-coder', {
      id: 'agent-solo-coder',
      type: 'code_generator',
      capabilities: ['code_generation', 'code_review', 'test_generation'],
      model: 'doubao-seed-2-0-lite-260215',
      config: {
        temperature: 0.1,
        max_tokens: 2000
      }
    })

    this.agents.set('agent-solo-builder', {
      id: 'agent-solo-builder',
      type: 'builder',
      capabilities: ['app_building', 'ui_generation', 'api_integration'],
      model: 'openai',
      config: {
        temperature: 0.7,
        max_tokens: 4000
      }
    })

    this.agents.set('agent-test-generator', {
      id: 'agent-test-generator',
      type: 'test_generator',
      capabilities: ['test_generation', 'test_execution'],
      model: 'doubao-seed-2-0-lite-260215',
      config: {
        temperature: 0.2,
        max_tokens: 1500
      }
    })

    this.agents.set('agent-reviewer', {
      id: 'agent-reviewer',
      type: 'reviewer',
      capabilities: ['code_review', 'security_analysis', 'performance_analysis'],
      model: 'openai',
      config: {
        temperature: 0.3,
        max_tokens: 2000
      }
    })
  }

  // 任务解析器
  async parseTask(instruction: string, model: string = 'openai'): Promise<{ intent: string; parameters: any }> {
    const prompt = `
    You are a task parser for a coding agent. Analyze the user's instruction and extract:
    1. Intent: The main task type (e.g., code_generation, test_generation, code_review, app_building)
    2. Parameters: Key parameters needed for the task

    User Instruction: ${instruction}

    Output JSON format:
    {
      "intent": "string",
      "parameters": {
        "key1": "value1",
        "key2": "value2"
      }
    }
    `

    const response = await llmService.chat(model, [
      { role: 'system', content: 'You are a task parser. Output only JSON.' },
      { role: 'user', content: prompt }
    ], {
      response_format: { type: 'json_object' }
    })

    if (response.success && response.content) {
      try {
        const result = JSON.parse(response.content)
        return {
          intent: result.intent || 'code_generation',
          parameters: result.parameters || {}
        }
      } catch {
        // 解析失败，返回默认值
        return {
          intent: 'code_generation',
          parameters: {}
        }
      }
    }

    return {
      intent: 'code_generation',
      parameters: {}
    }
  }

  // 规划生成器
  async generatePlan(instruction: string, context: any, model: string = 'openai'): Promise<TaskPlan> {
    const prompt = `
    You are a plan generator for a coding agent. Based on the user's instruction and context, generate a detailed plan:

    User Instruction: ${instruction}

    Context:
    ${JSON.stringify(context, null, 2)}

    Plan should include:
    1. Files that need to be modified/created
    2. Sequence of operations (read, write, execute, search)
    3. Potential risks
    4. Estimated time

    Output JSON format:
    {
      "task_id": "uuid",
      "files": ["file1.js", "file2.ts"],
      "operations": [
        {
          "type": "read",
          "target": "file1.js",
          "params": {}
        }
      ],
      "risks": ["Potential breaking changes"],
      "estimated_time": 60
    }
    `

    const response = await llmService.chat(model, [
      { role: 'system', content: 'You are a plan generator. Output only JSON.' },
      { role: 'user', content: prompt }
    ], {
      response_format: { type: 'json_object' }
    })

    if (response.success && response.content) {
      try {
        const plan = JSON.parse(response.content)
        return {
          task_id: plan.task_id || `task_${Date.now()}`,
          files: plan.files || [],
          operations: plan.operations || [],
          risks: plan.risks || [],
          estimated_time: plan.estimated_time || 30
        }
      } catch {
        // 生成失败，返回默认计划
        return {
          task_id: `task_${Date.now()}`,
          files: [],
          operations: [],
          risks: [],
          estimated_time: 30
        }
      }
    }

    return {
      task_id: `task_${Date.now()}`,
      files: [],
      operations: [],
      risks: [],
      estimated_time: 30
    }
  }

  // 调度器
  async dispatchTask(taskId: string, instruction: string, model: string, agentOptions: any) {
    // 解析任务
    const taskParseResult = await this.parseTask(instruction, model)
    
    // 生成上下文
    const context = await this.aggregateContext(agentOptions.sessionId || taskId)
    
    // 生成计划
    const plan = await this.generatePlan(instruction, context, model)
    
    // 根据任务类型选择智能体
    const agent = this.selectAgent(taskParseResult.intent)
    
    // 更新任务状态
    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'pending'
      task.updatedAt = new Date()
      this.tasks.set(taskId, task)
    }
    
    // 返回调度结果，不执行任务（由 TaskEngine 继续执行）
    return {
      success: true,
      task_id: taskId,
      plan,
      result: null, // 任务将由 TaskEngine 继续执行
      agent_id: agent.id
    }
  }

  // 上下文聚合器
  async aggregateContext(sessionId: string): Promise<any> {
    const context: any = {
      system: {
        os: process.platform,
        cwd: process.cwd(),
        home: app.getPath('home')
      },
      project: {
        structure: await this.getProjectStructure(),
        dependencies: await this.getProjectDependencies()
      },
      history: await this.getSessionHistory(sessionId)
    }

    return context
  }

  private selectAgent(intent: string): Agent {
    // 根据意图选择合适的智能体
    let selectedAgent: Agent | undefined;
    
    switch (intent) {
      case 'code_generation':
      case 'code_review':
        selectedAgent = this.agents.get('agent-solo-coder');
        break;
      case 'test_generation':
        selectedAgent = this.agents.get('agent-test-generator');
        break;
      case 'app_building':
        selectedAgent = this.agents.get('agent-solo-builder');
        break;
      case 'security_analysis':
      case 'performance_analysis':
        selectedAgent = this.agents.get('agent-reviewer');
        break;
      default:
        selectedAgent = this.agents.get('agent-solo-coder');
        break;
    }
    
    // 如果没有找到指定的智能体，返回第一个可用的智能体
    if (!selectedAgent) {
      selectedAgent = this.agents.values().next().value;
    }
    
    // 确保总是返回一个有效的智能体
    if (!selectedAgent) {
      throw new Error('No agents available in AgentScheduler');
    }
    
    return selectedAgent;
  }

  private async getProjectStructure(): Promise<any> {
    try {
      const structureTool = toolRegistry.getTool('get_project_structure')
      if (structureTool) {
        const result = await structureTool.handler({ path: process.cwd(), depth: 2 })
        return result.structure
      }
    } catch (error) {
      console.error('Failed to get project structure:', error)
    }
    return {}
  }

  private async getProjectDependencies(): Promise<any> {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json')
      if (fs.existsSync(packageJsonPath)) {
        const content = fs.readFileSync(packageJsonPath, 'utf8')
        const packageJson = JSON.parse(content)
        return {
          dependencies: packageJson.dependencies || {},
          devDependencies: packageJson.devDependencies || {}
        }
      }
    } catch (error) {
      console.error('Failed to get project dependencies:', error)
    }
    return {}
  }

  private async getSessionHistory(sessionId: string): Promise<any[]> {
    try {
      const sessionNotesTool = toolRegistry.getTool('session_notes_read')
      if (sessionNotesTool) {
        const result = await sessionNotesTool.handler({ sessionId })
        return result.notes || []
      }
    } catch (error) {
      console.error('Failed to get session history:', error)
    }
    return []
  }

  // 任务管理
  createTask(instruction: string, model: string, agentOptions: any): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const task: Task = {
      id: taskId,
      instruction,
      model,
      agentOptions,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    this.tasks.set(taskId, task)
    return taskId
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId)
  }

  listTasks(): Task[] {
    return Array.from(this.tasks.values())
  }

  // 智能体管理
  registerAgent(agent: Agent) {
    this.agents.set(agent.id, agent)
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId)
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values())
  }
}

let agentSchedulerInstance: AgentScheduler | null = null

export function getAgentScheduler(): AgentScheduler {
  if (!agentSchedulerInstance) {
    agentSchedulerInstance = new AgentScheduler()
  }
  return agentSchedulerInstance
}

export const agentScheduler = getAgentScheduler()
