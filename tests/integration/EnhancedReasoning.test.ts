/**
 * 增强推理引擎测试
 * 测试EnhancedReActEngine、ThoughtTreeEngine和UnifiedReasoningEngine
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { EnhancedReActEngine } from '../../src/main/agent/EnhancedReActEngine'
import { ThoughtTreeEngine } from '../../src/main/agent/ThoughtTreeEngine'
import { UnifiedReasoningEngine, ReasoningMode } from '../../src/main/agent/UnifiedReasoningEngine'
import { ReActStep, ReActStepType } from '../../src/main/agent/ReActEngine'

describe('EnhancedReActEngine', () => {
  let engine: EnhancedReActEngine

  beforeEach(() => {
    engine = new EnhancedReActEngine()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('工具能力管理', () => {
    it('应该初始化默认工具能力', () => {
      const capabilities = engine.getToolCapabilities()
      
      expect(capabilities.length).toBeGreaterThan(0)
      expect(capabilities.some((c: any) => c.name === 'read_file')).toBe(true)
      expect(capabilities.some((c: any) => c.name === 'write_file')).toBe(true)
      expect(capabilities.some((c: any) => c.name === 'execute_command')).toBe(true)
    })

    it('应该返回正确的工具能力', () => {
      const capability = engine['getToolCapability']('read_file')
      
      expect(capability).toBeDefined()
      expect(capability?.name).toBe('read_file')
      expect(capability?.capabilities).toContain('read')
      expect(capability?.successRate).toBeGreaterThan(0)
    })
  })

  describe('经验库管理', () => {
    it('应该记录经验', () => {
      const mockTrace = {
        id: 'test_trace',
        task: '测试任务',
        steps: [
          {
            id: 'step_1',
            type: ReActStepType.ACT,
            action: 'read_file',
            actionInput: { path: '/test/file.txt' },
            observation: '文件内容',
            timestamp: Date.now()
          }
        ],
        maxIterations: 10,
        currentStep: 1,
        success: true,
        totalDurationMs: 1000,
        createdAt: Date.now()
      }

      engine['recordExperience']('测试任务', mockTrace)
      
      const library = engine.getExperienceLibrary()
      expect(library.size).toBeGreaterThan(0)
    })

    it('应该找到相似的经验', () => {
      const experiences = engine['findSimilarExperiences']('读取文件内容')
      
      expect(Array.isArray(experiences)).toBe(true)
    })
  })

  describe('深度反思', () => {
    it('应该分析错误', async () => {
      const mockStep: ReActStep = {
        id: 'step_1',
        type: ReActStepType.ACT,
        action: 'read_file',
        actionInput: { path: '/nonexistent/file.txt' },
        observation: 'Error: File not found',
        error: 'File not found',
        timestamp: Date.now()
      }

      const mockTrace = {
        id: 'test_trace',
        task: '测试任务',
        steps: [mockStep],
        maxIterations: 10,
        currentStep: 1,
        success: false,
        totalDurationMs: 1000,
        createdAt: Date.now()
      }

      const reflection = await engine.performDeepReflection(
        mockStep,
        mockTrace,
        []
      )

      expect(reflection).toBeDefined()
      expect(reflection.success).toBe(false)
      expect(reflection.errorAnalysis).toBeDefined()
      expect(reflection.errorAnalysis?.type).toBe('parameter_error')
    })

    it('应该生成洞察', async () => {
      const mockStep: ReActStep = {
        id: 'step_1',
        type: ReActStepType.ACT,
        action: 'read_file',
        actionInput: { path: '/test/file.txt' },
        observation: '文件内容',
        timestamp: Date.now()
      }

      const mockTrace = {
        id: 'test_trace',
        task: '测试任务',
        steps: [mockStep],
        maxIterations: 10,
        currentStep: 1,
        success: true,
        totalDurationMs: 1000,
        createdAt: Date.now()
      }

      const reflection = await engine.performDeepReflection(
        mockStep,
        mockTrace,
        []
      )

      expect(reflection).toBeDefined()
      expect(reflection.success).toBe(true)
      expect(reflection.learning.insights).toBeDefined()
      expect(reflection.learning.insights.length).toBeGreaterThan(0)
    })
  })

  describe('智能工具选择', () => {
    it('应该选择最佳工具', async () => {
      const selection = await engine.selectBestTool(
        '读取文件内容',
        {},
        ['read_file', 'write_file', 'execute_command'],
        []
      )

      expect(selection).toBeDefined()
      expect(selection.tool).toBe('read_file')
      expect(selection.confidence).toBeGreaterThan(0)
      expect(selection.alternatives).toBeDefined()
    })
  })

  describe('自我一致性评估', () => {
    it('应该评估多个轨迹', async () => {
      const mockTraces = [
        {
          id: 'trace_1',
          task: '测试任务',
          steps: [],
          maxIterations: 10,
          currentStep: 1,
          success: true,
          finalAnswer: '答案1',
          totalDurationMs: 1000,
          createdAt: Date.now()
        },
        {
          id: 'trace_2',
          task: '测试任务',
          steps: [],
          maxIterations: 10,
          currentStep: 1,
          success: true,
          finalAnswer: '答案1',
          totalDurationMs: 1000,
          createdAt: Date.now()
        }
      ]

      const evaluation = await engine.evaluateConsistency(mockTraces, '测试任务')

      expect(evaluation).toBeDefined()
      expect(evaluation.traces.length).toBe(2)
      expect(evaluation.consensus.confidence).toBeGreaterThan(0)
      expect(evaluation.bestTrace).toBeDefined()
    })
  })
})

describe('ThoughtTreeEngine', () => {
  let engine: ThoughtTreeEngine

  beforeEach(() => {
    engine = new ThoughtTreeEngine()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('思维树创建', () => {
    it('应该创建根节点', () => {
      const root = engine['createRootNode']('测试任务')

      expect(root).toBeDefined()
      expect(root.id).toBe('root')
      expect(root.depth).toBe(0)
      expect(root.status).toBe('completed')
    })

    it('应该创建子节点', () => {
      const parent = engine['createRootNode']('测试任务')
      const child = engine['createChildNode'](
        parent,
        '子节点思考',
        'read_file',
        { path: '/test/file.txt' },
        0.8
      )

      expect(child).toBeDefined()
      expect(child.parentId).toBe(parent.id)
      expect(child.depth).toBe(1)
      expect(child.confidence).toBe(0.8)
      expect(parent.children).toContain(child)
    })
  })

  describe('分支选择', () => {
    it('应该选择最佳分支', () => {
      const children = [
        {
          id: 'child_1',
          parentId: 'root',
          depth: 1,
          thought: '思考1',
          confidence: 0.6,
          status: 'pending' as const,
          children: [],
          timestamp: Date.now()
        },
        {
          id: 'child_2',
          parentId: 'root',
          depth: 1,
          thought: '思考2',
          confidence: 0.9,
          status: 'pending' as const,
          children: [],
          timestamp: Date.now()
        },
        {
          id: 'child_3',
          parentId: 'root',
          depth: 1,
          thought: '思考3',
          confidence: 0.7,
          status: 'pending' as const,
          children: [],
          timestamp: Date.now()
        }
      ]

      const selected = engine['selectChildren'](children, {
        type: 'beam',
        beamWidth: 2
      })

      expect(selected.length).toBe(2)
      expect(selected[0].confidence).toBeGreaterThanOrEqual(selected[1].confidence)
    })

    it('应该使用自适应选择', () => {
      const children = [
        {
          id: 'child_1',
          parentId: 'root',
          depth: 1,
          thought: '思考1',
          confidence: 0.9,
          status: 'pending' as const,
          children: [],
          timestamp: Date.now(),
          metadata: {
            alternatives: ['替代方案1', '替代方案2']
          }
        },
        {
          id: 'child_2',
          parentId: 'root',
          depth: 1,
          thought: '思考2',
          confidence: 0.8,
          status: 'pending' as const,
          children: [],
          timestamp: Date.now()
        }
      ]

      const selected = engine['adaptiveSelection'](children, {
        type: 'adaptive',
        confidenceThreshold: 0.3,
        diversityBonus: 0.2
      })

      expect(selected.length).toBeGreaterThan(0)
    })
  })

  describe('回溯机制', () => {
    it('应该检测需要回溯', () => {
      const mockTree = {
        id: 'test_tree',
        task: '测试任务',
        root: {
          id: 'root',
          parentId: null,
          depth: 0,
          thought: '根节点',
          confidence: 1.0,
          status: 'completed' as const,
          children: [
            {
              id: 'child_1',
              parentId: 'root',
              depth: 1,
              thought: '子节点1',
              confidence: 0.1,
              status: 'completed' as const,
              children: [],
              timestamp: Date.now()
            }
          ],
          timestamp: Date.now()
        },
        nodes: new Map(),
        maxDepth: 5,
        currentDepth: 1,
        totalNodes: 2,
        prunedNodes: 0,
        bestPath: [],
        createdAt: Date.now()
      }

      const node = mockTree.root.children[0]
      const decision = engine['shouldBacktrack'](mockTree, node, {
        pruningThreshold: 0.2
      })

      expect(decision).toBeDefined()
      expect(decision?.reason).toBe('low_confidence')
    })
  })

  describe('最佳路径查找', () => {
    it('应该找到最佳路径', () => {
      const mockTree = {
        id: 'test_tree',
        task: '测试任务',
        root: {
          id: 'root',
          parentId: null,
          depth: 0,
          thought: '根节点',
          confidence: 1.0,
          status: 'completed' as const,
          children: [],
          timestamp: Date.now()
        },
        nodes: new Map(),
        maxDepth: 5,
        currentDepth: 1,
        totalNodes: 1,
        prunedNodes: 0,
        bestPath: [],
        createdAt: Date.now()
      }

      const bestPath = engine['findBestPath'](mockTree, {
        diversityWeight: 0.3,
        confidenceWeight: 0.4,
        efficiencyWeight: 0.3
      })

      expect(bestPath).toBeDefined()
      expect(bestPath.length).toBeGreaterThan(0)
    })
  })
})

describe('UnifiedReasoningEngine', () => {
  let engine: UnifiedReasoningEngine

  beforeEach(() => {
    engine = new UnifiedReasoningEngine()
  })

  afterEach(() => {
    jest.clearAllMocks()
    engine.clearComplexityCache()
  })

  describe('复杂度评估', () => {
    it('应该评估低复杂度任务', async () => {
      const assessment = await engine.assessComplexity('简单任务')

      expect(assessment).toBeDefined()
      expect(assessment.complexity).toBe('low')
      expect(assessment.confidence).toBeGreaterThan(0)
    })

    it('应该评估高复杂度任务', async () => {
      const assessment = await engine.assessComplexity(
        '创建一个完整的项目，包含前端、后端和数据库，然后部署到服务器'
      )

      expect(assessment).toBeDefined()
      expect(['medium', 'high']).toContain(assessment.complexity)
    })

    it('应该缓存复杂度评估结果', async () => {
      const task = '测试任务'
      
      await engine.assessComplexity(task)
      const assessment2 = await engine.assessComplexity(task)

      expect(engine.getComplexityCache().size).toBeGreaterThan(0)
    })
  })

  describe('模式推荐', () => {
    it('应该为低复杂度任务推荐ReAct模式', async () => {
      const complexity = await engine.assessComplexity('简单任务')
      const mode = engine['recommendMode'](complexity, {})

      expect(mode).toBe(ReasoningMode.REACT)
    })

    it('应该为高复杂度任务推荐混合模式', async () => {
      const complexity = await engine.assessComplexity(
        '创建一个完整的项目，包含前端、后端和数据库，然后部署到服务器'
      )
      const mode = engine['recommendMode'](complexity, {})

      expect([ReasoningMode.HYBRID, ReasoningMode.THOUGHT_TREE]).toContain(mode)
    })
  })

  describe('统一推理', () => {
    it('应该使用推荐模式进行推理', async () => {
      const result = await engine.reason('简单任务', {})

      expect(result).toBeDefined()
      expect(result.mode).toBeDefined()
      expect(result.success).toBeDefined()
    })

    it('应该支持指定推理模式', async () => {
      const result = await engine.reason('测试任务', {
        mode: ReasoningMode.ENHANCED_REACT
      })

      expect(result).toBeDefined()
      expect(result.mode).toBe(ReasoningMode.ENHANCED_REACT)
    })

    it('应该返回推理统计信息', async () => {
      const result = await engine.reason('测试任务', {})

      expect(result.statistics).toBeDefined()
      expect(result.statistics?.totalDurationMs).toBeGreaterThan(0)
    })
  })
})
