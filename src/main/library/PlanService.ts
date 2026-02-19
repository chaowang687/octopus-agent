import { documentService, Document, DocumentType, DocumentStatus } from './DocumentService'
import * as crypto from 'crypto'

export interface PlanStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  executor?: string
  startTime?: number
  endTime?: number
  dependencies: string[]
  decisionPoints: DecisionPoint[]
  logs: string[]
  metadata?: {
    estimatedTime?: number
    actualTime?: number
    priority?: 'low' | 'medium' | 'high'
  }
}

export interface DecisionPoint {
  id: string
  title: string
  description: string
  status: 'pending' | 'completed'
  options: DecisionOption[]
  selectedOption?: string
  reason?: string
  createdAt: number
  completedAt?: number
}

export interface DecisionOption {
  id: string
  title: string
  description: string
  pros: string[]
  cons: string[]
  recommendation?: number
}

export interface PlanMetadata {
  goal: string
  priority: 'low' | 'medium' | 'high'
  estimatedTime: number
  actualTime?: number
  risks: string[]
  resources: string[]
  tags: string[]
}

export interface Plan {
  id: string
  title: string
  content: string
  steps: PlanStep[]
  metadata: PlanMetadata
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  createdAt: number
  updatedAt: number
}

export interface Progress {
  totalSteps: number
  completedSteps: number
  inProgressSteps: number
  failedSteps: number
  percentage: number
  estimatedTimeRemaining?: number
}

export class PlanService {
  async createPlan(requirementId: string, metadata?: Partial<PlanMetadata>): Promise<string> {
    const requirement = await documentService.getDocument(requirementId)
    if (!requirement) {
      throw new Error(`需求文档不存在: ${requirementId}`)
    }

    const planId = crypto.randomBytes(16).toString('hex')
    const now = Date.now()

    const plan: Plan = {
      id: planId,
      title: `${requirement.title} - 开发计划`,
      content: '',
      steps: [],
      metadata: {
        goal: metadata?.goal || requirement.content,
        priority: metadata?.priority || 'medium',
        estimatedTime: metadata?.estimatedTime || 3600,
        risks: metadata?.risks || [],
        resources: metadata?.resources || [],
        tags: metadata?.tags || []
      },
      status: 'draft',
      createdAt: now,
      updatedAt: now
    }

    const planContent = this.generatePlanContent(plan)

    await documentService.createDocument({
      id: planId,
      type: DocumentType.PLAN,
      title: plan.title,
      content: planContent,
      metadata: {
        status: DocumentStatus.DRAFT,
        parentId: requirementId,
        tags: plan.metadata.tags,
        createdBy: 'agent:project-manager',
        createdAt: now,
        updatedAt: now,
        version: 1
      },
      relations: {
        dependencies: [requirementId],
        related: [],
        decisions: []
      }
    })

    console.log(`[PlanService] 创建计划: ${planId}`)
    return planId
  }

  async getPlan(planId: string): Promise<Plan | undefined> {
    const doc = await documentService.getDocument(planId)
    if (!doc || doc.type !== DocumentType.PLAN) {
      return undefined
    }

    return this.parsePlan(doc)
  }

  async updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan> {
    const doc = await documentService.getDocument(planId)
    if (!doc) {
      throw new Error(`计划不存在: ${planId}`)
    }

    const currentPlan = this.parsePlan(doc)
    const updatedPlan: Plan = {
      ...currentPlan,
      ...updates,
      id: planId,
      updatedAt: Date.now()
    }

    const updatedContent = this.generatePlanContent(updatedPlan)

    await documentService.updateDocument(planId, {
      content: updatedContent,
      metadata: {
        ...doc.metadata,
        updatedAt: Date.now(),
        version: doc.metadata.version + 1
      }
    })

    console.log(`[PlanService] 更新计划: ${planId}`)
    return updatedPlan
  }

  async addStep(planId: string, step: Partial<PlanStep>): Promise<PlanStep> {
    const plan = await this.getPlan(planId)
    if (!plan) {
      throw new Error(`计划不存在: ${planId}`)
    }

    const newStep: PlanStep = {
      id: step.id || crypto.randomBytes(16).toString('hex'),
      title: step.title || '新步骤',
      description: step.description || '',
      status: 'pending',
      dependencies: step.dependencies || [],
      decisionPoints: step.decisionPoints || [],
      logs: step.logs || [],
      metadata: step.metadata
    }

    plan.steps.push(newStep)
    plan.updatedAt = Date.now()

    await this.updatePlan(planId, { steps: plan.steps })

    console.log(`[PlanService] 添加步骤: ${planId}/${newStep.id}`)
    return newStep
  }

