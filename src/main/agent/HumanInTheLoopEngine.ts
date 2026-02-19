/**
 * 人机协作引擎
 * 实现人类在环(Human-in-the-Loop)的工作模式
 * 允许用户在AI执行过程中进行干预和审批
 */

import { EventEmitter } from 'events'
import { getMainWindow } from '../index'

// 干预类型
export enum InterventionType {
  APPROVAL = 'approval',           // 审批请求
  CONFIRMATION = 'confirmation',   // 确认请求
  CORRECTION = 'correction',       // 纠错请求
  CANCEL = 'cancel',               // 取消请求
  PAUSE = 'pause',                 // 暂停请求
  RESUME = 'resume',               // 恢复请求
  CUSTOM = 'custom'                // 自定义请求
}

// 风险级别
export enum RiskLevel {
  LOW = 'low',           // 低风险 - 自动执行
  MEDIUM = 'medium',     // 中风险 - 提示后执行
  HIGH = 'high',         // 高风险 - 需要审批
  CRITICAL = 'critical'  // 极高风险 - 需要明确确认
}

// 干预请求
export interface InterventionRequest {
  id: string
  type: InterventionType
  riskLevel: RiskLevel
  title: string
  description: string
  details?: any
  timestamp: number
  timeout?: number
  taskId?: string
  stepId?: string
  onResponse?: (response: InterventionResponse) => void
}

// 干预响应
export interface InterventionResponse {
  requestId: string
  approved: boolean
  response?: string
  modifiedValue?: any
  action: 'approve' | 'deny' | 'modify' | 'cancel' | 'timeout'
  timestamp: number
  userId?: string
}

// 审批规则
export interface ApprovalRule {
  id: string
  name: string
  description: string
  condition: (request: InterventionRequest) => boolean
  riskLevel: RiskLevel
  autoApprove: boolean
  notifyUser: boolean
}

// 待审批队列项
export interface PendingApproval {
  request: InterventionRequest
  createdAt: number
  expiresAt?: number
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'cancelled'
  response?: InterventionResponse
}

// 用户偏好类型
export interface UserPreference {
  tool: string
  riskLevel: RiskLevel
  approved: boolean
  timestamp: number
  context?: string
}

// 干预时机判断结果
export interface InterventionTimingDecision {
  shouldIntervene: boolean
  interventionType: InterventionType
  riskLevel: RiskLevel
  confidence: number
  reason: string
  optimalTiming?: 'immediate' | 'delayed' | 'after_action'
}

// 任务复杂度评估
export interface TaskComplexityAssessment {
  complexity: 'low' | 'medium' | 'high'
  factors: {
    toolComplexity: number
    parameterComplexity: number
    contextComplexity: number
  }
  confidence: number
}

// 人机协作引擎类
export class HumanInTheLoopEngine extends EventEmitter {
  private pendingApprovals: Map<string, PendingApproval> = new Map()
  private approvalRules: ApprovalRule[] = []
  private isEnabled: boolean = true
  private defaultTimeout: number = 300000 // 5分钟默认超时
  private autoApproveLowRisk: boolean = true
  private userPreferences: UserPreference[] = []
  private interventionHistory: { timestamp: number; type: InterventionType; riskLevel: RiskLevel; approved: boolean; tool: string }[] = []
  private complexityThresholds: {
    low: number
    medium: number
    high: number
  } = {
    low: 0.3,
    medium: 0.6,
    high: 0.8
  }

  constructor() {
    super()
    this.initializeDefaultRules()
  }

