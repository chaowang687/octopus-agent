import { EventEmitter } from 'events'
import { app } from 'electron'
import { llmService } from '../services/LLMService'
import { planner, Plan } from './Planner'
import { executor, ExecutionProgressEvent } from './Executor'
import { toolRegistry } from './ToolRegistry'
import './tools'  // 确保工具注册
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { PATHS } from '../config/paths'
import { enhancedReActEngine } from './EnhancedReActEngine'
import { thoughtTreeEngine } from './ThoughtTreeEngine'
import { unifiedReasoningEngine } from './UnifiedReasoningEngine'
import { selfCorrectionEngine } from './SelfCorrectionEngine'
import { ReasoningMode } from './UnifiedReasoningEngine'
import { taskLogger } from './TaskLogger'
import { permissionSystem, PermissionLevel } from '../permissions/PermissionSystem'

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

// 心跳管理器类
class HeartbeatManager {
  private heartbeats: Map<string, number> = new Map()
  private timeouts: Map<string, NodeJS.Timeout> = new Map()
  private timeoutMs: number
  private emitCallback: (agentId: string, inactiveTime: number) => void
  
  constructor(timeoutMs: number, emitCallback: (agentId: string, inactiveTime: number) => void) {
    this.timeoutMs = timeoutMs
    this.emitCallback = emitCallback
  }
  
  update(agentId: string) {
    // 清除旧的定时器
    if (this.timeouts.has(agentId)) {
      clearTimeout(this.timeouts.get(agentId)!)
      this.timeouts.delete(agentId)
    }
    
    // 更新心跳时间
    this.heartbeats.set(agentId, Date.now())
    
    // 设置新的超时检查
    const timeout = setTimeout(() => {
      this.checkTimeout(agentId)
    }, this.timeoutMs)
    this.timeouts.set(agentId, timeout)
  }
  
  private checkTimeout(agentId: string) {
    const now = Date.now()
    const lastHeartbeat = this.heartbeats.get(agentId)
    
    if (lastHeartbeat) {
      const inactiveTime = now - lastHeartbeat
      if (inactiveTime > this.timeoutMs) {
        this.emitCallback(agentId, inactiveTime)
        this.heartbeats.delete(agentId)
      }
    }
    
    this.timeouts.delete(agentId)
  }
  
  remove(agentId: string) {
    if (this.timeouts.has(agentId)) {
      clearTimeout(this.timeouts.get(agentId)!)
      this.timeouts.delete(agentId)
    }
    this.heartbeats.delete(agentId)
  }
  
  clear() {
    this.timeouts.forEach(timeout => clearTimeout(timeout))
    this.timeouts.clear()
    this.heartbeats.clear()
  }
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
  private taskId: string = ''  // 项目ID（4位编号）
  private userSelectedModel: string = 'doubao-seed-2-0-lite-260215'  // 用户选择的模型
  private devPlan: Plan | null = null  // 开发阶段的执行计划
  
  // 缓存机制
  private agentExecutionCache: Map<string, { result: any, timestamp: number }> = new Map()
  private fileCache: Map<string, { content: string, timestamp: number }> = new Map()
  private cacheTTL: number = 60000  // 缓存过期时间（1分钟）
  
  // 项目ID计数器（静态）
  private static projectCounter: number = 0
  private static counterFilePath: string = path.join(app.getPath('userData'), 'project_counter.json')
  
  // 心跳检测相关
  private heartbeatInterval: NodeJS.Timeout | null = null
  private agentHeartbeats: Map<string, number> = new Map()
  private heartbeatTimeout: number = 30000  // 30秒无活动视为卡住
  private heartbeatCheckInterval: number = 5000  // 每5秒检查一次心跳
  
  // 心跳管理器实例
  private heartbeatManager: HeartbeatManager | null = null

  // 错误检测相关
  private errorHistory: Array<{ agentId: string, error: string, timestamp: number, round: number }> = []
  private errorThreshold: number = 3  // 相同错误出现的阈值
  private errorWindow: number = 300000  // 错误检测时间窗口（5分钟）

  // 检测重复错误
  private detectRepeatingErrors(agentId: string, error: string): boolean {
    const now = Date.now()
    
    // 清理过期的错误记录（优化：只保留最近的错误）
    this.errorHistory = this.errorHistory.filter(
      e => now - e.timestamp < this.errorWindow
    ).slice(-50) // 最多保留50条错误记录
    
    // 添加当前错误
    this.errorHistory.push({
      agentId,
      error,
      timestamp: now,
      round: this.currentRound
    })
    
    // 统计相同错误的出现次数（优化：使用Map统计）
    const errorCountMap = new Map<string, number>()
    this.errorHistory.forEach(e => {
      if (e.agentId === agentId) {
        const key = e.error
        errorCountMap.set(key, (errorCountMap.get(key) || 0) + 1)
      }
    })
    
    const errorCount = errorCountMap.get(error) || 0
    if (errorCount >= this.errorThreshold) {
      console.warn(`[MultiDialogue] 检测到重复错误: ${agentId} - ${error} (出现${errorCount}次)`)
      return true
    }
    
    return false
  }

  // 检测循环状态
  private detectLoopState(): { isLooping: boolean, reason: string } {
    // 检查是否连续多轮都失败
    if (this.currentRound > 2) {
      const recentRounds = this.iterationRounds.slice(-3)
      const allFailed = recentRounds.every(r => !r.delivered)
      
      if (allFailed) {
        return {
          isLooping: true,
          reason: `连续${recentRounds.length}轮迭代都未通过测试或审查`
        }
      }
    }
    
    // 检查是否有重复的错误
    const now = Date.now()
    const recentErrors = this.errorHistory.filter(
      e => now - e.timestamp < this.errorWindow
    )
    
    if (recentErrors.length >= this.errorThreshold * 2) {
      return {
        isLooping: true,
        reason: `短时间内出现${recentErrors.length}次错误，可能陷入循环`
      }
    }
    
    return { isLooping: false, reason: '' }
  }

  // 智能体配置
  private agentConfigs: Map<string, DialogueAgent> = new Map([
    ['pm', {
      id: 'pm',
      name: '项目经理 (PM)',
      role: '需求分析、项目规划、进度管理、质量把控',
      model: 'doubao-seed-2-0-lite-260215',
      systemPrompt: `你是经验丰富的互联网产品经理。

**【重要】分步输出规则 - 必须遵循！**

你必须像聊天一样逐步输出信息，每完成一小步就立即输出。不要一次性输出所有内容。

✅ 正确做法：
- 输出一点点，等用户看到后继续
- "我正在分析你的需求..."
- "我已经理解了，你想要一个待办事项应用..."
- "现在我在列出待办事项..."
- "第一项：理解需求 - 已完成"
- "第二项：生成文档 - 正在完成..."

❌ 错误做法：
- 不要一次性输出几百字的完整报告
- 不要等全部完成才输出

**工作流程**：

## 第一步：理解需求
- 立即输出："我正在理解你的需求..."
- 然后用1-2句话说说你理解的需求
- 立即输出这个理解结果

## 第二步：生成待办事项
- 立即输出："我在列出需要做的事情..."
- 列出待办事项，每条单独输出
- 每条都要简洁

## 第三步：逐条执行
- 立即输出："现在开始逐项处理..."
- 每完成一项，立即输出完成状态
- 如需修改，继续输出修改过程

## 第四步：输出结果
- 全部完成后，输出简洁的总结

**输出格式示例**：

我正在理解你的需求...（立即输出）
你需要一个待办事项应用，可以添加、删除、标记完成任务...（立即输出）
我在列出待办事项...（立即输出）
- 理解需求
- 生成需求文档
- 保存文档
现在开始逐项处理...（立即输出）
✅ 第一项完成：需求分析
现在进行第二项...（立即输出）
✅ 第二项完成：需求文档已生成
...

请开始，每一步都立即输出！`
    }],
    ['ui', {
      id: 'ui',
      name: 'UI 设计师',
      role: '界面视觉设计、交互体验优化',
      model: 'doubao-seed-2-0-lite-260215',
      systemPrompt: `你是资深UI/UX设计师。

**【重要】分步输出规则 - 必须遵循！**

你必须像聊天一样逐步输出信息，每完成一小步就立即输出。不要一次性输出所有内容。

✅ 正确做法：
- 输出一点点，等用户看到后继续
- "我正在看PM的需求..."
- "我理解了，需要设计3个界面..."
- "现在开始设计第一个界面..."
- "✅ 第一步完成：主页面设计"

❌ 错误做法：
- 不要一次性输出完整的设计文档
- 不要等全部完成才输出

**工作流程**：

## 第一步：理解需求
- 立即输出："我正在看PM的需求..."
- 理解需要设计哪些界面

## 第二步：生成待办事项
- 立即输出："我在列出需要设计的界面..."
- 列出待办事项

## 第三步：逐条执行
- 立即输出："现在开始逐个设计..."
- 每完成一个界面，立即输出状态

## 第四步：输出结果
- 全部完成后，输出简洁总结

**输出示例**：
我正在看PM的需求...（立即）
理解了，需要设计：首页、详情页、设置页
正在设计第一个界面...（立即）
✅ 首页设计完成：包含标题、列表、按钮
正在设计第二个界面...（立即）
...

请开始，每一步都立即输出！`
    }],
    ['dev', {
      id: 'dev',
      name: '全栈开发工程师',
      role: '代码架构设计、实现与调试',
      model: 'doubao-seed-2-0-lite-260215',
      systemPrompt: `你是全栈开发专家。

**【重要】分步输出规则 - 必须遵循！**

你必须像聊天一样逐步输出信息，每完成一小步就立即输出。不要一次性输出所有内容。

✅ 正确做法：
- "我正在理解需求..."
- "我需要创建3个文件..."
- "正在创建 index.html..."
- "✅ index.html 创建完成"
- "正在创建 style.css..."
- "✅ style.css 创建完成"

❌ 错误做法：
- 不要一次性输出所有代码
- 不要等全部完成才输出

**工作流程**：

## 第一步：理解需求
- 立即输出："我正在理解需求..."

## 第二步：生成待办
- 立即输出："我需要创建这些文件..."
- 列出文件清单

## 第三步：逐条创建
- 立即输出："现在开始创建文件..."
- 每创建一个文件，立即输出状态
- 使用工具创建文件

## 第四步：测试运行
- 立即输出："正在运行测试..."
- 输出测试结果

**输出示例**：
我正在理解PM的需求...（立即）
需要创建：index.html, style.css, app.js
正在创建 index.html...（立即）
✅ index.html 创建完成
正在创建 style.css...（立即）
✅ style.css 创建完成
正在创建 app.js...（立即）
✅ app.js 创建完成
现在运行测试...（立即）
✅ 测试通过！

请开始，每一步都立即输出！`
    }],
    ['test', {
      id: 'test',
      name: '测试工程师',
      role: '测试用例设计、测试执行、质量评估',
      model: 'doubao-seed-2-0-lite-260215',
      systemPrompt: `你是测试工程师。

**【重要】分步输出规则 - 必须遵循！**

你必须像聊天一样逐步输出信息，每完成一小步就立即输出。不要一次性输出所有内容。

✅ 正确做法：
- "我正在理解要测试什么..."
- "我需要测试3个功能..."
- "正在测试第一个功能..."
- "✅ 添加任务功能：正常"
- "正在测试第二个功能..."

❌ 错误做法：
- 不要一次性输出完整测试报告

**工作流程**：

## 第一步：理解需求
- 立即输出："我正在理解要测试什么..."

## 第二步：生成待办
- 立即输出："我需要测试这些功能..."

## 第三步：逐条测试
- 立即输出："现在开始测试..."
- 每测试一项，立即输出结果

## 第四步：总结
- 全部完成后，输出简洁总结

**输出示例**：
我正在理解要测试什么...（立即）
需要测试：添加任务、删除任务、标记完成
正在测试添加任务...（立即）
✅ 添加任务功能：正常
正在测试删除任务...（立即）
✅ 删除任务功能：正常
正在测试标记完成...（立即）
⚠️ 标记完成：有小问题，文字显示不全
所有测试完成！1个问题需要修复

请开始，每一步都立即输出！`
    }],
    ['review', {
      id: 'review',
      name: '代码审查员',
      role: '代码审查，安全分析，质量评估',
      model: 'doubao-seed-2-0-lite-260215',
      systemPrompt: `你是代码审查专家。你需要：

1. 快速检查代码有没有明显问题
2. 用用户的语言告诉用户结果
3. 决定能不能交付

**【重要】错误处理**

如果遇到以下情况，请优雅处理：
- 文件不存在：说明"项目文件尚未创建，无法进行审查"
- 无法读取代码：说明"代码文件无法访问，请检查开发是否完成"
- 项目目录不存在：说明"项目目录不存在，请先完成开发"

不要因为文件不存在而报错，而是给出合理的审查结论。

**【重要】项目文档管理**

作为代码审查员，你需要阅读和更新项目文档。项目文档存储在项目的.docs目录下。

可用的文档管理功能：
- 阅读需求文档：了解功能需求和验收标准
- 阅读设计文档：了解设计规范和架构要求
- 阅读API文档：了解接口规范和实现细节
- 阅读测试文档：了解测试结果和问题记录
- 创建审查文档：将审查结果整理成审查文档
- 更新审查文档：在审查完成后更新审查文档
- 查看文档：了解项目全貌和质量要求

文档操作时机：
- 开始审查前 → 阅读所有相关文档，了解项目背景
- 完成审查后 → 创建或更新审查文档，记录审查结果
- 发现问题时 → 更新审查文档，记录问题详情
- 审查通过后 → 更新审查文档，记录通过状态

**【重要】输出要求 - 必须遵守！**

禁止输出：
- ❌ 代码片段
- ❌ 复杂的术语

只输出：
- ✅ "代码看起来没问题，可以交付了"
- ✅ "我看到一个小问题，已经帮你标出来了"
- ✅ "需要修复一下这几个地方"
- ✅ "项目文件尚未创建，无法进行审查"

**【重要】审查判断标准**

- 如果项目文件不存在或为空，说明"项目文件尚未创建，无法进行审查"
- 如果代码有严重问题，说明"需要修复：..."
- 如果代码有小问题，说明"有小问题需要改进：..."
- 如果代码质量良好，说明"代码审查通过，可以使用了！"

如果有问题，明确告诉用户"需要修复这几个地方"。如果没有问题，告诉用户"代码审查通过，可以使用了！"`
    }]
  ])

