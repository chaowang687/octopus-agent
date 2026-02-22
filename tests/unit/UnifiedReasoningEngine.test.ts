/**
 * UnifiedReasoningEngine 单元测试
 * 测试复杂度评估、推理模式推荐和多种推理模式功能
 */

import { unifiedReasoningEngine, ReasoningMode, UnifiedReasoningOptions } from '../../src/main/agent/UnifiedReasoningEngine'

describe('UnifiedReasoningEngine', () => {
  beforeEach(() => {
    // 清除复杂度缓存，确保测试独立性
    unifiedReasoningEngine.clearComplexityCache()
  })

  describe('任务复杂度评估', () => {
    it('应该正确评估简单任务的复杂度', async () => {
      const task = '你好，今天天气怎么样？'
      const assessment = await unifiedReasoningEngine.assessComplexity(task)
      
      expect(assessment.complexity).toBe('low')
      expect(assessment.confidence).toBeGreaterThan(0.8)
      expect(assessment.factors.length).toBeLessThan(200)
      expect(assessment.factors.hasMultipleSteps).toBe(false)
      expect(assessment.factors.requiresExternalInfo).toBe(false)
      expect(assessment.factors.requiresCodeGeneration).toBe(false)
      expect(assessment.factors.requiresAnalysis).toBe(false)
    })

    it('应该正确评估中等复杂度任务的复杂度', async () => {
      const task = '分析一下这个项目的结构，然后创建一个简单的TODO列表'
      const assessment = await unifiedReasoningEngine.assessComplexity(task)
      
      expect(assessment.complexity).toBe('medium')
      expect(assessment.confidence).toBeGreaterThan(0.7)
      expect(assessment.factors.hasMultipleSteps).toBe(true)
      expect(assessment.factors.requiresAnalysis).toBe(true)
    })

    it('应该正确评估高复杂度任务的复杂度', async () => {
      const task = '搜索最新的React 19特性，然后创建一个完整的React应用，包含状态管理、路由和API调用'
      const assessment = await unifiedReasoningEngine.assessComplexity(task)
      
      expect(assessment.complexity).toBe('high')
      expect(assessment.confidence).toBeGreaterThan(0.6)
      expect(assessment.factors.hasMultipleSteps).toBe(true)
      expect(assessment.factors.requiresExternalInfo).toBe(true)
      expect(assessment.factors.requiresCodeGeneration).toBe(true)
      expect(assessment.factors.requiresAnalysis).toBe(true)
    })

    it('应该缓存复杂度评估结果', async () => {
      const task = '测试缓存功能'
      const firstAssessment = await unifiedReasoningEngine.assessComplexity(task)
      const secondAssessment = await unifiedReasoningEngine.assessComplexity(task)
      
      expect(secondAssessment).toEqual(firstAssessment)
    })
  })

  describe('推理模式推荐', () => {
    it('应该为简单任务推荐REACT模式', async () => {
      const task = '你好，今天天气怎么样？'
      const assessment = await unifiedReasoningEngine.assessComplexity(task)
      const options: UnifiedReasoningOptions = {}
      
      // 这里我们测试内部方法的逻辑
      // 由于是私有方法，我们通过测试reason方法来验证
      const result = await unifiedReasoningEngine.reason(task, options)
      
      // 对于简单任务，应该使用标准REACT模式或ENHANCED_REACT模式
      expect([ReasoningMode.REACT, ReasoningMode.ENHANCED_REACT]).toContain(result.mode)
    })

    it('应该为中等复杂度任务推荐ENHANCED_REACT模式', async () => {
      const task = '分析一下这个项目的结构，然后创建一个简单的TODO列表'
      const options: UnifiedReasoningOptions = {}
      
      const result = await unifiedReasoningEngine.reason(task, options)
      
      expect([ReasoningMode.ENHANCED_REACT]).toContain(result.mode)
    })

    it('应该为高复杂度任务推荐HYBRID模式', async () => {
      const task = '搜索最新的React 19特性，然后创建一个完整的React应用，包含状态管理、路由和API调用'
      const options: UnifiedReasoningOptions = {}
      
      const result = await unifiedReasoningEngine.reason(task, options)
      
      expect([ReasoningMode.HYBRID, ReasoningMode.ENHANCED_REACT]).toContain(result.mode)
    })

    it('应该尊重用户指定的推理模式', async () => {
      const task = '测试任务'
      const options: UnifiedReasoningOptions = {
        mode: ReasoningMode.THOUGHT_TREE
      }
      
      const result = await unifiedReasoningEngine.reason(task, options)
      
      expect(result.mode).toBe(ReasoningMode.THOUGHT_TREE)
    })
  })

  describe('推理功能', () => {
    it('应该能够使用标准REACT模式推理', async () => {
      const task = '1 + 1 等于多少？'
      const options: UnifiedReasoningOptions = {
        mode: ReasoningMode.REACT
      }
      
      const result = await unifiedReasoningEngine.reason(task, options)
      
      expect(result.success).toBe(true)
      expect(result.mode).toBe(ReasoningMode.REACT)
      expect(result.answer).toBeDefined()
      expect(result.trace).toBeDefined()
    })

    it('应该能够使用ENHANCED_REACT模式推理', async () => {
      const task = '2 + 2 等于多少？'
      const options: UnifiedReasoningOptions = {
        mode: ReasoningMode.ENHANCED_REACT,
        enableDeepReflection: true,
        enableExperienceLearning: true
      }
      
      const result = await unifiedReasoningEngine.reason(task, options)
      
      expect(result.success).toBe(true)
      expect(result.mode).toBe(ReasoningMode.ENHANCED_REACT)
      expect(result.answer).toBeDefined()
      expect(result.trace).toBeDefined()
    })

    it('应该能够使用THOUGHT_TREE模式推理', async () => {
      const task = '3 + 3 等于多少？'
      const options: UnifiedReasoningOptions = {
        mode: ReasoningMode.THOUGHT_TREE
      }
      
      const result = await unifiedReasoningEngine.reason(task, options)
      
      expect(result.success).toBe(true)
      expect(result.mode).toBe(ReasoningMode.THOUGHT_TREE)
      expect(result.answer).toBeDefined()
      expect(result.tree).toBeDefined()
    })

    it('应该能够使用HYBRID模式推理', async () => {
      const task = '4 + 4 等于多少？'
      const options: UnifiedReasoningOptions = {
        mode: ReasoningMode.HYBRID
      }
      
      const result = await unifiedReasoningEngine.reason(task, options)
      
      expect(result.success).toBe(true)
      expect(result.mode).toBe(ReasoningMode.HYBRID)
      expect(result.answer).toBeDefined()
    })
  })

  describe('错误处理', () => {
    it('应该优雅处理推理过程中的错误', async () => {
      const task = '测试错误处理'
      const options: UnifiedReasoningOptions = {
        maxIterations: 1, // 减少迭代次数以加速测试
        temperature: 1.5 // 使用较高的温度以增加随机性
      }
      
      const result = await unifiedReasoningEngine.reason(task, options)
      
      // 即使出错，也应该返回一个有效的结果对象
      expect(result).toBeDefined()
      expect(result.mode).toBeDefined()
      expect(result.confidence).toBeDefined()
    })
  })

  describe('辅助方法', () => {
    it('应该能够获取EnhancedReActEngine实例', () => {
      const enhancedReAct = unifiedReasoningEngine.getEnhancedReAct()
      expect(enhancedReAct).toBeDefined()
    })

    it('应该能够获取ThoughtTreeEngine实例', () => {
      const thoughtTree = unifiedReasoningEngine.getThoughtTree()
      expect(thoughtTree).toBeDefined()
    })

    it('应该能够获取复杂度缓存', () => {
      const cache = unifiedReasoningEngine.getComplexityCache()
      expect(cache).toBeDefined()
      expect(cache instanceof Map).toBe(true)
    })

    it('应该能够清除复杂度缓存', () => {
      const cache = unifiedReasoningEngine.getComplexityCache()
      
      // 先添加一些内容到缓存
      unifiedReasoningEngine.assessComplexity('测试缓存清除')
      expect(cache.size).toBeGreaterThan(0)
      
      // 清除缓存
      unifiedReasoningEngine.clearComplexityCache()
      expect(cache.size).toBe(0)
    })
  })
})
