/**
 * Cognitive Reasoning Strategy
 * 认知推理策略实现
 */

import { ReasoningStrategy } from './ReasoningStrategy'
import { ReasoningContext, ReasoningResult, ReasoningStep, ReasoningType } from '../ReasoningFramework'
import { llmService, LLMMessage } from '../../../services/LLMService'

export class CognitiveStrategy implements ReasoningStrategy {
  readonly type: ReasoningType = 'cognitive'

  async execute(context: ReasoningContext): Promise<ReasoningResult> {
    const steps: ReasoningStep[] = []

    try {
      // 阶段 1: 理解任务
      const understanding = await this.understandTask(context.task, context.tools)
      steps.push({
        thought: `Task Understanding: ${understanding}`,
        timestamp: Date.now()
      })

      // 阶段 2: 分解任务
      const decomposition = await this.decomposeTask(context.task)
      steps.push({
        thought: `Task Decomposition: ${decomposition.length} subtasks identified`,
        timestamp: Date.now()
      })

      // 阶段 3: 逐步执行
      let currentResult = ''
      for (let i = 0; i < decomposition.length; i++) {
        const subtask = decomposition[i]
        
        const execution = await this.executeSubtask(subtask, context.tools)
        currentResult += `\n\nSubtask ${i + 1}: ${subtask}\nResult: ${execution}`
        
        steps.push({
          thought: `Executing subtask ${i + 1}/${decomposition.length}: ${subtask}`,
          observation: execution,
          timestamp: Date.now()
        })
      }

      // 阶段 4: 整合结果
      const finalResult = await this.integrateResults(context.task, currentResult)
      steps.push({
        thought: 'Integrating results',
        result: finalResult,
        timestamp: Date.now()
      })

      return {
        success: true,
        result: finalResult,
        steps,
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
   * 理解任务
   */
  private async understandTask(task: string, tools: any[]): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are a cognitive reasoning engine. Your task is to understand the user's request and identify:
1. The main goal
2. Required tools/resources
3. Potential challenges

Available tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Provide a concise understanding of the task.`
      },
      {
        role: 'user',
        content: task
      }
    ]

    const response = await llmService.chat('doubao-seed-2-0-lite-260215', messages)
    return response.content || ''
  }

  /**
   * 分解任务
   */
  private async decomposeTask(task: string): Promise<string[]> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'Break down this task into smaller, manageable subtasks. Return as a JSON array of strings.'
      },
      {
        role: 'user',
        content: task
      }
    ]

    const response = await llmService.chat('doubao-seed-2-0-lite-260215', messages)
    
    try {
      const jsonMatch = (response.content || '').match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch {
      // 解析失败
    }
    
    return [task]
  }

  /**
   * 执行子任务
   */
  private async executeSubtask(subtask: string, tools: any[]): Promise<string> {
    // 找到最合适的工具
    const suitableTool = this.selectTool(subtask, tools)
    
    if (suitableTool) {
      const result = await suitableTool.handler({ input: subtask })
      return JSON.stringify(result)
    }
    
    // 如果没有合适的工具，使用 LLM 直接处理
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'Complete this subtask. Provide the result.'
      },
      {
        role: 'user',
        content: subtask
      }
    ]

    const response = await llmService.chat('doubao-seed-2-0-lite-260215', messages)
    return response.content || ''
  }

  /**
   * 选择工具
   */
  private selectTool(subtask: string, tools: any[]): any {
    const subtaskLower = subtask.toLowerCase()
    
    for (const tool of tools) {
      const toolNameLower = tool.name.toLowerCase()
      
      if (subtaskLower.includes('read') && toolNameLower.includes('read')) {
        return tool
      }
      if (subtaskLower.includes('write') && toolNameLower.includes('write')) {
        return tool
      }
      if (subtaskLower.includes('search') && toolNameLower.includes('search')) {
        return tool
      }
    }
    
    return tools[0]
  }

  /**
   * 整合结果
   */
  private async integrateResults(task: string, results: string): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'Integrate the following subtask results into a coherent final answer.'
      },
      {
        role: 'user',
        content: `Original Task: ${task}\n\nSubtask Results:\n${results}\n\nProvide the final answer.`
      }
    ]

    const response = await llmService.chat('doubao-seed-2-0-lite-260215', messages)
    return response.content || ''
  }
}
