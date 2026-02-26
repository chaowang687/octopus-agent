/**
 * LLM 服务插件
 * 提供大语言模型调用服务
 */

class LLMServicePlugin {
  id = 'service-llm'
  name = 'LLM Service'
  version = '1.0.0'
  description = 'Large Language Model service'
  author = 'Octopus Agent'
  enabled = false
  category = 'service'
  serviceName = 'llmService'

  serviceMethods = [
    {
      name: 'chat',
      description: 'Send a chat message to LLM',
      parameters: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Model to use' },
          messages: { type: 'array', description: 'Chat messages' },
          options: { type: 'object', description: 'Additional options' }
        },
        required: ['model', 'messages']
      },
      returnType: 'Promise<ChatResponse>'
    },
    {
      name: 'complete',
      description: 'Complete a text prompt',
      parameters: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Model to use' },
          prompt: { type: 'string', description: 'Text prompt' },
          options: { type: 'object', description: 'Additional options' }
        },
        required: ['model', 'prompt']
      },
      returnType: 'Promise<CompletionResponse>'
    },
    {
      name: 'embed',
      description: 'Generate embeddings for text',
      parameters: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Embedding model' },
          text: { type: 'string', description: 'Text to embed' }
        },
        required: ['model', 'text']
      },
      returnType: 'Promise<number[]>'
    }
  ]

  private serviceInstance = null

  async initialize() {
    console.log(`[LLMServicePlugin] Initializing...`)
    try {
      const { llmService } = require('../../src/main/services/LLMService')
      this.serviceInstance = llmService
      this.enabled = true
    } catch (error) {
      console.error('[LLMServicePlugin] Failed to load LLMService:', error)
      this.enabled = false
    }
  }

  async destroy() {
    console.log(`[LLMServicePlugin] Destroying...`)
    this.serviceInstance = null
    this.enabled = false
  }

  getService() {
    return this.serviceInstance
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.name,
      capabilities: this.serviceMethods,
      version: this.version
    }
  }
}

module.exports = LLMServicePlugin
module.exports.default = LLMServicePlugin
