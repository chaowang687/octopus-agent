/**
 * Response Tools
 * 响应工具集
 */

import { toolRegistry } from '../ToolRegistry'

export function registerResponseTools(): void {
  // 回复用户
  toolRegistry.register({
    name: 'respond_to_user',
    description: '回复用户消息',
    parameters: [
      { name: 'message', type: 'string', description: '回复消息内容', required: true }
    ],
    handler: async (params: any) => {
      try {
        const message = params?.message
        if (!message) return { error: 'Missing parameter: message' }

        return { success: true, message }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 显示确认对话框
  toolRegistry.register({
    name: 'confirm',
    description: '显示确认对话框',
    parameters: [
      { name: 'title', type: 'string', description: '对话框标题', required: true },
      { name: 'message', type: 'string', description: '对话框消息', required: true }
    ],
    handler: async (params: any) => {
      return { confirmed: true, title: params?.title, message: params?.message }
    }
  })

  // 显示通知
  toolRegistry.register({
    name: 'notify',
    description: '显示系统通知',
    parameters: [
      { name: 'title', type: 'string', description: '通知标题', required: true },
      { name: 'body', type: 'string', description: '通知内容', required: true }
    ],
    handler: async (params: any) => {
      return { success: true, title: params?.title, body: params?.body }
    }
  })
}

registerResponseTools()