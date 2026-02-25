/**
 * 技能管理器 (SkillManager)
 * 负责技能的分类、检索、评估和注入
 * 支持不同类型智能体（项目经理、UI设计、开发、测试等）的技能调用
 */

import { cognitiveEngine, CognitiveSkill } from './CognitiveEngine'
import type { DistilledSkill } from './OnlineDistiller'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

// ============================================
// 智能体类型定义
// ============================================

export type AgentType = 
  | 'project_manager'    // 项目经理
  | 'ui_designer'       // UI设计师
  | 'frontend_developer' // 前端开发
  | 'backend_developer'  // 后端开发
  | 'fullstack_developer' // 全栈开发
  | 'tester'            // 测试工程师
  | 'devops'            // 运维工程师
  | 'architect'         // 架构师
  | 'analyst'           // 分析师
  | 'general'           // 通用智能体

// ============================================
// 技能分类
// ============================================

export interface SkillCategory {
  id: string
  name: string
  description: string
  agentTypes: AgentType[]
  taskTypes: string[]
  keywords: string[]
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    id: 'project_management',
    name: '项目管理',
    description: '项目管理相关的技能',
    agentTypes: ['project_manager', 'general'],
    taskTypes: ['planning', 'scheduling', 'tracking', 'reporting'],
    keywords: ['项目', '计划', '进度', '里程碑', '风险', '资源', '团队']
  },
  {
    id: 'ui_design',
    name: 'UI设计',
    description: 'UI/UX设计相关的技能',
    agentTypes: ['ui_designer', 'frontend_developer'],
    taskTypes: ['design', 'prototype', 'wireframe', 'mockup'],
    keywords: ['设计', '界面', 'UI', 'UX', '原型', '线框', '配色', '布局']
  },
  {
    id: 'frontend',
    name: '前端开发',
    description: '前端开发相关的技能',
    agentTypes: ['frontend_developer', 'fullstack_developer'],
    taskTypes: ['development', 'implementation', 'styling', 'interaction'],
    keywords: ['React', 'Vue', 'JavaScript', 'TypeScript', 'CSS', 'HTML', '组件', '状态管理']
  },
  {
    id: 'backend',
    name: '后端开发',
    description: '后端开发相关的技能',
    agentTypes: ['backend_developer', 'fullstack_developer'],
    taskTypes: ['development', 'implementation', 'api', 'database'],
    keywords: ['Node.js', 'Python', 'Java', 'API', '数据库', '服务', '微服务', 'REST', 'GraphQL']
  },
  {
    id: 'testing',
    name: '测试',
    description: '测试相关的技能',
    agentTypes: ['tester', 'general'],
    taskTypes: ['testing', 'verification', 'quality'],
    keywords: ['测试', '单元测试', '集成测试', '端到端', '质量', '验证', '自动化测试']
  },
  {
    id: 'devops',
    name: '运维',
    description: 'DevOps相关的技能',
    agentTypes: ['devops', 'general'],
    taskTypes: ['deployment', 'ci_cd', 'monitoring'],
    keywords: ['部署', 'CI/CD', 'Docker', 'Kubernetes', '监控', '日志', '性能']
  },
  {
    id: 'architecture',
    name: '架构',
    description: '系统架构相关的技能',
    agentTypes: ['architect', 'general'],
    taskTypes: ['design', 'architecture', 'planning'],
    keywords: ['架构', '设计', '系统', '模式', '可扩展性', '高可用', '分布式']
  },
  {
    id: 'analysis',
    name: '分析',
    description: '需求分析相关的技能',
    agentTypes: ['analyst', 'project_manager'],
    taskTypes: ['analysis', 'requirements', 'research'],
    keywords: ['分析', '需求', '调研', '评估', '可行性', '用户研究']
  }
]

// ============================================
// 技能匹配结果
// ============================================

export interface SkillMatch {
  skill: CognitiveSkill | DistilledSkill
  matchScore: number
  relevance: 'high' | 'medium' | 'low'
  category?: SkillCategory
  reason: string
}

export interface SkillRetrievalResult {
  agentType: AgentType
  task: string
  matchedSkills: SkillMatch[]
  totalSkills: number
  retrievalTime: number
  timestamp: number
}

