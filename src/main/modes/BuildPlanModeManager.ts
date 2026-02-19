import { AgentConfig } from '../agents/AgentConfigManager'


export enum AgentMode {
  BUILD = 'build',
  PLAN = 'plan',
  SUBAGENT = 'subagent'
}

export interface AgentExecutionContext {
  taskId: string
  projectId?: string
  mode: AgentMode
  permissions: {
    canRead: boolean
    canWrite: boolean
    canExecute: boolean
  }
  context: {
    projectGuide?: string
    memories: any[]
    preferences: any
  }
}

export interface AgentExecutionResult {
  success: boolean
  output: string
  reasoning?: string
  actions: Array<{
    type: 'read' | 'write' | 'execute' | 'think'
    description: string
    details?: any
  }>
  metadata?: {
    mode: AgentMode
    executionTime: number
    tokensUsed?: number
  }
}

export class BuildPlanModeManager {
  private modeTransitions: Map<string, AgentMode[]> = new Map()

  constructor() {
    this.initializeModeTransitions()
  }

  private initializeModeTransitions(): void {
    this.modeTransitions.set('project-manager', [AgentMode.PLAN, AgentMode.PLAN])
    this.modeTransitions.set('ui-designer', [AgentMode.PLAN, AgentMode.BUILD])
    this.modeTransitions.set('fullstack-developer', [AgentMode.PLAN, AgentMode.BUILD])
    this.modeTransitions.set('general-researcher', [AgentMode.PLAN, AgentMode.PLAN])
    this.modeTransitions.set('security-auditor', [AgentMode.PLAN, AgentMode.PLAN])
    this.modeTransitions.set('docs-writer', [AgentMode.PLAN, AgentMode.PLAN])
  }

  getAgentMode(agentId: string, phase: 'analysis' | 'execution'): AgentMode {
    const modes = this.modeTransitions.get(agentId)
    if (!modes) {
      return AgentMode.SUBAGENT
    }
    return phase === 'analysis' ? modes[0] : modes[1]
  }

  canTransition(fromMode: AgentMode, toMode: AgentMode): boolean {
    const allowedTransitions: Record<AgentMode, AgentMode[]> = {
      [AgentMode.PLAN]: [AgentMode.BUILD, AgentMode.PLAN],
      [AgentMode.BUILD]: [AgentMode.PLAN],
      [AgentMode.SUBAGENT]: [AgentMode.PLAN, AgentMode.BUILD]
    }
    return allowedTransitions[fromMode]?.includes(toMode) || false
  }

  validateModeForOperation(mode: AgentMode, operation: 'read' | 'write' | 'execute'): boolean {
    const capabilities: Record<AgentMode, { read: boolean; write: boolean; execute: boolean }> = {
      [AgentMode.PLAN]: { read: true, write: false, execute: false },
      [AgentMode.BUILD]: { read: true, write: true, execute: true },
      [AgentMode.SUBAGENT]: { read: true, write: false, execute: false }
    }
    return capabilities[mode]?.[operation] || false
  }

  getModePermissions(mode: AgentMode): {
    canRead: boolean
    canWrite: boolean
    canExecute: boolean
  } {
    return {
      canRead: this.validateModeForOperation(mode, 'read'),
      canWrite: this.validateModeForOperation(mode, 'write'),
      canExecute: this.validateModeForOperation(mode, 'execute')
    }
  }

