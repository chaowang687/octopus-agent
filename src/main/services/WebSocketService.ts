import { app } from 'electron'
import * as http from 'http'
import * as WebSocket from 'ws'
import { TaskProgressEvent } from '../agent/TaskEngine'

interface Client {
  id: string
  ws: WebSocket
  connectedAt: Date
  lastActivity: Date
}

interface Message {
  type: string
  data: any
  timestamp: number
  clientId?: string
}

export class WebSocketService {
  private server: http.Server | null = null
  private wss: WebSocket.Server | null = null
  private clients: Map<string, Client> = new Map()
  private port: number = 8080

  start() {
    try {
      // 创建HTTP服务器
      this.server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('WebSocket server running')
      })

      // 创建WebSocket服务器
      this.wss = new WebSocket.Server({ server: this.server })

      // 监听连接
      this.wss.on('connection', (ws) => {
        const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        const client: Client = {
          id: clientId,
          ws,
          connectedAt: new Date(),
          lastActivity: new Date()
        }

        this.clients.set(clientId, client)
        console.log(`Client connected: ${clientId}, Total: ${this.clients.size}`)

        // 发送连接成功消息
        this.sendMessage(clientId, {
          type: 'connected',
          data: { clientId },
          timestamp: Date.now()
        })

        // 监听消息
        ws.on('message', (message) => {
          client.lastActivity = new Date()
          try {
            const parsedMessage = JSON.parse(message.toString())
            this.handleClientMessage(clientId, parsedMessage)
          } catch (error) {
            console.error('Failed to parse message:', error)
          }
        })

        // 监听关闭
        ws.on('close', () => {
          this.clients.delete(clientId)
          console.log(`Client disconnected: ${clientId}, Total: ${this.clients.size}`)
        })

        // 监听错误
        ws.on('error', (error) => {
          console.error(`Client error: ${clientId}`, error)
          this.clients.delete(clientId)
        })
      })

      // 启动服务器
      this.server.listen(this.port, () => {
        console.log(`WebSocket server started on port ${this.port}`)
      })

      // 定期清理不活跃的客户端
      setInterval(() => this.cleanupInactiveClients(), 60000) // 每分钟清理一次

    } catch (error) {
      console.error('Failed to start WebSocket server:', error)
    }
  }

  stop() {
    try {
      if (this.wss) {
        this.wss.close()
        this.wss = null
      }
      if (this.server) {
        this.server.close()
        this.server = null
      }
      this.clients.clear()
      console.log('WebSocket server stopped')
    } catch (error) {
      console.error('Failed to stop WebSocket server:', error)
    }
  }

  // 发送消息给特定客户端
  sendMessage(clientId: string, message: Message) {
    const client = this.clients.get(clientId)
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message))
        client.lastActivity = new Date()
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error)
        this.clients.delete(clientId)
      }
    }
  }

  // 广播消息给所有客户端
  broadcast(message: Message) {
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message))
          client.lastActivity = new Date()
        } catch (error) {
          console.error(`Failed to broadcast message to client ${client.id}:`, error)
          this.clients.delete(client.id)
        }
      }
    })
  }

  // 处理客户端消息
  private handleClientMessage(clientId: string, message: Message) {
    console.log(`Received message from client ${clientId}:`, message.type)

    switch (message.type) {
      case 'ping':
        this.sendMessage(clientId, {
          type: 'pong',
          data: { timestamp: Date.now() },
          timestamp: Date.now()
        })
        break

      case 'subscribe':
        // 处理订阅请求
        const { channel } = message.data
        console.log(`Client ${clientId} subscribed to channel: ${channel}`)
        break

      case 'unsubscribe':
        // 处理取消订阅请求
        const { channel: unsubChannel } = message.data
        console.log(`Client ${clientId} unsubscribed from channel: ${unsubChannel}`)
        break

      default:
        console.log(`Unknown message type: ${message.type}`)
    }
  }

  // 清理不活跃的客户端
  private cleanupInactiveClients() {
    const now = new Date()
    const timeout = 5 * 60 * 1000 // 5分钟不活跃超时

    this.clients.forEach((client, clientId) => {
      if (now.getTime() - client.lastActivity.getTime() > timeout) {
        try {
          client.ws.close()
        } catch {
          // 忽略错误
        }
        this.clients.delete(clientId)
        console.log(`Cleaned up inactive client: ${clientId}`)
      }
    })

    console.log(`Active clients: ${this.clients.size}`)
  }

  // 发送任务进度消息
  sendTaskProgress(event: TaskProgressEvent) {
    this.broadcast({
      type: 'task:progress',
      data: event,
      timestamp: Date.now()
    })
  }

  // 发送工具执行消息
  sendToolExecution(toolName: string, params: any, result: any) {
    this.broadcast({
      type: 'tool:execution',
      data: {
        toolName,
        params,
        result,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    })
  }

  // 发送系统消息
  sendSystemMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    this.broadcast({
      type: 'system:message',
      data: {
        message,
        level,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    })
  }

  // 获取客户端数量
  getClientCount(): number {
    return this.clients.size
  }

  // 获取服务器状态
  getStatus(): {
    running: boolean
    port: number
    clientCount: number
    uptime?: number
  } {
    return {
      running: !!this.server,
      port: this.port,
      clientCount: this.clients.size,
      uptime: this.server ? process.uptime() : undefined
    }
  }
}

// 导出单例
export const webSocketService = new WebSocketService()
