/**
 * 知识蒸馏器 (Distiller)
 * 负责从 System 2 的决策中学习，将判断能力蒸馏到 System 1
 * 实现闭环反馈机制
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { cognitiveEngine } from './CognitiveEngine'
import { llmService } from '../services/LLMService'

// 蒸馏学习记录
export interface DistillationRecord {
  id: string
  instruction: string
  system2Result: any
  system1Result?: any
  success: boolean
  durationMs: number
  complexity: 'low' | 'medium' | 'high'
  features: {
    hasMultiStep: boolean
    hasCondition: boolean
    isCodeRelated: boolean
    isBrowserOperation: boolean
    instructionLength: number
  }
  createdAt: number
  // 学习到的模式
  learnedPatterns?: {
    skillName: string
    confidence: number
    triggerPattern: string
  }[]
  // 是否已蒸馏
  distilled: boolean
}

// 蒸馏统计
export interface DistillationStats {
  totalRecords: number
  successfulDistillations: number
  failedAttempts: number
  skillUpdates: number
  lastDistillationAt?: number
  successRate: number
}

// 蒸馏建议
export interface DistillationSuggestion {
  type: 'create_skill' | 'update_skill' | 'adjust_threshold'
  reason: string
  skillName?: string
  triggerPattern?: string
  confidence?: number
  currentThreshold?: number
  suggestedThreshold?: number
}

// 蒸馏效果评估指标
export interface DistillationMetrics {
  // 性能指标
  responseTimeImprovement: number // 响应时间改进百分比
  system1UsageIncrease: number // System 1 使用增加百分比
  throughputIncrease: number // 吞吐量增加百分比
  
  // 质量指标
  accuracyRetention: number // 准确率保持率
  errorRateChange: number // 错误率变化
  successRateImprovement: number // 成功率改进
  
  // 学习效果指标
  patternsLearned: number // 学习到的模式数量
  skillsCreated: number // 创建的技能数量
  skillsUpdated: number // 更新的技能数量
  thresholdAdjustments: number // 阈值调整次数
  
  // 可靠性指标
  consistencyScore: number // 一致性评分
  confidenceImprovement: number // 置信度改进
  edgeCaseHandling: number // 边界情况处理能力
}

// 蒸馏效果评估报告
export interface DistillationReport {
  id: string
  period: {
    start: number
    end: number
  }
  metrics: DistillationMetrics
  trends: {
    time: number
    metrics: Partial<DistillationMetrics>
  }[]
  topPatterns: {
    pattern: string
    frequency: number
    successRate: number
  }[]
  recommendations: {
    type: string
    description: string
    priority: 'low' | 'medium' | 'high'
  }[]
  createdAt: number
  confidence: number
}

// 持续改进建议
export interface ContinuousImprovementSuggestion {
  area: 'performance' | 'accuracy' | 'coverage' | 'reliability'
  suggestion: string
  expectedImpact: number // 0-1
  implementationDifficulty: 'low' | 'medium' | 'high'
  relatedMetrics: string[]
}

export class Distiller {
  private dataPath: string
  private recordsPath: string
  private suggestionsPath: string
  
  // 待处理的蒸馏记录
  private pendingRecords: DistillationRecord[] = []
  // 批量大小
  private batchSize = 10
  // 自动蒸馏阈值
  private autoDistillThreshold = 5

  constructor() {
    try {
      this.dataPath = path.join(app.getPath('userData'), 'cognitive', 'distiller')
    } catch (error) {
      console.warn('Failed to get userData path for Distiller, using current directory:', error)
      this.dataPath = path.join(process.cwd(), 'cognitive', 'distiller')
    }
    this.recordsPath = path.join(this.dataPath, 'records.json')
    this.suggestionsPath = path.join(this.dataPath, 'suggestions.json')
    
    this.ensureDirectories()
  }

  private ensureDirectories(): void {
    try {
      const parentDir = path.dirname(this.dataPath)
      if (!fs.existsSync(parentDir)) {
        try {
          fs.mkdirSync(parentDir, { recursive: true, mode: 0o755 })
        } catch (error) {
          console.warn('Distiller: 无法创建父目录，将使用当前目录', error)
        }
      }
      if (!fs.existsSync(this.dataPath)) {
        try {
          fs.mkdirSync(this.dataPath, { recursive: true, mode: 0o755 })
        } catch (error) {
          console.warn('Distiller: 无法创建数据目录，将使用内存存储', error)
        }
      }
      // 初始化记录文件
      if (!fs.existsSync(this.recordsPath)) {
        try {
          fs.writeFileSync(this.recordsPath, JSON.stringify({ records: [], updatedAt: Date.now() }), { mode: 0o644 })
        } catch (error) {
          console.warn('Distiller: 无法创建记录文件，将使用内存存储', error)
        }
      }
      if (!fs.existsSync(this.suggestionsPath)) {
        try {
          fs.writeFileSync(this.suggestionsPath, JSON.stringify({ suggestions: [], updatedAt: Date.now() }), { mode: 0o644 })
        } catch (error) {
          console.warn('Distiller: 无法创建建议文件，将使用内存存储', error)
        }
      }
    } catch (error) {
      console.warn('Distiller: 初始化目录失败，将使用内存存储', error)
    }
  }

  // ============================================
  // 记录管理
  // ============================================

  /**
   * 记录一次完整的任务执行
   */
  recordExecution(
    instruction: string,
    system2Result: any,
    system1Result: any | undefined,
    success: boolean,
    durationMs: number,
    complexity: 'low' | 'medium' | 'high'
  ): DistillationRecord {
    const features = this.extractFeatures(instruction)
    
    const record: DistillationRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      instruction,
      system2Result,
      system1Result,
      success,
      durationMs,
      complexity,
      features,
      createdAt: Date.now(),
      distilled: false
    }

    // 添加到待处理队列
    this.pendingRecords.push(record)
    
    // 保存到文件
    this.saveRecord(record)
    
    // 检查是否需要自动蒸馏
    if (this.pendingRecords.length >= this.autoDistillThreshold) {
      this.autoDistill()
    }

    console.log(`Distiller: 记录执行 - ${success ? '成功' : '失败'}, 复杂度: ${complexity}`)
    return record
  }

  private extractFeatures(instruction: string): DistillationRecord['features'] {
    const lower = instruction.toLowerCase()
    return {
      hasMultiStep: /然后|接着|再|并且|还有|同时/.test(instruction),
      hasCondition: /如果|则|否则|取决于/.test(instruction),
      isCodeRelated: /代码|函数|变量|实现|算法|编程/.test(lower),
      isBrowserOperation: /打开|关闭|播放|暂停|搜索|点击|输入|浏览/.test(lower),
      instructionLength: instruction.length
    }
  }

  private saveRecord(record: DistillationRecord): void {
    try {
      const data = JSON.parse(fs.readFileSync(this.recordsPath, 'utf8'))
      data.records.push(record)
      // 保留最近1000条记录
      if (data.records.length > 1000) {
        data.records = data.records.slice(-1000)
      }
      data.updatedAt = Date.now()
      fs.writeFileSync(this.recordsPath, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Distiller: 保存记录失败', error)
    }
  }

  // ============================================
  // 自动蒸馏
  // ============================================

  /**
   * 自动蒸馏学习
   */
  async autoDistill(): Promise<void> {
    if (this.pendingRecords.length < this.autoDistillThreshold) {
      return
    }

    console.log(`Distiller: 开始自动蒸馏, 待处理 ${this.pendingRecords.length} 条记录`)
    
    const recordsToProcess = this.pendingRecords.splice(0, this.batchSize)
    
    for (const record of recordsToProcess) {
      await this.distillFromRecord(record)
    }
  }

  /**
   * 从单条记录学习
   */
  private async distillFromRecord(record: DistillationRecord): Promise<void> {
    try {
      // 分析是否应该使用 System 1
      if (this.shouldUseSystem1ButUsedSystem2(record)) {
        // 情况1: 原本应该用 System 1 但用了 System 2
        // 这种情况说明 System 1 需要学习
        await this.learnFromUnderutilizedSystem1(record)
      } else if (this.system2FailedWithSystem1(record)) {
        // 情况2: System 2 失败，如果是简单任务可能 System 1 也会失败
        // 记录这种情况用于调整阈值
        await this.recordFailurePattern(record)
      } else if (this.successWithSystem2(record) && this.isSimpleTask(record)) {
        // 情况3: System 2 成功完成任务，且是简单任务
        //检查是否可以从 System 2 蒸馏判断逻辑到 System 1
        await this.selfDistillToSystem1(record)
      }

      // 标记为已蒸馏
      this.markAsDistilled(record.id)
      
    } catch (error) {
      console.error('Distiller: 蒸馏学习失败', error)
    }
  }

  private analyzeShouldUseSystem1(record: DistillationRecord): boolean {
    const { features, complexity, instruction } = record
    
    // 简单任务特征
    if (complexity === 'low' && !features.hasMultiStep && !features.hasCondition) {
      return true
    }
    
    // 纯浏览器操作
    if (features.isBrowserOperation && !features.hasMultiStep && instruction.length < 50) {
      return true
    }
    
    return false
  }

  private shouldUseSystem1ButUsedSystem2(record: DistillationRecord): boolean {
    return this.analyzeShouldUseSystem1(record)
  }

  private system2FailedWithSystem1(record: DistillationRecord): boolean {
    return !record.success && record.system1Result !== undefined
  }

  private successWithSystem2(record: DistillationRecord): boolean {
    return record.success
  }

  private isSimpleTask(record: DistillationRecord): boolean {
    return record.complexity === 'low' || 
           (!record.features.hasMultiStep && !record.features.hasCondition)
  }

  // 学习: 当应该用 System 1 但用了 System 2 时
  private async learnFromUnderutilizedSystem1(record: DistillationRecord): Promise<void> {
    console.log(`Distiller: 检测到 System 1 未充分利用模式`)
    
    // 生成蒸馏建议
    const suggestion = await this.generateSuggestion(record)
    if (suggestion) {
      this.saveSuggestion(suggestion)
    }
  }

  // 记录失败模式
  private async recordFailurePattern(record: DistillationRecord): Promise<void> {
    console.log(`Distiller: 记录失败模式`)
    
    // 检查是否需要调整阈值
    if (record.complexity === 'low' && !record.success) {
      const suggestion: DistillationSuggestion = {
        type: 'adjust_threshold',
        reason: `简单任务失败率较高，可能需要降低 System 1 阈值`,
        currentThreshold: cognitiveEngine.getConfig().system1Threshold,
        suggestedThreshold: Math.max(0.7, cognitiveEngine.getConfig().system1Threshold - 0.05)
      }
      this.saveSuggestion(suggestion)
    }
  }

  // 自蒸馏: 将 System 2 的成功经验传授给 System 1
  private async selfDistillToSystem1(record: DistillationRecord): Promise<void> {
    console.log(`Distiller: 执行自蒸馏，将 System 2 经验传授给 System 1`)
    
    // 分析任务特征，提取判断模式
    const patterns = await this.extractPatterns(record)
    
    if (patterns.length > 0) {
      // 更新现有技能或创建新技能
      for (const pattern of patterns) {
        await this.applyPatternToSkill(pattern, record)
      }
    }
  }

  // ============================================
  // 模式提取与学习
  // ============================================

  /**
   * 从成功记录中提取判断模式
   */
  private async extractPatterns(record: DistillationRecord): Promise<Array<{ skillName: string; triggerPattern: string; confidence: number }>> {
    const patterns: Array<{ skillName: string; triggerPattern: string; confidence: number }> = []
    
    // 基于特征提取模式
    const { features, instruction } = record
    
    if (features.isBrowserOperation) {
      // 浏览器操作模式
      const match = instruction.match(/(打开|播放|搜索|点击|访问)\s+(.+)/)
      if (match) {
        patterns.push({
          skillName: '网页操作',
          triggerPattern: `${match[1]}.*`,
          confidence: 0.8
        })
      }
    }
    
    if (features.isCodeRelated) {
      // 代码相关模式
      patterns.push({
        skillName: '代码处理',
        triggerPattern: '.*(代码|函数|编程|实现).*',
        confidence: 0.7
      })
    }
    
    if (features.hasMultiStep) {
      // 多步骤模式
      patterns.push({
        skillName: '多步骤任务',
        triggerPattern: '.*(然后|接着|再|并且).*',
        confidence: 0.6
      })
    }

    return patterns
  }

  /**
   * 将模式应用到技能
   */
  private async applyPatternToSkill(pattern: { skillName: string; triggerPattern: string; confidence: number }, record: DistillationRecord): Promise<void> {
    const skills = cognitiveEngine.getAllSkills()
    
    // 查找现有技能
    const existingSkill = skills.find(s => s.name === pattern.skillName)
    
    if (existingSkill) {
      // 更新现有技能
      const newPatterns = [...existingSkill.triggerPatterns]
      if (!newPatterns.includes(pattern.triggerPattern)) {
        newPatterns.push(pattern.triggerPattern)
      }
      
      cognitiveEngine.updateSkill(existingSkill.id, {
        triggerPatterns: newPatterns,
        confidenceThreshold: Math.max(existingSkill.confidenceThreshold, pattern.confidence)
      })
      
      console.log(`Distiller: 更新技能 "${pattern.skillName}"`)
    } else {
      // 创建新技能
      cognitiveEngine.createSkill({
        name: pattern.skillName,
        description: `从蒸馏学习自动创建: ${pattern.skillName}`,
        triggerPatterns: [pattern.triggerPattern],
        complexityThreshold: record.complexity === 'low' ? 0.3 : record.complexity === 'medium' ? 0.5 : 0.7,
        confidenceThreshold: pattern.confidence,
        expectedBehavior: {
          recommendedSystem: record.complexity === 'low' ? 'system1' : 'system2',
          requiresMultiStep: record.features.hasMultiStep
        }
      })
      
      console.log(`Distiller: 创建新技能 "${pattern.skillName}"`)
    }
  }

  // ============================================
  // 建议生成
  // ============================================

  /**
   * 生成蒸馏建议
   */
  private async generateSuggestion(record: DistillationRecord): Promise<DistillationSuggestion | null> {
    // 使用 LLM 分析
    try {
      const prompt = `分析以下任务，判断是否应该创建新的认知技能：
      
任务: ${record.instruction}
复杂度: ${record.complexity}
成功: ${record.success}
特征: 多步骤=${record.features.hasMultiStep}, 条件=${record.features.hasCondition}, 代码相关=${record.features.isCodeRelated}, 浏览器操作=${record.features.isBrowserOperation}

如果应该创建新技能，返回 JSON 格式:
{"type": "create_skill", "skillName": "技能名称", "triggerPattern": "触发模式", "confidence": 0.8}

如果应该更新现有技能，返回:
{"type": "update_skill", "skillName": "技能名称", "reason": "原因"}

如果应该调整阈值，返回:
{"type": "adjust_threshold", "reason": "原因", "suggestedThreshold": 0.8}

如果不需要任何操作，返回:
{"type": "none"}`

      const response = await llmService.chat('doubao-seed-2-0-lite-260215', [
        { role: 'system', content: '你是一个技能学习分析器，负责从任务执行中提取可重用的判断模式。' },
        { role: 'user', content: prompt }
      ], { max_tokens: 300, temperature: 0.2 })

      if (response.success && response.content) {
        try {
          const result = JSON.parse(response.content)
          if (result.type === 'none') return null
          return result as DistillationSuggestion
        } catch {
          return null
        }
      }
    } catch (error) {
      console.error('Distiller: 生成建议失败', error)
    }
    
    return null
  }

  private saveSuggestion(suggestion: DistillationSuggestion): void {
    try {
      const data = JSON.parse(fs.readFileSync(this.suggestionsPath, 'utf8'))
      data.suggestions.push({
        ...suggestion,
        createdAt: Date.now()
      })
      // 保留最近50条建议
      if (data.suggestions.length > 50) {
        data.suggestions = data.suggestions.slice(-50)
      }
      data.updatedAt = Date.now()
      fs.writeFileSync(this.suggestionsPath, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Distiller: 保存建议失败', error)
    }
  }

  private markAsDistilled(recordId: string): void {
    try {
      const data = JSON.parse(fs.readFileSync(this.recordsPath, 'utf8'))
      const record = data.records.find((r: DistillationRecord) => r.id === recordId)
      if (record) {
        record.distilled = true
        fs.writeFileSync(this.recordsPath, JSON.stringify(data, null, 2))
      }
    } catch (error) {
      console.error('Distiller: 标记蒸馏状态失败', error)
    }
  }

  // ============================================
  // 统计与查询
  // ============================================

  /**
   * 获取蒸馏统计
   */
  getStats(): DistillationStats {
    try {
      const data = JSON.parse(fs.readFileSync(this.recordsPath, 'utf8'))
      const records = data.records || []
      
      return {
        totalRecords: records.length,
        successfulDistillations: records.filter((r: DistillationRecord) => r.distilled).length,
        failedAttempts: records.filter((r: DistillationRecord) => !r.success).length,
        skillUpdates: cognitiveEngine.getAllSkills().length,
        successRate: records.length > 0 
          ? records.filter((r: DistillationRecord) => r.success).length / records.length 
          : 0
      }
    } catch (error) {
      return {
        totalRecords: 0,
        successfulDistillations: 0,
        failedAttempts: 0,
        skillUpdates: 0,
        successRate: 0
      }
    }
  }

  /**
   * 获取待处理记录数
   */
  getPendingCount(): number {
    return this.pendingRecords.length
  }

  /**
   * 获取最近建议
   */
  getRecentSuggestions(limit: number = 10): DistillationSuggestion[] {
    try {
      const data = JSON.parse(fs.readFileSync(this.suggestionsPath, 'utf8'))
      return (data.suggestions || []).slice(-limit)
    } catch {
      return []
    }
  }

  /**
   * 手动触发蒸馏
   */
  async triggerDistillation(): Promise<{ processed: number; suggestions: number }> {
    const suggestionsBefore = (await this.getRecentSuggestions(100)).length
    
    await this.autoDistill()
    
    const suggestionsAfter = (this.getRecentSuggestions(100)).length
    
    return {
      processed: this.pendingRecords.length,
      suggestions: suggestionsAfter - suggestionsBefore
    }
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    try {
      fs.writeFileSync(this.recordsPath, JSON.stringify({ records: [], updatedAt: Date.now() }))
      fs.writeFileSync(this.suggestionsPath, JSON.stringify({ suggestions: [], updatedAt: Date.now() }))
      this.pendingRecords = []
      console.log('Distiller: 历史记录已清除')
    } catch (error) {
      console.error('Distiller: 清除历史失败', error)
    }
  }

  // ============================================  
  // 蒸馏效果评估
  // ============================================  

  /**
   * 评估蒸馏效果
   */
  async evaluateDistillationEffectiveness(startTime?: number, endTime?: number): Promise<DistillationMetrics> {
    const records = this.getRecordsInTimeRange(startTime || Date.now() - 7 * 24 * 60 * 60 * 1000, endTime || Date.now())
    
    if (records.length === 0) {
      return this.getDefaultMetrics()
    }

    // 计算性能指标
    const performanceMetrics = this.calculatePerformanceMetrics(records)
    
    // 计算质量指标
    const qualityMetrics = this.calculateQualityMetrics(records)
    
    // 计算学习效果指标
    const learningMetrics = this.calculateLearningMetrics(records)
    
    // 计算可靠性指标
    const reliabilityMetrics = this.calculateReliabilityMetrics(records)
    
    return {
      ...performanceMetrics,
      ...qualityMetrics,
      ...learningMetrics,
      ...reliabilityMetrics
    }
  }

  /**
   * 生成蒸馏效果评估报告
   */
  async generateDistillationReport(startTime?: number, endTime?: number): Promise<DistillationReport> {
    const start = startTime || Date.now() - 7 * 24 * 60 * 60 * 1000
    const end = endTime || Date.now()
    
    // 计算指标
    const metrics = await this.evaluateDistillationEffectiveness(start, end)
    
    // 分析趋势
    const trends = this.analyzeTrends(start, end)
    
    // 分析热门模式
    const topPatterns = this.identifyTopPatterns(start, end)
    
    // 生成建议
    const recommendations = this.generateRecommendations(metrics, topPatterns)
    
    return {
      id: `report_${Date.now()}`,
      period: { start, end },
      metrics,
      trends,
      topPatterns,
      recommendations,
      createdAt: Date.now(),
      confidence: this.calculateReportConfidence(metrics, trends.length)
    }
  }

  /**
   * 获取时间范围内的记录
   */
  private getRecordsInTimeRange(start: number, end: number): DistillationRecord[] {
    try {
      const data = JSON.parse(fs.readFileSync(this.recordsPath, 'utf8'))
      return (data.records || []).filter((r: DistillationRecord) => 
        r.createdAt >= start && r.createdAt <= end
      )
    } catch {
      return []
    }
  }

  /**
   * 获取默认指标
   */
  private getDefaultMetrics(): DistillationMetrics {
    return {
      responseTimeImprovement: 0,
      system1UsageIncrease: 0,
      throughputIncrease: 0,
      accuracyRetention: 1,
      errorRateChange: 0,
      successRateImprovement: 0,
      patternsLearned: 0,
      skillsCreated: 0,
      skillsUpdated: 0,
      thresholdAdjustments: 0,
      consistencyScore: 0.5,
      confidenceImprovement: 0,
      edgeCaseHandling: 0.5
    }
  }

  /**
   * 计算性能指标
   */
  private calculatePerformanceMetrics(records: DistillationRecord[]): Pick<DistillationMetrics, 'responseTimeImprovement' | 'system1UsageIncrease' | 'throughputIncrease'> {
    const system1Records = records.filter(r => r.system1Result)
    const system2Records = records.filter(r => !r.system1Result)
    
    // 计算响应时间改进
    const avgSystem1Time = system1Records.length > 0
      ? system1Records.reduce((sum, r) => sum + r.durationMs, 0) / system1Records.length
      : 0
    
    const avgSystem2Time = system2Records.length > 0
      ? system2Records.reduce((sum, r) => sum + r.durationMs, 0) / system2Records.length
      : 0
    
    let responseTimeImprovement = 0
    if (avgSystem2Time > 0 && avgSystem1Time > 0) {
      responseTimeImprovement = Math.max(0, (avgSystem2Time - avgSystem1Time) / avgSystem2Time)
    }
    
    // 计算 System 1 使用增加
    const system1Usage = system1Records.length / records.length
    const baselineUsage = 0.3 // 假设基线使用比例为 30%
    const system1UsageIncrease = Math.max(0, (system1Usage - baselineUsage) / baselineUsage)
    
    // 计算吞吐量增加
    const throughputIncrease = responseTimeImprovement * 0.7 + system1UsageIncrease * 0.3
    
    return {
      responseTimeImprovement,
      system1UsageIncrease,
      throughputIncrease
    }
  }

  /**
   * 计算质量指标
   */
  private calculateQualityMetrics(records: DistillationRecord[]): Pick<DistillationMetrics, 'accuracyRetention' | 'errorRateChange' | 'successRateImprovement'> {
    const system1Records = records.filter(r => r.system1Result)
    const system2Records = records.filter(r => !r.system1Result)
    
    const system1SuccessRate = system1Records.length > 0
      ? system1Records.filter(r => r.success).length / system1Records.length
      : 0
    
    const system2SuccessRate = system2Records.length > 0
      ? system2Records.filter(r => r.success).length / system2Records.length
      : 0
    
    // 计算准确率保持率
    let accuracyRetention = 1
    if (system2SuccessRate > 0) {
      accuracyRetention = Math.min(1, system1SuccessRate / system2SuccessRate)
    }
    
    // 计算错误率变化
    const system1ErrorRate = 1 - system1SuccessRate
    const system2ErrorRate = 1 - system2SuccessRate
    const errorRateChange = system2ErrorRate - system1ErrorRate
    
    // 计算成功率改进
    const successRateImprovement = Math.max(0, system1SuccessRate - system2SuccessRate)
    
    return {
      accuracyRetention,
      errorRateChange,
      successRateImprovement
    }
  }

  /**
   * 计算学习效果指标
   */
  private calculateLearningMetrics(records: DistillationRecord[]): Pick<DistillationMetrics, 'patternsLearned' | 'skillsCreated' | 'skillsUpdated' | 'thresholdAdjustments'> {
    // 分析学习到的模式
    const learnedPatterns = records.filter(r => r.learnedPatterns?.length || 0 > 0)
    const patternsLearned = learnedPatterns.reduce((sum, r) => sum + (r.learnedPatterns?.length || 0), 0)
    
    // 计算技能创建和更新
    const skills = cognitiveEngine.getAllSkills()
    const recentSkills = skills.filter(s => s.statistics.createdAt && s.statistics.createdAt > Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    const skillsCreated = recentSkills.length
    const skillsUpdated = skills.length // 暂时使用总技能数，因为没有updatedAt属性
    
    // 计算阈值调整次数
    const suggestions = this.getRecentSuggestions(100)
    const thresholdAdjustments = suggestions.filter(s => s.type === 'adjust_threshold').length
    
    return {
      patternsLearned,
      skillsCreated,
      skillsUpdated,
      thresholdAdjustments
    }
  }

  /**
   * 计算可靠性指标
   */
  private calculateReliabilityMetrics(records: DistillationRecord[]): Pick<DistillationMetrics, 'consistencyScore' | 'confidenceImprovement' | 'edgeCaseHandling'> {
    // 计算一致性评分
    const successRatesByComplexity = {
      low: this.calculateSuccessRateByComplexity(records, 'low'),
      medium: this.calculateSuccessRateByComplexity(records, 'medium'),
      high: this.calculateSuccessRateByComplexity(records, 'high')
    }
    
    // 计算一致性（标准差的倒数）
    const rates = Object.values(successRatesByComplexity)
    const mean = rates.reduce((sum, r) => sum + r, 0) / rates.length
    const variance = rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length
    const consistencyScore = 1 / (1 + Math.sqrt(variance))
    
    // 计算置信度改进
    const confidenceImprovement = this.calculateConfidenceImprovement()
    
    // 计算边界情况处理
    const edgeCaseHandling = this.calculateEdgeCaseHandling(records)
    
    return {
      consistencyScore,
      confidenceImprovement,
      edgeCaseHandling
    }
  }

  /**
   * 分析趋势
   */
  private analyzeTrends(start: number, end: number): DistillationReport['trends'] {
    const trends: DistillationReport['trends'] = []
    const interval = (end - start) / 6 // 6个时间点
    
    for (let i = 0; i <= 6; i++) {
      const currentTime = start + interval * i
      const segmentStart = Math.max(start, currentTime - interval)
      const segmentEnd = currentTime
      
      const segmentRecords = this.getRecordsInTimeRange(segmentStart, segmentEnd)
      if (segmentRecords.length > 0) {
        const metrics = this.calculatePerformanceMetrics(segmentRecords)
        trends.push({
          time: currentTime,
          metrics: {
            responseTimeImprovement: metrics.responseTimeImprovement,
            system1UsageIncrease: metrics.system1UsageIncrease,
            throughputIncrease: metrics.throughputIncrease
          }
        })
      }
    }
    
    return trends
  }

  /**
   * 识别热门模式
   */
  private identifyTopPatterns(start: number, end: number): DistillationReport['topPatterns'] {
    const records = this.getRecordsInTimeRange(start, end)
    const patternFrequency: Record<string, { count: number; successes: number }> = {}
    
    // 分析模式
    records.forEach(record => {
      if (record.learnedPatterns) {
        record.learnedPatterns.forEach(pattern => {
          const key = pattern.triggerPattern || pattern.skillName || 'unknown'
          if (!patternFrequency[key]) {
            patternFrequency[key] = { count: 0, successes: 0 }
          }
          patternFrequency[key].count++
          if (record.success) {
            patternFrequency[key].successes++
          }
        })
      }
    })
    
    // 转换为排序后的数组
    return Object.entries(patternFrequency)
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        successRate: data.successes / data.count
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
  }

  /**
   * 生成建议
   */
  private generateRecommendations(metrics: DistillationMetrics, topPatterns: DistillationReport['topPatterns']): DistillationReport['recommendations'] {
    const recommendations: DistillationReport['recommendations'] = []
    
    // 基于性能的建议
    if (metrics.responseTimeImprovement < 0.1) {
      recommendations.push({
        type: 'performance',
        description: '响应时间改进不明显，建议优化 System 1 路由策略',
        priority: 'medium'
      })
    }
    
    // 基于质量的建议
    if (metrics.accuracyRetention < 0.9) {
      recommendations.push({
        type: 'quality',
        description: '准确率保持率较低，建议调整 System 1 阈值',
        priority: 'high'
      })
    }
    
    // 基于学习效果的建议
    if (metrics.patternsLearned < 5) {
      recommendations.push({
        type: 'learning',
        description: '学习到的模式较少，建议增加更多样的训练数据',
        priority: 'medium'
      })
    }
    
    // 基于可靠性的建议
    if (metrics.consistencyScore < 0.7) {
      recommendations.push({
        type: 'reliability',
        description: '一致性评分较低，建议改进模式识别算法',
        priority: 'medium'
      })
    }
    
    // 基于热门模式的建议
    if (topPatterns.length > 0) {
      const bestPattern = topPatterns[0]
      if (bestPattern.successRate > 0.9) {
        recommendations.push({
          type: 'pattern',
          description: `热门模式 "${bestPattern.pattern}" 成功率很高，建议扩展其应用范围`,
          priority: 'low'
        })
      }
    }
    
    return recommendations
  }

  /**
   * 计算报告置信度
   */
  private calculateReportConfidence(metrics: DistillationMetrics, trendCount: number): number {
    // 基于数据量和指标的置信度计算
    const dataConfidence = Math.min(1, trendCount / 5)
    const metricConfidence = (
      metrics.consistencyScore * 0.3 +
      metrics.accuracyRetention * 0.3 +
      (metrics.successRateImprovement + 1) * 0.2 +
      (metrics.confidenceImprovement + 1) * 0.2
    ) / 2
    
    return (dataConfidence * 0.4 + metricConfidence * 0.6)
  }

  /**
   * 按复杂度计算成功率
   */
  private calculateSuccessRateByComplexity(records: DistillationRecord[], complexity: 'low' | 'medium' | 'high'): number {
    const filtered = records.filter(r => r.complexity === complexity)
    if (filtered.length === 0) return 0
    return filtered.filter(r => r.success).length / filtered.length
  }

  /**
   * 计算置信度改进
   */
  private calculateConfidenceImprovement(): number {
    // 这里简化实现，实际应该分析学习前后的置信度变化
    return 0.1 // 默认小幅度改进
  }

  /**
   * 计算边界情况处理能力
   */
  private calculateEdgeCaseHandling(records: DistillationRecord[]): number {
    const edgeCaseRecords = records.filter(r => 
      r.features.hasMultiStep && r.features.hasCondition
    )
    
    if (edgeCaseRecords.length === 0) return 0.5
    return edgeCaseRecords.filter(r => r.success).length / edgeCaseRecords.length
  }

  /**
   * 生成持续改进建议
   */
  generateContinuousImprovementSuggestions(): ContinuousImprovementSuggestion[] {
    const suggestions: ContinuousImprovementSuggestion[] = []
    
    // 性能改进建议
    suggestions.push({
      area: 'performance',
      suggestion: '优化 System 1 路由决策算法，减少不必要的 System 2 调用',
      expectedImpact: 0.3,
      implementationDifficulty: 'medium',
      relatedMetrics: ['responseTimeImprovement', 'system1UsageIncrease', 'throughputIncrease']
    })
    
    // 准确性改进建议
    suggestions.push({
      area: 'accuracy',
      suggestion: '增加模式识别的上下文感知能力，提高复杂任务的判断准确性',
      expectedImpact: 0.25,
      implementationDifficulty: 'high',
      relatedMetrics: ['accuracyRetention', 'successRateImprovement', 'errorRateChange']
    })
    
    // 覆盖范围改进建议
    suggestions.push({
      area: 'coverage',
      suggestion: '扩展训练数据覆盖更多任务类型，提高模式识别的通用性',
      expectedImpact: 0.2,
      implementationDifficulty: 'low',
      relatedMetrics: ['patternsLearned', 'skillsCreated', 'edgeCaseHandling']
    })
    
    // 可靠性改进建议
    suggestions.push({
      area: 'reliability',
      suggestion: '实现多级反馈机制，持续监控和调整蒸馏效果',
      expectedImpact: 0.15,
      implementationDifficulty: 'medium',
      relatedMetrics: ['consistencyScore', 'confidenceImprovement', 'edgeCaseHandling']
    })
    
    return suggestions
  }

  /**
   * 保存评估报告
   */
  async saveDistillationReport(report: DistillationReport): Promise<void> {
    try {
      const reportsPath = path.join(this.dataPath, 'reports.json')
      let existingReports = []
      
      if (fs.existsSync(reportsPath)) {
        const data = JSON.parse(fs.readFileSync(reportsPath, 'utf8'))
        existingReports = data.reports || []
      }
      
      existingReports.push(report)
      
      // 保留最近30份报告
      if (existingReports.length > 30) {
        existingReports = existingReports.slice(-30)
      }
      
      fs.writeFileSync(reportsPath, JSON.stringify({ reports: existingReports, updatedAt: Date.now() }, null, 2))
    } catch (error) {
      console.error('Distiller: 保存报告失败', error)
    }
  }

  /**
   * 获取最近的评估报告
   */
  getRecentReports(limit: number = 5): DistillationReport[] {
    try {
      const reportsPath = path.join(this.dataPath, 'reports.json')
      if (!fs.existsSync(reportsPath)) {
        return []
      }
      
      const data = JSON.parse(fs.readFileSync(reportsPath, 'utf8'))
      return (data.reports || []).slice(-limit)
    } catch {
      return []
    }
  }

  /**
   * 运行完整的蒸馏效果评估
   */
  async runFullEvaluation(): Promise<{
    report: DistillationReport
    improvements: ContinuousImprovementSuggestion[]
    summary: string
  }> {
    // 生成报告
    const report = await this.generateDistillationReport()
    
    // 保存报告
    await this.saveDistillationReport(report)
    
    // 生成改进建议
    const improvements = this.generateContinuousImprovementSuggestions()
    
    // 生成摘要
    const summary = this.generateEvaluationSummary(report)
    
    return {
      report,
      improvements,
      summary
    }
  }

  /**
   * 生成评估摘要
   */
  private generateEvaluationSummary(report: DistillationReport): string {
    const metrics = report.metrics
    
    let summary = `蒸馏效果评估摘要\n`
    summary += `=======================\n`
    summary += `评估期间: ${new Date(report.period.start).toLocaleString()} 至 ${new Date(report.period.end).toLocaleString()}\n`
    summary += `置信度: ${(report.confidence * 100).toFixed(1)}%\n\n`
    
    summary += `性能指标:\n`
    summary += `- 响应时间改进: ${(metrics.responseTimeImprovement * 100).toFixed(1)}%\n`
    summary += `- System 1 使用增加: ${(metrics.system1UsageIncrease * 100).toFixed(1)}%\n`
    summary += `- 吞吐量增加: ${(metrics.throughputIncrease * 100).toFixed(1)}%\n\n`
    
    summary += `质量指标:\n`
    summary += `- 准确率保持率: ${(metrics.accuracyRetention * 100).toFixed(1)}%\n`
    summary += `- 错误率变化: ${(metrics.errorRateChange * 100).toFixed(1)}%\n`
    summary += `- 成功率改进: ${(metrics.successRateImprovement * 100).toFixed(1)}%\n\n`
    
    summary += `学习效果:\n`
    summary += `- 学习到的模式: ${metrics.patternsLearned}\n`
    summary += `- 创建的技能: ${metrics.skillsCreated}\n`
    summary += `- 更新的技能: ${metrics.skillsUpdated}\n`
    summary += `- 阈值调整: ${metrics.thresholdAdjustments}\n\n`
    
    summary += `可靠性指标:\n`
    summary += `- 一致性评分: ${(metrics.consistencyScore * 100).toFixed(1)}%\n`
    summary += `- 置信度改进: ${(metrics.confidenceImprovement * 100).toFixed(1)}%\n`
    summary += `- 边界情况处理: ${(metrics.edgeCaseHandling * 100).toFixed(1)}%\n\n`
    
    if (report.recommendations.length > 0) {
      summary += `关键建议:\n`
      report.recommendations.forEach((rec, index) => {
        summary += `${index + 1}. [${rec.priority}] ${rec.description}\n`
      })
    }
    
    return summary
  }
}

let distillerInstance: Distiller | null = null

export function getDistiller(): Distiller {
  if (!distillerInstance) {
    distillerInstance = new Distiller()
  }
  return distillerInstance
}

export const distiller = getDistiller()
