import { documentService, Document, DocumentType, DocumentStatus } from './DocumentService'
import { DecisionOption } from './PlanService'
import * as crypto from 'crypto'

export interface Decision {
  id: string
  title: string
  description: string
  planId: string
  stepId: string
  status: 'pending' | 'completed' | 'cancelled'
  options: DecisionOption[]
  selectedOption?: string
  reason?: string
  createdAt: number
  completedAt?: number
  createdBy: string
  completedBy?: string
  metadata?: {
    priority?: 'low' | 'medium' | 'high'
    tags?: string[]
  }
}

export interface DecisionRequest {
  planId: string
  stepId: string
  title: string
  description: string
  options: DecisionOption[]
  metadata?: {
    priority?: 'low' | 'medium' | 'high'
    tags?: string[]
  }
}

export class DecisionService {
  private pendingDecisions: Map<string, Decision> = new Map()
  private eventCallbacks: Map<string, (decision: Decision) => void> = new Map()

  async createDecision(request: DecisionRequest): Promise<string> {
    const now = Date.now()
    const decisionId = crypto.randomBytes(16).toString('hex')

    const decision: Decision = {
      id: decisionId,
      title: request.title,
      description: request.description,
      planId: request.planId,
      stepId: request.stepId,
      status: 'pending',
      options: request.options,
      createdAt: now,
      createdBy: 'agent:project-manager',
      metadata: request.metadata
    }

    this.pendingDecisions.set(decisionId, decision)

    await documentService.createDocument({
      id: decisionId,
      type: DocumentType.DECISION,
      title: `决策记录: ${request.title}`,
      content: this.generateDecisionContent(decision),
      metadata: {
        status: DocumentStatus.ACTIVE,
        tags: request.metadata?.tags || [],
        createdBy: 'agent:project-manager',
        createdAt: now,
        updatedAt: now,
        version: 1
      },
      relations: {
        dependencies: [request.planId],
        related: [],
        decisions: []
      }
    })

    console.log(`[DecisionService] 创建决策: ${decisionId}`)
    this.notifyDecisionRequested(decision)

    return decisionId
  }

  async getDecision(decisionId: string): Promise<Decision | undefined> {
    const doc = await documentService.getDocument(decisionId)
    if (!doc || doc.type !== DocumentType.DECISION) {
      return undefined
    }

    return this.parseDecision(doc)
  }

  async makeDecision(
    decisionId: string,
    optionId: string,
    reason?: string,
    userId: string = 'user'
  ): Promise<Decision> {
    const decision = this.pendingDecisions.get(decisionId)
    if (!decision) {
      throw new Error(`决策不存在或已完成: ${decisionId}`)
    }

    const selectedOption = decision.options.find(opt => opt.id === optionId)
    if (!selectedOption) {
      throw new Error(`选项不存在: ${optionId}`)
    }

    decision.status = 'completed'
    decision.selectedOption = optionId
    decision.reason = reason
    decision.completedAt = Date.now()
    decision.completedBy = userId

    this.pendingDecisions.delete(decisionId)

    await documentService.updateDocument(decisionId, {
      content: this.generateDecisionContent(decision),
      metadata: {
        ...((await documentService.getDocument(decisionId))!.metadata),
        status: DocumentStatus.COMPLETED,
        updatedAt: Date.now(),
        version: (await documentService.getDocument(decisionId))!.metadata.version + 1
      }
    })

    console.log(`[DecisionService] 做出决策: ${decisionId} -> ${optionId}`)
    this.notifyDecisionCompleted(decision)

    return decision
  }

  async cancelDecision(decisionId: string, _reason?: string): Promise<void> {
    const decision = this.pendingDecisions.get(decisionId)
    if (!decision) {
      throw new Error(`决策不存在或已完成: ${decisionId}`)
    }

    decision.status = 'cancelled'
    this.pendingDecisions.delete(decisionId)

    await documentService.updateDocument(decisionId, {
      content: this.generateDecisionContent(decision),
      metadata: {
        ...((await documentService.getDocument(decisionId))!.metadata),
        status: DocumentStatus.ARCHIVED,
        updatedAt: Date.now(),
        version: (await documentService.getDocument(decisionId))!.metadata.version + 1
      }
    })

    console.log(`[DecisionService] 取消决策: ${decisionId}`)
  }

