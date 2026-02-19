import { EventEmitter } from 'events'
import { llmService, LLMMessage } from '../services/LLMService'
import * as path from 'path'
import * as fs from 'fs'

// 智能体类型定义
export type AgentType = 'code_generator' | 'test_generator' | 'code_reviewer' | 'document_generator' | 'ui_designer'

export interface Agent {
  id: string
  name: string
  type: AgentType
  role: string  // 角色描述：Dev/PM/Test Engineer/Reviewer/UI Designer
  model: string
  capabilities: string[]
  status: 'idle' | 'working' | 'completed' | 'failed'
  lastOutput?: string
}

export interface AgentTask {
  id: string
  agentId: string
  instruction: string
  context: any
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result?: any
  error?: string
}

export interface CollaborationPhase {
  name: string
  agents: AgentType[]
  description: string
  completed: boolean
}

// 多智能体协作消息
export interface AgentMessage {
  agentId: string
  agentName: string
  role: string
  content: string
  timestamp: number
  phase: string
  messageType: 'task' | 'response' | 'question' | 'suggestion' | 'handover' | 'system'
  targetAgentId?: string
  conversationId?: string
  priority: 'low' | 'medium' | 'high'
}

// 智能体能力评估
export interface AgentCapabilityAssessment {
  agentId: string
  agentType: AgentType
  capabilities: {
    capability: string
    score: number // 0-100
    confidence: number // 0-1
  }[]
  overallScore: number // 0-100
  timestamp: number
}

// 智能体协作请求
export interface AgentCollaborationRequest {
  id: string
  task: string
  requiredCapabilities: string[]
  priority: 'low' | 'medium' | 'high'
  deadline?: number
  context: any
}

// 智能体通信统计
export interface AgentCommunicationStats {
  totalMessages: number
  messagesByType: Record<string, number>
  averageResponseTime: number
  successRate: number
  lastCommunication: number
}

export class MultiAgentCoordinator extends EventEmitter {
  private agents: Map<AgentType, Agent> = new Map()
  private collaborationHistory: AgentMessage[] = []
  private currentPhase: string = 'init'
  private agentCapabilities: Map<AgentType, AgentCapabilityAssessment> = new Map()
  private communicationStats: Map<string, AgentCommunicationStats> = new Map()
  private taskAssignments: Map<string, string> = new Map() // taskId -> agentId
  private resourceManager: any = {
    activeTasks: 0,
    maxConcurrentTasks: 3,
    taskPriorities: new Map<string, 'low' | 'medium' | 'high'>()
  }
  
  // 任务阶段配置
  private phases: CollaborationPhase[] = [
    { name: 'analysis', agents: ['document_generator'], description: '需求分析与规划', completed: false },
    { name: 'design', agents: ['ui_designer', 'document_generator'], description: '架构与UI设计', completed: false },
    { name: 'implementation', agents: ['code_generator'], description: '代码实现', completed: false },
    { name: 'testing', agents: ['test_generator'], description: '测试生成', completed: false },
    { name: 'review', agents: ['code_reviewer'], description: '代码审查', completed: false },
    { name: 'documentation', agents: ['document_generator'], description: '文档整理与总结', completed: false }
  ]

  constructor() {
    super()
    this.initializeAgents()
  }

