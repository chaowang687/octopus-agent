import * as fs from 'fs'
import * as path from 'path'

export enum PermissionLevel {
  ALLOW = 'allow',       // 允许执行
  ASK = 'ask',           // 询问用户
  DENY = 'deny'          // 拒绝执行
}

export interface PermissionRule {
  pattern: string        // 命令或操作模式（支持通配符）
  level: PermissionLevel
  reason?: string       // 拒绝或询问的原因
}

export interface AgentPermissions {
  agentId: string
  agentName: string
  mode: 'build' | 'plan' | 'subagent'
  tools: {
    [toolName: string]: {
      read?: boolean
      write?: boolean
      execute?: boolean
      level?: PermissionLevel
    }
  }
  commands: PermissionRule[]
  files: {
    read?: string[]      // 允许读取的文件路径模式
    write?: string[]     // 允许写入的文件路径模式
    deny?: string[]      // 禁止访问的文件路径模式
  }
}

export class PermissionSystem {
  private permissions: Map<string, AgentPermissions> = new Map()
  private permissionHistory: Array<{
    timestamp: number
    agentId: string
    action: string
    level: PermissionLevel
    granted: boolean
  }> = []
  private permissionConfigPath: string

  constructor(configPath?: string) {
    this.permissionConfigPath = configPath || path.join(process.cwd(), 'permissions.json')
    this.loadPermissions()
  }

  loadPermissions(): void {
    try {
      if (fs.existsSync(this.permissionConfigPath)) {
        const config = JSON.parse(fs.readFileSync(this.permissionConfigPath, 'utf-8'))
        config.agents?.forEach((agent: AgentPermissions) => {
          this.permissions.set(agent.agentId, agent)
        })
        console.log('[PermissionSystem] 加载权限配置成功')
      } else {
        this.initializeDefaultPermissions()
      }
    } catch (error) {
      console.error('[PermissionSystem] 加载权限配置失败:', error)
      this.initializeDefaultPermissions()
    }
  }

  savePermissions(): void {
    try {
      const config = {
        version: '1.0',
        agents: Array.from(this.permissions.values())
      }
      fs.writeFileSync(this.permissionConfigPath, JSON.stringify(config, null, 2))
      console.log('[PermissionSystem] 保存权限配置成功')
    } catch (error) {
      console.error('[PermissionSystem] 保存权限配置失败:', error)
    }
  }

