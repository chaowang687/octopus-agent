/**
 * ReAct推理引擎
 * 实现Reasoning + Acting模式的动态推理
 * 允许AI在执行过程中动态调整计划和策略
 */

import { EventEmitter } from 'events'
import { llmService, LLMMessage } from '../services/LLMService'
import { toolRegistry } from './ToolRegistry'
import { ErrorHandler, ErrorCategory } from '../utils/ErrorHandler'

// ReAct步骤类型
export enum ReActStepType {
  THINK = 'think',      // 推理步骤
  ACT = 'act',          // 执行步骤
  OBSERVE = 'observe',  // 观察结果
  REFLECT = 'reflect',  // 反思步骤
  FINAL = 'final'       // 最终答案
}

// ReAct单个步骤
export interface ReActStep {
  id: string
  type: ReActStepType
  thought?: string       // 推理内容
  action?: string       // 执行的动作（工具名）
  actionInput?: any     // 动作参数
  observation?: string // 观察结果
  reflection?: string  // 反思内容
  result?: any         // 执行结果
  confidence?: number   // 置信度
  error?: string        // 错误信息
  timestamp: number
  durationMs?: number
}

// ReAct执行轨迹
export interface ReActTrace {
  id: string
  task: string
  steps: ReActStep[]
  maxIterations: number
  currentStep: number
  finalAnswer?: string
  success: boolean
  totalDurationMs: number
  createdAt: number
  completedAt?: number
}

// ReAct执行选项
export interface ReActOptions {
  maxIterations?: number      // 最大迭代次数
  maxTokens?: number          // 最大token数
  temperature?: number        // 温度参数
  model?: string              // 使用的模型
  tools?: string[]            // 允许使用的工具列表
  includeReflection?: boolean // 是否包含反思步骤
  earlyStopping?: boolean     // 是否在得到答案后提前停止
}

// ReAct引擎类
export class ReActEngine extends EventEmitter {
  private defaultOptions: ReActOptions = {
    maxIterations: 10,
    maxTokens: 4000,
    temperature: 0.7,
    includeReflection: true,
    earlyStopping: true
  }

  constructor() {
    super()
  }

