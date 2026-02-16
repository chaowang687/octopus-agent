/**
 * 认知架构核心模块
 * 实现 System 1 (快思考) 与 System 2 (慢思考) 的双系统架构
 * 支持情绪驱动的动态决策
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { llmService, LLMMessage } from './LLMService'
import { 
  EmotionVector, 
  EmotionProcessor, 
  emotionProcessor,
  IntuitionRule,
  MemoryEntry,
  EmotionRoutingDecision,
  DEFAULT_EMOTION 
} from './EmotionTypes'

// ============================================
// 决策轨迹 (Decision Trace)
// System 2 推理过程的完整记录
// ============================================

export interface DecisionNode {
  /** 节点ID */
  id: string
  /** 父节点ID */
  parentId: string | null
  /** 决策类型 */
  type: 'task_parse' | 'intent_classify' | 'plan' | 'tool_select' | 'execution' | 'reflection' | 'retry' | 'final'
  /** 当前决策/推理 */
  decision: string
  /** 置信度 [0, 1] */
  confidence: number
  /** 子决策 */
  children: string[]
  /** 执行结果（如果有） */
  executionResult?: any
  /** 元数据 */
  metadata: {
    /** 耗时(ms) */
    durationMs: number
    /** 模型 */
    model?: string
    /** 工具 */
    tool?: string
    /** 是否成功 */
    success?: boolean
    /** 错误信息 */
    error?: string
  }
  /** 时间戳 */
  timestamp: number
}

export interface DecisionTrace {
  /** 轨迹ID */
  id: string
  /** 用户指令 */
  instruction: string
  /** 系统类型 */
  systemType: 'system1' | 'system2'
  /** 根节点 */
  rootNodeId: string
  /** 所有节点 */
  nodes: Record<string, DecisionNode>
  /** 最终结果 */
  finalResult?: any
  /** 是否成功 */
  success: boolean
  /** 总耗时 */
  totalDurationMs: number
  /** 创建时间 */
  createdAt: number
  /** 完成时间 */
  completedAt?: number
  /** 技能使用记录（用于蒸馏） */
  skillUsage?: {
    /** 使用的认知技能ID */
    skillId: string
    /** 匹配度 */
    matchScore: number
    /** 是否成功使用 */
    success: boolean
  }[]
}

// ============================================
// 认知技能 (Cognitive Skill)
// 从 System 2 蒸馏的判断能力
// ============================================

export interface CognitiveSkill {
  /** 技能ID */
  id: string
  /** 技能名称 */
  name: string
  /** 技能描述 */
  description: string
  /** 触发场景模式（正则或关键词） */
  triggerPatterns: string[]
  /** 复杂度阈值 */
  complexityThreshold: number
  /** 置信度阈值 */
  confidenceThreshold: number
  /** 判断逻辑（预编译的决策函数） */
  judgmentLogic?: string
  /** 预期行为 */
  expectedBehavior: {
    /** 建议使用系统 */
    recommendedSystem: 'system1' | 'system2'
    /** 建议工具 */
    recommendedTools?: string[]
    /** 是否需要多步推理 */
    requiresMultiStep: boolean
  }
  /** 统计信息 */
  statistics: {
    /** 使用次数 */
    usageCount: number
    /** 成功次数 */
    successCount: number
    /** 平均执行时间 */
    avgDurationMs: number
    /** 最后使用时间 */
    lastUsedAt?: number
    /** 首次创建时间 */
    createdAt: number
    /** 更新次数 */
    updateCount: number
  }
  /** 训练样本数 */
  trainingSamples: number
  /** 版本 */
  version: number
}

// ============================================
// 路由器配置
// ============================================

export interface RouterConfig {
  /** 置信度阈值 - 高于此值使用 System 1 */
  system1Threshold: number
  /** 置信度阈值 - 低于此值使用 System 2 */
  system2Threshold: number
  /** 之间的区域需要深入分析 */
  ambiguityThreshold: number
  /** 强制使用 System 2 的关键词 */
  forceSystem2Keywords: string[]
  /** 强制使用 System 1 的关键词 */
  forceSystem1Keywords: string[]
  /** 最大缓存决策数 */
  maxCachedDecisions: number
  /** 技能匹配最小分数 */
  minSkillMatchScore: number
}

// ============================================
// 决策结果
// ============================================

