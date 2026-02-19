import { SkillManager, AgentType, SkillCategory, SKILL_CATEGORIES, SkillMatch, SkillRetrievalResult } from '../../src/main/agent/SkillManager'
import { cognitiveEngine, CognitiveSkill } from '../../src/main/agent/CognitiveEngine'
import { onlineDistiller, DistilledSkill } from '../../src/main/agent/OnlineDistiller'

jest.mock('../../src/main/agent/CognitiveEngine')
jest.mock('../../src/main/agent/OnlineDistiller')
jest.mock('../../src/main/utils/ErrorHandler', () => {
  const actualModule = jest.requireActual('../../src/main/utils/ErrorHandler')
  const actualErrorHandler = actualModule.ErrorHandler
  
  return {
    ...actualModule,
    ErrorHandler: {
      ...actualErrorHandler,
      handleError: jest.fn((error: any, context: any) => {
        const message = error?.message || error || 'Unknown error'
        return {
          message,
          category: 'task_execution',
          severity: 'medium',
          context,
          userMessage: 'Task execution failed',
          name: 'AppError'
        }
      }),
      initialize: jest.fn(),
      createError: jest.fn(),
      wrapError: jest.fn(),
      categorizeError: jest.fn((error: any) => 'task_execution'),
      determineSeverity: jest.fn((error: any) => 'medium'),
      formatErrorForUser: jest.fn((error: any) => error.message),
      formatErrorForDeveloper: jest.fn((error: any) => JSON.stringify(error))
    }
  }
})

describe('SkillManager', () => {
  let skillManager: SkillManager

  beforeEach(() => {
    skillManager = new SkillManager()
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with correct paths', () => {
      expect(skillManager).toBeDefined()
      // 验证 SkillManager 实例创建成功
    })
  })

  describe('getSkillCategories', () => {
    it('should return all skill categories', () => {
      const categories = skillManager.getSkillCategories()
      expect(categories).toBeDefined()
      expect(Array.isArray(categories)).toBe(true)
      expect(categories.length).toBeGreaterThan(0)
      expect(categories[0]).toHaveProperty('id')
      expect(categories[0]).toHaveProperty('name')
      expect(categories[0]).toHaveProperty('description')
      expect(categories[0]).toHaveProperty('agentTypes')
      expect(categories[0]).toHaveProperty('taskTypes')
      expect(categories[0]).toHaveProperty('keywords')
    })

    it('should return filtered categories by agent type', () => {
      const categories = skillManager.getSkillCategories('project_manager')
      expect(categories).toBeDefined()
      expect(Array.isArray(categories)).toBe(true)
      categories.forEach(category => {
        expect(category.agentTypes).toContain('project_manager')
      })
    })
  })

  describe('getCategoriesByAgentType', () => {
    it('should return categories for project manager', () => {
      const categories = skillManager.getCategoriesByAgentType('project_manager')
      expect(categories).toBeDefined()
      expect(Array.isArray(categories)).toBe(true)
      expect(categories.length).toBeGreaterThan(0)
      categories.forEach(category => {
        expect(category.agentTypes).toContain('project_manager')
      })
    })

    it('should return categories for frontend developer', () => {
      const categories = skillManager.getCategoriesByAgentType('frontend_developer')
      expect(categories).toBeDefined()
      expect(Array.isArray(categories)).toBe(true)
      expect(categories.length).toBeGreaterThan(0)
      categories.forEach(category => {
        expect(category.agentTypes).toContain('frontend_developer')
      })
    })

    it('should return empty array for unknown agent type', () => {
      const categories = skillManager.getCategoriesByAgentType('unknown_agent' as AgentType)
      expect(categories).toBeDefined()
      expect(Array.isArray(categories)).toBe(true)
      expect(categories.length).toBe(0)
    })
  })

  describe('getCategoryById', () => {
    it('should return category by id', () => {
      const category = skillManager.getCategoryById('project_management')
      expect(category).toBeDefined()
      expect(category?.id).toBe('project_management')
      expect(category?.name).toBe('项目管理')
    })

    it('should return undefined for unknown category id', () => {
      const category = skillManager.getCategoryById('unknown_category')
      expect(category).toBeUndefined()
    })
  })

  describe('getAgentTypes', () => {
    it('should return all agent types', () => {
      const agentTypes = skillManager.getAgentTypes()
      expect(agentTypes).toBeDefined()
      expect(Array.isArray(agentTypes)).toBe(true)
      expect(agentTypes.length).toBeGreaterThan(0)
      expect(agentTypes).toContain('project_manager')
      expect(agentTypes).toContain('frontend_developer')
      expect(agentTypes).toContain('backend_developer')
      expect(agentTypes).toContain('ui_designer')
      expect(agentTypes).toContain('tester')
      expect(agentTypes).toContain('devops')
      expect(agentTypes).toContain('architect')
      expect(agentTypes).toContain('analyst')
      expect(agentTypes).toContain('fullstack_developer')
      expect(agentTypes).toContain('general')
    })
  })

  describe('getAgentTypesForCategory', () => {
    it('should return agent types for project management category', () => {
      const agentTypes = skillManager.getAgentTypesForCategory('project_management')
      expect(agentTypes).toBeDefined()
      expect(Array.isArray(agentTypes)).toBe(true)
      expect(agentTypes).toContain('project_manager')
      expect(agentTypes).toContain('general')
    })

    it('should return empty array for unknown category', () => {
      const agentTypes = skillManager.getAgentTypesForCategory('unknown_category')
      expect(agentTypes).toBeDefined()
      expect(Array.isArray(agentTypes)).toBe(true)
      expect(agentTypes.length).toBe(0)
    })
  })

  describe('Skill categories constants', () => {
    it('should have correct skill categories', () => {
      expect(SKILL_CATEGORIES).toBeDefined()
      expect(Array.isArray(SKILL_CATEGORIES)).toBe(true)
      expect(SKILL_CATEGORIES.length).toBeGreaterThan(0)
      
      // 验证核心分类存在
      const categoryIds = SKILL_CATEGORIES.map(cat => cat.id)
      expect(categoryIds).toContain('project_management')
      expect(categoryIds).toContain('ui_design')
      expect(categoryIds).toContain('frontend')
      expect(categoryIds).toContain('backend')
      expect(categoryIds).toContain('testing')
      expect(categoryIds).toContain('devops')
      expect(categoryIds).toContain('architecture')
      expect(categoryIds).toContain('analysis')
    })

    it('should have correct properties for each category', () => {
      SKILL_CATEGORIES.forEach(category => {
        expect(category).toHaveProperty('id')
        expect(category).toHaveProperty('name')
        expect(category).toHaveProperty('description')
        expect(category).toHaveProperty('agentTypes')
        expect(category).toHaveProperty('taskTypes')
        expect(category).toHaveProperty('keywords')
        expect(Array.isArray(category.agentTypes)).toBe(true)
        expect(Array.isArray(category.taskTypes)).toBe(true)
        expect(Array.isArray(category.keywords)).toBe(true)
      })
    })
  })
})