  private initializeAgents() {
    // 代码生成智能体 - 全栈开发 (使用与ChatDataService一致的ID)
    this.agents.set('code_generator', {
      id: 'agent-dev',
      name: '全栈开发工程师',
      type: 'code_generator',
      role: '全栈开发工程师 (Dev)',
      model: 'deepseek-coder',
      capabilities: ['code_generation', 'fullstack_development', 'api_design', 'database_design'],
      status: 'idle'
    })

    // 测试生成智能体 - 测试工程师
    this.agents.set('test_generator', {
      id: 'agent-test-generator',
      name: '测试工程师',
      type: 'test_generator',
      role: '测试工程师 (Test Engineer)',
      model: 'deepseek-coder',
      capabilities: ['test_generation', 'unit_test', 'integration_test', 'e2e_test'],
      status: 'idle'
    })

    // 代码审查智能体 - 审查员
    this.agents.set('code_reviewer', {
      id: 'agent-code-reviewer',
      name: '代码审查员',
      type: 'code_reviewer',
      role: '代码审查员 (Code Reviewer)',
      model: 'deepseek-coder',
      capabilities: ['code_review', 'security_analysis', 'performance_analysis', 'best_practices'],
      status: 'idle'
    })

    // 文档生成智能体 - 项目经理 (使用与ChatDataService一致的ID)
    this.agents.set('document_generator', {
      id: 'agent-pm',
      name: '项目经理',
      type: 'document_generator',
      role: '项目经理 (PM)',
      model: 'deepseek-coder',
      capabilities: ['requirement_analysis', 'project_planning', 'progress_tracking', 'summary'],
      status: 'idle'
    })

    // UI设计师智能体 - 前端开发 (使用与ChatDataService一致的ID)
    this.agents.set('ui_designer', {
      id: 'agent-ui',
      name: 'UI设计师',
      type: 'ui_designer',
      role: 'UI设计师/前端工程师',
      model: 'deepseek-coder',
      capabilities: ['ui_design', 'frontend_development', 'responsive_layout', 'ux_improvement'],
      status: 'idle'
    })
  }

  // 获取所有智能体
  getAgents(): Agent[] {
    return Array.from(this.agents.values())
  }

  // 获取特定类型智能体
  getAgent(type: AgentType): Agent | undefined {
    return this.agents.get(type)
  }

  // 分析任务需要的智能体
  async analyzeTaskRequirements(instruction: string): Promise<AgentType[]> {
    const prompt = `
分析以下任务，判断需要哪些智能体参与协作：

任务：${instruction}

可选智能体类型：
- code_generator: 代码生成、全栈开发
- test_generator: 测试生成、单元测试
- code_reviewer: 代码审查、安全分析
- document_generator: 需求分析、规划、文档、项目管理
- ui_designer: UI设计、前端开发

请返回需要的智能体类型数组，按执行顺序排列。只需返回JSON数组。
例如：["document_generator", "ui_designer", "code_generator", "test_generator", "code_reviewer"]
`

    try {
      const response = await llmService.chat('deepseek-coder', [
        { role: 'system', content: '你是一个任务分析专家。只需返回JSON数组，不要有其他内容。' },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        max_tokens: 500
      })

      if (response.success && response.content) {
        const result = JSON.parse(response.content)
        if (Array.isArray(result)) {
          return result
        }
      }
    } catch (error) {
      console.error('分析任务需求失败:', error)
    }

    // 默认返回常用智能体组合
    return ['document_generator', 'code_generator', 'test_generator', 'code_reviewer']
  }

