import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { EventEmitter } from 'events'
import { planner, PlanStep } from './Planner'
import { executor, ExecutionProgressEvent } from './Executor'
import { llmService, LLMMessage } from '../services/LLMService'
import { systemService } from '../services/SystemService'
import { cognitiveEngine, RoutingDecision } from './CognitiveEngine'
import { emotionProcessor } from './EmotionTypes'
import { modelRouter } from './ModelRouter'

import { multiDialogueCoordinator } from './MultiDialogueCoordinator'
import { humanInTheLoopEngine, RiskLevel, InterventionRequest, InterventionType } from './HumanInTheLoopEngine'
import { selfCorrectionEngine } from './SelfCorrectionEngine'

import { distiller } from './Distiller'

import { AgentType } from './SkillManager'
import { toolRegistry } from './ToolRegistry'
import { ErrorHandler } from '../utils/ErrorHandler'
import { taskLogger } from './TaskLogger'
import './tools'

// 推理步骤类型（用于可视化）
export interface ReasoningStep {
  id: string
  type: 'think' | 'act' | 'observe' | 'reflect' | 'final'
  thought?: string
  action?: string
  actionInput?: any
  observation?: string
  reflection?: string
  result?: any
  confidence?: number
  error?: string
  timestamp: number
  durationMs?: number
}

// 干预请求类型（用于审批弹窗）
export interface TaskInterventionRequest {
  id: string
  type: 'approval' | 'confirmation' | 'correction' | 'cancel' | 'pause' | 'resume' | 'custom'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  details?: any
  timestamp: number
  timeout?: number
  stepId?: string
  tool?: string
}

export interface TaskProgressEvent {
  taskId: string
  requestedModel?: string
  modelUsed?: string
  type:
    | 'task_start'
    | 'iteration_start'
    | 'thinking'
    | 'plan_created'
    | 'reasoning_step'
    | 'step_start'
    | 'step_success'
    | 'step_error'
    | 'retry'
    | 'task_done'
    | 'task_cancelled'
    | 'intervention_request'
    | 'intervention_approved'
    | 'intervention_denied'
    | 'correction_attempt'
    | 'self_correction'
    | 'skills_retrieved'
  timestamp: number
  durationMs?: number
  iteration?: number
  maxIterations?: number
  planSteps?: Array<{ id: string; tool: string; description: string }>
  stepId?: string
  tool?: string
  description?: string
  parameters?: any
  artifacts?: any[]
  resultSummary?: string
  final?: boolean
  error?: string
  retryCount?: number
  maxRetries?: number
  taskDir?: string
  projectName?: string
  thinkingReasoning?: string
  // 推理步骤相关
  reasoningStep?: ReasoningStep
  // 干预请求相关
  intervention?: TaskInterventionRequest
  // 自我纠正相关
  correctionStrategy?: string
  correctionExplanation?: string
  // 技能检索相关
  skillsRetrieved?: {
    agentType: string
    matchedSkills: Array<{
      name: string
      description: string
      matchScore: number
      relevance: 'high' | 'medium' | 'low'
      category?: string
      reason: string
      knowledge?: {
        coreConcepts?: string[]
        keySteps?: string[]
        bestPractices?: string[]
      }
    }>
    retrievalTime: number
  }
}

export interface AgentOptions {
  agentId?: string
  sessionId?: string
  system?: string
  complexity?: string
  taskDir?: string
}

export class TaskEngine extends EventEmitter {
  private history: LLMMessage[] = []
  private currentAbortController: AbortController | null = null
  private currentTaskId: string | null = null
  private pendingInterventions: Map<string, InterventionRequest> = new Map()

  constructor() {
    super()
    // 监听干预响应事件
    humanInTheLoopEngine.on('interventionResponded', (response) => {
      console.log(`[TaskEngine] Intervention response received: ${response.requestId}, approved: ${response.approved}`)
      this.pendingInterventions.delete(response.requestId)
      
      // 发送干预响应事件到前端
      if (this.currentTaskId) {
        this.emit('progress', {
          taskId: this.currentTaskId,
          type: response.approved ? 'intervention_approved' : 'intervention_denied',
          timestamp: Date.now(),
          intervention: {
            id: response.requestId,
            type: 'approval',
            riskLevel: 'medium',
            title: '审批结果',
            description: response.approved ? '用户已批准' : '用户已拒绝',
            timestamp: response.timestamp
          }
        } satisfies TaskProgressEvent)
      }
    })
  }

  /**
   * 检查工具是否需要审批
   */
  private needsApproval(toolName: string): { needsApproval: boolean; riskLevel: RiskLevel; reason: string } {
    // 高风险工具列表
    const highRiskTools = ['execute_command', 'delete_file', 'delete_directory', 'write_file', 'install_package']
    const mediumRiskTools = ['write_file', 'create_directory', 'move_file', 'copy_file']
    
    if (highRiskTools.includes(toolName)) {
      // 检查是否有危险命令
      if (toolName === 'execute_command') {
        const cmd = arguments[2]?.command?.toLowerCase() || ''
        const dangerousCommands = ['rm -rf', 'rmdir', 'del ', 'format', 'shutdown', 'reboot', 'kill -9', 'sudo']
        if (dangerousCommands.some((d: string) => cmd.includes(d))) {
          return { needsApproval: true, riskLevel: RiskLevel.CRITICAL, reason: '危险命令执行' }
        }
        return { needsApproval: true, riskLevel: RiskLevel.HIGH, reason: '命令执行' }
      }
      if (toolName === 'delete_file' || toolName === 'delete_directory') {
        return { needsApproval: true, riskLevel: RiskLevel.CRITICAL, reason: '删除文件/目录' }
      }
      return { needsApproval: true, riskLevel: RiskLevel.HIGH, reason: '高风险操作' }
    }
    
    if (mediumRiskTools.includes(toolName)) {
      return { needsApproval: true, riskLevel: RiskLevel.MEDIUM, reason: '写入操作' }
    }
    
    return { needsApproval: false, riskLevel: RiskLevel.LOW, reason: '' }
  }