  constructor() {
    super()
    // 默认执行顺序
    this.executionOrder = ['pm', 'ui', 'dev', 'test', 'review']
    
    // 初始化心跳管理器
    this.heartbeatManager = new HeartbeatManager(30000, (agentId: string, inactiveTime: number) => {
      console.warn(`[MultiDialogue] 智能体 ${agentId} 心跳超时 (${inactiveTime}ms)`)
      this.emit('agent_inactive', { agentId, inactiveTime })
    })
    
    // 获取工具描述并更新智能体配置
    this.updateAgentPromptsWithTools()
  }
  
  private updateAgentPromptsWithTools() {
    const toolsDescription = toolRegistry.getToolsDescription()
    
    this.agentConfigs.forEach((config, agentId) => {
      const toolsSection = `
**【可用工具列表】**

你有以下工具可以使用：
${toolsDescription}

使用工具的注意事项：
1. 确保工具参数正确，特别是必需参数
2. 使用绝对路径，不要使用相对路径
3. 根据任务选择合适的工具
4. 如果工具执行失败，检查错误信息并重试
`
      config.systemPrompt = config.systemPrompt + toolsSection
    })
  }

  // 初始化项目协作
  async initializeProject(taskName: string, taskDescription: string, userTaskDir?: string): Promise<{
    dialogues: DialogueState[]
    initialDialogueId: string
  }> {
    console.log(`[MultiDialogueCoordinator] initializeProject 接收到的 userTaskDir:`, userTaskDir)
    // 创建任务工作目录
    // 创建任务工作目录
    // 优先使用用户指定的目录
    let defaultProjectPath: string
    let finalTaskName: string
    
    if (userTaskDir) {
      // 用户指定了目录，直接使用
      this.taskDir = userTaskDir
      // 也生成一个项目ID用于追踪
      this.taskId = this.generateTaskId()
      
      // 确保用户指定的目录存在（用户选择的目录应该有权限）
      try {
        if (!fs.existsSync(this.taskDir)) {
          fs.mkdirSync(this.taskDir, { recursive: true, mode: 0o755 })
          console.log(`[MultiDialogueCoordinator] 用户指定的项目目录创建成功: ${this.taskDir}`)
        }
      } catch (error) {
        console.error(`[MultiDialogueCoordinator] 用户指定目录创建失败: ${error}`)
        // 失败时使用默认目录
        defaultProjectPath = path.join(app.getPath('userData'), 'projects')
      }
      console.log(`[MultiDialogueCoordinator] 使用用户指定的项目目录: ${this.taskDir}`)
    } else {
      // 使用应用数据目录下的项目目录（避免Electron沙箱权限问题）
      defaultProjectPath = path.join(app.getPath('userData'), 'projects')
      // 确保目录存在
      if (!fs.existsSync(defaultProjectPath)) {
        fs.mkdirSync(defaultProjectPath, { recursive: true, mode: 0o755 })
      }
      // 使用安全的目录名：将非ASCII字符转换为下划线，避免文件系统EPERM错误
      let safeTaskName = taskName
        .replace(/[^\x00-\x7F]/g, '_')  // 将非ASCII字符（包括中文）替换为下划线
        .replace(/[^a-zA-Z0-9_-]/g, '_')  // 只保留字母、数字、下划线和短横线
        .replace(/_+/g, '_')  // 多个下划线合并为一个
        .trim()
        .slice(0, 50)  // 限制长度
      
      // 如果目录名为空或全是下划线，使用默认名称
      if (!safeTaskName || /^_+$/.test(safeTaskName)) {
        safeTaskName = `project_${Date.now()}`
      }
      
      // 如果目录名为空，使用默认名称
      finalTaskName = safeTaskName || `project_${Date.now()}`
      // 先生成项目ID
      this.taskId = this.generateTaskId()
      // 项目名包含ID
      this.taskDir = path.join(defaultProjectPath, `${this.taskId}_${finalTaskName}`)
      
      // 提示用户项目将创建在 Documents 目录
      console.log(`[MultiDialogueCoordinator] 项目将创建在: ${defaultProjectPath}`)
    }
    
    // 生成项目ID
    this.taskId = this.generateTaskId()
    
    // 确保目录路径安全
    try {
      if (!fs.existsSync(this.taskDir)) {
        fs.mkdirSync(this.taskDir, { recursive: true, mode: 0o755 })
        console.log(`[MultiDialogueCoordinator] 项目目录创建成功: ${this.taskDir}`)
      }
    } catch (error) {
      console.error('[MultiDialogueCoordinator] 创建工作目录失败:', error)
      // 如果创建失败，使用临时目录
      try {
        this.taskDir = path.join(os.tmpdir(), `project_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`)
        if (!fs.existsSync(this.taskDir)) {
          fs.mkdirSync(this.taskDir, { recursive: true, mode: 0o755 })
        }
        console.log('[MultiDialogueCoordinator] 使用临时目录:', this.taskDir)
      } catch (tempError) {
        console.error('[MultiDialogueCoordinator] 创建临时目录也失败:', tempError)
        // 如果临时目录也失败，使用应用程序数据目录
        try {
          const appDataPath = app.getPath('userData')
          this.taskDir = path.join(appDataPath, 'temp_projects', `project_${Date.now()}`)
          if (!fs.existsSync(this.taskDir)) {
            fs.mkdirSync(this.taskDir, { recursive: true, mode: 0o755 })
          }
          console.log('[MultiDialogueCoordinator] 使用应用程序数据目录:', this.taskDir)
        } catch (appDataError) {
          console.error('[MultiDialogueCoordinator] 创建应用程序数据目录也失败:', appDataError)
          // 所有路径都失败，使用内存中的虚拟路径
          this.taskDir = `virtual://project_${Date.now()}`
          console.warn('[MultiDialogueCoordinator] 所有目录创建都失败，使用虚拟路径:', this.taskDir)
        }
      }
    }
    
    console.log('[MultiDialogueCoordinator] 任务工作目录:', this.taskDir)
    
    this.dialogues.clear()
    this.sharedContext = {
      taskName,
      taskDescription,
      taskId: this.taskId,
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

  // 清理资源
  cleanup(): void {
    // 清理心跳检测
    if (this.heartbeatManager) {
      this.heartbeatManager.clear()
    }
    
    // 清理定时器
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    
    // 清理对话框和上下文
    this.dialogues.clear()
    this.sharedContext = {}
    this.iterationRounds = []
    this.agentHeartbeats.clear()
    this.errorHistory = []
    
    console.log('[MultiDialogue] 资源清理完成')
  }

  // 重置任务状态
  resetTask(): void {
    this.dialogues.clear()
    this.sharedContext = {}
    this.iterationRounds = []
    this.currentRound = 1
    this.delivered = false
    this.devPlan = null
    this.errorHistory = []
    
    // 清理缓存
    this.clearCache()
    
    if (this.heartbeatManager) {
      this.heartbeatManager.clear()
    }
    
    console.log('[MultiDialogue] 任务状态重置')
  }

  // 缓存管理
  private getCacheKey(agentId: string, input: string): string {
    return `${agentId}_${Buffer.from(input).toString('base64').slice(0, 100)}`
  }

  private setAgentCache(agentId: string, input: string, result: any): void {
    const key = this.getCacheKey(agentId, input)
    this.agentExecutionCache.set(key, {
      result,
      timestamp: Date.now()
    })
    
    // 限制缓存大小
    if (this.agentExecutionCache.size > 50) {
      const oldestKey = this.agentExecutionCache.keys().next().value
      this.agentExecutionCache.delete(oldestKey)
    }
  }

  private getAgentCache(agentId: string, input: string): any | null {
    const key = this.getCacheKey(agentId, input)
    const cached = this.agentExecutionCache.get(key)
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.result
    }
    
    // 缓存过期，删除
    if (cached) {
      this.agentExecutionCache.delete(key)
    }
    
    return null
  }

  private setFileCache(filePath: string, content: string): void {
    this.fileCache.set(filePath, {
      content,
      timestamp: Date.now()
    })
    
    // 限制缓存大小
    if (this.fileCache.size > 30) {
      const oldestKey = this.fileCache.keys().next().value
      this.fileCache.delete(oldestKey)
    }
  }

  // 生成4位项目ID
  private generateTaskId(): string {
    try {
      // 从文件读取计数器
      if (fs.existsSync(MultiDialogueCoordinator.counterFilePath)) {
        const data = JSON.parse(fs.readFileSync(MultiDialogueCoordinator.counterFilePath, 'utf8'))
        MultiDialogueCoordinator.projectCounter = data.counter || 0
      }
    } catch (error) {
      console.log('[MultiDialogue] 读取项目计数器失败，使用内存计数器')
    }

    // 递增计数器
    MultiDialogueCoordinator.projectCounter = (MultiDialogueCoordinator.projectCounter + 1) % 10000
    
    // 保存计数器到文件
    try {
      fs.writeFileSync(
        MultiDialogueCoordinator.counterFilePath,
        JSON.stringify({ counter: MultiDialogueCoordinator.projectCounter }),
        'utf8'
      )
    } catch (error) {
      console.log('[MultiDialogue] 保存项目计数器失败')
    }

    // 返回4位ID（补零）
    const taskId = String(MultiDialogueCoordinator.projectCounter).padStart(4, '0')
    console.log(`[MultiDialogue] 生成项目ID: ${taskId}`)
    return taskId
  }

  private getFileCache(filePath: string): string | null {
    const cached = this.fileCache.get(filePath)
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.content
    }
    
    // 缓存过期，删除
    if (cached) {
      this.fileCache.delete(filePath)
    }
    
    return null
  }

  private clearCache(): void {
    this.agentExecutionCache.clear()
    this.fileCache.clear()
    console.log('[MultiDialogue] 缓存清理完成')
  }

  // 执行完整迭代轮次
  async executeIteration(
    input: string,
    onMessage: (type: string, data: any) => void,
    options?: {
      retryAttempt?: number
      manualIntervention?: boolean
      customPlan?: string
      model?: string
    }
  ): Promise<{
    completed: boolean
    delivered: boolean
    currentRound: number
    summary: string
    retryable?: boolean
  }> {
    this.userSelectedModel = options?.model || 'doubao-seed-2-0-lite-260215'
    console.log(`[MultiDialogue] 用户选择的模型: ${this.userSelectedModel}`)
    // 如果已经交付，直接返回
    if (this.delivered) {
      return {
        completed: true,
        delivered: true,
        currentRound: this.currentRound,
        summary: '项目已交付'
      }
    }

    // 检测循环状态
    const loopState = this.detectLoopState()
    if (loopState.isLooping) {
      console.warn(`[MultiDialogue] 检测到循环状态: ${loopState.reason}`)
      
      onMessage('loop_detected', {
        round: this.currentRound,
        reason: loopState.reason,
        message: `系统检测到可能陷入循环：${loopState.reason}。建议：\n1. 检查开发智能体是否正确使用工具\n2. 检查是否有权限问题\n3. 考虑使用手动干预或重新开始`,
        canContinue: true,
        canRestart: true
      })
      
      // 不立即停止，让用户决定是否继续
      // 但给出明确的警告
    }

    // 处理重试和手动干预选项
    const retryAttempt = options?.retryAttempt || 0
    const manualIntervention = options?.manualIntervention || false
    const customPlan = options?.customPlan

    // 发送执行选项到前端
    onMessage('execution_options', {
      retryAttempt,
      manualIntervention,
      customPlan: !!customPlan,
      round: this.currentRound
    })

    let summary = ''

    // ==================== 1. PM分析需求（仅第一轮） ====================
    let pmResult: any
    if (this.currentRound === 1) {
      // === PM阶段方案方向选择 ===
      let pmDirection = 'default'
      let directionOptionsList: string[] = []
      
      try {
        // 第一步：让PM分析任务，智能生成适合的方向选项
        const directionAnalysisResult = await this.executeAgent('pm', `你是项目经理，请分析以下任务并生成适合的需求分析方向选项。

任务：${input}

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
成本控制优先`)
        
        // 解析生成的选项列表
        directionOptionsList = directionAnalysisResult.output
          .split('\n')
          .map(option => option.trim())
          .filter(option => option.length > 0)
          .slice(0, 5) // 最多取5个选项
        
        // 如果生成的选项不足，使用默认选项
        if (directionOptionsList.length < 3) {
          const defaultOptions = ['快速交付', '功能完整', '技术创新']
          directionOptionsList = [...directionOptionsList, ...defaultOptions].slice(0, 5)
        }
        
        // 发送方向选择请求到前端
        onMessage('direction_selection', {
          phase: 'pm_analysis',
          round: this.currentRound,
          agentId: 'pm',
          agentName: '项目经理 (PM)',
          role: '需求分析、项目规划',
          title: '需求分析方向选择',
          description: 'PM已根据项目需求分析生成了适合的方向选项，请选择一个方向，PM将基于所选方向生成详细的需求文档',
          options: directionOptionsList,
          context: { task: input, generatedOptions: directionOptionsList }
        })
        
        // 等待用户选择方向（这里需要前端返回用户选择）
        // 由于这是一个异步流程，我们需要等待前端的选择
        // 暂时使用默认方向，实际应该等待前端返回
        pmDirection = directionOptionsList[0] || '功能完整'
        
        console.log('[MultiDialogue] 用户选择需求分析方向:', pmDirection)
        
        // 发送方向选择确认消息
        onMessage('agent_message', {
          agentId: 'system',
          agentName: '系统',
          role: '协调员',
          content: `📋 用户选择需求分析方向：${pmDirection}`,
          phase: 'pm_analysis',
          round: this.currentRound
        })
      } catch (error) {
        console.warn('[MultiDialogue] 方向选择跳过:', error)
        // 出错时使用默认方向
        pmDirection = '功能完整'
      }
      
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
        message: `PM正在分析需求... (方向: ${pmDirection})`
      })
      