  async getDecisionsByPlan(planId: string): Promise<Decision[]> {
    const docs = await documentService.searchDocuments({
      type: DocumentType.DECISION
    })

    const decisions: Decision[] = []
    for (const doc of docs) {
      const decision = this.parseDecision(doc)
      if (decision && decision.planId === planId) {
        decisions.push(decision)
      }
    }

    return decisions.sort((a, b) => a.createdAt - b.createdAt)
  }

  async getPendingDecisions(planId?: string): Promise<Decision[]> {
    const decisions = Array.from(this.pendingDecisions.values())

    if (planId) {
      return decisions.filter(d => d.planId === planId)
    }

    return decisions
  }

  private parseDecision(doc: Document): Decision | undefined {
    try {
      const lines = doc.content.split('\n')
      const decision: Decision = {
        id: doc.id,
        title: doc.title.replace('决策记录: ', ''),
        description: '',
        planId: '',
        stepId: '',
        status: 'pending',
        options: [],
        createdAt: doc.metadata.createdAt,
        createdBy: doc.metadata.createdBy
      }

      let currentOption: DecisionOption | null = null

      for (const line of lines) {
        if (line.startsWith('## 决策信息')) {
          const decisionIdLine = lines.find(l => l.startsWith('- 决策ID:'))
          if (decisionIdLine) {
            const parts = decisionIdLine.split(':')
            decision.id = parts[1]?.trim() || decision.id
          }

          const planIdLine = lines.find(l => l.startsWith('- 关联计划:'))
          if (planIdLine) {
            const parts = planIdLine.split(':')
            decision.planId = parts[1]?.trim() || ''
          }

          const stepIdLine = lines.find(l => l.startsWith('- 关联步骤:'))
          if (stepIdLine) {
            const parts = stepIdLine.split(':')
            decision.stepId = parts[1]?.trim() || ''
          }

          const statusLine = lines.find(l => l.startsWith('- 状态:'))
          if (statusLine) {
            const parts = statusLine.split(':')
            const status = parts[1]?.trim()
            if (status === '已完成' || status === 'completed') {
              decision.status = 'completed'
            } else if (status === '已取消' || status === 'cancelled') {
              decision.status = 'cancelled'
            }
          }
        } else if (line.startsWith('## 问题描述')) {
          const descIndex = lines.indexOf(line)
          decision.description = lines.slice(descIndex + 1, descIndex + 5).join('\n').trim()
        } else if (line.startsWith('### 选项')) {
          if (currentOption) {
            decision.options.push(currentOption)
          }
          const optionTitle = line.replace('### 选项', '').trim()
          currentOption = {
            id: crypto.randomBytes(8).toString('hex'),
            title: optionTitle,
            description: '',
            pros: [],
            cons: []
          }
        } else if (line.startsWith('**优点**')) {
          if (currentOption) {
            const prosIndex = lines.indexOf(line)
            const prosLines = lines.slice(prosIndex + 1, prosIndex + 4)
            currentOption.pros = prosLines.filter(l => l.startsWith('-')).map(l => l.replace('-', '').trim())
          }
        } else if (line.startsWith('**缺点**')) {
          if (currentOption) {
            const consIndex = lines.indexOf(line)
            const consLines = lines.slice(consIndex + 1, consIndex + 4)
            currentOption.cons = consLines.filter(l => l.startsWith('-')).map(l => l.replace('-', '').trim())
          }
        }
      }

      if (currentOption) {
        decision.options.push(currentOption)
      }

      const finalDecisionLine = lines.find(l => l.startsWith('## 最终决策'))
      if (finalDecisionLine) {
        const finalDecisionIndex = lines.indexOf(finalDecisionLine)
        const choiceLine = lines[finalDecisionIndex + 1]
        if (choiceLine?.startsWith('**选择**:')) {
          const choice = choiceLine.replace('**选择**:', '').trim()
          decision.selectedOption = choice
        }

        const reasonLine = lines[finalDecisionIndex + 2]
        if (reasonLine?.startsWith('**理由**:')) {
          decision.reason = reasonLine.replace('**理由**:', '').trim()
        }
      }

      return decision
    } catch (error) {
      console.error('[DecisionService] 解析决策失败:', error)
      return undefined
    }
  }

