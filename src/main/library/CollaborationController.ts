import { documentService, DocumentType, DocumentStatus } from './DocumentService'
import { planService, Plan, PlanStep, Progress } from './PlanService'
import { decisionService, Decision, DecisionRequest } from './DecisionService'
import { permissionSystem } from '../permissions/PermissionSystem'
import { buildPlanModeManager } from '../modes/BuildPlanModeManager'
import { agentConfigManager, AgentConfig } from '../agents/AgentConfigManager'
import { memorySystem } from '../memory/MemorySystem'
import { projectContextAnalyzer } from '../context/ProjectContextAnalyzer'

export interface CollaborationRequest {
  requirement: string
  projectId?: string
  userId?: string
  metadata?: {
    priority?: 'low' | 'medium' | 'high'
    tags?: string[]
    estimatedTime?: number
  }
}

export interface CollaborationSession {
  id: string
  requirementId: string
  planId: string
  status: 'planning' | 'awaiting_decision' | 'executing' | 'completed' | 'failed'
  userId: string
  projectId?: string
  createdAt: number
  updatedAt: number
}

export interface ExecutionResult {
  success: boolean
  planId: string
  progress: Progress
  output: string
  errors: string[]
  metadata: {
    executionTime: number
    stepsCompleted: number
    decisionsMade: number
  }
}

export class CollaborationController {
  private sessions: Map<string, CollaborationSession> = new Map()
  private eventCallbacks: Map<string, (event: any) => void> = new Map()

  async startCollaboration(request: CollaborationRequest): Promise<string> {
    console.log('[CollaborationController] 开始协作会话')

    const sessionId = this.generateId()
    const now = Date.now()

    try {
      const requirementId = await this.createRequirement(request)
      const planId = await this.createInitialPlan(requirementId, request)

      const session: CollaborationSession = {
        id: sessionId,
        requirementId,
        planId,
        status: 'planning',
        userId: request.userId || 'user',
        projectId: request.projectId,
        createdAt: now,
        updatedAt: now
      }

      this.sessions.set(sessionId, session)

      await this.notifyEvent('session:started', session)
      console.log(`[CollaborationController] 协作会话已创建: ${sessionId}`)

      return sessionId
    } catch (error: any) {
      console.error('[CollaborationController] 创建协作会话失败:', error)
      throw new Error(`创建协作会话失败: ${error.message}`)
    }
  }

