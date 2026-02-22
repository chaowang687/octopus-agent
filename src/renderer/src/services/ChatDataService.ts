import { v4 as uuidv4 } from 'uuid'

export interface Agent {
  id: string
  name: string
  avatar: string
  description: string
  systemPrompt: string
  model: string // 'openai' | 'claude' | 'minimax' | 'deepseek'
  isSystem?: boolean // If true, cannot be deleted
}

export interface ChatSession {
  id: string
  name: string
  type: 'direct' | 'group'
  members: string[] // Agent IDs
  lastMessage?: string
  lastTime?: string
  unread: number
  active?: boolean
  messages: any[] // Store messages per session
  projectId?: string // Associate session with project
}

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-pm',
    name: '项目经理 (PM)',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PM',
    description: '负责需求分析、用户故事拆解和进度管理',
    systemPrompt: '你是经验丰富的互联网产品经理。你的职责是分析用户需求，拆解为清晰的用户故事（User Stories），并规划项目里程碑。你需要确保需求逻辑自洽，并能被开发人员理解。',
    model: 'openai',
    isSystem: true
  },
  {
    id: 'agent-dev',
    name: '全栈开发 (Dev)',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev',
    description: '负责代码架构设计、实现与调试',
    systemPrompt: '你是全栈开发专家，精通 TypeScript, React, Node.js 和 Electron。你的代码风格简洁、健壮且易于维护。你总是优先考虑性能和安全性。',
    model: 'deepseek', // DeepSeek is good at code
    isSystem: true
  },
  {
    id: 'agent-ui',
    name: 'UI 设计师',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=UI',
    description: '负责界面视觉设计、交互体验优化及创意编程可视化',
    systemPrompt: '你是资深UI/UX设计师，具备卓越的审美和技术实现能力。核心能力：1. 风格把控：能精准判断并驾驭各种设计风格（如极简、新拟态、赛博朋克等）。2. 排版与交互：对UI文字排版有深厚功底，注重微交互细节的审美体验。3. 程序可视化：擅长使用代码进行艺术创作和数据可视化。技能栈：精通 Python、JavaScript 和 Processing。在设计建议中，请结合视觉美学与技术实现，必要时提供 P5.js、Processing 或 Python 可视化代码示例。',
    model: 'claude', // Claude is good at aesthetics
    isSystem: true
  },
  {
    id: 'agent-artist',
    name: '原画师',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Art',
    description: '负责概念设计和图像生成',
    systemPrompt: '你是概念艺术家。你擅长通过文字描述画面。当用户需要图片时，请构思详细的画面提示词，并调用生图工具进行创作。',
    model: 'openai',
    isSystem: true
  },
  {
    id: 'agent-solo-coder',
    name: 'SOLO Coder',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SoloCoder',
    description: '面向复杂项目开发的智能体。高效完成从需求迭代到架构重构的全流程开发工作。',
    systemPrompt: '你是 SOLO Coder，一名面向复杂项目的全流程自动化开发智能体。你能够从自然语言需求出发，进行需求澄清、任务拆解、技术方案设计、代码实现、测试与重构。你应优先使用可用的文件、终端、预览、MCP 等工具对代码仓库进行分析和修改，保证变更安全可回滚，并在关键步骤向用户汇报决策与结果。',
    model: 'deepseek',
    isSystem: true
  },
  {
    id: 'agent-solo-builder',
    name: 'SOLO Builder',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SoloBuilder',
    description: '快速构建专业且功能完善的 Web 应用。从自然语言需求生成 PRD、代码并提供预览。',
    systemPrompt: '你是 SOLO Builder，一名专注于从零构建 Web 应用的智能体。用户只需用自然语言描述应用需求，你负责澄清目标、生成结构化 PRD、设计信息架构与交互流程，并在现有项目结构下生成或修改前后端代码，完成可运行的最小可用版本，并提供清晰的使用与后续扩展说明。',
    model: 'openai',
    isSystem: true
  },
  {
    id: 'agent-test-generator',
    name: '测试工程师',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Test',
    description: '负责测试用例设计、测试执行和质量保证',
    systemPrompt: '你是测试工程师。你需要：1. 根据PM的需求分析和开发代码，设计测试用例；2. 生成单元测试、集成测试代码；3. 确保测试覆盖率。当你完成测试后，告诉用户"测试完成"。',
    model: 'deepseek',
    isSystem: true
  },
  {
    id: 'agent-code-reviewer',
    name: '代码审查员',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Review',
    description: '负责代码审查，安全分析和性能优化建议',
    systemPrompt: '你是代码审查专家。你需要：1. 审查开发工程师的代码；2. 检查代码质量、安全性、性能；3. 提供改进建议。当你完成审查后，告诉用户"代码审查完成"。',
    model: 'claude',
    isSystem: true
  }
]

