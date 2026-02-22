/**
 * 全能智能体管家
 * 集成多模态分析、高级推理、权限管理和跨项目调用能力
 * 对标Mini Max智能体，提供全方位的智能服务
 */

import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { llmService } from '../services/LLMService'
import { 
  unifiedReasoningEngine, 
  ReasoningMode, 
  UnifiedReasoningOptions,
  ReasoningResult 
} from './UnifiedReasoningEngine'
// import { 
//   multimodalReasoningEngine,
//   MultimodalReasoningType,
//   MultimodalReasoningOptions,
//   MultimodalReasoningResult 
// } from '../services/MultimodalReasoningEngine'
import { 
  cognitiveEngine,
  DecisionTrace,
  CognitiveSkill 
} from './CognitiveEngine'
import { 
  enhancedReActEngine,
  EnhancedReflection 
} from './EnhancedReActEngine'
import { 
  thoughtTreeEngine,
  ThoughtTree 
} from './ThoughtTreeEngine'
import { selfCorrectionEngine } from './SelfCorrectionEngine'
import { toolRegistry } from './ToolRegistry'

// ============================================
// 全能智能体管家类型
// ============================================

export enum OmniAgentType {
  GENERAL = 'general',
  CODING = 'coding',
  DESIGN = 'design',
  ANALYSIS = 'analysis',
  MANAGEMENT = 'management',
  CREATIVE = 'creative'
}

// ============================================
// 权限级别
// ============================================

export enum PermissionLevel {
  READ_ONLY = 'read_only',
  EXECUTE = 'execute',
  MODIFY = 'modify',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

// ============================================
// 任务类型
// ============================================

export enum TaskType {
  TEXT_PROCESSING = 'text_processing',
  IMAGE_PROCESSING = 'image_processing',
  CODE_GENERATION = 'code_generation',
  DATA_ANALYSIS = 'data_analysis',
  PROJECT_MANAGEMENT = 'project_management',
  MULTIMODAL_CHAIN = 'multimodal_chain',
  COMPLEX_REASONING = 'complex_reasoning',
  AUTOMATION = 'automation'
}

// ============================================
// 全能智能体管家选项
// ============================================

export interface OmniAgentOptions {
  agentType?: OmniAgentType
  permissionLevel?: PermissionLevel
  enableMultimodal?: boolean
  enableDeepReasoning?: boolean
  enableSelfCorrection?: boolean
  enableProjectContext?: boolean
  projectId?: string
  maxIterations?: number
  timeoutMs?: number
}

// ============================================
// 任务上下文
// ============================================

export interface TaskContext {
  taskId: string
  projectId?: string
  taskType: TaskType
  priority: 'low' | 'medium' | 'high' | 'critical'
  startTime: number
  deadline?: number
  metadata?: Record<string, any>
}

// ============================================
// 全能智能体管家结果
// ============================================

export interface OmniAgentResult {
  success: boolean
  taskId: string
  answer?: string
  reasoning?: string
  multimodalResult?: MultimodalReasoningResult
  reasoningResult?: ReasoningResult
  decisionTrace?: DecisionTrace
  artifacts?: {
    text?: string
    images?: string[]
    code?: string
    files?: Record<string, string>
  }
  statistics?: {
    totalDurationMs: number
    reasoningDurationMs: number
    multimodalDurationMs: number
    toolsUsed: string[]
    permissionsUsed: PermissionLevel[]
  }
  error?: string
}

// ============================================
// 项目上下文
// ============================================

export interface ProjectContext {
  projectId: string
  name: string
  path: string
  type: 'web' | 'mobile' | 'desktop' | 'api' | 'library'
  techStack: string[]
  lastModified: number
  metadata?: Record<string, any>
}

// ============================================
// 权限管理器
// ============================================

class PermissionManager {
  private currentLevel: PermissionLevel = PermissionLevel.SUPER_ADMIN
  private permissionLog: Array<{
    timestamp: number
    level: PermissionLevel
    action: string
    approved: boolean
  }> = []

  setLevel(level: PermissionLevel): void {
    this.currentLevel = level
    this.logPermission(level, 'set_permission_level', true)
  }

  getLevel(): PermissionLevel {
    return this.currentLevel
  }

