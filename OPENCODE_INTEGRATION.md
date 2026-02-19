# OpenCode 架构集成方案

## 📋 概述

本文档说明了如何将 OpenCode 的优秀架构设计整合到我们的项目中，以增强智能体的开发能力和安全性。

## 🏗️ 架构对比

### OpenCode 核心组件

| 组件 | 功能 | 状态 |
|------|------|------|
| 会话引擎 (Session Engine) | 管理对话上下文和状态 | ✅ 已实现 |
| 智能体注册表 (Agent Registry) | 管理可用智能体 | ✅ 已实现 |
| 工具注册表 (Tool Registry) | 管理可用工具 | ✅ 已实现 |
| 权限系统 (Permission System) | 控制智能体权限 | ✅ 新增 |
| LLM 协调器 (LLM Orchestrator) | 与 LLM 通信 | ✅ 已实现 |
| 智能体配置 (Agent Config) | 定义智能体行为 | ✅ 新增 |
| 项目上下文 (Project Context) | 理解项目结构 | ✅ 新增 |
| 持久化记忆 (Memory System) | 长期记忆存储 | ✅ 新增 |

### 我们的项目架构

```
┌─────────────────────────────────────────────────────────────┐
│                     TaskEngine (会话引擎)                     │
│  - 管理任务执行流程                                           │
│  - 协调多智能体协作                                           │
│  - 处理事件和状态                                             │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│ AgentScheduler │  │  ToolRegistry   │  │ ContextManager │
│ (智能体调度)    │  │  (工具注册)     │  │  (上下文管理)   │
└────────────────┘  └─────────────────┘  └────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼──────────────┐  ┌──▼──────────────┐  ┌──▼──────────────┐
│ PermissionSystem     │  │ AgentConfigManager│  │ MemorySystem    │
│ (权限系统)            │  │ (智能体配置)      │  │ (记忆系统)       │
└──────────────────────┘  └──────────────────┘  └─────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │ProjectContextAnalyzer│
                    │ (项目上下文分析)    │
                    └────────────────────┘
```

## ✅ 已实现的功能

### 1. 权限系统 (PermissionSystem)

**位置**: `src/main/permissions/PermissionSystem.ts`

**功能**:
- 三级权限控制：ALLOW、ASK、DENY
- 命令级权限控制
- 文件级权限控制
- 工具级权限控制
- 权限历史记录

**使用示例**:

```typescript
import { permissionSystem, PermissionLevel } from './permissions/PermissionSystem'

// 检查工具权限
const level = permissionSystem.checkToolPermission(
  'fullstack-developer',
  'execute_command',
  'execute'
)

if (level === PermissionLevel.ASK) {
  // 询问用户是否允许
  const granted = await askUser('是否允许执行此命令？')
  if (granted) {
    // 执行命令
  }
}

// 检查命令权限
const { level, reason } = permissionSystem.checkCommandPermission(
  'fullstack-developer',
  'rm -rf /some/path'
)

if (level === PermissionLevel.DENY) {
  console.log(`拒绝执行: ${reason}`)
}

// 检查文件权限
const fileLevel = permissionSystem.checkFilePermission(
  'ui-designer',
  '/path/to/file.tsx',
  'write'
)
```

### 2. 智能体配置系统 (AgentConfigManager)

**位置**: `src/main/agents/AgentConfigManager.ts`

**功能**:
- JSON 格式的智能体配置
- 支持多种智能体模式：build、plan、subagent
- 定义智能体能力、工具和权限
- 动态加载和更新配置

**配置示例**:

```json
{
  "id": "fullstack-developer",
  "name": "全栈开发",
  "description": "负责前后端开发和系统实现的专家智能体",
  "mode": "build",
  "model": "gpt-4o",
  "temperature": 0.2,
  "maxTokens": 6000,
  "systemPrompt": "你是一位经验丰富的全栈开发工程师...",
  "capabilities": [
    "前端开发",
    "后端开发",
    "数据库设计",
    "API开发",
    "系统优化",
    "测试调试"
  ],
  "tools": [
    "read_file",
    "write_file",
    "edit_file",
    "list_dir",
    "grep_search",
    "execute_command"
  ],
  "permissions": {
    "commands": [
      { "pattern": "npm install", "level": "allow" },
      { "pattern": "npm run dev", "level": "allow" },
      { "pattern": "rm -rf", "level": "deny", "reason": "危险操作" },
      { "pattern": "*", "level": "ask" }
    ],
    "files": {
      "read": ["**/*"],
      "write": ["**/*.{ts,tsx,js,jsx,json,css,scss,html,md}"],
      "deny": ["**/node_modules/**", "**/.git/**", "**/dist/**"]
    }
  }
}
```

**使用示例**:

