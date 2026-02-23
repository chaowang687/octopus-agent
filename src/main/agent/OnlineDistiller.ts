/**
 * 在线蒸馏器 (OnlineDistiller)
 * 在执行任务前，从互联网获取相关信息并进行知识蒸馏
 * 形成即时技能包，增强System 2的决策能力
 */

import { llmService } from '../services/LLMService'
import { cognitiveEngine } from './CognitiveEngine'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

// ============================================
// 在线蒸馏相关接口
// ============================================

export interface OnlineDistillationRequest {
  instruction: string
  taskType: 'analysis' | 'design' | 'development' | 'testing' | 'deployment' | 'general'
  complexity: 'low' | 'medium' | 'high'
  enableWebSearch: boolean
  maxSources: number
}

export interface DistilledSkill {
  id: string
  name: string
  description: string
  taskType: string
  triggerPatterns: string[]
  complexityThreshold: number
  confidenceThreshold: number
  expectedBehavior: {
    recommendedSystem: 'system1' | 'system2'
    recommendedTools?: string[]
    requiresMultiStep: boolean
  }
  distilledKnowledge: {
    coreConcepts: string[]
    keySteps: string[]
    bestPractices: string[]
    codeTemplates?: string[]
    references: string[]
    warnings: string[]
  }
  sources: {
    url: string
    credibility: number
    relevance: number
  }[]
  createdAt: number
  version: number
}

export interface DistillationCache {
  key: string
  skill: DistilledSkill
  timestamp: number
  hitCount: number
  lastUsed: number
}

export interface OnlineDistillationResult {
  success: boolean
  skill?: DistilledSkill
  sourcesUsed: number
  distillationTime: number
  cacheHit: boolean
  error?: string
}

// ============================================
// 在线蒸馏器核心类
// ============================================

export class OnlineDistiller {
  private dataPath: string
  private cachePath: string
  private distillationHistoryPath: string
  
