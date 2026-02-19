import { EventEmitter } from 'events'
import { llmService } from '../services/LLMService'
import { planner, Plan } from './Planner'
import { executor, ExecutionProgressEvent } from './Executor'
import * as path from 'path'
import * as os from 'os'
import { PATHS } from '../config/paths'

// 进度详情
export interface ProgressDetail {
  phase: string
  agent: string
  progress: number  // 0-100
  subTasks: {
    name: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    progress: number
  }[]
  message: string
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
  iteration?: number  // 当前迭代次数
}

// 测试结果
export interface TestResult {
  passed: boolean
  issues: string[]
  severity: 'critical' | 'major' | 'minor'
}

// 迭代轮次记录
export interface IterationRound {
  round: number
  pmAnalysis?: string
  uiOutput?: string
  devOutput?: string
  testResult?: TestResult
  reviewResult?: string
  delivered: boolean
}

export class MultiDialogueCoordinator extends EventEmitter {
  private dialogues: Map<string, DialogueState> = new Map()
  private executionOrder: string[] = []
  private sharedContext: Record<string, any> = {}
  private iterationRounds: IterationRound[] = []
  private currentRound: number = 1
  private maxIterations: number = 3  // 最大迭代次数
  private delivered: boolean = false
  private taskDir: string = ''  // 任务工作目录
  private devPlan: Plan | null = null  // 开发阶段的执行计划
  

  
  // 智能体配置
  private agentConfigs: Map<string, DialogueAgent> = new Map([
    ['pm', {
      id: 'pm',
      name: '项目经理 (PM)',
      role: '需求分析、项目规划、进度管理、质量把控',
      model: 'deepseek-coder',
      systemPrompt: `你是经验丰富的互联网产品经理。你的核心职责是：

1. 分析用户需求，拆解为清晰的用户故事
2. 协调团队工作，确保项目高质量交付
3. **关键：分析测试和审查发现的问题，提出解决方案**
4. **推动新需求的实现，直到质量达标**
5. 只有在测试问题不大时，才能推动成品交付

重要原则：
- 不要轻易交付半成品
- 发现问题要反馈给开发和UI重新处理
- 只有经过迭代修复，确认质量问题减少后，才能最终交付
- 交付时必须确保核心功能可用

重要：你需要为开发工程师创建项目工作目录。项目应该创建在 Desktop 目录下，例如：${PATHS.DESKTOP}/项目名

当你完成分析后，明确告诉用户"需求分析完成"。`
    }],
    ['ui', {
      id: 'ui',
      name: 'UI 设计师',
      role: '界面视觉设计、交互体验优化',
      model: 'deepseek-coder',
      systemPrompt: `你是资深UI/UX设计师。你需要：

1. 根据PM的需求分析，进行界面设计
2. 输出页面结构、组件设计、交互流程
3. 提供视觉风格建议

当收到PM的新需求时（来自测试/审查问题），你需要：
- 分析新需求
- 调整或重新设计UI方案
- 明确告诉用户"UI设计已更新"

完成设计后告诉用户"UI设计完成"。`
    }],
    ['dev', {
      id: 'dev',
      name: '全栈开发工程师',
      role: '代码架构设计、实现与调试',
      model: 'deepseek-coder',
      systemPrompt: `你是全栈开发专家，精通 TypeScript, React, Node.js 和 Electron。

你需要：
1. 先仔细阅读PM的需求分析和UI设计方案
2. 进行代码架构设计
3. 生成详细的实现说明，供Planner生成执行计划

重要：你必须提供详细的技术实现方案，包括：
- 项目结构（目录和文件）
- 每个文件的主要功能
- 依赖项（package.json）
- 核心代码逻辑
- 需要的Shell命令（安装依赖、启动项目等）

项目将创建在: ${PATHS.DESKTOP}/项目名 目录下

当收到PM的新需求时（来自测试/审查问题），你需要：
- 分析需要修复的问题
- 重新实现或修改代码
- 确保修复后不再出现类似问题

完成开发后告诉用户"代码开发完成"。`
    }],
    ['test', {
      id: 'test',
      name: '测试工程师',
      role: '测试用例设计、测试执行、质量评估',
      model: 'deepseek-coder',
      systemPrompt: `你是测试工程师。你需要：

1. 根据PM的需求分析和开发代码，设计测试用例
2. 执行测试，记录发现的问题
3. **明确标记问题的严重程度**（critical/major/minor）
4. 统计通过率

重要输出格式：
{
  "passed": true/false,
  "issues": ["问题1", "问题2"],
  "severity": "critical/major/minor"
}

只有当passed为true且severity为minor或none时，才算测试通过。
如果有问题，明确告诉用户"测试发现问题，需要修复"。`
    }],
    ['review', {
      id: 'review',
      name: '代码审查员',
      role: '代码审查，安全分析，质量评估',
      model: 'deepseek-coder',
      systemPrompt: `你是代码审查专家。你需要：

1. 审查开发工程师的代码
2. 检查代码质量、安全性、性能
3. 提供改进建议
4. **评估是否可以交付**

重要输出：
- 如果有critical或major问题，必须返回需要修复
- 只有minor或无问题，才能通过审查
- 明确告诉用户"代码审查通过"或"需要修复"
`
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
    // 创建任务工作目录
    const desktopPath = path.join(os.homedir(), 'Desktop')
    // 使用安全的目录名：保留中文、字母、数字和短横线
    const safeTaskName = taskName
      .replace(/[^\w\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef_-]/g, '_')  // 保留中文、日文、韩文字符
      .replace(/_+/g, '_')  // 多个下划线合并为一个
      .trim()
      .slice(0, 50)  // 限制长度
    
    // 如果目录名为空，使用默认名称
    const finalTaskName = safeTaskName || `project_${Date.now()}`
    this.taskDir = path.join(desktopPath, finalTaskName)
    
    this.dialogues.clear()
    this.sharedContext = {
      taskName,
      taskDescription,
      startTime: Date.now(),
      initialRequest: taskDescription,
      taskDir: this.taskDir
    }
    this.iterationRounds = []
    this.currentRound = 1
    this.delivered = false
    this.devPlan = null
    
    // 创建所有对话框
    for (const agentId of this.executionOrder) {
      const config = this.agentConfigs.get(agentId)!
      const dialogue: DialogueState = {
        id: `dialogue_${agentId}_${Date.now()}`,
        name: `${config.name} - ${taskName}`,
        agent: config,
        status: 'waiting',
        context: {},
        iteration: 1
      }
      this.dialogues.set(agentId, dialogue)
    }
    
    // 记录第一轮
    this.iterationRounds.push({
      round: 1,
      delivered: false
    })
    
    const dialogues = Array.from(this.dialogues.values())
    console.log(`[MultiDialogue] 初始化项目: ${taskName}, 第${this.currentRound}轮`)
    
    return {
      dialogues,
      initialDialogueId: this.executionOrder[0]
    }
  }

  // 获取所有对话框状态
  getDialogues(): DialogueState[] {
    return Array.from(this.dialogues.values())
  }

  // 获取当前轮次信息
  getCurrentRound(): number {
    return this.currentRound
  }

  // 获取迭代历史
  getIterationHistory(): IterationRound[] {
    return [...this.iterationRounds]
  }

  // 是否已交付
  isDelivered(): boolean {
    return this.delivered
  }

  // 执行完整迭代轮次
  async executeIteration(
    input: string,
    onMessage: (type: string, data: any) => void
  ): Promise<{
    completed: boolean
    delivered: boolean
    currentRound: number
    summary: string
  }> {
    // 如果已经交付，直接返回
    if (this.delivered) {
      return {
        completed: true,
        delivered: true,
        currentRound: this.currentRound,
        summary: '项目已交付'
      }
    }

    let summary = ''

    // ==================== 1. PM分析需求 ====================
    const pmSubTasks: { name: string, status: 'pending' | 'in_progress' | 'completed' | 'failed', progress: number }[] = [
      { name: '理解用户需求', status: 'in_progress', progress: 0 },
      { name: '拆解用户故事', status: 'pending', progress: 0 },
      { name: '制定项目计划', status: 'pending', progress: 0 },
      { name: '分配任务给团队', status: 'pending', progress: 0 }
    ]
    onMessage('progress', { 
      phase: 'pm', 
      round: this.currentRound, 
      progress: 10,
      subTasks: pmSubTasks,
      message: 'PM正在分析需求...'
    })
    
    const pmResult = await this.executeAgent('pm', input)
    this.iterationRounds[this.currentRound - 1].pmAnalysis = pmResult.output
    
    console.log('[MultiDialogue] PM result:', pmResult.success, 'output length:', pmResult.output?.length)
    
    // 发送PM的详细分析结果到前端
    onMessage('agent_message', {
      agentId: 'pm',
      agentName: '项目经理 (PM)',
      role: '需求分析、项目规划',
      content: pmResult.output,
      phase: 'pm_analysis',
      round: this.currentRound
    })
    
    // 更新子任务状态
    pmSubTasks.forEach(t => t.status = 'completed')
    pmSubTasks.forEach(t => t.progress = 100)
    onMessage('progress', { 
      phase: 'pm', 
      round: this.currentRound, 
      progress: 100,
      subTasks: pmSubTasks,
      message: '✅ PM需求分析完成'
    })
    
    if (!pmResult.success) {
      return { completed: false, delivered: false, currentRound: this.currentRound, summary: 'PM分析失败' }
    }

    // ==================== 2. UI设计 ====================
    const uiSubTasks: { name: string, status: 'pending' | 'in_progress' | 'completed' | 'failed', progress: number }[] = [
      { name: '分析PM需求文档', status: 'in_progress', progress: 0 },
      { name: '设计页面结构', status: 'pending', progress: 0 },
      { name: '设计组件架构', status: 'pending', progress: 0 },
      { name: '输出UI设计稿', status: 'pending', progress: 0 }
    ]
    onMessage('progress', { 
      phase: 'ui', 
      round: this.currentRound, 
      progress: 10,
      subTasks: uiSubTasks,
      message: 'UI设计师正在工作中...'
    })
    
    const uiResult = await this.executeAgent('ui', pmResult.output)
    this.iterationRounds[this.currentRound - 1].uiOutput = uiResult.output
    
    // 发送UI的详细设计结果到前端
    onMessage('agent_message', {
      agentId: 'ui',
      agentName: 'UI设计师',
      role: '界面设计、用户体验',
      content: uiResult.output,
      phase: 'ui_design',
      round: this.currentRound
    })
    
    uiSubTasks.forEach(t => t.status = 'completed')
    uiSubTasks.forEach(t => t.progress = 100)
    onMessage('progress', { 
      phase: 'ui', 
      round: this.currentRound, 
      progress: 100,
      subTasks: uiSubTasks,
      message: '✅ UI设计完成'
    })
    
    if (!uiResult.success) {
      return { completed: false, delivered: false, currentRound: this.currentRound, summary: 'UI设计失败' }
    }

    // 3. 开发实现 - 真正调用工具创建项目
    onMessage('progress', { 
      phase: 'dev', 
      agent: 'dev',
      round: this.currentRound,
      progress: 10,
      subTasks: [
        { name: '分析需求和UI设计', status: 'in_progress', progress: 0 },
        { name: '设计代码架构', status: 'pending', progress: 0 },
        { name: '生成执行计划', status: 'pending', progress: 0 },
        { name: '创建项目文件', status: 'pending', progress: 0 },
        { name: '安装依赖并构建', status: 'pending', progress: 0 }
      ],
      message: '开发工程师：分析需求和UI设计 (10%)'
    })
    
    // 3.1 首先让开发智能体分析需求并规划
    const devPlanningResult = await this.executeAgent('dev', uiResult.output)
    if (!devPlanningResult.success) {
      return { completed: false, delivered: false, currentRound: this.currentRound, summary: '开发规划失败' }
    }
    
    // 发送开发工程师的详细方案到前端
    onMessage('agent_message', {
      agentId: 'dev',
      agentName: '全栈开发工程师',
      role: '代码开发、系统架构',
      content: devPlanningResult.output,
      phase: 'dev_planning',
      round: this.currentRound
    })
    
    onMessage('progress', { 
      phase: 'dev', 
      agent: 'dev',
      round: this.currentRound,
      progress: 30,
      subTasks: [
        { name: '分析需求和UI设计', status: 'completed', progress: 100 },
        { name: '设计代码架构', status: 'completed', progress: 100 },
        { name: '生成执行计划', status: 'in_progress', progress: 0 },
        { name: '创建项目文件', status: 'pending', progress: 0 },
        { name: '安装依赖并构建', status: 'pending', progress: 0 }
      ],
      message: '开发工程师：代码架构设计完成，生成执行计划中 (30%)'
    })
    
    // 3.2 使用Planner生成可执行计划
    let planTimeout = false
    console.log('[MultiDialogue] 开始生成执行计划, taskDir:', this.taskDir)
    try {
      // 增加超时时间到5分钟
      const planPromise = planner.createPlan(
        `根据以下需求创建完整的项目实现：\n\n${devPlanningResult.output}`,
        [],
        'deepseek-coder',
        { taskDir: this.taskDir }
      )
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('计划生成超时（5分钟）')), 300000)
      )
      
      this.devPlan = await Promise.race([planPromise, timeoutPromise]) as Plan
      console.log('[MultiDialogue] 计划生成成功, 步骤数:', this.devPlan.steps.length)
      
      onMessage('plan_created', { 
        round: this.currentRound, 
        stepCount: this.devPlan.steps.length,
        reasoning: this.devPlan.reasoning
      })
      
      onMessage('progress', { 
        phase: 'dev', 
        agent: 'dev',
        round: this.currentRound,
        progress: 50,
        subTasks: [
          { name: '分析需求和UI设计', status: 'completed', progress: 100 },
          { name: '设计代码架构', status: 'completed', progress: 100 },
          { name: '生成执行计划', status: 'completed', progress: 100 },
          { name: '创建项目文件', status: 'in_progress', progress: 0 },
          { name: '安装依赖并构建', status: 'pending', progress: 0 }
        ],
        message: `开发工程师：执行计划 (共${this.devPlan.steps.length}个步骤) (50%)`
      })
    } catch (planError: any) {
      console.error('[MultiDialogue] 计划生成失败:', planError)
      if (planError.message.includes('超时')) {
        planTimeout = true
        this.iterationRounds[this.currentRound - 1].devOutput = devPlanningResult.output + '\n\n⚠️ 计划生成超时，但开发分析已完成。系统将继续尝试执行...'
      } else {
        // 如果计划生成失败，使用开发智能体的输出作为结果
        this.iterationRounds[this.currentRound - 1].devOutput = devPlanningResult.output + '\n\n⚠️ 计划生成失败: ' + planError.message
      }
    }
    
// 3.3 使用Executor执行计划
    let devExecutionOutput = devPlanningResult.output
    if (this.devPlan && this.devPlan.steps.length > 0) {
      try {
        // 增加超时时间到10分钟
        const execPromise = executor.executePlan(
          this.devPlan,
          'deepseek-coder',
          { taskDir: this.taskDir },
          (progress: ExecutionProgressEvent) => {
            onMessage('execution_progress', { 
              round: this.currentRound,
              ...progress 
            })
          }
        )
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('执行超时（10分钟）')), 600000)
        )
        