  private initializeDefaultPermissions(): void {
    const defaultAgents: AgentPermissions[] = [
      {
        agentId: 'project-manager',
        agentName: '项目经理',
        mode: 'plan',
        tools: {
          read_file: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          list_dir: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          grep_search: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          web_fetch: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          write_file: { read: false, write: true, execute: false, level: PermissionLevel.DENY },
          execute_command: { read: false, write: false, execute: true, level: PermissionLevel.DENY }
        },
        commands: [
          { pattern: '*', level: PermissionLevel.DENY, reason: '规划智能体不允许执行命令' }
        ],
        files: {
          read: ['**/*'],
          write: [],
          deny: ['**/*.env', '**/secrets/**', '**/.git/**']
        }
      },
      {
        agentId: 'ui-designer',
        agentName: 'UI设计师',
        mode: 'subagent',
        tools: {
          read_file: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          write_file: { read: false, write: true, execute: false, level: PermissionLevel.ASK },
          execute_command: { read: false, write: false, execute: true, level: PermissionLevel.ASK }
        },
        commands: [
          { pattern: 'npm install', level: PermissionLevel.ALLOW },
          { pattern: 'npm run dev', level: PermissionLevel.ALLOW },
          { pattern: 'npm run build', level: PermissionLevel.ALLOW },
          { pattern: 'rm -rf', level: PermissionLevel.DENY, reason: '危险操作，需要手动确认' },
          { pattern: '*', level: PermissionLevel.ASK }
        ],
        files: {
          read: ['**/*.{tsx,ts,css,scss,html}'],
          write: ['**/*.{tsx,ts,css,scss,html}'],
          deny: ['**/node_modules/**', '**/.git/**', '**/dist/**']
        }
      },
      {
        agentId: 'fullstack-developer',
        agentName: '全栈开发',
        mode: 'build',
        tools: {
          read_file: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          write_file: { read: false, write: true, execute: false, level: PermissionLevel.ALLOW },
          execute_command: { read: false, write: false, execute: true, level: PermissionLevel.ASK }
        },
        commands: [
          { pattern: 'npm install', level: PermissionLevel.ALLOW },
          { pattern: 'npm run dev', level: PermissionLevel.ALLOW },
          { pattern: 'npm run build', level: PermissionLevel.ALLOW },
          { pattern: 'npm test', level: PermissionLevel.ALLOW },
          { pattern: 'git *', level: PermissionLevel.ASK },
          { pattern: 'rm -rf', level: PermissionLevel.DENY, reason: '危险操作，需要手动确认' },
          { pattern: 'sudo *', level: PermissionLevel.DENY, reason: '禁止使用 sudo' },
          { pattern: '*', level: PermissionLevel.ASK }
        ],
        files: {
          read: ['**/*'],
          write: ['**/*.{ts,tsx,js,jsx,json,css,scss,html,md}'],
          deny: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/*.env', '**/secrets/**']
        }
      },
      {
        agentId: 'general-researcher',
        agentName: '通用研究员',
        mode: 'subagent',
        tools: {
          read_file: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          web_fetch: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          write_file: { read: false, write: true, execute: false, level: PermissionLevel.DENY },
          execute_command: { read: false, write: false, execute: true, level: PermissionLevel.DENY }
        },
        commands: [
          { pattern: '*', level: PermissionLevel.DENY, reason: '研究员不允许执行命令' }
        ],
        files: {
          read: ['**/*.{md,txt,json}'],
          write: [],
          deny: ['**/node_modules/**', '**/.git/**', '**/dist/**']
        }
      },
      {
        agentId: 'pm',
        agentName: '项目经理 (PM)',
        mode: 'plan',
        tools: {
          read_file: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          list_dir: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          grep_search: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          web_fetch: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          write_file: { read: false, write: true, execute: false, level: PermissionLevel.ALLOW },
          execute_command: { read: false, write: false, execute: true, level: PermissionLevel.DENY }
        },
        commands: [
          { pattern: '*', level: PermissionLevel.DENY, reason: 'PM智能体不允许执行命令' }
        ],
        files: {
          read: ['**/*'],
          write: ['**/docs/**/*.md'],
          deny: ['**/*.env', '**/secrets/**', '**/.git/**']
        }
      },
      {
        agentId: 'ui',
        agentName: 'UI设计师',
        mode: 'subagent',
        tools: {
          read_file: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          write_file: { read: false, write: true, execute: false, level: PermissionLevel.ALLOW },
          execute_command: { read: false, write: false, execute: true, level: PermissionLevel.ASK }
        },
        commands: [
          { pattern: 'npm install', level: PermissionLevel.ALLOW },
          { pattern: 'npm run dev', level: PermissionLevel.ALLOW },
          { pattern: 'npm run build', level: PermissionLevel.ALLOW },
          { pattern: 'rm -rf', level: PermissionLevel.DENY, reason: '危险操作，需要手动确认' },
          { pattern: '*', level: PermissionLevel.ASK }
        ],
        files: {
          read: ['**/*.{tsx,ts,css,scss,html,vue}'],
          write: ['**/*.{tsx,ts,css,scss,html,vue}'],
          deny: ['**/node_modules/**', '**/.git/**', '**/dist/**']
        }
      },
      {
        agentId: 'dev',
        agentName: '全栈开发工程师',
        mode: 'build',
        tools: {
          read_file: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          write_file: { read: false, write: true, execute: false, level: PermissionLevel.ALLOW },
          execute_command: { read: false, write: false, execute: true, level: PermissionLevel.ALLOW },
          create_directory: { read: false, write: true, execute: false, level: PermissionLevel.ALLOW },
          list_dir: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          grep_search: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW }
        },
        commands: [
          { pattern: 'npm *', level: PermissionLevel.ALLOW },
          { pattern: 'yarn *', level: PermissionLevel.ALLOW },
          { pattern: 'pnpm *', level: PermissionLevel.ALLOW },
          { pattern: 'node *', level: PermissionLevel.ALLOW },
          { pattern: 'npx *', level: PermissionLevel.ALLOW },
          { pattern: 'git *', level: PermissionLevel.ALLOW },
          { pattern: 'ls *', level: PermissionLevel.ALLOW },
          { pattern: 'cat *', level: PermissionLevel.ALLOW },
          { pattern: 'mkdir *', level: PermissionLevel.ALLOW },
          { pattern: 'touch *', level: PermissionLevel.ALLOW },
          { pattern: 'rm -rf', level: PermissionLevel.ASK, reason: '危险操作，需要确认' },
          { pattern: 'sudo *', level: PermissionLevel.DENY, reason: '禁止使用 sudo' },
          { pattern: '*', level: PermissionLevel.ASK }
        ],
        files: {
          read: ['**/*'],
          write: ['**/*'],
          deny: ['**/node_modules/**', '**/.git/**', '**/*.env', '**/secrets/**']
        }
      },
      {
        agentId: 'test',
        agentName: '测试工程师',
        mode: 'subagent',
        tools: {
          read_file: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          write_file: { read: false, write: true, execute: false, level: PermissionLevel.ALLOW },
          execute_command: { read: false, write: false, execute: true, level: PermissionLevel.ALLOW },
          list_dir: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          grep_search: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW }
        },
        commands: [
          { pattern: 'npm test', level: PermissionLevel.ALLOW },
          { pattern: 'npm run test*', level: PermissionLevel.ALLOW },
          { pattern: 'jest *', level: PermissionLevel.ALLOW },
          { pattern: 'vitest *', level: PermissionLevel.ALLOW },
          { pattern: 'cypress *', level: PermissionLevel.ALLOW },
          { pattern: 'playwright *', level: PermissionLevel.ALLOW },
          { pattern: 'ls *', level: PermissionLevel.ALLOW },
          { pattern: 'cat *', level: PermissionLevel.ALLOW },
          { pattern: 'rm -rf', level: PermissionLevel.DENY, reason: '危险操作' },
          { pattern: 'sudo *', level: PermissionLevel.DENY, reason: '禁止使用 sudo' },
          { pattern: '*', level: PermissionLevel.ASK }
        ],
        files: {
          read: ['**/*'],
          write: ['**/*.{test.ts,test.js,spec.ts,spec.js}'],
          deny: ['**/node_modules/**', '**/.git/**', '**/*.env', '**/secrets/**']
        }
      },
      {
        agentId: 'review',
        agentName: '代码审查员',
        mode: 'subagent',
        tools: {
          read_file: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          write_file: { read: false, write: true, execute: false, level: PermissionLevel.ALLOW },
          execute_command: { read: false, write: false, execute: true, level: PermissionLevel.DENY },
          list_dir: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW },
          grep_search: { read: true, write: false, execute: false, level: PermissionLevel.ALLOW }
        },
        commands: [
          { pattern: '*', level: PermissionLevel.DENY, reason: '审查员不允许执行命令' }
        ],
        files: {
          read: ['**/*'],
          write: ['**/docs/**/*.md'],
          deny: ['**/node_modules/**', '**/.git/**', '**/*.env', '**/secrets/**']
        }
      }
    ]

    defaultAgents.forEach(agent => {
      this.permissions.set(agent.agentId, agent)
    })

    this.savePermissions()
    console.log('[PermissionSystem] 初始化默认权限配置')
  }

  checkToolPermission(agentId: string, toolName: string, operation: 'read' | 'write' | 'execute'): PermissionLevel {
    const agent = this.permissions.get(agentId)
    if (!agent) {
      console.warn(`[PermissionSystem] 未找到智能体 ${agentId} 的权限配置，使用默认策略`)
      return PermissionLevel.ASK
    }

    const tool = agent.tools[toolName]
    if (!tool) {
      console.warn(`[PermissionSystem] 未找到工具 ${toolName} 的权限配置`)
      return PermissionLevel.ASK
    }

    if (tool.level) {
      return tool.level
    }

    if (operation === 'read' && tool.read) return PermissionLevel.ALLOW
    if (operation === 'write' && tool.write) return PermissionLevel.ALLOW
    if (operation === 'execute' && tool.execute) return PermissionLevel.ALLOW

    return PermissionLevel.DENY
  }

  checkCommandPermission(agentId: string, command: string): { level: PermissionLevel; reason?: string } {
    const agent = this.permissions.get(agentId)
    if (!agent) {
      return { level: PermissionLevel.ASK, reason: '未找到智能体权限配置' }
    }

    for (const rule of agent.commands) {
      if (this.matchPattern(command, rule.pattern)) {
        return { level: rule.level, reason: rule.reason }
      }
    }

    return { level: PermissionLevel.ASK, reason: '未匹配到明确的权限规则' }
  }

  checkFilePermission(agentId: string, filePath: string, operation: 'read' | 'write'): PermissionLevel {
    const agent = this.permissions.get(agentId)
    if (!agent) {
      return PermissionLevel.ASK
    }

    const normalizedPath = path.normalize(filePath)

    if (agent.files.deny) {
      for (const denyPattern of agent.files.deny) {
        if (this.matchPattern(normalizedPath, denyPattern)) {
          return PermissionLevel.DENY
        }
      }
    }

    const allowedPatterns = operation === 'read' ? agent.files.read : agent.files.write
    if (!allowedPatterns || allowedPatterns.length === 0) {
      return PermissionLevel.DENY
    }

    for (const pattern of allowedPatterns) {
      if (this.matchPattern(normalizedPath, pattern)) {
        return PermissionLevel.ALLOW
      }
    }

    return PermissionLevel.ASK
  }

  private matchPattern(input: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(input)
  }

  recordPermission(agentId: string, action: string, level: PermissionLevel, granted: boolean): void {
    this.permissionHistory.push({
      timestamp: Date.now(),
      agentId,
      action,
      level,
      granted
    })

    if (this.permissionHistory.length > 1000) {
      this.permissionHistory = this.permissionHistory.slice(-1000)
    }
  }

  getPermissionHistory(agentId?: string, limit: number = 50): Array<{
    timestamp: number
    agentId: string
    action: string
    level: PermissionLevel
    granted: boolean
  }> {
    let history = this.permissionHistory

    if (agentId) {
      history = history.filter(h => h.agentId === agentId)
    }

    return history.slice(-limit)
  }

  addAgent(agent: AgentPermissions): void {
    this.permissions.set(agent.agentId, agent)
    this.savePermissions()
  }

  updateAgent(agentId: string, updates: Partial<AgentPermissions>): void {
    const agent = this.permissions.get(agentId)
    if (agent) {
      const updated = { ...agent, ...updates }
      this.permissions.set(agentId, updated)
      this.savePermissions()
    }
  }

  getAgent(agentId: string): AgentPermissions | undefined {
    return this.permissions.get(agentId)
  }

  getAllAgents(): AgentPermissions[] {
    return Array.from(this.permissions.values())
  }
}

export const permissionSystem = new PermissionSystem()
