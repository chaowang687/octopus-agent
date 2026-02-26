/**
 * 对话管理器模块
 * 整合所有组件，提供完整的对话管理功能
 * 对标MiniMax Agent
 */

export { ConversationManager } from './ConversationManager'
export { ContextManager } from './ContextManager'
export { IntentAnalyzer } from './IntentAnalyzer'
export { StateTracker } from './StateTracker'
export { ResultProcessor } from './ResultProcessor'

// 全局对话管理器实例
import { ConversationManager } from './ConversationManager'
import { omniAgent } from '../OmniAgent'
import { memoryService } from '../memory'

export const conversationManager = new ConversationManager({
  memoryService,
  omniAgent,
  maxHistorySize: 100,
  contextWindowSize: 20,
  enableIntentAnalysis: true,
  enableStateTracking: true,
  enableMemory: true
})

export type {
  Session,
  SessionOptions,
  SessionMetadata,
  Message,
  MessageMetadata,
  ProcessedMessage,
  IntentAnalysis,
  Entity,
  IntentType,
  ConversationContext,
  MemoryContext,
  ConversationState,
  StateMetadata,
  StateChange,
  ConversationResponse,
  ResponseMetadata,
  ProcessedResult,
  FormattedOutput,
  CodeBlock,
  Table,
  ActionResult,
  Action,
  ValidationResult,
  ConversationManagerConfig,
  ConversationEvent,
  ConversationEventType
} from './types'