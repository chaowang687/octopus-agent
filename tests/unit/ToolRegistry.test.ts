import { ToolRegistry, ToolDefinition, ToolParameter } from '../../src/main/agent/ToolRegistry'

describe('ToolRegistry', () => {
  let toolRegistry: ToolRegistry
  
  beforeEach(() => {
    toolRegistry = new ToolRegistry()
  })
  
  describe('register', () => {
    it('should register a new tool', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: [
          {
            name: 'param1',
            type: 'string',
            description: 'First parameter',
            required: true
          }
        ],
        handler: jest.fn()
      }
      
      toolRegistry.register(tool)
      
      const retrievedTool = toolRegistry.getTool('test_tool')
      expect(retrievedTool).toBeDefined()
      expect(retrievedTool?.name).toBe('test_tool')
      expect(toolRegistry.isToolEnabled('test_tool')).toBe(true)
    })
    
    it('should enable tool by default after registration', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: [],
        handler: jest.fn()
      }
      
      toolRegistry.register(tool)
      
      expect(toolRegistry.isToolEnabled('test_tool')).toBe(true)
    })
  })
  
  describe('getTool', () => {
    it('should return undefined for non-existent tool', () => {
      const tool = toolRegistry.getTool('non_existent')
      expect(tool).toBeUndefined()
    })
    
    it('should return undefined for disabled tool', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: [],
        handler: jest.fn()
      }
      
      toolRegistry.register(tool)
      toolRegistry.disableTool('test_tool')
      
      const retrievedTool = toolRegistry.getTool('test_tool')
      expect(retrievedTool).toBeUndefined()
    })
    
    it('should return tool definition for enabled tool', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: [
          {
            name: 'param1',
            type: 'string',
            description: 'First parameter',
            required: true
          }
        ],
        handler: jest.fn()
      }
      
      toolRegistry.register(tool)
      
      const retrievedTool = toolRegistry.getTool('test_tool')
      expect(retrievedTool).toBeDefined()
      expect(retrievedTool?.name).toBe('test_tool')
      expect(retrievedTool?.description).toBe('A test tool')
      expect(retrievedTool?.parameters).toHaveLength(1)
    })
  })
  
  describe('getAllTools', () => {
    it('should return all enabled tools', () => {
      const tool1: ToolDefinition = {
        name: 'tool1',
        description: 'First tool',
        parameters: [],
        handler: jest.fn()
      }
      
      const tool2: ToolDefinition = {
        name: 'tool2',
        description: 'Second tool',
        parameters: [],
        handler: jest.fn()
      }
      
      toolRegistry.register(tool1)
      toolRegistry.register(tool2)
      toolRegistry.disableTool('tool2')
      
      const allTools = toolRegistry.getAllTools()
      expect(allTools).toHaveLength(1)
      expect(allTools[0].name).toBe('tool1')
    })
    
    it('should return empty array when no tools are enabled', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: [],
        handler: jest.fn()
      }
      
      toolRegistry.register(tool)
      toolRegistry.disableTool('test_tool')
      
      const allTools = toolRegistry.getAllTools()
      expect(allTools).toHaveLength(0)
    })
  })
  
  describe('enableTool and disableTool', () => {
    it('should enable a registered tool', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: [],
        handler: jest.fn()
      }
      
      toolRegistry.register(tool)
      toolRegistry.disableTool('test_tool')
      expect(toolRegistry.isToolEnabled('test_tool')).toBe(false)
      
      toolRegistry.enableTool('test_tool')
      expect(toolRegistry.isToolEnabled('test_tool')).toBe(true)
    })
    
    it('should not enable a non-existent tool', () => {
      toolRegistry.enableTool('non_existent')
      expect(toolRegistry.isToolEnabled('non_existent')).toBe(false)
    })
    
    it('should disable an enabled tool', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: [],
        handler: jest.fn()
      }
      
      toolRegistry.register(tool)
      expect(toolRegistry.isToolEnabled('test_tool')).toBe(true)
      
      toolRegistry.disableTool('test_tool')
      expect(toolRegistry.isToolEnabled('test_tool')).toBe(false)
    })
  })
  
  describe('getToolsDescription', () => {
    it('should generate description for enabled tools', () => {
      const tool1: ToolDefinition = {
        name: 'tool1',
        description: 'First tool',
        parameters: [
          {
            name: 'param1',
            type: 'string',
            description: 'First parameter',
            required: true
          },
          {
            name: 'param2',
            type: 'number',
            description: 'Second parameter',
            required: false
          }
        ],
        handler: jest.fn()
      }
      
      const tool2: ToolDefinition = {
        name: 'tool2',
        description: 'Second tool',
        parameters: [],
        handler: jest.fn()
      }
      
      toolRegistry.register(tool1)
      toolRegistry.register(tool2)
      toolRegistry.disableTool('tool2')
      
      const description = toolRegistry.getToolsDescription()
      expect(description).toContain('Tool: tool1')
      expect(description).toContain('Description: First tool')
      expect(description).toContain('- param1 (string): First parameter (Required)')
      expect(description).toContain('- param2 (number): Second parameter (Optional)')
      expect(description).not.toContain('Tool: tool2')
    })
    
    it('should return empty string when no tools are enabled', () => {
      const description = toolRegistry.getToolsDescription()
      expect(description).toBe('')
    })
  })
  
  describe('tool execution', () => {
    it('should execute tool handler with correct arguments', async () => {
      const mockHandler = jest.fn().mockResolvedValue('result')
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: [
          {
            name: 'input',
            type: 'string',
            description: 'Input text',
            required: true
          }
        ],
        handler: mockHandler
      }
      
      toolRegistry.register(tool)
      
      const retrievedTool = toolRegistry.getTool('test_tool')
      expect(retrievedTool).toBeDefined()
      
      const args = { input: 'test input' }
      const context = { taskId: 'test-task-123' }
      
      const result = await retrievedTool!.handler(args, context)
      
      expect(mockHandler).toHaveBeenCalledWith(args, context)
      expect(result).toBe('result')
    })
    
    it('should handle tool execution errors', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Tool execution failed'))
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: [],
        handler: mockHandler
      }
      
      toolRegistry.register(tool)
      
      const retrievedTool = toolRegistry.getTool('test_tool')
      expect(retrievedTool).toBeDefined()
      
      await expect(retrievedTool!.handler({})).rejects.toThrow('Tool execution failed')
    })
  })
})