export interface RoutingDecision {
  /** 决策ID */
  decisionId: string
  /** 选择的系统 */
  selectedSystem: 'system1' | 'system2'
  /** 置信度 */
  confidence: number
  /** 决策原因 */
  reason: string
  /** 匹配到的技能 */
  matchedSkills?: {
    skill: CognitiveSkill
    matchScore: number
  }[]
  /** 缓存的决策（如果是缓存命中） */
  cached?: boolean
  /** 决策耗时 */
  durationMs: number
}

// ============================================
// 认知引擎核心类
// ============================================

export class CognitiveEngine {
  private dataPath: string
  private tracesPath: string
  private skillsPath: string
  private configPath: string
  
  private skills: Map<string, CognitiveSkill> = new Map()
  private decisionCache: Map<string, RoutingDecision> = new Map()
  
  // 默认配置
  private config: RouterConfig = {
    system1Threshold: 0.85,
    system2Threshold: 0.4,
    ambiguityThreshold: 0.2, // system2Threshold + ambiguityThreshold = 0.6
    forceSystem2Keywords: [
      '分析', '为什么', '如何实现', '解释', '比较', '设计', '架构',
      '优化', 'debug', '调试', '解决', '复杂', '推理', '计算'
    ],
    forceSystem1Keywords: [
      '打开', '关闭', '播放', '暂停', '搜索', '查询', '今天', '天气',
      '时间', '几点', '简单', '快速', '帮我在', '帮我打开'
    ],
    maxCachedDecisions: 500,
    minSkillMatchScore: 0.6
  }

  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'cognitive')
    this.tracesPath = path.join(this.dataPath, 'traces')
    this.skillsPath = path.join(this.dataPath, 'skills.json')
    this.configPath = path.join(this.dataPath, 'config.json')
    
    this.ensureDirectories()
    this.loadSkills()
    this.loadConfig()
  }

  private ensureDirectories(): void {
    try {
      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true })
      }
      if (!fs.existsSync(this.tracesPath)) {
        fs.mkdirSync(this.tracesPath, { recursive: true })
      }
    } catch (error) {
      console.error('创建认知数据目录失败:', error)
    }
  }

  private loadSkills(): void {
    try {
      if (fs.existsSync(this.skillsPath)) {
        const data = JSON.parse(fs.readFileSync(this.skillsPath, 'utf8'))
        for (const skill of data.skills || []) {
          this.skills.set(skill.id, skill)
        }
        console.log(`认知引擎: 加载了 ${this.skills.size} 个认知技能`)
      } else {
        this.initializeDefaultSkills()
      }
    } catch (error) {
      console.error('加载认知技能失败:', error)
      this.initializeDefaultSkills()
    }
  }

  private initializeDefaultSkills(): void {
    // 初始化默认技能
    const defaultSkills: CognitiveSkill[] = [
      {
        id: 'skill_browse_simple',
        name: '简单浏览',
        description: '用户要求打开网页、播放视频、搜索等简单操作',
        triggerPatterns: ['打开.*网页', '播放.*视频', '搜索.*', '访问.*网站', '帮.*打开'],
        complexityThreshold: 0.3,
        confidenceThreshold: 0.7,
        expectedBehavior: {
          recommendedSystem: 'system1',
          requiresMultiStep: false
        },
        statistics: {
          usageCount: 0,
          successCount: 0,
          avgDurationMs: 0,
          createdAt: Date.now(),
          updateCount: 0
        },
        trainingSamples: 0,
        version: 1
      },
      {
        id: 'skill_code_explain',
        name: '代码解释',
        description: '用户要求解释代码、讲解概念',
        triggerPatterns: ['解释.*代码', '这是什么.*代码', '这段代码.*', '讲讲.*', '说明.*'],
        complexityThreshold: 0.4,
        confidenceThreshold: 0.6,
        expectedBehavior: {
          recommendedSystem: 'system1',
          requiresMultiStep: false
        },
        statistics: {
          usageCount: 0,
          successCount: 0,
          avgDurationMs: 0,
          createdAt: Date.now(),
          updateCount: 0
        },
        trainingSamples: 0,
        version: 1
      },
      {
        id: 'skill_complex_task',
        name: '复杂任务',
        description: '需要多步骤执行的复杂任务',
        triggerPatterns: ['.*并且.*然后.*', '先.*再.*', '完成.*任务', '帮我.*一下'],
        complexityThreshold: 0.7,
        confidenceThreshold: 0.5,
        expectedBehavior: {
          recommendedSystem: 'system2',
          requiresMultiStep: true
        },
        statistics: {
          usageCount: 0,
          successCount: 0,
          avgDurationMs: 0,
          createdAt: Date.now(),
          updateCount: 0
        },
        trainingSamples: 0,
        version: 1
      }
    ]

    for (const skill of defaultSkills) {
      this.skills.set(skill.id, skill)
    }
    this.saveSkills()
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
        this.config = { ...this.config, ...data }
      }
    } catch (error) {
      console.error('加载路由器配置失败:', error)
    }
  }

  private saveSkills(): void {
    try {
      fs.writeFileSync(this.skillsPath, JSON.stringify({
        skills: Array.from(this.skills.values()),
        updatedAt: Date.now()
      }, null, 2))
    } catch (error) {
      console.error('保存认知技能失败:', error)
    }
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
    } catch (error) {
      console.error('保存路由器配置失败:', error)
    }
  }

  // ============================================
  // 决策路由方法
  // ============================================

  /**
   * 路由决策 - 决定使用 System 1 还是 System 2
   */
  async route(instruction: string): Promise<RoutingDecision> {
    const startTime = Date.now()
    const decisionId = `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // 1. 检查缓存
    const cacheKey = this.getCacheKey(instruction)
    const cached = this.decisionCache.get(cacheKey)
    if (cached) {
      console.log(`认知引擎: 缓存命中 - ${cached.selectedSystem}`)
      return {
        ...cached,
        decisionId,
        cached: true,
        durationMs: Date.now() - startTime
      }
    }

    // 2. 强制关键词检查
    const forcedSystem = this.checkForceKeywords(instruction)
    if (forcedSystem) {
      const decision: RoutingDecision = {
        decisionId,
        selectedSystem: forcedSystem,
        confidence: 1.0,
        reason: `强制关键词匹配: ${forcedSystem}`,
        durationMs: Date.now() - startTime
      }
      this.cacheDecision(cacheKey, decision)
      return decision
    }

    // 3. 技能匹配
    const skillMatches = await this.matchSkills(instruction)
    
    // 4. 基于多因素计算置信度
    const { confidence, reason, matchedSkills } = await this.calculateConfidence(instruction, skillMatches)

    // 5. 根据阈值做出决策
    let selectedSystem: 'system1' | 'system2'
    if (confidence >= this.config.system1Threshold) {
      selectedSystem = 'system1'
    } else if (confidence <= this.config.system2Threshold) {
      selectedSystem = 'system2'
    } else {
      // 模糊区域，使用系统2更安全
      selectedSystem = 'system2'
    }

    const decision: RoutingDecision = {
      decisionId,
      selectedSystem,
      confidence,
      reason,
      matchedSkills: matchedSkills?.length > 0 ? matchedSkills : undefined,
      durationMs: Date.now() - startTime
    }

    // 6. 缓存决策
    this.cacheDecision(cacheKey, decision)

    console.log(`认知引擎路由: ${selectedSystem} (置信度: ${confidence.toFixed(2)})`)
    return decision
  }

  // ============================================
  // 情绪驱动的路由方法 (Emotion-Driven Routing)
  // ============================================

  /**
   * 情绪驱动的路由决策 - 综合考虑情绪向量
   */
  async routeWithEmotion(
    instruction: string,
    context?: {
      dialogueHistory?: string[]
      environmentState?: Record<string, any>
      previousEmotion?: EmotionVector
    }
  ): Promise<EmotionRoutingDecision> {
    const startTime = Date.now()
    const decisionId = `emotion_dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // 0. 检查是否是继续之前的System2任务（重要：优先检查）
    // 如果用户说"继续"、"下一步"、"执行"等，结合对话历史判断是否应该继续System2
    const continueKeywords = ['继续', '下一步', '执行', '好的', '挺好', '开始', '继续执行', '开始执行']
    const isContinueInstruction = continueKeywords.some(kw => instruction.toLowerCase().includes(kw.toLowerCase()))
    
    if (isContinueInstruction && context?.dialogueHistory && context.dialogueHistory.length > 0) {
      // 检查对话历史中是否有System2任务的痕迹
      const historyText = context.dialogueHistory.join(' ').toLowerCase()
      const system2Indicators = ['需求分析', 'pm', '设计师', '开发', '实现', '任务', '计划', '完成', '阶段']
      const hasSystem2Context = system2Indicators.some(ind => historyText.includes(ind))
      
      if (hasSystem2Context) {
        // 有System2上下文，应该继续使用System2，并设置为中等或高复杂度
        console.log(`[CognitiveEngine] 检测到继续执行指令，继续使用System2`)
        const decision: EmotionRoutingDecision = {
          decisionId,
          selectedSystem: 'system2',
          confidence: 0.95,
          dynamicThreshold: 0.8,
          emotion: emotionProcessor.extractEmotionVector(instruction, context),
          reason: '检测到继续执行System2任务的指令，结合上下文继续使用深度思考',
          matchedSkills: undefined,
          hasConflict: false,
          conflictReason: undefined,
          durationMs: Date.now() - startTime,
          // 强制设置为medium复杂度，以便触发多智能体模式
          complexity: 'medium' as any
        }
        return decision
      }
    }

    // 1. 提取情绪向量
    const emotion = emotionProcessor.extractEmotionVector(instruction, {
      dialogueHistory: context?.dialogueHistory,
      environmentState: context?.environmentState,
      previousEmotion: context?.previousEmotion
    })

    console.log(`情绪向量: ${emotionProcessor.emotionToString(emotion)}`)

    // 2. 计算动态置信度阈值
    const baseThreshold = this.config.system1Threshold
    const dynamicThreshold = emotionProcessor.calculateDynamicThreshold(emotion, baseThreshold)

    // 3. 基础路由决策（使用原有逻辑）
    const baseDecision = await this.route(instruction)

    // 4. 冲突检测
    const conflict = emotionProcessor.detectConflict(emotion)

    // 5. 综合决策
    let selectedSystem: 'system1' | 'system2'
    let finalConfidence = baseDecision.confidence
    let reason = baseDecision.reason

    if (conflict.hasConflict) {
      // 存在冲突，强制转System2
      selectedSystem = 'system2'
      reason = `冲突检测: ${conflict.reason}`
      finalConfidence = 0.1 // 降低置信度
    } else if (finalConfidence >= dynamicThreshold) {
      // 置信度超过动态阈值，使用System1
      selectedSystem = 'system1'
      reason = `置信度(${finalConfidence.toFixed(2)}) >= 动态阈值(${dynamicThreshold.toFixed(2)})`
    } else if (emotion.uncertainty > 0.7) {
      // 高不确定性，使用System2
      selectedSystem = 'system2'
      reason = `高不确定性(${emotion.uncertainty.toFixed(2)})，需要深入理解`
    } else if (emotion.risk > 0.6) {
      // 高风险，使用System2
      selectedSystem = 'system2'
      reason = `高风险(${emotion.risk.toFixed(2)})，需要谨慎处理`
    } else {
      // 默认使用基础决策
      selectedSystem = baseDecision.selectedSystem
    }

    const decision: EmotionRoutingDecision = {
      decisionId,
      selectedSystem,
      confidence: finalConfidence,
      dynamicThreshold,
      emotion,
      reason,
      matchedSkills: baseDecision.matchedSkills,
      hasConflict: conflict.hasConflict,
      conflictReason: conflict.reason,
      durationMs: Date.now() - startTime
    }

    console.log(`情绪路由: ${selectedSystem} (置信度: ${finalConfidence.toFixed(2)}, 阈值: ${dynamicThreshold.toFixed(2)}) - ${reason}`)
    
    return decision
  }

  private getCacheKey(instruction: string): string {
    // 简单的缓存键生成
    const normalized = instruction.toLowerCase().trim()
    return `dec_${normalized.slice(0, 50)}_${normalized.length}`
  }

  private checkForceKeywords(instruction: string): 'system1' | 'system2' | null {
    const lower = instruction.toLowerCase()
    
    // 检查强制 System 2
    for (const keyword of this.config.forceSystem2Keywords) {
      if (lower.includes(keyword)) {
        return 'system2'
      }
    }
    
    // 检查强制 System 1
    for (const keyword of this.config.forceSystem1Keywords) {
      if (lower.includes(keyword)) {
        return 'system1'
      }
    }
    
    return null
  }

  private async matchSkills(instruction: string): Promise<Array<{ skill: CognitiveSkill; matchScore: number }>> {
    const matches: Array<{ skill: CognitiveSkill; matchScore: number }> = []
    const lower = instruction.toLowerCase()

    for (const skill of this.skills.values()) {
      for (const pattern of skill.triggerPatterns) {
        try {
          const regex = new RegExp(pattern, 'i')
          if (regex.test(lower) || regex.test(instruction)) {
            matches.push({
              skill,
              matchScore: skill.confidenceThreshold
            })
            break
          }
        } catch {
          // 正则表达式无效，跳过
        }
      }
    }

    // 按匹配度排序
    return matches.sort((a, b) => b.matchScore - a.matchScore)
  }

  private async calculateConfidence(
    instruction: string,
    skillMatches: Array<{ skill: CognitiveSkill; matchScore: number }>
  ): Promise<{ confidence: number; reason: string; matchedSkills?: Array<{ skill: CognitiveSkill; matchScore: number }> }> {
    
    let confidence = 0.5 // 默认置信度
    let reason = '基于规则和技能匹配计算'

    // 如果有技能匹配，使用技能的平均置信度
    if (skillMatches.length > 0) {
      const avgConfidence = skillMatches.reduce((sum, m) => sum + m.matchScore, 0) / skillMatches.length
      
      // 根据推荐的系统调整置信度
      const recommendedSystem = skillMatches[0].skill.expectedBehavior.recommendedSystem
      if (recommendedSystem === 'system1') {
        confidence = Math.min(0.95, avgConfidence + 0.2)
        reason = `匹配到技能 "${skillMatches[0].skill.name}"，推荐使用快系统`
      } else {
        confidence = Math.max(0.3, avgConfidence - 0.2)
        reason = `匹配到技能 "${skillMatches[0].skill.name}"，推荐使用慢系统`
      }
    } else {
      // 没有技能匹配，使用指令特征分析
      confidence = this.analyzeInstructionComplexity(instruction)
      reason = `基于指令复杂度分析 (${(confidence * 100).toFixed(0)}%)`
    }

    return { confidence, reason, matchedSkills: skillMatches }
  }

  private analyzeInstructionComplexity(instruction: string): number {
    let complexity = 0.5

    // 简单特征分析
    const features = {
      // 复杂度增加因素
      multiStep: /然后|接着|再|并且|还有|同时/.test(instruction),
      conditional: /如果|则|否则|取决于/.test(instruction),
      comparison: /比较|对比|差异|哪个更好/.test(instruction),
      analysis: /分析|为什么|原因/.test(instruction),
      codeRelated: /代码|函数|变量|实现|算法/.test(instruction),
      // 复杂度降低因素
      simple: /打开|关闭|播放|暂停|搜索/.test(instruction),
      singleAction: /^\S+\s+\S+$/.test(instruction),
    }

    if (features.multiStep) complexity += 0.15
    if (features.conditional) complexity += 0.15
    if (features.comparison) complexity += 0.1
    if (features.analysis) complexity += 0.1
    if (features.codeRelated) complexity += 0.1
    if (features.simple) complexity -= 0.2
    if (features.singleAction) complexity -= 0.1

    // 长度因素
    if (instruction.length < 20) complexity -= 0.1
    if (instruction.length > 100) complexity += 0.1

    return Math.max(0.1, Math.min(0.95, complexity))
  }

  private cacheDecision(key: string, decision: RoutingDecision): void {
    // 限制缓存大小
    if (this.decisionCache.size >= this.config.maxCachedDecisions) {
      const firstKey = this.decisionCache.keys().next().value
      if (firstKey) {
        this.decisionCache.delete(firstKey)
      }
    }
    this.decisionCache.set(key, decision)
  }

  // ============================================
  // 决策轨迹管理
  // ============================================

  /**
   * 创建新的决策轨迹
   */
  createTrace(instruction: string, systemType: 'system1' | 'system2'): DecisionTrace {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const rootNodeId = `node_${Date.now()}`

    const trace: DecisionTrace = {
      id: traceId,
      instruction,
      systemType,
      rootNodeId,
      nodes: {},
      success: false,
      totalDurationMs: 0,
      createdAt: Date.now()
    }

    // 创建根节点
    trace.nodes[rootNodeId] = {
      id: rootNodeId,
      parentId: null,
      type: 'task_parse',
      decision: instruction,
      confidence: 1.0,
      children: [],
      metadata: {
        durationMs: 0,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }

    return trace
  }

  /**
   * 添加决策节点
   */
  addNode(trace: DecisionTrace, parentId: string, node: Omit<DecisionNode, 'id' | 'parentId' | 'children'>): DecisionNode {
    const nodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const newNode: DecisionNode = {
      ...node,
      id: nodeId,
      parentId,
      children: []
    }

    // 更新父节点的children
    if (trace.nodes[parentId]) {
      trace.nodes[parentId].children.push(nodeId)
    }

    trace.nodes[nodeId] = newNode
    return newNode
  }

  /**
   * 完成轨迹
   */
  completeTrace(trace: DecisionTrace, result: any, success: boolean): void {
    trace.finalResult = result
    trace.success = success
    trace.completedAt = Date.now()
    
    // 计算总耗时
    trace.totalDurationMs = trace.nodes[Object.keys(trace.nodes)[0]]?.metadata.durationMs || 0
    for (const nodeId of Object.keys(trace.nodes)) {
      trace.totalDurationMs += trace.nodes[nodeId].metadata.durationMs
    }

    // 保存轨迹
    this.saveTrace(trace)
  }

  private saveTrace(trace: DecisionTrace): void {
    try {
      const filePath = path.join(this.tracesPath, `${trace.id}.json`)
      fs.writeFileSync(filePath, JSON.stringify(trace, null, 2))
    } catch (error) {
      console.error('保存决策轨迹失败:', error)
    }
  }

  // ============================================
  // 技能管理
  // ============================================

  /**
   * 获取所有技能
   */
  getAllSkills(): CognitiveSkill[] {
    return Array.from(this.skills.values())
  }

  /**
   * 获取技能
   */
  getSkill(id: string): CognitiveSkill | undefined {
    return this.skills.get(id)
  }

  /**
   * 更新技能统计
   */
  updateSkillStats(skillId: string, success: boolean, durationMs: number): void {
    const skill = this.skills.get(skillId)
    if (!skill) return

    skill.statistics.usageCount++
    if (success) {
      skill.statistics.successCount++
    }

    // 更新平均执行时间
    const total = skill.statistics.avgDurationMs * (skill.statistics.usageCount - 1) + durationMs
    skill.statistics.avgDurationMs = total / skill.statistics.usageCount
    skill.statistics.lastUsedAt = Date.now()

    this.saveSkills()
  }

  /**
   * 创建新技能（从蒸馏学习）
   */
  createSkill(skill: Omit<CognitiveSkill, 'id' | 'statistics' | 'version' | 'trainingSamples'>): CognitiveSkill {
    const newSkill: CognitiveSkill = {
      ...skill,
      id: `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      statistics: {
        usageCount: 0,
        successCount: 0,
        avgDurationMs: 0,
        createdAt: Date.now(),
        updateCount: 0
      },
      trainingSamples: 0,
      version: 1
    }

    this.skills.set(newSkill.id, newSkill)
    this.saveSkills()
    
    console.log(`认知引擎: 创建新技能 "${newSkill.name}"`)
    return newSkill
  }

  /**
   * 更新技能
   */
  updateSkill(skillId: string, updates: Partial<CognitiveSkill>): CognitiveSkill | null {
    const skill = this.skills.get(skillId)
    if (!skill) return null

    const updated = {
      ...skill,
      ...updates,
      id: skill.id, // 保持ID不变
      statistics: {
        ...skill.statistics,
        updateCount: skill.statistics.updateCount + 1
      }
    }

    this.skills.set(skillId, updated)
    this.saveSkills()
    
    return updated
  }

  /**
   * 删除技能
   */
  deleteSkill(skillId: string): boolean {
    const result = this.skills.delete(skillId)
    if (result) {
      this.saveSkills()
    }
    return result
  }

  // ============================================
  // 配置管理
  // ============================================

  /**
   * 获取配置
   */
  getConfig(): RouterConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<RouterConfig>): void {
    this.config = { ...this.config, ...updates }
    this.saveConfig()
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.decisionCache.clear()
    console.log('认知引擎: 决策缓存已清除')
  }

  /**
   * 获取引擎状态
   */
  getStatus(): {
    skillsCount: number
    cacheSize: number
    tracesCount: number
  } {
    let tracesCount = 0
    try {
      const files = fs.readdirSync(this.tracesPath)
      tracesCount = files.filter(f => f.endsWith('.json')).length
    } catch {
      // 忽略错误
    }

    return {
      skillsCount: this.skills.size,
      cacheSize: this.decisionCache.size,
      tracesCount
    }
  }
}

// 导出单例
export const cognitiveEngine = new CognitiveEngine()