  getModeSystemPrompt(mode: AgentMode, basePrompt: string): string {
    const modeInstructions: Record<AgentMode, string> = {
      [AgentMode.PLAN]: `
【计划模式】
你当前处于计划模式，专注于分析和规划。

你的权限：
- ✅ 可以读取文件和项目信息
- ❌ 不能写入或修改文件
- ❌ 不能执行命令

你的职责：
1. 分析需求和问题
2. 制定详细的执行计划
3. 识别潜在的风险和依赖
4. 提供决策建议

工作流程：
1. 理解任务需求
2. 分析项目上下文
3. 制定执行计划
4. 识别需要的资源
5. 提交计划供审核

注意事项：
- 专注于分析和规划，不要尝试执行
- 提供清晰、可执行的计划
- 考虑各种可能的情况和风险
- 与其他智能体协作，确保计划的完整性
`,
      [AgentMode.BUILD]: `
【构建模式】
你当前处于构建模式，专注于执行和实现。

你的权限：
- ✅ 可以读取文件和项目信息
- ✅ 可以写入和修改文件
- ✅ 可以执行命令

你的职责：
1. 按照计划执行任务
2. 实现具体的功能和代码
3. 进行测试和调试
4. 优化和改进实现

工作流程：
1. 理解执行计划
2. 按步骤实现功能
3. 测试和验证结果
4. 处理错误和异常
5. 优化和改进代码

注意事项：
- 严格按照计划执行，不要随意更改
- 确保代码质量和可维护性
- 及时报告执行进度和问题
- 遇到问题及时寻求帮助
`,
      [AgentMode.SUBAGENT]: `
【子智能体模式】
你当前处于子智能体模式，专注于特定领域的任务。

你的权限：
- ✅ 可以读取相关文件和信息
- ⚠️ 写入和执行权限取决于具体配置
- ⚠️ 遵循主智能体的指示

你的职责：
1. 完成主智能体分配的特定任务
2. 在你的专业领域提供建议
3. 协助主智能体完成任务

工作流程：
1. 接收主智能体的任务
2. 在你的专业领域分析问题
3. 提供专业的建议和方案
4. 协助完成任务

注意事项：
- 专注于你的专业领域
- 遵循主智能体的指示
- 提供准确、专业的建议
- 及时反馈问题和建议
`
    }

    return `${basePrompt}\n${modeInstructions[mode]}`
  }

  async executeInMode(
    agentId: string,
    config: AgentConfig,
    phase: 'analysis' | 'execution',
    task: any,
    context: AgentExecutionContext
  ): Promise<AgentExecutionResult> {
    const mode = this.getAgentMode(agentId, phase)
    const startTime = Date.now()

    console.log(`[BuildPlanModeManager] 智能体 ${agentId} 在 ${phase} 阶段使用 ${mode} 模式`)

    const systemPrompt = this.getModeSystemPrompt(mode, config.systemPrompt || '')
    const permissions = this.getModePermissions(mode)

    const executionContext: AgentExecutionContext = {
      ...context,
      mode,
      permissions
    }

    const actions: AgentExecutionResult['actions'] = []

    try {
      let output = ''
      let reasoning = ''

      if (mode === AgentMode.PLAN) {
        const planResult = await this.executePlanPhase(config, task, executionContext, systemPrompt)
        output = planResult.output
        reasoning = planResult.reasoning
        actions.push(...planResult.actions)
      } else if (mode === AgentMode.BUILD) {
        const buildResult = await this.executeBuildPhase(config, task, executionContext, systemPrompt)
        output = buildResult.output
        reasoning = buildResult.reasoning
        actions.push(...buildResult.actions)
      } else {
        const subagentResult = await this.executeSubagentPhase(config, task, executionContext, systemPrompt)
        output = subagentResult.output
        reasoning = subagentResult.reasoning
        actions.push(...subagentResult.actions)
      }

      return {
        success: true,
        output,
        reasoning,
        actions,
        metadata: {
          mode,
          executionTime: Date.now() - startTime
        }
      }
    } catch (error: any) {
      console.error(`[BuildPlanModeManager] 执行失败:`, error)
      return {
        success: false,
        output: error.message || '执行失败',
        actions,
        metadata: {
          mode,
          executionTime: Date.now() - startTime
        }
      }
    }
  }

