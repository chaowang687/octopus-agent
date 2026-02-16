/**
 * 情绪机制核心类型定义
 * 基于6维情绪向量 + 双记忆架构
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

// ============================================
// 6维情绪向量
// ============================================

export interface EmotionVector {
  /** 愉悦度 (Pleasure): 正面/负面程度 [-1, 1] */
  pleasure: number
  /** 唤醒度 (Arousal): 情绪强烈程度 [0, 1] */
  arousal: number
  /** 紧迫度 (Urgency): 时间压力 [0, 1] */
  urgency: number
  /** 熟悉度 (Familiarity): 与历史任务的相似度 [0, 1] */
  familiarity: number
  /** 风险度 (Risk): 任务潜在风险 [0, 1] */
  risk: number
  /** 不确定性 (Uncertainty): 用户表达模糊程度 [0, 1] */
  uncertainty: number
}

// 默认情绪向量
export const DEFAULT_EMOTION: EmotionVector = {
  pleasure: 0,
  arousal: 0.5,
  urgency: 0,
  familiarity: 0,
  risk: 0,
  uncertainty: 0
}

// ============================================
// 直觉规则 (Intuition Rule)
// System 1 的快速触发机制
// ============================================

export interface IntuitionRule {
  /** 规则ID */
  id: string
  /** 规则名称 */
  name: string
  /** 触发特征向量（聚类中心） */
  triggerEmbedding: number[]
  /** 关联的技能ID */
  linkedSkillId: string
  /** 基础置信度 */
  baseConfidence: number
  /** 触发所需的情绪阈值 */
  requiredMood?: Partial<EmotionVector>
  /** 情绪条件：仅在满足条件时触发 */
  emotionConditions?: {
    maxRisk?: number      // 最大风险度
    maxUncertainty?: number // 最大不确定度
    minFamiliarity?: number // 最小熟悉度
  }
  /** 统计信息 */
  statistics: {
    triggerCount: number
    successCount: number
    avgDurationMs: number
    lastTriggeredAt?: number
    createdAt: number
  }
}

// ============================================
// 记忆条目（支持双记忆）
// ============================================

export interface MemoryEntry {
  /** 记忆ID */
  id: string
  /** 记忆内容 */
  content: string
  /** 向量表示 */
  embedding: number[]
  /** 理性记忆：场景-技能映射 */
  skillMapping?: {
    skillId: string
    params: Record<string, any>
  }
  /** 情绪记忆：当时的情绪快照 */
  emotionSnapshot: EmotionVector
  /** 关联结果 */
  outcome: 'success' | 'failure' | 'partial'
  /** 时间戳 */
  timestamp: number
  /** 衰减因子（越老越低） */
  decayFactor: number
}

// ============================================
// 决策上下文（扩展）
// ============================================

export interface DecisionContext {
  /** 原始输入 */
  rawInput: string
  /** 输入嵌入 */
  inputEmbedding: number[]
  /** 当前情绪状态 */
  currentEmotion: EmotionVector
  /** 情绪变化轨迹 */
  emotionTrend: EmotionVector[]
  /** 环境状态 */
  environmentState?: Record<string, any>
  /** 对话历史 */
  dialogueHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}

// ============================================
// 路由决策（扩展）
// ============================================

export interface EmotionRoutingDecision {
  /** 决策ID */
  decisionId: string
  /** 选择的系统 */
  selectedSystem: 'system1' | 'system2'
  /** 置信度 */
  confidence: number
  /** 动态阈值 */
  dynamicThreshold: number
  /** 情绪向量 */
  emotion: EmotionVector
  /** 决策原因 */
  reason: string
  /** 匹配的直觉规则 */
  matchedIntuition?: IntuitionRule
  /** 匹配的技能 */
  matchedSkills?: {
    skill: CognitiveSkill
    matchScore: number
  }[]
  /** 是否有冲突 */
  hasConflict: boolean
  /** 冲突原因 */
  conflictReason?: string
  /** 决策耗时 */
  durationMs: number
}

// ============================================
// 情感特征提取器
// ============================================

export class EmotionProcessor {
  private dataPath: string
  
  // 紧迫度关键词
  private urgencyKeywords = [
    '赶紧', '立即', '马上', '立刻', '快', '急', ' deadline', 'asap',
    '尽快', '抓紧', '火速', '十万火急', '限时'
  ]
  