  async updateStep(planId: string, stepId: string, updates: Partial<PlanStep>): Promise<PlanStep> {
    const plan = await this.getPlan(planId)
    if (!plan) {
      throw new Error(`计划不存在: ${planId}`)
    }

    const stepIndex = plan.steps.findIndex(s => s.id === stepId)
    if (stepIndex === -1) {
      throw new Error(`步骤不存在: ${stepId}`)
    }

    const updatedStep: PlanStep = {
      ...plan.steps[stepIndex],
      ...updates,
      id: stepId
    }

    plan.steps[stepIndex] = updatedStep
    plan.updatedAt = Date.now()

    await this.updatePlan(planId, { steps: plan.steps })

    console.log(`[PlanService] 更新步骤: ${planId}/${stepId}`)
    return updatedStep
  }

  async updateStepStatus(planId: string, stepId: string, status: PlanStep['status']): Promise<void> {
    const now = Date.now()
    const step = await this.getStep(planId, stepId)
    
    if (!step) {
      throw new Error(`步骤不存在: ${stepId}`)
    }

    const updates: Partial<PlanStep> = { status }

    if (status === 'in_progress' && !step.startTime) {
      updates.startTime = now
    } else if (status === 'completed' || status === 'failed' || status === 'skipped') {
      updates.endTime = now
      if (step.startTime) {
        updates.metadata = {
          ...step.metadata,
          actualTime: now - step.startTime
        }
      }
    }

    await this.updateStep(planId, stepId, updates)
  }

  async addDecisionPoint(planId: string, stepId: string, decisionPoint: Partial<DecisionPoint>): Promise<DecisionPoint> {
    const step = await this.getStep(planId, stepId)
    if (!step) {
      throw new Error(`步骤不存在: ${stepId}`)
    }

    const newDecisionPoint: DecisionPoint = {
      id: decisionPoint.id || crypto.randomBytes(16).toString('hex'),
      title: decisionPoint.title || '新决策点',
      description: decisionPoint.description || '',
      status: 'pending',
      options: decisionPoint.options || [],
      createdAt: Date.now()
    }

    step.decisionPoints.push(newDecisionPoint)

    await this.updateStep(planId, stepId, { decisionPoints: step.decisionPoints })

    console.log(`[PlanService] 添加决策点: ${planId}/${stepId}/${newDecisionPoint.id}`)
    return newDecisionPoint
  }

  async makeDecision(planId: string, stepId: string, decisionPointId: string, optionId: string, reason?: string): Promise<void> {
    const step = await this.getStep(planId, stepId)
    if (!step) {
      throw new Error(`步骤不存在: ${stepId}`)
    }

    const decisionPoint = step.decisionPoints.find(dp => dp.id === decisionPointId)
    if (!decisionPoint) {
      throw new Error(`决策点不存在: ${decisionPointId}`)
    }

    const selectedOption = decisionPoint.options.find(opt => opt.id === optionId)
    if (!selectedOption) {
      throw new Error(`选项不存在: ${optionId}`)
    }

    decisionPoint.status = 'completed'
    decisionPoint.selectedOption = optionId
    decisionPoint.reason = reason
    decisionPoint.completedAt = Date.now()

    await this.updateStep(planId, stepId, { decisionPoints: step.decisionPoints })

    console.log(`[PlanService] 做出决策: ${planId}/${stepId}/${decisionPointId} -> ${optionId}`)
  }

  async getPlanProgress(planId: string): Promise<Progress> {
    const plan = await this.getPlan(planId)
    if (!plan) {
      throw new Error(`计划不存在: ${planId}`)
    }

    const totalSteps = plan.steps.length
    const completedSteps = plan.steps.filter(s => s.status === 'completed').length
    const inProgressSteps = plan.steps.filter(s => s.status === 'in_progress').length
    const failedSteps = plan.steps.filter(s => s.status === 'failed').length

    const percentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

    let estimatedTimeRemaining: number | undefined
    if (completedSteps > 0) {
      const avgTimePerStep = plan.steps
        .filter(s => s.status === 'completed' && s.metadata?.actualTime)
        .reduce((sum, s) => sum + (s.metadata?.actualTime || 0), 0) / completedSteps
      
      const remainingSteps = totalSteps - completedSteps
      estimatedTimeRemaining = avgTimePerStep * remainingSteps
    }

    return {
      totalSteps,
      completedSteps,
      inProgressSteps,
      failedSteps,
      percentage,
      estimatedTimeRemaining
    }
  }