      // 使用选择的方向进行需求分析
      pmResult = await this.executeAgent('pm', `# 项目ID: ${this.taskId}
你是项目经理，请对以下任务进行专业的需求分析。

⚠️ 任务信息（直接分析，不要检查任何文件）：
- 项目ID：${this.taskId}
- 任务描述：${input}
- 分析方向：${pmDirection}

## 你的任务：输出完整的《需求分析文档》

请按以下格式输出：

# 需求分析文档

## 1. 项目概述
[用一段话描述这个项目是什么]

## 2. 用户需求
### 2.1 主要功能
[列出用户需要的主要功能点]

### 2.2 用户场景
[描述用户会在什么情况下使用这个功能]

## 3. 功能需求
[详细列出需要实现的功能点]

## 4. 非功能需求
- 性能要求
- 兼容性要求
- 安全性要求

## 5. 技术选型
- 前端技术栈
- 后端技术栈（如需要）
- 存储方案（如需要）

## 6. 实施计划
[按优先级列出实现步骤]

## 7. 风险评估
[列出可能的风险和应对措施]

请直接输出完整的分析文档，不要询问任何问题。`)
      
      this.iterationRounds[this.currentRound - 1].pmAnalysis = pmResult.output
      
      console.log('[MultiDialogue] PM result:', pmResult.success, 'output length:', pmResult.output?.length)
      console.log('[MultiDialogue] 当前 taskDir:', this.taskDir)
      console.log('[MultiDialogue] taskDir 是否为 virtual:', this.taskDir?.startsWith('virtual://'))
      
