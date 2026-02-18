/**
 * 人机协作引擎
 * 实现人类在环(Human-in-the-Loop)的工作模式
 * 允许用户在AI执行过程中进行干预和审批
 */

import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import { getMainWindow } from '../index'
import { ErrorHandler, ErrorCategory } from '../utils/ErrorHandler'

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

// 人机协作引擎类
export class HumanInTheLoopEngine extends EventEmitter {
  private pendingApprovals: Map<string, PendingApproval> = new Map()
  private approvalRules: ApprovalRule[] = []
  private isEnabled: boolean = true
  private defaultTimeout: number = 300000 // 5分钟默认超时
  private autoApproveLowRisk: boolean = true

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
          const tool = req.details?.tool
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
          return ['kill_process', 'execute_command'].includes(tool)
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
      if (rule.condition({ details, riskLevel: RiskLevel.LOW, type: InterventionType.APPROVAL, title: '', description: '', timestamp: 0 })) {
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
      if (rule.condition({ details, riskLevel, type: InterventionType.APPROVAL, title: '', description: '', timestamp: 0 })) {
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

    for (const [id, pending] of this.pendingApprovals) {
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
}

// 导出单例
export const humanInTheLoopEngine = new HumanInTheLoopEngine()