```typescript
import { agentConfigManager } from './agents/AgentConfigManager'

// 获取智能体配置
const config = agentConfigManager.getConfig('fullstack-developer')

// 获取所有 build 模式的智能体
const buildAgents = agentConfigManager.getConfigsByMode('build')

// 根据能力查找智能体
const designAgents = agentConfigManager.getConfigsByCapability('UI设计')

// 添加新智能体
const newAgent = {
  id: 'custom-agent',
  name: '自定义智能体',
  description: '...',
  mode: 'subagent',
  // ...
}
agentConfigManager.addConfig(newAgent)
```

### 3. 项目上下文分析 (ProjectContextAnalyzer)

**位置**: `src/main/context/ProjectContextAnalyzer.ts`

**功能**:
- 自动检测项目类型（Electron、Next.js、Vite 等）
- 分析项目结构和依赖
- 识别编程语言和框架
- 生成项目指南

**使用示例**:

```typescript
import { projectContextAnalyzer } from './context/ProjectContextAnalyzer'

// 分析项目
const context = await projectContextAnalyzer.analyzeProject('/path/to/project')

console.log(context.projectType) // 'electron'
console.log(context.language) // 'typescript'
console.log(context.framework) // 'react'
console.log(context.dependencies.production)

// 生成项目指南
const guide = projectContextAnalyzer.generateProjectGuide(context)
console.log(guide)
```

**生成的项目指南示例**:

```markdown
# 项目指南: localized-agent-coder

## 项目信息
- 项目路径: /Users/wangchao/Desktop/本地化TRAE
- 项目类型: electron
- 编程语言: typescript
- 框架: react
- 构建系统: vite
- 包管理器: npm
- 测试框架: none

## 项目结构
主要目录: src, config, scripts
主要文件: index.ts, main.ts
配置文件: package.json, tsconfig.json, electron.vite.config.ts

## 依赖管理
生产依赖: react, react-dom, electron, ...
开发依赖: typescript, vite, @types/node, ...

## 可用脚本
- dev: 启动开发服务器
- build: 构建项目
- lint: 代码检查
- typecheck: 类型检查

## 代码规范
- 代码风格: eslint
- 文件命名: strict
- 目录结构: layered
- 文档: readme

## 注意事项
1. 使用 npm 作为包管理器
2. 运行 npm install 安装依赖
3. 使用 npm run dev 启动开发服务器
4. 使用 npm run build 构建项目
```

### 4. 持久化记忆系统 (MemorySystem)

**位置**: `src/main/memory/MemorySystem.ts`

**功能**:
- 三种记忆作用域：GLOBAL、PROJECT、SESSION
- 六种记忆类型：PREFERENCE、COMMAND、ARCHITECTURE、DEBUG、PATTERN、KNOWLEDGE
- 记忆查询和检索
- 记忆导入导出
- 访问统计

**使用示例**:

```typescript
import { memorySystem, MemoryScope, MemoryType } from './memory/MemorySystem'

// 设置用户偏好
memorySystem.setPreference('defaultModel', 'gpt-4o')
const model = memorySystem.getPreference('defaultModel')

// 记录项目命令
memorySystem.setCommand(
  'project-123',
  'npm run test',
  '运行单元测试'
)

// 获取项目命令
const commands = memorySystem.getCommands('project-123')

// 记录架构信息
memorySystem.setArchitecture(
  'project-123',
  'MVC架构',
  '使用 Model-View-Controller 模式组织代码'
)

// 记录调试经验
memorySystem.setDebug(
  'project-123',
  '端口被占用',
  '使用 lsof -i :5173 查找占用端口的进程并终止'
)

// 记录代码模式
memorySystem.setPattern(
  'project-123',
  'React Hooks',
  '使用 useState 和 useEffect 管理组件状态',
  'const [state, setState] = useState(initialValue)'
)

// 查询记忆
const results = memorySystem.query({
  scope: MemoryScope.PROJECT,
  type: MemoryType.DEBUG,
  projectId: 'project-123',
  limit: 10
})

// 获取统计信息
const stats = memorySystem.getStatistics()
console.log(`总记忆数: ${stats.total}`)
console.log(`按作用域:`, stats.byScope)
console.log(`按类型:`, stats.byType)
console.log(`最常访问:`, stats.mostAccessed)
```

## 🔧 集成到现有系统

### 1. 在 TaskEngine 中集成权限系统

```typescript
import { permissionSystem, PermissionLevel } from './permissions/PermissionSystem'

class TaskEngine {
  async executeCommand(agentId: string, command: string): Promise<any> {
    // 检查权限
    const { level, reason } = permissionSystem.checkCommandPermission(
      agentId,
      command
    )

    if (level === PermissionLevel.DENY) {
      throw new Error(`权限拒绝: ${reason}`)
    }

    if (level === PermissionLevel.ASK) {
      const granted = await this.askUser(`是否允许执行命令: ${command}?`)
      if (!granted) {
        throw new Error('用户拒绝了命令执行')
      }
    }

    // 记录权限
    permissionSystem.recordPermission(agentId, command, level, true)

    // 执行命令
    return await this.toolRegistry.execute('execute_command', { command })
  }
}
```