  private generateDecisionContent(decision: Decision): string {
    const optionsContent = decision.options.map((option, index) => {
      const recommendationStars = option.recommendation ? '⭐'.repeat(option.recommendation) : ''
      
      return `### 选项${String.fromCharCode(65 + index)}: ${option.title}

**优点**:
${option.pros.map(pro => `- ${pro}`).join('\n') || '无'}

**缺点**:
${option.cons.map(con => `- ${con}`).join('\n') || '无'}

${recommendationStars && option.recommendation ? `**智能体推荐**: ${recommendationStars}\n**理由**: ${this.getRecommendationReason(option.recommendation)}\n` : ''}

[选择此选项]
`
    }).join('\n\n')

    const finalDecisionSection = decision.status === 'completed' ? `
## 最终决策
**选择**: ${decision.selectedOption}
**理由**: ${decision.reason || '无'}
**决策者**: ${decision.completedBy}
**决策时间**: ${new Date(decision.completedAt!).toISOString()}

## 影响范围
- 步骤: ${decision.stepId}
- 计划: ${decision.planId}

## 后续行动
- [ ] 根据决策更新计划
- [ ] 通知相关智能体
- [ ] 记录决策结果
` : ''

    return `# 决策记录: ${decision.title}

## 决策信息
- 决策ID: ${decision.id}
- 决策时间: ${new Date(decision.createdAt).toISOString()}
- 决策者: ${decision.createdBy}
- 关联计划: ${decision.planId}
- 关联步骤: ${decision.stepId}
- 状态: ${decision.status === 'pending' ? '待决策' : decision.status === 'completed' ? '已完成' : '已取消'}

## 问题描述
${decision.description}

${optionsContent}

${finalDecisionSection}
`
  }

  private getRecommendationReason(recommendation: number): string {
    switch (recommendation) {
      case 5:
        return '强烈推荐，完全符合需求'
      case 4:
        return '推荐，大部分符合需求'
      case 3:
        return '可以考虑，有一定优势'
      case 2:
        return '不太推荐，存在明显缺点'
      case 1:
        return '不推荐，严重不符合需求'
      default:
        return ''
    }
  }

  private notifyDecisionRequested(decision: Decision): void {
    console.log(`[DecisionService] 通知决策请求: ${decision.id}`)
    
    for (const [callbackId, callback] of this.eventCallbacks) {
      try {
        callback(decision)
      } catch (error) {
        console.error(`[DecisionService] 回调执行失败 ${callbackId}:`, error)
      }
    }
  }

  private notifyDecisionCompleted(decision: Decision): void {
    console.log(`[DecisionService] 通知决策完成: ${decision.id}`)
    
    for (const [callbackId, callback] of this.eventCallbacks) {
      try {
        callback(decision)
      } catch (error) {
        console.error(`[DecisionService] 回调执行失败 ${callbackId}:`, error)
      }
    }
  }

  onDecisionRequested(callback: (decision: Decision) => void): string {
    const callbackId = crypto.randomBytes(8).toString('hex')
    this.eventCallbacks.set(callbackId, callback)
    return callbackId
  }

  onDecisionCompleted(callback: (decision: Decision) => void): string {
    const callbackId = crypto.randomBytes(8).toString('hex')
    this.eventCallbacks.set(callbackId, callback)
    return callbackId
  }

  offDecision(callbackId: string): void {
    this.eventCallbacks.delete(callbackId)
  }

  getStatistics(): {
    total: number
    pending: number
    completed: number
    cancelled: number
    byPriority: Record<string, number>
  } {
    const allDecisions = Array.from(this.pendingDecisions.values())
    
    const byPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0
    }

    for (const decision of allDecisions) {
      if (decision.metadata?.priority) {
        byPriority[decision.metadata.priority]++
      }
    }

    return {
      total: allDecisions.length,
      pending: allDecisions.filter(d => d.status === 'pending').length,
      completed: allDecisions.filter(d => d.status === 'completed').length,
      cancelled: allDecisions.filter(d => d.status === 'cancelled').length,
      byPriority
    }
  }
}

export const decisionService = new DecisionService()
