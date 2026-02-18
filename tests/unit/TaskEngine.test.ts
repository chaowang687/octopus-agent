import { TaskEngine, TaskProgressEvent, AgentOptions } from '../../src/main/agent/TaskEngine'
import { planner, Plan, PlanStep } from '../../src/main/agent/Planner'
import { executor } from '../../src/main/agent/Executor'
import { llmService } from '../../src/main/services/LLMService'
import { cognitiveEngine, RoutingDecision } from '../../src/main/agent/CognitiveEngine'
import { modelRouter } from '../../src/main/agent/ModelRouter'

jest.mock('../../src/main/agent/Planner')
jest.mock('../../src/main/agent/Executor')
jest.mock('../../src/main/services/LLMService')
jest.mock('../../src/main/agent/CognitiveEngine')
jest.mock('../../src/main/agent/ModelRouter')
jest.mock('../../src/main/agent/MultiAgentCoordinator')
jest.mock('../../src/main/agent/MultiDialogueCoordinator')

jest.mock('../../src/main/agent/tools', () => ({}), { virtual: true })

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

describe('TaskEngine', () => {
  let taskEngine: TaskEngine

  beforeEach(() => {
    taskEngine = new TaskEngine()
    jest.clearAllMocks()
  })

  afterEach(() => {
    taskEngine.removeAllListeners()
  })

  describe('executeTask', () => {
    it('should execute task with default model', async () => {
      const mockDecision: RoutingDecision = {
        decisionId: 'test-decision',
        selectedSystem: 'system1',
        confidence: 0.9,
        reason: 'Test reason',
        durationMs: 100
      }

      const mockResponse = {
        success: true,
        response: { message: 'Test response' }
      }

      jest.spyOn(cognitiveEngine, 'routeWithEmotion').mockResolvedValue({
        ...mockDecision,
        emotion: { pleasure: 0.5, arousal: 0.3, urgency: 0.2, familiarity: 0.7, risk: 0.1, uncertainty: 0.1 },
        dynamicThreshold: 0.6,
        hasConflict: false,
        severity: 'low'
      } as any)

      jest.spyOn(modelRouter, 'getSystem1Model').mockReturnValue({
        model: 'test-model',
        options: {}
      })

      jest.spyOn(taskEngine as any, 'executeSystem1Task').mockResolvedValue(mockResponse)

      const result = await taskEngine.executeTask('Test instruction', 'openai')

      expect(result.success).toBe(true)
      expect(result.response).toBeDefined()
      expect(cognitiveEngine.routeWithEmotion).toHaveBeenCalled()
    })

    it('should use user specified system when provided', async () => {
      const agentOptions: AgentOptions = {
        system: 'system1',
        complexity: 'low'
      }

      const mockResponse = {
        success: true,
        response: { message: 'Test response' }
      }

      jest.spyOn(taskEngine as any, 'executeSystem1Task').mockResolvedValue(mockResponse)

      const result = await taskEngine.executeTask('Test instruction', 'openai', agentOptions)

      expect(result.success).toBe(true)
      expect(cognitiveEngine.routeWithEmotion).not.toHaveBeenCalled()
    })

    it('should handle errors and return error message', async () => {
      const mockError = new Error('Test error')
      jest.spyOn(cognitiveEngine, 'routeWithEmotion').mockRejectedValue(mockError)

      const result = await taskEngine.executeTask('Test instruction', 'openai')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('executeSystem1Task', () => {
    it('should execute system1 task successfully', async () => {
      const mockLLMResponse = {
        choices: [{
          message: {
            content: 'Test response'
          }
        }]
      }

      jest.spyOn(llmService, 'chat').mockResolvedValue(Promise.resolve(mockLLMResponse as any))

      const result = await (taskEngine as any).executeSystem1Task(
        'Test instruction',
        'test-model',
        {
          decisionId: 'test-decision',
          selectedSystem: 'system1',
          confidence: 0.9,
          reason: 'Test reason',
          durationMs: 100
        },
        'low',
        {}
      )

      expect(result.success).toBe(true)
      expect(result.result).toBeDefined()
    })
  })

  describe('executeSystem2Task', () => {
    it('should execute system2 task successfully', async () => {
      const mockPlan: Plan = {
        steps: [
          { id: 'step1', tool: 'test_tool', description: 'Test step', parameters: {} }
        ],
        reasoning: 'Test reasoning'
      }

      const mockExecutionResult = {
        success: true,
        stepResults: {
          step1: { output: 'Test output' }
        }
      }

      jest.spyOn(planner, 'createPlan').mockResolvedValue(mockPlan)
      jest.spyOn(executor, 'executePlan').mockResolvedValue(mockExecutionResult)
      jest.spyOn(llmService, 'getApiKey').mockReturnValue('test-key')

      const result = await (taskEngine as any).executeSystem2Task(
        'Test instruction',
        'test-model',
        undefined,
        {
          decisionId: 'test-decision',
          selectedSystem: 'system2',
          confidence: 0.9,
          reason: 'Test reason',
          durationMs: 100
        },
        'medium',
        {}
      )

      expect(result.success).toBe(true)
      expect(result.plan).toBeDefined()
      expect(result.result).toBeDefined()
    })
  })

  describe('clearHistory', () => {
    it('should clear conversation history', () => {
      const messages = [
        { role: 'user' as const, content: 'User message' },
        { role: 'assistant' as const, content: 'Assistant message' }
      ]

      ;(taskEngine as any).history = messages

      taskEngine.clearHistory()

      expect((taskEngine as any).history).toEqual([])
    })
  })

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      const mockError = new Error('Test error')

      jest.spyOn(cognitiveEngine, 'routeWithEmotion').mockRejectedValue(mockError)

      const result = await taskEngine.executeTask('Test instruction', 'openai')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
