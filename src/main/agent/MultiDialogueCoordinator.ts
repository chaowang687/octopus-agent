import { EventEmitter } from 'events'
import { app } from 'electron'
import { llmService } from '../services/LLMService'
import { planner, Plan } from './Planner'
import { executor, ExecutionProgressEvent } from './Executor'
import { toolRegistry } from './ToolRegistry'
import './tools'  // 确保工具注册
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { PATHS } from '../config/paths'
import { enhancedReActEngine } from './EnhancedReActEngine'
import { thoughtTreeEngine } from './ThoughtTreeEngine'
import { unifiedReasoningEngine } from './UnifiedReasoningEngine'
import { selfCorrectionEngine } from './SelfCorrectionEngine'
import { ReasoningMode } from './UnifiedReasoningEngine'

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
  
  // 心跳检测相关
  private heartbeatInterval: NodeJS.Timeout | null = null
  private agentHeartbeats: Map<string, number> = new Map()
  private heartbeatTimeout: number = 60000  // 60秒无活动视为卡住
  private heartbeatCheckInterval: number = 10000  // 每10秒检查一次心跳

  // 错误检测相关
  private errorHistory: Array<{ agentId: string, error: string, timestamp: number, round: number }> = []
  private errorThreshold: number = 3  // 相同错误出现的阈值
  private errorWindow: number = 300000  // 错误检测时间窗口（5分钟）

  // 检测重复错误
  private detectRepeatingErrors(agentId: string, error: string): boolean {
    const now = Date.now()
    
    // 清理过期的错误记录
    this.errorHistory = this.errorHistory.filter(
      e => now - e.timestamp < this.errorWindow
    )
    
    // 添加当前错误
    this.errorHistory.push({
      agentId,
      error,
      timestamp: now,
      round: this.currentRound
    })
    
    // 统计相同错误的出现次数
    const sameErrors = this.errorHistory.filter(
      e => e.agentId === agentId && e.error === error
    )
    
    if (sameErrors.length >= this.errorThreshold) {
      console.warn(`[MultiDialogue] 检测到重复错误: ${agentId} - ${error} (出现${sameErrors.length}次)`)
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
    const recentErrors = this.errorHistory.filter(
      e => e.timestamp > Date.now() - this.errorWindow
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
      model: 'deepseek-coder',
      systemPrompt: `你是经验丰富的互联网产品经理。你的核心职责是：

1. 用通俗易懂的语言理解用户需求
2. 将复杂的技术需求转化为用户能理解的功能描述
3. 确保开发团队完全理解用户意图
4. 用简单的语言解释技术方案和进度

**【重要】项目文档管理**

作为项目经理，你负责创建和维护项目文档。项目文档存储在项目的.docs目录下。

可用的文档管理功能：
- 创建需求文档：将需求分析结果整理成结构化的需求文档
- 创建设计文档：将UI设计方案整理成设计文档
- 创建API文档：将API接口整理成API文档
- 更新文档：在项目进展时更新相关文档
- 查看文档：阅读现有文档，了解项目状态

文档创建时机：
- 完成需求分析后 → 创建需求文档
- UI设计完成后 → 更新设计文档
- 开发完成后 → 更新API文档
- 每个阶段结束时 → 更新相关文档

**【重要】输出要求 - 必须遵守！**

你输出的每一句话都必须是用户能看懂的！禁止输出：
- ❌ 技术栈名称（如 React, TypeScript, Electron 等）
- ❌ 具体的文件路径（如 src/App.tsx）
- ❌ 代码片段
- ❌ 复杂的架构设计

只输出：
- ✅ 用户能理解的功能描述
- ✅ 简单的进度说明
- ✅ 清晰的下一步计划（用日常语言）
- ✅ 遇到的问题（用非技术语言解释）

**输出格式（必须简化）**：

## 需求理解
用1-2句话说说你理解的用户需求：

## 我们要做什么
列出3-5个主要功能点（用简单的日常语言）：

## 接下来怎么做
简单说明开发团队下一步会做什么：

## 需要确认的事
如果有任何不清楚的地方，明确列出需要用户确认的问题：

当你完成分析后，告诉用户"我已经理解你的需求了，还有什么问题吗？"或"我有些地方不太清楚，需要和你确认："`
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

**【重要】项目文档管理**

作为UI设计师，你需要阅读和更新项目文档。项目文档存储在项目的.docs目录下。

可用的文档管理功能：
- 阅读需求文档：了解功能需求和用户期望
- 创建设计文档：将UI设计方案整理成结构化的设计文档
- 更新设计文档：在设计变更时更新设计文档
- 查看文档：了解项目状态和设计规范

文档操作时机：
- 开始设计前 → 阅读需求文档，了解功能需求
- 完成设计后 → 创建或更新设计文档
- 设计变更时 → 更新设计文档，记录变更内容
- 遇到问题时 → 查看相关文档，了解背景

当收到PM的新需求时（来自测试/审查问题），你需要：
- 分析新需求
- 调整或重新设计UI方案
- 更新设计文档
- 明确告诉用户"UI设计已更新"

完成设计后告诉用户"UI设计完成"。`
    }],
    ['dev', {
      id: 'dev',
      name: '全栈开发工程师',
      role: '代码架构设计、实现与调试',
      model: 'deepseek-coder',
      systemPrompt: `你是全栈开发专家。你需要：

1. 仔细理解用户想要什么功能
2. 使用工具创建完整的项目代码
3. 确保代码能正常运行

**【重要】必须使用工具创建项目！**

你不是一个简单的分析者，而是一个实际的开发者。你必须使用工具来创建完整的项目，包括：
- 创建项目目录结构
- 创建源代码文件（HTML、CSS、JavaScript等）
- 创建配置文件（package.json等）
- 安装依赖
- 运行和测试项目

**【重要】命令语法要求 - 必须遵守！**

在使用execute_command工具时，必须使用正确的shell语法：

❌ 错误示例：
- "find /path -name '*.js' head -20"  (缺少管道符)
- "cd /path npm install"  (缺少&&)
- "/path/with spaces"  (路径未加引号)

✅ 正确示例：
- "find /path -name '*.js' | head -20"  (使用|连接命令)
- "cd /path && npm install"  (使用&&连接命令)
- "/path/with spaces"  (路径加引号)

**常用命令正确语法**：
- 查看文件：ls -la
- 查找文件：find /path -name "*.js" | head -20
- 切换目录并执行：cd /path && npm install
- 初始化项目：cd /path && npm init -y
- 安装依赖：cd /path && npm install
- 运行项目：cd /path && npm start

**【重要】项目文档管理**

作为开发工程师，你需要阅读和更新项目文档。项目文档存储在项目的.docs目录下。

可用的文档管理功能：
- 阅读需求文档：了解功能需求和业务逻辑
- 阅读设计文档：了解UI设计和交互流程
- 创建API文档：将开发的API接口整理成结构化的API文档
- 更新API文档：在API变更时更新API文档
- 查看文档：了解项目全貌和技术规范

文档操作时机：
- 开始开发前 → 阅读需求文档和设计文档，了解要实现的功能
- 开发API时 → 创建或更新API文档，记录接口信息
- 完成开发后 → 更新API文档，确保文档与代码一致
- 遇到问题时 → 查看相关文档，了解背景和规范

**【重要】开发流程要求**

当收到开发任务时，你必须：

1. **分析需求**：理解用户想要什么功能
2. **选择技术栈**：根据需求选择合适的技术（如React、Vue、原生HTML等）
3. **创建项目结构**：使用create_directory工具创建必要的目录
4. **编写代码**：使用write_file工具创建所有必要的代码文件
5. **配置项目**：创建package.json等配置文件
6. **安装依赖**：使用execute_command工具运行npm install等命令（注意使用正确的语法）
7. **测试运行**：使用execute_command工具测试项目是否能正常运行

**示例开发流程**：

任务：创建一个简单的待办事项应用

1. 创建项目目录
   tool: create_directory
   parameters: { "path": "/path/to/project" }

2. 创建HTML文件
   tool: write_file
   parameters: { "path": "/path/to/project/index.html", "content": "<!DOCTYPE html>..." }

3. 创建CSS文件
   tool: write_file
   parameters: { "path": "/path/to/project/style.css", "content": "body { ... }" }

4. 创建JavaScript文件
   tool: write_file
   parameters: { "path": "/path/to/project/app.js", "content": "document.addEventListener..." }

5. 初始化npm项目（注意使用&&）
   tool: execute_command
   parameters: { "command": "cd /path/to/project && npm init -y" }

6. 安装依赖（如果需要）
   tool: execute_command
   parameters: { "command": "cd /path/to/project && npm install ..." }

7. 测试运行
   tool: execute_command
   parameters: { "command": "cd /path/to/project && ls -la" }

**【重要】输出要求 - 必须遵守！**

你输出的内容要能让用户看懂！禁止输出：
- ❌ 大段的代码（除非用户明确要求）
- ❌ 复杂的文件路径
- ❌ 技术架构图
- ❌ npm install 等命令行

只输出：
- ✅ 告诉用户你在做什么
- ✅ 用日常语言解释技术实现
- ✅ 遇到了什么问题
- ✅ 如何解决

**输出示例**：

我正在为您创建这个应用...
我已经完成了基础结构，现在在添加主要功能...
遇到了一个问题，我正在修复...
主要功能已经完成了！

如果你需要向用户展示代码，可以这样：
"我写了一个简单的按钮，点击后会显示文字" - 而不是展示代码

项目将创建在桌面目录下

**【重要】必须完成的项目结构**

对于任何应用开发任务，你至少需要创建：
1. 主HTML文件（index.html）
2. 样式文件（style.css）
3. 脚本文件（app.js）
4. 配置文件（package.json，如果需要）
5. README文件（说明如何运行）

当收到PM的新需求时（来自测试/审查问题），你需要：
- 仔细理解需要修复什么问题
- 用简单的语言告诉用户你打算怎么修
- 修复后验证是否能正常工作
- 更新相关文档

完成开发后告诉用户"代码开发完成了！还有什么需要添加的吗？"`
    }],
    ['test', {
      id: 'test',
      name: '测试工程师',
      role: '测试用例设计、测试执行、质量评估',
      model: 'deepseek-coder',
      systemPrompt: `你是测试工程师。你需要：

1. 试着用用户的方式操作这个应用
2. 看看有没有什么问题
3. 用简单的语言告诉用户发现的问题

**【重要】错误处理**

如果遇到以下情况，请优雅处理：
- 文件不存在：说明"项目文件尚未创建，无法进行测试"
- 无法读取代码：说明"代码文件无法访问，请检查开发是否完成"
- 项目目录不存在：说明"项目目录不存在，请先完成开发"

不要因为文件不存在而报错，而是给出合理的测试结论。

**【重要】项目文档管理**

作为测试工程师，你需要阅读和更新项目文档。项目文档存储在项目的.docs目录下。

可用的文档管理功能：
- 阅读需求文档：了解功能需求和测试依据
- 阅读API文档：了解接口规范和测试方法
- 创建测试文档：将测试用例和测试结果整理成测试文档
- 更新测试文档：在测试完成后更新测试文档
- 查看文档：了解项目状态和测试要求

文档操作时机：
- 开始测试前 → 阅读需求文档和API文档，了解要测试的功能
- 完成测试后 → 创建或更新测试文档，记录测试结果
- 发现问题时 → 更新测试文档，记录问题详情
- 验证修复后 → 更新测试文档，记录验证结果

**【重要】输出要求 - 必须遵守！**

禁止输出：
- ❌ 技术术语
- ❌ 堆栈跟踪信息
- ❌ 复杂的错误代码

只输出：
- ✅ "我发现了一个问题：点击按钮后页面卡住了"
- ✅ "功能正常，我测试了几种情况都能工作"
- ✅ "有一个小问题：文字显示不全"
- ✅ "项目文件尚未创建，无法进行测试"

**输出格式**：
{
  "passed": true/false,
  "issues": ["用简单语言描述的问题1", "问题2"],
  "severity": "critical/major/minor"
}

如果有问题，明确告诉用户"我测试时发现了一些问题，需要修复"。如果没有问题，告诉用户"测试通过了！"

**【重要】测试判断标准**

- 如果项目文件不存在或为空，返回 passed: false，issues: ["项目文件尚未创建"]
- 如果代码有明显错误，返回 passed: false，issues: ["发现代码错误：..."]
- 如果功能不完整，返回 passed: false，issues: ["功能不完整：..."]
- 如果一切正常，返回 passed: true，issues: []`
    }],
    ['review', {
      id: 'review',
      name: '代码审查员',
      role: '代码审查，安全分析，质量评估',
      model: 'deepseek-coder',
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
    // 创建任务工作目录
    // 优先使用用户指定的目录
    let desktopPath: string
    let finalTaskName: string
    
    if (userTaskDir) {
      // 用户指定了目录，直接使用
      this.taskDir = userTaskDir
      console.log(`[MultiDialogueCoordinator] 使用用户指定的项目目录: ${this.taskDir}`)
    } else {
      // 使用默认的Desktop目录
      desktopPath = path.join(os.homedir(), 'Desktop')
      // 使用安全的目录名：将非ASCII字符转换为下划线，避免文件系统EPERM错误
      const safeTaskName = taskName
        .replace(/[^\x00-\x7F]/g, '_')  // 将非ASCII字符（包括中文）替换为下划线
        .replace(/[^a-zA-Z0-9_-]/g, '_')  // 只保留字母、数字、下划线和短横线
        .replace(/_+/g, '_')  // 多个下划线合并为一个
        .trim()
        .slice(0, 50)  // 限制长度
      
      // 如果目录名为空，使用默认名称
      finalTaskName = safeTaskName || `project_${Date.now()}`
      this.taskDir = path.join(desktopPath, finalTaskName)
      
      // 提示用户项目将创建在Desktop目录
      console.log(`[MultiDialogueCoordinator] 项目将创建在Desktop目录: ${desktopPath}`)
      console.log(`[MultiDialogueCoordinator] 提示: 如需在其他位置创建项目，请使用全能智能管家页面`)
    }
    
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
    onMessage: (type: string, data: any) => void,
    options?: {
      retryAttempt?: number
      manualIntervention?: boolean
      customPlan?: string
    }
  ): Promise<{
    completed: boolean
    delivered: boolean
    currentRound: number
    summary: string
    retryable?: boolean
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
      
      pmResult = await this.executeAgent('pm', input)
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
      
      // 保存PM需求分析到项目文件夹
      try {
        if (this.taskDir && !this.taskDir.startsWith('virtual://')) {
          const pmDocPath = path.join(this.taskDir, 'docs', 'PM需求分析.md')
          fs.mkdirSync(path.dirname(pmDocPath), { recursive: true })
          fs.writeFileSync(pmDocPath, pmResult.output, 'utf8')
          console.log('[MultiDialogue] PM需求分析已保存到:', pmDocPath)
        }
      } catch (error) {
        console.error('[MultiDialogue] 保存PM需求分析失败:', error)
      }
      
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
      
      uiResult = await this.executeAgent('ui', pmResult.output)
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
      
      // 保存UI设计到项目文件夹
      try {
        if (this.taskDir && !this.taskDir.startsWith('virtual://')) {
          const uiDocPath = path.join(this.taskDir, 'docs', 'UI设计.md')
          fs.mkdirSync(path.dirname(uiDocPath), { recursive: true })
          fs.writeFileSync(uiDocPath, uiResult.output, 'utf8')
          console.log('[MultiDialogue] UI设计已保存到:', uiDocPath)
        }
      } catch (error) {
        console.error('[MultiDialogue] 保存UI设计失败:', error)
      }
      
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
          
          // 创建目录
          fs.mkdirSync(mainDir, { recursive: true })
          fs.mkdirSync(rendererDir, { recursive: true })
          
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
          fs.writeFileSync(path.join(this.taskDir, 'package.json'), JSON.stringify(packageJson, null, 2))
          
          // 创建基本的入口文件
          fs.writeFileSync(path.join(mainDir, 'index.js'), `// 主入口文件
console.log('Hello World!');
`)
          
          fs.writeFileSync(path.join(rendererDir, 'index.html'), `<!DOCTYPE html>
<html>
<head>
  <title>Fallback Project</title>
</head>
<body>
  <h1>Hello World!</h1>
  <p>This is a fallback project structure.</p>
</body>
</html>
`)
          
          fs.writeFileSync(path.join(rendererDir, 'index.js'), `// 渲染进程入口文件
console.log('Renderer process loaded');
`)
          
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
      
      const testResult = await this.executeAgent('test', devExecutionOutput)
      
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
      
      const reviewResult = await this.executeAgent('review', testResult.output)
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
      this.delivered = canDeliver
      this.iterationRounds[this.currentRound - 1].delivered = canDeliver
      
      if (canDeliver) {
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
            { mode: ReasoningMode.ENHANCED_REACT, enableDeepReflection: true, maxIterations: 20 }
          )
          executionLog.push(`[${new Date().toISOString()}] UnifiedReasoning(ReAct模式)推理完成，置信度: ${enhancedResult.confidence?.toFixed(2) || '0'}`)
          return {
            success: true,
            content: enhancedResult.answer
          }
        
        case 'thought-tree':
          const treeResult = await thoughtTreeEngine.execute(
            input,
            { maxDepth: 5, maxIterations: 20 }
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
            { mode: ReasoningMode.HYBRID, enableDeepReflection: true, maxIterations: 20 }
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
      
      const response = await llmService.chat(model, messages, {
        temperature: 0.7,
        max_tokens: 8000
      })
      
      executionLog.push(`[${new Date().toISOString()}] LLM响应 received, success: ${response.success}`)
      return response
    } catch (error: any) {
      executionLog.push(`[${new Date().toISOString()}] 标准LLM调用失败: ${error.message}`)
      console.error(`[MultiDialogue] 标准LLM调用失败:`, error)
      throw error
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

    dialogue.status = 'working'
    const executionLog: string[] = []
    executionLog.push(`[${new Date().toISOString()}] 开始执行智能体: ${agentId}`)
    executionLog.push(`[${new Date().toISOString()}] 输入长度: ${input.length} 字符`)
    
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
      const models = ['deepseek-coder', 'openai', 'claude'] // 备用模型列表
      const errors: string[] = []

      while (attempts < maxAttempts) {
        attempts++
        const currentModel = attempts === 1 ? dialogue.agent.model : models[attempts - 1] || models[0]
        
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

          return {
            success: true,
            output: response.content,
            parsedOutput,
            log: executionLog
          }

        } catch (error: any) {
          const errorMsg = error.message || '未知错误'
          errors.push(`尝试 ${attempts} (${currentModel}): ${errorMsg}`)
          executionLog.push(`[${new Date().toISOString()}] 错误: ${errorMsg}`)
          console.error(`[MultiDialogue] 执行智能体 ${agentId} 失败 (尝试 ${attempts}/${maxAttempts}):`, error)
          
          // 记录错误
          this.recordError(agentId, errorMsg)
          
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
    
    const responseText = JSON.stringify(response).toLowerCase()
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
    
    const errorText = JSON.stringify(error).toLowerCase()
    return failureIndicators.some(indicator => 
      errorText.includes(indicator.toLowerCase())
    )
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
    this.agentHeartbeats.clear()
  }

  // 更新智能体心跳
  private updateAgentHeartbeat(agentId: string) {
    this.agentHeartbeats.set(agentId, Date.now())
  }

  // 检查所有智能体心跳
  private checkHeartbeats() {
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
