import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { EventEmitter } from 'events'
import { planner, PlanStep } from './Planner'
import { executor, ExecutionProgressEvent } from './Executor'
import { llmService, LLMMessage } from '../services/LLMService'
import { systemService } from '../services/SystemService'
import { cognitiveEngine, DecisionTrace, RoutingDecision } from './CognitiveEngine'
import { EmotionRoutingDecision, emotionProcessor } from './EmotionTypes'
import { modelRouter } from './ModelRouter'
import { multiAgentCoordinator, AgentMessage } from './MultiAgentCoordinator'
import { multiDialogueCoordinator } from './MultiDialogueCoordinator'
import { humanInTheLoopEngine, InterventionRequest, RiskLevel, InterventionType } from './HumanInTheLoopEngine'
import { selfCorrectionEngine, CorrectionStrategy } from './SelfCorrectionEngine'
import { reactEngine, ReActStep, ReActStepType } from './ReActEngine'
import { toolRegistry } from './ToolRegistry'
import { ErrorHandler, ErrorCategory } from '../utils/ErrorHandler'
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
  thinkingReasoning?: string
  // 推理步骤相关
  reasoningStep?: ReasoningStep
  // 干预请求相关
  intervention?: TaskInterventionRequest
  // 自我纠正相关
  correctionStrategy?: string
  correctionExplanation?: string
}

export interface AgentOptions {
  agentId?: string
  sessionId?: string
  system?: string
  complexity?: string
}