  async executePlan(sessionId: string): Promise<ExecutionResult> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`协作会话不存在: ${sessionId}`)
    }

    console.log(`[CollaborationController] 开始执行计划: ${session.planId}`)

    const startTime = Date.now()
    const errors: string[] = []
    let decisionsMade = 0

    try {
      session.status = 'executing'
      session.updatedAt = Date.now()
      await this.notifyEvent('session:updated', session)

      const plan = await planService.getPlan(session.planId)
      if (!plan) {
        throw new Error(`计划不存在: ${session.planId}`)
      }

      let stepsCompleted = 0

      for (const step of plan.steps) {
        try {
          await this.executeStep(sessionId, session.planId, step)
          stepsCompleted++
        } catch (error: any) {
          errors.push(`步骤 ${step.title} 执行失败: ${error.message}`)
          await planService.updateStepStatus(session.planId, step.id, 'failed')
        }
      }

      const progress = await planService.getPlanProgress(session.planId)
      const executionTime = Date.now() - startTime

      session.status = progress.percentage === 100 ? 'completed' : 'failed'
      session.updatedAt = Date.now()
      await this.notifyEvent('session:updated', session)

      const result: ExecutionResult = {
        success: progress.percentage === 100,
        planId: session.planId,
        progress,
        output: this.generateExecutionOutput(plan, progress, errors),
        errors,
        metadata: {
          executionTime,
          stepsCompleted,
          decisionsMade
        }
      }

      await this.notifyEvent('session:completed', result)
      console.log(`[CollaborationController] 计划执行完成: ${session.planId}`)

      return result
    } catch (error: any) {
      console.error('[CollaborationController] 执行计划失败:', error)
      session.status = 'failed'
      session.updatedAt = Date.now()
      await this.notifyEvent('session:updated', session)

      throw error
    }
  }

  async executeStep(sessionId: string, planId: string, step: PlanStep): Promise<void> {
    console.log(`[CollaborationController] 执行步骤: ${step.title}`)

    await planService.updateStepStatus(planId, step.id, 'in_progress')

    const pendingDecisions = await planService.getPendingDecisions(planId)
    const stepDecision = pendingDecisions.find(d => d.stepId === step.id)

    if (stepDecision) {
      console.log(`[CollaborationController] 步骤 ${step.title} 需要决策`)
      throw new Error(`步骤 ${step.title} 需要决策，请先完成决策`)
    }

    const agentConfig = await this.selectAgentForStep(step)
    if (!agentConfig) {
      throw new Error(`找不到合适的智能体执行步骤: ${step.title}`)
    }

    const mode = buildPlanModeManager.getAgentMode(agentConfig.id, 'execution')
    const permissions = permissionSystem.getAgent(agentConfig.id)

    if (!permissions) {
      throw new Error(`智能体权限配置不存在: ${agentConfig.id}`)
    }

    console.log(`[CollaborationController] 使用智能体 ${agentConfig.name} (${mode} 模式) 执行步骤`)

    const result = await buildPlanModeManager.executeInMode(
      agentConfig.id,
      agentConfig,
      'execution',
      {
        description: step.description,
        type: 'development',
        complexity: 'medium',
        priority: step.metadata?.priority || 'medium'
      },
      {
        taskId: sessionId,
        projectId: this.sessions.get(sessionId)?.projectId,
        mode,
        permissions: {
          canRead: permissions.tools['read_file']?.read || false,
          canWrite: permissions.tools['write_file']?.write || false,
          canExecute: permissions.tools['execute_command']?.execute || false
        },
        context: {
          projectGuide: await this.getProjectGuide(sessionId),
          memories: await this.getRelevantMemories(sessionId, step),
          preferences: await this.getUserPreferences(sessionId)
        }
      }
    )

    if (result.success) {
      await planService.updateStepStatus(planId, step.id, 'completed')
      await planService.logExecution(planId, step.id, `执行成功: ${result.output}`)

      await this.recordExecutionMemory(sessionId, step, result)
    } else {
      await planService.updateStepStatus(planId, step.id, 'failed')
      await planService.logExecution(planId, step.id, `执行失败: ${result.output}`)

      throw new Error(result.output)
    }
  }

  async requestDecision(sessionId: string, stepId: string, request: DecisionRequest): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`协作会话不存在: ${sessionId}`)
    }

    console.log(`[CollaborationController] 请求决策: ${request.title}`)

    session.status = 'awaiting_decision'
    session.updatedAt = Date.now()
    await this.notifyEvent('session:updated', session)

    const decisionId = await decisionService.createDecision(request)

    await planService.addDecisionPoint(session.planId, stepId, {
      id: decisionId,
      title: request.title,
      description: request.description,
      status: 'pending',
      options: request.options,
      createdAt: Date.now()
    })

    await this.notifyEvent('decision:requested', {
      sessionId,
      planId: session.planId,
      stepId,
      decisionId,
      decision: await decisionService.getDecision(decisionId)
    })

    return decisionId
  }

  async makeDecision(sessionId: string, decisionId: string, optionId: string, reason?: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`协作会话不存在: ${sessionId}`)
    }

    console.log(`[CollaborationController] 做出决策: ${decisionId} -> ${optionId}`)

    const decision = await decisionService.makeDecision(decisionId, optionId, reason, session.userId)

    const plan = await planService.getPlan(session.planId)
    if (plan) {
      const step = plan.steps.find(s => s.decisionPoints.some(dp => dp.id === decisionId))
      if (step) {
        await planService.makeDecision(session.planId, step.id, decisionId, optionId, reason)
      }
    }

    session.status = 'planning'
    session.updatedAt = Date.now()
    await this.notifyEvent('session:updated', session)

    await this.notifyEvent('decision:completed', {
      sessionId,
      planId: session.planId,
      decisionId,
      decision
    })

    await this.recordDecisionMemory(sessionId, decision)
  }

  async getProgress(sessionId: string): Promise<Progress> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`协作会话不存在: ${sessionId}`)
    }

    return await planService.getPlanProgress(session.planId)
  }

  async getPendingDecisions(sessionId: string): Promise<Decision[]> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`协作会话不存在: ${sessionId}`)
    }

    return await decisionService.getPendingDecisions(session.planId)
  }

  async cancelSession(sessionId: string, reason?: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`协作会话不存在: ${sessionId}`)
    }

    console.log(`[CollaborationController] 取消会话: ${sessionId}`)

    session.status = 'failed'
    session.updatedAt = Date.now()

    const plan = await planService.getPlan(session.planId)
    if (plan) {
      for (const step of plan.steps) {
        if (step.status === 'in_progress') {
          await planService.updateStepStatus(session.planId, step.id, 'skipped')
        }
      }
    }

    await this.notifyEvent('session:cancelled', {
      sessionId,
      reason
    })

    this.sessions.delete(sessionId)
  }

  private async createRequirement(request: CollaborationRequest): Promise<string> {
    const requirement = await documentService.createDocument({
      type: DocumentType.REQUIREMENT,
      title: '新需求',
      content: request.requirement,
      metadata: {
        status: DocumentStatus.ACTIVE,
        projectId: request.projectId,
        tags: request.metadata?.tags || [],
        createdBy: request.userId || 'user',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      },
      relations: {
        dependencies: [],
        related: [],
        decisions: []
      }
    })

    return requirement.id
  }

  private async createInitialPlan(requirementId: string, request: CollaborationRequest): Promise<string> {
    const planId = await planService.createPlan(requirementId, {
      goal: request.requirement,
      priority: request.metadata?.priority || 'medium',
      estimatedTime: request.metadata?.estimatedTime || 3600,
      tags: request.metadata?.tags || []
    })

    return planId
  }

  private async selectAgentForStep(step: PlanStep): Promise<AgentConfig | undefined> {
    const allAgents = agentConfigManager.getAllConfigs()

    const keywords = step.title.toLowerCase() + ' ' + step.description.toLowerCase()

    for (const agent of allAgents) {
      for (const capability of agent.capabilities) {
        if (keywords.includes(capability.toLowerCase())) {
          return agent
        }
      }
    }

    return allAgents.find(a => a.mode === 'build')
  }

  private async getProjectGuide(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session || !session.projectId) {
      return ''
    }

    try {
      const context = await projectContextAnalyzer.analyzeProject(session.projectId)
      return projectContextAnalyzer.generateProjectGuide(context)
    } catch (error) {
      console.error('[CollaborationController] 获取项目指南失败:', error)
      return ''
    }
  }

  private async getRelevantMemories(sessionId: string, step: PlanStep): Promise<any> {
    const session = this.sessions.get(sessionId)
    if (!session || !session.projectId) {
      return {}
    }

    try {
      const commands = memorySystem.getCommands(session.projectId)
      const debugInfo = memorySystem.getDebug(session.projectId, step.title)
      const patterns = memorySystem.getPatterns(session.projectId)

      return {
        commands: commands.slice(0, 5),
        debugInfo: debugInfo.slice(0, 3),
        patterns: patterns.slice(0, 3)
      } as any
    } catch (error) {
      console.error('[CollaborationController] 获取相关记忆失败:', error)
      return {}
    }
  }

  private async getUserPreferences(sessionId: string): Promise<any> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return {}
    }

    try {
      const model = memorySystem.getPreference('defaultModel')
      const language = memorySystem.getPreference('preferredLanguage')
      const editor = memorySystem.getPreference('preferredEditor')

      return {
        model,
        language,
        editor
      }
    } catch (error) {
      console.error('[CollaborationController] 获取用户偏好失败:', error)
      return {}
    }
  }

  private async recordExecutionMemory(sessionId: string, _step: PlanStep, result: any): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session || !session.projectId) {
      return
    }

    try {
      if (result.actions) {
        const commandActions = result.actions.filter((a: any) => a.type === 'execute')
        for (const action of commandActions) {
          memorySystem.setCommand(
            session.projectId,
            action.details?.command || action.description,
            action.description
          )
        }
      }
    } catch (error) {
      console.error('[CollaborationController] 记录执行记忆失败:', error)
    }
  }

  private async recordDecisionMemory(sessionId: string, decision: Decision): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session || !session.projectId) {
      return
    }

    try {
      memorySystem.setKnowledge(
        'project-manager',
        decision.title,
        `决策: ${decision.selectedOption}\n理由: ${decision.reason}`,
        0.8
      )
    } catch (error) {
      console.error('[CollaborationController] 记录决策记忆失败:', error)
    }
  }

  private generateExecutionOutput(plan: Plan, progress: Progress, errors: string[]): string {
    const stepsSummary = plan.steps.map(step => {
      const statusEmoji = {
        pending: '⏳',
        in_progress: '🔄',
        completed: '✅',
        failed: '❌',
        skipped: '⏭️'
      }
      return `${statusEmoji[step.status]} ${step.title}`
    }).join('\n')

    return `# 执行结果

## 进度
${'█'.repeat(Math.floor(progress.percentage / 5))}${'░'.repeat(20 - Math.floor(progress.percentage / 5))} ${progress.percentage.toFixed(1)}%

- 总步骤: ${progress.totalSteps}
- 已完成: ${progress.completedSteps}
- 进行中: ${progress.inProgressSteps}
- 失败: ${progress.failedSteps}

## 步骤详情
${stepsSummary}

${errors.length > 0 ? `## 错误\n${errors.map(e => `- ${e}`).join('\n')}` : '## 错误\n无'}

## 总结
${progress.percentage === 100 ? '✅ 所有步骤执行完成！' : '❌ 部分步骤执行失败'}
`
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15)
  }

  private async notifyEvent(eventType: string, data: any): Promise<void> {
    console.log(`[CollaborationController] 通知事件: ${eventType}`)
    
    for (const [callbackId, callback] of this.eventCallbacks) {
      try {
        await callback({ type: eventType, data })
      } catch (error) {
        console.error(`[CollaborationController] 事件回调执行失败 ${callbackId}:`, error)
      }
    }
  }

  onEvent(callback: (event: any) => void): string {
    const callbackId = this.generateId()
    this.eventCallbacks.set(callbackId, callback)
    return callbackId
  }

  offEvent(callbackId: string): void {
    this.eventCallbacks.delete(callbackId)
  }

  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId)
  }

  getAllSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values())
  }
}

export const collaborationController = new CollaborationController()
