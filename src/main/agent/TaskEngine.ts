import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { planner, PlanStep } from './Planner'
import { executor, ExecutionProgressEvent } from './Executor'
import { llmService, LLMMessage } from '../services/LLMService'
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
}

export class TaskEngine extends EventEmitter {
  private history: LLMMessage[] = []
  private currentAbortController: AbortController | null = null
  private currentTaskId: string | null = null

  constructor() {
    super()
  }

  async executeTask(instruction: string, model: string = 'openai', agentOptions?: AgentOptions): Promise<any> {
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
          selectedModel =
            priority.find(m => availableModels.includes(m)) ||
            availableModels[0]
        } else {
          return {
            success: false,
            error: `未配置任何 API Key，请在“API 管理”中配置后再试。`
          }
        }
      }
      this.emit('progress', {
        taskId,
        type: 'task_start',
        timestamp: Date.now(),
        taskDir,
        requestedModel,
        modelUsed: selectedModel
      } satisfies TaskProgressEvent)

      const sessionHistory: LLMMessage[] = [...this.history]
      sessionHistory.push({ role: 'user', content: instruction })

      let totalChars = sessionHistory.reduce((acc, m) => acc + (m.content?.length || 0), 0)
      if (totalChars > 400000 && sessionHistory.length > 4) {
        const cutoff = Math.max(1, sessionHistory.length - 4)
        const toSummarize = sessionHistory.slice(0, cutoff)
        const summary = await this.summarizeHistoryChunk(toSummarize, selectedModel, signal)
        sessionHistory.splice(0, cutoff)
        if (summary) {
          sessionHistory.unshift(summary)
        }
        totalChars = sessionHistory.reduce((acc, m) => acc + (m.content?.length || 0), 0)
      }

      if (totalChars > 500000 && sessionHistory.length > 0) {
        const first = sessionHistory[0]
        const content = first.content || ''
        if (content.length > 500000) {
          sessionHistory[0] = {
            role: first.role,
            content: content.slice(0, 500000)
          }
        }
      }

      let iterations = 0
      const maxIterations = 5
      const allStepResults: Record<string, any> = {}
      const allSteps: PlanStep[] = []
      let lastError: string | undefined

      while (iterations < maxIterations) {
        if (signal.aborted) {
          lastError = 'Task cancelled'
          this.emit('progress', { taskId, type: 'task_cancelled', timestamp: Date.now() } satisfies TaskProgressEvent)
          break
        }

        this.emit('progress', {
          taskId,
          type: 'iteration_start',
          timestamp: Date.now(),
          iteration: iterations + 1,
          maxIterations
        } satisfies TaskProgressEvent)

        const thinkingStartedAt = Date.now()
        const plan = await planner.createPlan('', sessionHistory, selectedModel, { signal })
        const thinkingDurationMs = Date.now() - thinkingStartedAt
        this.emit('progress', {
          taskId,
          type: 'thinking',
          timestamp: Date.now(),
          iteration: iterations + 1,
          maxIterations,
          durationMs: thinkingDurationMs
        } satisfies TaskProgressEvent)
        this.emit('progress', {
          taskId,
          type: 'plan_generated',
          timestamp: Date.now(),
          iteration: iterations + 1,
          maxIterations,
          durationMs: thinkingDurationMs,
          planSteps: plan.steps.map(s => ({ id: s.id, tool: s.tool, description: s.description }))
        } satisfies TaskProgressEvent)

        const planForHistory = {
          reasoning: plan.reasoning,
          steps: plan.steps.map(s => ({
            id: s.id,
            tool: s.tool,
            description: s.description
          }))
        }
        sessionHistory.push({ role: 'assistant', content: JSON.stringify(planForHistory) })

        const currentIteration = iterations + 1
        const onProgress = (evt: ExecutionProgressEvent) => {
          this.emit('progress', {
            taskId,
            type: evt.type,
            timestamp: Date.now(),
            iteration: currentIteration,
            maxIterations,
            stepId: evt.stepId,
            tool: evt.tool,
            description: evt.description,
            parameters: evt.parameters,
            durationMs: evt.durationMs,
            artifacts: evt.artifacts,
            resultSummary: evt.resultSummary,
            final: evt.final,
            error: evt.error,
            retryCount: evt.retryCount,
            maxRetries: evt.maxRetries
          } satisfies TaskProgressEvent)
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
            if (Array.isArray(v)) {
              return v.slice(0, 20).map(x => compactAny(x, depth + 1))
            }
            if (t === 'object') {
              const out: any = {}
              for (const [k, val] of Object.entries(v)) {
                if (k === 'dataUrl') continue
                if (k.toLowerCase().includes('dataurl')) continue
                if (k.toLowerCase().includes('base64')) continue
                
                if (k === 'content' || k === 'html' || k === 'text') {
                  if (typeof val === 'string' && val.length > 2000) {
                    out[k] = val.slice(0, 2000) + '... (truncated)'
                  } else {
                    out[k] = val
                  }
                  continue
                }

                if (k === 'artifacts' && Array.isArray(val)) {
                  out.artifacts = val.slice(0, 12).map((a: any) => ({
                    type: a?.type,
                    name: a?.name,
                    path: a?.path,
                    mime: a?.mime,
                    galleryId: a?.galleryId,
                    taskCopyPath: a?.taskCopyPath
                  }))
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
        if (stepResultsForLLM.length > 200000) {
          stepResultsForLLM = `${stepResultsForLLM.slice(0, 200000)}…`
        }

        if (!result.success) {
          lastError = result.error
          sessionHistory.push({
            role: 'user',
            content: `Error: ${result.error}\n\nTool results:\n${stepResultsForLLM}`
          })
          iterations++
          continue
        }

        const hasResponse = plan.steps.some(s => s.tool === 'respond_to_user')
        if (hasResponse) {
          lastError = undefined
          this.emit('progress', { taskId, type: 'task_done', timestamp: Date.now() } satisfies TaskProgressEvent)
          break
        }

        sessionHistory.push({
          role: 'user',
          content: `Tool results:\n${stepResultsForLLM}`
        })

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
        requestedModel,
        modelUsed: selectedModel,
        plan: { steps: allSteps, reasoning: 'Executed multi-step plan' },
        result: allStepResults,
        error: lastError
      }
    } catch (error: any) {
      console.error('TaskEngine error:', error)
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
      {
        role: 'system',
        content: 'You summarize past conversation into a concise note for future reference. Focus on key goals, decisions, and important facts. Respond in Chinese when the conversation is in Chinese.'
      },
      {
        role: 'user',
        content: text
      }
    ], { signal, max_tokens: 400, temperature: 0 })
    if (!response.success || !response.content) return null
    return {
      role: 'assistant',
      content: `Summary:\n${response.content}`
    }
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