  // 风险操作关键词
  private riskKeywords = [
    '删除', '卸载', '格式化', '重装', '清除', '删除文件',
    'rm -rf', 'drop database', 'truncate', '删除数据', '危险'
  ]

  // 简单任务模式
  private simpleTaskPatterns = [
    /^(打开|关闭|播放|暂停|搜索|查询)/,
    /^(帮?我)?打开.+网页/,
    /^(帮?我)?播放.+视频/,
    /^(今天|现在).+(天气|时间)/
  ]

  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'cognitive', 'emotion')
    this.ensureDirectories()
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true })
    }
  }

  /**
   * 从用户输入提取情绪向量
   */
  extractEmotionVector(
    input: string,
    context?: {
      dialogueHistory?: string[]
      environmentState?: Record<string, any>
      previousEmotion?: EmotionVector
    }
  ): EmotionVector {
    const lower = input.toLowerCase()
    
    // 1. 愉悦度 - 基于任务类型和表达方式
    let pleasure = this.calculatePleasure(input)
    
    // 2. 唤醒度 - 基于文本强度和标点
    let arousal = this.calculateArousal(input)
    
    // 3. 紧迫度 - 关键词检测
    let urgency = this.calculateUrgency(input, lower)
    
    // 4. 熟悉度 - 需要上下文
    let familiarity = this.calculateFamiliarity(input, context?.dialogueHistory)
    
    // 5. 风险度 - 关键词和操作检测
    let risk = this.calculateRisk(input, lower, context?.environmentState)
    
    // 6. 不确定性 - 模糊表达检测
    let uncertainty = this.calculateUncertainty(input, lower)
    
    // 如果有前一个情绪状态，应用情绪惯性
    if (context?.previousEmotion) {
      const inertia = 0.3 // 情绪惯性系数
      pleasure = inertia * context.previousEmotion.pleasure + (1 - inertia) * pleasure
      arousal = inertia * context.previousEmotion.arousal + (1 - inertia) * arousal
      urgency = inertia * context.previousEmotion.urgency + (1 - inertia) * urgency
      familiarity = inertia * context.previousEmotion.familiarity + (1 - inertia) * familiarity
      risk = inertia * context.previousEmotion.risk + (1 - inertia) * risk
      uncertainty = inertia * context.previousEmotion.uncertainty + (1 - inertia) * uncertainty
    }

    return {
      pleasure: Math.max(-1, Math.min(1, pleasure)),
      arousal: Math.max(0, Math.min(1, arousal)),
      urgency: Math.max(0, Math.min(1, urgency)),
      familiarity: Math.max(0, Math.min(1, familiarity)),
      risk: Math.max(0, Math.min(1, risk)),
      uncertainty: Math.max(0, Math.min(1, uncertainty))
    }
  }

  private calculatePleasure(input: string): number {
    // 正面表达增加愉悦度
    const positiveWords = ['好', '棒', '优秀', '完美', '喜欢', '感谢', '谢谢', 'good', 'great', 'thanks']
    const negativeWords = ['差', '烂', '糟糕', '问题', 'bug', '错误', '失败', 'bad', 'wrong', 'error']
    
    let score = 0
    for (const word of positiveWords) {
      if (input.includes(word)) score += 0.2
    }
    for (const word of negativeWords) {
      if (input.includes(word)) score -= 0.2
    }
    
    return score
  }

  private calculateArousal(input: string): number {
    let score = 0.3 // 基础唤醒度
    
    // 感叹号增加唤醒度
    const exclamationCount = (input.match(/!/g) || []).length
    score += Math.min(0.3, exclamationCount * 0.1)
    
    // 问号表示有疑问
    if (input.includes('?')) score += 0.1
    
    // 长度适中时唤醒度较高
    if (input.length > 10 && input.length < 100) score += 0.1
    
    // 多步骤任务唤醒度更高
    if (/然后|接着|再|并且/.test(input)) score += 0.2
    
    return Math.min(1, score)
  }

  private calculateUrgency(input: string, lower: string): number {
    let score = 0
    
    for (const keyword of this.urgencyKeywords) {
      if (lower.includes(keyword.toLowerCase())) {
        score += 0.25
      }
    }
    
    // 重复字符表示急切（!!!）
    if (/!{2,}/.test(input)) score += 0.3
    
    return Math.min(1, score)
  }

  private calculateFamiliarity(input: string, history?: string[]): number {
    if (!history || history.length === 0) return 0
    
    let maxSimilarity = 0
    for (const pastInput of history.slice(-5)) {
      const similarity = this.calculateTextSimilarity(input, pastInput)
      maxSimilarity = Math.max(maxSimilarity, similarity)
    }
    
    return maxSimilarity
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    
    return union.size > 0 ? intersection.size / union.size : 0
  }

  private calculateRisk(input: string, lower: string, envState?: Record<string, any>): number {
    let score = 0
    
    // 风险关键词
    for (const keyword of this.riskKeywords) {
      if (lower.includes(keyword.toLowerCase())) {
        score += 0.3
      }
    }
    
    // 涉及文件操作增加风险
    if (/删除|修改|重写|覆盖/.test(input)) score += 0.2
    
    // 如果环境状态显示是关键系统，风险更高
    if (envState?.isProduction) score += 0.3
    if (envState?.hasUnsavedChanges) score += 0.2
    
    return Math.min(1, score)
  }

  private calculateUncertainty(input: string, lower: string): number {
    let score = 0.2 // 基础不确定度
    
    // 模糊表达
    const uncertainWords = ['可能', '大概', '也许', '差不多', '随便', '都可以', 'maybe', 'probably', 'perhaps']
    for (const word of uncertainWords) {
      if (lower.includes(word)) score += 0.2
    }
    
    // 问句表示不确定
    if (input.includes('?')) score += 0.2
    if (/如何|怎么|怎么办/.test(input)) score += 0.1
    
    // 缺少具体信息
    if (!/\d+/.test(input) && /\d/.test(input)) score += 0.1 // 有数字但不确定
    
    return Math.min(1, score)
  }

  /**
   * 计算动态置信度阈值
   * 风险越高，阈值越高；紧迫度越高，阈值可适当降低
   */
  calculateDynamicThreshold(emotion: EmotionVector, baseThreshold: number = 0.7): number {
    // 风险因子：风险越高，需要越高的置信度才敢走System1
    const riskFactor = emotion.risk * 0.3
    
    // 不确定性因子：不确定性越高，越需要谨慎
    const uncertaintyFactor = emotion.uncertainty * 0.2
    
    // 紧迫度因子：越紧迫，可以接受较低的阈值快速行动
    const urgencyFactor = -emotion.urgency * 0.1
    
    // 熟悉度因子：越熟悉，阈值可以降低
    const familiarityFactor = -emotion.familiarity * 0.15
    
    return Math.max(0.5, Math.min(0.95, 
      baseThreshold + riskFactor + uncertaintyFactor + urgencyFactor + familiarityFactor
    ))
  }

  /**
   * 检测是否触发冲突（需要强制转System2）
   */
  detectConflict(emotion: EmotionVector, action?: { type: string; target?: string }): { hasConflict: boolean; reason?: string } {
    // 高风险 + 敏感操作 = 冲突
    if (emotion.risk > 0.8 && action) {
      if (['delete', 'remove', 'drop', 'format'].some(k => action.type?.includes(k))) {
        return {
          hasConflict: true,
          reason: `高风险操作(${action.type})需要人工确认`
        }
      }
    }
    
    // 极高不确定度时谨慎
    if (emotion.uncertainty > 0.9) {
      return {
        hasConflict: true,
        reason: '用户意图不明确，需要深入理解'
      }
    }
    
    // 愉悦度极低 + 风险操作
    if (emotion.pleasure < -0.7 && emotion.risk > 0.5) {
      return {
        hasConflict: true,
        reason: '用户情绪负面且任务有风险，需谨慎处理'
      }
    }
    
    return { hasConflict: false }
  }

  /**
   * 情绪向量转字符串描述（用于日志）
   */
  emotionToString(emotion: EmotionVector): string {
    const parts: string[] = []
    if (emotion.urgency > 0.6) parts.push(`紧迫:${emotion.urgency.toFixed(1)}`)
    if (emotion.risk > 0.6) parts.push(`风险:${emotion.risk.toFixed(1)}`)
    if (emotion.uncertainty > 0.6) parts.push(`不确定:${emotion.uncertainty.toFixed(1)}`)
    if (emotion.familiarity > 0.6) parts.push(`熟悉:${emotion.familiarity.toFixed(1)}`)
    return parts.length > 0 ? parts.join(', ') : '中性'
  }
}

// 导出单例
export const emotionProcessor = new EmotionProcessor()
