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
import './tools'

export interface TaskProgressEvent {
  taskId: string
  requestedModel?: string
  modelUsed?: string
  type:
    | 'task_start'
    | 'iteration_start'
    | 'thinking'
    | 'plan_generated'
    | 'step_start'
    | 'step_success'
    | 'step_error'
    | 'retry'
    | 'task_done'
    | 'task_cancelled'
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

  constructor() {
    super()
  }

  async executeTask(instruction: string, model: string = 'openai', agentOptions?: AgentOptions): Promise<any> {
    try {
      // 智能路由决策 - 使用认知引擎
      let routingDecision: RoutingDecision
      let targetSystem: 'system1' | 'system2'
      let complexity: 'low' | 'medium' | 'high'
      let emotion: any = null
      
      // 如果用户指定了系统，使用用户指定
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
        // 使用认知引擎自动决策（带情绪分析）
        // 传递完整的对话历史（包括助手的消息），以便判断是否需要继续之前的System2任务
        const emotionDecision = await cognitiveEngine.routeWithEmotion(instruction, {
          dialogueHistory: this.history.map(m => m.role === 'user' ? `[用户]: ${m.content}` : `[助手]: ${m.content}`).join('\n')
        })
        
        // 提取情绪向量用于模型选择
        emotion = emotionDecision.emotion
        
        // 转换为 RoutingDecision 格式以保持兼容性
        routingDecision = {
          decisionId: emotionDecision.decisionId,
          selectedSystem: emotionDecision.selectedSystem,
          confidence: emotionDecision.confidence,
          reason: `${emotionDecision.reason} | 情绪: ${emotionProcessor.emotionToString(emotionDecision.emotion)}`,
          durationMs: emotionDecision.durationMs
        }
        targetSystem = emotionDecision.selectedSystem
        
        // 根据置信度和情绪确定复杂度
        // 如果cognitiveEngine已经返回了复杂度设置，优先使用
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
      
      // 使用模型路由器自动选择模型
      let selectedModel: string
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
        // 模型路由器失败，回退到用户指定的模型
        console.warn(`ModelRouter: ${routerError.message}, 使用用户指定模型 ${model}`)
        selectedModel = model
        modelOptions = {}
      }
      
      console.log(`TaskEngine: 认知引擎路由 - ${targetSystem}, 置信度: ${routingDecision.confidence.toFixed(2)}, 原因: ${routingDecision.reason}`)
      
      // 创建决策轨迹
      this.currentTrace = cognitiveEngine.createTrace(instruction, targetSystem)
      
      // 判断是否需要使用多智能体协作模式（复杂开发任务）
      const isComplexDevTask = /开发|构建|实现|设计|创建|编程|代码|全栈|前端|后端|系统|应用|app|网站/i.test(instruction) && complexity !== 'low'
      
      console.log(`[TaskEngine] 路由决策: 系统=${targetSystem}, 复杂度=${complexity}, 多智能体模式=${isComplexDevTask}`)
      console.log(`[TaskEngine] 指令内容: ${instruction.slice(0, 100)}...`)
      
      // 根据系统类型选择不同的处理逻辑，传递选中的模型
      if (targetSystem === 'system1') {
        console.log(`[TaskEngine] 执行 System1 快速响应`)
        return await this.executeSystem1Task(instruction, selectedModel, routingDecision, complexity, modelOptions)
      } else if (isComplexDevTask) {
        // 复杂开发任务使用多智能体协作模式
        console.log(`[TaskEngine] 执行多智能体协作模式 (PM→UI→Dev→Test→Review)`)
        return await this.executeMultiAgentTask(instruction, selectedModel, agentOptions, routingDecision, complexity)
      } else {
        console.log(`[TaskEngine] 执行 System2 深度思考模式`)
        return await this.executeSystem2Task(instruction, selectedModel, agentOptions, routingDecision, complexity, modelOptions)
      }
    } catch (error: any) {
      console.error('TaskEngine error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 快系统任务处理
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

      // 更新历史
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
      console.error('快系统任务处理失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 慢系统任务处理
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
        this.emit('progress', { taskId, type: 'thinking', timestamp: Date.now(), iteration: iterations + 1, maxIterations, durationMs: thinkingDurationMs } satisfies TaskProgressEvent)
        this.emit('progress', { taskId, type: 'plan_generated', timestamp: Date.now(), iteration: iterations + 1, maxIterations, durationMs: thinkingDurationMs, planSteps: plan.steps.map(s => ({ id: s.id, tool: s.tool, description: s.description })) } satisfies TaskProgressEvent)

        const planForHistory = { reasoning: plan.reasoning, steps: plan.steps.map(s => ({ id: s.id, tool: s.tool, description: s.description })) }
        sessionHistory.push({ role: 'assistant', content: JSON.stringify(planForHistory) })

        const currentIteration = iterations + 1
        const onProgress = (evt: ExecutionProgressEvent) => {
          this.emit('progress', { taskId, type: evt.type, timestamp: Date.now(), iteration: currentIteration, maxIterations, stepId: evt.stepId, tool: evt.tool, description: evt.description, parameters: evt.parameters, durationMs: evt.durationMs, artifacts: evt.artifacts, resultSummary: evt.resultSummary, final: evt.final, error: evt.error, retryCount: evt.retryCount, maxRetries: evt.maxRetries } satisfies TaskProgressEvent)
        }
        const result = await executor.executePlan(plan, selectedModel, { signal, taskId, taskDir }, onProgress)

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
      console.error('慢系统任务处理失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 多智能体协作任务处理
  private async executeMultiAgentTask(
    instruction: string,
    model: string = 'doubao-seed-2-0-code-preview-260215',
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
      console.error('多智能体协作失败:', error)
      return {
        success: false,
        error: error.message
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

  clearHistory() {
    this.history = []
  }
}

export const taskEngine = new TaskEngine()