  /**
   * 执行ReAct推理
   * @param task 任务描述
   * @param options 执行选项
   * @param onStep 每一步的回调
   */
  async execute(
    task: string,
    options: ReActOptions = {},
    onStep?: (step: ReActStep, trace: ReActTrace) => void | Promise<void>
  ): Promise<ReActTrace> {
    const opts = { ...this.defaultOptions, ...options }
    const startTime = Date.now()
    
    const trace: ReActTrace = {
      id: `react_${Date.now()}`,
      task,
      steps: [],
      maxIterations: opts.maxIterations || 10,
      currentStep: 0,
      success: false,
      totalDurationMs: 0,
      createdAt: startTime
    }

    // 构建系统提示
    const systemPrompt = this.buildSystemPrompt(opts)
    
    // 初始化消息历史
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task }
    ]

    this.emit('start', { traceId: trace.id, task })

    try {
      // ReAct循环
      for (let iteration = 0; iteration < (opts.maxIterations || 10); iteration++) {
        trace.currentStep = iteration + 1
        
        // 发送进度事件
        this.emit('iteration', { 
          iteration: iteration + 1, 
          maxIterations: opts.maxIterations,
          traceId: trace.id 
        })

        // 调用LLM获取下一步行动
        const stepStartTime = Date.now()
        const llmResponse = await llmService.chat(
          opts.model || 'openai',
          messages,
          {
            temperature: opts.temperature,
            max_tokens: opts.maxTokens
          }
        )

        if (!llmResponse.success || !llmResponse.content) {
          const errorStep: ReActStep = {
            id: `step_${iteration}`,
            type: ReActStepType.THINK,
            thought: 'LLM调用: llmResponse失败',
            error: error?.error || 'Unknown error',
            timestamp: stepStartTime,
            durationMs: Date.now() - stepStartTime
          }
          trace.steps.push(errorStep)
          this.emit('error', { step: errorStep, traceId: trace.id })
          break
        }

        // 解析LLM响应
        const parsed = this.parseResponse(llmResponse.content)
        
        if (!parsed) {
          // 无法解析响应，尝试作为最终答案Step: ReAct
          const finalStep: ReActStep = {
            id: `step_${iteration}`,
            type: ReActStepType.FINAL,
            thought: llmResponse.content,
            timestamp: stepStartTime,
            durationMs: Date.now() - stepStartTime
          }
          trace.steps.push(finalStep)
          trace.finalAnswer = llmResponse.content
          
          if (onStep) await onStep(finalStep, trace)
          
          // 检查是否应该提前停止
          if (opts.earlyStopping) {
            trace.success = true
            trace.completedAt = Date.now()
            trace.totalDurationMs = trace.completedAt - startTime
            this.emit('complete', { trace, success: true })
            return trace
          }
        }

        // 根据解析结果执行相应操作
        if (parsed.type === 'think') {
          // 推理步骤
          const thinkStep: ReActStep = {
            id: `step_${iteration}`,
            type: ReActStepType.THINK,
            thought: parsed.content,
            timestamp: stepStartTime,
            durationMs: Date.now() - stepStartTime
          }
          trace.steps.push(thinkStep)
          
          // 添加到消息历史
          messages.push({ 
            role: 'assistant', 
            content: `Thought: ${parsed.content}` 
          })

          if (onStep) await onStep(thinkStep, trace)
          
        } else if (parsed.type === 'act') {
          // 执行步骤 - 调用工具
          const actStep: ReActStep = {
            id: `step_${iteration}`,
            type: ReActStepType.ACT,
            thought: parsed.thought || '',
            action: parsed.action,
            actionInput: parsed.actionInput,
            timestamp: stepStartTime
          }
          trace.steps.push(actStep)

          // 执行工具
          let observation = ''
          let actionResult: any = null
          let actionError: string | undefined
          
          try {
            const tool = toolRegistry.getTool(parsed.action)
            if (!tool) {
              actionError = `Tool not found: ${parsed.action}`
            } else {
              actionResult = await tool.handler(parsed.actionInput || {}, {})
              if (actionResult.error) {
                actionError = actionResult.error
              }
              observation = actionError || this.formatResult(actionResult)
            }
          } catch (error: any) {
            actionError = error.message
            observation = `Error: ${actionError}`
          }

          actStep.observation = observation
          actStep.result = actionResult
          actStep.error = actionError
          actStep.durationMs = Date.now() - stepStartTime

          // 添加观察结果到消息历史
          messages.push({ 
            role: 'assistant', 
            content: `Action: ${parsed.action}\nAction Input: ${JSON.stringify(parsed.actionInput || {})}` 
          })
          messages.push({ 
            role: 'user', 
            content: `Observation: ${observation}` 
          })

          if (onStep) await onStep(actStep, trace)

          // 检查是否是最终答案
          if (parsed.action === 'respond_to_user' || parsed.action === 'final_answer') {
            trace.finalAnswer = observation
            trace.success = true
            trace.completedAt = Date.now()
            trace.totalDurationMs = trace.completedAt - startTime
            
            this.emit('complete', { trace, success: true })
            return trace
          }

        } else if (parsed.type === 'final') {
          // 最终答案
          trace.finalAnswer = parsed.content
          trace.success = true
          trace.completedAt = Date.now()
          trace.totalDurationMs = trace.completedAt - startTime
          
          const finalStep: ReActStep = {
            id: `step_${iteration}`,
            type: ReActStepType.FINAL,
            thought: parsed.content,
            timestamp: stepStartTime,
            durationMs: Date.now() - stepStartTime
          }
          trace.steps.push(finalStep)

          if (onStep) await onStep(finalStep, trace)
          
          this.emit('complete', { trace, success: true })
          return trace
        }

        // 检查是否超过token限制，如果是则总结并继续
        if (messages.length > 20) {
          // 保留系统提示和开头，压缩中间部分
          const summaryMsg: LLMMessage = {
            role: 'user',
            content: '[Summary of previous conversation: The conversation has been going on for multiple turns. Key observations so far: ' + 
              trace.steps.slice(-5).map(s => s.observation || s.thought || '').join('; ') + ']'
          }
          messages.splice(2, messages.length - 4, summaryMsg)
        }
      }

      // 达到最大迭代次数
      trace.completedAt = Date.now()
      trace.totalDurationMs = trace.completedAt - startTime
      trace.finalAnswer = trace.steps[trace.steps.length - 1]?.observation || 'Task incomplete - max iterations reached'
      
      this.emit('complete', { trace, success: false, reason: 'max_iterations' })
      return trace

    } catch (error: any) {
      const appError = ErrorHandler.handleError(error, {
        component: 'ReActEngine',
        operation: 'execute'
      })
      
      trace.completedAt = Date.now()
      trace.totalDurationMs = trace.completedAt - startTime
      trace.success = false
      
      this.emit('error', { error: appError, traceId: trace.id })
      return trace
    }
  }

  /**
   * 构建ReAct系统提示
   */
  private buildSystemPrompt(options: ReActOptions): string {
    const toolsList = this.getToolsDescription(options.tools)
    
    return `You are an AI assistant that uses the ReAct (Reasoning + Acting) pattern to solve tasks.

## ReAct Pattern
You follow a loop of:
1. **Thought**: Think about what to do next
2. **Action**: Execute a tool to gather information or perform an action
3. **Observation**: See the result of your action
4. **Reflection**: Reflect on what you've learned (optional)
5. **Final**: Provide the final answer when ready

## Available Tools
${toolsList}

## Output Format
You must output your response in one of these formats:

### For thinking:
Thought: <your reasoning here>

### For action:
Thought: <your reasoning about what to do>
Action: <tool_name>
Action Input: <JSON object of parameters>

### For final answer:
Thought: <summary of what you've learned>
Final Answer: <your final response to the user>

## Guidelines
- Always reason step by step
- Use tools to gather information when needed
- If a tool fails, try a different approach
- Provide clear, helpful responses
- ${options.includeReflection ? 'Include reflection on your progress after each observation' : 'Focus on efficient task completion'}
- When you have enough information to answer the user, use the final answer format

Remember: You have limited iterations, so use them wisely!`
  }

  /**
   * 获取工具描述
   */
  private getToolsDescription(allowedTools?: string[]): string {
    const tools = toolRegistry.getAllTools()
    const filtered = allowedTools 
      ? tools.filter(t => allowedTools.includes(t.name))
      : tools

    return filtered.map(t => {
      const params = t.parameters.map(p => 
        `  - ${p.name} (${p.type})${p.required ? ' [required]' : ''}: ${p.description}`
      ).join('\n')
      
      return `### ${t.name}
${t.description}
Parameters:
${params || '  (no parameters)'}`
    }).join('\n\n')
  }

  /**
   * 解析LLM响应
   */
  private parseResponse(content: string): { type: string; content?: string; thought?: string; action?: string; actionInput?: any } | null {
    const lines = content.split('\n')
    const result: any = { type: 'think', content: '' }

    for (const line of lines) {
      const trimmed = line.trim()
      
      if (trimmed.startsWith('Thought:')) {
        result.thought = trimmed.substring(8).trim()
        result.content = result.thought
      } else if (trimmed.startsWith('Action:')) {
        result.type = 'act'
        result.action = trimmed.substring(7).trim()
      } else if (trimmed.startsWith('Action Input:')) {
        const inputStr = trimmed.substring(13).trim()
        try {
          result.actionInput = JSON.parse(inputStr)
        } catch {
          result.actionInput = { text: inputStr }
        }
      } else if (trimmed.startsWith('Final Answer:') || trimmed.startsWith('final:')) {
        result.type = 'final'
        result.content = trimmed.substring(trimmed.indexOf(':') + 1).trim()
      }
    }

    // 如果有action但没有thought，添加默认thought
    if (result.type === 'act' && !result.thought) {
      result.thought = `I need to use the ${result.action} tool to ${this.getToolDescription(result.action)}`
    }

    // 如果没有任何标记，返回原始内容作为thought
    if (!result.thought && !result.action) {
      result.content = content
    }

    return result
  }

  /**
   * 获取工具描述用于thought生成
   */
  private getToolDescription(toolName: string): string {
    const tool = toolRegistry.getTool(toolName)
    return tool?.description || 'perform an action'
  }

  /**
   * 格式化工具执行结果
   */
  private formatResult(result: any): string {
    if (!result) return 'No result'
    
    if (result.error) return `Error: ${result.error}`
    
    if (typeof result === 'string') return result
    
    if (result.output) return String(result.output)
    
    if (result.content) return String(result.content)
    
    if (result.message) return String(result.message)
    
    return JSON.stringify(result, null, 2)
  }

  /**
   * 创建ReAct追踪器
   */
  createTrace(task: string, options?: ReActOptions): ReActTrace {
    return {
      id: `react_${Date.now()}`,
      task,
      steps: [],
      maxIterations: options?.maxIterations || 10,
      currentStep: 0,
      success: false,
      totalDurationMs: 0,
      createdAt: Date.now()
    }
  }

  /**
   * 获取可用工具列表
   */
  listTools(): { name: string; description: string; parameters: any[] }[] {
    return toolRegistry.getAllTools().map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }))
  }
}

// 导出单例
export const reactEngine = new ReActEngine()