  // 执行多智能体协作
  async executeCollaboration(
    instruction: string,
    onAgentMessage: (msg: AgentMessage) => void,
    taskDir?: string
  ): Promise<{ success: boolean; result: any; summary: string }> {
    this.collaborationHistory = []
    
    console.log(`[MultiAgentCoordinator] 开始协作，任务目录: ${taskDir || '未指定'}`)
    
    // 分析任务是否是前端任务
    const frontendKeywords = ['ui', 'frontend', '界面', '设计', 'react', 'vue', 'angular', 'html', 'css', 'javascript', 'typescript']
    const isFrontendTask = frontendKeywords.some(keyword => 
      instruction.toLowerCase().includes(keyword.toLowerCase())
    )
    
    // 1. 需求分析阶段
    const analysisPhase = this.phases.find(p => p.name === 'analysis')!
    this.currentPhase = 'analysis'
    
    // PM分析需求
    const pmAgent = this.agents.get('document_generator')!
    pmAgent.status = 'working'
    
    // 如果指定了任务目录，PM需要创建项目文件夹和Plan
    if (taskDir) {
      try {
        // 创建项目文件夹
        const projectFolder = path.join(taskDir, 'project')
        if (!fs.existsSync(projectFolder)) {
          fs.mkdirSync(projectFolder, { recursive: true })
          console.log(`[MultiAgentCoordinator] PM创建项目文件夹: ${projectFolder}`)
        }
        
        // 生成Plan
        const planPrompt = `作为项目经理，请为以下任务生成详细的项目计划：

任务：${instruction}

请按以下格式生成项目计划：

# 项目计划

## 项目目标
[描述项目的核心目标和预期成果]

## 里程碑
- [里程碑1]: [描述和预期完成时间]
- [里程碑2]: [描述和预期完成时间]
- [里程碑3]: [描述和预期完成时间]

## 实施步骤
### 步骤1: [步骤名称]
- [子步骤1.1]
- [子步骤1.2]
- [注意事项]

### 步骤2: [步骤名称]
- [子步骤2.1]
- [子步骤2.2]
- [注意事项]

## 技术细节
- [技术栈说明]
- [架构设计要点]
- [关键技术决策]

## 风险评估
- [潜在风险1]: [应对措施]
- [潜在风险2]: [应对措施]

## 交付物清单
- [交付物1]
- [交付物2]
- [交付物3]`

        const planResult = await this.executeAgentTask(
          pmAgent,
          planPrompt,
          {}
        )
        
        // 保存Plan为.md文件
        const planFilePath = path.join(projectFolder, 'PROJECT_PLAN.md')
        fs.writeFileSync(planFilePath, planResult, 'utf-8')
        console.log(`[MultiAgentCoordinator] PM保存项目计划: ${planFilePath}`)
        
        // 发送项目创建完成消息
        const planMsg: AgentMessage = {
          agentId: pmAgent.id,
          agentName: pmAgent.name,
          role: pmAgent.role,
          content: `📁 **项目初始化完成**

已创建项目文件夹: ${projectFolder}
已生成项目计划: PROJECT_PLAN.md

${planResult}`,
          timestamp: Date.now(),
          phase: '项目初始化',
          messageType: 'response',
          priority: 'high'
        }
        this.collaborationHistory.push(planMsg)
        onAgentMessage(planMsg)
      } catch (error) {
        console.error('[MultiAgentCoordinator] PM创建项目失败:', error)
      }
    }
    
    const analysisResult = await this.executeAgentTask(
      pmAgent,
      `请分析以下需求，提供详细的技术方案和实现步骤：

任务：${instruction}

请提供：
1. 需求理解
2. 技术方案
3. 实现步骤列表
4. 关键点说明`,
      {}
    )
    
    pmAgent.status = 'completed'
    pmAgent.lastOutput = analysisResult
    
    const analysisMsg: AgentMessage = {
      agentId: pmAgent.id,
      agentName: pmAgent.name,
      role: pmAgent.role,
      content: analysisResult,
      timestamp: Date.now(),
      phase: '需求分析',
      messageType: 'response',
      priority: 'medium'
    }
    this.collaborationHistory.push(analysisMsg)
    onAgentMessage(analysisMsg)
    
    analysisPhase.completed = true

    // 发送交接消息 - 告诉用户下一个智能体将接手
    const handoffMsg1: AgentMessage = {
      agentId: 'system',
      agentName: '系统',
      role: '协调员',
      content: `📋 需求分析完成。现在由 **UI设计师/前端工程师** 接手，进行界面与架构设计...`,
      timestamp: Date.now(),
      phase: '交接',
      messageType: 'handover',
      priority: 'medium'
    }
    this.collaborationHistory.push(handoffMsg1)
    onAgentMessage(handoffMsg1)

    // 2. UI设计阶段（所有复杂开发任务都需要）
    const designPhase = this.phases.find(p => p.name === 'design')!
    this.currentPhase = 'design'
    
    const uiAgent = this.agents.get('ui_designer')!
    uiAgent.status = 'working'
    
    const designResult = await this.executeAgentTask(
      uiAgent,
      `基于以下需求，提供UI设计方案：

任务：${instruction}

需求分析结果：
${analysisResult}

请提供：
1. 页面结构/模块划分
2. 组件设计
3. 用户交互流程
4. 视觉风格建议`,
      { analysisResult }
    )
    
    uiAgent.status = 'completed'
    uiAgent.lastOutput = designResult
    
    const designMsg: AgentMessage = {
      agentId: uiAgent.id,
      agentName: uiAgent.name,
      role: uiAgent.role,
      content: designResult,
      timestamp: Date.now(),
      phase: 'UI设计',
      messageType: 'response',
      priority: 'medium'
    }
    this.collaborationHistory.push(designMsg)
    onAgentMessage(designMsg)
    
    designPhase.completed = true

    // 发送交接消息 - 告诉用户下一个智能体将接手
    const handoffMsg2: AgentMessage = {
      agentId: 'system',
      agentName: '系统',
      role: '协调员',
      content: `🎨 UI设计完成。现在由 **全栈开发工程师 (Dev)** 接手，进行代码实现...`,
      timestamp: Date.now(),
      phase: '交接',
      messageType: 'handover',
      priority: 'medium'
    }
    this.collaborationHistory.push(handoffMsg2)
    onAgentMessage(handoffMsg2)

    // 3. 代码实现阶段
    const implPhase = this.phases.find(p => p.name === 'implementation')!
    this.currentPhase = 'implementation'
    
    const codeAgent = this.agents.get('code_generator')!
    codeAgent.status = 'working'
    
    const codeResult = await this.executeAgentTask(
      codeAgent,
      `你是全栈开发工程师。在开始编码之前，你必须先仔细阅读PM的需求分析结果和UI设计方案，然后才开始编写代码。

## 任务目标
${instruction}

## PM需求分析结果（必须先阅读）
${analysisResult}

## UI设计方案（必须参考）
${this.agents.get('ui_designer')?.lastOutput || ''}

## 编码要求
请根据以上需求分析和UI设计，实现完整的代码。确保：
1. 代码完整可运行
2. 严格遵循PM的需求分析
3. 符合UI设计方案
4. 遵循最佳实践
5. 包含必要的注释`,
      { 
        analysisResult,
        uiDesign: this.agents.get('ui_designer')?.lastOutput
      }
    )
    
    codeAgent.status = 'completed'
    codeAgent.lastOutput = codeResult
    
    const codeMsg: AgentMessage = {
      agentId: codeAgent.id,
      agentName: codeAgent.name,
      role: codeAgent.role,
      content: codeResult,
      timestamp: Date.now(),
      phase: '代码实现',
      messageType: 'response',
      priority: 'medium'
    }
    this.collaborationHistory.push(codeMsg)
    onAgentMessage(codeMsg)
    
    implPhase.completed = true

    // 发送交接消息 - 告诉用户下一个智能体将接手
    const handoffMsg3: AgentMessage = {
      agentId: 'system',
      agentName: '系统',
      role: '协调员',
      content: `💻 代码实现完成。现在由 **测试工程师** 接手，生成测试用例...`,
      timestamp: Date.now(),
      phase: '交接',
      messageType: 'handover',
      priority: 'medium'
    }
    this.collaborationHistory.push(handoffMsg3)
    onAgentMessage(handoffMsg3)

    // 4. 测试生成阶段
    const testPhase = this.phases.find(p => p.name === 'testing')!
    this.currentPhase = 'testing'
    
    const testAgent = this.agents.get('test_generator')!
    testAgent.status = 'working'
    
    const testResult = await this.executeAgentTask(
      testAgent,
      `请为以下代码生成测试用例：

任务：${instruction}

生成的代码：
${codeResult}

请生成：
1. 单元测试
2. 集成测试（如适用）
3. 测试覆盖说明`,
      { codeResult }
    )
    
    testAgent.status = 'completed'
    testAgent.lastOutput = testResult
    
    const testMsg: AgentMessage = {
      agentId: testAgent.id,
      agentName: testAgent.name,
      role: testAgent.role,
      content: testResult,
      timestamp: Date.now(),
      phase: '测试生成',
      messageType: 'response',
      priority: 'medium'
    }
    this.collaborationHistory.push(testMsg)
    onAgentMessage(testMsg)
    
    testPhase.completed = true

    // 发送交接消息 - 告诉用户下一个智能体将接手
    const handoffMsg4: AgentMessage = {
      agentId: 'system',
      agentName: '系统',
      role: '协调员',
      content: `🧪 测试用例生成完成。现在由 **代码审查员** 接手，进行代码审查...`,
      timestamp: Date.now(),
      phase: '交接',
      messageType: 'handover',
      priority: 'medium'
    }
    this.collaborationHistory.push(handoffMsg4)
    onAgentMessage(handoffMsg4)

    // 5. 代码审查阶段
    const reviewPhase = this.phases.find(p => p.name === 'review')!
    this.currentPhase = 'review'
    
    const reviewAgent = this.agents.get('code_reviewer')!
    reviewAgent.status = 'working'
    
    const reviewResult = await this.executeAgentTask(
      reviewAgent,
      `请审查以下代码，提供改进建议：

任务：${instruction}

代码实现：
${codeResult}

测试用例：
${testResult}

请提供：
1. 代码质量评估
2. 问题与风险
3. 改进建议
4. 优化方案（如有）`,
      { codeResult, testResult }
    )
    
    reviewAgent.status = 'completed'
    reviewAgent.lastOutput = reviewResult
    
    const reviewMsg: AgentMessage = {
      agentId: reviewAgent.id,
      agentName: reviewAgent.name,
      role: reviewAgent.role,
      content: reviewResult,
      timestamp: Date.now(),
      phase: '代码审查',
      messageType: 'response',
      priority: 'medium'
    }
    this.collaborationHistory.push(reviewMsg)
    onAgentMessage(reviewMsg)
    
    reviewPhase.completed = true

    // 发送交接消息 - 告诉用户下一个智能体将接手
    const handoffMsg5: AgentMessage = {
      agentId: 'system',
      agentName: '系统',
      role: '协调员',
      content: `🔍 代码审查完成。现在由 **项目经理 (PM)** 接手，进行最终总结...`,
      timestamp: Date.now(),
      phase: '交接',
      messageType: 'handover',
      priority: 'medium'
    }
    this.collaborationHistory.push(handoffMsg5)
    onAgentMessage(handoffMsg5)

    // 6. PM总结阶段
    const docPhase = this.phases.find(p => p.name === 'documentation')!
    this.currentPhase = 'documentation'
    
    pmAgent.status = 'working'
    
    const summaryResult = await this.executeAgentTask(
      pmAgent,
      `请总结整个开发过程，作为项目交付：

任务：${instruction}

各阶段成果：
1. 需求分析：${analysisResult?.slice(0, 500) || '无'}
2. UI设计：${(this.agents.get('ui_designer')?.lastOutput || '').slice(0, 500)}
3. 代码实现：${codeResult?.slice(0, 1000) || '无'}
4. 测试用例：${testResult?.slice(0, 500) || '无'}
5. 代码审查：${reviewResult?.slice(0, 500) || '无'}

请提供完整的工作总结和交付物清单。`,
      {
        analysisResult,
        uiDesign: this.agents.get('ui_designer')?.lastOutput,
        codeResult,
        testResult,
        reviewResult
      }
    )
    
    pmAgent.status = 'completed'
    
    const summaryMsg: AgentMessage = {
      agentId: pmAgent.id,
      agentName: pmAgent.name,
      role: pmAgent.role,
      content: summaryResult,
      timestamp: Date.now(),
      phase: '项目总结',
      messageType: 'response',
      priority: 'high'
    }
    this.collaborationHistory.push(summaryMsg)
    onAgentMessage(summaryMsg)
    
    docPhase.completed = true
    this.currentPhase = 'completed'

    // 发送项目完成消息
    const completeMsg: AgentMessage = {
      agentId: 'system',
      agentName: '系统',
      role: '协调员',
      content: `✅ 项目开发完成！所有智能体已完成协作。\n\n如需继续优化或添加新功能，请告诉我！`,
      timestamp: Date.now(),
      phase: '完成',
      messageType: 'system',
      priority: 'high'
    }
    this.collaborationHistory.push(completeMsg)
    onAgentMessage(completeMsg)

    return {
      success: true,
      result: {
        analysis: analysisResult,
        uiDesign: isFrontendTask ? this.agents.get('ui_designer')?.lastOutput : null,
        code: codeResult,
        test: testResult,
        review: reviewResult,
        summary: summaryResult
      },
      summary: summaryResult
    }
  }

