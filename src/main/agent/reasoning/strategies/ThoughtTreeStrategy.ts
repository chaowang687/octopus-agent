/**
 * Thought Tree Reasoning Strategy
 * 思维树推理策略实现
 */

import { ReasoningStrategy } from './ReasoningStrategy'
import { ReasoningContext, ReasoningResult, ReasoningStep, ReasoningType } from '../ReasoningFramework'
import { llmService, LLMMessage } from '../../../services/LLMService'

interface TreeNode {
  id: string
  thought: string
  children: TreeNode[]
  score?: number
  selected: boolean
}

export class ThoughtTreeStrategy implements ReasoningStrategy {
  readonly type: ReasoningType = 'thought-tree'

  async execute(context: ReasoningContext): Promise<ReasoningResult> {
    const steps: ReasoningStep[] = []
    const maxBranches = 3
    const maxDepth = 5

    try {
      // 生成初始分支
      const rootNode = await this.generateBranches(
        context.task,
        maxBranches,
        context.tools
      )

      // 深度优先搜索最佳路径
      await this.evaluateTree(rootNode, context.tools, maxDepth)

      // 回溯获取最终答案
      const path = this.extractPath(rootNode)
      
      steps.push({
        thought: `Thought tree exploration completed. Selected path with score: ${rootNode.score}`,
        timestamp: Date.now()
      })

      return {
        success: true,
        result: path.map(n => n.thought).join(' -> '),
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
   * 生成思维分支
   */
  private async generateBranches(
    task: string, 
    count: number, 
    _tools: any[]
  ): Promise<TreeNode> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are a thought tree explorer. Generate ${count} different approaches to solve this task.
        
Return your response as a JSON array of approaches:
[{"id": "1", "thought": "Approach 1 description"}, {"id": "2", "thought": "Approach 2 description"}, ...]`
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
        const approaches = JSON.parse(jsonMatch[0])
        return {
          id: 'root',
          thought: task,
          children: approaches.map((a: any) => ({
            ...a,
            children: [],
            selected: false
          })),
          selected: false
        }
      }
    } catch {
      // 解析失败，返回默认节点
    }

    return {
      id: 'root',
      thought: task,
      children: [],
      selected: false
    }
  }

  /**
   * 评估思维树
   */
  private async evaluateTree(
    node: TreeNode, 
    tools: any[], 
    maxDepth: number
  ): Promise<void> {
    if (maxDepth <= 0 || node.children.length === 0) {
      node.score = await this.evaluateNode(node, tools)
      return
    }

    for (const child of node.children) {
      await this.evaluateTree(child, tools, maxDepth - 1)
    }

    // 选择得分最高的子节点
    const bestChild = node.children.reduce((best, current) => 
      (current.score || 0) > (best.score || 0) ? current : best
    )
    
    bestChild.selected = true
    node.score = bestChild.score
  }

  /**
   * 评估节点得分
   */
  private async evaluateNode(node: TreeNode, _tools: any[]): Promise<number> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'Evaluate how promising this approach is. Return a score from 0 to 10.'
      },
      {
        role: 'user',
        content: `Approach: ${node.thought}\n\nReturn only a number.`
      }
    ]

    try {
      const response = await llmService.chat('doubao-seed-2-0-lite-260215', messages)
      const score = parseFloat((response.content || '').trim())
      return isNaN(score) ? 5 : Math.min(10, Math.max(0, score))
    } catch {
      return 5
    }
  }

  /**
   * 提取最佳路径
   */
  private extractPath(node: TreeNode): TreeNode[] {
    const path: TreeNode[] = [node]
    
    if (node.selected && node.children.length > 0) {
      const selectedChild = node.children.find(c => c.selected)
      if (selectedChild) {
        return [...path, ...this.extractPath(selectedChild)]
      }
    }
    
    return path
  }
}
