import { registerChatHandlers } from './handlers/chatHandler'
import { registerTaskHandlers } from './handlers/taskHandler'
import { registerSystemHandlers } from './handlers/systemHandler'
import { registerApiHandlers } from './handlers/apiHandler'
import { registerFileSystemHandlers } from './handlers/fileSystemHandler'
import { registerGalleryHandlers } from './handlers/galleryHandler'
import { registerAgentHandlers } from './handlers/agentHandler'
import { registerToolsHandlers } from './handlers/toolsHandler'
import { registerWebHandlers } from './handlers/webHandler'
import { registerPluginsHandlers } from './handlers/pluginsHandler'
import { registerKnowledgeBaseHandlers } from './handlers/knowledgeBaseHandler'
import { registerPreferencesHandlers } from './handlers/preferencesHandler'
import { registerProjectManagerHandlers } from './handlers/projectManagerHandler'
import { registerVisualizationHandlers } from './handlers/vizHandler'
import { registerCodeHandlers } from './handlers/codeHandler'
import { registerLibraryHandlers } from './handlers/libraryHandler'
import { registerOmniAgentHandlers } from './handlers/omniAgentHandler'
import { registerButlerHandlers } from './handlers/butlerHandler'

// 注册所有 IPC 处理器
export function registerAllHandlers() {
  console.log('Registering IPC handlers...')
  
  // 注册各个模块的处理器
  registerChatHandlers()
  registerTaskHandlers()
  registerSystemHandlers()
  registerApiHandlers()
  registerFileSystemHandlers()
  registerGalleryHandlers()
  registerAgentHandlers()
  registerToolsHandlers()
  registerWebHandlers()
  registerPluginsHandlers()
  registerKnowledgeBaseHandlers()
  registerPreferencesHandlers()
  registerProjectManagerHandlers()
  registerVisualizationHandlers()
  registerCodeHandlers()
  registerLibraryHandlers()
  registerOmniAgentHandlers()
  registerButlerHandlers()
  
  console.log('All IPC handlers registered successfully!')
}