  // 执行单个智能体任务
  private async executeAgentTask(agent: Agent, instruction: string, context: any): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `你是${agent.name}（${agent.role}）。你的职责是：

${this.getRoleDescription(agent.type)}

请用专业的方式完成你的工作。`
      }
    ]

    // 添加上下文
    if (Object.keys(context).length > 0) {
      messages.push({
        role: 'system',
        content: `相关上下文：\n${JSON.stringify(context, null, 2)}`
      })
    }

    messages.push({
      role: 'user',
      content: instruction
    })

    try {
      const response = await llmService.chat(agent.model, messages, {
        temperature: 0.7,
        max_tokens: 8000
      })

      if (response.success && response.content) {
        return response.content
      } else {
        throw new Error(response.error || '执行失败')
      }
    } catch (error: any) {
      console.error(`智能体 ${agent.name} 执行失败:`, error)
      return `执行出错: ${error.message}`
    }
  }

  // 获取角色描述
  private getRoleDescription(type: AgentType): string {
    const descriptions: Record<AgentType, string> = {
      code_generator: `你是全栈开发工程师，负责：
- 理解需求并实现功能
- 编写高质量、可维护的代码
- 设计合理的架构
- 遵循最佳实践`,

      test_generator: `你是测试工程师，负责：
- 理解代码功能
- 编写全面的测试用例
- 确保测试覆盖率
- 提供测试报告`,

      code_reviewer: `你是代码审查员，负责：
- 审查代码质量
- 发现潜在问题
- 提供改进建议
- 确保代码安全性和性能`,

      document_generator: `你是项目经理，负责：
- 分析需求
- 规划项目方案
- 协调各智能体工作
- 总结项目成果`,

      ui_designer: `你是UI设计师/前端工程师，负责：
- 设计用户界面
- 实现前端页面
- 优化用户体验
- 确保响应式设计`
    }
    return descriptions[type]
  }

  // 获取协作历史
  getCollaborationHistory(): AgentMessage[] {
    return this.collaborationHistory
  }

  // 获取当前阶段
  getCurrentPhase(): string {
    return this.currentPhase
  }

  // 获取阶段状态
  getPhases(): CollaborationPhase[] {
    return this.phases
  }

  // 重置协作状态
  reset() {
    this.collaborationHistory = []
    this.currentPhase = 'init'
    this.phases.forEach(p => p.completed = false)
    this.agents.forEach(agent => {
      agent.status = 'idle'
      agent.lastOutput = undefined
    })

    this.taskAssignments.clear()
    this.resourceManager.activeTasks = 0
    this.resourceManager.taskPriorities.clear()
  }

  // 评估智能体能力
  async assessAgentCapabilities(agentType: AgentType): Promise<AgentCapabilityAssessment> {
    const agent = this.agents.get(agentType)
    if (!agent) {
      throw new Error(`Agent not found: ${agentType}`)
    }

    // 使用LLM评估能力
    const assessment = await this.evaluateCapabilities(agent)
    this.agentCapabilities.set(agentType, assessment)

    return assessment
  }

  // 评估智能体能力（使用LLM）
  private async evaluateCapabilities(agent: Agent): Promise<AgentCapabilityAssessment> {
    const capabilities = agent.capabilities
    const assessments = []

    for (const capability of capabilities) {
      // 这里可以使用LLM进行更详细的能力评估
      // 为了简化，我们使用基于能力名称的启发式评估
      const score = this.calculateCapabilityScore(capability)
      assessments.push({
        capability,
        score,
        confidence: 0.8 // 模拟置信度
      })
    }

    const overallScore = assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length

    return {
      agentId: agent.id,
      agentType: agent.type,
      capabilities: assessments,
      overallScore,
      timestamp: Date.now()
    }
  }

  // 计算能力评分
  private calculateCapabilityScore(capability: string): number {
    // 基于能力名称的启发式评分
    const capabilityScores: Record<string, number> = {
      'code_generation': 90,
      'fullstack_development': 85,
      'api_design': 80,
      'database_design': 75,
      'test_generation': 85,
      'unit_test': 80,
      'integration_test': 75,
      'e2e_test': 70,
      'code_review': 85,
      'security_analysis': 80,
      'performance_analysis': 75,
      'best_practices': 80,
      'requirement_analysis': 85,
      'project_planning': 80,
      'progress_tracking': 75,
      'summary': 80,
      'ui_design': 85,
      'frontend_development': 80,
      'responsive_layout': 75,
      'ux_improvement': 70
    }

    return capabilityScores[capability] || 70
  }

  // 发送消息
  async sendMessage(message: AgentMessage): Promise<boolean> {
    // 验证消息
    if (!message.agentId || !message.content) {
      return false
    }

    // 添加到历史记录
    this.collaborationHistory.push(message)

    // 更新通信统计
    this.updateCommunicationStats(message)

    // 处理消息路由
    if (message.targetAgentId) {
      // 定向消息
      return this.routeMessage(message)
    } else {
      // 广播消息
      return this.broadcastMessage(message)
    }
  }

  // 路由消息
  private async routeMessage(message: AgentMessage): Promise<boolean> {
    // 查找目标智能体
    const targetAgent = Array.from(this.agents.values()).find(a => a.id === message.targetAgentId)
    if (!targetAgent) {
      return false
    }

    // 处理消息
    this.processMessage(message, targetAgent)
    return true
  }

  // 广播消息
  private async broadcastMessage(message: AgentMessage): Promise<boolean> {
    // 向所有智能体广播消息
    for (const agent of Array.from(this.agents.values())) {
      this.processMessage(message, agent)
    }
    return true
  }

  // 处理消息
  private async processMessage(message: AgentMessage, agent: Agent): Promise<void> {
    // 这里可以添加消息处理逻辑
    // 例如，根据消息类型执行不同的操作
    switch (message.messageType) {
      case 'task':
        // 处理任务消息
        break
      case 'question':
        // 处理问题消息
        break
      case 'suggestion':
        // 处理建议消息
        break
      case 'handover':
        // 处理交接消息
        break
      case 'system':
        // 处理系统消息
        break
    }

    // 触发消息事件
    this.emit('message', { message, agent })
  }

  // 更新通信统计
  private updateCommunicationStats(message: AgentMessage): void {
    const agentId = message.agentId
    const stats = this.communicationStats.get(agentId) || {
      totalMessages: 0,
      messagesByType: {},
      averageResponseTime: 0,
      successRate: 0,
      lastCommunication: Date.now()
    }

    stats.totalMessages++
    stats.messagesByType[message.messageType] = (stats.messagesByType[message.messageType] || 0) + 1
    stats.lastCommunication = Date.now()

    this.communicationStats.set(agentId, stats)
  }

  // 获取通信统计
  getCommunicationStats(agentId?: string): AgentCommunicationStats | Map<string, AgentCommunicationStats> {
    if (agentId) {
      return this.communicationStats.get(agentId) || {
        totalMessages: 0,
        messagesByType: {},
        averageResponseTime: 0,
        successRate: 0,
        lastCommunication: 0
      }
    }
    return this.communicationStats
  }

  // 分配任务给最合适的智能体
  async assignTask(requiredCapabilities: string[]): Promise<AgentType | null> {
    // 评估每个智能体的能力
    const assessments: { agentType: AgentType; score: number }[] = []

    for (const [agentType] of Array.from(this.agents.entries())) {
      const assessment = await this.assessAgentCapabilities(agentType)
      const score = this.calculateTaskCompatibility(assessment, requiredCapabilities)
      assessments.push({ agentType, score })
    }

    // 按兼容性排序
    assessments.sort((a, b) => b.score - a.score)

    // 选择最佳智能体
    if (assessments.length > 0 && assessments[0].score > 50) {
      return assessments[0].agentType
    }

    return null
  }

  // 计算任务兼容性
  private calculateTaskCompatibility(assessment: AgentCapabilityAssessment, requiredCapabilities: string[]): number {
    if (requiredCapabilities.length === 0) {
      return assessment.overallScore
    }

    let totalScore = 0
    let count = 0

    for (const reqCap of requiredCapabilities) {
      const capAssessment = assessment.capabilities.find(c => c.capability === reqCap)
      if (capAssessment) {
        totalScore += capAssessment.score
        count++
      }
    }

    return count > 0 ? totalScore / count : 0
  }

  // 处理协作请求
  async handleCollaborationRequest(request: AgentCollaborationRequest): Promise<{ success: boolean; assignedAgents: AgentType[] }> {
    // 分析任务需求
    const requiredAgents = await this.analyzeTaskRequirements(request.task)

    // 分配任务
    const assignedAgents: AgentType[] = []
    for (const agentType of requiredAgents) {
      // 检查智能体是否可用
      const agent = this.agents.get(agentType)
      if (agent && agent.status === 'idle') {
        assignedAgents.push(agentType)
      }
    }

    return {
      success: assignedAgents.length > 0,
      assignedAgents
    }
  }

  // 监控智能体状态
  monitorAgentStatus(): void {
    // 定期检查智能体状态
    setInterval(() => {
      for (const [, agent] of Array.from(this.agents.entries())) {
        if (agent.status === 'working' && this.isAgentStuck()) {
          // 智能体可能卡住了，需要干预
          this.handleAgentStuck(agent)
        }
      }
    }, 30000) // 每30秒检查一次
  }

  // 检查智能体是否卡住
  private isAgentStuck(): boolean {
    // 这里可以添加更复杂的逻辑
    // 例如，检查最后输出时间
    return false
  }

  // 处理智能体卡住的情况
  private async handleAgentStuck(agent: Agent): Promise<void> {
    // 重置智能体状态
    agent.status = 'idle'

    // 发送系统消息
    const message: AgentMessage = {
      agentId: 'system',
      agentName: '系统',
      role: '协调员',
      content: `智能体 ${agent.name} 似乎卡住了，已重置其状态`,
      timestamp: Date.now(),
      phase: '系统',
      messageType: 'system',
      priority: 'high'
    }

    await this.sendMessage(message)
  }

  // 获取智能体能力评估
  getAgentCapabilities(agentType: AgentType): AgentCapabilityAssessment | undefined {
    return this.agentCapabilities.get(agentType)
  }

  // 优化资源分配
  optimizeResourceAllocation(): void {
    // 这里可以添加资源优化逻辑
    // 例如，根据任务优先级调整智能体分配
  }
}

export const multiAgentCoordinator = new MultiAgentCoordinator()
