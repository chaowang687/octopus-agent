/**
 * Task Decomposer
 * 任务拆解器 - 将复杂任务分解为可执行的步骤
 */

import { EventEmitter } from 'events'
import { TaskStep } from './TaskEngine'
import { llmService, LLMMessage } from '../../services/LLMService'

export class TaskDecomposer extends EventEmitter {
  /**
   * 分解任务为步骤
   */
  async decompose(taskDescription: string): Promise<TaskStep[]> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are a task decomposition expert. Break down the given task into smaller, executable steps.

Each step should:
1. Be specific and actionable
2. Have a clear description
3. Specify the tool to use (if applicable)

Return a JSON array of steps:
[
  {"id": "step_1", "description": "First step description", "tool": "tool_name"},
  {"id": "step_2", "description": "Second step description", "tool": "tool_name"}
]

If no tools are needed, omit the "tool" field.`
      },
      {
        role: 'user',
        content: taskDescription
      }
    ]

    try {
      const response = await llmService.chat('doubao-seed-2-0-lite-260215', messages)
      const jsonMatch = (response.content || '').match(/\[[\s\S]*\]/)
      
      if (jsonMatch) {
        const steps = JSON.parse(jsonMatch[0])
        return steps.map((step: any, index: number) => ({
          id: step.id || `step_${index + 1}`,
          description: step.description,
          tool: step.tool,
          parameters: step.parameters,
          status: 'pending' as const
        }))
      }
    } catch (error) {
      console.error('Task decomposition failed:', error)
    }

    // 如果解析失败，返回默认步骤
    return [{
      id: 'step_1',
      description: taskDescription,
      status: 'pending'
    }]
  }

  /**
   * 优化任务步骤
   */
  async optimizeSteps(steps: TaskStep[]): Promise<TaskStep[]> {
    if (steps.length <= 1) {
      return steps
    }

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'Optimize the given task steps for efficiency. Remove redundant steps and merge similar ones. Return the optimized JSON array.'
      },
      {
        role: 'user',
        content: JSON.stringify(steps)
      }
    ]

    try {
      const response = await llmService.chat('doubao-seed-2-0-lite-260215', messages)
      const jsonMatch = (response.content || '').match(/\[[\s\S]*\]/)
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch {
      // 返回原始步骤
    }

    return steps
  }

  /**
   * 估算任务复杂度
   */
  async estimateComplexity(taskDescription: string): Promise<'simple' | 'moderate' | 'complex' | 'very-complex'> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'Estimate the complexity of this task. Return one of: simple, moderate, complex, very-complex'
      },
      {
        role: 'user',
        content: taskDescription
      }
    ]

    try {
      const response = await llmService.chat('doubao-seed-2-0-lite-260215', messages)
      const content = (response.content || '').toLowerCase()
      
      if (content.includes('very-complex')) return 'very-complex'
      if (content.includes('complex')) return 'complex'
      if (content.includes('moderate')) return 'moderate'
      return 'simple'
    } catch {
      return 'moderate'
    }
  }
}
