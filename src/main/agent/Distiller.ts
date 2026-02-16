/**
 * 知识蒸馏器 (Distiller)
 * 负责从 System 2 的决策中学习，将判断能力蒸馏到 System 1
 * 实现闭环反馈机制
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { cognitiveEngine, CognitiveSkill, DecisionTrace } from './CognitiveEngine'
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
    this.dataPath = path.join(app.getPath('userData'), 'cognitive', 'distiller')
    this.recordsPath = path.join(this.dataPath, 'records.json')
    this.suggestionsPath = path.join(this.dataPath, 'suggestions.json')
    
    this.ensureDirectories()
  }

  private ensureDirectories(): void {
    try {
      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true })
      }
      // 初始化记录文件
      if (!fs.existsSync(this.recordsPath)) {
        fs.writeFileSync(this.recordsPath, JSON.stringify({ records: [], updatedAt: Date.now() }))
      }
      if (!fs.existsSync(this.suggestionsPath)) {
        fs.writeFileSync(this.suggestionsPath, JSON.stringify({ suggestions: [], updatedAt: Date.now() }))
      }
    } catch (error) {
      console.error('Distiller: 初始化目录失败', error)
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
      const shouldUseSystem1 = this.analyzeShouldUseSystem1(record)
      
      if (shouldSystem1ButUsedSystem2(record)) {
        // 情况1: 原本应该用 System 1 但用了 System 2
        // 这种情况说明 System 1 需要学习
        await this.learnFromUnderutilizedSystem1(record)
      } else if (system2FailedWithSystem1(record)) {
        // 情况2: System 2 失败，如果是简单任务可能 System 1 也会失败
        // 记录这种情况用于调整阈值
        await this.recordFailurePattern(record)
      } else if (successWithSystem2(record) && isSimpleTask(record)) {
        // 情况3: System 2 成功完成任务，且是简单任务
        //检查是否可以从 System 2 蒸馏判断逻辑到 System 1
        await selfDistillToSystem1(record)
      }

      // 标记为已蒸馏
      this.markAsDistilled(record.id)
      
    } catch (error) {
      console.error('Distiller: 蒸馏学习失败', error)
    }
  }

  private analyzeShouldUseSystem1(record: DistillationRecord): boolean {
    const { features, complexity } = record
    
    // 简单任务特征
    if (complexity === 'low' && !features.hasMultiStep && !features.hasCondition) {
      return true
    }
    
    // 纯浏览器操作
    if (features.isBrowserOperation && !features.hasMultiStep && instructionLength < 50) {
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

      const response = await llmService.chat('deepseek', [
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
}

// 导出单例
export const distiller = new Distiller()