        const executionResult = await Promise.race([execPromise, timeoutPromise]) as any
        
        if (executionResult.success) {
          devExecutionOutput = `✅ 项目创建成功！\n\n开发智能体分析：\n${devPlanningResult.output}\n\n执行结果：\n${Object.entries(executionResult.stepResults).map(([stepId, result]: [string, any]) => {
            return `- ${stepId}: ${result?.success ? '成功' : '失败'}`
          }).join('\n')}`
          onMessage('dev_completed', { round: this.currentRound, success: true })
        } else {
          devExecutionOutput = `⚠️ 项目创建部分完成\n\n开发智能体分析：\n${devPlanningResult.output}\n\n执行错误：\n${executionResult.error}`
          onMessage('dev_completed', { round: this.currentRound, success: false, error: executionResult.error })
        }
      } catch (execError: any) {
        console.error('[MultiDialogue] 执行失败:', execError)
        devExecutionOutput = `⚠️ 项目执行超时或出错\n\n开发智能体分析：\n${devPlanningResult.output}\n\n注意：${execError.message}\n\n项目文件可能已部分创建，请检查工作目录：${this.taskDir}`
        onMessage('dev_completed', { round: this.currentRound, success: false, error: execError.message })
      }
    } else if (planTimeout) {
      // 计划超时但有开发分析，尝试简化执行
      devExecutionOutput = devPlanningResult.output + '\n\n⚠️ 由于计划生成超时，项目可能未完全创建。请检查目录：' + this.taskDir
      onMessage('dev_completed', { round: this.currentRound, success: false, error: '计划生成超时' })
    } else {
      onMessage('dev_completed', { round: this.currentRound, success: true })
    }
    
    this.iterationRounds[this.currentRound - 1].devOutput = devExecutionOutput

    // ==================== 4. 测试 ====================
    onMessage('progress', { 
      phase: 'test', 
      agent: 'test',
      round: this.currentRound,
      progress: 70,
      subTasks: [
        { name: '分析开发代码', status: 'in_progress', progress: 0 },
        { name: '设计测试用例', status: 'pending', progress: 0 },
        { name: '执行测试', status: 'pending', progress: 0 },
        { name: '生成测试报告', status: 'pending', progress: 0 }
      ],
      message: '测试工程师：分析开发代码中 (70%)'
    })
    
    const testResult = await this.executeAgent('test', devExecutionOutput)
    
    // 发送测试工程师的详细测试报告到前端
    onMessage('agent_message', {
      agentId: 'test',
      agentName: '测试工程师',
      role: '测试用例、测试执行',
      content: testResult.output,
      phase: 'testing',
      round: this.currentRound
    })
    
    let testPassed = false
    let testSeverity = 'minor'
    
    if (testResult.success && testResult.parsedOutput) {
      testPassed = testResult.parsedOutput.passed === true
      testSeverity = testResult.parsedOutput.severity || 'minor'
      this.iterationRounds[this.currentRound - 1].testResult = testResult.parsedOutput
    }
    
    onMessage('progress', { 
      phase: 'test', 
      agent: 'test',
      round: this.currentRound,
      progress: 100,
      subTasks: [
        { name: '分析开发代码', status: 'completed', progress: 100 },
        { name: '设计测试用例', status: 'completed', progress: 100 },
        { name: '执行测试', status: 'completed', progress: 100 },
        { name: '生成测试报告', status: 'completed', progress: 100 }
      ],
      message: `测试工程师：测试${testPassed ? '通过' : '未通过'} (100%)`
    })

    // ==================== 5. 代码审查 ====================
    onMessage('progress', { 
      phase: 'review', 
      agent: 'review',
      round: this.currentRound,
      progress: 80,
      subTasks: [
        { name: '审查代码质量', status: 'in_progress', progress: 0 },
        { name: '检查安全性', status: 'pending', progress: 0 },
        { name: '性能分析', status: 'pending', progress: 0 },
        { name: '输出审查意见', status: 'pending', progress: 0 }
      ],
      message: '代码审查员：审查代码质量中 (80%)'
    })
    
    const reviewResult = await this.executeAgent('review', devExecutionOutput)
    
    // 发送代码审查员的详细审查报告到前端
    onMessage('agent_message', {
      agentId: 'review',
      agentName: '代码审查员',
      role: '代码质量、安全分析',
      content: reviewResult.output,
      phase: 'code_review',
      round: this.currentRound
    })
    
    let reviewPassed = false
    
    if (reviewResult.success) {
      const reviewText = reviewResult.output.toLowerCase()
      reviewPassed = reviewText.includes('通过') || reviewText.includes('pass')
      this.iterationRounds[this.currentRound - 1].reviewResult = reviewResult.output
    }
    
    onMessage('progress', { 
      phase: 'review', 
      agent: 'review',
      round: this.currentRound,
      progress: 100,
      subTasks: [
        { name: '审查代码质量', status: 'completed', progress: 100 },
        { name: '检查安全性', status: 'completed', progress: 100 },
        { name: '性能分析', status: 'completed', progress: 100 },
        { name: '输出审查意见', status: 'completed', progress: 100 }
      ],
      message: `代码审查员：审查${reviewPassed ? '通过' : '未通过'} (100%)`
    })

    // 6. PM判断是否可以交付
    onMessage('progress', { 
      phase: 'pm_delivery', 
      agent: 'pm',
      round: this.currentRound,
      progress: 90,
      subTasks: [
        { name: '评估测试结果', status: 'completed', progress: 100 },
        { name: '评估代码审查', status: 'completed', progress: 100 },
        { name: '做出交付决策', status: 'in_progress', progress: 0 }
      ],
      message: `项目经理：评估测试${testPassed ? '通过' : '未通过'}，审查${reviewPassed ? '通过' : '未通过'}，准备交付决策... (90%)`
    })
    
    const canDeliver = testPassed && reviewPassed && testSeverity === 'minor'
    
    if (canDeliver) {
      // 测试和审查都通过，可以交付
      this.delivered = true
      this.iterationRounds[this.currentRound - 1].delivered = true
      
      summary = `✅ 第${this.currentRound}轮迭代完成，测试通过，审查通过，**项目交付成功**！`
      onMessage('progress', { 
        phase: 'pm_delivery', 
        agent: 'pm',
        round: this.currentRound,
        progress: 100,
        subTasks: [
          { name: '评估测试结果', status: 'completed', progress: 100 },
          { name: '评估代码审查', status: 'completed', progress: 100 },
          { name: '做出交付决策', status: 'completed', progress: 100 }
        ],
        message: `✅ 项目交付成功！ (100%)`
      })
      onMessage('delivered', { round: this.currentRound, summary })
      
      return {
        completed: true,
        delivered: true,
        currentRound: this.currentRound,
        summary
      }
    }

    // 测试或审查有问题，需要迭代
    const issues = []
    if (!testPassed) issues.push('测试未通过')
    if (!reviewPassed) issues.push('代码审查未通过')
    if (testSeverity === 'critical' || testSeverity === 'major') issues.push(`问题严重程度: ${testSeverity}`)
    
    onMessage('progress', { 
      phase: 'pm_delivery', 
      agent: 'pm',
      round: this.currentRound,
      progress: 100,
      subTasks: [
        { name: '评估测试结果', status: 'completed', progress: 100 },
        { name: '评估代码审查', status: 'completed', progress: 100 },
        { name: '做出交付决策', status: 'completed', progress: 100 }
      ],
      message: `⚠️ 发现问题，需要修复：${issues.join('、')} (100%)`
    })
    
    summary = `⚠️ 第${this.currentRound}轮完成，发现问题：${issues.join('、')}。\n\n正在分析问题并提出解决方案...`
    onMessage('iteration_needed', { 
      round: this.currentRound, 
      issues,
      testResult: testResult.parsedOutput,
      reviewResult: reviewResult.output
    })

    // 7. PM分析问题，提出新的需求
    onMessage('progress', { 
      phase: 'pm_analysis', 
      agent: 'pm',
      round: this.currentRound,
      progress: 95,
      subTasks: [
        { name: '分析测试问题', status: 'in_progress', progress: 0 },
        { name: '分析审查问题', status: 'pending', progress: 0 },
        { name: '提出解决方案', status: 'pending', progress: 0 }
      ],
      message: '项目经理：分析问题并提出解决方案...'
    })
    
    const pmAnalysisResult = await this.analyzeIssuesAndProposeSolutions(
      testResult.parsedOutput,
      reviewResult.output
    )
    
    this.iterationRounds[this.currentRound - 1].pmAnalysis = pmAnalysisResult
    
    onMessage('progress', { 
      phase: 'pm_analysis', 
      agent: 'pm',
      round: this.currentRound,
      progress: 100,
      subTasks: [
        { name: '分析测试问题', status: 'completed', progress: 100 },
        { name: '分析审查问题', status: 'completed', progress: 100 },
        { name: '提出解决方案', status: 'completed', progress: 100 }
      ],
      message: '项目经理：问题分析完成，准备进入下一轮迭代'
    })
    
    // 检查是否达到最大迭代次数
    if (this.currentRound >= this.maxIterations) {
      this.delivered = true  // 达到最大次数，强制交付
      summary = `⚠️ 已达到最大迭代次数(${this.currentRound}轮)，尽管仍有问题，但强制交付。\n\n问题详情：${issues.join('、')}`
      onMessage('max_iterations', { round: this.currentRound, issues, summary })
      
      return {
        completed: true,
        delivered: true,
        currentRound: this.currentRound,
        summary
      }
    }

    // 8. 开始下一轮迭代
    this.currentRound++
    this.iterationRounds.push({ round: this.currentRound, delivered: false })
    
    summary += `\n\n🔄 开始第${this.currentRound}轮迭代...`
    
    return {
      completed: false,
      delivered: false,
      currentRound: this.currentRound,
      summary
    }
  }

  // 分析问题并提出解决方案
  private async analyzeIssuesAndProposeSolutions(
    testResult: any,
    reviewResult: string
  ): Promise<string> {
    const pmAgent = this.agentConfigs.get('pm')!
    
    const prompt = `你是项目经理。测试和代码审查发现了以下问题，请分析并提出解决方案：

## 测试结果
${JSON.stringify(testResult, null, 2)}

## 代码审查结果
${reviewResult}

请分析这些问题，提出具体的解决方案，并描述需要如何修改UI和开发代码。
`
    try {
      const response = await llmService.chat(pmAgent.model, [
        { role: 'system', content: pmAgent.systemPrompt },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.7,
        max_tokens: 4000
      })
      
      return response.content || '无法分析问题'
    } catch (error) {
      return `分析失败: ${error}`
    }
  }

  // 执行单个智能体
  private async executeAgent(
    agentId: string,
    input: string
  ): Promise<{
    success: boolean
    output: string
    parsedOutput?: any
  }> {
    const dialogue = this.dialogues.get(agentId)
    if (!dialogue) {
      return { success: false, output: '智能体不存在' }
    }

    dialogue.status = 'working'
    this.emit('agent:start', { agentId, round: this.currentRound })

    try {
      // 构建上下文
      const contextPrompt = this.buildContextPrompt(agentId)
      
      const messages: any[] = [
        { role: 'system', content: dialogue.agent.systemPrompt },
        ...(contextPrompt ? [{ role: 'system', content: contextPrompt }] : []),
        { role: 'user', content: input }
      ]
      
      const response = await llmService.chat(dialogue.agent.model, messages, {
        temperature: 0.7,
        max_tokens: 8000
      })

      console.log('[MultiDialogue] executeAgent', agentId, 'response success:', response.success, 'content length:', response.content?.length)

      if (!response.success || !response.content) {
        throw new Error(response.error || '调用失败')
      }

      dialogue.lastOutput = response.content
      dialogue.status = 'completed'
      
      // 尝试解析测试结果
      let parsedOutput: any = undefined
      if (agentId === 'test') {
        try {
          // 尝试提取JSON
          const jsonMatch = response.content.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            parsedOutput = JSON.parse(jsonMatch[0])
          }
        } catch (e) {}
      }

      this.emit('agent:complete', { agentId, output: response.content })

      return {
        success: true,
        output: response.content,
        parsedOutput
      }

    } catch (error: any) {
      dialogue.status = 'failed'
      this.emit('agent:error', { agentId, error: error.message })
      
      return {
        success: false,
        output: error.message
      }
    }
  }

  // 构建上下文提示
  private buildContextPrompt(agentId: string): string {
    let context = '\n\n=== 项目背景 ===\n'
    context += `任务: ${this.sharedContext.taskName}\n`
    context += `初始需求: ${this.sharedContext.initialRequest}\n`
    context += `当前轮次: 第${this.currentRound}轮（共${this.maxIterations}轮）\n`
    
    // 添加前序智能体的输出
    const agentOrder = ['pm', 'ui', 'dev', 'test', 'review']
    const currentIdx = agentOrder.indexOf(agentId)
    
    if (currentIdx > 0) {
      context += '\n=== 本轮前序工作成果 ===\n'
      const round = this.currentRound - 1
      const prevRound = this.iterationRounds[round >= 0 ? round : 0]
      
      if (prevRound) {
        if (prevRound.uiOutput && agentId !== 'pm') {
          context += `\n【UI设计】:\n${prevRound.uiOutput.slice(0, 1500)}\n`
        }
        if (prevRound.devOutput && agentId !== 'pm' && agentId !== 'ui') {
          context += `\n【开发实现】:\n${prevRound.devOutput.slice(0, 1500)}\n`
        }
        if (prevRound.testResult && agentId !== 'pm' && agentId !== 'ui' && agentId !== 'dev') {
          context += `\n【测试结果】:\n${JSON.stringify(prevRound.testResult, null, 2)}\n`
        }
      }
    }
    
    // 如果是迭代轮次，添加之前轮次的问题分析
    if (this.currentRound > 1) {
      context += '\n=== 之前轮次发现的问题 ===\n'
      for (let i = 0; i < this.currentRound - 1; i++) {
        const round = this.iterationRounds[i]
        if (round.pmAnalysis) {
          context += `\n第${i+1}轮问题分析:\n${round.pmAnalysis.slice(0, 1000)}\n`
        }
      }
    }
    
    return context
  }

  // 重置协调器
  reset() {
    this.dialogues.clear()
    this.currentRound = 1
    this.iterationRounds = []
    this.delivered = false
    this.sharedContext = {}
  }
}

export const multiDialogueCoordinator = new MultiDialogueCoordinator()