  async logExecution(planId: string, stepId: string, log: string): Promise<void> {
    const step = await this.getStep(planId, stepId)
    if (!step) {
      throw new Error(`步骤不存在: ${stepId}`)
    }

    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${log}`

    step.logs.push(logEntry)

    await this.updateStep(planId, stepId, { logs: step.logs })
  }

  async getStep(planId: string, stepId: string): Promise<PlanStep | undefined> {
    const plan = await this.getPlan(planId)
    if (!plan) {
      return undefined
    }

    return plan.steps.find(s => s.id === stepId)
  }

  async getPendingDecisions(planId: string): Promise<Array<{
    stepId: string
    stepTitle: string
    decisionPoint: DecisionPoint
  }>> {
    const plan = await this.getPlan(planId)
    if (!plan) {
      return []
    }

    const pendingDecisions: Array<{
      stepId: string
      stepTitle: string
      decisionPoint: DecisionPoint
    }> = []

    for (const step of plan.steps) {
      for (const decisionPoint of step.decisionPoints) {
        if (decisionPoint.status === 'pending') {
          pendingDecisions.push({
            stepId: step.id,
            stepTitle: step.title,
            decisionPoint
          })
        }
      }
    }

    return pendingDecisions
  }

  private parsePlan(doc: Document): Plan {
    try {
      const lines = doc.content.split('\n')
      const plan: Plan = {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        steps: [],
        metadata: {
          goal: '',
          priority: 'medium',
          estimatedTime: 3600,
          risks: [],
          resources: [],
          tags: []
        },
        status: 'draft',
        createdAt: doc.metadata.createdAt,
        updatedAt: doc.metadata.updatedAt
      }

      let currentStep: PlanStep | null = null
      let currentDecisionPoint: DecisionPoint | null = null

      for (const line of lines) {
        if (line.startsWith('## 目标')) {
          plan.metadata.goal = lines[lines.indexOf(line) + 1].trim()
        } else if (line.startsWith('### 步骤')) {
          if (currentStep) {
            plan.steps.push(currentStep)
          }
          const stepTitle = line.replace('### 步骤', '').trim()
          currentStep = {
            id: crypto.randomBytes(16).toString('hex'),
            title: stepTitle,
            description: '',
            status: 'pending',
            dependencies: [],
            decisionPoints: [],
            logs: []
          }
        } else if (line.startsWith('#### 决策点')) {
          if (currentStep && currentDecisionPoint) {
            currentStep.decisionPoints.push(currentDecisionPoint)
          }
          const decisionTitle = line.replace('#### 决策点', '').trim()
          currentDecisionPoint = {
            id: crypto.randomBytes(16).toString('hex'),
            title: decisionTitle,
            description: '',
            status: 'pending',
            options: [],
            createdAt: Date.now()
          }
        }
      }

      if (currentStep) {
        if (currentDecisionPoint) {
          currentStep.decisionPoints.push(currentDecisionPoint)
        }
        plan.steps.push(currentStep)
      }

      return plan
    } catch (error) {
      console.error('[PlanService] 解析计划失败:', error)
      throw error
    }
  }

  private generatePlanContent(plan: Plan): string {
    const stepsContent = plan.steps.map((step, index) => {
      const statusEmoji = {
        pending: '⏳',
        in_progress: '🔄',
        completed: '✅',
        failed: '❌',
        skipped: '⏭️'
      }

      let content = `### 步骤${index + 1}: ${step.title} [${statusEmoji[step.status]} ${step.status}]\n`
      content += `**状态**: ${step.status}\n`
      if (step.executor) {
        content += `**执行者**: ${step.executor}\n`
      }
      if (step.startTime) {
        content += `**开始时间**: ${new Date(step.startTime).toISOString()}\n`
      }
      content += `\n**任务**:\n${step.description}\n`
      
      if (step.dependencies.length > 0) {
        content += `\n**依赖**: ${step.dependencies.join(', ')}\n`
      }

      if (step.decisionPoints.length > 0) {
        content += `\n**决策点**:\n`
        for (const dp of step.decisionPoints) {
          const dpStatusEmoji = dp.status === 'pending' ? '⏳' : '✅'
          content += `- [${dpStatusEmoji}] ${dp.title}\n`
          if (dp.status === 'completed' && dp.selectedOption) {
            const selectedOption = dp.options.find(opt => opt.id === dp.selectedOption)
            if (selectedOption) {
              content += `  - 选择: ${selectedOption.title}\n`
            }
          }
        }
      }

      if (step.logs.length > 0) {
        content += `\n**执行日志**:\n`
        for (const log of step.logs.slice(-5)) {
          content += `- ${log}\n`
        }
      }

      return content
    }).join('\n\n')

    return `# ${plan.title}

## 目标
${plan.metadata.goal}

## 元数据
- 状态: ${plan.status}
- 优先级: ${plan.metadata.priority}
- 预计时间: ${Math.floor(plan.metadata.estimatedTime / 60)} 分钟
- 创建时间: ${new Date(plan.createdAt).toISOString()}

## 步骤

${stepsContent}

## 风险与缓解
${plan.metadata.risks.map(risk => `- ${risk}`).join('\n') || '无'}

## 资源需求
${plan.metadata.resources.map(resource => `- ${resource}`).join('\n') || '无'}
`
  }
}

export const planService = new PlanService()
