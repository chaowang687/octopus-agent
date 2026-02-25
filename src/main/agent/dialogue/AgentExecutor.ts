import { EventEmitter } from 'events'
import { llmService } from '../../services/LLMService'
import { unifiedReasoningEngine } from '../UnifiedReasoningEngine'
import { thoughtTreeEngine } from '../ThoughtTreeEngine'
import { ReasoningMode } from '../UnifiedReasoningEngine'
import { 
  DialogueState, 
  ReasoningEngineType, 
  ExecutionOptions,
  AgentExecutionResult 
} from './types'
import { DialogueCache } from './DialogueCache'

export class AgentExecutor extends EventEmitter {
  private cache: DialogueCache

  constructor(cache: DialogueCache) {
    super()
    this.cache = cache
  }

  async executeWithAdvancedReasoning(
    _agentId: string,
    input: string,
    model: string,
    reasoningEngine: ReasoningEngineType,
    executionLog: string[]
  ): Promise<AgentExecutionResult> {
    try {
      executionLog.push(`[${new Date().toISOString()}] 开始高级推理，引擎: ${reasoningEngine}`)
      
      switch (reasoningEngine) {
        case 'enhanced-react':
          const enhancedResult = await unifiedReasoningEngine.reason(
            input,
            { mode: ReasoningMode.ENHANCED_REACT, enableDeepReflection: true, maxIterations: 50, model }
          )
          executionLog.push(`[${new Date().toISOString()}] UnifiedReasoning(ReAct模式)推理完成`)
          return {
            success: true,
            content: enhancedResult.answer
          }
        
        case 'thought-tree':
          const treeResult = await thoughtTreeEngine.execute(input)
          const bestNode = treeResult.bestPath[treeResult.bestPath.length - 1]
          executionLog.push(`[${new Date().toISOString()}] ThoughtTree推理完成`)
          return {
            success: true,
            content: bestNode?.thought || treeResult.root.thought
          }
        
        case 'unified':
          const unifiedResult = await unifiedReasoningEngine.reason(
            input,
            { mode: ReasoningMode.HYBRID, enableDeepReflection: true, maxIterations: 50, model }
          )
          executionLog.push(`[${new Date().toISOString()}] UnifiedReasoning推理完成`)
          return {
            success: true,
            content: unifiedResult.answer
          }
        
        case 'standard':
          throw new Error('standard模式应该使用executeWithStandardLLM方法')
        
        default:
          throw new Error(`未知的推理引擎: ${reasoningEngine}`)
      }
    } catch (error: any) {
      executionLog.push(`[${new Date().toISOString()}] 高级推理失败: ${error.message}`)
      console.error(`[AgentExecutor] 高级推理失败 (${reasoningEngine}):`, error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async executeWithStandardLLM(
    dialogue: DialogueState,
    input: string,
    contextPrompt: string | null,
    model: string,
    executionLog: string[],
    timeout: number = 60000
  ): Promise<AgentExecutionResult> {
    try {
      executionLog.push(`[${new Date().toISOString()}] 使用标准LLM调用`)
      
      const messages: any[] = [
        { role: 'system', content: dialogue.agent.systemPrompt },
        ...(contextPrompt ? [{ role: 'system', content: contextPrompt }] : []),
        { role: 'user', content: input }
      ]
      
      executionLog.push(`[${new Date().toISOString()}] 上下文构建完成`)
      executionLog.push(`[${new Date().toISOString()}] 发送请求到LLM服务`)
      
      const responsePromise = llmService.chat(model, messages, {
        temperature: 0.7,
        max_tokens: 8000
      })
      
      const response = await this.withTimeout(
        responsePromise,
        timeout,
        'LLM调用超时'
      ) as any
      
      executionLog.push(`[${new Date().toISOString()}] LLM响应 received`)
      
      return {
        success: response.success,
        content: response.content || response.choices?.[0]?.message?.content,
        error: response.error
      }
    } catch (error: any) {
      executionLog.push(`[${new Date().toISOString()}] 标准LLM调用失败: ${error.message}`)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async execute(
    agentId: string,
    dialogue: DialogueState,
    input: string,
    contextPrompt: string | null,
    options: ExecutionOptions = {},
    executionLog: string[] = []
  ): Promise<AgentExecutionResult> {
    const {
      model = dialogue.agent.model,
      reasoningEngine = 'standard',
      enableCache = true,
      timeout = 60000
    } = options

    if (enableCache) {
      const cached = this.cache.getAgentCache(agentId, input)
      if (cached) {
        executionLog.push(`[${new Date().toISOString()}] 使用缓存结果`)
        return { ...cached, cached: true }
      }
    }

    const startTime = Date.now()
    let result: AgentExecutionResult

    if (reasoningEngine === 'standard') {
      result = await this.executeWithStandardLLM(
        dialogue, input, contextPrompt, model, executionLog, timeout
      )
    } else {
      result = await this.executeWithAdvancedReasoning(
        agentId, input, model, reasoningEngine, executionLog
      )
    }

    result.executionTime = Date.now() - startTime

    if (enableCache && result.success) {
      this.cache.setAgentCache(agentId, input, result)
    }

    return result
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(errorMessage))
      }, timeoutMs)
      
      promise
        .then(result => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }

  hasPermissionError(response: any): boolean {
    if (!response) return false
    
    const errorStr = typeof response === 'string' 
      ? response.toLowerCase() 
      : JSON.stringify(response).toLowerCase()
    
    const permissionPatterns = [
      'permission denied',
      'access denied',
      'eprem',
      'not authorized',
      'forbidden',
      '权限'
    ]
    
    return permissionPatterns.some(p => errorStr.includes(p))
  }

  hasReasoningFailure(error: any): boolean {
    if (!error) return false
    
    const errorStr = error.message || String(error).toLowerCase()
    
    const failurePatterns = [
      'timeout',
      'rate limit',
      'context length',
      'token limit',
      'connection',
      'network'
    ]
    
    return failurePatterns.some(p => errorStr.includes(p))
  }
}
