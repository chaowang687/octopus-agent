import { EventEmitter } from 'events'
import { llmService, LLMMessage } from '../services/LLMService'

// 多对话框协作消息
export interface DialogueMessage {
  dialogueId: string
  agentId: string
  agentName: string
  role: string
  content: string
  timestamp: number
  type: 'input' | 'output' | 'handoff' | 'context'
}

// 智能体配置
export interface DialogueAgent {
  id: string
  name: string
  role: string
  model: string
  systemPrompt: string
}

// 对话框状态
export interface DialogueState {
  id: string
  name: string
  agent: DialogueAgent
  status: 'idle' | 'waiting' | 'working' | 'completed' | 'failed'
  context: Record<string, any>
  lastOutput?: string
}

export class MultiDialogueCoordinator extends EventEmitter {
  private dialogues: Map<string, DialogueState> = new Map()
  private executionOrder: string[] = []
  private currentIndex: number = 0
  private sharedContext: Record<string, any> = {}
  
  // 智能体配置
  private agentConfigs: Map<string, DialogueAgent> = new Map([
    ['pm', {
      id: 'pm',
      name: '项目经理 (PM)',
      role: '需求分析、项目规划、进度管理',
      model: 'doubao-pro-32k',
      systemPrompt: `你是经验丰富的互联网产品经理。你的职责是：
1. 分析用户需求，拆解为清晰的用户故事（User Stories）
2. 规划项目里程碑
3. 确保需求逻辑自洽，能被开发人员理解
4. 输出结构化的需求分析文档

当你完成分析后，明确告诉用户"需求分析完成，我将把任务交接给UI设计师"。`
    }],
    ['ui', {
      id: 'ui',
      name: 'UI 设计师',
      role: '界面视觉设计、交互体验优化',
      model: 'claude-sonnet-4-20250514',
      systemPrompt: `你是资深UI/UX设计师。你需要：
1. 根据PM的需求分析，进行界面设计
2. 输出页面结构、组件设计、交互流程
3. 提供视觉风格建议
4. 必要时提供设计稿描述或代码实现

当你完成设计后，明确告诉用户"UI设计完成，我将把任务交接给开发工程师"。`
    }],
    ['dev', {
      id: 'dev',
      name: '全栈开发工程师',
      role: '代码架构设计、实现与调试',
      model: 'doubao-seed-2-0-code-preview-260215',
      systemPrompt: `你是全栈开发专家，精通 TypeScript, React, Node.js 和 Electron。
你需要：
1. 先仔细阅读PM的需求分析和UI设计方案
2. 进行代码架构设计
3. 实现功能代码
4. 确保代码风格简洁、健壮且易于维护

当你完成开发后，明确告诉用户"代码开发完成，我将把任务交接给测试工程师"。`
    }],
    ['test', {
      id: 'test',
      name: '测试工程师',
      role: '测试用例设计、测试执行',
      model: 'doubao-seed-2-0-code-preview-260215',
      systemPrompt: `你是测试工程师。你需要：
1. 根据PM的需求分析和开发代码，设计测试用例
2. 生成单元测试、集成测试代码
3. 确保测试覆盖率

当你完成测试后，明确告诉用户"测试完成，我将把任务交接给代码审查员"。`
    }],
    ['review', {
      id: 'review',
      name: '代码审查员',
      role: '代码审查、安全分析',
      model: 'claude-sonnet-4-20250514',
      systemPrompt: `你是代码审查专家。你需要：
1. 审查开发工程师的代码
2. 检查代码质量、安全性、性能
3. 提供改进建议

当你完成审查后，明确告诉用户"代码审查完成，我将把任务交接给PM进行总结"。`
    }]
  ])

  constructor() {
    super()
    // 默认执行顺序
    this.executionOrder = ['pm', 'ui', 'dev', 'test', 'review']
  }

  // 初始化项目协作
  async initializeProject(taskName: string, taskDescription: string): Promise<{
    dialogues: DialogueState[]
    initialDialogueId: string
  }> {
    this.dialogues.clear()
    this.sharedContext = {
      taskName,
      taskDescription,
      startTime: Date.now()
    }
    
    // 创建所有对话框
    for (const agentId of this.executionOrder) {
      const config = this.agentConfigs.get(agentId)!
      const dialogue: DialogueState = {
        id: `dialogue_${agentId}_${Date.now()}`,
        name: `${config.name} - ${taskName}`,
        agent: config,
        status: 'waiting',
        context: {}
      }
      this.dialogues.set(agentId, dialogue)
    }
    
    const dialogues = Array.from(this.dialogues.values())
    console.log(`[MultiDialogue] 初始化项目: ${taskName}, ${dialogues.length} 个对话框`)
    
    return {
      dialogues,
      initialDialogueId: this.executionOrder[0]
    }
  }