const STORAGE_KEY_AGENTS = 'trae_agents_v1'
const STORAGE_KEY_SESSIONS = 'trae_sessions_v1'

export class ChatDataService {
  private agents: Agent[] = []
  private sessions: ChatSession[] = []

  constructor() {
    this.load()
  }

  private load() {
    try {
      const storedAgents = localStorage.getItem(STORAGE_KEY_AGENTS)
      if (storedAgents) {
        this.agents = JSON.parse(storedAgents)
        
        // Sync system agents to ensure updates (like new prompts) are applied
        let changed = false
        DEFAULT_AGENTS.forEach(defaultAgent => {
          const existingIndex = this.agents.findIndex(a => a.id === defaultAgent.id)
          if (existingIndex !== -1) {
            // Update system agent properties
            if (this.agents[existingIndex].isSystem) {
              const current = this.agents[existingIndex]
              if (current.systemPrompt !== defaultAgent.systemPrompt || 
                  current.description !== defaultAgent.description) {
                this.agents[existingIndex] = { ...current, ...defaultAgent }
                changed = true
              }
            }
          } else {
            // Add missing system agent
            this.agents.push(defaultAgent)
            changed = true
          }
        })
        
        if (changed) {
          this.saveAgents()
        }
      } else {
        this.agents = [...DEFAULT_AGENTS]
        this.saveAgents()
      }

      const storedSessions = localStorage.getItem(STORAGE_KEY_SESSIONS)
      if (storedSessions) {
        this.sessions = JSON.parse(storedSessions)
      } else {
        // Init default sessions
        this.sessions = [
          {
            id: 'session-default',
            name: 'Trae Agent',
            type: 'direct',
            members: ['agent-dev'], // Default to Dev
            unread: 0,
            messages: []
          }
        ]
        this.saveSessions()
      }
    } catch (e) {
      console.error('Failed to load chat data', e)
    }
  }

  private saveAgents() {
    localStorage.setItem(STORAGE_KEY_AGENTS, JSON.stringify(this.agents))
  }

  private saveSessions() {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(this.sessions))
  }

  // --- Agents ---

  getAgents(): Agent[] {
    return this.agents
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.find(a => a.id === id)
  }

  createAgent(agent: Omit<Agent, 'id'>): Agent {
    const newAgent: Agent = { ...agent, id: uuidv4() }
    this.agents.push(newAgent)
    this.saveAgents()
    return newAgent
  }

  updateAgent(id: string, updates: Partial<Agent>) {
    const idx = this.agents.findIndex(a => a.id === id)
    if (idx !== -1) {
      this.agents[idx] = { ...this.agents[idx], ...updates }
      this.saveAgents()
    }
  }

  deleteAgent(id: string) {
    this.agents = this.agents.filter(a => a.id !== id)
    this.saveAgents()
  }

  // --- Sessions ---

  getSessions(): ChatSession[] {
    return this.sessions
  }

  getSession(id: string): ChatSession | undefined {
    return this.sessions.find(s => s.id === id)
  }

  createSession(name: string, members: string[], type: 'direct' | 'group'): ChatSession {
    const newSession: ChatSession = {
      id: uuidv4(),
      name,
      members,
      type,
      unread: 0,
      messages: [],
      lastTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    this.sessions.unshift(newSession)
    this.saveSessions()
    return newSession
  }

  updateSession(id: string, updates: Partial<ChatSession>) {
    const idx = this.sessions.findIndex(s => s.id === id)
    if (idx !== -1) {
      this.sessions[idx] = { ...this.sessions[idx], ...updates }
      this.saveSessions()
    }
  }

  deleteSession(id: string) {
    this.sessions = this.sessions.filter(s => s.id !== id)
    this.saveSessions()
  }

  // Message Handling (Basic persistence per session)
  saveMessages(sessionId: string, messages: any[]) {
    const session = this.getSession(sessionId)
    if (session) {
      session.messages = messages.slice(-100) // Keep last 100
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1]
        session.lastMessage = lastMsg.role === 'user' ? lastMsg.content : (lastMsg.thinking ? '正在思考...' : lastMsg.content)
        session.lastTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      this.saveSessions()
    }
  }
}

export const chatDataService = new ChatDataService()
