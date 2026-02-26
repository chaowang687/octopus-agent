import { EventEmitter } from 'events'
import { llmService, LLMMessage } from '../services/LLMService'
import { WorkspaceManager } from '../services/WorkspaceManager'
import { VerificationEngine, type TaskVerificationContext } from './VerificationEngine'
import { smartButlerAgent } from './SmartButlerAgent'
import { getProjectTemplate } from './templates/projectTemplates'
import { collaborationManager, CollaborationPhase } from '../ipc/handlers/collaborationHandler'
import { TaskStateManager } from './TaskStateManager'
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

export interface CoordinatorPhase {
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
  messageType: 'task' | 'response' | 'question' | 'suggestion' | 'handover' | 'system' | 'error' | 'warning'
  targetAgentId?: string
  conversationId?: string
  priority?: 'low' | 'medium' | 'high'
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
  private workspaceManager: WorkspaceManager | null = null
  private resourceManager: any = {
    activeTasks: 0,
    maxConcurrentTasks: 3,
    taskPriorities: new Map<string, 'low' | 'medium' | 'high'>()
  }
  
  // 任务状态管理器
  private taskStateManager: TaskStateManager
  private currentTaskId: string | null = null
  private isPaused: boolean = false
  
  // 验证引擎
  private verificationEngine: VerificationEngine
  
  // 任务阶段配置
  private phases: CoordinatorPhase[] = [
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
    this.initializeButler()
    this.workspaceManager = new WorkspaceManager()
    this.taskStateManager = new TaskStateManager()
    this.verificationEngine = new VerificationEngine()
    void this.saveDocument
    void this.readDocument
  }
  
  // ===== 文档管理辅助方法 =====
  