  // 获取所有对话框状态
  getDialogues(): DialogueState[] {
    return Array.from(this.dialogues.values())
  }

  // 获取当前正在执行的对话框
  getCurrentDialogue(): DialogueState | null {
    if (this.currentIndex < this.executionOrder.length) {
      const agentId = this.executionOrder[this.currentIndex]
      return this.dialogues.get(agentId) || null
    }
    return null
  }

  // 获取下一个对话框ID
  getNextDialogueId(): string | null {
    if (this.currentIndex + 1 < this.executionOrder.length) {
      return this.executionOrder[this.currentIndex + 1]
    }
    return null
  }

  // 执行当前对话框的任务
  async executeCurrentDialogue(input: string): Promise<{
    success: boolean
    output: string
    nextDialogueId: string | null
  }> {
    const current = this.getCurrentDialogue()
    if (!current) {
      return { success: false, output: '没有更多对话框需要执行', nextDialogueId: null }
    }

    // 更新状态为工作中
    current.status = 'working'
    this.emit('dialogue:start', current)

    try {
      // 构建上下文
      const contextPrompt = this.buildContextPrompt(current.agent.id)
      
      // 调用LLM
      const response = await llmService.chat(current.agent.model, [
        { role: 'system', content: current.agent.systemPrompt },
        ...(contextPrompt ? [{ role: 'system', content: contextPrompt }] : []),
        { role: 'user', content: input }
      ], {
        temperature: 0.7,
        max_tokens: 8000
      })

      if (!response.success || !response.content) {
        throw new Error(response.error || 'LLM调用失败')
      }

      // 保存输出
      current.lastOutput = response.content
      current.status = 'completed'
      
      // 更新共享上下文
      this.sharedContext[current.agent.id] = {
        output: response.content,
        timestamp: Date.now()
      }

      // 发送完成事件
      this.emit('dialogue:complete', {
        dialogue: current,
        output: response.content
      })

      // 获取下一个对话框
      const nextId = this.getNextDialogueId()
      if (nextId) {
        const nextDialogue = this.dialogues.get(nextId)!
        nextDialogue.status = 'waiting'
        
        // 发送交接消息
        this.emit('dialogue:handoff', {
          from: current.agent,
          to: nextDialogue.agent,
          summary: this.summarizeOutput(response.content)
        })
      }

      return {
        success: true,
        output: response.content,
        nextDialogueId: nextId
      }

    } catch (error: any) {
      current.status = 'failed'
      this.emit('dialogue:error', { dialogue: current, error: error.message })
      
      return {
        success: false,
        output: error.message,
        nextDialogueId: null
      }
    }
  }

  // 手动切换到下一个对话框
  async proceedToNext(): Promise<DialogueState | null> {
    const nextId = this.getNextDialogueId()
    if (nextId) {
      this.currentIndex++
      const next = this.dialogues.get(nextId)!
      next.status = 'waiting'
      this.emit('dialogue:switch', { dialogue: next })
      return next
    }
    return null
  }

  // 获取共享上下文
  getSharedContext(): Record<string, any> {
    return { ...this.sharedContext }
  }

  // 重置协调器
  reset() {
    this.dialogues.clear()
    this.currentIndex = 0
    this.sharedContext = {}
  }

  // 构建上下文提示
  private buildContextPrompt(agentId: string): string {
    let context = '\n\n=== 项目背景 ===\n'
    context += `任务: ${this.sharedContext.taskName}\n`
    context += `描述: ${this.sharedContext.taskDescription}\n`
    
    // 添加前序智能体的输出
    const agentOrder = ['pm', 'ui', 'dev', 'test', 'review']
    const currentIdx = agentOrder.indexOf(agentId)
    
    if (currentIdx > 0) {
      context += '\n=== 前序工作成果 ===\n'
      for (let i = 0; i < currentIdx; i++) {
        const prevId = agentOrder[i]
        const prevData = this.sharedContext[prevId]
        if (prevData?.output) {
          const prevAgent = this.agentConfigs.get(prevId)!
          context += `\n【${prevAgent.name}的输出】:\n${prevData.output.slice(0, 2000)}\n`
        }
      }
    }
    
    return context
  }

  // 总结输出用于传递给下一个智能体
  private summarizeOutput(output: string): string {
    // 提取关键信息
    const lines = output.split('\n').filter(l => l.trim())
    const keyPoints = lines.slice(0, 5).join('\n')
    return keyPoints.slice(0, 500)
  }
}

// 导出单例
export const multiDialogueCoordinator = new MultiDialogueCoordinator()