  /**
   * 初始化默认审批规则
   */
  private initializeDefaultRules(): void {
    this.approvalRules = [
      // 低风险操作自动批准
      {
        id: 'rule_read_operations',
        name: '读取操作',
        description: '读取文件、查看内容等操作',
        condition: (req) => {
          const tool = req.details?.tool
          return ['read_file', 'list_files', 'glob_paths', 'search_content', 'git_status', 'git_log'].includes(tool)
        },
        riskLevel: RiskLevel.LOW,
        autoApprove: true,
        notifyUser: false
      },
      // 中等风险需要确认
      {
        id: 'rule_write_operations',
        name: '写入操作',
        description: '写入文件、创建目录等操作',
        condition: (req) => {
          const tool = req.details?.tool
          return ['write_file', 'create_directory', 'clipboard_write'].includes(tool)
        },
        riskLevel: RiskLevel.MEDIUM,
        autoApprove: false,
        notifyUser: true
      },
      // 高风险需要审批
      {
        id: 'rule_destructive_operations',
        name: '破坏性操作',
        description: '删除文件、执行危险命令等',
        condition: (req) => {
          const tool = req.details?.tool
          const command = req.details?.parameters?.command || ''
          const isDestructive = command.includes('rm -rf') || 
                                command.includes('delete') ||
                                command.includes('drop table') ||
                                tool === 'kill_process'
          return isDestructive
        },
        riskLevel: RiskLevel.HIGH,
        autoApprove: false,
        notifyUser: true
      },
      // Git push需要审批
      {
        id: 'rule_git_push',
        name: 'Git推送',
        description: 'Git push操作',
        condition: (req) => {
          const command = req.details?.parameters?.command || ''
          return command.includes('git push') || command.includes('git push')
        },
        riskLevel: RiskLevel.HIGH,
        autoApprove: false,
        notifyUser: true
      },
      // 极高风险需要明确确认
      {
        id: 'rule_system_operations',
        name: '系统操作',
        description: '系统级操作',
        condition: (req) => {
          const tool = req.details?.tool
          return tool && ['kill_process', 'execute_command'].includes(tool)
        },
        riskLevel: RiskLevel.CRITICAL,
        autoApprove: false,
        notifyUser: true
      }
    ]
  }

