/**
 * 智能体模块导出
 * 核心：OmniAgent
 * 工具层：通过插件系统访问
 */

export * from './OmniAgent'
export * from './ConversationManager'
export * from './MultiAgentCoordinator'
export * from './MultiDialogueCoordinator'
export * from './SmartButlerAgent'
export * from './AgentScheduler'
export * from './CognitiveEngine'
export * from './ReActEngine'
export * from './EnhancedReActEngine'
export * from './ThoughtTreeEngine'
export * from './UnifiedReasoningEngine'
export * from './SelfCorrectionEngine'
export * from './ToolRegistry'
export * from './memory'
export * from './reasoning'
export * from './tasks'
export * from './workflow'
export * from './tools'
export * from './dialogue'
export * from './errors'
export * from './VerificationEngine'
export * from './ToolExecutionEngine'
export * from './TaskEngine'
export * from './WorkflowEngine'
export * from './MemoryManager'
export * from './ContextManager'
export * from './SkillManager'
export * from './TaskLogger'
export * from './PermissionManager'
export * from './TaskStateManager'
export * from './SafetyMonitor'
export * from './AutomationTools'
export * from './SystemAutomationService'
export * from './TaskLogTypes'
export * from './ModelRouter'
export * from './Executor'
export * from './Planner'
export * from './TaskStateMachine'
export * from './EmotionTypes'
export * from './MCPClient'
export * from './FloatingCapsule'
export * from './CodeSandbox'
export * from './AdvancedElementLocator'
export * from './ElementLocator'
export * from './DSLParser'
export * from './ExcelGenerator'
export * from './MultimodalFileGenerator'
export * from './PPTGenerator'
export * from './SOPEngine'
export * from './Distiller'
export * from './OnlineDistiller'
export * from './ApplicationDataTransfer'
export * from './EnhancedWorkflowEngine'
export * from './ScreenPerception'
export * from './imageTools'

import { omniAgent } from './OmniAgent'
import { conversationManager } from './ConversationManager'
import { toolRegistry } from './ToolRegistry'
import { memoryService } from './memory'

export const agentCore = {
  omniAgent,
  conversationManager,
  toolRegistry,
  memoryService
}

export function getAgentCore() {
  return agentCore
}
