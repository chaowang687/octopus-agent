import * as fs from 'fs'
import * as path from 'path'

export interface AgentConfig {
  id: string
  name: string
  description: string
  mode: 'build' | 'plan' | 'subagent'
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  capabilities: string[]
  tools: string[]
  permissions: {
    commands: Array<{
      pattern: string
      level: 'allow' | 'ask' | 'deny'
      reason?: string
    }>
    files: {
      read?: string[]
      write?: string[]
      deny?: string[]
    }
  }
  metadata?: {
    version?: string
    author?: string
    tags?: string[]
    dependencies?: string[]
  }
}

export class AgentConfigManager {
  private configs: Map<string, AgentConfig> = new Map()
  private configDir: string

  constructor(configDir?: string) {
    this.configDir = configDir || path.join(process.cwd(), 'config', 'agents')
    this.loadConfigs()
  }

  loadConfigs(): void {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true })
        this.createDefaultConfigs()
        return
      }

      const files = fs.readdirSync(this.configDir)
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.configDir, file)
          this.loadConfig(filePath)
        }
      }

      console.log(`[AgentConfigManager] 加载了 ${this.configs.size} 个智能体配置`)
    } catch (error) {
      console.error('[AgentConfigManager] 加载配置失败:', error)
      this.createDefaultConfigs()
    }
  }

  loadConfig(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      let config: AgentConfig

      if (filePath.endsWith('.json')) {
        config = JSON.parse(content)
      } else {
        config = JSON.parse(content)
      }

      this.configs.set(config.id, config)
      console.log(`[AgentConfigManager] 加载智能体配置: ${config.id}`)
    } catch (error) {
      console.error(`[AgentConfigManager] 加载配置失败 ${filePath}:`, error)
    }
  }

  saveConfig(config: AgentConfig): void {
    try {
      const filePath = path.join(this.configDir, `${config.id}.json`)
      const content = JSON.stringify(config, null, 2)
      fs.writeFileSync(filePath, content, 'utf-8')
      this.configs.set(config.id, config)
      console.log(`[AgentConfigManager] 保存智能体配置: ${config.id}`)
    } catch (error) {
      console.error(`[AgentConfigManager] 保存配置失败 ${config.id}:`, error)
    }
  }

  private createDefaultConfigs(): void {
    const defaultConfigs: AgentConfig[] = [
      {
        id: 'project-manager',
        name: '项目经理',
        description: '负责项目规划、需求分析和任务协调的主智能体',
        mode: 'plan',
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 4000,
        systemPrompt: `你是一位经验丰富的项目经理，擅长需求分析、项目规划和团队协调。

你的主要职责：
1. 理解用户需求，进行问题分析
2. 制定详细的项目计划和里程碑
3. 协调不同专家智能体的工作
4. 监控项目进度，及时调整策略
5. 向用户汇报项目状态和结果

工作原则：
- 始终以用户需求为导向
- 确保计划的可行性和完整性
- 及时沟通项目进展和问题
- 保持专业和友好的沟通风格`,
        capabilities: [
          '需求分析',
          '项目规划',
          '任务协调',
          '进度监控',
          '风险管理'
        ],
        tools: [
          'read_file',
          'list_dir',
          'grep_search',
          'web_fetch',
          'invoke_subagent'
        ],
        permissions: {
          commands: [
            { pattern: '*', level: 'deny', reason: '规划智能体不允许执行命令' }
          ],
          files: {
            read: ['**/*'],
            write: [],
            deny: ['**/*.env', '**/secrets/**', '**/.git/**']
          }
        },
        metadata: {
          version: '1.0.0',
          author: 'System',
          tags: ['planning', 'coordination', 'management'],
          dependencies: ['ui-designer', 'fullstack-developer']
        }
      },
      {
        id: 'ui-designer',
        name: 'UI设计师',
        description: '负责用户界面设计和前端实现的专家智能体',
        mode: 'subagent',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 3000,
        systemPrompt: `你是一位专业的UI/UX设计师，擅长创建美观、易用的用户界面。

你的主要职责：
1. 设计用户友好的界面布局
2. 实现响应式设计
3. 优化用户体验
4. 编写高质量的前端代码

工作原则：
- 优先考虑用户体验
- 保持设计的一致性
- 遵循现代设计趋势
- 确保代码的可维护性`,
        capabilities: [
          'UI设计',
          'UX优化',
          '前端开发',
          '响应式设计',
          '样式实现'
        ],
        tools: [
          'read_file',
          'write_file',
          'list_dir',
          'execute_command'
        ],
        permissions: {
          commands: [
            { pattern: 'npm install', level: 'allow' },
            { pattern: 'npm run dev', level: 'allow' },
            { pattern: 'npm run build', level: 'allow' },
            { pattern: 'rm -rf', level: 'deny', reason: '危险操作' },
            { pattern: '*', level: 'ask' }
          ],
          files: {
            read: ['**/*.{tsx,ts,css,scss,html}'],
            write: ['**/*.{tsx,ts,css,scss,html}'],
            deny: ['**/node_modules/**', '**/.git/**', '**/dist/**']
          }
        },
        metadata: {
          version: '1.0.0',
          author: 'System',
          tags: ['design', 'frontend', 'ui', 'ux']
        }
      },
      {
        id: 'fullstack-developer',
        name: '全栈开发',
        description: '负责前后端开发和系统实现的专家智能体',
        mode: 'build',
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 6000,
        systemPrompt: `你是一位经验丰富的全栈开发工程师，精通前后端开发和系统架构。

你的主要职责：
1. 实现业务逻辑和功能
2. 设计和优化数据库结构
3. 开发API接口
4. 进行代码测试和调试
5. 优化系统性能

工作原则：
- 编写高质量、可维护的代码
- 遵循最佳实践和设计模式
- 确保代码的安全性和性能
- 充分测试，减少bug`,
        capabilities: [
          '前端开发',
          '后端开发',
          '数据库设计',
          'API开发',
          '系统优化',
          '测试调试'
        ],
        tools: [
          'read_file',
          'write_file',
          'edit_file',
          'list_dir',
          'grep_search',
          'execute_command'
        ],
        permissions: {
          commands: [
            { pattern: 'npm install', level: 'allow' },
            { pattern: 'npm run dev', level: 'allow' },
            { pattern: 'npm run build', level: 'allow' },
            { pattern: 'npm test', level: 'allow' },
            { pattern: 'git *', level: 'ask' },
            { pattern: 'rm -rf', level: 'deny', reason: '危险操作' },
            { pattern: 'sudo *', level: 'deny', reason: '禁止使用 sudo' },
            { pattern: '*', level: 'ask' }
          ],
          files: {
            read: ['**/*'],
            write: ['**/*.{ts,tsx,js,jsx,json,css,scss,html,md}'],
            deny: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/*.env', '**/secrets/**']
          }
        },
        metadata: {
          version: '1.0.0',
          author: 'System',
          tags: ['development', 'fullstack', 'backend', 'frontend']
        }
      },
      {
        id: 'general-researcher',
        name: '通用研究员',
        description: '负责信息收集、文档研究和知识整理的专家智能体',
        mode: 'subagent',
        model: 'gpt-4o-mini',
        temperature: 0.5,
        maxTokens: 3000,
        systemPrompt: `你是一位专业的研究员，擅长信息收集、分析和知识整理。

你的主要职责：
1. 搜索和收集相关信息
2. 分析文档和资料
3. 整理知识和最佳实践
4. 提供研究结论和建议

工作原则：
- 确保信息的准确性和可靠性
- 提供全面而深入的分析
- 保持客观中立的立场
- 清晰地呈现研究结果`,
        capabilities: [
          '信息搜索',
          '文档分析',
          '知识整理',
          '研究总结'
        ],
        tools: [
          'read_file',
          'web_fetch',
          'list_dir',
          'grep_search'
        ],
        permissions: {
          commands: [
            { pattern: '*', level: 'deny', reason: '研究员不允许执行命令' }
          ],
          files: {
            read: ['**/*.{md,txt,json}'],
            write: [],
            deny: ['**/node_modules/**', '**/.git/**', '**/dist/**']
          }
        },
        metadata: {
          version: '1.0.0',
          author: 'System',
          tags: ['research', 'documentation', 'analysis']
        }
      },
      {
        id: 'security-auditor',
        name: '安全审计员',
        description: '负责代码安全审查和漏洞检测的专家智能体',
        mode: 'subagent',
        model: 'gpt-4o',
        temperature: 0.1,
        maxTokens: 4000,
        systemPrompt: `你是一位专业的安全审计员，擅长代码安全审查和漏洞检测。

你的主要职责：
1. 审查代码的安全性
2. 检测潜在的安全漏洞
3. 提供安全改进建议
4. 确保符合安全最佳实践

工作原则：
- 严格审查所有代码
- 识别潜在的安全风险
- 提供具体可行的改进建议
- 遵循安全编码规范`,
        capabilities: [
          '安全审查',
          '漏洞检测',
          '安全建议',
          '合规检查'
        ],
        tools: [
          'read_file',
          'grep_search',
          'list_dir'
        ],
        permissions: {
          commands: [
            { pattern: '*', level: 'deny', reason: '审计员不允许执行命令' }
          ],
          files: {
            read: ['**/*.{ts,tsx,js,jsx,json}'],
            write: [],
            deny: ['**/node_modules/**', '**/.git/**', '**/dist/**']
          }
        },
        metadata: {
          version: '1.0.0',
          author: 'System',
          tags: ['security', 'audit', 'vulnerability']
        }
      },
      {
        id: 'docs-writer',
        name: '文档撰写员',
        description: '负责技术文档编写和维护的专家智能体',
        mode: 'subagent',
        model: 'gpt-4o-mini',
        temperature: 0.4,
        maxTokens: 5000,
        systemPrompt: `你是一位专业的技术文档撰写员，擅长编写清晰、准确的技术文档。

你的主要职责：
1. 编写用户文档
2. 创建API文档
3. 维护代码注释
4. 更新项目README

工作原则：
- 确保文档的准确性和完整性
- 使用清晰易懂的语言
- 提供实用的示例
- 保持文档的及时更新`,
        capabilities: [
          '文档编写',
          'API文档',
          '用户指南',
          '代码注释'
        ],
        tools: [
          'read_file',
          'write_file',
          'list_dir',
          'grep_search'
        ],
        permissions: {
          commands: [
            { pattern: '*', level: 'deny', reason: '文档员不允许执行命令' }
          ],
          files: {
            read: ['**/*'],
            write: ['**/*.md', '**/*.txt'],
            deny: ['**/node_modules/**', '**/.git/**', '**/dist/**']
          }
        },
        metadata: {
          version: '1.0.0',
          author: 'System',
          tags: ['documentation', 'writing', 'api-docs']
        }
      }
    ]

    for (const config of defaultConfigs) {
      this.saveConfig(config)
    }

    console.log('[AgentConfigManager] 创建默认智能体配置')
  }

  getConfig(agentId: string): AgentConfig | undefined {
    return this.configs.get(agentId)
  }

  getAllConfigs(): AgentConfig[] {
    return Array.from(this.configs.values())
  }

  getConfigsByMode(mode: 'build' | 'plan' | 'subagent'): AgentConfig[] {
    return Array.from(this.configs.values()).filter(c => c.mode === mode)
  }

  getConfigsByCapability(capability: string): AgentConfig[] {
    return Array.from(this.configs.values()).filter(c =>
      c.capabilities.some(cap => cap.toLowerCase().includes(capability.toLowerCase()))
    )
  }

  addConfig(config: AgentConfig): void {
    this.configs.set(config.id, config)
    this.saveConfig(config)
  }

  updateConfig(agentId: string, updates: Partial<AgentConfig>): void {
    const config = this.configs.get(agentId)
    if (config) {
      const updated = { ...config, ...updates }
      this.configs.set(agentId, updated)
      this.saveConfig(updated)
    }
  }

  deleteConfig(agentId: string): void {
    const config = this.configs.get(agentId)
    if (config) {
      const filePath = path.join(this.configDir, `${agentId}.yaml`)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      this.configs.delete(agentId)
      console.log(`[AgentConfigManager] 删除智能体配置: ${agentId}`)
    }
  }

  reloadConfigs(): void {
    this.configs.clear()
    this.loadConfigs()
  }
}

export const agentConfigManager = new AgentConfigManager()