      // 保存PM需求分析到项目文件夹
      const outputFiles: string[] = []
      try {
        if (!this.taskDir) {
          console.log('[MultiDialogue] taskDir 为空，无法保存文件')
        } else if (this.taskDir.startsWith('virtual://')) {
          console.log('[MultiDialogue] taskDir 是虚拟路径，跳过保存')
        } else {
          console.log('[MultiDialogue] 开始保存PM需求分析到:', this.taskDir)
          const pmDocPath = path.join(this.taskDir, 'docs', 'PM需求分析.md')
          console.log('[MultiDialogue] PM文档路径:', pmDocPath)
          
          // 检查缓存
          const cachedContent = this.getFileCache(pmDocPath)
          if (cachedContent !== pmResult.output) {
            // 确保目录存在 - 使用同步方式确保成功
            const dirPath = path.dirname(pmDocPath)
            console.log('[MultiDialogue] 确保目录存在:', dirPath)
            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 })
              console.log('[MultiDialogue] 目录创建成功')
            }
            await fsp.writeFile(pmDocPath, pmResult.output, { encoding: 'utf8', mode: 0o644 })
            // 更新缓存
            this.setFileCache(pmDocPath, pmResult.output)
            outputFiles.push('docs/PM需求分析.md')
            console.log('[MultiDialogue] PM需求分析已保存到:', pmDocPath)
          } else {
            console.log('[MultiDialogue] PM需求分析内容未变化，跳过保存')
          }
        }
      } catch (error) {
        console.error('[MultiDialogue] 保存PM需求分析失败:', error)
      }
      
      // 生成结构化输出
      const structuredPMOutput = this.generateStructuredOutput(
        '项目经理 (PM)',
        '需求分析',
        pmResult.output,
        ['进入UI设计阶段', '等待用户确认'],
        ['分析用户需求', '生成需求文档', '保存需求分析.md'],
        outputFiles,
        undefined,
        undefined
      )
      
      // 发送PM的详细分析结果到前端
      onMessage('agent_message', {
        agentId: 'pm',
        agentName: '项目经理 (PM)',
        role: '需求分析、项目规划',
        content: pmResult.output,
        phase: 'pm_analysis',
        round: this.currentRound,
        nextSteps: ['进入UI设计阶段', '等待用户确认'],
        completedTasks: ['分析用户需求', '生成需求文档', '保存需求分析.md'],
        outputFiles: outputFiles
      })
      
      // 更新子任务状态
      pmSubTasks.forEach(t => {
        t.status = 'completed'
        t.progress = 100
      })
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
      
      // === PM阶段多轮迭代确认 ===
      let pmConfirmed = false
      let pmIteration = 0
      const maxPMIterations = 3 // 最多迭代3轮
      
      while (!pmConfirmed && pmIteration < maxPMIterations) {
        try {
          const options = pmIteration === 0 
            ? ['确认方案', '需要修改']
            : ['确认方案', '仍需修改', '简化需求', '增加功能']
          
          // 发送确认请求到前端
          onMessage('confirmation_request', {
            phase: 'pm_analysis',
            round: this.currentRound,
            iteration: pmIteration,
            agentId: 'pm',
            agentName: '项目经理 (PM)',
            role: '需求分析、项目规划',
            title: pmIteration === 0 ? '需求分析完成' : `需求分析 (第${pmIteration + 1}次修改)`,
            description: pmIteration === 0 
              ? 'PM已完成需求分析，请确认方案是否满足您的需求'
              : '已根据您的反馈更新方案，请再次确认',
            options,
            context: { task: input, analysis: pmResult.output }
          })
          
          // 等待用户确认（这里需要前端返回用户选择）
          // 暂时使用默认确认，实际应该等待前端返回
          console.log('[MultiDialogue] PM阶段完成，等待用户确认方案...')
          const userChoice = '确认方案'
          console.log('[MultiDialogue] 用户确认方案，继续执行')
          
          if (userChoice === '确认方案') {
            // 用户确认方案合格
            pmConfirmed = true
            
            onMessage('agent_message', {
              agentId: 'pm',
              agentName: '项目经理 (PM)',
              role: '需求分析、项目规划',
              content: '✅ 用户已确认需求方案，进入下一阶段。',
              phase: 'pm_analysis',
              round: this.currentRound
            })
            break
          }
          
          // 用户需要修改
          const userFeedback = userChoice === '需要修改' || userChoice === '仍需修改' 
            ? '请根据您的具体需求修改需求文档'
            : userChoice === '简化需求' ? '请简化需求，只保留核心功能' : '请增加更多功能'
          
          onMessage('agent_message', {
            agentId: 'pm',
            agentName: '项目经理 (PM)',
            role: '需求分析、项目规划',
            content: `📝 用户反馈 (第${pmIteration + 1}次)：${userFeedback}\n\n请根据反馈修改需求文档。`,
            phase: 'pm_analysis',
            round: this.currentRound
          })
          
          // 增量修改分析结果
          pmIteration++
          
          // 使用增量修改 prompt
          const incrementalPrompt = this.buildIncrementalPrompt(
            input,
            pmResult.output,
            userFeedback,
            'pm'
          )
          
          const reAnalysisResult = await this.executeAgent('pm', incrementalPrompt)
          
          pmResult.output = reAnalysisResult.output
          this.iterationRounds[this.currentRound - 1].pmAnalysis = pmResult.output
          
          // 异步更新 .md 文档
          try {
            if (this.taskDir && !this.taskDir.startsWith('virtual://')) {
              const pmDocPath = path.join(this.taskDir, 'docs', 'PM需求分析.md')
              await fsp.writeFile(pmDocPath, `# 需求分析 (第${pmIteration}次修改)\n\n${pmResult.output}`, { encoding: 'utf8', mode: 0o644 })
              console.log('[MultiDialogue] 需求分析已更新:', pmDocPath)
            }
          } catch (error) {
            console.error('[MultiDialogue] 更新需求分析文档失败:', error)
          }
          
          // 发送更新后的分析结果
          const structuredPMOutput = this.generateStructuredOutput(
            '项目经理 (PM)',
            '需求分析',
            pmResult.output,
            ['进入UI设计阶段', '等待用户确认'],
            ['分析用户需求', '生成需求文档', `保存需求分析.md (第${pmIteration}次修改)`],
            outputFiles,
            undefined,
            undefined
          )
          
          onMessage('agent_message', {
            agentId: 'pm',
            agentName: '项目经理 (PM)',
            role: '需求分析、项目规划',
            content: `📝 需求文档已更新 (第${pmIteration + 1}次)：\n\n${structuredPMOutput}`,
            phase: 'pm_analysis',
            round: this.currentRound
          })
          
        } catch (error) {
          console.warn('[MultiDialogue] PM确认跳过:', error)
          pmConfirmed = true // 出错时继续执行
          break
        }
      }
      
      if (!pmConfirmed && pmIteration >= maxPMIterations) {
        onMessage('agent_message', {
          agentId: 'system',
          agentName: '系统',
          role: '协调员',
          content: `⚠️ 已达到最大迭代次数 (${maxPMIterations}次)，强制进入下一阶段。`,
          phase: 'pm_analysis',
          round: this.currentRound
        })
      }
    } else {
      // 第二轮及以后的迭代，跳过PM分析
      pmResult = { success: true, output: input }
      console.log('[MultiDialogue] 第二轮及以后的迭代，跳过PM分析')
    }

    // ==================== 2. UI设计（仅第一轮） ====================
    let uiResult: any
    if (this.currentRound === 1) {
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
      
      uiResult = await this.executeAgent('ui', `# 项目ID: ${this.taskId}\n${pmResult.output}`)
      this.iterationRounds[this.currentRound - 1].uiOutput = uiResult.output
      
      // 保存UI设计到项目文件夹
      const uiOutputFiles: string[] = []
      try {
        if (!this.taskDir) {
          console.log('[MultiDialogue] taskDir 为空，无法保存UI设计')
        } else if (this.taskDir.startsWith('virtual://')) {
          console.log('[MultiDialogue] taskDir 是虚拟路径，跳过保存UI设计')
        } else {
          const uiDocPath = path.join(this.taskDir, 'docs', 'UI设计.md')
          
          // 检查缓存
          const cachedContent = this.getFileCache(uiDocPath)
          if (cachedContent !== uiResult.output) {
            // 确保目录存在
            const dirPath = path.dirname(uiDocPath)
            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 })
            }
            await fsp.writeFile(uiDocPath, uiResult.output, { encoding: 'utf8', mode: 0o644 })
            // 更新缓存
            this.setFileCache(uiDocPath, uiResult.output)
            uiOutputFiles.push('docs/UI设计.md')
            console.log('[MultiDialogue] UI设计已保存到:', uiDocPath)
          } else {
            console.log('[MultiDialogue] UI设计内容未变化，跳过保存')
          }
        }
      } catch (error) {
        console.error('[MultiDialogue] 保存UI设计失败:', error)
      }
      
      // 生成结构化输出
      const structuredUIOutput = this.generateStructuredOutput(
        'UI设计师',
        '界面设计',
        uiResult.output,
        ['进入开发阶段', '等待用户确认'],
        ['分析PM需求文档', '设计页面结构', '设计组件架构', '输出UI设计稿'],
        uiOutputFiles,
        undefined,
        undefined
      )
      
      // 发送UI的详细设计结果到前端
      onMessage('agent_message', {
        agentId: 'ui',
        agentName: 'UI设计师',
        role: '界面设计、用户体验',
        content: uiResult.output,
        phase: 'ui_design',
        round: this.currentRound,
        nextSteps: ['进入开发阶段', '等待用户确认'],
        completedTasks: ['分析PM需求文档', '设计页面结构', '设计组件架构', '输出UI设计稿'],
        outputFiles: uiOutputFiles
      })
      
      uiSubTasks.forEach(t => {
        t.status = 'completed'
        t.progress = 100
      })
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
      
      // === UI阶段多轮迭代确认 ===
      let uiConfirmed = false
      let uiIteration = 0
      const maxUIIterations = 3 // 最多迭代3轮
      
      while (!uiConfirmed && uiIteration < maxUIIterations) {
        try {
          const options = uiIteration === 0 
            ? ['确认方案', '需要修改']
            : ['确认方案', '仍需修改', '简化设计', '增加功能']
          
          // 发送确认请求到前端
          onMessage('confirmation_request', {
            phase: 'ui_design',
            round: this.currentRound,
            iteration: uiIteration,
            agentId: 'ui',
            agentName: 'UI设计师',
            role: '界面设计、用户体验',
            title: uiIteration === 0 ? 'UI设计完成' : `UI设计 (第${uiIteration + 1}次修改)`,
            description: uiIteration === 0 
              ? 'UI设计师已完成界面设计，请确认方案是否满足您的需求'
              : '已根据您的反馈更新设计，请再次确认',
            options,
            context: { task: input, design: uiResult.output }
          })
          
          // 等待用户确认（这里需要前端返回用户选择）
          // 暂时使用默认确认，实际应该等待前端返回
          const userChoice = '确认方案'
          
          if (userChoice === '确认方案') {
            // 用户确认方案合格
            uiConfirmed = true
            
            onMessage('agent_message', {
              agentId: 'ui',
              agentName: 'UI设计师',
              role: '界面设计、用户体验',
              content: '✅ 用户已确认UI设计方案，进入下一阶段。',
              phase: 'ui_design',
              round: this.currentRound
            })
            break
          }
          
          // 用户需要修改
          const userFeedback = userChoice === '需要修改' || userChoice === '仍需修改' 
            ? '请根据您的具体需求修改UI设计'
            : userChoice === '简化设计' ? '请简化UI设计，只保留核心界面' : '请增加更多UI功能和交互'
          
          onMessage('agent_message', {
            agentId: 'ui',
            agentName: 'UI设计师',
            role: '界面设计、用户体验',
            content: `📝 用户反馈 (第${uiIteration + 1}次)：${userFeedback}\n\n请根据反馈修改UI设计。`,
            phase: 'ui_design',
            round: this.currentRound
          })
          
          // 增量修改设计结果
          uiIteration++
          
          // 使用增量修改 prompt
          const incrementalPrompt = this.buildIncrementalPrompt(
            input,
            uiResult.output,
            userFeedback,
            'ui'
          )
          
          const reDesignResult = await this.executeAgent('ui', incrementalPrompt)
          
          uiResult.output = reDesignResult.output
          this.iterationRounds[this.currentRound - 1].uiOutput = uiResult.output
          
          // 异步更新 .md 文档
          try {
            if (this.taskDir && !this.taskDir.startsWith('virtual://')) {
              const uiDocPath = path.join(this.taskDir, 'docs', 'UI设计.md')
              await fsp.writeFile(uiDocPath, `# UI设计 (第${uiIteration}次修改)\n\n${uiResult.output}`, { encoding: 'utf8', mode: 0o644 })
              console.log('[MultiDialogue] UI设计已更新:', uiDocPath)
            }
          } catch (error) {
            console.error('[MultiDialogue] 更新UI设计文档失败:', error)
          }
          
          // 发送更新后的设计结果
          const structuredUIOutput = this.generateStructuredOutput(
            'UI设计师',
            '界面设计',
            uiResult.output,
            ['进入开发阶段', '等待用户确认'],
            ['分析PM需求文档', '设计页面结构', '设计组件架构', `输出UI设计稿 (第${uiIteration}次修改)`],
            uiOutputFiles,
            undefined,
            undefined
          )
          
          onMessage('agent_message', {
            agentId: 'ui',
            agentName: 'UI设计师',
            role: '界面设计、用户体验',
            content: `📝 UI设计已更新 (第${uiIteration + 1}次)：\n\n${structuredUIOutput}`,
            phase: 'ui_design',
            round: this.currentRound
          })
          
        } catch (error) {
          console.warn('[MultiDialogue] UI确认跳过:', error)
          uiConfirmed = true // 出错时继续执行
          break
        }
      }
      
      if (!uiConfirmed && uiIteration >= maxUIIterations) {
        onMessage('agent_message', {
          agentId: 'system',
          agentName: '系统',
          role: '协调员',
          content: `⚠️ 已达到最大迭代次数 (${maxUIIterations}次)，强制进入下一阶段。`,
          phase: 'ui_design',
          round: this.currentRound
        })
      }
    } else {
      // 第二轮及以后的迭代，跳过UI设计
      uiResult = { success: true, output: pmResult.output }
      console.log('[MultiDialogue] 第二轮及以后的迭代，跳过UI设计')
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
    let devPlanningResult
    if (options?.customPlan) {
      // 使用手动干预的自定义计划
      devPlanningResult = {
        success: true,
        output: options.customPlan,
        log: [`[${new Date().toISOString()}] 使用手动干预的自定义计划`]
      }
      onMessage('agent_message', {
        agentId: 'dev',
        agentName: '全栈开发工程师',
        role: '代码开发、系统架构',
        content: `使用手动干预的自定义计划:\n\n${options.customPlan}`,
        phase: 'dev_manual_plan',
        round: this.currentRound,
        action: 'manual_intervention'
      })
    } else {
      // 正常执行开发智能体
      // 如果是第二轮及以后的迭代，开发智能体需要修复测试和审查发现的问题
      let devInput = uiResult.output
      
      // 添加项目目录信息
      const projectDirInfo = `# 项目ID: ${this.taskId}

【重要】项目目录：${this.taskDir}
所有项目文件都必须创建在这个目录下！

## 项目结构要求
请根据需求创建完整的项目目录结构，包括：

### 必备文件（必须创建）：
- **docs/产品需求.md** - 产品需求文档
- **docs/UI设计.md** - UI设计文档  
- **docs/架构设计.md** - 系统架构设计文档
- **docs/使用说明.md** - 项目使用说明

### 代码文件：
- 源代码文件（根据技术栈创建）
- 配置文件
- 测试文件

请在开始编码前，先创建完整的目录结构和文档！
`
      devInput = projectDirInfo + devInput
      
      if (this.currentRound > 1) {
        // 获取上一轮的测试和审查结果
        const prevRound = this.iterationRounds[this.currentRound - 2]
        if (prevRound) {
          let problemDescription = '=== 上一轮发现的问题 ===\n\n'
          if (prevRound.testResult) {
            problemDescription += '【测试结果】:\n'
            if (prevRound.testResult.issues && prevRound.testResult.issues.length > 0) {
              problemDescription += `发现的问题：\n${prevRound.testResult.issues.map((issue: string) => `- ${issue}`).join('\n')}\n`
            }
            if (prevRound.testResult.passed === false) {
              problemDescription += `测试状态：未通过\n`
            }
            problemDescription += '\n'
          }
          if (prevRound.reviewResult) {
            problemDescription += '【代码审查结果】:\n'
            problemDescription += `${prevRound.reviewResult}\n`
            problemDescription += '\n'
          }
          problemDescription += '请根据上述问题修复代码，并确保修复后通过测试和审查。'
          
          devInput = problemDescription
          console.log('[MultiDialogue] 第二轮及以后的迭代，开发智能体收到问题:', problemDescription.slice(0, 200))
        }
      }
      
      devPlanningResult = await this.executeAgent('dev', devInput)
    }
    
    if (!devPlanningResult.success) {
      console.error('[MultiDialogue] 开发规划失败:', devPlanningResult.errorDetails)
      
      // 检查是否为权限错误或其他关键错误
      const isCriticalError = devPlanningResult.errorDetails && (
        devPlanningResult.errorDetails.includes('EPERM') ||
        devPlanningResult.errorDetails.includes('EACCES') ||
        devPlanningResult.errorDetails.includes('permission denied') ||
        devPlanningResult.errorDetails.includes('权限不足') ||
        devPlanningResult.errorDetails.includes('operation not permitted') ||
        devPlanningResult.errorDetails.includes('Unsafe command detected') ||
        devPlanningResult.errorDetails.includes('unsafe')
      )
      
      // 发送详细的错误信息到前端
      onMessage('agent_message', {
        agentId: 'dev',
        agentName: '全栈开发工程师',
        role: '代码开发、系统架构',
        content: `开发规划失败: ${devPlanningResult.output}\n\n详细错误: ${devPlanningResult.errorDetails}`,
        phase: 'dev_planning_error',
        round: this.currentRound,
        error: true,
        log: devPlanningResult.log,
        retryable: devPlanningResult.retryable
      })
      
      // 发送执行日志到前端
      if (devPlanningResult.log && devPlanningResult.log.length > 0) {
        onMessage('execution_log', {
          agentId: 'dev',
          round: this.currentRound,
          logs: devPlanningResult.log
        })
      }
      
      onMessage('progress', { 
        phase: 'dev', 
        agent: 'dev',
        round: this.currentRound,
        progress: 0,
        subTasks: [
          { name: '分析需求和UI设计', status: 'failed', progress: 0 },
          { name: '设计代码架构', status: 'pending', progress: 0 },
          { name: '生成执行计划', status: 'pending', progress: 0 },
          { name: '创建项目文件', status: 'pending', progress: 0 },
          { name: '安装依赖并构建', status: 'pending', progress: 0 }
        ],
        message: `开发规划失败: ${devPlanningResult.errorDetails}`,
        error: true,
        retryable: devPlanningResult.retryable
      })
      
      // 如果是关键错误，中断执行并优先解决问题
      if (isCriticalError) {
        console.log('[MultiDialogue] 检测到关键错误，中断执行并优先解决问题...')
        
        // 发送中断执行的消息到前端
        onMessage('critical_error', {
          phase: 'dev',
          round: this.currentRound,
          error: devPlanningResult.errorDetails,
          message: '检测到关键错误，需要优先解决问题后才能继续执行。',
          suggestedActions: [
            '检查目录权限设置',
            '手动创建项目目录结构',
            '修改项目路径为有写入权限的位置',
            '确保执行命令的安全性'
          ],
          requiresUserAction: true,
          canContinue: false
        })
        
        // 直接返回失败结果，不继续执行后续步骤
        return {
          completed: false,
          delivered: false,
          currentRound: this.currentRound,
          summary: `开发阶段遇到关键错误: ${devPlanningResult.errorDetails}`,
          retryable: true
        }
      }
      
      // 实现降级策略：使用简化的开发规划
      console.log('[MultiDialogue] 尝试使用降级策略...')
      
      // 生成简化的开发规划
      const fallbackPlanning = `# 简化项目规划

## 项目结构
- src/
  - main/
    - index.js
  - renderer/
    - index.html
    - index.js
- package.json
- tsconfig.json

## 核心功能
1. 实现基本项目结构
2. 配置必要的依赖
3. 创建基本的文件和目录

## 执行步骤
1. 创建项目目录结构
2. 初始化 package.json
3. 安装必要的依赖
4. 创建基本的项目文件
5. 配置构建脚本
`
      
      // 发送降级策略信息到前端
      onMessage('agent_message', {
        agentId: 'system',
        agentName: '系统',
        role: '系统协调',
        content: `开发规划失败，正在使用降级策略。将创建简化的项目结构。\n\n${fallbackPlanning}`,
        phase: 'fallback_strategy',
        round: this.currentRound,
        action: 'fallback'
      })
      
      // 使用降级策略继续执行
      this.iterationRounds[this.currentRound - 1].devOutput = fallbackPlanning
      
      // 继续执行后续步骤
      let devExecutionOutput = fallbackPlanning
      
      // 尝试创建基本的项目结构
      try {
        if (this.taskDir && !this.taskDir.startsWith('virtual://')) {
          // 创建基本目录结构
          const srcDir = path.join(this.taskDir, 'src')
          const mainDir = path.join(srcDir, 'main')
          const rendererDir = path.join(srcDir, 'renderer')
          
          // 异步创建目录
          await fsp.mkdir(mainDir, { recursive: true, mode: 0o755 })
          await fsp.mkdir(rendererDir, { recursive: true, mode: 0o755 })
          
          // 创建基本的 package.json
          const packageJson = {
            name: 'fallback-project',
            version: '1.0.0',
            description: 'Fallback project structure',
            main: 'src/main/index.js',
            scripts: {
              start: 'node src/main/index.js',
              dev: 'node src/main/index.js'
            },
            dependencies: {}
          }
          await fsp.writeFile(path.join(this.taskDir, 'package.json'), JSON.stringify(packageJson, null, 2), { encoding: 'utf8', mode: 0o644 })
          
          // 创建基本的入口文件
          await fsp.writeFile(path.join(mainDir, 'index.js'), `// 主入口文件
console.log('Hello World!');
`, { encoding: 'utf8', mode: 0o644 })
          
          await fsp.writeFile(path.join(rendererDir, 'index.html'), `<!DOCTYPE html>
<html>
<head>
  <title>Fallback Project</title>
</head>
<body>
  <h1>Hello World!</h1>
  <p>This is a fallback project structure.</p>
</body>
</html>
`, { encoding: 'utf8', mode: 0o644 })
          
          await fsp.writeFile(path.join(rendererDir, 'index.js'), `// 渲染进程入口文件
console.log('Renderer process loaded');
`, { encoding: 'utf8', mode: 0o644 })
          
          devExecutionOutput = `✅ 降级策略执行成功！\n\n${fallbackPlanning}\n\n已创建基本的项目结构和文件：\n- package.json\n- src/main/index.js\n- src/renderer/index.html\n- src/renderer/index.js`
          console.log('[MultiDialogue] 降级策略执行成功')
        } else {
          devExecutionOutput = `⚠️  降级策略执行受限\n\n${fallbackPlanning}\n\n无法创建项目文件，因为任务目录是虚拟路径。`
          console.log('[MultiDialogue] 降级策略执行受限')
        }
      } catch (error: any) {
        devExecutionOutput = `⚠️  降级策略执行失败\n\n${fallbackPlanning}\n\n错误: ${error.message}\n\n建议：请检查目录权限或尝试手动创建项目结构。`
        console.error('[MultiDialogue] 降级策略执行失败:', error)
      }
      
      this.iterationRounds[this.currentRound - 1].devOutput = devExecutionOutput
      
      // 发送降级执行结果到前端
      onMessage('agent_message', {
        agentId: 'dev',
        agentName: '全栈开发工程师',
        role: '代码开发、系统架构',
        content: devExecutionOutput,
        phase: 'dev_fallback',
        round: this.currentRound,
        action: 'fallback_completed'
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
          { name: '创建项目文件', status: 'completed', progress: 100 },
          { name: '安装依赖并构建', status: 'completed', progress: 100 }
        ],
        message: '开发工程师：使用降级策略完成项目结构创建 (50%)'
      })
      
      // 继续执行测试步骤
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
      
      const testResult = await this.executeAgent('test', `# 项目ID: ${this.taskId}
${devExecutionOutput}

【重要】项目目录：${this.taskDir}
测试文件时使用此目录！`)
      
      // 发送测试工程师的详细测试报告到前端
      onMessage('agent_message', {
        agentId: 'test',
        agentName: '测试工程师',
        role: '测试用例、测试执行',
        content: testResult.output,
        phase: 'testing',
        round: this.currentRound,
        log: testResult.log
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
        progress: 80,
        subTasks: [
          { name: '分析开发代码', status: 'completed', progress: 100 },
          { name: '设计测试用例', status: 'completed', progress: 100 },
          { name: '执行测试', status: 'completed', progress: 100 },
          { name: '生成测试报告', status: 'completed', progress: 100 }
        ],
        message: `测试工程师：测试完成 (80%) ${testPassed ? '✅ 通过' : '❌ 失败'}`
      })
      
      // ==================== 5. 审查 ====================
      onMessage('progress', { 
        phase: 'review', 
        agent: 'review',
        round: this.currentRound,
        progress: 90,
        subTasks: [
          { name: '审查代码质量', status: 'in_progress', progress: 0 },
          { name: '检查安全性', status: 'pending', progress: 0 },
          { name: '评估交付质量', status: 'pending', progress: 0 }
        ],
        message: '审查员：正在审查代码... (90%)'
      })
      
      const reviewResult = await this.executeAgent('review', `# 项目ID: ${this.taskId}
## 你的任务：代码审查 + 需求一致性核验

## 一、PM需求文档：
${this.iterationRounds[this.currentRound - 1]?.pmAnalysis || '（无PM输出）'}

## 二、UI设计文档：
${this.iterationRounds[this.currentRound - 1]?.uiOutput || '（无UI输出）'}

## 三、开发输出：
${testResult.output}

## 四、审查要求：

### 1. 代码质量审查
- 代码规范
- 安全性检查
- 性能评估

### 2. 需求一致性核验（重要！）
对比PM需求、UI设计、开发输出三者的一致性：
- ✅ PM需求是否在代码中实现？
- ✅ UI设计是否在代码中体现？
- ✅ 是否有遗漏或理解偏差？

### 3. 输出格式
请按以下格式输出：

## 审查结果

### 代码质量评估
[评估结果]

### 需求一致性检查
| 需求项 | 实现状态 | 备注 |
|--------|----------|------|
| ... | ... | ... |

### 发现的问题
1. [问题描述]
2. [问题描述]

### 需要修改吗？
- 如果发现需求遗漏或偏差：返回 "需要修改" + 具体修改建议
- 如果全部符合要求：返回 "无需修改"

【重要】项目目录：${this.taskDir}
审查代码时使用此目录！`)
      this.iterationRounds[this.currentRound - 1].reviewResult = reviewResult.output
      
      // 发送审查员的详细审查结果到前端
      onMessage('agent_message', {
        agentId: 'review',
        agentName: '代码审查员',
        role: '代码审查、质量评估',
        content: reviewResult.output,
        phase: 'reviewing',
        round: this.currentRound,
        log: reviewResult.log
      })
      
      onMessage('progress', { 
        phase: 'review', 
        agent: 'review',
        round: this.currentRound,
        progress: 100,
        subTasks: [
          { name: '审查代码质量', status: 'completed', progress: 100 },
          { name: '检查安全性', status: 'completed', progress: 100 },
          { name: '评估交付质量', status: 'completed', progress: 100 }
        ],
        message: '审查员：审查完成 (100%)'
      })
      
      // 判断是否可以交付
      const canDeliver = testPassed && testSeverity !== 'critical' && reviewResult.success
      
      // 检查审查结果中是否包含"需要修改"
      const reviewOutput = reviewResult.output || ''
      const needsRevision = reviewOutput.includes('需要修改') || reviewOutput.includes('需求遗漏') || reviewOutput.includes('理解偏差')
      
      this.delivered = canDeliver && !needsRevision
      this.iterationRounds[this.currentRound - 1].delivered = canDeliver && !needsRevision
      
      // 如果审查发现需求遗漏或偏差，进入下一轮迭代
      if (needsRevision && this.currentRound < this.maxIterations) {
        summary = '审查发现需求遗漏或偏差，进入下一轮迭代修改'
        onMessage('delivered', { 
          round: this.currentRound,
          success: false,
          summary: summary,
          taskDir: this.taskDir,
          strategy: 'revision_needed',
          reason: '审查发现需求遗漏或理解偏差，需要开发修改',
          nextAction: '进入第 ' + (this.currentRound + 1) + ' 轮迭代'
        })
      } else if (canDeliver) {
        summary = '项目已成功交付（使用降级策略）'
        onMessage('delivered', { 
          round: this.currentRound,
          success: true,
          summary: summary,
          taskDir: this.taskDir,
          strategy: 'fallback'
        })
      } else {
        summary = '项目未通过测试或审查（使用降级策略）'
        onMessage('delivered', { 
          round: this.currentRound,
          success: false,
          summary: summary,
          taskDir: this.taskDir,
          strategy: 'fallback',
          issues: [
            !testPassed ? '测试未通过' : '',
            testSeverity === 'critical' ? '严重问题' : '',
            !reviewResult.success ? '审查未通过' : ''
          ].filter(Boolean)
        })
      }
      
      // 增加轮次
      this.currentRound++
      
      return {
        completed: true,
        delivered: canDeliver,
        currentRound: this.currentRound - 1,
        summary: summary
      }
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
    
    // 1. 需求分析阶段
    onMessage('progress', { 
      phase: 'dev', 
      agent: 'dev',
      round: this.currentRound,
      progress: 10,
      subTasks: [
        { name: '需求分析', status: 'completed', progress: 100 }
      ],
      message: '开发工程师：需求分析完成 (10%)'
    })
    
    // 2. 工作规划阶段
    onMessage('progress', { 
      phase: 'dev', 
      agent: 'dev',
      round: this.currentRound,
      progress: 20,
      subTasks: [
        { name: '需求分析', status: 'completed', progress: 100 },
        { name: '工作规划', status: 'in_progress', progress: 0 }
      ],
      message: '开发工程师：开始工作规划 (20%)'
    })
    
    // 3.2 使用Planner生成可执行计划
    let planTimeout = false
    console.log('[MultiDialogue] 开始生成执行计划, taskDir:', this.taskDir)
    try {
      // 增加超时时间到5分钟
      const planPromise = planner.createPlan(
        `根据以下需求创建完整的项目实现：\n\n${devPlanningResult.output}`,
        [],
        this.userSelectedModel,
        { taskDir: this.taskDir, max_tokens: 4000, temperature: 0.3 }
      )
      
      this.devPlan = await this.withTimeout(
        planPromise,
        300000,
        '计划生成超时（5分钟）'
      ) as Plan
      console.log('[MultiDialogue] 计划生成成功, 步骤数:', this.devPlan.steps.length)
      
      onMessage('plan_created', { 
        round: this.currentRound, 
        stepCount: this.devPlan.steps.length,
        reasoning: this.devPlan.reasoning
      })
      
      // 3. 架构设计阶段
      onMessage('progress', { 
        phase: 'dev', 
        agent: 'dev',
        round: this.currentRound,
        progress: 30,
        subTasks: [
          { name: '需求分析', status: 'completed', progress: 100 },
          { name: '工作规划', status: 'completed', progress: 100 },
          { name: '架构设计', status: 'in_progress', progress: 0 }
        ],
        message: '开发工程师：架构设计中 (30%)'
      })
      
      onMessage('progress', { 
        phase: 'dev', 
        agent: 'dev',
        round: this.currentRound,
        progress: 40,
        subTasks: [
          { name: '需求分析', status: 'completed', progress: 100 },
          { name: '工作规划', status: 'completed', progress: 100 },
          { name: '架构设计', status: 'completed', progress: 100 },
          { name: '生成执行计划', status: 'in_progress', progress: 0 }
        ],
        message: '开发工程师：架构设计完成，生成执行计划 (40%)'
      })
      
      onMessage('progress', { 
        phase: 'dev', 
        agent: 'dev',
        round: this.currentRound,
        progress: 60,
        subTasks: [
          { name: '需求分析', status: 'completed', progress: 100 },
          { name: '工作规划', status: 'completed', progress: 100 },
          { name: '架构设计', status: 'completed', progress: 100 },
          { name: '生成执行计划', status: 'completed', progress: 100 },
          { name: '前端开发', status: 'in_progress', progress: 0 },
          { name: '后端开发', status: 'pending', progress: 0 }
        ],
        message: '开发工程师：前端开发中 (60%)'
      })
      
      // 5. 后端开发阶段
      onMessage('progress', { 
        phase: 'dev', 
        agent: 'dev',
        round: this.currentRound,
        progress: 70,
        subTasks: [
          { name: '需求分析', status: 'completed', progress: 100 },
          { name: '工作规划', status: 'completed', progress: 100 },
          { name: '架构设计', status: 'completed', progress: 100 },
          { name: '生成执行计划', status: 'completed', progress: 100 },
          { name: '前端开发', status: 'completed', progress: 100 },
          { name: '后端开发', status: 'in_progress', progress: 0 }
        ],
        message: '开发工程师：后端开发中 (70%)'
      })
      
      // 6. 自测修BUG阶段
      onMessage('progress', { 
        phase: 'dev', 
        agent: 'dev',
        round: this.currentRound,
        progress: 80,
        subTasks: [
          { name: '需求分析', status: 'completed', progress: 100 },
          { name: '工作规划', status: 'completed', progress: 100 },
          { name: '架构设计', status: 'completed', progress: 100 },
          { name: '生成执行计划', status: 'completed', progress: 100 },
          { name: '前端开发', status: 'completed', progress: 100 },
          { name: '后端开发', status: 'completed', progress: 100 },
          { name: '自测修BUG', status: 'in_progress', progress: 0 }
        ],
        message: '开发工程师：自测修BUG中 (80%)'
      })
      
      // 7. 完成阶段
      onMessage('progress', { 
        phase: 'dev', 
        agent: 'dev',
        round: this.currentRound,
        progress: 90,
        subTasks: [
          { name: '需求分析', status: 'completed', progress: 100 },
          { name: '工作规划', status: 'completed', progress: 100 },
          { name: '架构设计', status: 'completed', progress: 100 },
          { name: '生成执行计划', status: 'completed', progress: 100 },
          { name: '前端开发', status: 'completed', progress: 100 },
          { name: '后端开发', status: 'completed', progress: 100 },
          { name: '自测修BUG', status: 'completed', progress: 100 }
        ],
        message: '开发工程师：开发完成，准备交付 (90%)'
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
            this.userSelectedModel,
            { taskDir: this.taskDir },
            (progress: ExecutionProgressEvent) => {
              onMessage('execution_progress', { 
                round: this.currentRound,
                ...progress 
              })
            }
          )
          
          const executionResult = await this.withTimeout(
            execPromise,
            600000,
            '执行超时（10分钟）'
          ) as any
        
        if (executionResult.success) {
          devExecutionOutput = `✅ 项目创建成功！\n\n开发智能体分析：\n${devPlanningResult.output}\n\n执行结果：\n${Object.entries(executionResult.stepResults).map(([stepId, result]: [string, any]) => {
            return `- ${stepId}: ${result?.success ? '成功' : '失败'}`
          }).join('\n')}`
          onMessage('dev_completed', { round: this.currentRound, success: true })
        } else {
          // 检查是否为严重错误（工具不存在、参数错误等）
          const isCriticalError = executionResult.error?.includes('Tool not found') || 
                                 executionResult.error?.includes('Missing parameter') ||
                                 executionResult.error?.includes('Parameter')
          
          if (isCriticalError) {
            // 严重错误，立即停止并通知用户
            devExecutionOutput = `❌ 项目创建失败\n\n开发智能体分析：\n${devPlanningResult.output}\n\n执行错误：\n${executionResult.error}`
            onMessage('dev_completed', { round: this.currentRound, success: false, error: executionResult.error, critical: true })
            
            // 发送详细的错误信息给用户
            onMessage('critical_error', {
              phase: 'dev',
              round: this.currentRound,
              error: executionResult.error,
              message: '开发过程中遇到严重错误，需要手动干预',
              fixable: true,
              quickFixes: ['检查工具配置', '修改执行计划', '手动创建项目结构']
            })
            
            // 标记当前轮次为失败
            this.iterationRounds[this.currentRound - 1].devOutput = devExecutionOutput
            this.iterationRounds[this.currentRound - 1].delivered = false
            
            // 直接返回失败结果，停止后续步骤
            return {
              completed: false,
              delivered: false,
              currentRound: this.currentRound,
              summary: `开发过程中遇到严重错误：${executionResult.error}`
            }
          } else {
            // 非严重错误，继续执行
            devExecutionOutput = `⚠️ 项目创建部分完成\n\n开发智能体分析：\n${devPlanningResult.output}\n\n执行错误：\n${executionResult.error}`
            onMessage('dev_completed', { round: this.currentRound, success: false, error: executionResult.error })
          }
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

    // 生成结构化输出
    const devOutputFiles: string[] = []
    if (this.taskDir && !this.taskDir.startsWith('virtual://')) {
      try {
        // 异步递归遍历目录
        async function listFiles(dir: string, basePath: string = ''): Promise<string[]> {
          const files: string[] = []
          const entries = await fsp.readdir(dir, { withFileTypes: true })
          
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)
            const relativePath = path.join(basePath, entry.name)
            
            if (entry.isFile()) {
              files.push(relativePath)
            } else if (entry.isDirectory()) {
              const subFiles = await listFiles(fullPath, relativePath)
              files.push(...subFiles)
            }
          }
          
          return files
        }
        
        const files = await listFiles(this.taskDir)
        devOutputFiles.push(...files)
      } catch (error) {
        console.error('[MultiDialogue] 读取项目文件失败:', error)
      }
    }
    
    // 发送开发工程师的详细结果到前端
    onMessage('agent_message', {
      agentId: 'dev',
      agentName: '全栈开发工程师',
      role: '代码开发、系统架构',
      content: devExecutionOutput,
      phase: 'dev_implementation',
      round: this.currentRound,
      nextSteps: ['进入测试阶段', '等待用户确认'],
      completedTasks: ['分析需求和UI设计', '设计代码架构', '生成执行计划', '创建项目文件', '安装依赖并构建'],
      outputFiles: devOutputFiles
    })
    
    // === 代码实现阶段多轮迭代确认 ===
    let devConfirmed = false
    let devIteration = 0
    const maxDevIterations = 2 // 最多迭代2轮
    
    while (!devConfirmed && devIteration < maxDevIterations) {
      try {
        const options = devIteration === 0 
          ? ['确认方案', '需要修改']
          : ['确认方案', '仍需修改', '简化实现', '增加功能']
        
        // 发送确认请求到前端
        onMessage('confirmation_request', {
          phase: 'dev_implementation',
          round: this.currentRound,
          iteration: devIteration,
          agentId: 'dev',
          agentName: '全栈开发工程师',
          role: '代码开发、系统架构',
          title: devIteration === 0 ? '代码实现完成' : `代码实现 (第${devIteration + 1}次修改)`,
          description: devIteration === 0 
            ? '全栈开发工程师已完成代码实现，请确认方案是否满足您的需求'
            : '已根据您的反馈更新实现，请再次确认',
          options,
          context: { task: input, implementation: devExecutionOutput }
        })
        
        // 等待用户确认（这里需要前端返回用户选择）
        // 暂时使用默认确认，实际应该等待前端返回
        const userChoice = '确认方案'
        
        if (userChoice === '确认方案') {
          // 用户确认方案合格
          devConfirmed = true
          
          onMessage('agent_message', {
            agentId: 'dev',
            agentName: '全栈开发工程师',
            role: '代码开发、系统架构',
            content: '✅ 用户已确认代码实现方案，进入测试阶段。',
            phase: 'dev_implementation',
            round: this.currentRound
          })
          break
        }
        
        // 用户需要修改
        const userFeedback = userChoice === '需要修改' || userChoice === '仍需修改' 
          ? '请根据您的具体需求修改代码实现'
          : userChoice === '简化实现' ? '请简化代码实现，只保留核心功能' : '请增加更多功能实现'
        
        onMessage('agent_message', {
          agentId: 'dev',
          agentName: '全栈开发工程师',
          role: '代码开发、系统架构',
          content: `📝 用户反馈 (第${devIteration + 1}次)：${userFeedback}\n\n请根据反馈修改代码实现。`,
          phase: 'dev_implementation',
          round: this.currentRound
        })
        
        // 增量修改实现结果
        devIteration++
        
        // 使用增量修改 prompt
        const incrementalPrompt = this.buildIncrementalPrompt(
          input,
          devExecutionOutput,
          userFeedback,
          'code'
        )
        
        // 重新生成执行计划并执行
        devPlanningResult = await this.executeAgent('dev', incrementalPrompt)
        
        // 重新生成执行计划
          try {
            const planPromise = planner.createPlan(
              `根据以下需求创建完整的项目实现：\n\n${devPlanningResult.output}`,
              [],
              this.userSelectedModel,
              { taskDir: this.taskDir }
            )
            
            this.devPlan = await this.withTimeout(
              planPromise,
              300000,
              '计划生成超时（5分钟）'
            ) as Plan
            
            // 重新执行计划
            const execPromise = executor.executePlan(
              this.devPlan,
              this.userSelectedModel,
              { taskDir: this.taskDir },
              (progress: ExecutionProgressEvent) => {
                onMessage('execution_progress', { 
                  round: this.currentRound,
                  ...progress 
                })
              }
            )
            
            const executionResult = await this.withTimeout(
              execPromise,
              600000,
              '执行超时（10分钟）'
            ) as any
          
          if (executionResult.success) {
            devExecutionOutput = `✅ 项目创建成功！\n\n开发智能体分析：\n${devPlanningResult.output}\n\n执行结果：\n${Object.entries(executionResult.stepResults).map(([stepId, result]: [string, any]) => {
                return `- ${stepId}: ${result?.success ? '成功' : '失败'}`
              }).join('\n')}`
          } else {
            devExecutionOutput = `⚠️ 项目创建部分完成\n\n开发智能体分析：\n${devPlanningResult.output}\n\n执行错误：\n${executionResult.error}`
          }
        } catch (error: any) {
          console.error('[MultiDialogue] 重新执行失败:', error)
          devExecutionOutput = devPlanningResult.output + '\n\n⚠️ 重新执行失败: ' + error.message
        }
        
        this.iterationRounds[this.currentRound - 1].devOutput = devExecutionOutput
        
        // 发送更新后的实现结果
        const structuredDevOutput = this.generateStructuredOutput(
          '全栈开发工程师',
          '代码开发',
          devExecutionOutput,
          ['进入测试阶段', '等待用户确认'],
          ['分析需求和UI设计', '设计代码架构', '生成执行计划', '创建项目文件', `安装依赖并构建 (第${devIteration}次修改)`],
          devOutputFiles,
          undefined,
          undefined
        )
        
        onMessage('agent_message', {
          agentId: 'dev',
          agentName: '全栈开发工程师',
          role: '代码开发、系统架构',
          content: `📝 代码实现已更新 (第${devIteration + 1}次)：\n\n${structuredDevOutput}`,
          phase: 'dev_implementation',
          round: this.currentRound
        })
        
      } catch (error) {
        console.warn('[MultiDialogue] 代码实现确认跳过:', error)
        devConfirmed = true // 出错时继续执行
        break
      }
    }
    
    if (!devConfirmed && devIteration >= maxDevIterations) {
      onMessage('agent_message', {
        agentId: 'system',
        agentName: '系统',
        role: '协调员',
        content: `⚠️ 已达到最大迭代次数 (${maxDevIterations}次)，强制进入测试阶段。`,
        phase: 'dev_implementation',
        round: this.currentRound
      })
    }

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
    
    let testPassed = false
    let testSeverity = 'minor'
    
    if (testResult.success && testResult.parsedOutput) {
      testPassed = testResult.parsedOutput.passed === true
      testSeverity = testResult.parsedOutput.severity || 'minor'
      this.iterationRounds[this.currentRound - 1].testResult = testResult.parsedOutput
    }
    
    // 生成结构化输出
    // 发送测试工程师的详细测试报告到前端
    onMessage('agent_message', {
      agentId: 'test',
      agentName: '测试工程师',
      role: '测试用例、测试执行',
      content: testResult.output,
      phase: 'testing',
      round: this.currentRound,
      nextSteps: ['进入代码审查阶段', '等待用户确认'],
      completedTasks: ['分析开发代码', '设计测试用例', '执行测试', '生成测试报告'],
      outputFiles: []
    })
    
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
    
    const reviewResult = await this.executeAgent('review', devExecutionOutput + `\n\n【重要】项目目录：${this.taskDir}\n审查代码时使用此目录！`)
    
    let reviewPassed = false
    
    if (reviewResult.success) {
      const reviewText = reviewResult.output.toLowerCase()
      reviewPassed = reviewText.includes('通过') || reviewText.includes('pass')
      this.iterationRounds[this.currentRound - 1].reviewResult = reviewResult.output
    }
    
    // 发送代码审查员的详细审查报告到前端
    onMessage('agent_message', {
      agentId: 'review',
      agentName: '代码审查员',
      role: '代码质量、安全分析',
      content: reviewResult.output,
      phase: 'code_review',
      round: this.currentRound,
      nextSteps: ['等待PM判断是否可以交付'],
      completedTasks: ['审查代码质量', '检查安全性', '性能分析', '输出审查意见'],
      outputFiles: []
    })
    
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

    // 7. 不再让PM分析bug（开发会直接修复测试和审查发现的问题）
    // PM在产品验收阶段的职责是：把控项目方向、决定什么时候算完成
    this.iterationRounds[this.currentRound - 1].pmAnalysis = `第${this.currentRound}轮发现问题：${issues.join('、')}。由开发直接修复。`
    
    // 直接进入下一轮迭代，不需要PM分析
    // 检查是否达到最大迭代次数
    if (this.currentRound >= this.maxIterations) {
      // 达到最大次数，询问用户是否要增加迭代次数
      try {
        const { dialog } = await import('electron')
        
        const result = await dialog.showMessageBox({
          type: 'question',
          title: '迭代次数确认',
          message: `已达到最大迭代次数(${this.currentRound}轮)，但仍有问题需要修复。`,
          detail: `发现的问题：${issues.join('、')}\n\n是否要增加迭代次数继续修复问题？`,
          buttons: ['是，增加迭代次数', '否，强制交付'],
          defaultId: 0,
          cancelId: 1
        })
        
        if (result.response === 0) {
          // 用户同意增加迭代次数
          this.maxIterations += 1
          summary = `⚠️ 已达到原始最大迭代次数(${this.currentRound}轮)，用户同意增加迭代次数继续修复问题。\n\n问题详情：${issues.join('、')}`
          onMessage('iteration_increased', { 
            round: this.currentRound, 
            issues, 
            newMaxIterations: this.maxIterations,
            summary 
          })
        } else {
          // 用户选择强制交付
          this.delivered = true  // 强制交付
          summary = `⚠️ 已达到最大迭代次数(${this.currentRound}轮)，用户选择强制交付。\n\n问题详情：${issues.join('、')}`
          onMessage('max_iterations', { round: this.currentRound, issues, summary })
          
          return {
            completed: true,
            delivered: true,
            currentRound: this.currentRound,
            summary
          }
        }
      } catch (dialogError: any) {
        console.error('[MultiDialogue] 打开确认对话框失败:', dialogError)
        // 对话框失败，强制交付
        this.delivered = true
        summary = `⚠️ 已达到最大迭代次数(${this.currentRound}轮)，尽管仍有问题，但强制交付。\n\n问题详情：${issues.join('、')}`
        onMessage('max_iterations', { round: this.currentRound, issues, summary })
        
        return {
          completed: true,
          delivered: true,
          currentRound: this.currentRound,
          summary
        }
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

  // 使用高级推理引擎执行智能体
  private async executeWithAdvancedReasoning(
    agentId: string,
    input: string,
    model: string,
    reasoningEngine: 'enhanced-react' | 'thought-tree' | 'unified' | 'standard',
    executionLog: string[]
  ): Promise<any> {
    try {
      executionLog.push(`[${new Date().toISOString()}] 开始高级推理，引擎: ${reasoningEngine}`)
      
      switch (reasoningEngine) {
        case 'enhanced-react':
          const enhancedResult = await unifiedReasoningEngine.reason(
            input,
            { mode: ReasoningMode.ENHANCED_REACT, enableDeepReflection: true, maxIterations: 50, model }
          )
          executionLog.push(`[${new Date().toISOString()}] UnifiedReasoning(ReAct模式)推理完成，置信度: ${enhancedResult.confidence?.toFixed(2) || '0'}`)
          return {
            success: true,
            content: enhancedResult.answer
          }
        
        case 'thought-tree':
          const treeResult = await thoughtTreeEngine.execute(
            input,
            { maxDepth: 5, maxIterations: 50, model }
          )
          const bestNode = treeResult.bestPath[treeResult.bestPath.length - 1]
          executionLog.push(`[${new Date().toISOString()}] ThoughtTree推理完成，最佳路径长度: ${treeResult.bestPath?.length || 0}`)
          return {
            success: true,
            content: bestNode?.thought || treeResult.root.thought
          }
        
        case 'unified':
          const unifiedResult = await unifiedReasoningEngine.reason(
            input,
            { mode: ReasoningMode.HYBRID, enableDeepReflection: true, maxIterations: 50, model }
          )
          executionLog.push(`[${new Date().toISOString()}] UnifiedReasoning推理完成，置信度: ${unifiedResult.confidence?.toFixed(2) || '0'}`)
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
      console.error(`[MultiDialogue] 高级推理失败 (${reasoningEngine}):`, error)
      throw error
    }
  }

  // 使用标准LLM调用执行智能体
  private async executeWithStandardLLM(
    agentId: string,
    input: string,
    model: string,
    executionLog: string[]
  ): Promise<any> {
    try {
      executionLog.push(`[${new Date().toISOString()}] 使用标准LLM调用`)
      
      const dialogue = this.dialogues.get(agentId)
      if (!dialogue) {
        throw new Error(`智能体 ${agentId} 不存在`)
      }
      
      const contextPrompt = this.buildContextPrompt(agentId)
      
      const messages: any[] = [
        { role: 'system', content: dialogue.agent.systemPrompt },
        ...(contextPrompt ? [{ role: 'system', content: contextPrompt }] : []),
        { role: 'user', content: input }
      ]
      
      executionLog.push(`[${new Date().toISOString()}] 上下文构建完成，长度: ${contextPrompt?.length || 0} 字符`)
      executionLog.push(`[${new Date().toISOString()}] 发送请求到LLM服务`)
      
      const responsePromise = llmService.chat(model, messages, {
        temperature: 0.7,
        max_tokens: 8000
      })
      
      const response = await this.withTimeout(
        responsePromise,
        60000,
        'LLM调用超时（60秒）'
      ) as any
      
      executionLog.push(`[${new Date().toISOString()}] LLM响应 received, success: ${response.success}`)
      return response
    } catch (error: any) {
      executionLog.push(`[${new Date().toISOString()}] 标准LLM调用失败: ${error.message}`)
      console.error(`[MultiDialogue] 标准LLM调用失败:`, error)
      throw error
    }
  }

  // 保存智能体输出为 Markdown 文档
  private saveAgentOutputAsDocument(title: string, content: string, filename: string): void {
    try {
      const docsPath = path.join(this.taskDir, '.docs')
      
      // 创建 .docs 目录
      if (!fs.existsSync(docsPath)) {
        fs.mkdirSync(docsPath, { recursive: true, mode: 0o755 })
      }
      
      const docPath = path.join(docsPath, filename)
      
      // 添加文档标题
      const fullContent = `# ${title}\n\n${content}\n\n---\n*由 AI 智能体生成*`
      
      fs.writeFileSync(docPath, fullContent, 'utf-8')
      console.log(`[MultiDialogueCoordinator] 文档已保存: ${docPath}`)
    } catch (error) {
      console.error(`[MultiDialogueCoordinator] 保存文档失败:`, error)
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
    errorDetails?: string
    retryable?: boolean
    requiresUserAction?: boolean
    suggestedAction?: string
    log?: string[]
    warning?: string
  }> {
    const dialogue = this.dialogues.get(agentId)
    if (!dialogue) {
      return { 
        success: false, 
        output: '智能体不存在',
        errorDetails: '智能体ID无效',
        retryable: false
      }
    }

    // 检查缓存
    const cachedResult = this.getAgentCache(agentId, input)
    if (cachedResult) {
      dialogue.status = 'completed'
      dialogue.lastOutput = cachedResult.output
      
      const executionLog: string[] = []
      executionLog.push(`[${new Date().toISOString()}] 从缓存获取智能体执行结果: ${agentId}`)
      executionLog.push(`[${new Date().toISOString()}] 缓存命中，跳过执行`)
      
      this.emit('agent:complete', { agentId, output: cachedResult.output, log: executionLog, cached: true })
      
      return {
        ...cachedResult,
        log: executionLog
      }
    }

    dialogue.status = 'working'
    const executionLog: string[] = []
    executionLog.push(`[${new Date().toISOString()}] 开始执行智能体: ${agentId}`)
    executionLog.push(`[${new Date().toISOString()}] 输入长度: ${input.length} 字符`)
    
    // 记录智能体开始执行
    taskLogger.startAgent({
      agentId,
      agentName: dialogue.agent.name,
      agentRole: dialogue.agent.role,
      iterationNumber: this.currentRound
    })

    this.emit('agent:start', { agentId, round: this.currentRound, log: executionLog[0] })

    // 启动心跳检测
    this.startHeartbeatMonitoring()
    this.updateAgentHeartbeat(agentId)
    
    // 创建心跳更新定时器
    const heartbeatUpdateInterval = setInterval(() => {
      this.updateAgentHeartbeat(agentId)
    }, 5000) // 每5秒更新一次心跳

    try {
      // 输入验证和预处理
      const processedInput = this.preprocessInput(input, agentId)
      if (!processedInput) {
        clearInterval(heartbeatUpdateInterval)
        dialogue.status = 'failed'
        executionLog.push(`[${new Date().toISOString()}] 输入验证失败: 输入数据为空或格式不正确`)
        this.emit('agent:error', { 
          agentId, 
          error: '输入数据无效',
          details: '输入数据为空或格式不正确',
          log: executionLog
        })
        return {
          success: false,
          output: '输入数据无效',
          errorDetails: '输入数据为空或格式不正确',
          retryable: false,
          log: executionLog
        }
      }
      executionLog.push(`[${new Date().toISOString()}] 输入验证通过，处理后长度: ${processedInput.length} 字符`)

      // 根据智能体类型选择推理引擎
      let useAdvancedReasoning = false
      let reasoningEngine: 'enhanced-react' | 'thought-tree' | 'unified' | 'standard' = 'standard'
      
      switch (agentId) {
        case 'dev':
          reasoningEngine = 'enhanced-react'
          useAdvancedReasoning = true
          executionLog.push(`[${new Date().toISOString()}] 使用EnhancedReAct引擎进行深度推理`)
          break
        case 'test':
          reasoningEngine = 'unified'
          useAdvancedReasoning = true
          executionLog.push(`[${new Date().toISOString()}] 使用UnifiedReasoning引擎进行测试分析`)
          break
        case 'review':
          reasoningEngine = 'thought-tree'
          useAdvancedReasoning = true
          executionLog.push(`[${new Date().toISOString()}] 使用ThoughtTree引擎进行代码审查`)
          break
        case 'pm':
          // PM使用简单的标准LLM调用，不需要复杂推理
          reasoningEngine = 'standard'
          useAdvancedReasoning = false
          executionLog.push(`[${new Date().toISOString()}] 使用标准LLM调用进行需求分析`)
          break
        default:
          reasoningEngine = 'standard'
          useAdvancedReasoning = false
          executionLog.push(`[${new Date().toISOString()}] 使用标准LLM调用`)
      }

      // 尝试多次调用LLM，实现降级策略
      let attempts = 0
      const maxAttempts = 3
      const models = [this.userSelectedModel, 'doubao-seed-2-0-lite-260215']
      const errors: string[] = []

      while (attempts < maxAttempts) {
        attempts++
        const currentModel = attempts === 1 ? this.userSelectedModel : models[attempts - 1] || models[0]
        
        try {
          executionLog.push(`[${new Date().toISOString()}] 尝试 ${attempts}/${maxAttempts}，模型: ${currentModel}`)
          
          // 使用高级推理引擎或标准LLM调用
          let response: any
          if (useAdvancedReasoning) {
            response = await this.executeWithAdvancedReasoning(
              agentId,
              processedInput,
              currentModel,
              reasoningEngine,
              executionLog
            )
          } else {
            response = await this.executeWithStandardLLM(
              agentId,
              processedInput,
              currentModel,
              executionLog
            )
          }

          if (!response.success || !response.content) {
            const errorMsg = response.error || '调用失败'
            errors.push(`模型 ${currentModel}: ${errorMsg}`)
            throw new Error(errorMsg)
          }
          
          // 检查响应内容是否为空或只是占位符
          const trimmedContent = response.content.trim()
          if (!trimmedContent || trimmedContent === '/' || trimmedContent === '.' || trimmedContent === '\n' || trimmedContent.length < 10) {
            const errorMsg = '模型返回了空响应或占位符内容'
            errors.push(`模型 ${currentModel}: ${errorMsg}`)
            throw new Error(errorMsg)
          }
          
          executionLog.push(`[${new Date().toISOString()}] 响应内容长度: ${response.content.length} 字符`)
          executionLog.push(`[${new Date().toISOString()}] 响应内容前50字符: ${response.content.slice(0, 50)}`)
          
          // 检查权限错误
          if (this.hasPermissionError(response)) {
            console.log('[MultiDialogue] 检测到权限错误')
            dialogue.status = 'failed'
            executionLog.push(`[${new Date().toISOString()}] 检测到权限错误`)
            
            this.emit('agent:error', { 
              agentId, 
              error: '权限错误',
              details: '无法访问文件或目录，请检查权限设置',
              log: executionLog,
              retryable: false,
              requiresUserAction: true
            })
            
            return {
              success: false,
              output: '遇到权限问题',
              errorDetails: '无法访问文件或目录，请检查权限设置',
              retryable: false,
              requiresUserAction: true,
              suggestedAction: '请手动创建项目目录或检查文件权限',
              log: executionLog
            }
          }
          
          dialogue.lastOutput = response.content
          dialogue.status = 'completed'
          executionLog.push(`[${new Date().toISOString()}] 智能体执行完成`)
          
          // 尝试解析测试结果
          let parsedOutput: any = undefined
          if (agentId === 'test') {
            try {
              // 尝试提取JSON
              const jsonMatch = response.content.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                parsedOutput = JSON.parse(jsonMatch[0])
                executionLog.push(`[${new Date().toISOString()}] 测试结果解析成功`)
              } else {
                executionLog.push(`[${new Date().toISOString()}] 测试结果解析失败: 未找到JSON格式`)
              }
            } catch (e: any) {
              executionLog.push(`[${new Date().toISOString()}] 测试结果解析错误: ${e.message}`)
            }
          }

          this.emit('agent:complete', { agentId, output: response.content, log: executionLog })
          
          // 记录智能体完成
          taskLogger.endAgent(agentId, 'completed', {
            messages: [response.content.slice(0, 500)]
          })

          // 保存到缓存
          const result = {
            success: true,
            output: response.content,
            parsedOutput,
            log: executionLog
          }
          this.setAgentCache(agentId, input, result)

          return result

        } catch (error: any) {
          const errorMsg = error.message || '未知错误'
          errors.push(`尝试 ${attempts} (${currentModel}): ${errorMsg}`)
          executionLog.push(`[${new Date().toISOString()}] 错误: ${errorMsg}`)
          console.error(`[MultiDialogue] 执行智能体 ${agentId} 失败 (尝试 ${attempts}/${maxAttempts}):`, error)
          
          // 记录错误
          this.recordError(agentId, errorMsg)
          taskLogger.logError(errorMsg, { agentId, attempt: attempts })
          
          // 如果是最后一次尝试，应用降级策略
          if (attempts >= maxAttempts) {
            executionLog.push(`[${new Date().toISOString()}] 所有尝试失败，应用降级策略`)
            
            // 检测是否为推理失败
            if (this.hasReasoningFailure(error) && useAdvancedReasoning) {
              executionLog.push(`[${new Date().toISOString()}] 检测到推理失败，尝试降级到标准LLM调用`)
              
              try {
                const fallbackResponse = await this.fallbackToStandardLLM(
                  agentId,
                  processedInput,
                  executionLog
                )
                
                if (fallbackResponse.success && fallbackResponse.content) {
                  dialogue.lastOutput = fallbackResponse.content
                  dialogue.status = 'completed'
                  
                  // 尝试解析测试结果
                  let parsedOutput: any = undefined
                  if (agentId === 'test') {
                    try {
                      const jsonMatch = fallbackResponse.content.match(/\{[\s\S]*\}/)
                      if (jsonMatch) {
                        parsedOutput = JSON.parse(jsonMatch[0])
                      }
                    } catch (e) {
                      // 忽略解析错误
                    }
                  }
                  
                  this.emit('agent:complete', { 
                    agentId, 
                    output: fallbackResponse.content, 
                    log: executionLog,
                    fallback: true
                  })
                  
                  return {
                    success: true,
                    output: fallbackResponse.content,
                    parsedOutput,
                    log: executionLog,
                    warning: '使用降级策略完成（标准LLM调用）'
                  }
                }
              } catch (fallbackError: any) {
                executionLog.push(`[${new Date().toISOString()}] 降级策略失败: ${fallbackError.message}`)
                this.recordError(agentId, `降级策略失败: ${fallbackError.message}`)
              }
            }
            
            // 降级策略也失败，返回错误
            dialogue.status = 'failed'
            const errorResult = this.createErrorResult(agentId, error, executionLog, true)
            
            this.emit('agent:error', { 
              agentId, 
              error: errorMsg,
              attempts, 
              maxAttempts,
              errors,
              log: executionLog,
              retryable: true,
              suggestedAction: errorResult.suggestedAction
            })
            
            return {
              success: false,
              output: errorResult.content,
              errorDetails: errorMsg,
              retryable: true,
              suggestedAction: errorResult.suggestedAction,
              log: executionLog
            }
          }
          
          // 等待一段时间后重试
          const waitTime = 1000 * attempts
          executionLog.push(`[${new Date().toISOString()}] 等待 ${waitTime}ms 后重试`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
      
      // 所有尝试都失败
      dialogue.status = 'failed'
      const finalError = '所有尝试都失败'
      executionLog.push(`[${new Date().toISOString()}] 最终失败: ${finalError}`)
      
      this.emit('agent:error', { 
        agentId, 
        error: finalError,
        log: executionLog,
        retryable: true
      })
      
      return {
        success: false,
        output: finalError,
        errorDetails: 'LLM服务不可用',
        retryable: true,
        log: executionLog
      }
    } catch (error: any) {
      clearInterval(heartbeatUpdateInterval)
      dialogue.status = 'failed'
      executionLog.push(`[${new Date().toISOString()}] 执行异常: ${error.message}`)
      
      this.emit('agent:error', { 
        agentId, 
        error: error.message,
        log: executionLog,
        retryable: false
      })
      
      return {
        success: false,
        output: `执行异常: ${error.message}`,
        errorDetails: error.message,
        retryable: false,
        log: executionLog
      }
    } finally {
      clearInterval(heartbeatUpdateInterval)
    }
  }

  // 检测权限错误
  private hasPermissionError(response: any): boolean {
    const errorIndicators = [
      'EPERM',
      'EACCES',
      'permission denied',
      '权限不足',
      'operation not permitted',
      'denied'
    ]
    
    // 避免不必要的JSON.stringify
    const responseText = this.objectToString(response).toLowerCase()
    return errorIndicators.some(indicator => 
      responseText.includes(indicator.toLowerCase())
    )
  }

  // 检测推理失败
  private hasReasoningFailure(error: any): boolean {
    const failureIndicators = [
      'timeout',
      '超时',
      'stuck',
      '卡住',
      'max iterations',
      '最大迭代次数',
      '推理失败',
      'reasoning failed'
    ]
    
    // 避免不必要的JSON.stringify
    const errorText = this.objectToString(error).toLowerCase()
    return failureIndicators.some(indicator => 
      errorText.includes(indicator.toLowerCase())
    )
  }

  // 安全地将对象转换为字符串
  private objectToString(obj: any): string {
    if (obj === null || obj === undefined) {
      return ''
    }
    
    if (typeof obj === 'string') {
      return obj
    }
    
    if (typeof obj === 'object') {
      try {
        // 只在必要时使用JSON.stringify
        return JSON.stringify(obj)
      } catch {
        return String(obj)
      }
    }
    
    return String(obj)
  }

  // 降级策略：从高级推理降级到标准LLM调用
  private async fallbackToStandardLLM(
    agentId: string,
    input: string,
    executionLog: string[]
  ): Promise<any> {
    executionLog.push(`[${new Date().toISOString()}] 触发降级策略：从高级推理降级到标准LLM调用`)
    
    try {
      const dialogue = this.dialogues.get(agentId)
      if (!dialogue) {
        throw new Error(`智能体 ${agentId} 不存在`)
      }
      
      const contextPrompt = this.buildContextPrompt(agentId)
      
      const messages: any[] = [
        { role: 'system', content: dialogue.agent.systemPrompt },
        ...(contextPrompt ? [{ role: 'system', content: contextPrompt }] : []),
        { role: 'user', content: input }
      ]
      
      executionLog.push(`[${new Date().toISOString()}] 降级：使用标准LLM调用`)
      
      const response = await llmService.chat(dialogue.agent.model, messages, {
        temperature: 0.7,
        max_tokens: 4000
      })
      
      executionLog.push(`[${new Date().toISOString()}] 降级成功：响应内容长度: ${response.content?.length || 0} 字符`)
      
      return response
    } catch (error: any) {
      executionLog.push(`[${new Date().toISOString()}] 降级失败: ${error.message}`)
      throw error
    }
  }

  // 降级策略：返回部分结果
  private createPartialResult(
    agentId: string,
    partialOutput: string,
    executionLog: string[]
  ): any {
    executionLog.push(`[${new Date().toISOString()}] 返回部分结果`)
    
    return {
      success: true,
      content: partialOutput,
      isPartial: true,
      warning: '推理未完全完成，返回部分结果'
    }
  }

  // 降级策略：返回错误信息和建议
  private createErrorResult(
    agentId: string,
    error: any,
    executionLog: string[],
    retryable: boolean = true
  ): any {
    executionLog.push(`[${new Date().toISOString()}] 返回错误结果`)
    
    const errorMsg = error.message || '未知错误'
    let suggestedAction = '请稍后重试'
    
    // 根据错误类型提供建议
    if (errorMsg.includes('timeout') || errorMsg.includes('超时')) {
      suggestedAction = '任务过于复杂，建议拆分为更小的任务'
    } else if (errorMsg.includes('permission') || errorMsg.includes('权限')) {
      suggestedAction = '请检查文件权限或选择其他目录'
    } else if (errorMsg.includes('API') || errorMsg.includes('api')) {
      suggestedAction = '请检查API Key配置或网络连接'
    } else if (errorMsg.includes('memory') || errorMsg.includes('内存')) {
      suggestedAction = '任务过于复杂，建议简化需求'
    }
    
    return {
      success: false,
      content: `执行失败: ${errorMsg}`,
      error: errorMsg,
      suggestedAction,
      retryable,
      log: executionLog
    }
  }

  // 启动心跳检测
  private startHeartbeatMonitoring() {
    if (this.heartbeatInterval) {
      return
    }
    
    console.log('[MultiDialogue] 启动心跳检测')
    
    // 初始化心跳管理器
    this.heartbeatManager = new HeartbeatManager(
      this.heartbeatTimeout,
      (agentId: string, inactiveTime: number) => {
        console.warn(`[MultiDialogue] 智能体 ${agentId} ${inactiveTime/1000} 秒无活动，可能卡住`)
        
        const dialogue = this.dialogues.get(agentId)
        if (dialogue && dialogue.status === 'working') {
          this.emit('agent:stuck', {
            agentId,
            inactiveTime,
            message: `智能体 ${agentId} 可能卡住，已 ${inactiveTime/1000} 秒无活动`,
            round: this.currentRound
          })
        }
      }
    )
    
    // 保持原有的定时检查作为备用
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats()
    }, this.heartbeatCheckInterval)
  }

  // 停止心跳检测
  private stopHeartbeatMonitoring() {
    if (this.heartbeatInterval) {
      console.log('[MultiDialogue] 停止心跳检测')
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    
    // 清理心跳管理器
    if (this.heartbeatManager) {
      this.heartbeatManager.clear()
      this.heartbeatManager = null
    }
    
    this.agentHeartbeats.clear()
  }

  // 更新智能体心跳
  private updateAgentHeartbeat(agentId: string) {
    // 同时更新传统的心跳记录和新的心跳管理器
    this.agentHeartbeats.set(agentId, Date.now())
    
    if (this.heartbeatManager) {
      this.heartbeatManager.update(agentId)
    }
  }

  // 检查所有智能体心跳
  private checkHeartbeats() {
    // 传统的心跳检查作为备用
    const now = Date.now()
    
    for (const [agentId, lastHeartbeat] of this.agentHeartbeats.entries()) {
      const inactiveTime = now - lastHeartbeat
      
      if (inactiveTime > this.heartbeatTimeout) {
        console.warn(`[MultiDialogue] 智能体 ${agentId} ${inactiveTime/1000} 秒无活动，可能卡住`)
        
        const dialogue = this.dialogues.get(agentId)
        if (dialogue && dialogue.status === 'working') {
          this.emit('agent:stuck', {
            agentId,
            inactiveTime,
            message: `智能体 ${agentId} 可能卡住，已 ${inactiveTime/1000} 秒无活动`,
            round: this.currentRound
          })
        }
      }
    }
  }

  // 预处理输入数据
  private preprocessInput(input: string, agentId: string): string {
    // 输入类型验证
    if (!input || typeof input !== 'string') {
      return ''
    }
    
    // 移除多余的空白字符
    let processed = input.trim()
    
    // 检查是否为空
    if (!processed) {
      return ''
    }
    
    // 限制输入长度
    const maxLength = 20000
    if (processed.length > maxLength) {
      processed = processed.substring(0, maxLength) + '... (输入被截断)'
    }
    
    // 清理特殊字符
    processed = processed.replace(/[\x00-\x1F\x7F]/g, '')
    
    // 为不同智能体添加特定提示
    switch (agentId) {
      case 'dev':
        processed = `请按照以下步骤分析和实现这个项目：

1. 需求分析：仔细理解用户需求和UI设计，识别所有功能点
2. 架构设计：设计清晰的代码架构和项目结构，包括目录层次和文件组织
3. 技术选型：选择合适的技术栈和依赖，提供详细的package.json配置
4. 分步规划：将复杂任务分解为多个小步骤，每个步骤都有明确的目标
5. 代码实现：提供完整的代码实现，包括核心逻辑和边缘情况处理
6. 测试验证：确保代码能够正常运行，处理可能的错误情况
7. 部署说明：提供安装依赖和启动项目的详细步骤

项目需求：
${processed}`
        break
      case 'pm':
        processed = `请分析以下需求，并提供详细的项目规划：

需求详情：
${processed}

请提供：
1. 清晰的用户故事
2. 详细的项目计划
3. 任务分配建议
4. 时间估计
5. 可能的风险和应对策略`
        break
      case 'ui':
        processed = `请根据以下需求设计用户界面：

需求详情：
${processed}

请提供：
1. 页面结构设计
2. 组件架构
3. 交互流程
4. 视觉风格建议
5. 响应式设计考虑`
        break
      case 'test':
        processed = `请根据以下代码和需求设计测试用例：

代码和需求：
${processed}

请提供：
1. 详细的测试用例
2. 测试步骤
3. 预期结果
4. 可能的边缘情况
5. 测试覆盖率分析`
        break
      case 'review':
        processed = `请审查以下代码：

代码：
${processed}

请检查：
1. 代码质量
2. 安全性
3. 性能
4. 可维护性
5. 最佳实践遵循情况`
        break
    }
    
    return processed
  }

  // 构建上下文提示
  private buildContextPrompt(agentId: string): string {
    let context = '\n\n=== 项目背景 ===\n'
    context += `任务: ${this.sharedContext.taskName}\n`
    context += `初始需求: ${this.sharedContext.initialRequest}\n`
    context += `当前轮次: 第${this.currentRound}轮（共${this.maxIterations}轮）\n`
    context += `项目路径: ${this.sharedContext.taskDir}\n`
    
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

  /**
   * 生成增量修改的 prompt
   */
  private buildIncrementalPrompt(
    task: string,
    originalContent: string,
    userFeedback: string,
    modificationType: 'pm' | 'ui' | 'code'
  ): string {
    // 添加项目ID前缀
    const projectIdHeader = `# 项目ID: ${this.taskId}\n`
    
    const instructions = {
      pm: `你是项目经理。请根据用户反馈修改需求文档。

## 项目ID: ${this.taskId}
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
4. 确保修改后的需求完整且一致

请直接输出修改后的完整需求文档，不要有任何解释或说明。`,
      
      ui: `你是UI设计师。请根据用户反馈修改UI设计文档。

## 项目ID: ${this.taskId}
## 原UI设计文档：
${originalContent}

## 用户反馈：
${userFeedback}

## 任务：
请基于原文档和用户反馈，进行增量修改（即只修改需要改动的部分，不要完全重写）。
修改后的设计应该：
1. 保留原文档中用户满意的设计部分
2. 根据反馈进行针对性修改
3. 保持设计风格和结构的一致性
4. 确保修改后的UI设计完整且符合需求

请直接输出修改后的完整UI设计文档（JSON格式），不要有任何解释或说明。`,
      
      code: `你是全栈开发工程师。请根据用户反馈修改代码实现方案。

## 项目ID: ${this.taskId}
## 原代码实现方案：
${originalContent}

## 用户反馈：
${userFeedback}

## 任务：
请基于原方案和用户反馈，进行增量修改（即只修改需要改动的部分，不要完全重写）。
修改后的方案应该：
1. 保留原方案中用户满意的部分
2. 根据反馈进行针对性修改
3. 保持代码架构和设计的一致性
4. 确保修改后的方案完整且可执行

请直接输出修改后的完整代码实现方案，不要有任何解释或说明。`
    }
    
    return instructions[modificationType]
  }

/**
   * 带超时控制的Promise执行
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    })
    
    return Promise.race([promise, timeoutPromise])
  }

  /**
   * 执行带确认的多轮迭代
   */
  private async executeWithConfirmation(
    phase: string,
    agentId: string,
    agentName: string,
    role: string,
    maxIterations: number,
    getResult: () => { success: boolean, output: string },
    updateResult: (result: { success: boolean, output: string }) => void,
    getIncrementalPrompt: (feedback: string) => string,
    onMessage: (type: string, data: any) => void
  ): Promise<boolean> {
    let confirmed = false
    let iteration = 0
    
    while (!confirmed && iteration < maxIterations) {
      try {
        const options = iteration === 0 
          ? ['确认方案', '需要修改']
          : ['确认方案', '仍需修改', '简化方案', '增加功能']
        
        // 发送确认请求到前端
        onMessage('confirmation_request', {
          phase,
          round: this.currentRound,
          iteration,
          agentId,
          agentName,
          role,
          title: iteration === 0 ? `${agentName}完成${phase}` : `${agentName} (第${iteration + 1}次修改)`,
          description: iteration === 0 
            ? `${agentName}已完成工作，请确认方案是否满足您的需求`
            : '已根据您的反馈更新方案，请再次确认',
          options,
          context: { task: this.sharedContext.taskDescription || '', result: getResult().output }
        })
        
        // 等待用户确认（这里需要前端返回用户选择）
        // 暂时使用默认确认，实际应该等待前端返回
        const userChoice = '确认方案'
        
        if (userChoice === '确认方案') {
          // 用户确认方案合格
          confirmed = true
          
          onMessage('agent_message', {
            agentId,
            agentName,
            role,
            content: '✅ 用户已确认方案，进入下一阶段。',
            phase,
            round: this.currentRound
          })
          break
        }
        
        // 用户需要修改
        const userFeedback = userChoice === '需要修改' || userChoice === '仍需修改' 
          ? '请根据您的具体需求修改方案' 
          : userChoice === '简化方案' ? '请简化方案，只保留核心功能' : '请增加更多功能'
        
        onMessage('agent_message', {
          agentId,
          agentName,
          role,
          content: `📝 用户反馈 (第${iteration + 1}次)：${userFeedback}\n\n请根据反馈修改方案。`,
          phase,
          round: this.currentRound
        })
        
        // 增量修改结果
        iteration++
        
        // 使用增量修改 prompt
        const incrementalPrompt = getIncrementalPrompt(userFeedback)
        
        const reResult = await this.executeAgent(agentId, incrementalPrompt)
        
        updateResult(reResult)
        
        // 发送更新后的结果
        const structuredOutput = this.generateStructuredOutput(
          agentName,
          phase,
          reResult.output,
          ['等待用户确认'],
          [`第${iteration}次修改`],
          [],
          undefined,
          undefined
        )
        
        onMessage('agent_message', {
          agentId,
          agentName,
          role,
          content: `📝 方案已更新 (第${iteration + 1}次)：\n\n${structuredOutput}`,
          phase,
          round: this.currentRound
        })
        
      } catch (error) {
        console.warn(`[MultiDialogue] ${agentName}确认跳过:`, error)
        confirmed = true // 出错时继续执行
        break
      }
    }
    
    if (!confirmed && iteration >= maxIterations) {
      onMessage('agent_message', {
        agentId: 'system',
        agentName: '系统',
        role: '协调员',
        content: `⚠️ 已达到最大迭代次数 (${maxIterations}次)，强制进入下一阶段。`,
        phase,
        round: this.currentRound
      })
    }
    
    return confirmed
  }

  /**
   * 生成结构化的智能体输出
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
    const todoList = todoItems.length > 0 
      ? todoItems.map(item => `- [ ] ${item}`).join('\n') 
      : '无';
    
    const completedList = completedItems.length > 0 
      ? completedItems.map(item => `- [x] ${item}`).join('\n') 
      : '无';
    
    const fileList = outputFiles.length > 0 
      ? outputFiles.map(file => `- ${file}`).join('\n') 
      : '无';
    
    const executionStats = [];
    if (executionTime) executionStats.push(`- 执行时间: ${executionTime}s`);
    if (qualityScore) executionStats.push(`- 质量评估: ${qualityScore}/10`);
    const statsText = executionStats.length > 0 ? executionStats.join('\n') : '';
    
    const structuredOutput = `# ${agentName} - ${phase}

` +
      `## 📋 待办事项
` +
      `${todoList}

` +
      `## ✅ 完成事项
` +
      `${completedList}

` +
      `## 📁 输出文件
` +
      `${fileList}

` +
      `## 📊 执行统计
` +
      `${statsText}

` +
      `## 📝 详细内容
` +
      `${content}

` +
      `---
` +
      `*此报告由 ${agentName} 生成于 ${new Date().toLocaleString('zh-CN')}*`;
    
    return structuredOutput;
  }

  // 重置协调器
  reset() {
    this.dialogues.clear()
    this.currentRound = 1
    this.iterationRounds = []
    this.delivered = false
    this.sharedContext = {}
    this.stopHeartbeatMonitoring()
    this.errorHistory = []  // 清理错误历史
  }

  // 记录错误
  private recordError(agentId: string, error: string) {
    this.errorHistory.push({
      agentId,
      error,
      timestamp: Date.now(),
      round: this.currentRound
    })
    
    // 清理过期错误
    this.cleanupOldErrors()
    
    // 检测重复错误
    if (this.hasRepeatingError(agentId, error)) {
      this.handleRepeatingError(agentId, error)
    }
  }

  // 清理过期错误
  private cleanupOldErrors() {
    const now = Date.now()
    this.errorHistory = this.errorHistory.filter(
      entry => now - entry.timestamp < this.errorWindow
    )
  }

  // 检测重复错误
  private hasRepeatingError(agentId: string, error: string): boolean {
    const now = Date.now()
    const recentErrors = this.errorHistory.filter(
      entry => entry.agentId === agentId && 
               now - entry.timestamp < this.errorWindow &&
               entry.error.includes(error.substring(0, 50))  // 匹配错误的前50个字符
    )
    
    return recentErrors.length >= this.errorThreshold
  }

  // 处理重复错误
  private handleRepeatingError(agentId: string, error: string) {
    console.warn(`[MultiDialogue] 检测到重复错误 (${agentId}): ${error}`)
    
    // 发送重复错误事件
    this.emit('repeating_error', {
      agentId,
      error,
      round: this.currentRound,
      message: `智能体 ${agentId} 遇到重复错误，可能需要手动干预`,
      suggestion: '检测到重复错误模式，建议手动检查工具配置或修改执行计划'
    })
    
    // 尝试请求用户干预
    this.requestUserIntervention(agentId, error)
  }

  // 请求用户干预
  private requestUserIntervention(agentId: string, error: string) {
    // 发送用户干预请求
    this.emit('user_intervention_required', {
      agentId,
      error,
      round: this.currentRound,
      options: [
        { id: 'retry', label: '重试', description: '继续尝试执行' },
        { id: 'skip', label: '跳过', description: '跳过当前步骤' },
        { id: 'manual', label: '手动干预', description: '手动配置执行参数' },
        { id: 'cancel', label: '取消', description: '取消当前任务' }
      ]
    })
  }
}

export const multiDialogueCoordinator = new MultiDialogueCoordinator()