// ============================================
// 技能注入配置
// ============================================

export interface SkillInjectionConfig {
  maxSkills: number
  minRelevance: 'high' | 'medium' | 'low'
  includeReasoning: boolean
  includeExamples: boolean
  format: 'markdown' | 'json' | 'prompt'
}

// ============================================
// 技能管理器核心类
// ============================================

export class SkillManager {
  private dataPath: string
  private retrievalHistoryPath: string
  private skillUsageStatsPath: string
  
  private retrievalHistory: SkillRetrievalResult[] = []
  private skillUsageStats: Map<string, { count: number; lastUsed: number; successRate: number }> = new Map()

  constructor() {
    this.dataPath = ''
    this.retrievalHistoryPath = ''
    this.skillUsageStatsPath = ''
  }

  /**
   * 初始化技能管理器
   */
  initialize(): void {
    if (!this.dataPath && app) {
      this.dataPath = path.join(app.getPath('userData'), 'cognitive', 'skill_manager')
      this.retrievalHistoryPath = path.join(this.dataPath, 'retrieval_history.json')
      this.skillUsageStatsPath = path.join(this.dataPath, 'skill_usage_stats.json')
      
      this.ensureDirectories()
      this.loadUsageStats()
    }
  }

  private ensureDirectories(): void {
    try {
      if (!this.dataPath && app) {
        this.dataPath = path.join(app.getPath('userData'), 'cognitive', 'skill_manager')
        this.retrievalHistoryPath = path.join(this.dataPath, 'retrieval_history.json')
        this.skillUsageStatsPath = path.join(this.dataPath, 'skill_usage_stats.json')
      }
      if (this.dataPath) {
        const parentDir = path.dirname(this.dataPath)
        if (!fs.existsSync(parentDir)) {
          try {
            fs.mkdirSync(parentDir, { recursive: true, mode: 0o755 })
          } catch (error) {
            console.warn('SkillManager: 无法创建父目录，将使用内存存储', error)
          }
        }
        if (!fs.existsSync(this.dataPath)) {
          try {
            fs.mkdirSync(this.dataPath, { recursive: true, mode: 0o755 })
          } catch (error) {
            console.warn('SkillManager: 无法创建数据目录，将使用内存存储', error)
          }
        }
        if (this.retrievalHistoryPath && !fs.existsSync(this.retrievalHistoryPath)) {
          try {
            fs.writeFileSync(this.retrievalHistoryPath, JSON.stringify({ history: [] }), { mode: 0o644 })
          } catch (error) {
            console.warn('SkillManager: 无法创建检索历史文件，将使用内存存储', error)
          }
        }
        if (this.skillUsageStatsPath && !fs.existsSync(this.skillUsageStatsPath)) {
          try {
            fs.writeFileSync(this.skillUsageStatsPath, JSON.stringify({ stats: {} }), { mode: 0o644 })
          } catch (error) {
            console.warn('SkillManager: 无法创建使用统计文件，将使用内存存储', error)
          }
        }
      }
    } catch (error) {
      console.warn('SkillManager: 初始化目录失败，将使用内存存储', error)
    }
  }

  private loadUsageStats(): void {
    try {
      if (!this.skillUsageStatsPath) {
        if (app) {
          this.dataPath = path.join(app.getPath('userData'), 'cognitive', 'skill_manager')
          this.skillUsageStatsPath = path.join(this.dataPath, 'skill_usage_stats.json')
        } else {
          return
        }
      }
      if (this.skillUsageStatsPath && fs.existsSync(this.skillUsageStatsPath)) {
        const data = JSON.parse(fs.readFileSync(this.skillUsageStatsPath, 'utf8'))
        const stats = data.stats || {}
        
        for (const [skillId, stat] of Object.entries(stats)) {
          this.skillUsageStats.set(skillId, stat as any)
        }
        
        console.log(`SkillManager: 加载技能使用统计 ${this.skillUsageStats.size} 条`)
      }
    } catch (error) {
      console.error('SkillManager: 加载使用统计失败', error)
    }
  }