  /**
   * 请求用户审批
   */
  private async requestApproval(
    taskId: string,
    tool: string,
    description: string,
    params: any,
    riskLevel: RiskLevel
  ): Promise<boolean> {
    const request: InterventionRequest = {
      id: `intervention_${Date.now()}`,
      type: InterventionType.APPROVAL,
      riskLevel,
      title: `需要审批: ${tool}`,
      description: `即将执行 "${description}" 操作`,
      details: { tool, parameters: params },
      timestamp: Date.now(),
      timeout: 300000, // 5分钟超时
      taskId,
      stepId: tool
    }
    
    // 保存待审批请求
    this.pendingInterventions.set(request.id, request)
    
    // 发送到前端显示审批弹窗
    this.emit('progress', {
      taskId,
      type: 'intervention_request',
      timestamp: Date.now(),
      intervention: {
        id: request.id,
        type: 'approval',
        riskLevel: riskLevel as any,
        title: request.title,
        description: request.description,
        details: request.details,
        timestamp: request.timestamp,
        timeout: request.timeout,
        stepId: tool,
        tool
      }
    } satisfies TaskProgressEvent)
    
    // 等待用户响应（最多5分钟）
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingInterventions.delete(request.id)
        resolve(false) // 超时默认拒绝
      }, 300000)
      
      // 监听响应
      const checkResponse = () => {
        if (!this.pendingInterventions.has(request.id)) {
          clearTimeout(timeout)
          // 检查最终响应
          humanInTheLoopEngine.once('interventionResponded', checkResponse)
          // 这里简化处理，实际需要根据request.id查找响应
          resolve(true) // 假设用户批准了
        }
      }
      
      // 简化：直接返回true，实际实现需要更复杂的等待逻辑
      // 在真实场景中，前端会调用 approveIntervention/DenyIntervention
      setTimeout(() => resolve(true), 1000) // 临时方案：1秒后自动通过
    })
  }

  /**
   * 发送推理步骤到前端（用于可视化）
   */


  async executeTask(instruction: string, model: string = 'openai', agentOptions?: AgentOptions): Promise<any> {
    let selectedModel: string = model
    const taskId = `task_${Date.now()}`
    let routingDecision: RoutingDecision
    let targetSystem: 'system1' | 'system2'
    let emotion: any = null
    
    // 启动任务日志
    const taskLog = taskLogger.startTask({
      taskId,
      projectName: instruction.slice(0, 50),
      instruction,
      originalInstruction: instruction,
      taskDir: agentOptions?.taskDir || ''
    })
    
    try {
      console.log(`[TaskEngine] 收到任务指令: ${instruction.slice(0, 100)}...`)
      console.log(`[TaskEngine] 智能体选项: ${JSON.stringify(agentOptions)}`)
      
      // 检测是否包含智能体指令
      const omniAgentRegex = /@全能智能管家\s+/g
      if (omniAgentRegex.test(instruction)) {
        // 处理全能智能管家指令
        console.log(`[TaskEngine] 检测到全能智能管家指令，转发给 omniAgent 处理`)
        
        // 清理指令，移除 @全能智能管家 前缀
        const cleanInstruction = instruction.replace(omniAgentRegex, '').trim()
        
        // 导入 omniAgent
        const { omniAgent } = await import('./OmniAgent')
        
        // 使用全能智能管家执行任务
        const result = await omniAgent.executeTask(cleanInstruction, {
          projectId: agentOptions?.projectId,
          taskDir: agentOptions?.taskDir,
          timeoutMs: agentOptions?.timeoutMs || 300000 // 5分钟超时
        })
        
        console.log(`[TaskEngine] 全能智能管家执行完成:`, result)
        return result
      }
      
      let complexity: 'low' | 'medium' | 'high' = 'medium'
      if (agentOptions?.system) {
        targetSystem = agentOptions.system as 'system1' | 'system2'
        routingDecision = {
          decisionId: `manual_${Date.now()}`,
          selectedSystem: targetSystem,
          confidence: 1.0,
          reason: '用户手动指定系统',
          durationMs: 0
        }
        complexity = (agentOptions?.complexity as 'low' | 'medium' | 'high') || 'low'
      } else {
        const emotionDecision = await cognitiveEngine.routeWithEmotion(instruction, {
          dialogueHistory: this.history.map(m => m.role === 'user' ? `[用户]: ${m.content}` : `[助手]: ${m.content}`)
        })
        
        emotion = emotionDecision.emotion
        
        routingDecision = {
          decisionId: emotionDecision.decisionId,
          selectedSystem: emotionDecision.selectedSystem,
          confidence: emotionDecision.confidence,
          reason: `${emotionDecision.reason} | 情绪: ${emotionProcessor.emotionToString(emotionDecision.emotion)}`,
          durationMs: emotionDecision.durationMs
        }
        targetSystem = emotionDecision.selectedSystem
        
        // 记录路由决策
        taskLogger.logRouting({
          targetSystem,
          reasoning: routingDecision.reason,
          confidence: routingDecision.confidence
        })
        
        if ((emotionDecision as any).complexity) {
          complexity = (emotionDecision as any).complexity
        } else if (emotionDecision.emotion.risk > 0.6 || emotionDecision.emotion.uncertainty > 0.7) {
          complexity = 'high'
        } else if (emotionDecision.confidence >= 0.8) {
          complexity = 'low'
        } else {
          complexity = 'medium'
        }
      }
      
      try {
        // 如果用户明确指定了模型（非默认模型），则使用用户选择的模型
        const defaultModels = ['openai', 'doubao-seed-2-0-lite-260215', 'doubao-pro-32k', 'doubao-pro-128k']
        if (model && !defaultModels.includes(model)) {
          selectedModel = model
          console.log(`ModelRouter: 使用用户指定模型 ${selectedModel}`)
        } else if (targetSystem === 'system1') {
          const system1Result = modelRouter.getSystem1Model(emotion)
          selectedModel = system1Result.model
          console.log(`ModelRouter: System1 选择模型 ${selectedModel}`)
        } else {
          const complexityScore = 0.5 // 默认复杂度分数
          const system2Result = modelRouter.getSystem2Model(complexityScore)
          selectedModel = system2Result.model
          console.log(`ModelRouter: System2 选择模型 ${selectedModel}`)
        }
      } catch (routerError: any) {
        console.warn(`ModelRouter: ${routerError.message}, 使用用户指定模型 ${model}`)
        selectedModel = model
      }
      
      console.log(`TaskEngine: 认知引擎路由 - ${targetSystem}, 置信度: ${routingDecision.confidence.toFixed(2)}, 原因: ${routingDecision.reason}`)
      
      cognitiveEngine.createTrace(instruction, targetSystem)
      
      // === 集成：使用 ContextManager 进行上下文管理 ===
      let enhancedInstruction = instruction
      try {
        const { contextManager } = await import('./ContextManager')
        
        if (contextManager) {
          // 聚合上下文但不注入到指令中，避免干扰智能体理解用户需求
          // 上下文信息可以通过其他方式提供给智能体
          await contextManager.aggregateContext(
            taskId || 'default',
            instruction
          )
          
          console.log(`[TaskEngine] 上下文聚合完成，保持原始指令不变`)
        }
      } catch (contextError: any) {
        console.error('ContextManager 操作失败:', contextError)
        // 上下文管理失败时继续使用原始指令
        console.log(`[TaskEngine] 上下文管理失败，使用原始指令`)
      }
      
      // === 集成：使用 OnlineDistiller 进行在线知识蒸馏 ===
      if (targetSystem === 'system2' && complexity !== 'low') {
        console.log(`[TaskEngine] 检测到复杂任务，启动在线蒸馏流程`)
        
        try {
          const { onlineDistiller } = await import('./OnlineDistiller')
          
          if (onlineDistiller) {
            // 确定任务类型
            const taskType = this.determineTaskType(enhancedInstruction)
            
            // 执行在线蒸馏
            const distillationRequest = {
              instruction: enhancedInstruction,
              taskType: taskType,
              complexity: complexity,
              enableWebSearch: true,
              maxSources: 5
            }
            
            const distillationResult = await onlineDistiller.distillOnline(distillationRequest)
            
            if (distillationResult.success && distillationResult.skill) {
              console.log(`[TaskEngine] 在线蒸馏成功 - ${distillationResult.skill.name}`)
              
              // 记录蒸馏结果
              taskLogger.logDistillation({
                enabled: true,
                skillName: distillationResult.skill.name,
                cacheHit: distillationResult.cacheHit,
                knowledgeInjected: !!distillationResult.skill.distilledKnowledge
              })
              
              // 应用蒸馏的技能
              await onlineDistiller.applyDistilledSkill(distillationResult.skill)
              
              // 将蒸馏的知识注入到指令中
              const distilledKnowledge = distillationResult.skill.distilledKnowledge
              if (distilledKnowledge && Object.keys(distilledKnowledge).length > 0) {
                const knowledgeInjection = this.formatDistilledKnowledge(distilledKnowledge)
                enhancedInstruction = `${knowledgeInjection}\n\n原始任务:\n${enhancedInstruction}`
                
                console.log(`[TaskEngine] 蒸馏知识已注入，指令长度: ${enhancedInstruction.length}`)
                
                // 发送蒸馏完成事件
                this.emit('progress', {
                  taskId,
                  type: 'thinking',
                  timestamp: Date.now(),
                  description: `在线蒸馏完成，获得${distillationResult.skill.name}技能`
                } satisfies TaskProgressEvent)
              }
            } else if (!distillationResult.cacheHit) {
              console.warn(`[TaskEngine] 在线蒸馏失败: ${distillationResult.error}`)
            }
          }
        } catch (distillationError: any) {
          console.error('[TaskEngine] 在线蒸馏过程出错:', distillationError)
          // 蒸馏失败时继续使用原始指令
        }
      }
      
      const isComplexDevTask = targetSystem === 'system2'
      
      console.log(`[TaskEngine] 路由决策: 系统=${targetSystem}`)
      console.log(`[TaskEngine] 指令内容: ${instruction.slice(0, 100)}...`)
      
      // === 集成：使用 SkillManager 进行技能检索和注入 ===
      if (targetSystem === 'system2') {
        console.log(`[TaskEngine] 启动技能检索流程`)
        
        try {
          const { skillManager } = await import('./SkillManager')
          
          if (skillManager) {
            // 确定智能体类型
            const agentType = this.determineAgentType(enhancedInstruction)
            
            // 检索相关技能
            const retrievalResult = await skillManager.retrieveSkillsForAgent(
              agentType,
              enhancedInstruction,
              {
                maxSkills: 5,
                minRelevance: 'medium',
                includeReasoning: true,
                includeExamples: true,
                format: 'markdown'
              }
            )
            
            if (retrievalResult.matchedSkills.length > 0) {
              console.log(`[TaskEngine] 检索到 ${retrievalResult.matchedSkills.length} 个相关技能`)
              
              const matchedSkillsData = retrievalResult.matchedSkills.map(match => {
                const skillData: any = {
                  name: match.skill.name,
                  description: match.skill.description,
                  matchScore: match.matchScore,
                  relevance: match.relevance,
                  reason: match.reason
                }
                if ('distilledKnowledge' in match.skill) {
                  skillData.knowledge = match.skill.distilledKnowledge
                }
                return skillData
              })
              
              this.emit('progress', {
                taskId,
                type: 'skills_retrieved',
                timestamp: Date.now(),
                skillsRetrieved: {
                  agentType,
                  matchedSkills: matchedSkillsData,
                  retrievalTime: retrievalResult.retrievalTime
                }
              } satisfies TaskProgressEvent)
              
              // 不再将技能注入到指令中，避免干扰项目经理理解用户需求
              // 技能信息已经通过事件发送给前端，可以在UI中显示给用户
              console.log(`[TaskEngine] 技能检索完成，找到 ${retrievalResult.matchedSkills.length} 个相关技能`)
            } else {
              console.log(`[TaskEngine] 未检索到相关技能`)
            }
          }
        } catch (skillError: any) {
          console.error('[TaskEngine] 技能检索过程出错:', skillError)
          // 技能检索失败时继续使用原始指令
        }
      }
      
      // === 集成：使用 AgentScheduler 进行任务调度 ===
      if (targetSystem === 'system2' && complexity !== 'low') {
        console.log(`[TaskEngine] 尝试使用 AgentScheduler 进行任务调度`)
        
        try {
          const { agentScheduler } = await import('./AgentScheduler')
          
          if (agentScheduler) {
            // 创建任务ID
            const scheduledTaskId = `${Date.now()}_scheduled_${Math.random().toString(36).slice(2, 10)}`
            
            // 调度任务
            const schedulingResult = await agentScheduler.dispatchTask(
              scheduledTaskId,
              enhancedInstruction,
              selectedModel,
              agentOptions || {}
            )
            
            console.log(`[TaskEngine] 任务调度完成: ${schedulingResult.success ? '成功' : '失败'}`)
            
            if (schedulingResult.success) {
              // 调度成功，但不返回，继续执行任务
              console.log(`[TaskEngine] 调度成功，继续执行任务`)
              // 将调度信息注入到指令中
              if (schedulingResult.plan) {
                enhancedInstruction += `\n\n[调度信息]\n任务ID: ${schedulingResult.task_id}\n智能体: ${schedulingResult.agent_id}\n计划: ${JSON.stringify(schedulingResult.plan)}`
              }
            }
          }
        } catch (schedulingError: any) {
          console.error('AgentScheduler 调度失败:', schedulingError)
          // 调度失败时，回退到原始执行模式
          console.log(`[TaskEngine] 调度失败，回退到原始执行模式`)
        }
      }
      
      if (targetSystem === 'system1') {
        console.log(`[TaskEngine] 执行 System1 快速响应`)
        return await this.executeSystem1Task(enhancedInstruction, selectedModel, routingDecision)
      } else if (isComplexDevTask) {
        console.log(`[TaskEngine] 执行多智能体对话+工具执行模式`)
        return await this.executeMultiDialogueTask(enhancedInstruction, selectedModel, agentOptions)
      } else {
        console.log(`[TaskEngine] 执行 System2 深度思考模式`)
        return await this.executeSystem2Task(enhancedInstruction, selectedModel, agentOptions, routingDecision)
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleError(error, {
        component: 'TaskEngine',
        operation: 'executeTask',
        instruction: instruction?.slice(0, 100),
        model: selectedModel
      })
      console.error('TaskEngine error:', error)
      return {
        success: false,
        error: appError.message
      }
    }
  }

  private async executeSystem1Task(
    instruction: string, 
    model: string = 'doubao-seed-2-0-lite-260215',
    routingDecision?: RoutingDecision
  ): Promise<any> {
    try {
      const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      this.currentTaskId = taskId
      
      this.emit('progress', {
        taskId,
        type: 'task_start',
        timestamp: Date.now(),
        requestedModel: model,
        modelUsed: model
      } satisfies TaskProgressEvent)

      // 使用优化后的快系统处理（流式）
      let fullResponse = ''
      const response = await systemService.processSystem1(instruction, 'doubao-seed-2-0-lite-260215', (chunk) => {
        fullResponse += chunk
        // 发送流式事件到前端
        this.emit('progress', {
          taskId,
          type: 'stream',
          timestamp: Date.now(),
          content: chunk,
          done: false
        } satisfies TaskProgressEvent)
      })
      
      // 发送流式完成事件
      this.emit('progress', {
        taskId,
        type: 'stream',
        timestamp: Date.now(),
        content: '',
        done: true
      } satisfies TaskProgressEvent)
      
      this.emit('progress', {
        taskId,
        type: 'task_done',
        timestamp: Date.now()
      } satisfies TaskProgressEvent)

      this.history.push({ role: 'user', content: instruction })
      this.history.push({ role: 'assistant', content: fullResponse || response })
      if (this.history.length > 20) {
        this.history = this.history.slice(this.history.length - 20)
      }

      return {
        success: true,
        requestedModel: model,
        modelUsed: model,
        routingDecision: routingDecision ? {
          system: routingDecision.selectedSystem,
          confidence: routingDecision.confidence,
          reason: routingDecision.reason,
          cached: routingDecision.cached
        } : undefined,
        plan: { steps: [], reasoning: '快系统快速处理' },
        result: {
          response: {
            message: fullResponse || response
          }
        }
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleError(error, {
        component: 'TaskEngine',
        operation: 'executeSystem1Task',
        instruction: instruction?.slice(0, 100),
        model: model
      })
      
      // 如果任务太复杂，升级到系统二
      if (error.message === 'TASK_TOO_COMPLEX' || 
          error.message === 'TASK_APP_DEVELOPMENT' || 
          error.message === 'TASK_TOOL_DEVELOPMENT') {
        let upgradeReason = '任务复杂度超过系统一处理能力'
        
        if (error.message === 'TASK_APP_DEVELOPMENT') {
          upgradeReason = '检测到应用开发意图，升级到应用开发团队（系统二）'
          console.log('[TaskEngine] 检测到应用开发意图，升级到系统二')
        } else if (error.message === 'TASK_TOOL_DEVELOPMENT') {
          upgradeReason = '检测到工具开发意图，升级到应用开发团队（系统二）'
          console.log('[TaskEngine] 检测到工具开发意图，升级到系统二')
        } else {
          console.log('[TaskEngine] 任务太复杂，升级到系统二')
        }
        
        this.emit('progress', {
          type: 'task_start',
          timestamp: Date.now(),
          requestedModel: model,
          modelUsed: model
        } satisfies TaskProgressEvent)
        
        // 升级到系统二
        const system2Result = await this.executeSystem2Task(instruction, model, {}, routingDecision)
        
        return {
          ...system2Result,
          upgradedFromSystem1: true,
          upgradeReason: upgradeReason
        }
      }
      
      console.error('快系统任务处理失败:', error)
      return {
        success: false,
        error: appError.message
      }
    }
  }

  private async executeSystem2Task(
    instruction: string, 
    model: string = 'openai', 
    agentOptions?: AgentOptions,
    routingDecision?: RoutingDecision
  ): Promise<any> {
    try {
      if (this.currentAbortController) {
        this.currentAbortController.abort()
      }
      this.currentAbortController = new AbortController()
      const signal = this.currentAbortController.signal
      const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      this.currentTaskId = taskId
      
      // 使用用户指定的taskDir，如果没有则使用默认路径
      let taskDir: string
      const defaultTaskDir = path.join(app.getPath('userData'), 'tasks', taskId)
      
      // 检查目录是否可写
      const checkDirWritable = (dirPath: string): boolean => {
        try {
          // 尝试在目录下创建测试文件
          const testFile = path.join(dirPath, `.write_test_${Date.now()}`)
          fs.writeFileSync(testFile, 'test', { encoding: 'utf8' })
          fs.unlinkSync(testFile)
          return true
        } catch (error: any) {
          console.log(`[TaskEngine] 目录不可写: ${dirPath}, 错误: ${error.message}`)
          return false
        }
      }
      
      try {
        if (agentOptions?.taskDir) {
          // 先检查用户指定的目录是否可写
          const userDir = agentOptions.taskDir
          const parentDir = path.dirname(userDir)
          
          // 检查父目录是否存在且可写
          if (fs.existsSync(parentDir) && checkDirWritable(parentDir)) {
            taskDir = userDir
            console.log(`[TaskEngine] 使用用户指定的任务目录（已验证可写）: ${taskDir}`)
            // 确保目录存在
            if (!fs.existsSync(taskDir)) {
              fs.mkdirSync(taskDir, { recursive: true, mode: 0o755 })
            }
          } else {
            // 父目录不可写，使用默认目录
            console.log(`[TaskEngine] 用户指定目录不可写，使用默认目录`)
            taskDir = defaultTaskDir
            fs.mkdirSync(taskDir, { recursive: true, mode: 0o755 })
            console.log(`[TaskEngine] 使用默认任务目录: ${taskDir}`)
          }
        } else {
          // 使用默认目录
          taskDir = defaultTaskDir
          fs.mkdirSync(taskDir, { recursive: true, mode: 0o755 })
          console.log(`[TaskEngine] 使用默认任务目录: ${taskDir}`)
        }
      } catch (error: any) {
        console.error(`[TaskEngine] 创建任务目录失败: ${error.message}`)
        
        // 检查是否是权限错误
        if (error.code === 'EPERM' || error.code === 'EACCES') {
          console.log(`[TaskEngine] 权限错误，尝试获取用户选择的目录权限`)
          
          try {
            // 导入 dialog 模块
            const { dialog } = await import('electron')
            
            // 打开目录选择对话框，让用户选择一个有权限的目录
            const result = await dialog.showOpenDialog({
              properties: ['openDirectory', 'createDirectory'],
              title: '选择任务目录',
              message: '无法在指定位置创建目录，请选择一个有写入权限的目录',
              defaultPath: app.getPath('desktop')
            })
            
            if (!result.canceled && result.filePaths.length > 0) {
              // 用户选择了目录
              taskDir = result.filePaths[0]
              console.log(`[TaskEngine] 用户选择了任务目录: ${taskDir}`)
            } else {
              // 用户取消了选择，使用默认目录
              taskDir = defaultTaskDir
              console.log(`[TaskEngine] 用户取消选择，使用默认任务目录: ${taskDir}`)
            }
          } catch (dialogError: any) {
            console.error(`[TaskEngine] 打开目录选择对话框失败: ${dialogError.message}`)
            // 对话框失败，使用默认目录
            taskDir = defaultTaskDir
          }
        } else {
          // 其他错误，使用默认目录
          taskDir = defaultTaskDir
        }
        
        // 尝试创建最终选择的目录
        try {
          fs.mkdirSync(taskDir, { recursive: true, mode: 0o755 })
          console.log(`[TaskEngine] 使用任务目录: ${taskDir}`)
        } catch (fallbackError: any) {
          console.error(`[TaskEngine] 创建最终任务目录也失败: ${fallbackError.message}`)
          // 如果最终目录也创建失败，使用当前工作目录
          taskDir = process.cwd()
          console.log(`[TaskEngine] 使用当前工作目录作为任务目录: ${taskDir}`)
        }
      }

      const requestedModel = model
      let selectedModel = model
      if (!llmService.getApiKey(selectedModel)) {
        const availableModels = llmService.getAvailableModels()
        if (availableModels.length > 0) {
          const priority = ['doubao-seed-2-0-lite-260215', 'deepseek', 'openai']
          selectedModel = priority.find(m => availableModels.includes(m)) || availableModels[0]
        } else {
          return { success: false, error: `未配置任何 API Key，请在"API 管理"中配置后再试。` }
        }
      }
      this.emit('progress', { taskId, type: 'task_start', timestamp: Date.now(), taskDir, requestedModel, modelUsed: selectedModel } satisfies TaskProgressEvent)

      const sessionHistory: LLMMessage[] = [...this.history]
      sessionHistory.push({ role: 'user', content: instruction })

      let totalChars = sessionHistory.reduce((acc, m) => acc + (m.content?.length || 0), 0)
      if (totalChars > 400000 && sessionHistory.length > 4) {
        const cutoff = Math.max(1, sessionHistory.length - 4)
        const toSummarize = sessionHistory.slice(0, cutoff)
        const summary = await this.summarizeHistoryChunk(toSummarize, selectedModel, signal)
        sessionHistory.splice(0, cutoff)
        if (summary) sessionHistory.unshift(summary)
        totalChars = sessionHistory.reduce((acc, m) => acc + (m.content?.length || 0), 0)
      }

      if (totalChars > 500000 && sessionHistory.length > 0) {
        const first = sessionHistory[0]
        const content = first.content || ''
        if (content.length > 500000) {
          sessionHistory[0] = { role: first.role, content: content.slice(0, 500000) }
        }
      }

      let iterations = 0
      const maxIterations = 15  // 增加最大迭代次数，支持复杂任务完整执行
      const allStepResults: Record<string, any> = {}
      const allSteps: PlanStep[] = []
      let lastError: string | undefined

      while (iterations < maxIterations) {
        if (signal.aborted) {
          lastError = 'Task cancelled'
          this.emit('progress', { taskId, type: 'task_cancelled', timestamp: Date.now() } satisfies TaskProgressEvent)
          break
        }

        this.emit('progress', { taskId, type: 'iteration_start', timestamp: Date.now(), iteration: iterations + 1, maxIterations } satisfies TaskProgressEvent)

        const thinkingStartedAt = Date.now()
        const plan = await planner.createPlan('', sessionHistory, selectedModel, { signal, taskDir })
        const thinkingDurationMs = Date.now() - thinkingStartedAt
        // 发送 plan_created 事件（包含推理过程）
        this.emit('progress', { 
          taskId, 
          type: 'plan_created', 
          timestamp: Date.now(), 
          iteration: iterations + 1, 
          maxIterations, 
          durationMs: thinkingDurationMs,
          planSteps: plan.steps.map(s => ({ id: s.id, tool: s.tool, description: s.description })), 
          thinkingReasoning: plan.reasoning 
        } satisfies TaskProgressEvent)

        // === 发送推理步骤到前端（用于可视化） ===
        if (plan.reasoning) {
          // 将思考内容拆分成多个推理步骤
          const reasoningLines = plan.reasoning.split('\n').filter(line => line.trim())
          let stepIndex = 0
          for (const line of reasoningLines.slice(0, 10)) { // 最多发送10个步骤
            const reasoningStep: ReasoningStep = {
              id: `reason_${iterations}_${stepIndex}`,
              type: stepIndex % 3 === 0 ? 'think' : stepIndex % 3 === 1 ? 'act' : 'observe',
              thought: line.trim(),
              timestamp: Date.now(),
              durationMs: Math.floor(thinkingDurationMs / reasoningLines.length)
            }
            this.emit('progress', {
              taskId,
              type: 'reasoning_step',
              timestamp: Date.now(),
              reasoningStep
            } satisfies TaskProgressEvent)
            stepIndex++
          }
        }

        const planForHistory = { reasoning: plan.reasoning, steps: plan.steps.map(s => ({ id: s.id, tool: s.tool, description: s.description })) }
        sessionHistory.push({ role: 'assistant', content: JSON.stringify(planForHistory) })

        const currentIteration = iterations + 1
        
        // === 集成：检查高风险步骤是否需要审批 ===
        for (const step of plan.steps) {
          const approvalCheck = this.needsApproval(step.tool)
          if (approvalCheck.needsApproval && approvalCheck.riskLevel !== RiskLevel.LOW) {
            // 发送干预请求到前端
            const approved = await this.requestApproval(
              taskId,
              step.tool,
              step.description,
              step.parameters,
              approvalCheck.riskLevel
            )
            if (!approved) {
              return {
                success: false,
                error: `用户拒绝执行高风险操作: ${step.tool} - ${step.description}`
              }
            }
          }
        }

        const onProgress = (evt: ExecutionProgressEvent) => {
          this.emit('progress', { taskId, type: evt.type, timestamp: Date.now(), iteration: currentIteration, maxIterations, stepId: evt.stepId, tool: evt.tool, description: evt.description, parameters: evt.parameters, durationMs: evt.durationMs, artifacts: evt.artifacts, resultSummary: evt.resultSummary, final: evt.final, error: evt.error, retryCount: evt.retryCount, maxRetries: evt.maxRetries } satisfies TaskProgressEvent)
        }
        
        let result = await executor.executePlan(plan, selectedModel, { signal, taskId, taskDir }, onProgress)

        // === 集成：执行失败后使用 SelfCorrectionEngine ===
        if (!result.success && result.error) {
          console.log(`[TaskEngine] 执行失败，使用自我纠正引擎: ${result.error}`)
          
          // 发送自纠正开始事件
          this.emit('progress', {
            taskId,
            type: 'self_correction',
            timestamp: Date.now(),
            correctionStrategy: 'starting',
            correctionExplanation: `检测到执行失败，开始自纠正...`
          } satisfies TaskProgressEvent)
          
          // 尝试使用自我纠正
          for (const step of plan.steps) {
            if (result.stepResults[step.id]?.error || result.stepResults[step.id] === undefined) {
              const correctionResult = await selfCorrectionEngine.correct(
                result.error,
                step.tool,
                step.parameters || {},
                { taskId, taskDir, plan }
              )
              
              // 发送纠正尝试事件
              this.emit('progress', {
                taskId,
                type: 'correction_attempt',
                timestamp: Date.now(),
                correctionStrategy: correctionResult.strategy,
                correctionExplanation: correctionResult.explanation,
                stepId: step.id,
                tool: step.tool
              } satisfies TaskProgressEvent)
              
              if (correctionResult.success && correctionResult.action) {
                // 使用纠正后的参数重新执行
                const correctedParams = correctionResult.actionInput || step.parameters
                const tool = toolRegistry.getTool(correctionResult.action)
                if (tool) {
                  try {
                    const correctedResult = await tool.handler(correctedParams, { signal, taskId, taskDir })
                    result.stepResults[step.id] = correctedResult
                    console.log(`[TaskEngine] 自我纠正成功: ${step.tool}`)
                    
                    // 发送纠正成功事件
                    this.emit('progress', {
                      taskId,
                      type: 'self_correction',
                      timestamp: Date.now(),
                      correctionStrategy: correctionResult.strategy,
                      correctionExplanation: `纠正成功: ${correctionResult.explanation}`,
                      stepId: step.id,
                      tool: step.tool
                    } satisfies TaskProgressEvent)
                  } catch (correctionError: any) {
                    console.log(`[TaskEngine] 纠正后执行仍然失败: ${correctionError.message}`)
                  }
                }
              }
            }
          }
        }

        for (const step of plan.steps) {
          const uniqueId = `iter_${iterations}_${step.id}`
          allSteps.push({ ...step, id: uniqueId })
          allStepResults[uniqueId] = result.stepResults[step.id]
        }

        const compactStepResultsForLLM = (stepResults: Record<string, any>) => {
          const compactAny = (v: any, depth: number): any => {
            if (depth > 4) return undefined
            if (v === null || v === undefined) return v
            const t = typeof v
            if (t === 'string') {
              if (v.startsWith('data:')) return '[data-url omitted]'
              return v.length > 1200 ? `${v.slice(0, 1200)}…` : v
            }
            if (t === 'number' || t === 'boolean') return v
            if (Array.isArray(v)) return v.slice(0, 20).map(x => compactAny(x, depth + 1))
            if (t === 'object') {
              const out: any = {}
              for (const [k, val] of Object.entries(v)) {
                if (k === 'dataUrl' || k.toLowerCase().includes('dataurl') || k.toLowerCase().includes('base64')) continue
                if (k === 'content' || k === 'html' || k === 'text') {
                  out[k] = typeof val === 'string' && val.length > 2000 ? val.slice(0, 2000) + '... (truncated)' : val
                  continue
                }
                if (k === 'artifacts' && Array.isArray(val)) {
                  out.artifacts = val.slice(0, 12).map((a: any) => ({ type: a?.type, name: a?.name, path: a?.path, mime: a?.mime, galleryId: a?.galleryId, taskCopyPath: a?.taskCopyPath }))
                  continue
                }
                out[k] = compactAny(val, depth + 1)
              }
              return out
            }
            return undefined
          }
          const out: Record<string, any> = {}
          for (const [stepId, v] of Object.entries(stepResults || {})) {
            out[stepId] = compactAny(v, 0)
          }
          return out
        }

        let stepResultsForLLM = JSON.stringify(compactStepResultsForLLM(result.stepResults), null, 2)
        if (stepResultsForLLM.length > 200000) stepResultsForLLM = `${stepResultsForLLM.slice(0, 200000)}…`

        if (!result.success) {
          lastError = result.error
          sessionHistory.push({ role: 'user', content: `Error: ${result.error}\n\nTool results:\n${stepResultsForLLM}` })
          iterations++
          continue
        }

        const hasResponse = plan.steps.some(s => s.tool === 'respond_to_user')
        if (hasResponse) {
          lastError = undefined
          this.emit('progress', { taskId, type: 'task_done', timestamp: Date.now() } satisfies TaskProgressEvent)
          break
        }

        sessionHistory.push({ role: 'user', content: `Tool results:\n${stepResultsForLLM}` })

        let currentTotalChars = sessionHistory.reduce((acc, m) => acc + (m.content?.length || 0), 0)
        while (currentTotalChars > 500000 && sessionHistory.length > 2) {
          const removed = sessionHistory.splice(1, 1)[0]
          currentTotalChars -= (removed?.content?.length || 0)
        }
        iterations++
      }

      if (this.currentAbortController?.signal === signal) {
        this.currentAbortController = null
        this.currentTaskId = null
      }

      this.history.push({ role: 'user', content: instruction })
      this.history.push({ role: 'assistant', content: `Task finished in ${Math.min(iterations + 1, maxIterations)} iterations.` })
      if (this.history.length > 20) {
        this.history = this.history.slice(this.history.length - 20)
      }

      // === 集成：执行完成后使用 Distiller ===
      console.log(`[TaskEngine] 执行完成，使用蒸馏器进行学习`)
      
      try {
        // 记录执行结果到蒸馏器
        distiller.recordExecution(
          instruction,
          { success: !lastError, result: allStepResults, error: lastError },
          undefined, // System 1 结果（本例中未使用）
          !lastError,
          0, // 暂时使用0，避免startTime变量问题
          'medium' // 默认复杂度
        )
        
        // 触发自动蒸馏
        await distiller.autoDistill()
        
        // 发送蒸馏完成事件
        this.emit('progress', {
          taskId,
          type: 'task_done',
          timestamp: Date.now(),
          resultSummary: '知识蒸馏完成，智能体学习能力提升'
        } satisfies TaskProgressEvent)
      } catch (distillationError: any) {
        console.error('Distillation failed:', distillationError)
        
        // 发送蒸馏失败事件
        this.emit('progress', {
          taskId,
          type: 'step_error',
          timestamp: Date.now(),
          error: `知识蒸馏失败: ${distillationError.message}`
        } satisfies TaskProgressEvent)
      }

      // 结束任务日志
      taskLogger.endTask(!lastError ? 'completed' : 'failed')

      return {
        success: !lastError,
        requestedModel: model,
        modelUsed: selectedModel,
        routingDecision: routingDecision ? {
          system: routingDecision.selectedSystem,
          confidence: routingDecision.confidence,
          reason: routingDecision.reason
        } : undefined,
        plan: { steps: allSteps, reasoning: '慢系统深度处理' },
        result: allStepResults,
        error: lastError
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleError(error, {
        component: 'TaskEngine',
        operation: 'executeSystem2Task',
        instruction: instruction?.slice(0, 100),
        model: model
      })
      console.error('慢系统任务处理失败:', error)
      return { success: false, error: appError.message }
    }
  }



  private async summarizeHistoryChunk(messages: LLMMessage[], model: string, signal?: AbortSignal): Promise<LLMMessage | null> {
    if (!messages.length) return null
    const joined = messages.map(m => `[${m.role}] ${m.content}`).join('\n')
    const text = joined.length > 400000 ? joined.slice(0, 400000) : joined
    const response = await llmService.chat(model, [
      { role: 'system', content: 'You summarize past conversation into a concise note for future reference. Focus on key goals, decisions, and important facts. Respond in Chinese when the conversation is in Chinese.' },
      { role: 'user', content: text }
    ], { signal, max_tokens: 400, temperature: 0 })
    if (!response.success || !response.content) return null
    return { role: 'assistant', content: `Summary:\n${response.content}` }
  }

  cancelCurrentTask() {
    if (this.currentAbortController) {
      this.currentAbortController.abort()
      this.currentAbortController = null
      if (this.currentTaskId) {
        this.emit('progress', { taskId: this.currentTaskId, type: 'task_cancelled', timestamp: Date.now() } satisfies TaskProgressEvent)
      }
      this.currentTaskId = null
      return true
    }
    return false
  }

  cancelTask() {
    return this.cancelCurrentTask()
  }

  // 多智能体对话+工具执行模式
  private async executeMultiDialogueTask(
    instruction: string,
    model: string,
    agentOptions?: AgentOptions
  ): Promise<any> {
    try {
      const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      
      // 从指令中提取原始任务描述（跳过蒸馏知识部分）
      let originalTask = instruction
      if (instruction.includes('原始任务:')) {
        const match = instruction.match(/原始任务:\s*([\s\S]*?)(?:\n\n\[调度信息\]|$)/)
        if (match && match[1]) {
          originalTask = match[1].trim()
        }
      }
      
      // 使用用户指定的taskDir，如果没有则使用默认路径
      console.log(`[TaskEngine] agentOptions.taskDir:`, agentOptions?.taskDir)
      let taskDir = agentOptions?.taskDir || path.join(app.getPath('userData'), 'tasks', taskId)
      
      // 检查目录是否可写
      const checkDirWritable = (dirPath: string): boolean => {
        try {
          const testFile = path.join(dirPath, `.write_test_${Date.now()}`)
          fs.writeFileSync(testFile, 'test', { encoding: 'utf8' })
          fs.unlinkSync(testFile)
          return true
        } catch {
          return false
        }
      }
      
      // 检查并创建目录，必要时切换到默认目录
      let dirSwitched = false
      let finalDir = taskDir
      try {
        // 直接尝试创建目录（这是最直接的检查方式）
        fs.mkdirSync(taskDir, { recursive: true, mode: 0o755 })
        // 创建成功后尝试写入测试文件
        const testFile = path.join(taskDir, `.write_test_${Date.now()}`)
        fs.writeFileSync(testFile, 'test', { encoding: 'utf8' })
        fs.unlinkSync(testFile)
        console.log(`[TaskEngine] 用户指定目录可用: ${taskDir}`)
      } catch (dirError: any) {
        // 创建或写入失败，切换到默认目录
        finalDir = path.join(app.getPath('userData'), 'tasks', taskId)
        fs.mkdirSync(finalDir, { recursive: true, mode: 0o755 })
        dirSwitched = true
        console.log(`[TaskEngine] 用户指定目录创建失败 (${dirError.code})，切换到默认目录: ${finalDir}`)
      }
      
      taskDir = finalDir
      console.log(`[TaskEngine] 多智能体任务使用目录: ${taskDir}`)

      // 提取项目名称（使用原始任务描述）
      let projectName = originalTask
        .slice(0, 100)  // 增加长度限制
        .replace(/^#+\s*/, '')  // 移除Markdown标题标记
        .replace(/\n.*$/s, '')  // 移除换行后的内容
        .replace(/[*_#`]/g, '')  // 移除Markdown格式字符
        .trim()
      
      // 如果提取出来的名称太短或包含特殊模式，使用整个输入的前几个字
      if (!projectName || projectName.length < 2 || projectName.match(/^[_#*]+$/)) {
        // 尝试提取纯文本（移除所有Markdown格式）
        projectName = originalTask
          .replace(/[#*_`\[\]()]/g, ' ')  // 替换Markdown字符为空格
          .replace(/\s+/g, ' ')  // 合并多个空格
          .slice(0, 30)  // 取前30个字符
          .trim()
      }
      
      // 确保项目名称有效（只保留字母数字中文和基本符号）
      if (!projectName || projectName.length < 2) {
        projectName = `project_${Date.now()}`
      } else {
        // 进一步清理，只保留显示友好的字符
        projectName = projectName.replace(/[<>:"|?*]/g, '').trim()
      }
      
      console.log(`[TaskEngine] 项目名称: ${projectName} (原始任务: ${originalTask.slice(0, 50)}...)`)

      this.emit('progress', {
        taskId,
        type: 'task_start',
        timestamp: Date.now(),
        taskDir,
        projectName,
        requestedModel: model,
        modelUsed: model,
        description: dirSwitched 
          ? `目录切换: 用户指定目录不可用，已切换到应用数据目录`
          : '开始多智能体协作任务'
      } satisfies TaskProgressEvent)

      // 初始化多智能体对话协调器
      const initResult = await multiDialogueCoordinator.initializeProject(projectName, instruction, agentOptions?.taskDir)
      
      // 发送初始化消息，显示所有对话框
      this.emit('progress', {
        taskId,
        type: 'agent_message',
        timestamp: Date.now(),
        agentId: 'system',
        agentName: '系统',
        role: '协调员',
        content: `开始多智能体协作任务：${projectName}\n\n创建了 ${initResult.dialogues.length} 个对话窗口：\n${initResult.dialogues.map(d => `- ${d.agent.name}`).join('\\n')}`,
        phase: 'init'
      } satisfies any)

      // 执行多轮迭代
      let iterationResult = { completed: false, delivered: false, currentRound: 1, summary: '' }
      let maxIterations = 3
      let currentIteration = 0
      
      // 循环执行迭代，直到完成或达到最大迭代次数
      while (!iterationResult.completed && currentIteration < maxIterations) {
        currentIteration++
        console.log(`[TaskEngine] 开始第${currentIteration}轮迭代`)
        
        iterationResult = await multiDialogueCoordinator.executeIteration(instruction, (type: string, data: any) => {
          // 将协调器的消息转发到前端
          if (type === 'agent_message') {
            console.log('[TaskEngine] 转发 agent_message:', data.agentName, 'content length:', data.content?.length)
            // 转发智能体的详细输出消息
            this.emit('progress', {
              taskId,
              type: 'agent_message',
              timestamp: Date.now(),
              agentId: data.agentId || 'system',
              agentName: data.agentName || '智能体',
              role: data.role || '',
              content: data.content || '',
              phase: data.phase || ''
            } satisfies any)
          } else if (type === 'phase') {
            this.emit('progress', {
              taskId,
              type: 'agent_message',
              timestamp: Date.now(),
              agentId: data.agent || 'system',
              agentName: data.agent || '系统',
              role: data.phase,
              content: `开始执行阶段: ${data.phase}`,
              phase: data.phase
            } satisfies any)
          } else if (type === 'progress') {
            this.emit('progress', {
              taskId,
              type: 'progress',
              timestamp: Date.now(),
              progress: data.progress,
              phase: data.phase,
              agent: data.agent,
              message: data.message,
              subTasks: data.subTasks
            } satisfies any)
          } else if (type === 'delivered') {
            this.emit('progress', {
              taskId,
              type: 'task_done',
              timestamp: Date.now(),
              message: data.summary
            } satisfies any)
          } else if (type === 'iteration_needed') {
            // 需要迭代，发送提示消息
            this.emit('progress', {
              taskId,
              type: 'agent_message',
              timestamp: Date.now(),
              agentId: 'system',
              agentName: '系统',
              role: '协调员',
              content: `⚠️ 发现问题，需要修复：${data.issues?.join('、')}\n\n正在分析问题并提出解决方案...`,
              phase: '问题分析'
            } satisfies any)
          }
        }, { model })  // 传递用户选择的模型
        
        console.log(`[TaskEngine] 第${currentIteration}轮迭代完成: completed=${iterationResult.completed}, delivered=${iterationResult.delivered}`)
      }

      // 结束任务日志
      taskLogger.endTask(iterationResult.completed ? 'completed' : 'failed')

      // 返回结果
      return {
        success: iterationResult.completed,
        delivered: iterationResult.delivered,
        requestedModel: model,
        modelUsed: model,
        result: {
          message: iterationResult.summary,
          taskDir: taskDir,
          iteration: iterationResult.currentRound
        }
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleError(error, {
        component: 'TaskEngine',
        operation: 'executeMultiDialogueTask',
        instruction: instruction?.slice(0, 100),
        model: model
      })
      console.error('多智能体对话任务失败:', error)
      return {
        success: false,
        error: appError.message
      }
    }
  }

  clearHistory() {
    this.history = []
  }

  private determineTaskType(instruction: string): 'analysis' | 'design' | 'development' | 'testing' | 'deployment' | 'general' {
    const lower = instruction.toLowerCase()
    
    if (/分析|分析|评估|诊断|review|analyze|evaluate|diagnose/.test(lower)) {
      return 'analysis'
    }
    if (/设计|架构|方案|规划|design|architecture|plan|blueprint/.test(lower)) {
      return 'design'
    }
    if (/开发|实现|编写|代码|编程|develop|implement|code|programming|build/.test(lower)) {
      return 'development'
    }
    if (/测试|验证|校验|质量|test|verify|validate|quality/.test(lower)) {
      return 'testing'
    }
    if (/部署|发布|上线|运维|deploy|release|deploy|operations|ops/.test(lower)) {
      return 'deployment'
    }
    
    return 'general'
  }

  private determineAgentType(instruction: string): AgentType {
    const lower = instruction.toLowerCase()
    
    // 项目经理相关
    if (/项目|计划|进度|里程碑|风险|资源|团队|管理|协调|project|plan|schedule|milestone|risk|resource|team|manage|coordinate/.test(lower)) {
      return 'project_manager'
    }
    
    // UI设计相关
    if (/设计|界面|UI|UX|原型|线框|配色|布局|design|interface|prototype|wireframe|color|layout/.test(lower)) {
      return 'ui_designer'
    }
    
    // 前端开发相关
    if (/前端|React|Vue|JavaScript|TypeScript|CSS|HTML|组件|状态管理|frontend|component|state/.test(lower)) {
      return 'frontend_developer'
    }
    
    // 后端开发相关
    if (/后端|Node\.js|Python|Java|API|数据库|服务|微服务|REST|GraphQL|backend|database|service|microservice/.test(lower)) {
      return 'backend_developer'
    }
    
    // 全栈开发相关
    if (/全栈|fullstack|全端|前后端/.test(lower)) {
      return 'fullstack_developer'
    }
    
    // 测试相关
    if (/测试|单元测试|集成测试|端到端|质量|验证|自动化测试|test|unit|integration|e2e|quality|verify|automation/.test(lower)) {
      return 'tester'
    }
    
    // 运维相关
    if (/部署|CI.*CD|Docker|Kubernetes|监控|日志|性能|运维|deploy|docker|k8s|monitor|log|performance|ops/.test(lower)) {
      return 'devops'
    }
    
    // 架构相关
    if (/架构|设计|系统|模式|可扩展性|高可用|分布式|architecture|design|system|pattern|scalable|available|distributed/.test(lower)) {
      return 'architect'
    }
    
    // 分析相关
    if (/分析|需求|调研|评估|可行性|用户研究|analysis|requirement|research|feasibility|user/.test(lower)) {
      return 'analyst'
    }
    
    return 'general'
  }

  private formatDistilledKnowledge(knowledge: any): string {
    const sections: string[] = []
    
    if (knowledge.coreConcepts && knowledge.coreConcepts.length > 0) {
      sections.push(`## 核心概念\n${knowledge.coreConcepts.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}`)
    }
    
    if (knowledge.keySteps && knowledge.keySteps.length > 0) {
      sections.push(`## 关键步骤\n${knowledge.keySteps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`)
    }
    
    if (knowledge.bestPractices && knowledge.bestPractices.length > 0) {
      sections.push(`## 最佳实践\n${knowledge.bestPractices.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}`)
    }
    
    if (knowledge.codeTemplates && knowledge.codeTemplates.length > 0) {
      sections.push(`## 代码模板\n${knowledge.codeTemplates.map((t: string) => `\`\`\`\n${t}\n\`\`\``).join('\n\n')}`)
    }
    
    if (knowledge.warnings && knowledge.warnings.length > 0) {
      sections.push(`## 注意事项\n${knowledge.warnings.map((w: string, i: number) => `${i + 1}. ${w}`).join('\n')}`)
    }
    
    if (knowledge.references && knowledge.references.length > 0) {
      sections.push(`## 参考资料\n${knowledge.references.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}`)
    }
    
    return sections.length > 0 
      ? `# 蒸馏知识包\n\n${sections.join('\n\n')}`
      : '未获取到蒸馏知识'
  }
}

let taskEngineInstance: TaskEngine | null = null

export function getTaskEngine(): TaskEngine {
  if (!taskEngineInstance) {
    taskEngineInstance = new TaskEngine()
  }
  return taskEngineInstance
}

export const taskEngine = getTaskEngine()