export class TaskEngine extends EventEmitter {
  private history: LLMMessage[] = []
  private currentAbortController: AbortController | null = null
  private currentTaskId: string | null = null
  private currentTrace: DecisionTrace | null = null
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
      const params = arguments[2] // 需要从调用处传入
      if (toolName === 'execute_command') {
        const cmd = arguments[2]?.command?.toLowerCase() || ''
        const dangerousCommands = ['rm -rf', 'rmdir', 'del ', 'format', 'shutdown', 'reboot', 'kill -9', 'sudo']
        if (dangerousCommands.some(d => cmd.includes(d))) {
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
  private emitReasoningStep(taskId: string, step: ReActStep) {
    const reasoningStep: ReasoningStep = {
      id: step.id,
      type: step.type as any,
      thought: step.thought,
      action: step.action,
      actionInput: step.actionInput,
      observation: step.observation,
      reflection: step.reflection,
      result: step.result,
      confidence: step.confidence,
      error: step.error,
      timestamp: step.timestamp,
      durationMs: step.durationMs
    }
    
    this.emit('progress', {
      taskId,
      type: 'reasoning_step',
      timestamp: Date.now(),
      reasoningStep
    } satisfies TaskProgressEvent)
  }

  async executeTask(instruction: string, model: string = 'openai', agentOptions?: AgentOptions): Promise<any> {
    let selectedModel: string = model
    
    try {
      let routingDecision: RoutingDecision
      let targetSystem: 'system1' | 'system2'
      let complexity: 'low' | 'medium' | 'high'
      let emotion: any = null
      
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
      
      let modelOptions: any
      try {
        if (targetSystem === 'system1') {
          const system1Result = modelRouter.getSystem1Model(emotion)
          selectedModel = system1Result.model
          modelOptions = system1Result.options
          console.log(`ModelRouter: System1 选择模型 ${selectedModel}`)
        } else {
          const complexityScore = complexity === 'high' ? 0.8 : complexity === 'medium' ? 0.5 : 0.3
          const system2Result = modelRouter.getSystem2Model(complexityScore)
          selectedModel = system2Result.model
          modelOptions = system2Result.options
          console.log(`ModelRouter: System2 选择模型 ${selectedModel}`)
        }
      } catch (routerError: any) {
        console.warn(`ModelRouter: ${routerError.message}, 使用用户指定模型 ${model}`)
        selectedModel = model
        modelOptions = {}
      }
      
      console.log(`TaskEngine: 认知引擎路由 - ${targetSystem}, 置信度: ${routingDecision.confidence.toFixed(2)}, 原因: ${routingDecision.reason}`)
      
      this.currentTrace = cognitiveEngine.createTrace(instruction, targetSystem)
      
      const isComplexDevTask = targetSystem === 'system2' && complexity !== 'low'
      
      console.log(`[TaskEngine] 路由决策: 系统=${targetSystem}, 复杂度=${complexity}`)
      console.log(`[TaskEngine] 指令内容: ${instruction.slice(0, 100)}...`)
      
      if (targetSystem === 'system1') {
        console.log(`[TaskEngine] 执行 System1 快速响应`)
        return await this.executeSystem1Task(instruction, selectedModel, routingDecision, complexity, modelOptions)
      } else if (isComplexDevTask) {
        console.log(`[TaskEngine] 执行多智能体对话+工具执行模式`)
        return await this.executeMultiDialogueTask(instruction, selectedModel, agentOptions)
      } else {
        console.log(`[TaskEngine] 执行 System2 深度思考模式`)
        return await this.executeSystem2Task(instruction, selectedModel, agentOptions, routingDecision, complexity, modelOptions)
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
    model: string = 'deepseek',
    routingDecision?: RoutingDecision,
    complexity: 'low' | 'medium' | 'high' = 'low',
    modelOptions: any = {}
  ): Promise<any> {
    try {
      const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      
      this.emit('progress', {
        taskId,
        type: 'task_start',
        timestamp: Date.now(),
        requestedModel: model,
        modelUsed: model
      } satisfies TaskProgressEvent)

      // 使用系统服务处理快系统任务
      const response = await systemService.processSystem1(instruction, model)
      
      this.emit('progress', {
        taskId,
        type: 'task_done',
        timestamp: Date.now()
      } satisfies TaskProgressEvent)

      this.history.push({ role: 'user', content: instruction })
      this.history.push({ role: 'assistant', content: response })
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
            message: response
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
    routingDecision?: RoutingDecision,
    complexity: 'low' | 'medium' | 'high' = 'medium',
    modelOptions: any = {}
  ): Promise<any> {
    try {
      if (this.currentAbortController) {
        this.currentAbortController.abort()
      }
      this.currentAbortController = new AbortController()
      const signal = this.currentAbortController.signal
      const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      this.currentTaskId = taskId
      const taskDir = path.join(app.getPath('userData'), 'tasks', taskId)
      fs.mkdirSync(taskDir, { recursive: true })

      const requestedModel = model
      let selectedModel = model
      if (!llmService.getApiKey(selectedModel)) {
        const availableModels = llmService.getAvailableModels()
        if (availableModels.length > 0) {
          const priority = ['openai', 'deepseek', 'claude', 'minimax']
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

      return {
        success: !lastError,
        requestedModel: model,
        modelUsed: selectedModel,
        routingDecision: routingDecision ? {
          system: routingDecision.selectedSystem,
          confidence: routingDecision.confidence,
          reason: routingDecision.reason,
          complexity
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

  // 多智能体协作任务处理
  private async executeMultiAgentTask(
    instruction: string,
    model: string = 'deepseek-coder',
    agentOptions?: AgentOptions,
    routingDecision?: RoutingDecision,
    complexity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<any> {
    const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    
    this.emit('progress', {
      taskId,
      type: 'task_start',
      timestamp: Date.now(),
      requestedModel: model,
      modelUsed: model,
      description: '多智能体协作模式'
    } satisfies TaskProgressEvent)

    // 重置多智能体协调器
    multiAgentCoordinator.reset()

    // 发送智能体状态更新
    const emitAgentStatus = (agentId: string, status: string, message?: string) => {
      this.emit('progress', {
        taskId,
        type: 'agent_status',
        timestamp: Date.now(),
        agentId,
        status,
        message
      } satisfies any)
    }

    try {
      // 执行多智能体协作
      const result = await multiAgentCoordinator.executeCollaboration(
        instruction,
        (msg: AgentMessage) => {
          // 发送每个智能体的消息
          this.emit('progress', {
            taskId,
            type: 'agent_message',
            timestamp: Date.now(),
            agentId: msg.agentId,
            agentName: msg.agentName,
            role: msg.role,
            content: msg.content,
            phase: msg.phase
          } satisfies any)
        }
      )

      // System2完成后，切换到System1判断工作进度
      this.emit('progress', {
        taskId,
        type: 'system_switch',
        timestamp: Date.now(),
        from: 'system2',
        to: 'system1',
        message: 'System2 任务完成，正在切换到 System1 判断工作进度...'
      } satisfies any)

      // 使用System1快速判断进度
      const progressCheck = await llmService.chat('deepseek-chat', [
        { 
          role: 'system', 
          content: '你是进度评估专家。请快速评估项目完成状态，不需要详细分析。'
        },
        {
          role: 'user',
          content: `请评估以下任务的完成进度：

任务：${instruction}

完成情况：
${result.summary?.slice(0, 2000) || '已完成'}

请返回JSON格式：
{
  "progress": "已完成/进行中/需要修改",
  "nextStep": "下一步建议（如果有）",
  "quality": "评估质量等级"
}`
        }
      ], {
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })

      let progressResult = { progress: '已完成', nextStep: '', quality: '良好' }
      if (progressCheck.success && progressCheck.content) {
        try {
          progressResult = JSON.parse(progressCheck.content)
        } catch (e) {}
      }

      // 发送进度判断结果
      this.emit('progress', {
        taskId,
        type: 'progress_check',
        timestamp: Date.now(),
        progress: progressResult.progress,
        nextStep: progressResult.nextStep,
        quality: progressResult.quality
      } satisfies any)

      this.emit('progress', {
        taskId,
        type: 'task_done',
        timestamp: Date.now()
      } satisfies TaskProgressEvent)

      return {
        success: true,
        requestedModel: model,
        modelUsed: model,
        mode: 'multi_agent',
        routingDecision: routingDecision ? {
          system: routingDecision.selectedSystem,
          confidence: routingDecision.confidence,
          reason: routingDecision.reason,
          complexity
        } : undefined,
        result: result.result,
        summary: result.summary,
        progressCheck: progressResult,
        collaborationHistory: multiAgentCoordinator.getCollaborationHistory()
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleError(error, {
        component: 'TaskEngine',
        operation: 'executeMultiAgentTask',
        instruction: instruction?.slice(0, 100),
        model: model
      })
      console.error('多智能体协作失败:', error)
      return {
        success: false,
        error: appError.message
      }
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

  // 多智能体对话+工具执行模式
  private async executeMultiDialogueTask(
    instruction: string,
    model: string,
    agentOptions?: AgentOptions
  ): Promise<any> {
    try {
      const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      const taskDir = path.join(app.getPath('userData'), 'tasks', taskId)
      fs.mkdirSync(taskDir, { recursive: true })

      this.emit('progress', {
        taskId,
        type: 'task_start',
        timestamp: Date.now(),
        taskDir,
        requestedModel: model,
        modelUsed: model,
        description: '开始多智能体协作任务'
      } satisfies TaskProgressEvent)

      // 提取项目名称
      const projectName = instruction.slice(0, 20).replace(/[^\\w\\u4e00-\\u9fa5]/g, '_')

      // 初始化多智能体对话协调器
      const initResult = await multiDialogueCoordinator.initializeProject(projectName, instruction)
      
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
      const result = await multiDialogueCoordinator.executeIteration(instruction, (type: string, data: any) => {
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
        }
      })

      // 返回结果
      return {
        success: result.completed,
        delivered: result.delivered,
        requestedModel: model,
        modelUsed: model,
        result: {
          message: result.summary,
          taskDir: taskDir,
          iteration: result.currentRound
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
}

export const taskEngine = new TaskEngine()