  /**
   * 保存或更新文档文件
   */
  private async saveDocument(
    docName: string,
    content: string,
    projectPath: string
  ): Promise<string> {
    const docDir = path.join(projectPath, 'docs')
    const docPath = path.join(docDir, `${docName}.md`)
    
    // 创建 docs 目录
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true, mode: 0o755 })
    }
    
    // 添加版本信息
    const versionInfo = this.currentTaskId 
      ? `\n<!-- 版本: ${Date.now()} -->\n`
      : ''
    
    const fullContent = `# ${docName.replace(/_/g, ' ')}\n\n${versionInfo}${content}\n`
    
    fs.writeFileSync(docPath, fullContent, 'utf-8')
    console.log(`[MultiAgentCoordinator] 文档已保存: ${docPath}`)
    
    return docPath
  }
  
  /**
   * 读取已有文档内容
   */
  private async readDocument(docName: string, projectPath: string): Promise<string | null> {
    const docPath = path.join(projectPath, 'docs', `${docName}.md`)
    
    if (!fs.existsSync(docPath)) {
      return null
    }
    
    try {
      return fs.readFileSync(docPath, 'utf-8')
    } catch (error) {
      console.warn(`[MultiAgentCoordinator] 读取文档失败: ${docPath}`)
      return null
    }
  }
  
  /**
   * 生成增量修改的 prompt
   */
  private buildIncrementalPrompt(
    _task: string,
    originalContent: string,
    userFeedback: string,
    modificationType: 'pm' | 'design' | 'code'
  ): string {
    const instructions = {
      pm: `你是项目经理。请根据用户反馈修改需求文档。

## 原需求文档：
${originalContent}

## 用户反馈：
${userFeedback}

## 任务：
请基于原文档和用户反馈，进行增量修改（即只修改需要改动的部分，不要完全重写）。
修改后的文档应该：
1. 保留原文档中用户满意的部分
2. 根据反馈进行针对性修改
3. 保持文档结构清晰

请直接返回修改后的完整需求文档，不要添加任何解释。`,
      
      design: `你是UI设计师。请根据用户反馈修改UI设计方案。

## 原有UI设计：
${originalContent}

## 用户反馈：
${userFeedback}

## 任务：
请基于原设计和用户反馈，进行增量修改。
修改后的设计应该：
1. 保留原设计中用户满意的部分
2. 根据反馈进行针对性修改
3. 保持设计完整性

请直接返回修改后的完整UI设计方案，不要添加任何解释。`,
      
      code: `你是全栈开发工程师。请根据用户反馈修改代码。

## 原代码方案：
${originalContent}

## 用户反馈：
${userFeedback}

## 任务：
请基于原方案和用户反馈，进行增量修改。
修改后的代码应该：
1. 尽量保留原代码中用户满意的部分
2. 根据反馈进行针对性修改
3. 确保代码完整可运行

请直接返回修改后的完整代码方案（JSON格式），不要添加任何解释。`
    }
    
    return instructions[modificationType]
  }

  /**
   * 生成结构化的智能体输出（简化版，只输出核心内容）
   */
  private generateStructuredOutput(
    agentName: string,
    phase: string,
    content: string,
    todoItems: string[] = [],
    completedItems: string[] = [],
    outputFiles: string[] = [],
    executionTime?: number,
    qualityScore?: number
  ): string {
    const structuredOutput = `${content}

---
*阶段: ${phase}*
*待办: ${todoItems.length} | 已完成: ${completedItems.length} | 产出文件: ${outputFiles.length}${executionTime ? ` | 耗时: ${executionTime}ms` : ''}${qualityScore !== undefined ? ` | 质量分: ${qualityScore}` : ''}*
*由 ${agentName} 生成于 ${new Date().toLocaleString('zh-CN')}*`
    
    return structuredOutput;
  }

  private initializeButler() {
    smartButlerAgent.on('problem_detected', (problem) => {
      console.log(`[MultiAgentCoordinator] 智能管家检测到问题: ${problem.message}`)
    })
    
    smartButlerAgent.on('problem_resolved', (problem) => {
      console.log(`[MultiAgentCoordinator] 智能管家已解决问题: ${problem.message}`)
    })
    
    smartButlerAgent.on('problem_escalated', (problem) => {
      console.log(`[MultiAgentCoordinator] 智能管家升级问题: ${problem.message}`)
    })
    
    smartButlerAgent.on('project_tracking_started', (project) => {
      console.log(`[MultiAgentCoordinator] 智能管家开始追踪项目: ${project.name}`)
    })
    
    console.log('[MultiAgentCoordinator] 智能管家已初始化')
  }

  private initializeAgents() {
    // 代码生成智能体 - 全栈开发 (使用与ChatDataService一致的ID)
    this.agents.set('code_generator', {
      id: 'agent-dev',
      name: '全栈开发工程师',
      type: 'code_generator',
      role: '全栈开发工程师 (Dev)',
      model: 'doubao-seed-2-0-lite-260215',
      capabilities: ['code_generation', 'fullstack_development', 'api_design', 'database_design'],
      status: 'idle'
    })

    // 测试生成智能体 - 测试工程师
    this.agents.set('test_generator', {
      id: 'agent-test-generator',
      name: '测试工程师',
      type: 'test_generator',
      role: '测试工程师 (Test Engineer)',
      model: 'doubao-seed-2-0-lite-260215',
      capabilities: ['test_generation', 'unit_test', 'integration_test', 'e2e_test'],
      status: 'idle'
    })

    // 代码审查智能体 - 审查员
    this.agents.set('code_reviewer', {
      id: 'agent-code-reviewer',
      name: '代码审查员',
      type: 'code_reviewer',
      role: '代码审查员 (Code Reviewer)',
      model: 'doubao-seed-2-0-lite-260215',
      capabilities: ['code_review', 'security_analysis', 'performance_analysis', 'best_practices'],
      status: 'idle'
    })

    // 文档生成智能体 - 项目经理 (使用与ChatDataService一致的ID)
    this.agents.set('document_generator', {
      id: 'agent-pm',
      name: '项目经理',
      type: 'document_generator',
      role: '项目经理 (PM)',
      model: 'doubao-seed-2-0-lite-260215',
      capabilities: ['requirement_analysis', 'project_planning', 'progress_tracking', 'summary'],
      status: 'idle'
    })

    // UI设计师智能体 - 前端开发 (使用与ChatDataService一致的ID)
    this.agents.set('ui_designer', {
      id: 'agent-ui',
      name: 'UI设计师',
      type: 'ui_designer',
      role: 'UI设计师/前端工程师',
      model: 'doubao-seed-2-0-lite-260215',
      capabilities: ['ui_design', 'frontend_development', 'responsive_layout', 'ux_improvement'],
      status: 'idle'
    })
  }

  // 获取当前工作区路径
  getWorkspacePath(): string | null {
    return this.workspaceManager?.getWorkspaceRoot() || null
  }

  // 获取工作区管理器实例（用于测试和审查）
  getWorkspaceManager(): WorkspaceManager | null {
    return this.workspaceManager
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
      const response = await llmService.chat('doubao-seed-2-0-lite-260215', [
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
  ): Promise<{ success: boolean; result: any; summary: string; error?: string }> {
    this.collaborationHistory = []
    
    // 如果还没有workspaceManager，则创建一个新的
    if (!this.workspaceManager) {
      this.workspaceManager = new WorkspaceManager()
    }
    const workspacePath = this.workspaceManager.getWorkspaceRoot()
    
    console.log(`[MultiAgentCoordinator] 开始协作，工作区: ${workspacePath}`)
    
    // 智能管家开始追踪项目
    const projectName = this.extractProjectName(instruction)
    const projectId = `project_${Date.now()}`
    smartButlerAgent.startTrackingProject(projectId, projectName, workspacePath, 'multi-agent')
    
    // 发送项目追踪开始消息
    const trackingMsg: AgentMessage = {
      agentId: 'butler',
      agentName: '智能管家',
      role: '智能管家',
      content: `📊 开始追踪项目: ${projectName}
项目ID: ${projectId}
项目路径: ${workspacePath}`,
      timestamp: Date.now(),
      phase: '项目初始化',
      messageType: 'system',
      priority: 'high'
    }
    this.collaborationHistory.push(trackingMsg)
    onAgentMessage(trackingMsg)
    
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
    
    // 发送智能体状态更新事件
    this.emit('stream', {
      type: 'agent_status',
      agentId: pmAgent.id,
      agentName: pmAgent.name,
      agentType: pmAgent.type,
      status: pmAgent.status,
      model: pmAgent.model,
      phase: this.currentPhase
    })
    
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
    
    // === PM阶段方案方向选择 ===
    let pmDirection = 'default'
    let directionOptionsList: string[] = []
    
    try {
      // 第一步：让PM分析任务，智能生成适合的方向选项
      const directionAnalysis = await this.executeAgentTask(
        pmAgent,
        `你是项目经理，请分析以下任务并生成适合的需求分析方向选项。

任务：${instruction}

请基于任务性质，生成3-5个具体的需求分析方向选项，这些选项应该：
1. 符合项目的实际需求
2. 具有明确的导向性
3. 便于用户理解和选择
4. 涵盖不同的侧重点

请直接返回选项列表，每个选项占一行，不要有任何解释。

示例：
快速原型开发
功能完整性优先
技术架构创新
用户体验优化
成本控制优先`,
        {}
      )
      
      // 解析生成的选项列表
      directionOptionsList = directionAnalysis
        .split('\n')
        .map(option => option.trim())
        .filter(option => option.length > 0)
        .slice(0, 5) // 最多取5个选项
      
      // 如果生成的选项不足，使用默认选项
      if (directionOptionsList.length < 3) {
        const defaultOptions = ['快速交付', '功能完整', '技术创新']
        directionOptionsList = [...directionOptionsList, ...defaultOptions].slice(0, 5)
      }
      
      // 第二步：使用智能生成的选项进行用户选择
      const directionOptions = await collaborationManager.requestCollaboration(
        `direction_${Date.now()}`,
        CollaborationPhase.REQUIREMENTS,
        '需求分析方向选择',
        'PM已根据项目需求分析生成了适合的方向选项，请选择一个方向，PM将基于所选方向生成详细的需求文档',
        { task: instruction, generatedOptions: directionOptionsList },
        directionOptionsList
      )
      
      if (directionOptions.status === 'approved') {
        pmDirection = directionOptions.approvedOption || 'default'
        
        const directionMsg: AgentMessage = {
          agentId: 'system',
          agentName: '系统',
          role: '协调员',
          content: `📋 用户选择需求分析方向：${pmDirection}`,
          timestamp: Date.now(),
          phase: '需求分析',
          messageType: 'system',
          priority: 'high'
        }
        this.collaborationHistory.push(directionMsg)
        onAgentMessage(directionMsg)
      }
    } catch (error) {
      console.warn('[MultiAgentCoordinator] 方向选择跳过:', error)
      // 出错时使用默认方向
      pmDirection = '功能完整'
    }
    
    let analysisResult = await this.executeAgentTask(
      pmAgent,
      `你是项目经理，请对以下任务进行专业的需求分析。

⚠️ 任务信息（直接分析，不要检查任何文件）：
- 任务描述：${instruction}
- 分析方向：${pmDirection}

## 你的任务：输出完整的《需求分析文档》

请按以下格式输出（内容要专业、简洁、聚焦产品本身）：

# 需求分析文档

## 1. 项目概述
[用1-2句话描述这个项目的核心价值和目标]

## 2. 核心功能
[列出3-7个核心功能点，每个功能用1句话描述]

## 3. 功能需求
### 3.1 功能1名称
- 功能描述
- 用户操作流程
- 预期结果

### 3.2 功能2名称
[按上述格式列出所有功能]

## 4. 技术选型
- 前端技术栈：[列出核心技术]
- 后端技术栈（如需要）：[列出核心技术]
- 数据存储：[说明存储方案]

## 5. 实施计划
1. [阶段1：核心功能开发]
2. [阶段2：功能完善]
3. [阶段3：测试优化]

请直接输出完整的分析文档，不要询问任何问题，不要输出任何无关信息。`,
      { direction: pmDirection }
    )
    
    // 同步保存 .md 文档（使用原有路径）
    let outputFiles: string[] = []
    if (taskDir) {
      try {
        const projectDocPath = path.join(taskDir, 'project')
        if (!fs.existsSync(projectDocPath)) {
          // 添加权限参数，确保创建的目录有读写权限
          fs.mkdirSync(projectDocPath, { recursive: true, mode: 0o755 })
        }
        const docPath = path.join(projectDocPath, '01_需求分析.md')
        fs.writeFileSync(docPath, `# 需求分析\n\n${analysisResult}`, { encoding: 'utf-8', mode: 0o644 })
        outputFiles.push(docPath)
        console.log(`[MultiAgentCoordinator] 需求分析已保存: ${docPath}`)
      } catch (error: any) {
        console.error(`[MultiAgentCoordinator] 保存需求分析文档失败:`, error)
        if (error.code === 'EACCES') {
          // 权限错误，尝试使用权限修复工具
          console.log(`[MultiAgentCoordinator] 权限不足，尝试修复权限...`)
          // 这里可以调用权限修复工具
        }
      }
    }
    
    // 生成结构化输出
    const structuredOutput = this.generateStructuredOutput(
      pmAgent.name,
      '需求分析',
      analysisResult,
      ['用户确认需求方案', '进入UI设计阶段'],
      ['分析用户需求', '生成需求文档', '保存需求分析.md'],
      outputFiles
    )
    
    const analysisMsg: AgentMessage = {
      agentId: pmAgent.id,
      agentName: pmAgent.name,
      role: pmAgent.role,
      content: structuredOutput,
      timestamp: Date.now(),
      phase: '需求分析',
      messageType: 'response',
      priority: 'medium'
    }
    this.collaborationHistory.push(analysisMsg)
    onAgentMessage(analysisMsg)
    
    // 保存分析结果
    this.savePhaseState('analysis', analysisResult)
    
    // === PM阶段多轮迭代确认 ===
    let pmConfirmed = false
    let pmIteration = 0
    const maxPMPages = 3 // 最多迭代3轮
    
    while (!pmConfirmed && pmIteration < maxPMPages) {
      try {
        const options = pmIteration === 0 
          ? ['确认方案', '需要修改']
          : ['确认方案', '仍需修改', '简化需求', '增加功能']
          
        const collaborationRequest = await collaborationManager.requestCollaboration(
          `task_${Date.now()}`,
          CollaborationPhase.REQUIREMENTS,
          pmIteration === 0 ? '需求分析完成' : `需求分析 (第${pmIteration + 1}次修改)`,
          pmIteration === 0 
            ? 'PM已完成需求分析，请确认方案是否满足您的需求'
            : '已根据您的反馈更新方案，请再次确认',
          { task: instruction, analysis: analysisResult },
          options
        )
        
        if (collaborationRequest.status === 'approved') {
          // 用户确认方案合格
          pmConfirmed = true
          onAgentMessage({
            agentId: pmAgent.id,
            agentName: pmAgent.name,
            role: pmAgent.role,
            content: `✅ 用户已确认需求方案，进入下一阶段。`,
            timestamp: Date.now(),
            phase: '需求分析',
            messageType: 'response'
          })
          break
        }
        
        // 用户需要修改
        onAgentMessage({
          agentId: pmAgent.id,
          agentName: pmAgent.name,
          role: pmAgent.role,
          content: `📝 用户反馈 (第${pmIteration + 1}次)：${(collaborationRequest as any).userFeedback || ''}\n\n请根据反馈修改需求文档。`,
          timestamp: Date.now(),
          phase: '需求分析',
          messageType: 'question'
        })
        
        // 检查是否暂停，如果暂停则等待恢复
        while (this.checkPaused()) {
          console.log('[MultiAgentCoordinator] 等待任务恢复...')
          // 发送暂停消息
          onAgentMessage({
            agentId: 'system',
            agentName: '系统',
            role: '协调员',
            content: '⏸️ 任务已暂停，等待恢复...',
            timestamp: Date.now(),
            phase: this.currentPhase,
            messageType: 'system',
            priority: 'high'
          })
          // 等待2秒再检查
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
        // 增量修改分析结果
        pmIteration++
        
        // 使用增量修改 prompt
        const incrementalPrompt = this.buildIncrementalPrompt(
          instruction,
          analysisResult,
          (collaborationRequest as any).userFeedback || '',
          'pm'
        )
        
        const reAnalysisResult = await this.executeAgentTask(
          pmAgent,
          incrementalPrompt,
          {}
        )
        
        analysisResult = reAnalysisResult
        this.savePhaseState('analysis', analysisResult)
        
        // 同步更新 .md 文档
        if (taskDir) {
          const docPath = path.join(taskDir, 'project', '01_需求分析.md')
          fs.writeFileSync(docPath, `# 需求分析 (第${pmIteration}次修改)\n\n${analysisResult}`, 'utf-8')
          console.log(`[MultiAgentCoordinator] 需求分析已更新: ${docPath}`)
        }
        
        // 发送更新后的分析结果
        const reAnalysisMsg: AgentMessage = {
          agentId: pmAgent.id,
          agentName: pmAgent.name,
          role: pmAgent.role,
          content: `📝 需求文档已更新 (第${pmIteration + 1}次)：\n\n${analysisResult}`,
          timestamp: Date.now(),
          phase: '需求分析',
          messageType: 'response',
          priority: 'medium'
        }
        this.collaborationHistory.push(reAnalysisMsg)
        onAgentMessage(reAnalysisMsg)
        
      } catch (error) {
        console.warn('[MultiAgentCoordinator] PM确认跳过:', error)
        pmConfirmed = true // 出错时继续执行
        break
      }
    }
    
    if (!pmConfirmed && pmIteration >= maxPMPages) {
      onAgentMessage({
        agentId: 'system',
        agentName: '系统',
        role: '协调员',
        content: `⚠️ 已达到最大迭代次数 (${maxPMPages}次)，强制进入下一阶段。`,
        timestamp: Date.now(),
        phase: '需求分析',
        messageType: 'warning'
      })
    }
    
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
   // UI开始设计
    const uiAgent = this.agents.get('ui_designer')!
    uiAgent.status = 'working'
    
    // 发送智能体状态更新事件
    this.emit('stream', {
      type: 'agent_status',
      agentId: uiAgent.id,
      agentName: uiAgent.name,
      agentType: uiAgent.type,
      status: uiAgent.status,
      model: uiAgent.model,
      phase: this.currentPhase
    })
    
    // === UI阶段方案方向选择 ===
    let uiDirection = 'default'
    let uiOptionsList: string[] = []
    
    try {
      // 第一步：让UI设计师分析任务，智能生成适合的风格选项
      const styleAnalysis = await this.executeAgentTask(
        uiAgent,
        `你是UI设计师，请分析以下任务和需求分析结果，并生成适合的UI设计风格选项。

任务：${instruction}

需求分析结果：${analysisResult}

请基于任务性质和需求分析，生成3-5个具体的UI设计风格选项，这些选项应该：
1. 符合项目的实际需求和目标用户
2. 具有明确的设计风格导向
3. 便于用户理解和选择
4. 涵盖不同的设计美学

请直接返回选项列表，每个选项占一行，不要有任何解释。

示例：
极简现代风格
科技感未来风格
温馨自然风格
商务专业风格
复古经典风格`,
        { analysisResult }
      )
      
      // 解析生成的选项列表
      uiOptionsList = styleAnalysis
        .split('\n')
        .map(option => option.trim())
        .filter(option => option.length > 0)
        .slice(0, 5) // 最多取5个选项
      
      // 如果生成的选项不足，使用默认选项
      if (uiOptionsList.length < 3) {
        const defaultOptions = ['极简风格', '现代风格', '科技风格']
        uiOptionsList = [...uiOptionsList, ...defaultOptions].slice(0, 5)
      }
      
      // 第二步：使用智能生成的选项进行用户选择
      const directionOptions = await collaborationManager.requestCollaboration(
        `direction_${Date.now()}`,
        CollaborationPhase.ARCHITECTURE,
        'UI设计方向选择',
        'UI设计师已根据项目需求分析生成了适合的设计风格选项，请选择一个风格，设计师将基于所选风格生成详细的设计方案',
        { task: instruction, analysis: analysisResult, generatedOptions: uiOptionsList },
        uiOptionsList
      )
      
      if (directionOptions.status === 'approved') {
        uiDirection = directionOptions.approvedOption || 'default'
        
        const directionMsg: AgentMessage = {
          agentId: 'system',
          agentName: '系统',
          role: '协调员',
          content: `🎨 用户选择UI设计方向：${uiDirection}`,
          timestamp: Date.now(),
          phase: 'UI设计',
          messageType: 'system',
          priority: 'high'
        }
        this.collaborationHistory.push(directionMsg)
        onAgentMessage(directionMsg)
      }
    } catch (error) {
      console.warn('[MultiAgentCoordinator] UI方向选择跳过:', error)
      // 出错时使用默认方向
      uiDirection = '现代风格'
    }
    
    let designResult = await this.executeAgentTask(
      uiAgent,
      `你是UI设计师/前端工程师，请基于需求分析结果进行界面设计。

⚠️ 已知信息（直接设计，不要检查任何文件）：
- 任务描述：${instruction}
- 需求分析结果：${analysisResult}
- 设计风格：${uiDirection}

## 你的任务：输出完整的《UI设计方案》

请按以下格式输出（内容要专业、简洁、聚焦设计本身）：

# UI设计方案

## 1. 设计概述
[用1-2句话描述整体设计风格和设计理念]

## 2. 页面结构
### 2.1 页面1名称
- 页面功能：[描述]
- 布局结构：[描述布局方式]
- 核心组件：[列出主要组件]

### 2.2 页面2名称
[按上述格式列出所有页面]

## 3. 组件设计
### 3.1 组件1名称
- 组件用途：[描述]
- 属性：[列出关键属性]
- 交互：[描述交互方式]

### 3.2 组件2名称
[按上述格式列出所有组件]

## 4. 视觉规范
- 配色方案：[主色、辅助色、背景色]
- 字体：[字体族、字号规范]
- 间距：[基础间距单位]

## 5. 交互设计
[列出关键交互流程]

请直接输出完整的设计方案，不要询问任何问题，不要输出任何无关信息。`,
      { analysisResult }
    )
    
    // 同步保存 .md 文档
    let uiOutputFiles: string[] = []
    if (taskDir) {
      try {
        const projectDocPath = path.join(taskDir, 'project')
        if (!fs.existsSync(projectDocPath)) {
          // 添加权限参数，确保创建的目录有读写权限
          fs.mkdirSync(projectDocPath, { recursive: true, mode: 0o755 })
        }
        const docPath = path.join(projectDocPath, '02_UI设计.md')
        fs.writeFileSync(docPath, `# UI设计\n\n${designResult}`, { encoding: 'utf-8', mode: 0o644 })
        uiOutputFiles.push(docPath)
        console.log(`[MultiAgentCoordinator] UI设计已保存: ${docPath}`)
      } catch (error: any) {
        console.error(`[MultiAgentCoordinator] 保存UI设计文档失败:`, error)
        if (error.code === 'EACCES') {
          // 权限错误，尝试使用权限修复工具
          console.log(`[MultiAgentCoordinator] 权限不足，尝试修复权限...`)
          // 这里可以调用权限修复工具
        }
      }
    }
    
    // 生成结构化输出
    const uiStructuredOutput = this.generateStructuredOutput(
      uiAgent.name,
      'UI设计',
      designResult,
      ['用户确认UI设计', '进入代码实现阶段'],
      ['分析需求文档', '生成UI设计方案', '保存UI设计.md'],
      uiOutputFiles
    )
    
    const designMsg: AgentMessage = {
      agentId: uiAgent.id,
      agentName: uiAgent.name,
      role: uiAgent.role,
      content: uiStructuredOutput,
      timestamp: Date.now(),
      phase: 'UI设计',
      messageType: 'response',
      priority: 'medium'
    }
    this.collaborationHistory.push(designMsg)
    onAgentMessage(designMsg)
    
    // 保存设计结果
    this.savePhaseState('design', designResult)
    
    // === UI设计多轮迭代确认 ===
    let designConfirmed = false
    let designIteration = 0
    const maxDesignIterations = 3
    
    while (!designConfirmed && designIteration < maxDesignIterations) {
      try {
        const options = designIteration === 0
          ? ['确认设计', '需要修改']
          : ['确认设计', '仍需修改', '简化界面', '增加效果']
          
        const archCollaborationRequest = await collaborationManager.requestCollaboration(
          `task_${Date.now()}`,
          CollaborationPhase.ARCHITECTURE,
          designIteration === 0 ? 'UI设计完成' : `UI设计 (第${designIteration + 1}次修改)`,
          designIteration === 0
            ? 'UI设计师已完成界面设计，请确认是否满足需求'
            : '已根据您的反馈更新设计，请再次确认',
          { task: instruction, analysis: analysisResult, design: designResult },
          options
        )
        
        if (archCollaborationRequest.status === 'approved') {
          designConfirmed = true
          onAgentMessage({
            agentId: uiAgent.id,
            agentName: uiAgent.name,
            role: uiAgent.role,
            content: `✅ 用户已确认UI设计，进入下一阶段。`,
            timestamp: Date.now(),
            phase: 'UI设计',
            messageType: 'response'
          })
          break
        }
        
        // 用户需要修改
        onAgentMessage({
          agentId: uiAgent.id,
          agentName: uiAgent.name,
          role: uiAgent.role,
          content: `📝 用户反馈 (第${designIteration + 1}次)：${(archCollaborationRequest as any).userFeedback || ''}\n\n请根据反馈修改UI设计。`,
          timestamp: Date.now(),
          phase: 'UI设计',
          messageType: 'question'
        })
        
        if (this.checkPaused()) {
          return { success: false, result: null, summary: '', error: '用户暂停任务' }
        }
        
        // 重新设计 - 使用增量修改
        designIteration++
        
        // 使用增量修改 prompt
        const incrementalPrompt = this.buildIncrementalPrompt(
          instruction,
          designResult,
          (archCollaborationRequest as any).userFeedback || '',
          'design'
        )
        
        const reDesignResult = await this.executeAgentTask(
          uiAgent,
          incrementalPrompt,
          { analysisResult }
        )
        
        designResult = reDesignResult
        this.savePhaseState('design', designResult)
        
        // 同步更新 .md 文档
        if (taskDir) {
          const docPath = path.join(taskDir, 'project', '02_UI设计.md')
          fs.writeFileSync(docPath, `# UI设计方案 (第${designIteration}次修改)\n\n${designResult}`, 'utf-8')
          console.log(`[MultiAgentCoordinator] UI设计已更新: ${docPath}`)
        }
        
        const reDesignMsg: AgentMessage = {
          agentId: uiAgent.id,
          agentName: uiAgent.name,
          role: uiAgent.role,
          content: `📝 UI设计已更新 (第${designIteration + 1}次)：\n\n${designResult}`,
          timestamp: Date.now(),
          phase: 'UI设计',
          messageType: 'response',
          priority: 'medium'
        }
        this.collaborationHistory.push(reDesignMsg)
        onAgentMessage(reDesignMsg)
        
      } catch (error) {
        console.warn('[MultiAgentCoordinator] UI设计确认跳过:', error)
        designConfirmed = true
        break
      }
    }
    
    if (!designConfirmed && designIteration >= maxDesignIterations) {
      onAgentMessage({
        agentId: 'system',
        agentName: '系统',
        role: '协调员',
        content: `⚠️ 已达到最大迭代次数 (${maxDesignIterations}次)，强制进入下一阶段。`,
        timestamp: Date.now(),
        phase: 'UI设计',
        messageType: 'warning'
      })
    }
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
    
    // 发送智能体状态更新事件
    this.emit('stream', {
      type: 'agent_status',
      agentId: codeAgent.id,
      agentName: codeAgent.name,
      agentType: codeAgent.type,
      status: codeAgent.status,
      model: codeAgent.model,
      phase: this.currentPhase
    })

    // 确定项目类型
    const projectType = this.determineProjectType(instruction)
    const requiredFiles = this.getRequiredFiles(projectType)
    const requiredFilesList = requiredFiles.map(f => `- ${f}`).join('\n')
    
    // 获取项目模板
    const template = getProjectTemplate(projectType)
    let templateInfo = ''
    if (template) {
      templateInfo = `
## 📋 项目模板参考
项目类型：${template.name}
描述：${template.description}

你可以参考以下模板结构，但必须根据实际需求进行调整：

${template.files.map(f => `
- ${f.path}
  \`\`\`
  ${f.content.substring(0, 100)}...
  \`\`\`
`).join('\n')}
`
    }
    
    let codeResult = await this.executeAgentTask(
      codeAgent,
      `你是全栈开发工程师。在开始编码之前，你必须先仔细阅读PM的需求分析结果和UI设计方案，然后才开始编写代码。

## 任务目标
${instruction}

## PM需求分析结果（必须先阅读）
${analysisResult}

## UI设计方案（必须参考）
${this.agents.get('ui_designer')?.lastOutput || ''}

${templateInfo}

## 编码要求
请根据以上需求分析和UI设计，实现完整的代码。确保：
1. 代码完整可运行
2. 严格遵循PM的需求分析
3. 符合UI设计方案
4. 遵循最佳实践
5. 包含必要的注释

## 🚨 重要：必须以纯JSON格式返回

你必须以纯JSON格式返回项目文件结构，不要包含任何其他文字、解释或Markdown格式。

返回格式：
{
  "files": [
    {
      "path": "文件路径",
      "content": "文件内容"
    }
  ]
}

🔴 严格要求：
1. 必须返回有效的JSON格式
2. 不要包含任何其他文字、解释或说明
3. 不要使用Markdown代码块（\`\`\`json）
4. files数组必须包含所有需要创建的文件
5. 每个文件必须有path和content字段
6. path是相对于项目根目录的路径
7. content是文件的完整内容
8. 确保JSON格式正确，可以被JSON.parse()解析

📋 必需文件清单：
${requiredFilesList}

请确保你的JSON包含上述所有必需文件。`,
      { 
        analysisResult,
        uiDesign: this.agents.get('ui_designer')?.lastOutput,
        workspacePath,
        projectName,
        projectType
      }
    )
    
    // 解析代码结果并创建文件
    let projectPath = ''
    let createdFiles: string[] = []
    let validation: { isValid: boolean; missingFiles: string[]; errors: string[] } = {
      isValid: true,
      missingFiles: [],
      errors: []
    }
    
    try {
      // 使用重试机制解析JSON
      const codeData = await this.parseCodeResultWithRetry(codeResult)
      projectPath = path.join(workspacePath, projectName)

      // 创建项目目录
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true, mode: 0o755 })
      }

      // 创建文件
      for (const file of codeData.files) {
        try {
          const filePath = path.join(projectPath, file.path)
          const dirPath = path.dirname(filePath)

          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 })
          }

          fs.writeFileSync(filePath, file.content, { encoding: 'utf-8', mode: 0o644 })
          createdFiles.push(filePath)
        } catch (error: any) {
          console.error(`[MultiAgentCoordinator] 创建文件失败 ${file.path}:`, error)
          if (error.code === 'EACCES') {
            console.log(`[MultiAgentCoordinator] 权限不足，尝试修复权限...`)
            // 这里可以调用权限修复工具
          }
        }
      }

      console.log(`[MultiAgentCoordinator] 项目创建成功: ${projectPath}`)
      console.log(`[MultiAgentCoordinator] 创建文件数: ${createdFiles.length}`)

      // 验证项目完整性
      validation = this.validateProject(projectPath, projectType)

      if (!validation.isValid) {
        console.warn(`[MultiAgentCoordinator] 项目验证失败:`)
        console.warn(`  缺少文件: ${validation.missingFiles.join(', ')}`)
        console.warn(`  错误: ${validation.errors.join(', ')}`)

        // 注册问题到智能管家
        await smartButlerAgent.registerProblem(
          new Error(`项目不完整: 缺少${validation.missingFiles.length}个文件`),
          codeAgent.id,
          this.currentPhase,
          {
            projectPath,
            projectName,
            missingFiles: validation.missingFiles,
            errors: validation.errors
          }
        )

        // 发送警告消息
        const warningMsg: AgentMessage = {
          agentId: 'system',
          agentName: '系统',
          role: '协调员',
          content: `⚠️ 项目创建成功，但不完整！

项目路径：${projectPath}
创建文件数：${createdFiles.length}

缺少的文件：
${validation.missingFiles.map(f => `  - ${f}`).join('\n')}

错误：
${validation.errors.map(e => `  - ${e}`).join('\n')}

建议：手动补充缺失的文件或重新生成项目。`,
          timestamp: Date.now(),
          phase: '代码实现',
          messageType: 'warning',
          priority: 'high'
        }
        this.collaborationHistory.push(warningMsg)
        onAgentMessage(warningMsg)
      } else {
        console.log(`[MultiAgentCoordinator] 项目验证通过`)
      }

      codeAgent.status = 'completed'
      codeAgent.lastOutput = codeResult

      // 生成代码实现的详细内容
      const codeContent = `✅ 代码实现完成！

项目路径：${projectPath}
创建文件数：${createdFiles.length}
${!validation.isValid ? `
⚠️ 项目不完整！
缺少文件：${validation.missingFiles.join(', ')}
` : ''}

文件列表：
${createdFiles.map(f => `  - ${path.relative(projectPath, f)}`).join('\n')}`

      // 生成结构化输出
      const codeStructuredOutput = this.generateStructuredOutput(
        codeAgent.name,
        '代码实现',
        codeContent,
        ['用户确认代码实现', '进入测试和审查阶段'],
        ['分析需求和设计', '生成项目代码', '创建项目文件', '验证项目完整性'],
        createdFiles.map(f => path.relative(projectPath, f)),
        undefined,
        validation.isValid ? 9 : 7
      )

      const codeMsg: AgentMessage = {
        agentId: codeAgent.id,
        agentName: codeAgent.name,
        role: codeAgent.role,
        content: codeStructuredOutput,
        timestamp: Date.now(),
        phase: '代码实现',
        messageType: 'response',
        priority: 'high'
      }
      this.collaborationHistory.push(codeMsg)
      onAgentMessage(codeMsg)
    } catch (error: any) {
      console.error('[MultiAgentCoordinator] 解析代码结果或创建文件失败:', error)

      // 注册问题到智能管家
      await smartButlerAgent.registerProblem(
        error,
        codeAgent.id,
        this.currentPhase,
        { codeResult, workspacePath, projectName }
      )

      codeAgent.status = 'failed'
      codeAgent.lastOutput = `代码实现失败: ${error.message}`

      const errorMsg: AgentMessage = {
        agentId: codeAgent.id,
        agentName: codeAgent.name,
        role: codeAgent.role,
        content: `❌ 代码实现失败

错误：${error.message}

原始输出：
${codeResult}`,
        timestamp: Date.now(),
        phase: '代码实现',
        messageType: 'error',
        priority: 'high'
      }
      this.collaborationHistory.push(errorMsg)
      onAgentMessage(errorMsg)
    }
    
    implPhase.completed = true
    
    // 保存代码实现结果
    this.savePhaseState('implementation', codeResult)
    
    // ========== 代码实现完成后进行验证 ==========
    console.log('[MultiAgentCoordinator] 开始验证代码实现...')
    try {
      const createdFilePaths = createdFiles.map(f => path.join(projectPath, f))
      
      const verificationContext: TaskVerificationContext = {
        taskId: `impl_${Date.now()}`,
        taskDescription: `代码实现: ${instruction}`,
        acceptanceCriteria: [
          '所有必需文件已创建',
          '代码不包含TODO/FIXME占位符',
          'TypeScript语法检查通过',
          '项目可以成功构建'
        ],
        createdFiles: createdFilePaths,
        projectPath
      }
      
      const verificationResult = await this.verificationEngine.verifyTask(verificationContext)
      
      // 发送验证结果消息
      const verifyMsg: AgentMessage = {
        agentId: 'system',
        agentName: '验证引擎',
        role: '系统',
        content: verificationResult.success 
          ? `✅ 代码实现验证通过\n\n${verificationResult.message}`
          : `⚠️ 代码实现验证发现问题\n\n${verificationResult.message}\n\n问题列表:\n${(verificationResult.warnings || []).map(w => `- ${w}`).join('\n')}`,
        timestamp: Date.now(),
        phase: '代码实现',
        messageType: verificationResult.success ? 'response' : 'warning',
        priority: 'high'
      }
      this.collaborationHistory.push(verifyMsg)
      onAgentMessage(verifyMsg)
      
      if (!verificationResult.success) {
        // 验证失败，记录到智能管家
        await smartButlerAgent.registerProblem(
          new Error(verificationResult.message),
          'verification',
          'implementation',
          { verificationResult, createdFiles }
        )
      }
    } catch (verifyError) {
      console.warn('[MultiAgentCoordinator] 代码验证失败:', verifyError)
    }
    
    // === 代码实现多轮迭代确认 ===
    let codeConfirmed = false
    let codeIteration = 0
    const maxCodeIterations = 2 // 代码修改成本高，最多2次
    
    while (!codeConfirmed && codeIteration < maxCodeIterations) {
      try {
        const validationInfo = validation.isValid 
          ? '' 
          : `\n⚠️ 项目不完整，缺少: ${validation.missingFiles.join(', ')}`
          
        const options = codeIteration === 0
          ? ['确认代码', '需要修改']
          : ['确认代码', '仍需修改']
          
        const implConfirm = await collaborationManager.requestCollaboration(
          `task_${Date.now()}`,
          CollaborationPhase.IMPLEMENTATION,
          codeIteration === 0 ? '代码实现完成' : `代码修改 (第${codeIteration + 1}次)`,
          codeIteration === 0
            ? `代码已生成，共${createdFiles.length}个文件。请确认是否满足需求。${validationInfo}`
            : '已根据您的反馈更新代码，请再次确认',
          { task: instruction, projectPath, createdFiles: createdFiles.length, validation },
          options
        )
        
        if (implConfirm.status === 'approved') {
          codeConfirmed = true
          onAgentMessage({
            agentId: codeAgent.id,
            agentName: codeAgent.name,
            role: codeAgent.role,
            content: `✅ 用户已确认代码实现，进入测试和审查阶段。`,
            timestamp: Date.now(),
            phase: '代码实现',
            messageType: 'response'
          })
          break
        }
        
        // 用户需要修改
        onAgentMessage({
          agentId: codeAgent.id,
          agentName: codeAgent.name,
          role: codeAgent.role,
            content: `📝 用户反馈 (第${codeIteration + 1}次)：${(implConfirm as any).userFeedback || ''}\n\n请根据反馈修改代码。`,
          timestamp: Date.now(),
          phase: '代码实现',
          messageType: 'question'
        })
        
        if (this.checkPaused()) {
          return { success: false, result: null, summary: '', error: '用户暂停任务' }
        }
        
        // 重新生成代码 - 使用增量修改
        codeIteration++
        
        // 使用增量修改 prompt
        const incrementalPrompt = this.buildIncrementalPrompt(
          instruction,
          codeResult,
          (implConfirm as any).userFeedback || '',
          'code'
        )
        
        // 重新调用代码生成
        const reCodeResult = await this.executeAgentTask(
          codeAgent,
          incrementalPrompt,
          { analysisResult, uiDesign: designResult, workspacePath, projectName, projectType }
        )
        
        // 重新解析和创建文件
        const reCodeData = await this.parseCodeResultWithRetry(reCodeResult)
        
        // 删除旧文件，创建新文件
        if (fs.existsSync(projectPath)) {
          const oldFiles = fs.readdirSync(projectPath)
          for (const file of oldFiles) {
            fs.rmSync(path.join(projectPath, file), { recursive: true, force: true })
          }
        }
        
        createdFiles = []
        for (const file of reCodeData.files) {
          const filePath = path.join(projectPath, file.path)
          const dirPath = path.dirname(filePath)
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 })
          }
          fs.writeFileSync(filePath, file.content, 'utf-8')
          createdFiles.push(filePath)
        }
        
        codeResult = reCodeResult
        this.savePhaseState('implementation', codeResult)
        
        // 重新验证
        validation = this.validateProject(projectPath, projectType)
        
        const reCodeMsg: AgentMessage = {
          agentId: codeAgent.id,
          agentName: codeAgent.name,
          role: codeAgent.role,
          content: `📝 代码已更新 (第${codeIteration + 1}次)，创建文件 ${createdFiles.length} 个`,
          timestamp: Date.now(),
          phase: '代码实现',
          messageType: 'response',
          priority: 'high'
        }
        this.collaborationHistory.push(reCodeMsg)
        onAgentMessage(reCodeMsg)
        
      } catch (error) {
        console.warn('[MultiAgentCoordinator] 代码确认跳过:', error)
        codeConfirmed = true
        break
      }
    }
    
    if (!codeConfirmed && codeIteration >= maxCodeIterations) {
      onAgentMessage({
        agentId: 'system',
        agentName: '系统',
        role: '协调员',
        content: `⚠️ 已达到最大迭代次数 (${maxCodeIterations}次)，强制进入测试和审查阶段。`,
        timestamp: Date.now(),
        phase: '代码实现',
        messageType: 'warning'
      })
    }

    // 发送交接消息 - 告诉用户测试和审查将并行执行
    const handoffMsg3: AgentMessage = {
      agentId: 'system',
      agentName: '系统',
      role: '协调员',
      content: `💻 代码实现完成。现在 **测试工程师** 和 **代码审查员** 将并行工作...`,
      timestamp: Date.now(),
      phase: '交接',
      messageType: 'handover',
      priority: 'medium'
    }
    this.collaborationHistory.push(handoffMsg3)
    onAgentMessage(handoffMsg3)

    // 4. 测试生成 + 代码审查阶段（并行执行）
    const testPhase = this.phases.find(p => p.name === 'testing')!
    const reviewPhase = this.phases.find(p => p.name === 'review')!
    this.currentPhase = 'testing_and_review'
    
    const testAgent = this.agents.get('test_generator')!
    const reviewAgent = this.agents.get('code_reviewer')!
    testAgent.status = 'working'
    reviewAgent.status = 'working'
    
    // 发送测试和审查智能体状态更新事件
    this.emit('stream', {
      type: 'agent_status',
      agentId: testAgent.id,
      agentName: testAgent.name,
      agentType: testAgent.type,
      status: testAgent.status,
      model: testAgent.model,
      phase: this.currentPhase
    })
    this.emit('stream', {
      type: 'agent_status',
      agentId: reviewAgent.id,
      agentName: reviewAgent.name,
      agentType: reviewAgent.type,
      status: reviewAgent.status,
      model: reviewAgent.model,
      phase: this.currentPhase
    })
    
    // 统一验证项目完整性（只验证一次）
    const preTestValidation = this.validateProject(projectPath, projectType)
    if (!preTestValidation.isValid) {
      const skipTestMsg: AgentMessage = {
        agentId: 'system',
        agentName: '系统',
        role: '协调员',
        content: `⚠️ 跳过测试生成阶段 - 项目不完整

缺少文件：
${preTestValidation.missingFiles.map(f => `  - ${f}`).join('\n')}

错误：
${preTestValidation.errors.map(e => `  - ${e}`).join('\n')}

建议：请先修复代码生成阶段的问题。`,
        timestamp: Date.now(),
        phase: '测试生成',
        messageType: 'warning',
        priority: 'high'
      }
      this.collaborationHistory.push(skipTestMsg)
      onAgentMessage(skipTestMsg)
      
      testAgent.status = 'failed'
      testAgent.lastOutput = '测试生成跳过：项目不完整'
      testPhase.completed = false
      
      // 继续审查阶段（不跳过）
      const skipReviewMsg: AgentMessage = {
        agentId: 'system',
        agentName: '系统',
        role: '协调员',
        content: `⚠️ 由于项目不完整，将跳过测试生成，直接进入代码审查...`,
        timestamp: Date.now(),
        phase: '交接',
        messageType: 'handover',
        priority: 'medium'
      }
      this.collaborationHistory.push(skipReviewMsg)
      onAgentMessage(skipReviewMsg)
    }
    
    // 获取工作区中的实际文件列表用于测试和审查
    let verificationInfo = ''
    let actualFilesContent = ''
    
    if (this.workspaceManager) {
      try {
        const files = await this.workspaceManager.listFiles('', true)
        const projectFiles = files.filter(f => !f.isDirectory)
        
        verificationInfo = `

## 项目文件验证信息：
工作区路径：${this.workspaceManager.getWorkspaceRoot()}

实际创建的文件列表：
${projectFiles.map(f => `- ${f.path} (${f.size} bytes)`).join('\n')}

文件总数：${projectFiles.length}
目录总数：${files.filter(f => f.isDirectory).length}

请验证以上文件是否与代码实现一致，并基于实际文件生成测试用例。`

        // 读取关键源代码文件用于审查
        const sourceFiles = projectFiles.filter(f => 
          f.name.endsWith('.ts') || f.name.endsWith('.tsx') || 
          f.name.endsWith('.js') || f.name.endsWith('.jsx') ||
          f.name.endsWith('.py') || f.name.endsWith('.java')
        ).slice(0, 10)
        
        for (const file of sourceFiles) {
          try {
            const content = await this.workspaceManager.readFile(file.path)
            actualFilesContent += `\n\n## 文件: ${file.path}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\`\n`
          } catch (e) {
            console.warn(`[MultiAgentCoordinator] 读取文件失败: ${file.path}`)
          }
        }
      } catch (error) {
        console.warn('[MultiAgentCoordinator] 获取文件列表失败:', error)
      }
    }
    
    // 5. 测试生成 + 代码审查阶段（真正并行执行）
    const [testResult, reviewResult] = await Promise.all([
      // 测试任务
      this.executeAgentTask(
        testAgent,
        `请为以下代码生成测试用例：

## 完整上下文信息：
### 原始任务：
${instruction}

### 需求分析结果：
${analysisResult}

### UI设计结果：
${designResult || '无'}

### 代码实现结果：
${codeResult}
${verificationInfo}

请生成：
1. 单元测试
2. 集成测试（如适用）
3. 测试覆盖说明

重要：
- 请基于实际项目文件生成测试用例，确保测试文件路径与实际文件一致
- 测试文件应放在项目的 tests 或 __tests__ 目录下`,
        { codeResult, analysisResult, designResult, workspacePath: this.workspaceManager?.getWorkspaceRoot() }
      ),
      // 审查任务
      this.executeAgentTask(
        reviewAgent,
        `请审查代码：

任务：${instruction}

代码实现：
${codeResult}

${actualFilesContent ? `\n\n## 实际项目文件内容:\n${actualFilesContent}` : ''}

工作区路径：${this.workspaceManager?.getWorkspaceRoot() || '未指定'}

请提供：
1. 代码质量评估
2. 问题与风险
3. 改进建议
4. 优化方案（如有）`,
        { codeResult, validation, workspacePath: this.workspaceManager?.getWorkspaceRoot() }
      )
    ])
    
    // 更新智能体状态
    testAgent.status = 'completed'
    testAgent.lastOutput = testResult
    reviewAgent.status = 'completed'
    reviewAgent.lastOutput = reviewResult
    
    // 发送测试结果消息
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
    
    // 发送审查结果消息
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
    
    testPhase.completed = true
    
    reviewPhase.completed = true
    
    // 保存审查结果
    this.savePhaseState('review', reviewResult)
    
    // 用户协作确认 - 最终审查
    try {
      const finalConfirm = await collaborationManager.requestCollaboration(
        `task_${Date.now()}`,
        CollaborationPhase.REVIEW,
        '审查完成',
        '测试和审查已完成，请确认是否接受当前结果',
        { testResult, reviewResult },
        ['接受结果', '需要修改', '重新生成']
      )
      
      if (finalConfirm.status === 'rejected') {
        onAgentMessage({
          agentId: reviewAgent.id,
          agentName: reviewAgent.name,
          role: reviewAgent.role,
          content: `📝 用户反馈：${(finalConfirm as any).userFeedback || ''}\n\n请根据反馈进行调整。`,
          timestamp: Date.now(),
          phase: '最终审查',
          messageType: 'question'
        })
        
        if (this.checkPaused()) {
          return { success: false, result: null, summary: '', error: '用户暂停任务' }
        }
      }
    } catch (error) {
      console.warn('[MultiAgentCoordinator] 最终确认跳过:', error)
    }

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
    
    // 发送智能体状态更新事件
    this.emit('stream', {
      type: 'agent_status',
      agentId: pmAgent.id,
      agentName: pmAgent.name,
      agentType: pmAgent.type,
      status: pmAgent.status,
      model: pmAgent.model,
      phase: this.currentPhase
    })
    
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
    
    // 更新项目状态
    if (projectPath && createdFiles.length > 0) {
      try {
        const projectName = path.basename(projectPath)
        const files = await this.workspaceManager?.listFiles(projectName, true) || []
        const projectFiles = files.map(f => ({
          path: path.join(projectPath, f.path),
          size: f.size,
          type: f.isDirectory ? 'directory' as const : 'file' as const,
          lastModified: Date.now()
        }))
        
        smartButlerAgent.updateProjectFiles(projectId, projectFiles)
        smartButlerAgent.updateProjectStatus(projectId, 'created')
        
        // 生成项目报告
        const projectReport = smartButlerAgent.generateProjectReport(projectId)
        
        // 发送项目报告消息
        const reportMsg: AgentMessage = {
          agentId: 'butler',
          agentName: '智能管家',
          role: '智能管家',
          content: `📋 项目报告\n\n${projectReport}`,
          timestamp: Date.now(),
          phase: '项目完成',
          messageType: 'system',
          priority: 'high'
        }
        this.collaborationHistory.push(reportMsg)
        onAgentMessage(reportMsg)
      } catch (error) {
        console.error('[MultiAgentCoordinator] 更新项目信息失败:', error)
        smartButlerAgent.updateProjectStatus(projectId, 'failed')
      }
    } else {
      console.warn('[MultiAgentCoordinator] 项目创建失败，跳过项目信息更新')
      smartButlerAgent.updateProjectStatus(projectId, 'failed')
    }

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
        content: `你是${agent.name}（${agent.role}）。

## 你的专业水平
- 专业领域：${agent.type}
- 经验等级：专家
- 处理经验：丰富
- 成功率：95%

## 你的职责是：

${this.getRoleDescription(agent.type)}

## 专业知识参考
${this.getExpertKnowledge(agent.type)}

请用专业的方式完成你的工作，并基于你的专业知识提供高质量的结果。`
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
      let fullContent = ''
      
      // 使用流式响应
      const response = await llmService.chatStream(agent.model, messages, {
        temperature: 0.7,
        max_tokens: 8000
      }, (chunk) => {
        // 发送流式数据到前端
        this.emit('stream', {
          agentId: agent.id,
          agentName: agent.name,
          agentType: agent.type,
          delta: chunk.delta,
          done: chunk.done,
          phase: this.currentPhase
        })
        
        if (!chunk.done) {
          fullContent += chunk.delta
        }
      })

      if (response.success && response.content) {
        // 验证产出物质量
        const validationResult = this.validateAgentOutput(agent.type, response.content)
        
        if (!validationResult.isValid) {
          console.warn(`[MultiAgentCoordinator] ${agent.name} 产出验证失败: ${validationResult.reason}`)
          
          // 如果验证失败，尝试让智能体重新生成
          const retryPrompt = `${instruction}

⚠️ 上一次输出不符合要求：${validationResult.reason}

请重新输出符合要求的格式。`
          
          const retryResponse = await llmService.chat(agent.model, [
            ...messages.slice(0, -1),
            { role: 'user', content: retryPrompt }
          ], { temperature: 0.7, max_tokens: 8000 })
          
          if (retryResponse.success && retryResponse.content) {
            const retryValidation = this.validateAgentOutput(agent.type, retryResponse.content)
            if (retryValidation.isValid) {
              response.content = retryResponse.content
            }
          }
        }
        
        return response.content
      } else {
        throw new Error(response.error || '执行失败')
      }
    } catch (error: any) {
      console.error(`智能体 ${agent.name} 执行失败:`, error)
      
      // 注册问题到智能管家
      await smartButlerAgent.registerProblem(
        error,
        agent.id,
        this.currentPhase,
        context
      )
      
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
- 遵循最佳实践

## 输出格式要求

### 代码块
必须使用Markdown代码块格式，例如：
\`\`\`typescript
// 你的代码
function example() {
  return "Hello";
}
\`\`\`

### 待办事项
使用Markdown待办列表格式：
- [ ] 待完成的任务1
- [x] 已完成的任务2

### 文件引用
使用完整路径引用文件：
\`/Users/xxx/project/src/App.tsx\`

⚠️ 重要约束：
- 禁止使用任何文件检查/读取工具（如check_file, glob_paths, list_files等）
- 必须直接根据任务描述编写代码
- 输出必须是完整的、可运行的代码文件列表（JSON格式）`,

      test_generator: `你是测试工程师，负责：
- 理解代码功能
- 编写全面的测试用例
- 确保测试覆盖率
- 提供测试报告

## 输出格式要求

### 测试代码
必须使用Markdown代码块：
\`\`\`typescript
describe('功能测试', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
\`\`\`

### 测试报告
使用表格形式：
| 测试项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| 功能测试 | 通过 | 通过 | ✅ |

⚠️ 重要约束：
- 禁止使用任何文件检查工具
- 必须基于代码功能编写测试用例`,

      code_reviewer: `你是代码审查员，负责：
- 审查代码质量
- 发现潜在问题
- 提供改进建议
- 确保代码安全性和性能

## 输出格式要求

### 问题列表
使用Markdown表格：
| 严重程度 | 位置 | 问题描述 | 建议修复 |
|----------|------|----------|----------|
| 🔴 严重 | src/app.ts | 内存泄漏 | 清理定时器 |
| 🟡 警告 | src/utils.ts | 未使用变量 | 删除代码 |

### 代码片段
\`\`\`typescript
// 问题代码示例
\`\`\`

⚠️ 建议使用列表和表格清晰展示审查结果`,

      document_generator: `你是项目经理，负责：
- 分析需求
- 规划项目方案
- 协调各智能体工作
- 总结项目成果

## 输出格式要求

### 需求文档
必须使用Markdown格式，包含：
- # 标题
- ## 二级标题
- - 列表项
- **加粗**强调

### 待办事项
使用标准Markdown待办列表：
- [ ] 任务1
- [x] 任务2

### 里程碑
使用表格或时间线：
| 阶段 | 目标 | 预期时间 |
|------|------|----------|
| 需求分析 | 完成需求文档 | 30分钟 |

### 文件输出
列出生成的文件路径：
- \`/path/to/PM需求分析.md\`
- \`/path/to/项目计划.md\`

⚠️ 重要约束：
- 禁止使用任何文件检查/读取工具（如check_file, glob_paths, list_files等）
- 禁止查看项目目录结构
- 必须直接基于用户提供的任务描述进行需求分析
- 必须输出完整的Markdown格式需求文档
- 你的职责是分析"用户想要什么"，而不是查看"现在有什么"`,

      ui_designer: `你是UI设计师/前端工程师，负责：
- 设计用户界面
- 实现前端页面
- 优化用户体验
- 确保响应式设计

## 输出格式要求

### UI规范
使用Markdown和代码块：
\`\`\`json
{
  "components": [
    {"name": "Button", "props": {...}}
  ]
}
\`\`\`

### 布局说明
使用列表和表格：
- 组件列表：
  | 组件名 | 用途 | 路径 |
  |--------|------|------|
  | Header | 顶部导航 | components/Header.tsx |

### 样式参考
\`\`\`css
.container {
  display: flex;
}
\`\`\`

⚠️ 重要约束：
- 禁止使用任何文件检查/读取工具（如check_file, glob_paths, list_files等）
- 禁止查看项目目录结构
- 必须直接基于需求分析结果进行界面设计
- 必须输出完整的UI设计方案（JSON格式）`
    }
    return descriptions[type]
  }

  // 验证智能体产出物质量
  private validateAgentOutput(agentType: AgentType, content: string): { isValid: boolean; reason?: string } {
    // 检查内容是否为空
    if (!content || content.trim().length === 0) {
      return { isValid: false, reason: '输出内容为空' }
    }

    // 检查内容长度
    if (content.trim().length < 50) {
      return { isValid: false, reason: '输出内容过短，不符合专业标准' }
    }

    // 检查是否包含文件检查相关关键词（说明智能体没有专注于任务）
    const fileCheckPatterns = [
      /check_file|glob_paths|list_files|查看目录|文件列表|目录结构/i,
      /没有找到|不存在|无法访问/i
    ]

    for (const pattern of fileCheckPatterns) {
      if (pattern.test(content)) {
        return { isValid: false, reason: '检测到文件检查行为，应直接完成任务而不是检查文件' }
      }
    }

    // 根据智能体类型进行特定验证
    switch (agentType) {
      case 'document_generator':
        // PM应该输出Markdown格式的需求文档
        if (!content.includes('#') && !content.includes('需求') && !content.includes('功能')) {
          return { isValid: false, reason: 'PM输出应包含需求分析文档格式' }
        }
        break

      case 'ui_designer':
        // UI应该输出JSON格式或包含组件设计
        if (!content.includes('{') && !content.includes('组件') && !content.includes('页面')) {
          return { isValid: false, reason: 'UI输出应包含组件或页面设计' }
        }
        break

      case 'code_generator':
        // 开发应该输出代码文件结构
        if (!content.includes('"path"') && !content.includes('"content"') && !content.includes('files')) {
          return { isValid: false, reason: '开发输出应包含代码文件结构(JSON格式)' }
        }
        break
    }

    return { isValid: true }
  }

  // 获取专业知识
  private getExpertKnowledge(type: AgentType): string {
    const knowledge: Record<AgentType, string> = {
      code_generator: `## 开发专业知识

### 核心概念
- 代码复用：编写可重用的代码组件和函数
- 设计模式：解决常见软件设计问题的可重用方案
- 代码审查：同行评审代码以提高质量
- 重构：改进代码结构而不改变功能

### 最佳实践
- DRY原则（Don't Repeat Yourself）：避免代码重复
- SOLID原则：面向对象设计的五个基本原则
- 测试驱动开发（TDD）：先写测试，再写代码
- 持续集成：频繁集成代码并运行测试

### 常用工具
- TypeScript：类型安全的JavaScript
- ESLint：代码检查和格式化
- Git：版本控制
- CI/CD：持续集成和部署

### 关键指标
- 代码覆盖率：测试覆盖的代码比例（目标 > 70%）
- 代码复杂度：圈复杂度（目标 < 10）
- 技术债务：需要重构的代码量`,

      test_generator: `## 测试专业知识

### 核心概念
- 单元测试：测试单个函数或组件
- 集成测试：测试多个组件或模块的集成
- 端到端测试（E2E）：测试完整的用户流程
- 测试金字塔：大量单元测试，适量集成测试，少量E2E测试

### 最佳实践
- AAA模式：Arrange-Act-Assert测试结构
- 测试独立性：每个测试应该独立运行
- 测试覆盖率：确保代码被充分测试
- 自动化测试：使用自动化测试工具

### 常用工具
- Jest：JavaScript/TypeScript测试框架
- Cypress：端到端测试框架
- Playwright：现代E2E测试框架
- Testing Library：React组件测试库

### 关键指标
- 测试通过率：测试通过的比例（目标 > 95%）
- 测试执行时间：测试套件执行时间（目标 < 60秒）
- 缺陷密度：每千行代码的缺陷数`,

      code_reviewer: `## 代码审查专业知识

### 审查重点
- 代码质量：代码是否清晰、可读、可维护
- 性能：是否存在性能瓶颈
- 安全性：是否存在安全漏洞
- 最佳实践：是否遵循行业最佳实践

### 常见问题
- 代码重复：违反DRY原则
- 过度复杂：圈复杂度过高
- 缺乏测试：测试覆盖率不足
- 安全漏洞：SQL注入、XSS等

### 审查工具
- ESLint：代码风格检查
- Prettier：代码格式化
- SonarQube：代码质量分析
- Snyk：安全漏洞扫描

### 审查标准
- 代码可读性：命名清晰，逻辑易懂
- 代码可维护性：易于修改和扩展
- 代码性能：无明显的性能问题
- 代码安全性：无安全漏洞`,

      document_generator: `## 项目管理专业知识

### 核心概念
- MVP（Minimum Viable Product）：最小可行产品
- 用户故事：从用户角度描述功能需求
- 产品路线图：展示产品功能和时间规划
- 敏捷开发：迭代和增量的开发方式

### 最佳实践
- 以用户为中心：始终从用户需求出发
- 快速迭代：快速交付并收集反馈
- 数据驱动：基于数据做决策
- 持续改进：不断优化流程和产品

### 常用工具
- Jira：项目管理和问题跟踪
- Notion：文档和知识管理
- Miro：协作白板
- Linear：现代项目管理工具

### 关键指标
- 用户留存率：用户继续使用产品的比例
- NPS（净推荐值）：用户推荐意愿
- DAU/MAU：日活/月活用户比
- 转化率：用户完成目标动作的比例`,

      ui_designer: `## UI/UX设计专业知识

### 核心概念
- 响应式设计：适应不同屏幕尺寸的设计
- 可访问性：确保所有用户都能使用产品
- 设计系统：可重用的设计组件和指南
- 组件化：将UI分解为可重用的组件

### 最佳实践
- 一致性原则：在整个产品中保持视觉和交互一致
- 移动优先：先设计移动端，再扩展到桌面端
- 性能优化：优化加载时间和交互响应
- 可访问性：支持键盘导航和屏幕阅读器

### 常用工具
- React：前端框架
- Vue：渐进式前端框架
- Tailwind CSS：实用类CSS框架
- Figma：UI设计工具

### 关键指标
- 页面加载时间：页面完全加载所需时间（目标 < 2秒）
- FCP（首次内容绘制）：首次绘制内容的时间（目标 < 1.8秒）
- LCP（最大内容绘制）：最大内容绘制的时间（目标 < 2.5秒）
- CLS（累积布局偏移）：布局稳定性（目标 < 0.1）`
    }
    return knowledge[type]
  }

  // 提取项目名称
  private extractProjectName(instruction: string): string {
    const patterns = [
      /(?:创建|开发|设计|实现|构建)\s*(?:一个|一个\s*简易|一个\s*简单)?\s*([^\s，。！？]+)/,
      /(?:create|develop|design|implement|build)\s*(?:a\s*)?(\w+)/i
    ]
    
    for (const pattern of patterns) {
      const match = instruction.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }
    
    return '未命名项目'
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
  getPhases(): CoordinatorPhase[] {
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

  // 确定项目类型
  private determineProjectType(instruction: string): string {
    const lower = instruction.toLowerCase()

    if (lower.includes('react') || lower.includes('前端') || lower.includes('ui') || lower.includes('网页')) {
      return 'react'
    }
    if (lower.includes('vue')) {
      return 'vue'
    }
    if (lower.includes('node') || lower.includes('后端') || lower.includes('api') || lower.includes('服务器')) {
      return 'node'
    }
    if (lower.includes('electron') || lower.includes('桌面') || lower.includes('app') || lower.includes('应用')) {
      return 'electron'
    }
    if (lower.includes('html') || lower.includes('网页')) {
      return 'html'
    }

    return 'vanilla'
  }

  // 获取必需文件列表
  private getRequiredFiles(projectType: string): string[] {
    const files: Record<string, string[]> = {
      'react': [
        'src/index.tsx',
        'src/App.tsx',
        'src/index.css',
        'index.html',
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'public'
      ],
      'node': [
        'index.js',
        'package.json'
      ],
      'html': [
        'index.html',
        'style.css'
      ],
      'vue': [
        'src/main.ts',
        'src/App.vue',
        'src/components',
        'index.html',
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'public'
      ],
      'electron': [
        // 核心配置文件
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'forge.config.js',
        // 源代码
        'src/main/index.ts',
        'src/preload/index.ts',
        'src/renderer/index.html',
        'src/renderer/main.tsx',
        'src/renderer/App.tsx',
        // Webpack 配置（Electron Forge 需要）
        'webpack.main.config.ts',
        'webpack.renderer.config.ts',
        'webpack.rules.ts',
        'webpack.plugins.ts',
        // 其他
        'public',
        '.gitignore',
        'README.md'
      ],
      'electron-vite': [
        // 核心配置文件
        'package.json',
        'tsconfig.json',
        'electron.vite.config.ts',
        'electron-builder.json5',
        // 源代码
        'src/main/index.ts',
        'src/preload/index.ts',
        'src/renderer/index.html',
        'src/renderer/src/main.tsx',
        'src/renderer/src/App.tsx',
        // 其他
        'resources',
        '.gitignore',
        'README.md'
      ],
      'vanilla': [
        'index.html',
        'style.css'
      ]
    }

    return files[projectType] || files['vanilla']
  }

  // 验证项目完整性
  private validateProject(projectPath: string, projectType: string): { isValid: boolean; missingFiles: string[]; errors: string[] } {
    const validation = {
      isValid: true,
      missingFiles: [] as string[],
      errors: [] as string[]
    }

    const requiredFiles = this.getRequiredFiles(projectType)

    for (const file of requiredFiles) {
      const filePath = path.join(projectPath, file)
      if (!fs.existsSync(filePath)) {
        validation.isValid = false
        validation.missingFiles.push(file)
      }
    }

    // 验证package.json
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        if (!packageJson.name || !packageJson.version) {
          validation.isValid = false
          validation.errors.push('package.json缺少name或version字段')
        }
      } catch (error) {
        validation.isValid = false
        validation.errors.push('package.json格式错误')
      }
    } else {
      validation.isValid = false
      validation.missingFiles.push('package.json')
    }

    return validation
  }

  // JSON解析重试
  private async parseCodeResultWithRetry(codeResult: string, maxRetries: number = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 尝试提取JSON（可能包含在Markdown代码块中）
        let jsonStr = codeResult.trim()
        
        // 移除Markdown代码块标记
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.substring(7)
        }
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.substring(3)
        }
        if (jsonStr.endsWith('```')) {
          jsonStr = jsonStr.substring(0, jsonStr.length - 3)
        }

        // 解析JSON
        const parsed = JSON.parse(jsonStr)
        console.log(`[MultiAgentCoordinator] JSON解析成功（尝试${attempt}/${maxRetries}）`)
        return parsed
      } catch (error: any) {
        console.warn(`[MultiAgentCoordinator] JSON解析失败（尝试${attempt}/${maxRetries}）:`, error.message)
        
        if (attempt === maxRetries) {
          throw new Error(`JSON解析失败，已尝试${maxRetries}次: ${error.message}`)
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
  
  // ===== 任务状态管理方法 =====
  
  /**
   * 初始化任务状态
   */
  initTask(taskId: string, instruction: string): void {
    this.currentTaskId = taskId
    this.isPaused = false
    const taskName = this.extractProjectName(instruction)
    ;(this.taskStateManager as any).createTask?.(taskId, taskName, instruction)
    console.log(`[MultiAgentCoordinator] 初始化任务: ${taskId}`)
  }
  
  /**
   * 暂停任务
   */
  pauseTask(): { success: boolean; message: string } {
    if (this.isPaused) {
      return { success: false, message: '任务已经处于暂停状态' }
    }
    
    this.isPaused = true
    ;(this.taskStateManager as any).pauseTask?.()
    console.log(`[MultiAgentCoordinator] 任务已暂停: ${this.currentTaskId}`)
    
    return { success: true, message: '任务已暂停，当前进度已保存' }
  }
  
  /**
   * 继续任务
   */
  resumeTask(): { success: boolean; message: string } {
    if (!this.isPaused) {
      return { success: false, message: '任务不在暂停状态' }
    }
    
    if (!this.currentTaskId) {
      return { success: false, message: '没有可恢复的任务' }
    }
    
    // 加载保存的状态
    const savedState = (this.taskStateManager as any).loadTask?.(this.currentTaskId)
    if (!savedState) {
      return { success: false, message: '找不到保存的任务状态' }
    }
    
    this.isPaused = false
    ;(this.taskStateManager as any).resumeTask?.()
    console.log(`[MultiAgentCoordinator] 任务已继续: ${this.currentTaskId}`)
    
    return { 
      success: true, 
      message: `任务已继续，上次停在 "${savedState.currentPhase}" 阶段` 
    }
  }
  
  /**
   * 获取当前任务状态
   */
  getTaskStatus(): { 
    taskId: string | null
    phase: string
    isPaused: boolean
    status: string
  } {
    return {
      taskId: this.currentTaskId,
      phase: this.currentPhase,
      isPaused: this.isPaused,
      status: this.isPaused ? 'paused' : 'running'
    }
  }
  
  /**
   * 保存当前阶段结果
   */
  savePhaseState(phase: string, result: string): void {
    if (this.currentTaskId) {
      ;(this.taskStateManager as any).savePhaseResult?.(phase, result)
    }
  }
  
  /**
   * 获取保存的任务列表
   */
  getSavedTasks(): any[] {
    return this.taskStateManager.getAllTasks()
  }
  
  /**
   * 删除保存的任务
   */
  deleteTask(taskId: string): boolean {
    return Boolean((this.taskStateManager as any).deleteTask?.(taskId))
  }
  
  /**
   * 检查是否已暂停（用于在循环中检查）
   * 如果暂停，会等待恢复而不是直接返回错误
   */
  checkPaused(): boolean {
    // 如果没有暂停，直接返回
    if (!this.isPaused) {
      return false
    }
    
    // 如果已暂停，进入等待循环
    console.log('[MultiAgentCoordinator] 任务已暂停，等待恢复...')
    
    // 等待恢复（每500ms检查一次）
    while (this.isPaused) {
      // 检查是否有恢复标志
      const savedTasks = this.taskStateManager.getAllTasks()
      const currentTask = savedTasks.find(t => t === this.currentTaskId)
      
      if (currentTask) {
        // 任务已恢复
        this.isPaused = false
        console.log('[MultiAgentCoordinator] 任务已恢复，继续执行')
        return false
      }
      
      // 等待500ms再检查
      return true // 仍然暂停
    }
    
    return this.isPaused
  }
  

}

export const multiAgentCoordinator = new MultiAgentCoordinator()