  private distillationCache: Map<string, DistillationCache> = new Map()
  private maxCacheSize = 100
  private cacheTTL = 7 * 24 * 60 * 60 * 1000 // 7天

  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'cognitive', 'online_distiller')
    this.cachePath = path.join(this.dataPath, 'cache.json')
    this.distillationHistoryPath = path.join(this.dataPath, 'history.json')
    
    this.ensureDirectories()
    this.loadCache()
  }

  private ensureDirectories(): void {
    try {
      const parentDir = path.dirname(this.dataPath)
      if (!fs.existsSync(parentDir)) {
        try {
          fs.mkdirSync(parentDir, { recursive: true, mode: 0o755 })
        } catch (error) {
          console.warn('OnlineDistiller: 无法创建父目录，将使用内存存储', error)
        }
      }
      if (!fs.existsSync(this.dataPath)) {
        try {
          fs.mkdirSync(this.dataPath, { recursive: true, mode: 0o755 })
        } catch (error) {
          console.warn('OnlineDistiller: 无法创建数据目录，将使用内存存储', error)
        }
      }
      if (!fs.existsSync(this.cachePath)) {
        try {
          fs.writeFileSync(this.cachePath, JSON.stringify({ cache: [] }), { mode: 0o644 })
        } catch (error) {
          console.warn('OnlineDistiller: 无法创建缓存文件，将使用内存存储', error)
        }
      }
      if (!fs.existsSync(this.distillationHistoryPath)) {
        try {
          fs.writeFileSync(this.distillationHistoryPath, JSON.stringify({ history: [] }), { mode: 0o644 })
        } catch (error) {
          console.warn('OnlineDistiller: 无法创建历史文件，将使用内存存储', error)
        }
      }
    } catch (error) {
      console.warn('OnlineDistiller: 初始化目录失败，将使用内存存储', error)
    }
  }

  private loadCache(): void {
    try {
      const data = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'))
      const cacheEntries = data.cache || []
      
      cacheEntries.forEach((entry: DistillationCache) => {
        if (Date.now() - entry.timestamp < this.cacheTTL) {
          this.distillationCache.set(entry.key, entry)
        }
      })
      
      console.log(`OnlineDistiller: 加载缓存 ${this.distillationCache.size} 条`)
    } catch (error) {
      console.error('OnlineDistiller: 加载缓存失败', error)
    }
  }

  private saveCache(): void {
    try {
      const cacheEntries = Array.from(this.distillationCache.values())
        .filter(entry => Date.now() - entry.timestamp < this.cacheTTL)
        .slice(-this.maxCacheSize)
      
      fs.writeFileSync(this.cachePath, JSON.stringify({ cache: cacheEntries }, null, 2))
    } catch (error) {
      console.error('OnlineDistiller: 保存缓存失败', error)
    }
  }

  // ============================================
  // 主蒸馏流程
  // ============================================

  /**
   * 执行在线蒸馏
   */
  async distillOnline(request: OnlineDistillationRequest): Promise<OnlineDistillationResult> {
    const startTime = Date.now()
    
    try {
      // 1. 检查缓存
      const cacheKey = this.generateCacheKey(request)
      const cached = this.distillationCache.get(cacheKey)
      
      if (cached) {
        console.log(`OnlineDistiller: 缓存命中 - ${cached.skill.name}`)
        cached.hitCount++
        cached.lastUsed = Date.now()
        this.saveCache()
        
        return {
          success: true,
          skill: cached.skill,
          sourcesUsed: 0,
          distillationTime: Date.now() - startTime,
          cacheHit: true
        }
      }

      // 2. 分析任务，确定搜索策略
      const searchStrategy = this.analyzeTaskAndGenerateSearchStrategy(request)
      
      // 3. 执行信息爬取
      const gatheredInfo = await this.gatherInformation(searchStrategy, request)
      
      if (gatheredInfo.sources.length === 0) {
        console.warn('OnlineDistiller: 未获取到相关信息，使用基础蒸馏')
        return {
          success: false,
          sourcesUsed: 0,
          distillationTime: Date.now() - startTime,
          cacheHit: false,
          error: '未获取到相关信息'
        }
      }

      // 4. 知识蒸馏
      const distilledSkill = await this.performKnowledgeDistillation(request, gatheredInfo)
      
      // 5. 验证和优化技能
      const validatedSkill = await this.validateAndOptimizeSkill(distilledSkill, gatheredInfo)
      
      // 6. 缓存结果
      this.cacheResult(cacheKey, validatedSkill)
      
      // 7. 记录历史
      this.recordDistillationHistory(request, validatedSkill, gatheredInfo)
      
      console.log(`OnlineDistiller: 蒸馏完成 - ${validatedSkill.name}, 使用 ${gatheredInfo.sources.length} 个信息源`)
      
      return {
        success: true,
        skill: validatedSkill,
        sourcesUsed: gatheredInfo.sources.length,
        distillationTime: Date.now() - startTime,
        cacheHit: false
      }
      
    } catch (error: any) {
      console.error('OnlineDistiller: 蒸馏失败', error)
      return {
        success: false,
        sourcesUsed: 0,
        distillationTime: Date.now() - startTime,
        cacheHit: false,
        error: error.message
      }
    }
  }

  // ============================================
  // 任务分析与搜索策略
  // ============================================

  private analyzeTaskAndGenerateSearchStrategy(request: OnlineDistillationRequest): {
    searchQueries: string[]
    targetDomains: string[]
    informationTypes: string[]
    prioritySources: string[]
  } {
    const { instruction, taskType } = request
    
    // 基于任务类型生成搜索策略
    const strategies = {
      analysis: {
        searchQueries: [
          `${instruction} 分析方法`,
          `${instruction} 最佳实践`,
          `${instruction} 设计模式`
        ],
        targetDomains: ['stackoverflow.com', 'github.com', 'medium.com', 'dev.to'],
        informationTypes: ['技术文档', '案例分析', '最佳实践'],
        prioritySources: ['官方文档', '技术博客', 'GitHub仓库']
      },
      design: {
        searchQueries: [
          `${instruction} 架构设计`,
          `${instruction} 系统设计`,
          `${instruction} 技术选型`
        ],
        targetDomains: ['architect.io', 'infoq.cn', 'martinfowler.com'],
        informationTypes: ['架构图', '设计文档', '技术对比'],
        prioritySources: ['架构博客', '技术白皮书']
      },
      development: {
        searchQueries: [
          `${instruction} 实现教程`,
          `${instruction} 代码示例`,
          `${instruction} 开发指南`
        ],
        targetDomains: ['github.com', 'gitlab.com', 'stackoverflow.com', 'tutorialspoint.com'],
        informationTypes: ['代码示例', '实现步骤', 'API文档'],
        prioritySources: ['GitHub仓库', '官方教程', '技术论坛']
      },
      testing: {
        searchQueries: [
          `${instruction} 测试方法`,
          `${instruction} 测试工具`,
          `${instruction} 质量保证`
        ],
        targetDomains: ['testingjavascript.com', 'testautomationuniversity.com'],
        informationTypes: ['测试策略', '测试用例', '工具推荐'],
        prioritySources: ['测试博客', '测试框架文档']
      },
      deployment: {
        searchQueries: [
          `${instruction} 部署方案`,
          `${instruction} CI/CD配置`,
          `${instruction} 运维最佳实践`
        ],
        targetDomains: ['devops.com', 'jenkins.io', 'docker.com'],
        informationTypes: ['部署流程', '配置示例', '运维指南'],
        prioritySources: ['官方部署文档', 'DevOps社区']
      },
      general: {
        searchQueries: [
          instruction,
          `${instruction} 指南`,
          `${instruction} 教程`
        ],
        targetDomains: ['google.com', 'bing.com', 'duckduckgo.com'],
        informationTypes: ['综合信息', '教程', '问答'],
        prioritySources: ['搜索引擎结果']
      }
    }

    return strategies[taskType] || strategies.general
  }

  // ============================================
  // 信息爬取
  // ============================================

  private async gatherInformation(
    strategy: any,
    request: OnlineDistillationRequest
  ): Promise<{
    sources: Array<{ url: string; content: string; credibility: number; relevance: number }>
    totalContent: string
  }> {
    const sources: Array<{ url: string; content: string; credibility: number; relevance: number }> = []
    
    if (!request.enableWebSearch) {
      return { sources, totalContent: '' }
    }

    // 限制爬取数量
    const maxSources = Math.min(request.maxSources, strategy.searchQueries.length * 2)
    
    for (let i = 0; i < strategy.searchQueries.length && sources.length < maxSources; i++) {
      const query = strategy.searchQueries[i]
      
      try {
        // 使用搜索API获取相关URL
        const searchResults = await this.searchWeb(query)
        
        for (const result of searchResults.slice(0, 2)) {
          if (sources.length >= maxSources) break
          
          try {
            const content = await this.fetchWebContent(result.url)
            
            // 评估相关性和可信度
            const relevance = this.calculateRelevance(query, content)
            const credibility = this.calculateCredibility(result.url, strategy.prioritySources)
            
            if (relevance > 0.3 && credibility > 0.4) {
              sources.push({
                url: result.url,
                content,
                credibility,
                relevance
              })
            }
          } catch (fetchError) {
            console.warn(`OnlineDistiller: 爬取失败 ${result.url}`, fetchError)
          }
        }
      } catch (searchError) {
        console.warn(`OnlineDistiller: 搜索失败 ${query}`, searchError)
      }
    }

    const totalContent = sources.map(s => s.content).join('\n\n---\n\n')
    
    return { sources, totalContent }
  }

  private async searchWeb(query: string): Promise<Array<{ url: string; title: string }>> {
    // 这里简化实现，实际应该调用搜索API
    // 可以使用Google Custom Search API, Bing Search API等
    
    // 模拟搜索结果（实际项目中需要替换为真实API调用）
    const mockResults = [
      { url: `https://example.com/search?q=${encodeURIComponent(query)}`, title: `搜索结果: ${query}` },
      { url: `https://github.com/search?q=${encodeURIComponent(query)}`, title: `GitHub: ${query}` }
    ]
    
    return mockResults
  }

  private async fetchWebContent(url: string): Promise<string> {
    try {
      // 使用项目的fetch_webpage工具
      const { toolRegistry } = await import('./ToolRegistry')
      const fetchTool = toolRegistry.getTool('fetch_webpage')
      
      if (fetchTool) {
        const result = await fetchTool.handler({ url })
        if (result.content) {
          return result.content as string
        }
      }
      
      // 回退到axios
      const axios = (await import('axios')).default
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 10000
      })
      
      return response.data
    } catch (error) {
      throw new Error(`获取内容失败: ${error}`)
    }
  }

  private calculateRelevance(query: string, content: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/)
    const contentLower = content.toLowerCase()
    
    let matchCount = 0
    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        matchCount++
      }
    }
    
    return Math.min(1, matchCount / queryTerms.length)
  }

  private calculateCredibility(url: string, prioritySources: string[]): number {
    let credibility = 0.5 // 基础可信度
    
    // 基于域名评估
    if (url.includes('github.com') || url.includes('gitlab.com')) {
      credibility += 0.2
    }
    if (url.includes('stackoverflow.com') || url.includes('medium.com')) {
      credibility += 0.15
    }
    if (url.includes('official') || url.includes('docs.')) {
      credibility += 0.25
    }
    
    // 基于优先级源评估
    for (const source of prioritySources) {
      if (url.toLowerCase().includes(source.toLowerCase())) {
        credibility += 0.1
        break
      }
    }
    
    return Math.min(1, credibility)
  }

  // ============================================
  // 知识蒸馏
  // ============================================

  private async performKnowledgeDistillation(
    request: OnlineDistillationRequest,
    gatheredInfo: any
  ): Promise<DistilledSkill> {
    const prompt = this.generateDistillationPrompt(request, gatheredInfo)
    
    const response = await llmService.chat('doubao-seed-2-0-lite-260215', [
      {
        role: 'system',
        content: '你是一个专业的知识蒸馏专家，擅长从大量信息中提取核心知识，并将其结构化为可执行的技能包。'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      max_tokens: 4000,
      temperature: 0.3
    })

    if (!response.success || !response.content) {
      throw new Error('蒸馏请求失败')
    }

    // 解析LLM响应
    const distilledData = this.parseDistillationResponse(response.content)
    
    return {
      id: `online_skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: distilledData.name,
      description: distilledData.description,
      taskType: request.taskType,
      triggerPatterns: distilledData.triggerPatterns,
      complexityThreshold: request.complexity === 'low' ? 0.3 : request.complexity === 'medium' ? 0.5 : 0.7,
      confidenceThreshold: distilledData.confidence || 0.7,
      expectedBehavior: {
        recommendedSystem: 'system2',
        recommendedTools: distilledData.recommendedTools,
        requiresMultiStep: distilledData.requiresMultiStep
      },
      distilledKnowledge: distilledData.knowledge,
      sources: gatheredInfo.sources.map((s: any) => ({
        url: s.url,
        credibility: s.credibility,
        relevance: s.relevance
      })),
      createdAt: Date.now(),
      version: 1
    }
  }

  private generateDistillationPrompt(request: OnlineDistillationRequest, gatheredInfo: any): string {
    const { instruction, taskType, complexity } = request
    
    return `请对以下信息进行知识蒸馏，为任务"${instruction}"创建一个即时技能包。

## 任务信息
- 任务描述: ${instruction}
- 任务类型: ${taskType}
- 复杂度: ${complexity}

## 获取到的信息（共${gatheredInfo.sources.length}个来源）

${gatheredInfo.sources.map((source: any, index: number) => `
### 来源 ${index + 1}: ${source.url}
- 可信度: ${(source.credibility * 100).toFixed(0)}%
- 相关性: ${(source.relevance * 100).toFixed(0)}%
- 内容摘要: ${source.content.slice(0, 500)}...
`).join('\n')}

## 蒸馏要求

请执行以下操作：

1. **信息筛选**: 去除重复、低质量、过时的信息
2. **核心概念提取**: 提取3-5个关键概念
3. **关键步骤总结**: 总结完成任务的3-7个核心步骤
4. **最佳实践**: 列出2-4个重要注意事项或最佳实践
5. **代码模板**: 如果涉及代码，提供1-2个代码模板（可选）
6. **参考资源**: 列出最相关的3-5个资源链接
7. **风险提示**: 列出1-3个需要特别注意的风险点

## 输出格式

请以JSON格式返回蒸馏结果：

\`\`\`json
{
  "name": "技能名称",
  "description": "技能描述（1-2句话）",
  "triggerPatterns": ["触发模式1", "触发模式2"],
  "confidence": 0.8,
  "recommendedTools": ["工具1", "工具2"],
  "requiresMultiStep": true,
  "knowledge": {
    "coreConcepts": ["概念1", "概念2", "概念3"],
    "keySteps": ["步骤1", "步骤2", "步骤3"],
    "bestPractices": ["实践1", "实践2"],
    "codeTemplates": ["代码模板1"],
    "references": ["参考1", "参考2", "参考3"],
    "warnings": ["警告1", "警告2"]
  }
}
\`\`\`

注意：
- 技能名称应该简洁明了，体现核心能力
- 触发模式应该能够匹配类似任务
- 知识应该实用、可操作
- 代码模板应该简洁、注释清晰
`
  }

  private parseDistillationResponse(content: string): any {
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }
      
      return JSON.parse(content)
    } catch (error) {
      console.error('OnlineDistiller: 解析蒸馏响应失败', error)
      
      // 提供默认结构
      return {
        name: '通用技能',
        description: '从在线信息蒸馏的技能',
        triggerPatterns: ['.*'],
        confidence: 0.6,
        recommendedTools: [],
        requiresMultiStep: true,
        knowledge: {
          coreConcepts: [],
          keySteps: [],
          bestPractices: [],
          references: [],
          warnings: []
        }
      }
    }
  }

  // ============================================
  // 技能验证与优化
  // ============================================

  private async validateAndOptimizeSkill(
    skill: DistilledSkill,
    gatheredInfo: any
  ): Promise<DistilledSkill> {
    // 1. 验证技能完整性
    const validation = await this.validateSkillCompleteness(skill)
    
    if (!validation.isValid) {
      console.warn(`OnlineDistiller: 技能验证失败 - ${validation.reasons.join(', ')}`)
      
      // 尝试修复
      return await this.fixSkillIssues(skill, validation.issues)
    }

    // 2. 优化技能描述
    const optimizedSkill = await this.optimizeSkillDescription(skill)
    
    // 3. 生成技能触发模式
    const enhancedPatterns = this.enhanceTriggerPatterns(optimizedSkill, gatheredInfo)
    
    return {
      ...optimizedSkill,
      triggerPatterns: enhancedPatterns
    }
  }

  private async validateSkillCompleteness(skill: DistilledSkill): Promise<{
    isValid: boolean
    reasons: string[]
    issues: string[]
  }> {
    const issues: string[] = []
    
    if (!skill.name || skill.name.length < 3) {
      issues.push('技能名称过短')
    }
    
    if (!skill.description || skill.description.length < 10) {
      issues.push('技能描述不完整')
    }
    
    if (skill.triggerPatterns.length === 0) {
      issues.push('缺少触发模式')
    }
    
    if (skill.distilledKnowledge.coreConcepts.length === 0) {
      issues.push('缺少核心概念')
    }
    
    if (skill.distilledKnowledge.keySteps.length === 0) {
      issues.push('缺少关键步骤')
    }
    
    return {
      isValid: issues.length === 0,
      reasons: issues,
      issues
    }
  }

  private async fixSkillIssues(skill: DistilledSkill, issues: string[]): Promise<DistilledSkill> {
    console.log('OnlineDistiller: 尝试修复技能问题')
    
    const fixedSkill = { ...skill }
    
    for (const issue of issues) {
      if (issue.includes('名称')) {
        fixedSkill.name = '增强型技能'
      }
      if (issue.includes('描述')) {
        fixedSkill.description = '从在线信息蒸馏的增强型技能'
      }
      if (issue.includes('触发模式')) {
        fixedSkill.triggerPatterns = ['.*']
      }
      if (issue.includes('核心概念')) {
        fixedSkill.distilledKnowledge.coreConcepts = ['通用概念']
      }
      if (issue.includes('关键步骤')) {
        fixedSkill.distilledKnowledge.keySteps = ['分析需求', '设计方案', '实现功能']
      }
    }
    
    return fixedSkill
  }

  private async optimizeSkillDescription(skill: DistilledSkill): Promise<DistilledSkill> {
    // 使用LLM优化技能描述
    const prompt = `请优化以下技能描述，使其更加清晰、简洁、专业：

当前描述: ${skill.description}
技能名称: ${skill.name}

请提供一个更好的描述（1-2句话）：`

    const response = await llmService.chat('doubao-seed-2-0-lite-260215', [
      {
        role: 'system',
        content: '你是一个技能描述优化专家'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      max_tokens: 200,
      temperature: 0.3
    })

    if (response.success && response.content) {
      return {
        ...skill,
        description: response.content.trim()
      }
    }
    
    return skill
  }

  private enhanceTriggerPatterns(skill: DistilledSkill, gatheredInfo: any): string[] {
    const enhancedPatterns = [...skill.triggerPatterns]
    
    // 基于信息源关键词生成额外触发模式
    const keywords = this.extractKeywords(gatheredInfo.totalContent)
    
    for (const keyword of keywords.slice(0, 3)) {
      const pattern = `.*${keyword}.*`
      if (!enhancedPatterns.includes(pattern)) {
        enhancedPatterns.push(pattern)
      }
    }
    
    return enhancedPatterns
  }

  private extractKeywords(content: string): string[] {
    const words = content.toLowerCase().match(/\b[a-z]{4,}\b/g) || []
    const frequency: Record<string, number> = {}
    
    for (const word of words) {
      frequency[word] = (frequency[word] || 0) + 1
    }
    
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0])
  }

  // ============================================
  // 缓存管理
  // ============================================

  private generateCacheKey(request: OnlineDistillationRequest): string {
    const normalized = `${request.taskType}_${request.complexity}_${request.instruction.slice(0, 50).replace(/\s+/g, '_')}`
    return normalized.toLowerCase()
  }

  private cacheResult(key: string, skill: DistilledSkill): void {
    this.distillationCache.set(key, {
      key,
      skill,
      timestamp: Date.now(),
      hitCount: 0,
      lastUsed: Date.now()
    })
    
    this.saveCache()
  }

  // ============================================
  // 历史记录
  // ============================================

  private recordDistillationHistory(
    request: OnlineDistillationRequest,
    skill: DistilledSkill,
    gatheredInfo: any
  ): void {
    try {
      const data = JSON.parse(fs.readFileSync(this.distillationHistoryPath, 'utf8'))
      
      data.history.push({
        request,
        skill: {
          id: skill.id,
          name: skill.name,
          taskType: skill.taskType
        },
        sourcesCount: gatheredInfo.sources.length,
        timestamp: Date.now()
      })
      
      // 保留最近100条记录
      if (data.history.length > 100) {
        data.history = data.history.slice(-100)
      }
      
      fs.writeFileSync(this.distillationHistoryPath, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('OnlineDistiller: 记录历史失败', error)
    }
  }

  // ============================================
  // 技能应用
  // ============================================

  /**
   * 将蒸馏的技能应用到认知引擎
   */
  async applyDistilledSkill(skill: DistilledSkill): Promise<void> {
    try {
      // 检查是否已存在相似技能
      const existingSkills = cognitiveEngine.getAllSkills()
      const similarSkill = existingSkills.find(s => 
        s.name === skill.name || 
        s.triggerPatterns.some(p => skill.triggerPatterns.includes(p))
      )
      
      if (similarSkill) {
        console.log(`OnlineDistiller: 更新现有技能 ${similarSkill.name}`)
        
        const existingKnowledge = similarSkill.judgmentLogic ? JSON.parse(similarSkill.judgmentLogic) : {}
        
        // 合并知识
        const mergedKnowledge = {
          coreConcepts: Array.from(new Set([
            ...(existingKnowledge.coreConcepts || []),
            ...skill.distilledKnowledge.coreConcepts
          ])),
          keySteps: Array.from(new Set([
            ...(existingKnowledge.keySteps || []),
            ...skill.distilledKnowledge.keySteps
          ])),
          bestPractices: Array.from(new Set([
            ...(existingKnowledge.bestPractices || []),
            ...skill.distilledKnowledge.bestPractices
          ]))
        }
        
        await cognitiveEngine.updateSkill(similarSkill.id, {
          triggerPatterns: Array.from(new Set([
            ...similarSkill.triggerPatterns,
            ...skill.triggerPatterns
          ])),
          confidenceThreshold: Math.max(
            similarSkill.confidenceThreshold,
            skill.confidenceThreshold
          ),
          description: `${similarSkill.description} (在线蒸馏增强)`,
          judgmentLogic: JSON.stringify(mergedKnowledge)
        })
        
      } else {
        console.log(`OnlineDistiller: 创建新技能 ${skill.name}`)
        
        // 创建新技能
        await cognitiveEngine.createSkill({
          name: skill.name,
          description: skill.description,
          triggerPatterns: skill.triggerPatterns,
          complexityThreshold: skill.complexityThreshold,
          confidenceThreshold: skill.confidenceThreshold,
          expectedBehavior: skill.expectedBehavior,
          judgmentLogic: JSON.stringify(skill.distilledKnowledge)
        })
      }
      
      console.log(`OnlineDistiller: 技能应用成功 - ${skill.name}`)
    } catch (error) {
      console.error('OnlineDistiller: 应用技能失败', error)
    }
  }

  /**
   * 批量应用蒸馏技能
   */
  async applyDistilledSkills(skills: DistilledSkill[]): Promise<{
    applied: number
    updated: number
    failed: number
  }> {
    let applied = 0
    let updated = 0
    let failed = 0
    
    for (const skill of skills) {
      try {
        await this.applyDistilledSkill(skill)
        
        const existingSkills = cognitiveEngine.getAllSkills()
        const exists = existingSkills.find(s => s.name === skill.name)
        
        if (exists) {
          updated++
        } else {
          applied++
        }
      } catch (error) {
        failed++
        console.error(`OnlineDistiller: 应用技能失败 ${skill.name}`, error)
      }
    }
    
    return { applied, updated, failed }
  }

  // ============================================
  // 统计与查询
  // ============================================

  getCacheStats(): {
    size: number
    hitRate: number
    topSkills: Array<{ name: string; hitCount: number }>
  } {
    const cacheEntries = Array.from(this.distillationCache.values())
    const totalHits = cacheEntries.reduce((sum, entry) => sum + entry.hitCount, 0)
    const hitRate = cacheEntries.length > 0 ? totalHits / cacheEntries.length : 0
    
    const topSkills = cacheEntries
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 5)
      .map(entry => ({
        name: entry.skill.name,
        hitCount: entry.hitCount
      }))
    
    return {
      size: this.distillationCache.size,
      hitRate,
      topSkills
    }
  }

  getDistillationHistory(limit: number = 10): Array<{
    request: OnlineDistillationRequest
    skill: { id: string; name: string; taskType: string }
    sourcesCount: number
    timestamp: number
  }> {
    try {
      const data = JSON.parse(fs.readFileSync(this.distillationHistoryPath, 'utf8'))
      return (data.history || []).slice(-limit)
    } catch {
      return []
    }
  }

  clearCache(): void {
    this.distillationCache.clear()
    this.saveCache()
    console.log('OnlineDistiller: 缓存已清除')
  }

  clearHistory(): void {
    try {
      fs.writeFileSync(this.distillationHistoryPath, JSON.stringify({ history: [] }))
      console.log('OnlineDistiller: 历史记录已清除')
    } catch (error) {
      console.error('OnlineDistiller: 清除历史失败', error)
    }
  }
}

let onlineDistillerInstance: OnlineDistiller | null = null

export function getOnlineDistiller(): OnlineDistiller {
  if (!onlineDistillerInstance) {
    onlineDistillerInstance = new OnlineDistiller()
  }
  return onlineDistillerInstance
}

export const onlineDistiller = getOnlineDistiller()