  private saveUsageStats(): void {
    try {
      if (!this.skillUsageStatsPath) {
        if (app) {
          this.dataPath = path.join(app.getPath('userData'), 'cognitive', 'skill_manager')
          this.skillUsageStatsPath = path.join(this.dataPath, 'skill_usage_stats.json')
        } else {
          return
        }
      }
      if (this.skillUsageStatsPath) {
        const stats: Record<string, any> = {}
        this.skillUsageStats.forEach((value, key) => {
          stats[key] = value
        })
        
        fs.writeFileSync(this.skillUsageStatsPath, JSON.stringify({ stats }, null, 2))
      }
    } catch (error) {
      console.error('SkillManager: 保存使用统计失败', error)
    }
  }

  // ============================================
  // 技能检索
  // ============================================

  /**
   * 为智能体检索相关技能
   */
  async retrieveSkillsForAgent(
    agentType: AgentType,
    task: string,
    config?: Partial<SkillInjectionConfig>
  ): Promise<SkillRetrievalResult> {
    const startTime = Date.now()
    
    try {
      console.log(`SkillManager: 为 ${agentType} 检索技能 - ${task.slice(0, 50)}...`)
      
      // 1. 确定智能体相关的技能分类
      const relevantCategories = this.getRelevantCategories(agentType)
      
      // 2. 从认知引擎获取所有技能
      const allSkills = cognitiveEngine.getAllSkills()
      
      // 3. 匹配相关技能
      const matchedSkills = await this.matchSkills(
        allSkills,
        task,
        relevantCategories
      )
      
      // 4. 按匹配度排序
      matchedSkills.sort((a, b) => b.matchScore - a.matchScore)
      
      // 5. 应用配置限制
      const finalSkills = this.applyConfigLimits(matchedSkills, config)
      
      const retrievalTime = Date.now() - startTime
      
      // 6. 记录检索历史
      const result: SkillRetrievalResult = {
        agentType,
        task,
        matchedSkills: finalSkills,
        totalSkills: allSkills.length,
        retrievalTime,
        timestamp: Date.now()
      }
      
      this.recordRetrievalHistory(result)
      
      console.log(`SkillManager: 检索完成 - 找到 ${finalSkills.length} 个相关技能，耗时 ${retrievalTime}ms`)
      
      return result
      
    } catch (error: any) {
      console.error('SkillManager: 技能检索失败', error)
      return {
        agentType,
        task,
        matchedSkills: [],
        totalSkills: 0,
        retrievalTime: Date.now() - startTime,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 获取智能体相关的技能分类
   */
  private getRelevantCategories(agentType: AgentType): SkillCategory[] {
    return SKILL_CATEGORIES.filter(category => 
      category.agentTypes.includes(agentType) || category.agentTypes.includes('general')
    )
  }

  /**
   * 匹配技能
   */
  private async matchSkills(
    skills: CognitiveSkill[],
    task: string,
    categories: SkillCategory[]
  ): Promise<SkillMatch[]> {
    const matches: SkillMatch[] = []
    const taskLower = task.toLowerCase()
    
    for (const skill of skills) {
      const match = await this.evaluateSkillMatch(skill, task, taskLower, categories)
      if (match.matchScore > 0) {
        matches.push(match)
      }
    }
    
    return matches
  }

  /**
   * 评估技能匹配度
   */
  private async evaluateSkillMatch(
    skill: CognitiveSkill,
    task: string,
    taskLower: string,
    categories: SkillCategory[]
  ): Promise<SkillMatch> {
    let matchScore = 0
    const reasons: string[] = []
    
    // 1. 检查触发模式匹配
    for (const pattern of skill.triggerPatterns) {
      try {
        const regex = new RegExp(pattern, 'i')
        if (regex.test(task)) {
          matchScore += 0.4
          reasons.push(`触发模式匹配: ${pattern}`)
          break
        }
      } catch {
        // 忽略无效的正则表达式
      }
    }
    
    // 2. 检查关键词匹配
    const skillKeywords = this.extractKeywords(skill.name + ' ' + skill.description)
    const matchedKeywords = skillKeywords.filter(kw => taskLower.includes(kw.toLowerCase()))
    if (matchedKeywords.length > 0) {
      const keywordScore = Math.min(0.3, matchedKeywords.length * 0.1)
      matchScore += keywordScore
      reasons.push(`关键词匹配: ${matchedKeywords.join(', ')}`)
    }
    
    // 3. 检查分类匹配
    const relevantCategory = categories.find(cat => 
      cat.keywords.some(kw => taskLower.includes(kw.toLowerCase()))
    )
    if (relevantCategory) {
      matchScore += 0.2
      reasons.push(`分类匹配: ${relevantCategory.name}`)
    }
    
    // 4. 检查复杂度匹配
    const taskComplexity = this.estimateTaskComplexity(task)
    if (Math.abs(taskComplexity - skill.complexityThreshold) < 0.2) {
      matchScore += 0.1
      reasons.push(`复杂度匹配`)
    }
    
    // 5. 考虑技能使用统计
    const usageStat = this.skillUsageStats.get(skill.id)
    if (usageStat) {
      const successBonus = usageStat.successRate * 0.05
      matchScore += successBonus
      reasons.push(`历史成功率: ${(usageStat.successRate * 100).toFixed(0)}%`)
    }
    
    // 确定相关性等级
    let relevance: 'high' | 'medium' | 'low' = 'low'
    if (matchScore >= 0.7) relevance = 'high'
    else if (matchScore >= 0.4) relevance = 'medium'
    
    return {
      skill,
      matchScore: Math.min(1, matchScore),
      relevance,
      category: relevantCategory,
      reason: reasons.join('; ')
    }
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().match(/\b[a-z\u4e00-\u9fa5]{2,}\b/g) || []
    const stopWords = new Set(['的', '是', '在', '和', '与', '或', '了', '着', '过', '等', '及', '以', '为', 'from', 'to', 'the', 'and', 'or', 'is', 'are', 'was', 'were'])
    
    return words.filter(word => !stopWords.has(word))
  }

  /**
   * 估算任务复杂度
   */
  private estimateTaskComplexity(task: string): number {
    const features = {
      hasMultiStep: /然后|接着|再|并且|还有|同时/.test(task),
      hasCondition: /如果|则|否则|取决于/.test(task),
      isCodeRelated: /代码|函数|变量|实现|算法|编程/.test(task.toLowerCase()),
      isBrowserOperation: /打开|关闭|播放|暂停|搜索|点击|输入|浏览/.test(task),
      instructionLength: task.length
    }
    
    let complexity = 0.3 // 基础复杂度
    
    if (features.hasMultiStep) complexity += 0.2
    if (features.hasCondition) complexity += 0.15
    if (features.isCodeRelated) complexity += 0.2
    if (features.isBrowserOperation) complexity += 0.1
    if (features.instructionLength > 100) complexity += 0.05
    
    return Math.min(1, complexity)
  }

  /**
   * 应用配置限制
   */
  private applyConfigLimits(
    matches: SkillMatch[],
    config?: Partial<SkillInjectionConfig>
  ): SkillMatch[] {
    const finalConfig: SkillInjectionConfig = {
      maxSkills: config?.maxSkills || 5,
      minRelevance: config?.minRelevance || 'medium',
      includeReasoning: config?.includeReasoning ?? true,
      includeExamples: config?.includeExamples ?? true,
      format: config?.format || 'markdown'
    }
    
    // 过滤相关性
    let filtered = matches
    if (finalConfig.minRelevance === 'high') {
      filtered = filtered.filter(m => m.relevance === 'high')
    } else if (finalConfig.minRelevance === 'medium') {
      filtered = filtered.filter(m => m.relevance !== 'low')
    }
    
    // 限制数量
    return filtered.slice(0, finalConfig.maxSkills)
  }

  // ============================================
  // 技能注入
  // ============================================

  /**
   * 将技能注入到任务中
   */
  injectSkillsIntoTask(
    task: string,
    retrievalResult: SkillRetrievalResult,
    config?: Partial<SkillInjectionConfig>
  ): string {
    const finalConfig: SkillInjectionConfig = {
      maxSkills: config?.maxSkills || 5,
      minRelevance: config?.minRelevance || 'medium',
      includeReasoning: config?.includeReasoning ?? true,
      includeExamples: config?.includeExamples ?? true,
      format: config?.format || 'markdown'
    }
    
    if (retrievalResult.matchedSkills.length === 0) {
      return task
    }
    
    const skillsSection = this.formatSkillsForInjection(retrievalResult.matchedSkills, finalConfig)
    
    return `${skillsSection}\n\n---\n\n原始任务:\n${task}`
  }

  /**
   * 格式化技能用于注入
   */
  private formatSkillsForInjection(
    matches: SkillMatch[],
    config: SkillInjectionConfig
  ): string {
    if (config.format === 'json') {
      return this.formatSkillsAsJSON(matches)
    } else if (config.format === 'prompt') {
      return this.formatSkillsAsPrompt(matches)
    } else {
      return this.formatSkillsAsMarkdown(matches)
    }
  }

  private formatSkillsAsMarkdown(matches: SkillMatch[]): string {
    const sections: string[] = ['# 相关技能包']
    
    for (const match of matches) {
      const skill = match.skill
      sections.push(`\n## ${skill.name} (相关度: ${(match.matchScore * 100).toFixed(0)}%)`)
      sections.push(`**描述**: ${skill.description}`)
      sections.push(`**匹配原因**: ${match.reason}`)
      
      if (match.category) {
        sections.push(`**分类**: ${match.category.name}`)
      }
      
      if (skill.expectedBehavior) {
        sections.push(`**建议系统**: ${skill.expectedBehavior.recommendedSystem}`)
        if (skill.expectedBehavior.recommendedTools) {
          sections.push(`**建议工具**: ${skill.expectedBehavior.recommendedTools.join(', ')}`)
        }
      }
      
      // 提取判断逻辑中的知识
      const knowledge = this.extractKnowledgeFromSkill(skill)
      if (knowledge) {
        if (knowledge.coreConcepts && knowledge.coreConcepts.length > 0) {
          sections.push(`**核心概念**:\n${knowledge.coreConcepts.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}`)
        }
        if (knowledge.keySteps && knowledge.keySteps.length > 0) {
          sections.push(`**关键步骤**:\n${knowledge.keySteps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`)
        }
        if (knowledge.bestPractices && knowledge.bestPractices.length > 0) {
          sections.push(`**最佳实践**:\n${knowledge.bestPractices.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}`)
        }
      }
    }
    
    return sections.join('\n')
  }

  private extractKnowledgeFromSkill(skill: CognitiveSkill | DistilledSkill): any {
    // 检查是否是DistilledSkill
    if ('distilledKnowledge' in skill) {
      return skill.distilledKnowledge
    }
    
    // 检查是否是CognitiveSkill
    if ('judgmentLogic' in skill && skill.judgmentLogic) {
      try {
        return JSON.parse(skill.judgmentLogic)
      } catch {
        return null
      }
    }
    
    return null
  }

  private formatSkillsAsJSON(matches: SkillMatch[]): string {
    const skillsData = matches.map(match => {
      const knowledge = this.extractKnowledgeFromSkill(match.skill)
      return {
        name: match.skill.name,
        description: match.skill.description,
        matchScore: match.matchScore,
        relevance: match.relevance,
        category: match.category?.name,
        reason: match.reason,
        knowledge
      }
    })
    
    return JSON.stringify({ skills: skillsData }, null, 2)
  }

  private formatSkillsAsPrompt(matches: SkillMatch[]): string {
    const promptParts: string[] = ['以下是与当前任务相关的技能知识:']
    
    for (const match of matches) {
      const skill = match.skill
      promptParts.push(`\n技能: ${skill.name}`)
      promptParts.push(`描述: ${skill.description}`)
      promptParts.push(`相关度: ${(match.matchScore * 100).toFixed(0)}%`)
      
      const knowledge = this.extractKnowledgeFromSkill(skill)
      if (knowledge) {
        if (knowledge.coreConcepts) {
          promptParts.push(`核心概念: ${knowledge.coreConcepts.join(', ')}`)
        }
        if (knowledge.keySteps) {
          promptParts.push(`关键步骤: ${knowledge.keySteps.join(', ')}`)
        }
      }
    }
    
    return promptParts.join('\n')
  }

  // ============================================
  // 技能使用统计
  // ============================================

  /**
   * 记录技能使用
   */
  recordSkillUsage(skillId: string, success: boolean): void {
    const current = this.skillUsageStats.get(skillId) || {
      count: 0,
      lastUsed: 0,
      successRate: 1.0
    }
    
    current.count++
    current.lastUsed = Date.now()
    
    // 更新成功率
    const totalSuccess = Math.round(current.successRate * (current.count - 1)) + (success ? 1 : 0)
    current.successRate = totalSuccess / current.count
    
    this.skillUsageStats.set(skillId, current)
    this.saveUsageStats()
    
    console.log(`SkillManager: 记录技能使用 ${skillId} - 成功: ${success}, 成功率: ${(current.successRate * 100).toFixed(0)}%`)
  }

  /**
   * 批量记录技能使用
   */
  recordBatchSkillUsage(skillIds: string[], success: boolean): void {
    for (const skillId of skillIds) {
      this.recordSkillUsage(skillId, success)
    }
  }

  // ============================================
  // 检索历史
  // ============================================

  private recordRetrievalHistory(result: SkillRetrievalResult): void {
    try {
      this.retrievalHistory.push(result)
      
      // 保留最近100条记录
      if (this.retrievalHistory.length > 100) {
        this.retrievalHistory = this.retrievalHistory.slice(-100)
      }
      
      const data = JSON.stringify({ history: this.retrievalHistory }, null, 2)
      fs.writeFileSync(this.retrievalHistoryPath, data)
    } catch (error) {
      console.error('SkillManager: 记录检索历史失败', error)
    }
  }

  getRetrievalHistory(limit: number = 10): SkillRetrievalResult[] {
    return this.retrievalHistory.slice(-limit)
  }

  // ============================================
  // 统计与分析
  // ============================================

  /**
   * 获取技能使用统计
   */
  getSkillUsageStats(): Array<{
    skillId: string
    count: number
    lastUsed: number
    successRate: number
  }> {
    const stats = Array.from(this.skillUsageStats.entries()).map(([skillId, stat]) => ({
      skillId,
      count: stat.count,
      lastUsed: stat.lastUsed,
      successRate: stat.successRate
    }))
    
    return stats.sort((a, b) => b.count - a.count)
  }

  /**
   * 获取最常用的技能
   */
  getTopUsedSkills(limit: number = 10): Array<{
    skillId: string
    count: number
    successRate: number
  }> {
    return this.getSkillUsageStats()
      .slice(0, limit)
      .map(stat => ({
        skillId: stat.skillId,
        count: stat.count,
        successRate: stat.successRate
      }))
  }

  // ============================================  
  // 技能分类管理
  // ============================================

  /**
   * 获取所有技能分类
   */
  getSkillCategories(agentType?: AgentType): SkillCategory[] {
    if (!agentType) {
      return SKILL_CATEGORIES
    }
    return SKILL_CATEGORIES.filter(category => 
      category.agentTypes.includes(agentType)
    )
  }

  /**
   * 根据智能体类型获取技能分类
   */
  getCategoriesByAgentType(agentType: AgentType): SkillCategory[] {
    return SKILL_CATEGORIES.filter(category => 
      category.agentTypes.includes(agentType)
    )
  }

  /**
   * 根据ID获取技能分类
   */
  getCategoryById(categoryId: string): SkillCategory | undefined {
    return SKILL_CATEGORIES.find(category => category.id === categoryId)
  }

  /**
   * 获取所有智能体类型
   */
  getAgentTypes(): AgentType[] {
    return [
      'project_manager',
      'ui_designer', 
      'frontend_developer',
      'backend_developer',
      'fullstack_developer',
      'tester',
      'devops',
      'architect',
      'analyst',
      'general'
    ]
  }

  /**
   * 获取分类对应的智能体类型
   */
  getAgentTypesForCategory(categoryId: string): AgentType[] {
    const category = this.getCategoryById(categoryId)
    return category ? category.agentTypes : []
  }

  /**
   * 获取智能体使用统计
   */
  getAgentUsageStats(): Record<AgentType, {
    totalRetrievals: number
    avgSkillsPerRetrieval: number
    avgRetrievalTime: number
  }> {
    const stats: Record<string, any> = {}
    
    for (const result of this.retrievalHistory) {
      if (!stats[result.agentType]) {
        stats[result.agentType] = {
          totalRetrievals: 0,
          totalSkills: 0,
          totalTime: 0
        }
      }
      
      stats[result.agentType].totalRetrievals++
      stats[result.agentType].totalSkills += result.matchedSkills.length
      stats[result.agentType].totalTime += result.retrievalTime
    }
    
    const finalStats: Record<AgentType, any> = {} as any
    for (const [agentType, data] of Object.entries(stats)) {
      finalStats[agentType as AgentType] = {
        totalRetrievals: data.totalRetrievals,
        avgSkillsPerRetrieval: data.totalSkills / data.totalRetrievals,
        avgRetrievalTime: data.totalTime / data.totalRetrievals
      }
    }
    
    return finalStats
  }

  /**
   * 分析技能覆盖度
   */
  analyzeSkillCoverage(): {
    totalSkills: number
    categorizedSkills: Record<string, number>
    uncoveredAreas: string[]
  } {
    const allSkills = cognitiveEngine.getAllSkills()
    
    const categorizedSkills: Record<string, number> = {}
    for (const category of SKILL_CATEGORIES) {
      categorizedSkills[category.id] = 0
    }
    
    let categorizedCount = 0
    for (const skill of allSkills) {
      for (const category of SKILL_CATEGORIES) {
        if (category.keywords.some(kw => 
          skill.name.toLowerCase().includes(kw.toLowerCase()) ||
          skill.description.toLowerCase().includes(kw.toLowerCase())
        )) {
          categorizedSkills[category.id]++
          categorizedCount++
          break
        }
      }
    }
    
    const uncoveredAreas = SKILL_CATEGORIES
      .filter(cat => categorizedSkills[cat.id] === 0)
      .map(cat => cat.name)
    
    return {
      totalSkills: allSkills.length,
      categorizedSkills,
      uncoveredAreas
    }
  }

  // ============================================
  // 技能优化建议
  // ============================================

  /**
   * 生成技能优化建议
   */
  generateOptimizationSuggestions(): Array<{
    type: 'create' | 'update' | 'remove' | 'improve'
    description: string
    priority: 'high' | 'medium' | 'low'
    relatedSkills?: string[]
  }> {
    const suggestions: Array<any> = []
    
    // 1. 分析未覆盖领域
    const coverage = this.analyzeSkillCoverage()
    for (const area of coverage.uncoveredAreas) {
      suggestions.push({
        type: 'create',
        description: `创建 ${area} 相关的技能`,
        priority: 'medium'
      })
    }
    
    // 2. 分析低成功率技能
    const lowSuccessSkills = this.getSkillUsageStats()
      .filter(stat => stat.count > 5 && stat.successRate < 0.6)
    
    for (const skillStat of lowSuccessSkills) {
      suggestions.push({
        type: 'improve',
        description: `优化技能 ${skillStat.skillId}，当前成功率 ${(skillStat.successRate * 100).toFixed(0)}%`,
        priority: 'high',
        relatedSkills: [skillStat.skillId]
      })
    }
    
    // 3. 分析未使用技能
    const allSkills = cognitiveEngine.getAllSkills()
    const unusedSkills = allSkills.filter(skill => {
      const stat = this.skillUsageStats.get(skill.id)
      return !stat || stat.count === 0
    })
    
    for (const skill of unusedSkills.slice(0, 5)) {
      suggestions.push({
        type: 'remove',
        description: `考虑移除未使用的技能: ${skill.name}`,
        priority: 'low',
        relatedSkills: [skill.id]
      })
    }
    
    return suggestions
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.retrievalHistory = []
    try {
      fs.writeFileSync(this.retrievalHistoryPath, JSON.stringify({ history: [] }))
      console.log('SkillManager: 检索历史已清除')
    } catch (error) {
      console.error('SkillManager: 清除历史失败', error)
    }
  }

  /**
   * 清除使用统计
   */
  clearUsageStats(): void {
    this.skillUsageStats.clear()
    this.saveUsageStats()
    console.log('SkillManager: 使用统计已清除')
  }
}

let skillManagerInstance: SkillManager | null = null

export function getSkillManager(): SkillManager {
  if (!skillManagerInstance) {
    skillManagerInstance = new SkillManager()
  }
  return skillManagerInstance
}

export const skillManager = getSkillManager()