  hasPermission(requiredLevel: PermissionLevel): boolean {
    const levels = [
      PermissionLevel.READ_ONLY,
      PermissionLevel.EXECUTE,
      PermissionLevel.MODIFY,
      PermissionLevel.ADMIN,
      PermissionLevel.SUPER_ADMIN
    ]
    const currentIdx = levels.indexOf(this.currentLevel)
    const requiredIdx = levels.indexOf(requiredLevel)
    const approved = currentIdx >= requiredIdx
    
    this.logPermission(requiredLevel, 'check_permission', approved)
    return approved
  }

  private logPermission(level: PermissionLevel, action: string, approved: boolean): void {
    this.permissionLog.push({
      timestamp: Date.now(),
      level,
      action,
      approved
    })
    
    if (this.permissionLog.length > 1000) {
      this.permissionLog = this.permissionLog.slice(-1000)
    }
  }

  getPermissionLog(): Array<{
    timestamp: number
    level: PermissionLevel
    action: string
    approved: boolean
  }> {
    return [...this.permissionLog]
  }

  clearLog(): void {
    this.permissionLog = []
  }
}

// ============================================
// 项目上下文管理器
// ============================================

class ProjectContextManager {
  private projects: Map<string, ProjectContext> = new Map()
  private activeProjectId: string | null = null
  private contextFile: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.contextFile = path.join(userDataPath, 'omni_agent_projects.json')
    this.loadProjects()
  }

  private loadProjects(): void {
    try {
      if (fs.existsSync(this.contextFile)) {
        const data = fs.readFileSync(this.contextFile, 'utf8')
        const projects = JSON.parse(data)
        this.projects = new Map(Object.entries(projects))
      }
    } catch (error) {
      console.error('[ProjectContextManager] 加载项目上下文失败:', error)
    }
  }

  private saveProjects(): void {
    try {
      const projects = Object.fromEntries(this.projects)
      fs.writeFileSync(this.contextFile, JSON.stringify(projects, null, 2))
    } catch (error) {
      console.error('[ProjectContextManager] 保存项目上下文失败:', error)
    }
  }

  addProject(project: ProjectContext): void {
    this.projects.set(project.projectId, project)
    this.saveProjects()
  }

  getProject(projectId: string): ProjectContext | undefined {
    return this.projects.get(projectId)
  }

  getAllProjects(): ProjectContext[] {
    return Array.from(this.projects.values())
  }

  setActiveProject(projectId: string): void {
    if (this.projects.has(projectId)) {
      this.activeProjectId = projectId
    }
  }

  getActiveProject(): ProjectContext | undefined {
    if (this.activeProjectId) {
      return this.projects.get(this.activeProjectId)
    }
    return undefined
  }

  updateProject(projectId: string, updates: Partial<ProjectContext>): void {
    const project = this.projects.get(projectId)
    if (project) {
      const updated = { ...project, ...updates, lastModified: Date.now() }
      this.projects.set(projectId, updated)
      this.saveProjects()
    }
  }

  removeProject(projectId: string): void {
    this.projects.delete(projectId)
    if (this.activeProjectId === projectId) {
      this.activeProjectId = null
    }
    this.saveProjects()
  }
}

// ============================================
// 全能智能体管家类
// ============================================

export class OmniAgent extends EventEmitter {
  private agentType: OmniAgentType
  private permissionManager: PermissionManager
  private projectManager: ProjectContextManager
  private currentTaskId: string | null = null
  private taskHistory: Map<string, TaskContext> = new Map()
  private skillCache: Map<string, CognitiveSkill> = new Map()

  constructor(options: OmniAgentOptions = {}) {
    super()
    
    this.agentType = options.agentType || OmniAgentType.GENERAL
    this.permissionManager = new PermissionManager()
    this.projectManager = new ProjectContextManager()
    
    if (options.permissionLevel) {
      this.permissionManager.setLevel(options.permissionLevel)
    }
    
    console.log('[OmniAgent] 全能智能体管家初始化完成', {
      agentType: this.agentType,
      permissionLevel: this.permissionManager.getLevel()
    })
  }

  // ============================================
  // 核心任务执行方法
  // ============================================

  async executeTask(
    instruction: string,
    options: OmniAgentOptions = {}
  ): Promise<OmniAgentResult> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
    const startTime = Date.now()
    
    this.currentTaskId = taskId
    this.emit('task_start', { taskId, instruction, options })
    
