# Mini-Agent Integration Plan

## Overview
Transform the existing chat system into a Mini-Agent framework that combines the current capabilities with advanced agent features like screen perception, task planning, and MCP integration.

## Architecture Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Chat UI       │◄──►│  Agent Engine    │◄──►│  MCP Services   │
│   (Frontend)    │    │  (Backend)       │    │  (External)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Screen Capture │    │  Task Planner    │    │  Tool Registry  │
│  & Perception   │    │  (ReAct Engine)  │    │  & Execution    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Key Components to Integrate

### 1. Screen Perception Module
- **Purpose**: Enable the agent to "see" and interact with the desktop environment
- **Integration Points**:
  - Electron system APIs for screen capture
  - Vision-language models (VLM) for screen understanding
  - Set-of-Mark (SoM) technology for element identification

### 2. Task Planning & Execution Engine
- **Purpose**: Implement ReAct (Reasoning + Acting) pattern for complex task execution
- **Integration Points**:
  - Current TaskEngine.ts will be enhanced with ReAct capabilities
  - Planning module for breaking down complex tasks
  - Action execution with observation feedback loop

### 3. MCP (Model Context Protocol) Integration
- **Purpose**: Connect to external tools and services via standardized protocol
- **Integration Points**:
  - MCP client implementation
  - Tool discovery and invocation
  - Connection to existing tools like GitHub, Slack, Figma, etc.

### 4. Persistent Memory System
- **Purpose**: Maintain context across sessions and improve learning
- **Integration Points**:
  - Session Note Tool implementation
  - Intelligent context summarization
  - Knowledge persistence layer

## Implementation Strategy

### Phase 1: Foundation Setup
1. **Enhance TaskEngine.ts** with ReAct pattern
2. **Add screen capture functionality** to existing system
3. **Integrate basic MCP client** for tool discovery

### Phase 2: Advanced Capabilities
1. **Implement Set-of-Mark** for screen element identification
2. **Build persistent memory** system
3. **Add intelligent context management**

### Phase 3: UI/UX Enhancement
1. **Update Chat.tsx** to support agent interactions
2. **Add visualization** for reasoning steps
3. **Enhance task status** and progress indicators

## Technical Implementation Details

### Screen Perception Enhancement
```typescript
// Add to existing system
interface ScreenPerception {
  captureScreen(): Promise<ScreenshotResult>
  identifyElements(screenshot: string): Promise<Element[]>
  clickElement(elementId: number): Promise<void>
  typeText(elementId: number, text: string): Promise<void>
}

// Integration with existing TaskEngine
class EnhancedTaskEngine extends TaskEngine {
  private screenPerceptor: ScreenPerception
  
  async executeAgentTask(instruction: string, options: AgentOptions) {
    // If task involves screen interaction
    if (this.requiresScreenInteraction(instruction)) {
      const screenshot = await this.screenPerceptor.captureScreen()
      // Process with VLM
      // Identify elements with SoM
      // Execute actions
    }
  }
}
```

### MCP Integration
```typescript
// MCP Client Implementation
class MCPClient {
  async discoverTools(): Promise<Tool[]> {
    // Discover available tools via MCP protocol
  }
  
  async invokeTool(name: string, parameters: any): Promise<any> {
    // Invoke tool via MCP protocol
  }
}

// Integration with existing tool registry
class EnhancedToolRegistry {
  private mcpClient: MCPClient
  
  async registerMCPTools() {
    const mcpTools = await this.mcpClient.discoverTools()
    // Register MCP tools in existing tool registry
  }
}
```

### ReAct Pattern Implementation
```typescript
// ReAct Execution Loop
interface ReActStep {
  thought: string
  action: string
  actionInput: any
  observation: string
}

class ReActEngine {
  async execute(instruction: string): Promise<ReActStep[]> {
    const steps: ReActStep[] = []
    let currentStep = 0
    const maxSteps = 10
    
    while (currentStep < maxSteps) {
      // Reason
      const thought = await this.generateThought(instruction, steps)
      // Act
      const action = await this.selectAction(thought)
      const actionInput = await this.extractActionInput(thought)
      // Observe
      const observation = await this.executeAction(action, actionInput)
      
      steps.push({ thought, action, actionInput, observation })
      
      // Check if task is complete
      if (this.isTaskComplete(observation, instruction)) {
        break
      }
      
      currentStep++
    }
    
    return steps
  }
}
```

## Integration Points with Existing Code

### Chat.tsx Updates
- Add screen capture button to toolbar
- Enhance message display to show reasoning steps
- Add agent status indicators
- Support for visualizing screen interactions

### TaskEngine.ts Enhancements
- Add ReAct execution mode alongside existing modes
- Integrate screen perception capabilities
- Enhance with MCP tool access
- Add persistent memory functionality

### Backend IPC Handlers
- Extend taskHandler.ts to support agent-specific operations
- Add screen capture IPC endpoints
- MCP communication channels

## Migration Path
1. **Maintain backward compatibility** - existing chat functionality remains unchanged
2. **Gradual feature rollout** - add agent capabilities as enhancements
3. **User opt-in** - provide toggle between chat mode and agent mode
4. **Progressive enhancement** - start with basic capabilities and add advanced features

## Success Metrics
- Ability to perform screen-based tasks
- Successful completion of multi-step tasks
- Proper integration with external tools via MCP
- Improved context management and memory retention
- Maintained performance and usability

## Risks and Mitigation
- **Security**: Screen access requires proper permissions and safeguards
- **Performance**: Additional processing shouldn't slow down existing functionality
- **Complexity**: Maintain simplicity for basic chat use cases
- **Compatibility**: Ensure existing features continue to work