import { LLMService, LLMMessage, LLMResponse } from '../../src/main/services/LLMService'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name: string) => {
      if (name === 'userData') {
        return '/tmp/test-user-data'
      }
      if (name === 'desktop') {
        return '/tmp/test-desktop'
      }
      return '/tmp'
    })
  }
}))

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn()
}))

global.fetch = jest.fn() as any

describe('LLMService', () => {
  let llmService: LLMService

  beforeEach(() => {
    llmService = new LLMService()
    jest.clearAllMocks()
  })

  describe('getApiKey', () => {
    it('should return null when apiKeys file does not exist', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false)
      
      const apiKey = llmService.getApiKey('openai')
      
      expect(apiKey).toBeNull()
    })

    it('should return API key for specific model', () => {
      const mockApiKeys = {
        'openai': 'sk-test-openai',
        'deepseek': 'sk-test-deepseek'
      }
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockApiKeys))
      
      const apiKey = llmService.getApiKey('openai')
      
      expect(apiKey).toBe('sk-test-openai')
    })

    it('should return API key from provider mapping', () => {
      const mockApiKeys = {
        'openai': 'sk-test-openai',
        'deepseek': 'sk-test-deepseek'
      }
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockApiKeys))
      
      const apiKey = llmService.getApiKey('gpt-4o')
      
      expect(apiKey).toBe('sk-test-openai')
    })

    it('should return null when model not found', () => {
      const mockApiKeys = {
        'openai': 'sk-test-openai'
      }
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockApiKeys))
      
      const apiKey = llmService.getApiKey('unknown-model')
      
      expect(apiKey).toBeNull()
    })

    it('should handle file read errors gracefully', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('File read error')
      })
      
      const apiKey = llmService.getApiKey('openai')
      
      expect(apiKey).toBeNull()
    })
  })

  describe('getAvailableModels', () => {
    it('should return empty array when apiKeys file does not exist', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false)
      
      const models = llmService.getAvailableModels()
      
      expect(models).toEqual([])
    })

    it('should return list of available models', () => {
      const mockApiKeys = {
        'openai': 'sk-test-openai',
        'deepseek': 'sk-test-deepseek',
        'claude': 'sk-test-claude'
      }
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockApiKeys))
      
      const models = llmService.getAvailableModels()
      
      expect(models).toContain('openai')
      expect(models).toContain('deepseek')
      expect(models).toContain('claude')
    })

    it('should handle file read errors gracefully', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('File read error')
      })
      
      const models = llmService.getAvailableModels()
      
      expect(models).toEqual([])
    })
  })

  describe('chat', () => {
    it('should return mock response for folder creation without API key', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false)
      
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Create a folder' }
      ]
      
      const response = await llmService.chat('openai', messages)
      
      expect(response.success).toBe(true)
      expect(response.content).toBeDefined()
      expect(response.content).toContain('create_directory')
    })

    it('should return mock response for file creation without API key', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false)
      
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Write a file' }
      ]
      
      const response = await llmService.chat('openai', messages)
      
      expect(response.success).toBe(true)
      expect(response.content).toBeDefined()
      expect(response.content).toContain('write_file')
    })

    it('should return default demo response without API key', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false)
      
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' }
      ]
      
      const response = await llmService.chat('openai', messages)
      
      expect(response.success).toBe(true)
      expect(response.content).toContain('演示模式')
    })

    it('should return error for JSON requests without API key', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false)
      
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a JSON formatter' },
        { role: 'user', content: 'Format this' }
      ]
      
      const response = await llmService.chat('openai', messages)
      
      expect(response.success).toBe(false)
      expect(response.error).toContain('API Key')
    })
  })

  describe('normalizeMessagesForDeepSeek', () => {
    it('should normalize messages with system prompt', () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' }
      ]
      
      const normalized = (llmService as any).normalizeMessagesForDeepSeek(messages)
      
      expect(normalized).toHaveLength(1)
      expect(normalized[0].role).toBe('user')
      expect(normalized[0].content).toContain('You are a helpful assistant')
      expect(normalized[0].content).toContain('Hello')
    })

    it('should handle only system messages', () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System instruction' }
      ]
      
      const normalized = (llmService as any).normalizeMessagesForDeepSeek(messages)
      
      expect(normalized).toHaveLength(1)
      expect(normalized[0].role).toBe('user')
      expect(normalized[0].content).toBe('System instruction')
    })

    it('should handle messages without system prompt', () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ]
      
      const normalized = (llmService as any).normalizeMessagesForDeepSeek(messages)
      
      expect(normalized).toHaveLength(2)
      expect(normalized[0].role).toBe('user')
      expect(normalized[1].role).toBe('assistant')
    })

    it('should combine multiple system messages', () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System 1' },
        { role: 'system', content: 'System 2' },
        { role: 'user', content: 'Hello' }
      ]
      
      const normalized = (llmService as any).normalizeMessagesForDeepSeek(messages)
      
      expect(normalized).toHaveLength(1)
      expect(normalized[0].content).toContain('System 1')
      expect(normalized[0].content).toContain('System 2')
    })
  })

  describe('model to provider mapping', () => {
    it('should map GPT models to OpenAI', () => {
      const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo']
      models.forEach(model => {
        const provider = (llmService as any).modelToProvider[model]
        expect(provider).toBe('openai')
      })
    })

    it('should map Claude models to Claude', () => {
      const models = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
      models.forEach(model => {
        const provider = (llmService as any).modelToProvider[model]
        expect(provider).toBe('claude')
      })
    })

    it('should map DeepSeek models to DeepSeek', () => {
      const models = ['deepseek-chat', 'deepseek-coder']
      models.forEach(model => {
        const provider = (llmService as any).modelToProvider[model]
        expect(provider).toBe('deepseek')
      })
    })

    it('should map MiniMax models to MiniMax', () => {
      const provider = (llmService as any).modelToProvider['abab6.5s-chat']
      expect(provider).toBe('minimax')
    })

    it('should map Doubao models to Doubao', () => {
      const models = ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-seed-2-0-code-preview-260215']
      models.forEach(model => {
        const provider = (llmService as any).modelToProvider[model]
        expect(provider).toBe('doubao')
      })
    })
  })

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const mockApiKeys = {
        'openai': 'sk-test-openai'
      }
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockApiKeys))
      
      const mockFetch = global.fetch as jest.Mock
      mockFetch.mockRejectedValue(new Error('Network error'))
      
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' }
      ]
      
      const response = await llmService.chat('openai', messages)
      
      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
    })

    it('should handle API errors', async () => {
      const mockApiKeys = {
        'openai': 'sk-test-openai'
      }
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockApiKeys))
      
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response
      const mockFetch = global.fetch as jest.Mock
      mockFetch.mockResolvedValue(mockResponse)
      
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' }
      ]
      
      const response = await llmService.chat('openai', messages)
      
      expect(response.success).toBe(false)
      expect(response.error).toContain('401')
    })

    it('should handle unsupported models', async () => {
      const mockApiKeys = {
        'unknown-model': 'sk-test'
      }
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockApiKeys))
      
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' }
      ]
      
      const response = await llmService.chat('unknown-model', messages)
      
      expect(response.success).toBe(false)
      expect(response.error).toContain('Unsupported model')
    })
  })

  describe('timeout handling', () => {
    it('should handle request timeout', async () => {
      const mockApiKeys = {
        'openai': 'sk-test-openai'
      }
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockApiKeys))
      
      const mockAbortError = new Error('AbortError')
      mockAbortError.name = 'AbortError'
      const mockFetch = global.fetch as jest.Mock
      mockFetch.mockRejectedValue(mockAbortError)
      
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' }
      ]
      
      const response = await llmService.chat('openai', messages)
      
      expect(response.success).toBe(false)
      expect(response.error).toContain('timed out')
    })

    it('should handle user cancellation', async () => {
      const mockApiKeys = {
        'openai': 'sk-test-openai'
      }
      jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockApiKeys))
      
      const mockAbortError = new Error('Request cancelled by user')
      mockAbortError.name = 'AbortError'
      const mockFetch = global.fetch as jest.Mock
      mockFetch.mockRejectedValue(mockAbortError)
      
      const abortController = new AbortController()
      abortController.abort()
      
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' }
      ]
      
      const response = await llmService.chat('openai', messages, { signal: abortController.signal })
      
      expect(response.success).toBe(false)
      expect(response.error).toContain('cancelled')
    })
  })
})