    try {
      const taskType = this.classifyTask(instruction)
      const context: TaskContext = {
        taskId,
        projectId: options.projectId,
        taskType,
        priority: this.assessPriority(instruction),
        startTime,
        deadline: options.timeoutMs ? startTime + options.timeoutMs : undefined,
        metadata: options
      }
      
      this.taskHistory.set(taskId, context)
      
      let result: OmniAgentResult
      
      switch (taskType) {
        case TaskType.IMAGE_PROCESSING:
          result = await this.handleMultimodalTask(instruction, context, options)
          break
        case TaskType.MULTIMODAL_CHAIN:
          result = await this.handleMultimodalChainTask(instruction, context, options)
          break
        case TaskType.COMPLEX_REASONING:
          result = await this.handleComplexReasoningTask(instruction, context, options)
          break
        default:
          result = await this.handleGeneralTask(instruction, context, options)
      }
      
      result.taskId = taskId
      result.statistics = {
        totalDurationMs: Date.now() - startTime,
        reasoningDurationMs: result.reasoningResult?.statistics?.totalDurationMs || 0,
        multimodalDurationMs: result.multimodalResult?.metadata?.durationMs || 0,
        toolsUsed: this.extractToolsUsed(result),
        permissionsUsed: [this.permissionManager.getLevel()]
      }
      
      this.emit('task_complete', { taskId, result })
      return result
      
    } catch (error: any) {
      const errorResult: OmniAgentResult = {
        success: false,
        taskId,
        error: error.message || '未知错误',
        statistics: {
          totalDurationMs: Date.now() - startTime,
          reasoningDurationMs: 0,
          multimodalDurationMs: 0,
          toolsUsed: [],
          permissionsUsed: [this.permissionManager.getLevel()]
        }
      }
      
      this.emit('task_error', { taskId, error: error.message })
      return errorResult
    } finally {
      this.currentTaskId = null
    }
  }

  // ============================================
  // 任务分类
  // ============================================

  private classifyTask(instruction: string): TaskType {
    const lowerInstruction = instruction.toLowerCase()
    
    if (lowerInstruction.includes('图片') || lowerInstruction.includes('图像') || 
        lowerInstruction.includes('image') || lowerInstruction.includes('photo')) {
      return TaskType.IMAGE_PROCESSING
    }
    
    if (lowerInstruction.includes('分析') && lowerInstruction.includes('生成') ||
        lowerInstruction.includes('多模态') || lowerInstruction.includes('multimodal')) {
      return TaskType.MULTIMODAL_CHAIN
    }
    
    if (lowerInstruction.includes('推理') || lowerInstruction.includes('判断') ||
        lowerInstruction.includes('复杂') || lowerInstruction.includes('reasoning')) {
      return TaskType.COMPLEX_REASONING
    }
    
    if (lowerInstruction.includes('代码') || lowerInstruction.includes('编程') ||
        lowerInstruction.includes('code') || lowerInstruction.includes('programming')) {
      return TaskType.CODE_GENERATION
    }
    
    return TaskType.TEXT_PROCESSING
  }

  // ============================================
  // 优先级评估
  // ============================================

  private assessPriority(instruction: string): 'low' | 'medium' | 'high' | 'critical' {
    const lowerInstruction = instruction.toLowerCase()
    
    if (lowerInstruction.includes('紧急') || lowerInstruction.includes('立即') ||
        lowerInstruction.includes('urgent') || lowerInstruction.includes('immediate')) {
      return 'critical'
    }
    
    if (lowerInstruction.includes('重要') || lowerInstruction.includes('优先') ||
        lowerInstruction.includes('important') || lowerInstruction.includes('priority')) {
      return 'high'
    }
    
    if (lowerInstruction.length > 200 || instruction.includes('\n')) {
      return 'medium'
    }
    
    return 'low'
  }

  // ============================================
  // 处理多模态任务
  // ============================================

  private async handleMultimodalTask(
    instruction: string,
    context: TaskContext,
    options: OmniAgentOptions
  ): Promise<OmniAgentResult> {
    this.emit('progress', { taskId: context.taskId, stage: 'multimodal_processing', progress: 10 })
    
    // const multimodalOptions: MultimodalReasoningOptions = {
    //   type: MultimodalReasoningType.IMAGE_UNDERSTANDING,
    //   input: {
    //     text: instruction
    //   },
    //   processing: {
    //     enableImageProcessing: true,
    //     enableImageAnalysis: true
    //   }
    // }
    
    // const multimodalResult = await multimodalReasoningEngine.reason(multimodalOptions)
    
    this.emit('progress', { taskId: context.taskId, stage: 'multimodal_processing', progress: 100 })
    
    return {
      success: true,
      taskId: context.taskId,
      answer: '多模态功能暂时禁用（sharp模块加载问题）',
      artifacts: {
        text: '多模态功能暂时禁用（sharp模块加载问题）'
      }
    }
  }

  // ============================================
  // 处理多模态链任务
  // ============================================

  private async handleMultimodalChainTask(
    instruction: string,
    context: TaskContext,
    options: OmniAgentOptions
  ): Promise<OmniAgentResult> {
    this.emit('progress', { taskId: context.taskId, stage: 'multimodal_chain', progress: 10 })
    
    const reasoningOptions: UnifiedReasoningOptions = {
      mode: ReasoningMode.HYBRID,
      enableDeepReflection: true,
      enableSelfConsistency: true,
      maxIterations: options.maxIterations || 20
    }
    
    const reasoningResult = await unifiedReasoningEngine.reason(instruction, reasoningOptions)
    
    this.emit('progress', { taskId: context.taskId, stage: 'multimodal_chain', progress: 100 })
    
    return {
      success: reasoningResult.success,
      taskId: context.taskId,
      answer: reasoningResult.answer,
      reasoningResult,
      reasoning: reasoningResult.reasoning,
      artifacts: {
        text: reasoningResult.answer
      }
    }
  }

  // ============================================
  // 处理复杂推理任务
  // ============================================

  private async handleComplexReasoningTask(
    instruction: string,
    context: TaskContext,
    options: OmniAgentOptions
  ): Promise<OmniAgentResult> {
    this.emit('progress', { taskId: context.taskId, stage: 'complex_reasoning', progress: 10 })
    
    const reasoningOptions: UnifiedReasoningOptions = {
      mode: ReasoningMode.ENHANCED_REACT,
      enableDeepReflection: true,
      maxIterations: options.maxIterations || 20
    }
    
    const reasoningResult = await unifiedReasoningEngine.reason(instruction, reasoningOptions)
    
    if (options.enableSelfCorrection !== false && !reasoningResult.success) {
      this.emit('progress', { taskId: context.taskId, stage: 'self_correction', progress: 50 })
      
      const correctionResult = await selfCorrectionEngine.correct(
        new Error(reasoningResult.answer || 'Unknown error'),
        'complex_reasoning_task',
        { instruction, reasoning: reasoningResult.reasoning },
        { taskId: context.taskId }
      )
      
      return {
        success: correctionResult.success,
        taskId: context.taskId,
        answer: correctionResult.action || reasoningResult.answer,
        reasoningResult,
        reasoning: correctionResult.explanation,
        artifacts: {
          text: correctionResult.action || reasoningResult.answer
        }
      }
    }
    
    this.emit('progress', { taskId: context.taskId, stage: 'complex_reasoning', progress: 100 })
    
    return {
      success: reasoningResult.success,
      taskId: context.taskId,
      answer: reasoningResult.answer,
      reasoningResult,
      reasoning: reasoningResult.reasoning,
      artifacts: {
        text: reasoningResult.answer
      }
    }
  }

  // ============================================
  // 处理通用任务
  // ============================================

  private async handleGeneralTask(
    instruction: string,
    context: TaskContext,
    options: OmniAgentOptions
  ): Promise<OmniAgentResult> {
    this.emit('progress', { taskId: context.taskId, stage: 'general_processing', progress: 10 })
    
    const reasoningOptions: UnifiedReasoningOptions = {
      mode: ReasoningMode.REACT,
      enableDeepReflection: options.enableDeepReasoning !== false,
      maxIterations: options.maxIterations || 10
    }
    
    const reasoningResult = await unifiedReasoningEngine.reason(instruction, reasoningOptions)
    
    this.emit('progress', { taskId: context.taskId, stage: 'general_processing', progress: 100 })
    
    return {
      success: reasoningResult.success,
      taskId: context.taskId,
      answer: reasoningResult.answer,
      reasoningResult,
      reasoning: reasoningResult.reasoning,
      artifacts: {
        text: reasoningResult.answer
      }
    }
  }

  // ============================================
  // 提取使用的工具
  // ============================================

  private extractToolsUsed(result: OmniAgentResult): string[] {
    const tools: string[] = []
    
    if (result.reasoningResult?.trace?.steps) {
      for (const step of result.reasoningResult.trace.steps) {
        if (step.action && !tools.includes(step.action)) {
          tools.push(step.action)
        }
      }
    }
    
    return tools
  }

  // ============================================
  // 项目管理方法
  // ============================================

  async switchProject(projectId: string): Promise<boolean> {
    const project = this.projectManager.getProject(projectId)
    if (project) {
      this.projectManager.setActiveProject(projectId)
      this.emit('project_switched', { projectId, project })
      return true
    }
    return false
  }

  getProject(projectId: string): ProjectContext | undefined {
    return this.projectManager.getProject(projectId)
  }

  getActiveProject(): ProjectContext | undefined {
    return this.projectManager.getActiveProject()
  }

  getAllProjects(): ProjectContext[] {
    return this.projectManager.getAllProjects()
  }

  async addProject(project: Omit<ProjectContext, 'lastModified'>): Promise<void> {
    const newProject: ProjectContext = {
      ...project,
      lastModified: Date.now()
    }
    this.projectManager.addProject(newProject)
    this.emit('project_added', { project: newProject })
  }

  async removeProject(projectId: string): Promise<void> {
    this.projectManager.removeProject(projectId)
    this.emit('project_removed', { projectId })
  }

  // ============================================
  // 权限管理方法
  // ============================================

  setPermissionLevel(level: PermissionLevel): void {
    this.permissionManager.setLevel(level)
    this.emit('permission_changed', { level })
  }

  getPermissionLevel(): PermissionLevel {
    return this.permissionManager.getLevel()
  }

  hasPermission(requiredLevel: PermissionLevel): boolean {
    return this.permissionManager.hasPermission(requiredLevel)
  }

  getPermissionLog(): Array<{
    timestamp: number
    level: PermissionLevel
    action: string
    approved: boolean
  }> {
    return this.permissionManager.getPermissionLog()
  }

  // ============================================
  // 任务历史管理
  // ============================================

  getTaskHistory(): TaskContext[] {
    return Array.from(this.taskHistory.values())
  }

  getTask(taskId: string): TaskContext | undefined {
    return this.taskHistory.get(taskId)
  }

  clearTaskHistory(): void {
    this.taskHistory.clear()
  }

  // ============================================
  // 状态查询
  // ============================================

  isBusy(): boolean {
    return this.currentTaskId !== null
  }

  getCurrentTaskId(): string | null {
    return this.currentTaskId
  }

  getAgentType(): OmniAgentType {
    return this.agentType
  }

  // ============================================
  // 健康检查
  // ============================================

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    components: {
      reasoning: boolean
      multimodal: boolean
      cognitive: boolean
      tools: boolean
      permissions: boolean
      projects: boolean
    }
  }> {
    const components = {
      reasoning: true,
      multimodal: true,
      cognitive: true,
      tools: true,
      permissions: true,
      projects: true
    }
    
    let unhealthyCount = 0
    
    try {
      await unifiedReasoningEngine.reason('test', { mode: ReasoningMode.REACT })
    } catch (error) {
      components.reasoning = false
      unhealthyCount++
    }
    
    // try {
    //   await multimodalReasoningEngine.reason({ type: MultimodalReasoningType.IMAGE_UNDERSTANDING })
    // } catch (error) {
    //   components.multimodal = false
    //   unhealthyCount++
    // }
    
    components.multimodal = false
    
    if (unhealthyCount === 0) {
      return { status: 'healthy', components }
    } else if (unhealthyCount < 3) {
      return { status: 'degraded', components }
    } else {
      return { status: 'unhealthy', components }
    }
  }
}

// ============================================
// 全局全能智能体管家实例
// ============================================

export const omniAgent = new OmniAgent({
  agentType: OmniAgentType.GENERAL,
  permissionLevel: PermissionLevel.SUPER_ADMIN,
  enableMultimodal: false,
  enableDeepReasoning: true,
  enableSelfCorrection: true,
  enableProjectContext: true
})