### 2. 在 AgentScheduler 中集成智能体配置

```typescript
import { agentConfigManager } from './agents/AgentConfigManager'

class AgentScheduler {
  async scheduleAgent(task: Task): Promise<Agent> {
    // 获取任务所需的智能体
    const requiredCapability = this.detectCapability(task)
    const agents = agentConfigManager.getConfigsByCapability(requiredCapability)

    // 选择最合适的智能体
    const selectedAgent = this.selectBestAgent(agents, task)

    // 应用智能体配置
    const agent = new Agent({
      id: selectedAgent.id,
      name: selectedAgent.name,
      systemPrompt: selectedAgent.systemPrompt,
      model: selectedAgent.model,
      temperature: selectedAgent.temperature,
      maxTokens: selectedAgent.maxTokens,
      tools: selectedAgent.tools,
      permissions: selectedAgent.permissions
    })

    return agent
  }
}
```

### 3. 在 ContextManager 中集成项目上下文

```typescript
import { projectContextAnalyzer } from './context/ProjectContextAnalyzer'

class ContextManager {
  async buildContext(task: Task): Promise<Context> {
    const context: Context = {
      task: task.description,
      history: task.history,
      tools: this.getAvailableTools(),
      skills: this.getRelevantSkills(task)
    }

    // 添加项目上下文
    if (task.projectPath) {
      const projectContext = await projectContextAnalyzer.analyzeProject(
        task.projectPath
      )
      context.project = projectContextAnalyzer.generateProjectGuide(projectContext)
    }

    return context
  }
}
```

### 4. 在智能体中集成记忆系统

```typescript
import { memorySystem, MemoryScope, MemoryType } from './memory/MemorySystem'

class Agent {
  async execute(task: Task): Promise<Result> {
    // 从记忆中获取相关信息
    const preferences = memorySystem.getPreferences()
    const commands = memorySystem.getCommands(task.projectId)
    const debugInfo = memorySystem.getDebug(task.projectId, task.description)

    // 执行任务
    const result = await this.processTask(task, {
      preferences,
      commands,
      debugInfo
    })

    // 记录新的经验
    if (result.success) {
      memorySystem.setPattern(
        task.projectId,
        task.description,
        result.description,
        result.code
      )
    } else {
      memorySystem.setDebug(
        task.projectId,
        task.description,
        result.error
      )
    }

    return result
  }
}
```

## 📊 架构优势

### 1. 安全性
- **细粒度权限控制**：可以精确控制每个智能体可以执行的操作
- **权限审计**：记录所有权限请求和决策，便于追踪和审查
- **危险操作保护**：自动阻止或询问用户确认危险操作

### 2. 可扩展性
- **模块化设计**：每个组件独立，可以单独升级或替换
- **配置驱动**：通过配置文件定义智能体，无需修改代码
- **插件式架构**：可以轻松添加新的智能体和工具

### 3. 智能化
- **项目理解**：自动分析项目结构，提供上下文感知
- **记忆学习**：从历史经验中学习，不断改进
- **智能调度**：根据任务需求自动选择最合适的智能体

### 4. 可维护性
- **清晰的架构**：组件职责明确，易于理解和维护
- **丰富的日志**：详细的日志记录，便于调试和监控
- **类型安全**：使用 TypeScript 提供类型检查

## 🚀 下一步计划

### 1. Build/Plan 双模式
- **Plan 模式**：只读权限，专注于分析和规划
- **Build 模式**：读写权限，专注于执行和实现
- **自动切换**：根据任务阶段自动切换模式

### 2. 增强的权限系统
- **用户自定义规则**：允许用户自定义权限规则
- **权限继承**：支持权限继承和覆盖
- **动态权限**：根据上下文动态调整权限

### 3. 智能记忆系统
- **记忆检索优化**：使用向量数据库提高检索效率
- **记忆压缩**：自动压缩和合并相似记忆
- **记忆遗忘**：根据访问频率自动清理过期记忆

### 4. 项目上下文增强
- **代码分析**：分析代码结构和依赖关系
- **文档生成**：自动生成项目文档
- **最佳实践推荐**：根据项目类型推荐最佳实践

### 5. 监控和调试
- **性能监控**：监控智能体执行性能
- **错误追踪**：追踪和分析错误模式
- **可视化界面**：提供可视化的监控界面

## 📝 总结

通过集成 OpenCode 的架构设计，我们的项目获得了：

1. **更强的安全性**：细粒度的权限控制保护系统安全
2. **更好的可扩展性**：模块化设计便于扩展和维护
3. **更高的智能化**：项目理解和记忆学习提升智能体能力
4. **更优的用户体验**：配置驱动和自动化减少用户负担

这个架构为我们的项目奠定了坚实的基础，可以支持更复杂的应用场景和更高级的智能体能力。
