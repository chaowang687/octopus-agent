// Mock ErrorHandler first since it's used by other modules
jest.mock('../../src/main/utils/ErrorHandler', () => {
  const actualModule = jest.requireActual('../../src/main/utils/ErrorHandler');
  const actualErrorHandler = actualModule.ErrorHandler;
  
  return {
    ...actualModule,
    ErrorHandler: {
      ...actualErrorHandler,
      handleError: jest.fn((error: any, context: any) => {
        const message = error?.message || error || 'Unknown error';
        return {
          message,
          category: 'task_execution',
          severity: 'medium',
          context,
          userMessage: 'Task execution failed',
          name: 'AppError'
        };
      }),
      initialize: jest.fn(),
      createError: jest.fn(),
      wrapError: jest.fn(),
      categorizeError: jest.fn((error: any) => 'task_execution'),
      determineSeverity: jest.fn((error: any) => 'medium'),
      formatErrorForUser: jest.fn((error: any) => error.message),
      formatErrorForDeveloper: jest.fn((error: any) => JSON.stringify(error))
    }
  };
});

// Mock LLMService
jest.mock('../../src/main/services/LLMService', () => ({
  llmService: {
    chat: jest.fn()
  },
  LLMMessage: jest.fn()
}));

// Mock ToolRegistry
jest.mock('../../src/main/agent/ToolRegistry', () => ({
  toolRegistry: {
    getToolsDescription: jest.fn(() => 'Test tools description')
  }
}));

// Now import the modules
import { planner, Plan, PlanStep, StepStatus } from '../../src/main/agent/Planner';
import { LLMMessage } from '../../src/main/services/LLMService';

describe('Planner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPlan', () => {
    it('should create a plan successfully', async () => {
      // Import llmService here since it's mocked
      const { llmService } = require('../../src/main/services/LLMService');
      
      // Mock LLM service response
      (llmService.chat as jest.Mock).mockResolvedValue({
        success: true,
        content: JSON.stringify({
          reasoning: 'Test plan reasoning',
          steps: [
            {
              id: 'step1',
              tool: 'test_tool',
              description: 'Test step 1',
              parameters: { test: 'parameter' },
              status: 'pending',
              dependsOn: []
            }
          ]
        })
      });

      const instruction = 'Create a test plan';
      const history: LLMMessage[] = [];
      const model = 'openai';
      const options = { taskDir: '/test/path' };

      const plan = await planner.createPlan(instruction, history, model, options);

      expect(plan).toBeDefined();
      expect(plan.planId).toBeDefined();
      expect(plan.originalGoal).toBe(instruction);
      expect(plan.steps).toBeDefined();
      expect(plan.reasoning).toBeDefined();
      expect(plan.createdAt).toBeDefined();
      expect(plan.updatedAt).toBeDefined();
      expect(llmService.chat).toHaveBeenCalled();
    });

    it('should handle LLM error gracefully', async () => {
      // Import llmService here since it's mocked
      const { llmService } = require('../../src/main/services/LLMService');
      
      // Mock LLM service error
      (llmService.chat as jest.Mock).mockResolvedValue({
        success: false,
        error: 'LLM error'
      });

      const instruction = 'Create a test plan';
      const history: LLMMessage[] = [];
      const model = 'openai';

      const plan = await planner.createPlan(instruction, history, model);

      expect(plan).toBeDefined();
      expect(plan.planId).toBeDefined();
      expect(plan.originalGoal).toBe(instruction);
      expect(plan.steps).toEqual([]);
      expect(plan.reasoning).toBe('Failed to create plan: LLM error');
    });

    it('should handle invalid JSON response from LLM', async () => {
      // Import llmService here since it's mocked
      const { llmService } = require('../../src/main/services/LLMService');
      
      // Mock LLM service with invalid JSON
      (llmService.chat as jest.Mock).mockResolvedValue({
        success: true,
        content: 'Invalid JSON response'
      });

      const instruction = 'Create a test plan';
      const history: LLMMessage[] = [];
      const model = 'openai';

      const plan = await planner.createPlan(instruction, history, model);

      expect(plan).toBeDefined();
      expect(plan.planId).toBeDefined();
      expect(plan.originalGoal).toBe(instruction);
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].tool).toBe('respond_to_user');
      expect(plan.steps[0].description).toBe('直接回复用户');
      expect(plan.reasoning).toBeDefined();
    });
  });

  describe('Plan structure', () => {
    it('should create plan with correct structure', async () => {
      // Import llmService here since it's mocked
      const { llmService } = require('../../src/main/services/LLMService');
      
      // Mock LLM service response
      (llmService.chat as jest.Mock).mockResolvedValue({
        success: true,
        content: JSON.stringify({
          reasoning: 'Test plan reasoning',
          steps: [
            {
              id: 'step1',
              tool: 'test_tool1',
              description: 'Test step 1',
              parameters: { test: 'parameter1' },
              status: 'pending',
              dependsOn: []
            },
            {
              id: 'step2',
              tool: 'test_tool2',
              description: 'Test step 2',
              parameters: { test: 'parameter2' },
              status: 'pending',
              dependsOn: ['step1']
            }
          ]
        })
      });

      const instruction = 'Create a test plan';
      const history: LLMMessage[] = [];
      const model = 'openai';

      const plan = await planner.createPlan(instruction, history, model);

      expect(plan).toBeDefined();
      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0].id).toBe('step1');
      expect(plan.steps[0].tool).toBe('test_tool1');
      expect(plan.steps[0].description).toBe('Test step 1');
      expect(plan.steps[0].status).toBe(StepStatus.PENDING);
      expect(plan.steps[1].id).toBe('step2');
      expect(plan.steps[1].tool).toBe('test_tool2');
      expect(plan.steps[1].description).toBe('Test step 2');
      expect(plan.steps[1].status).toBe(StepStatus.PENDING);
      expect(plan.steps[1].dependsOn).toEqual(['step1']);
    });
  });
});
