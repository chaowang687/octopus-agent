import { Executor, ExecutionResult, ExecutionProgressEvent } from '../../src/main/agent/Executor'
import { Plan, PlanStep } from '../../src/main/agent/Planner'
import { toolRegistry } from '../../src/main/agent/ToolRegistry'
import { llmService } from '../../src/main/services/LLMService'
import { ErrorHandler } from '../../src/main/utils/ErrorHandler'

jest.mock('../../src/main/agent/ToolRegistry')
jest.mock('../../src/main/services/LLMService')
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
          category: 'tool_execution',
          severity: 'medium',
          context,
          userMessage: 'Tool execution failed',
          name: 'AppError'
        }
      }),
      createError: jest.fn((message: string, category: any, severity: any, context: any) => ({
        message,
        category,
        severity,
        context,
        userMessage: 'Tool execution failed',
        name: 'AppError'
      })),
      determineSeverity: jest.fn((error: any) => 'medium'),
      initialize: jest.fn(),
      logError: jest.fn()
    }
  }
})

describe('Executor', () => {
  let executor: Executor

  beforeEach(() => {
    executor = new Executor()
    jest.clearAllMocks()
  })

  describe('executePlan', () => {
    it('should execute a plan with single step successfully', async () => {
      const mockTool = {
        name: 'test_tool',
        description: 'Test tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        handler: jest.fn().mockResolvedValue({
          success: true,
          output: 'Test output'
        })
      }

      jest.spyOn(toolRegistry, 'getTool').mockReturnValue(mockTool as any)

      const plan: Plan = {
        steps: [
          {
            id: 'step1',
            tool: 'test_tool',
            description: 'Test step',
            parameters: { input: 'test input' }
          }
        ],
        reasoning: 'Test reasoning'
      }

      const progressEvents: ExecutionProgressEvent[] = []
      const onProgress = (evt: ExecutionProgressEvent) => {
        progressEvents.push(evt)
      }

      const result = await executor.executePlan(plan, 'openai', {}, onProgress)

      expect(result.success).toBe(true)
      expect(result.stepResults['step1']).toBeDefined()
      expect(mockTool.handler).toHaveBeenCalledWith({ input: 'test input' }, {})
      expect(progressEvents.length).toBeGreaterThan(0)
      expect(progressEvents[0].type).toBe('step_start')
      expect(progressEvents[progressEvents.length - 1].type).toBe('step_success')
    })

    it('should execute a plan with multiple steps', async () => {
      const mockTool1 = {
        name: 'tool1',
        description: 'Tool 1',
        parameters: { type: 'object', properties: {} },
        handler: jest.fn().mockResolvedValue({
          success: true,
          output: 'Output 1'
        })
      }

      const mockTool2 = {
        name: 'tool2',
        description: 'Tool 2',
        parameters: { type: 'object', properties: {} },
        handler: jest.fn().mockResolvedValue({
          success: true,
          output: 'Output 2'
        })
      }

      jest.spyOn(toolRegistry, 'getTool').mockImplementation((toolName) => {
        if (toolName === 'tool1') return mockTool1 as any
        if (toolName === 'tool2') return mockTool2 as any
        return undefined
      })

      const plan: Plan = {
        steps: [
          { id: 'step1', tool: 'tool1', description: 'Step 1', parameters: {} },
          { id: 'step2', tool: 'tool2', description: 'Step 2', parameters: {} }
        ],
        reasoning: 'Multi-step reasoning'
      }

      const result = await executor.executePlan(plan, 'openai')

      expect(result.success).toBe(true)
      expect(result.stepResults['step1']).toBeDefined()
      expect(result.stepResults['step2']).toBeDefined()
      expect(mockTool1.handler).toHaveBeenCalled()
      expect(mockTool2.handler).toHaveBeenCalled()
    })

    it('should handle tool not found error', async () => {
      jest.spyOn(toolRegistry, 'getTool').mockReturnValue(undefined)

      const plan: Plan = {
        steps: [
          { id: 'step1', tool: 'nonexistent_tool', description: 'Nonexistent tool', parameters: {} }
        ],
        reasoning: 'Test reasoning'
      }

      const result = await executor.executePlan(plan, 'openai')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Tool not found')
    })

    it('should handle tool execution error', async () => {
      const mockTool = {
        name: 'failing_tool',
        description: 'Failing tool',
        parameters: { type: 'object', properties: {} },
        handler: jest.fn().mockResolvedValue({
          success: false,
          error: 'Tool execution failed'
        })
      }

      jest.spyOn(toolRegistry, 'getTool').mockReturnValue(mockTool as any)

      jest.spyOn(llmService, 'chat').mockResolvedValue({
        success: true,
        content: '{"input": "fixed input"}'
      })

      const plan: Plan = {
        steps: [
          { id: 'step1', tool: 'failing_tool', description: 'Failing step', parameters: { input: 'wrong input' } }
        ],
        reasoning: 'Test reasoning'
      }

      const result = await executor.executePlan(plan, 'openai')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle task cancellation', async () => {
      const mockTool = {
        name: 'test_tool',
        description: 'Test tool',
        parameters: { type: 'object', properties: {} },
        handler: jest.fn().mockImplementation((params: any, ctx: any) => {
          return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
              if (ctx.signal?.aborted) {
                clearInterval(checkInterval)
                resolve({ success: false, error: 'Task cancelled' })
              }
            }, 10)
            
            setTimeout(() => {
              clearInterval(checkInterval)
              resolve({ success: true, output: 'Output' })
            }, 1000)
          })
        })
      }

      jest.spyOn(toolRegistry, 'getTool').mockReturnValue(mockTool as any)

      const plan: Plan = {
        steps: [
          { id: 'step1', tool: 'test_tool', description: 'Test step', parameters: {} }
        ],
        reasoning: 'Test reasoning'
      }

      const abortController = new AbortController()
      
      const executionPromise = executor.executePlan(plan, 'openai', { signal: abortController.signal })
      
      setTimeout(() => abortController.abort(), 50)

      const result = await executionPromise

      expect(result.success).toBe(false)
      expect(result.error).toContain('cancelled')
    })

    it('should auto-fix file paths for path-based tools', async () => {
      const mockTool = {
        name: 'read_file',
        description: 'Read file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          }
        },
        handler: jest.fn().mockResolvedValue({
          success: true,
          content: 'File content'
        })
      }

      jest.spyOn(toolRegistry, 'getTool').mockReturnValue(mockTool as any)

      const plan: Plan = {
        steps: [
          { id: 'step1', tool: 'read_file', description: 'Read file', parameters: { path: 'test.txt' } }
        ],
        reasoning: 'Test reasoning'
      }

      const result = await executor.executePlan(plan, 'openai')

      expect(result.success).toBe(true)
      expect(mockTool.handler).toHaveBeenCalled()
      const calledParams = mockTool.handler.mock.calls[0][0]
      expect(calledParams.path).toBeDefined()
    })

    it('should handle timeout errors for long-running commands', async () => {
      const mockTool = {
        name: 'execute_command',
        description: 'Execute command',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string' }
          }
        },
        handler: jest.fn()
          .mockResolvedValueOnce({
            success: false,
            error: 'Command timed out'
          })
          .mockResolvedValueOnce({
            success: true,
            output: 'Command completed'
          })
      }

      jest.spyOn(toolRegistry, 'getTool').mockReturnValue(mockTool as any)

      const plan: Plan = {
        steps: [
          { id: 'step1', tool: 'execute_command', description: 'Install dependencies', parameters: { command: 'npm install' } }
        ],
        reasoning: 'Test reasoning'
      }

      const result = await executor.executePlan(plan, 'openai')

      expect(result.success).toBe(true)
      expect(mockTool.handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling and retries', () => {
    it('should retry failed steps with corrected parameters', async () => {
      const mockTool = {
        name: 'retry_tool',
        description: 'Retry tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        handler: jest.fn()
          .mockResolvedValueOnce({
            success: false,
            error: 'Invalid input'
          })
          .mockResolvedValueOnce({
            success: true,
            output: 'Success'
          })
      }

      jest.spyOn(toolRegistry, 'getTool').mockReturnValue(mockTool as any)

      jest.spyOn(llmService, 'chat').mockResolvedValue({
        success: true,
        content: '{"input": "corrected input"}'
      })

      const plan: Plan = {
        steps: [
          { id: 'step1', tool: 'retry_tool', description: 'Retry step', parameters: { input: 'wrong input' } }
        ],
        reasoning: 'Test reasoning'
      }

      const result = await executor.executePlan(plan, 'openai')

      expect(result.success).toBe(true)
      expect(mockTool.handler).toHaveBeenCalledTimes(2)
      expect(llmService.chat).toHaveBeenCalled()
    })

    it('should give up after max retries', async () => {
      const mockTool = {
        name: 'failing_tool',
        description: 'Failing tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        handler: jest.fn().mockResolvedValue({
          success: false,
          error: 'Always fails'
        })
      }

      jest.spyOn(toolRegistry, 'getTool').mockReturnValue(mockTool as any)

      jest.spyOn(llmService, 'chat').mockResolvedValue({
        success: true,
        content: '{"input": "fixed input"}'
      })

      const plan: Plan = {
        steps: [
          { id: 'step1', tool: 'failing_tool', description: 'Failing step', parameters: { input: 'input' } }
        ],
        reasoning: 'Test reasoning'
      }

      const result = await executor.executePlan(plan, 'openai')

      expect(result.success).toBe(false)
      expect(result.error).toContain('failed after retries')
      expect(mockTool.handler).toHaveBeenCalledTimes(4)
    })
  })

  describe('progress events', () => {
    it('should emit step_start event', async () => {
      const mockTool = {
        name: 'test_tool',
        description: 'Test tool',
        parameters: { type: 'object', properties: {} },
        handler: jest.fn().mockResolvedValue({
          success: true,
          output: 'Output'
        })
      }

      jest.spyOn(toolRegistry, 'getTool').mockReturnValue(mockTool as any)

      const plan: Plan = {
        steps: [
          { id: 'step1', tool: 'test_tool', description: 'Test step', parameters: {} }
        ],
        reasoning: 'Test reasoning'
      }

      const progressEvents: ExecutionProgressEvent[] = []
      const onProgress = (evt: ExecutionProgressEvent) => {
        progressEvents.push(evt)
      }

      await executor.executePlan(plan, 'openai', {}, onProgress)

      const startEvent = progressEvents.find(e => e.type === 'step_start')
      expect(startEvent).toBeDefined()
      expect(startEvent?.stepId).toBe('step1')
      expect(startEvent?.tool).toBe('test_tool')
    })

    it('should emit step_success event', async () => {
      const mockTool = {
        name: 'test_tool',
        description: 'Test tool',
        parameters: { type: 'object', properties: {} },
        handler: jest.fn().mockResolvedValue({
          success: true,
          output: 'Test output'
        })
      }

      jest.spyOn(toolRegistry, 'getTool').mockReturnValue(mockTool as any)

      const plan: Plan = {
        steps: [
          { id: 'step1', tool: 'test_tool', description: 'Test step', parameters: {} }
        ],
        reasoning: 'Test reasoning'
      }

      const progressEvents: ExecutionProgressEvent[] = []
      const onProgress = (evt: ExecutionProgressEvent) => {
        progressEvents.push(evt)
      }

      await executor.executePlan(plan, 'openai', {}, onProgress)

      const successEvent = progressEvents.find(e => e.type === 'step_success')
      expect(successEvent).toBeDefined()
      expect(successEvent?.stepId).toBe('step1')
      expect(successEvent?.resultSummary).toBe('Test output')
    })

    it('should emit step_error event on failure', async () => {
      const mockTool = {
        name: 'failing_tool',
        description: 'Failing tool',
        parameters: { type: 'object', properties: {} },
        handler: jest.fn().mockResolvedValue({
          success: false,
          error: 'Tool failed'
        })
      }

      jest.spyOn(toolRegistry, 'getTool').mockReturnValue(mockTool as any)

      jest.spyOn(llmService, 'chat').mockResolvedValue({
        success: true,
        content: '{}'
      })

      const plan: Plan = {
        steps: [
          { id: 'step1', tool: 'failing_tool', description: 'Failing step', parameters: {} }
        ],
        reasoning: 'Test reasoning'
      }

      const progressEvents: ExecutionProgressEvent[] = []
      const onProgress = (evt: ExecutionProgressEvent) => {
        progressEvents.push(evt)
      }

      await executor.executePlan(plan, 'openai', {}, onProgress)

      const errorEvents = progressEvents.filter(e => e.type === 'step_error')
      expect(errorEvents.length).toBeGreaterThan(0)
      expect(errorEvents[0].error).toContain('Tool failed')
    })

    it('should emit retry event', async () => {
      const mockTool = {
        name: 'retry_tool',
        description: 'Retry tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        handler: jest.fn()
          .mockResolvedValueOnce({
            success: false,
            error: 'First attempt failed'
          })
          .mockResolvedValueOnce({
            success: true,
            output: 'Success'
          })
      }

      jest.spyOn(toolRegistry, 'getTool').mockReturnValue(mockTool as any)

      jest.spyOn(llmService, 'chat').mockResolvedValue({
        success: true,
        content: '{"input": "fixed"}'
      })

      const plan: Plan = {
        steps: [
          { id: 'step1', tool: 'retry_tool', description: 'Retry step', parameters: { input: 'input' } }
        ],
        reasoning: 'Test reasoning'
      }

      const progressEvents: ExecutionProgressEvent[] = []
      const onProgress = (evt: ExecutionProgressEvent) => {
        progressEvents.push(evt)
      }

      await executor.executePlan(plan, 'openai', {}, onProgress)

      const retryEvent = progressEvents.find(e => e.type === 'retry')
      expect(retryEvent).toBeDefined()
      expect(retryEvent?.retryCount).toBe(1)
      expect(retryEvent?.maxRetries).toBe(3)
    })
  })
})