  /**
   * 请求用户干预
   */
  async requestIntervention(
    type: InterventionType,
    title: string,
    description: string,
    details?: any,
    options?: {
      taskId?: string
      stepId?: string
      timeout?: number
      riskLevel?: RiskLevel
      onResponse?: (response: InterventionResponse) => void
    }
  ): Promise<InterventionResponse> {
    if (!this.isEnabled) {
      // 如果禁用，直接批准所有请求
      return {
        requestId: 'auto_approved',
        approved: true,
        action: 'approve',
        timestamp: Date.now()
      }
    }

    // 根据详情确定风险级别
    const riskLevel = options?.riskLevel || this.determineRiskLevel(details)

    // 检查是否需要自动批准
    if (this.shouldAutoApprove(riskLevel, details)) {
      this.emit('autoApproved', { title, riskLevel })
      return {
        requestId: 'auto_approved',
        approved: true,
        action: 'approve',
        timestamp: Date.now()
      }
    }

    // 创建干预请求
    const request: InterventionRequest = {
      id: `intervention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      riskLevel,
      title,
      description,
      details,
      timestamp: Date.now(),
      timeout: options?.timeout || this.defaultTimeout,
      taskId: options?.taskId,
      stepId: options?.stepId,
      onResponse: options?.onResponse
    }

    // 添加到待审批队列
    const pending: PendingApproval = {
      request,
      createdAt: Date.now(),
      expiresAt: request.timeout ? Date.now() + request.timeout : undefined,
      status: 'pending'
    }

    this.pendingApprovals.set(request.id, pending)

    // 发送请求到UI
    this.sendToUI(request)

    // 发出事件
    this.emit('interventionRequested', request)

    // 等待响应
    return new Promise((resolve) => {
      const checkResponse = () => {
        const current = this.pendingApprovals.get(request.id)
        if (current?.response) {
          resolve(current.response)
        } else if (current?.status === 'expired') {
          resolve({
            requestId: request.id,
            approved: false,
            action: 'timeout',
            timestamp: Date.now()
          })
        }
      }

      // 定期检查响应
      const interval = setInterval(() => {
        checkResponse()
        const current = this.pendingApprovals.get(request.id)
        if (current?.response || current?.status === 'expired') {
          clearInterval(interval)
        }
      }, 500)

      // 设置超时
      if (request.timeout) {
        setTimeout(() => {
          clearInterval(interval)
          const current = this.pendingApprovals.get(request.id)
          if (current?.status === 'pending') {
            current.status = 'expired'
            this.emit('interventionTimeout', request)
            resolve({
              requestId: request.id,
              approved: false,
              action: 'timeout',
              timestamp: Date.now()
            })
          }
        }, request.timeout)
      }
    })
  }

  /**
   * 确定风险级别
   */
  private determineRiskLevel(details?: any): RiskLevel {
    if (!details) return RiskLevel.LOW

    // 检查是否匹配高风险规则
    for (const rule of this.approvalRules) {
      if (rule.condition({ id: 'temp_id', details, riskLevel: RiskLevel.LOW, type: InterventionType.APPROVAL, title: '', description: '', timestamp: 0 })) {
        return rule.riskLevel
      }
    }

    return RiskLevel.LOW
  }

  /**
   * 检查是否应该自动批准
   */
  private shouldAutoApprove(riskLevel: RiskLevel, details?: any): boolean {
    if (!this.autoApproveLowRisk) return false
    if (riskLevel === RiskLevel.LOW) return true

    // 检查规则
    for (const rule of this.approvalRules) {
      if (rule.condition({ id: 'temp_id', details, riskLevel, type: InterventionType.APPROVAL, title: '', description: '', timestamp: 0 })) {
        return rule.autoApprove
      }
    }

    return false
  }

  /**
   * 发送干预请求到UI
   */
  private sendToUI(request: InterventionRequest): void {
    const mainWin = getMainWindow()
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('human-in-the-loop:request', request)
    }
  }

  /**
   * 处理用户响应
   */
  handleResponse(response: InterventionResponse): void {
    const pending = this.pendingApprovals.get(response.requestId)
    if (!pending) {
      console.warn('[HumanInTheLoop] No pending request found:', response.requestId)
      return
    }

    // 更新状态
    pending.response = response
    pending.status = response.approved ? 'approved' : 'denied'

    // 通知请求者
    if (pending.request.onResponse) {
      pending.request.onResponse(response)
    }

    // 发出事件
    this.emit('interventionResponded', response)

    // 清理过期请求
    setTimeout(() => {
      this.pendingApprovals.delete(response.requestId)
    }, 60000)
  }

  /**
   * 批准请求
   */
  approve(requestId: string, response?: string): void {
    this.handleResponse({
      requestId,
      approved: true,
      response,
      action: 'approve',
      timestamp: Date.now()
    })
  }

  /**
   * 拒绝请求
   */
  deny(requestId: string, reason?: string): void {
    this.handleResponse({
      requestId,
      approved: false,
      response: reason,
      action: 'deny',
      timestamp: Date.now()
    })
  }

  /**
   * 修改后批准
   */
  modify(requestId: string, modifiedValue: any, response?: string): void {
    this.handleResponse({
      requestId,
      approved: true,
      response,
      modifiedValue,
      action: 'modify',
      timestamp: Date.now()
    })
  }

  /**
   * 取消请求
   */
  cancel(requestId: string): void {
    const pending = this.pendingApprovals.get(requestId)
    if (pending) {
      pending.status = 'cancelled'
      this.handleResponse({
        requestId,
        approved: false,
        action: 'cancel',
        timestamp: Date.now()
      })
    }
  }

  /**
   * 获取待审批列表
   */
  getPendingApprovals(): InterventionRequest[] {
    const now = Date.now()
    const result: InterventionRequest[] = []

    for (const [_, pending] of this.pendingApprovals) {
      // 清理过期请求
      if (pending.expiresAt && pending.expiresAt < now) {
        pending.status = 'expired'
        continue
      }

      if (pending.status === 'pending') {
        result.push(pending.request)
      }
    }

    return result
  }

  /**
   * 检查是否有待审批请求
   */
  hasPendingApprovals(): boolean {
    return this.getPendingApprovals().length > 0
  }

  /**
   * 获取风险级别描述
   */
  getRiskLevelDescription(level: RiskLevel): string {
    const descriptions: Record<RiskLevel, string> = {
      [RiskLevel.LOW]: '低风险 - 操作安全，可自动执行',
      [RiskLevel.MEDIUM]: '中等风险 - 建议确认后执行',
      [RiskLevel.HIGH]: '高风险 - 需要明确审批',
      [RiskLevel.CRITICAL]: '极高风险 - 需要特别确认'
    }
    return descriptions[level]
  }

  /**
   * 添加自定义审批规则
   */
  addApprovalRule(rule: ApprovalRule): void {
    this.approvalRules.push(rule)
    this.emit('ruleAdded', rule)
  }

  /**
   * 移除审批规则
   */
  removeApprovalRule(ruleId: string): boolean {
    const index = this.approvalRules.findIndex(r => r.id === ruleId)
    if (index !== -1) {
      this.approvalRules.splice(index, 1)
      this.emit('ruleRemoved', ruleId)
      return true
    }
    return false
  }

  /**
   * 获取所有审批规则
   */
  getApprovalRules(): ApprovalRule[] {
    return [...this.approvalRules]
  }

  /**
   * 启用/禁用
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    this.emit('enabledChanged', enabled)
  }

  /**
   * 是否启用
   */
  isUserEnabled(): boolean {
    return this.isEnabled
  }

  /**
   * 设置低风险自动批准
   */
  setAutoApproveLowRisk(autoApprove: boolean): void {
    this.autoApproveLowRisk = autoApprove
  }

  /**
   * 设置默认超时时间
   */
  setDefaultTimeout(timeoutMs: number): void {
    this.defaultTimeout = timeoutMs
  }

  /**
   * 创建任务执行包装器 - 在执行高风险操作前请求用户确认
   */
  async wrapWithApproval<T>(
    operation: () => Promise<T>,
    details: {
      title: string
      description: string
      tool?: string
      parameters?: any
    }
  ): Promise<T> {
    const riskLevel = this.determineRiskLevel(details)

    // 如果是低风险或应该自动批准，直接执行
    if (this.shouldAutoApprove(riskLevel, details)) {
      return operation()
    }

    // 请求用户审批
    const response = await this.requestIntervention(
      InterventionType.APPROVAL,
      details.title,
      details.description,
      { tool: details.tool, parameters: details.parameters },
      { riskLevel }
    )

    if (!response.approved) {
      throw new Error(`Operation denied by user: ${response.response || 'No reason provided'}`)
    }

    // 如果用户修改了参数，使用修改后的参数
    if (response.modifiedValue && details.parameters) {
      Object.assign(details.parameters, response.modifiedValue)
    }

    return operation()
  }

  /**
   * 发送确认提示
   */
  async confirm(title: string, message: string): Promise<boolean> {
    const response = await this.requestIntervention(
      InterventionType.CONFIRMATION,
      title,
      message
    )
    return response.approved
  }

  /**
   * 发送通知（不需要响应）
   */
  notify(title: string, message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    const mainWin = getMainWindow()
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('human-in-the-loop:notification', { title, message, type })
    }
    this.emit('notification', { title, message, type })
  }

  /**
   * 评估任务复杂度
   */
  assessTaskComplexity(tool: string, parameters: any, context?: string): TaskComplexityAssessment {
    // 工具复杂度评估
    const toolComplexityScores: Record<string, number> = {
      'execute_command': 0.9,
      'write_file': 0.7,
      'delete_file': 0.8,
      'delete_directory': 0.85,
      'install_package': 0.75,
      'read_file': 0.3,
      'list_files': 0.2,
      'glob_paths': 0.3,
      'search_content': 0.4,
      'git_status': 0.3,
      'git_log': 0.3,
      'git_commit': 0.5,
      'git_push': 0.7,
      'clipboard_write': 0.4,
      'create_directory': 0.5
    }

    // 计算工具复杂度
    const toolComplexity = toolComplexityScores[tool] || 0.5

    // 计算参数复杂度
    let parameterComplexity = 0
    if (parameters) {
      const paramStr = JSON.stringify(parameters)
      parameterComplexity = Math.min(paramStr.length / 1000, 1)
    }

    // 计算上下文复杂度
    let contextComplexity = 0
    if (context) {
      contextComplexity = Math.min(context.length / 2000, 1)
    }

    // 计算总复杂度分数
    const totalScore = (toolComplexity * 0.5) + (parameterComplexity * 0.3) + (contextComplexity * 0.2)

    // 确定复杂度级别
    let complexity: 'low' | 'medium' | 'high'
    if (totalScore >= this.complexityThresholds.high) {
      complexity = 'high'
    } else if (totalScore >= this.complexityThresholds.medium) {
      complexity = 'medium'
    } else {
      complexity = 'low'
    }

    return {
      complexity,
      factors: {
        toolComplexity,
        parameterComplexity,
        contextComplexity
      },
      confidence: Math.min(totalScore * 0.8 + 0.2, 1.0)
    }
  }

  /**
   * 预测干预结果
   */
  predictInterventionOutcome(tool: string, riskLevel: RiskLevel, complexity: 'low' | 'medium' | 'high'): {
    approved: boolean
    confidence: number
    factors: string[]
  } {
    const factors: string[] = []

    // 基于风险级别的预测
    let baseApprovalRate = 0
    switch (riskLevel) {
      case RiskLevel.LOW:
        baseApprovalRate = 0.95
        factors.push('低风险操作')
        break
      case RiskLevel.MEDIUM:
        baseApprovalRate = 0.8
        factors.push('中等风险操作')
        break
      case RiskLevel.HIGH:
        baseApprovalRate = 0.6
        factors.push('高风险操作')
        break
      case RiskLevel.CRITICAL:
        baseApprovalRate = 0.4
        factors.push('极高风险操作')
        break
    }

    // 基于复杂度的调整
    let complexityAdjustment = 0
    switch (complexity) {
      case 'high':
        complexityAdjustment = -0.1
        factors.push('高复杂度任务')
        break
      case 'medium':
        complexityAdjustment = -0.05
        factors.push('中等复杂度任务')
        break
      case 'low':
        complexityAdjustment = 0.05
        factors.push('低复杂度任务')
        break
    }

    // 基于用户历史偏好的调整
    const userPreference = this.getUserPreference(tool, riskLevel)
    let preferenceAdjustment = 0
    if (userPreference) {
      preferenceAdjustment = userPreference.approved ? 0.1 : -0.1
      factors.push(`用户历史偏好: ${userPreference.approved ? '批准' : '拒绝'}`)
    }

    // 计算最终批准概率
    let finalApprovalRate = baseApprovalRate + complexityAdjustment + preferenceAdjustment
    finalApprovalRate = Math.max(0.1, Math.min(0.99, finalApprovalRate))

    // 做出预测
    const approved = finalApprovalRate > 0.5
    const confidence = Math.abs(finalApprovalRate - 0.5) * 2 // 0-1

    return {
      approved,
      confidence,
      factors
    }
  }

  /**
   * 确定最佳干预时机
   */
  determineOptimalInterventionTiming(riskLevel: RiskLevel, complexity: 'low' | 'medium' | 'high'): 'immediate' | 'delayed' | 'after_action' {
    if (riskLevel === RiskLevel.CRITICAL) {
      return 'immediate' // 极高风险立即干预
    }

    if (riskLevel === RiskLevel.HIGH || (riskLevel === RiskLevel.MEDIUM && complexity === 'high')) {
      return 'immediate' // 高风险或中等风险+高复杂度立即干预
    }

    if (riskLevel === RiskLevel.MEDIUM && complexity === 'medium') {
      return 'delayed' // 中等风险+中等复杂度延迟干预
    }

    return 'after_action' // 其他情况在操作后干预
  }

  /**
   * 做出干预决策
   */
  makeInterventionDecision(tool: string, parameters: any, context?: string): InterventionTimingDecision {
    // 评估任务复杂度
    const complexityAssessment = this.assessTaskComplexity(tool, parameters, context)

    // 确定风险级别
    const riskLevel = this.determineRiskLevel({ tool, parameters })

    // 预测干预结果
    const outcomePrediction = this.predictInterventionOutcome(tool, riskLevel, complexityAssessment.complexity)

    // 确定最佳干预时机
    const optimalTiming = this.determineOptimalInterventionTiming(riskLevel, complexityAssessment.complexity)

    // 决定是否需要干预
    let shouldIntervene = true
    let interventionType = InterventionType.APPROVAL
    let confidence = 0
    let reason = ''

    if (riskLevel === RiskLevel.LOW && complexityAssessment.complexity === 'low') {
      shouldIntervene = false
      confidence = 0.9
      reason = '低风险低复杂度操作，无需干预'
    } else if (outcomePrediction.confidence > 0.8 && outcomePrediction.approved) {
      // 如果预测用户会批准且信心很高，考虑自动批准
      if (riskLevel <= RiskLevel.MEDIUM) {
        shouldIntervene = false
        confidence = outcomePrediction.confidence
        reason = `预测用户会批准（信心: ${(outcomePrediction.confidence * 100).toFixed(0)}%），自动执行`
      } else {
        shouldIntervene = true
        confidence = outcomePrediction.confidence
        reason = `高风险操作，需要用户确认`
      }
    } else {
      shouldIntervene = true
      confidence = 0.8
      reason = `需要用户干预: ${outcomePrediction.factors.join('; ')}`
    }

    return {
      shouldIntervene,
      interventionType,
      riskLevel,
      confidence,
      reason,
      optimalTiming
    }
  }

  /**
   * 获取用户偏好
   */
  private getUserPreference(tool: string, riskLevel: RiskLevel): UserPreference | null {
    // 查找最近的相关用户偏好
    const recentPreferences = this.userPreferences
      .filter(p => p.tool === tool && p.riskLevel === riskLevel)
      .sort((a, b) => b.timestamp - a.timestamp)

    return recentPreferences[0] || null
  }

  /**
   * 从用户响应中学习
   */
  learnFromUserResponse(tool: string, riskLevel: RiskLevel, approved: boolean, context?: string): void {
    // 添加新的用户偏好
    const preference: UserPreference = {
      tool,
      riskLevel,
      approved,
      timestamp: Date.now(),
      context
    }

    this.userPreferences.push(preference)

    // 限制偏好数量，只保留最近的100条
    if (this.userPreferences.length > 100) {
      this.userPreferences = this.userPreferences.slice(-100)
    }

    // 添加到干预历史
    this.interventionHistory.push({
      timestamp: Date.now(),
      type: InterventionType.APPROVAL,
      riskLevel,
      approved,
      tool
    })

    // 限制历史记录数量，只保留最近的500条
    if (this.interventionHistory.length > 500) {
      this.interventionHistory = this.interventionHistory.slice(-500)
    }

    // 发出学习事件
    this.emit('userPreferenceLearned', preference)
  }

  /**
   * 分析干预历史
   */
  analyzeInterventionHistory(days: number = 7): {
    totalInterventions: number
    approvalRate: number
    byRiskLevel: Record<RiskLevel, number>
    byTool: Record<string, number>
    trends: {
      timestamp: number
      approvalRate: number
    }[]
  } {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000)
    const recentHistory = this.interventionHistory.filter(h => h.timestamp >= cutoffTime)

    // 计算总干预次数和批准率
    const totalInterventions = recentHistory.length
    const approvedCount = recentHistory.filter(h => h.approved).length
    const approvalRate = totalInterventions > 0 ? approvedCount / totalInterventions : 0

    // 按风险级别统计
    const byRiskLevel: Record<RiskLevel, number> = {
      [RiskLevel.LOW]: 0,
      [RiskLevel.MEDIUM]: 0,
      [RiskLevel.HIGH]: 0,
      [RiskLevel.CRITICAL]: 0
    }

    for (const h of recentHistory) {
      byRiskLevel[h.riskLevel]++
    }

    // 按工具统计
    const byTool: Record<string, number> = {}
    for (const h of recentHistory) {
      byTool[h.tool] = (byTool[h.tool] || 0) + 1
    }

    // 计算趋势（按天）
    const trends: {
      timestamp: number
      approvalRate: number
    }[] = []

    // 按天分组
    const dailyGroups: Record<string, { approved: number; total: number }> = {}
    for (const h of recentHistory) {
      const day = new Date(h.timestamp).toISOString().split('T')[0]
      if (!dailyGroups[day]) {
        dailyGroups[day] = { approved: 0, total: 0 }
      }
      dailyGroups[day].total++
      if (h.approved) {
        dailyGroups[day].approved++
      }
    }

    // 生成趋势数据
    Object.entries(dailyGroups).forEach(([day, data]) => {
      trends.push({
        timestamp: new Date(day).getTime(),
        approvalRate: data.approved / data.total
      })
    })

    // 按时间排序
    trends.sort((a, b) => a.timestamp - b.timestamp)

    return {
      totalInterventions,
      approvalRate,
      byRiskLevel,
      byTool,
      trends
    }
  }

  /**
   * 智能干预包装器
   */
  async smartInterventionWrap<T>(
    operation: () => Promise<T>,
    tool: string,
    parameters: any,
    context?: string
  ): Promise<T> {
    // 做出干预决策
    const decision = this.makeInterventionDecision(tool, parameters, context)

    // 如果不需要干预，直接执行
    if (!decision.shouldIntervene) {
      this.emit('autoApproved', { tool, riskLevel: decision.riskLevel, reason: decision.reason })
      return operation()
    }

    // 预测干预结果
    const prediction = this.predictInterventionOutcome(tool, decision.riskLevel, this.assessTaskComplexity(tool, parameters, context).complexity)

    // 构建干预请求
    const riskDescription = this.getRiskLevelDescription(decision.riskLevel)
    const title = `需要干预: ${tool}`
    const description = `${riskDescription}\n\n操作: ${tool}\n\n预测结果: ${prediction.approved ? '可能批准' : '可能拒绝'} (信心: ${(prediction.confidence * 100).toFixed(0)}%)\n\n因素: ${prediction.factors.join('; ')}`

    // 发送干预请求
    const response = await this.requestIntervention(
      decision.interventionType,
      title,
      description,
      { tool, parameters, context, prediction },
      { riskLevel: decision.riskLevel }
    )

    // 从用户响应中学习
    this.learnFromUserResponse(tool, decision.riskLevel, response.approved, context)

    if (!response.approved) {
      throw new Error(`Operation denied by user: ${response.response || 'No reason provided'}`)
    }

    // 如果用户修改了参数，使用修改后的参数
    if (response.modifiedValue && parameters) {
      Object.assign(parameters, response.modifiedValue)
    }

    // 执行操作
    return operation()
  }

  /**
   * 获取用户偏好统计
   */
  getUserPreferenceStats(): {
    totalPreferences: number
    approvalRate: number
    byTool: Record<string, { approved: number; total: number }>
  } {
    const totalPreferences = this.userPreferences.length
    const approvedCount = this.userPreferences.filter(p => p.approved).length
    const approvalRate = totalPreferences > 0 ? approvedCount / totalPreferences : 0

    // 按工具统计
    const byTool: Record<string, { approved: number; total: number }> = {}
    for (const pref of this.userPreferences) {
      if (!byTool[pref.tool]) {
        byTool[pref.tool] = { approved: 0, total: 0 }
      }
      byTool[pref.tool].total++
      if (pref.approved) {
        byTool[pref.tool].approved++
      }
    }

    return {
      totalPreferences,
      approvalRate,
      byTool
    }
  }

  /**
   * 重置用户偏好
   */
  resetUserPreferences(): void {
    this.userPreferences = []
    this.interventionHistory = []
    this.emit('preferencesReset')
  }

  /**
   * 设置复杂度阈值
   */
  setComplexityThresholds(thresholds: {
    low: number
    medium: number
    high: number
  }): void {
    this.complexityThresholds = thresholds
  }

  /**
   * 获取复杂度阈值
   */
  getComplexityThresholds(): {
    low: number
    medium: number
    high: number
  } {
    return { ...this.complexityThresholds }
  }
}

// 导出单例
export const humanInTheLoopEngine = new HumanInTheLoopEngine()