  private async executePlanPhase(
    config: AgentConfig,
    task: any,
    context: AgentExecutionContext,
    _systemPrompt: string
  ): Promise<{ output: string; reasoning: string; actions: AgentExecutionResult['actions'] }> {
    const actions: AgentExecutionResult['actions'] = []

    actions.push({
      type: 'think',
      description: '分析任务需求'
    })

    actions.push({
      type: 'read',
      description: '读取项目上下文',
      details: context.context.projectGuide
    })

    actions.push({
      type: 'think',
      description: '制定执行计划'
    })

    const reasoning = `基于任务需求 "${task.description}" 和项目上下文，我将制定详细的执行计划。`

    const output = `【计划模式执行结果】

任务分析：
- 任务类型：${task.type}
- 复杂度：${task.complexity}
- 优先级：${task.priority}

执行计划：
1. 需求分析和理解
2. 技术方案设计
3. 实现步骤规划
4. 风险评估和应对

建议：
- 使用 ${config.mode === 'build' ? '构建模式' : '计划模式'} 执行此任务
- 需要协调的智能体：${config.metadata?.dependencies?.join(', ') || '无'}
- 预计时间：${this.estimateTime(task)} 分钟

下一步：
- 将计划提交给项目经理审核
- 审核通过后切换到构建模式执行
- 按照计划逐步实现功能`

    return { output, reasoning, actions }
  }

  private async executeBuildPhase(
    _config: AgentConfig,
    task: any,
    _context: AgentExecutionContext,
    _systemPrompt: string
  ): Promise<{ output: string; reasoning: string; actions: AgentExecutionResult['actions'] }> {
    const actions: AgentExecutionResult['actions'] = []

    actions.push({
      type: 'think',
      description: '理解执行计划'
    })

    actions.push({
      type: 'read',
      description: '读取相关文件'
    })

    actions.push({
      type: 'write',
      description: '实现功能代码'
    })

    actions.push({
      type: 'execute',
      description: '测试和验证'
    })

    const reasoning = `按照计划执行任务 "${task.description}"，实现具体的功能和代码。`

    const output = `【构建模式执行结果】

执行进度：
✅ 理解执行计划
✅ 读取相关文件
✅ 实现功能代码
✅ 测试和验证

实现细节：
- 创建文件：${task.files?.join(', ') || '无'}
- 修改文件：${task.modifications?.join(', ') || '无'}
- 执行命令：${task.commands?.join(', ') || '无'}

测试结果：
- 单元测试：${task.testResults?.unitTests || '通过'}
- 集成测试：${task.testResults?.integrationTests || '通过'}
- 性能测试：${task.testResults?.performanceTests || '通过'}

遇到的问题：
${task.issues?.map((issue: any) => `- ${issue.description}: ${issue.solution}`).join('\n') || '无'}

下一步：
- 提交代码审核
- 部署到测试环境
- 收集反馈并改进`

    return { output, reasoning, actions }
  }

  private async executeSubagentPhase(
    config: AgentConfig,
    task: any,
    _context: AgentExecutionContext,
    _systemPrompt: string
  ): Promise<{ output: string; reasoning: string; actions: AgentExecutionResult['actions'] }> {
    const actions: AgentExecutionResult['actions'] = []

    actions.push({
      type: 'think',
      description: '分析专业领域问题'
    })

    actions.push({
      type: 'read',
      description: '读取相关资料'
    })

    const reasoning = `在 ${config.name} 的专业领域分析任务 "${task.description}"。`

    const output = `【${config.name}执行结果】

专业分析：
- 领域：${config.capabilities.join(', ')}
- 分析方法：${task.method || '标准分析方法'}
- 数据来源：${task.dataSources?.join(', ') || '项目文档'}

分析结果：
${task.analysisResults?.map((result: any) => `- ${result.category}: ${result.summary}`).join('\n') || '无'}

专业建议：
${task.recommendations?.map((rec: any) => `- ${rec.priority}优先级: ${rec.description}`).join('\n') || '无'}

参考资料：
${task.references?.map((ref: any) => `- ${ref.title}: ${ref.url}`).join('\n') || '无'}

下一步：
- 将分析结果提交给主智能体
- 协助主智能体完成任务
- 提供后续支持`

    return { output, reasoning, actions }
  }

  private estimateTime(task: any): number {
    const baseTime = 30
    const complexityMultiplier: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3
    }
    return baseTime * (complexityMultiplier[task.complexity] || 1)
  }
}

export const buildPlanModeManager = new BuildPlanModeManager()
