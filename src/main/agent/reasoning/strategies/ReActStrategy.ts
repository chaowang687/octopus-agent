/**
 * ReAct Reasoning Strategy
 * ReAct 推理策略实现
 */

import { ReasoningStrategy } from './ReasoningStrategy'
import { ReasoningContext, ReasoningResult, ReasoningStep, ReasoningType } from '../ReasoningFramework'
import { llmService, LLMMessage } from '../../../services/LLMService'

export class ReActStrategy implements ReasoningStrategy {
  readonly type: ReasoningType = 'react'

  async execute(context: ReasoningContext): Promise<ReasoningResult> {
    const steps: ReasoningStep[] = []
    const maxIterations = context.maxIterations || 10
    const maxSteps = Math.min(maxIterations, 20)

    try {
      let currentTask = context.task
      let iteration = 0

      while (iteration < maxSteps) {
        iteration++

        // 构建消息
        const messages = this.buildMessages(currentTask, context.history, context.tools)

        // 调用 LLM
        const response = await llmService.chat(
          'doubao-seed-2-0-lite-260215',
          messages,
          { temperature: context.temperature || 0.7 }
        )

        // 解析响应
        const parsed = this.parseResponse(response.content || '')
        
        if (!parsed) {
          steps.push({
            thought: 'Failed to parse LLM response',
            timestamp: Date.now()
          })
          continue
        }

        // 创建推理步骤
        const step: ReasoningStep = {
          thought: parsed.thought,
          action: parsed.action,
          observation: '',
          timestamp: Date.now()
        }

        // 执行动作
        if (parsed.action && parsed.action !== 'respond_to_user') {
          const tool = context.tools.find(t => t.name === parsed.action)
          if (tool) {
            const result = await tool.handler(parsed.actionInput || {})
            step.observation = this.formatObservation(result)
            step.result = result
            currentTask = `${currentTask}\n\nObservation: ${step.observation}`
          }
        } else if (parsed.action === 'respond_to_user') {
          // 任务完成
          step.observation = parsed.actionInput?.response || 'Task completed'
          steps.push(step)
          
          return {
            success: true,
            result: parsed.actionInput?.response,
            steps,
            reasoningType: this.type
          }
        }

        steps.push(step)
        context.history = [...steps]
      }

      // 达到最大迭代次数
      return {
        success: false,
        steps,
        error: `Reached maximum iterations (${maxSteps})`,
        reasoningType: this.type
      }
    } catch (error) {
      return {
        success: false,
        steps,
        error: error instanceof Error ? error.message : 'Unknown error',
        reasoningType: this.type
      }
    }
  }

  /**
   * 构建 LLM 消息
   */
  private buildMessages(task: string, history: ReasoningStep[], tools: any[]): LLMMessage[] {
    const systemMessage: LLMMessage = {
      role: 'system',
      content: `You are an AI agent that follows the ReAct (Reasoning + Acting) framework to solve complex tasks.
        
The ReAct loop consists of three steps:
1. Thought: Think about what needs to be done
2. Action: Select a tool and provide the required parameters
3. Observation: Observe the result of the action

Available tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Always respond in the following JSON format:
{
  "thought": "Your reasoning here",
  "action": "tool_name",
  "action_input": { "param1": "value1" }
}

If you have completed the task, use the respond_to_user tool with your final answer.`
    }

    const historyMessages: LLMMessage[] = history.map(step => ({
      role: 'user' as const,
      content: `Thought: ${step.thought}\nAction: ${step.action || 'none'}\nObservation: ${step.observation || 'none'}`
    }))

    const taskMessage: LLMMessage = {
      role: 'user',
      content: `Task: ${task}`
    }

    return [systemMessage, ...historyMessages, taskMessage]
  }

  /**
   * 解析 LLM 响应
   */
  private parseResponse(content: string): { thought: string; action?: string; actionInput?: any } | null {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * 格式化观察结果
   */
  private formatObservation(result: any): string {
    if (result.error) {
      return `Error: ${result.error}`
    }
    if (result.content) {
      return `Result: ${JSON.stringify(result.content).substring(0, 500)}`
    }
    return `Result: ${JSON.stringify(result).substring(0, 500)}`
  }
}
