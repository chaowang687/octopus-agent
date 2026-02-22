# 智能体开发指南

本指南提供完整的智能体开发流程，帮助开发者快速创建和集成新的智能体。

---

## 目录

1. [快速开始](#快速开始)
2. [智能体架构](#智能体架构)
3. [开发流程](#开发流程)
4. [配置管理](#配置管理)
5. [测试方法](#测试方法)
6. [部署流程](#部署流程)
7. [最佳实践](#最佳实践)
8. [常见问题](#常见问题)

---

## 快速开始

### 5分钟创建一个新智能体

1. **复制模板**
   ```bash
   cp docs/agents/templates/agent-template.md docs/agents/core/my-agent.md
   ```

2. **创建配置文件**
   ```bash
   cp config/agents/project-manager.json config/agents/my-agent.json
   ```

3. **修改配置**
   ```json
   {
     "id": "my-agent",
     "name": "我的智能体",
     "description": "智能体描述",
     "systemPrompt": "你是...",
     "capabilities": ["能力1", "能力2"],
     "tools": ["tool1", "tool2"]
   }
   ```

4. **实现智能体逻辑**
   在 `src/main/agent/` 目录下创建智能体实现文件

5. **注册智能体**
   在协调器中注册新智能体

---

## 智能体架构

### 整体架构

```
┌─────────────────────────────────────────┐
│           用户界面 (Renderer)            │
└─────────────────┬───────────────────────┘
                  │ IPC
┌─────────────────▼───────────────────────┐
│         协调器 (Coordinator)            │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼───┐   ┌───▼───┐   ┌───▼───┐
│Agent1 │   │Agent2 │   │Agent3 │
└───┬───┘   └───┬───┘   └───┬───┘
    │             │             │
    └─────────────┼─────────────┘
                  │
        ┌─────────▼─────────┐
        │   工具注册表       │
        └───────────────────┘
```

### 核心组件

1. **智能体 (Agent)**
   - 负责执行特定任务
   - 使用LLM进行推理
   - 调用工具完成操作

2. **协调器 (Coordinator)**
   - 管理多个智能体
   - 协调智能体之间的交互
   - 控制执行流程

3. **工具注册表 (Tool Registry)**
   - 管理可用工具
   - 提供工具调用接口
   - 处理工具权限

4. **推理引擎 (Reasoning Engine)**
   - 提供推理能力
   - 管理思维过程
   - 优化推理路径

### 智能体类型

| 类型 | 描述 | 示例 |
|------|------|------|
| `core` | 核心智能体，负责特定功能 | PM、UI、Dev、Test、Review |
| `special` | 特殊智能体，具有特殊能力 | OmniAgent |
| `coordinator` | 协调器，管理多个智能体 | MultiDialogueCoordinator |
| `engine` | 推理引擎，提供推理能力 | ReActEngine |

---

## 开发流程

### 1. 需求分析

在开始开发之前，明确智能体的：

- **职责范围**：智能体负责什么功能
- **能力需求**：智能体需要具备哪些能力
- **工具需求**：智能体需要使用哪些工具
- **交互方式**：智能体如何与其他组件交互

### 2. 设计智能体

#### 2.1 定义智能体接口

```typescript
interface Agent {
  id: string;              // 智能体ID
  name: string;           // 智能体名称
  role: string;           // 智能体角色
  model: string;          // 使用的模型
  systemPrompt: string;   // 系统提示词
  
  execute(input: AgentInput): Promise<AgentOutput>;
}
```

#### 2.2 设计System Prompt

System Prompt是智能体的核心，定义了智能体的行为和输出规范。

**设计原则**：
- 明确角色和职责
- 定义工作流程
- 规定输出格式
- 提供示例

**示例**：
```text
你是[角色]。你需要：

1. [职责1]
2. [职责2]
3. [职责3]

**输出要求**：
- [要求1]
- [要求2]

**输出格式**：
{
  "field1": "value1",
  "field2": "value2"
}
```

### 3. 实现智能体

#### 3.1 创建智能体类

```typescript
import { llmService } from '../services/LLMService'
import { ToolRegistry } from './ToolRegistry'

export class MyAgent {
  private id: string
  private name: string
  private model: string
  private systemPrompt: string
  private toolRegistry: ToolRegistry

  constructor(config: AgentConfig) {
    this.id = config.id
    this.name = config.name
    this.model = config.model
    this.systemPrompt = config.systemPrompt
    this.toolRegistry = new ToolRegistry(config.tools)
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    // 1. 处理输入
    const processedInput = this.processInput(input)
    
    // 2. 调用LLM
    const response = await llmService.chat({
      model: this.model,
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: processedInput }
      ]
    })
    
    // 3. 解析输出
    const output = this.parseOutput(response)
    
    // 4. 执行工具调用
    if (output.toolCalls) {
      const toolResults = await this.executeTools(output.toolCalls)
      output.toolResults = toolResults
    }
    
    return output
  }

  private processInput(input: AgentInput): string {
    // 处理输入逻辑
    return JSON.stringify(input)
  }

  private parseOutput(response: any): AgentOutput {
    // 解析输出逻辑
    return JSON.parse(response.content)
  }

  private async executeTools(toolCalls: ToolCall[]): Promise<any[]> {
    // 执行工具逻辑
    const results = []
    for (const call of toolCalls) {
      const result = await this.toolRegistry.execute(call)
      results.push(result)
    }
    return results
  }
}
```

#### 3.2 实现错误处理

```typescript
async execute(input: AgentInput): Promise<AgentOutput> {
  try {
    // 执行逻辑
    return output
  } catch (error) {
    // 错误处理
    if (error instanceof ValidationError) {
      return {
        status: 'failed',
        error: '输入验证失败',
        message: error.message
      }
    } else if (error instanceof ToolError) {
      return {
        status: 'failed',
        error: '工具调用失败',
        message: error.message
      }
    } else {
      return {
        status: 'failed',
        error: '未知错误',
        message: error.message
      }
    }
  }
}
```

### 4. 创建配置文件

在 `config/agents/` 目录下创建配置文件：

```json
{
  "id": "my-agent",
  "name": "我的智能体",
  "description": "智能体描述",
  "type": "core",
  "model": "gpt-4o-mini",
  "temperature": 0.3,
  "maxTokens": 4000,
  "systemPrompt": "你是...",
  "capabilities": [
    "能力1",
    "能力2"
  ],
  "tools": [
    "tool1",
    "tool2"
  ],
  "permissions": {
    "commands": [
      {
        "pattern": "*",
        "level": "ask"
      }
    ],
    "files": {
      "read": ["**/*"],
      "write": ["**/*.{ts,tsx,js,jsx}"],
      "deny": ["**/node_modules/**", "**/.git/**"]
    }
  },
  "metadata": {
    "version": "1.0.0",
    "author": "作者",
    "tags": ["tag1", "tag2"]
  }
}
```

### 5. 注册智能体

在协调器中注册新智能体：

```typescript
import { MyAgent } from './MyAgent'

class MultiDialogueCoordinator {
  private agents: Map<string, Agent> = new Map()

  constructor() {
    // 注册智能体
    const myAgentConfig = loadAgentConfig('my-agent')
    const myAgent = new MyAgent(myAgentConfig)
    this.agents.set('my-agent', myAgent)
  }

  async executeAgent(agentId: string, input: AgentInput): Promise<AgentOutput> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }
    return await agent.execute(input)
  }
}
```

### 6. 创建文档

使用模板创建智能体文档：

```bash
cp docs/agents/templates/agent-template.md docs/agents/core/my-agent.md
```

填写文档内容，确保包含所有必需的章节。

---

## 配置管理

### 配置文件结构

配置文件使用JSON格式，包含以下字段：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | 是 | 智能体唯一标识符 |
| name | string | 是 | 智能体显示名称 |
| description | string | 是 | 智能体描述 |
| type | string | 是 | 智能体类型 |
| model | string | 是 | 使用的LLM模型 |
| temperature | number | 否 | 温度参数 |
| maxTokens | number | 否 | 最大token数 |
| systemPrompt | string | 是 | 系统提示词 |
| capabilities | string[] | 是 | 能力列表 |
| tools | string[] | 是 | 可用工具列表 |
| permissions | object | 是 | 权限配置 |
| metadata | object | 否 | 元数据 |

### 权限配置

权限配置分为命令权限和文件权限：

#### 命令权限

```json
{
  "permissions": {
    "commands": [
      {
        "pattern": "npm install",
        "level": "allow"
      },
      {
        "pattern": "rm -rf",
        "level": "deny",
        "reason": "危险操作"
      },
      {
        "pattern": "*",
        "level": "ask"
      }
    ]
  }
}
```

权限级别：
- `allow`：允许执行
- `deny`：禁止执行
- `ask`：询问用户

#### 文件权限

```json
{
  "permissions": {
    "files": {
      "read": ["**/*.{ts,tsx,js,jsx}"],
      "write": ["**/*.{ts,tsx,js,jsx}"],
      "deny": ["**/node_modules/**", "**/.git/**"]
    }
  }
}
```

### 加载配置

```typescript
import * as fs from 'fs'
import * as path from 'path'

function loadAgentConfig(agentId: string): AgentConfig {
  const configPath = path.join(__dirname, '../../config/agents', `${agentId}.json`)
  const configContent = fs.readFileSync(configPath, 'utf-8')
  return JSON.parse(configContent)
}
```

---

## 测试方法

### 单元测试

创建单元测试文件：

```typescript
import { MyAgent } from '../src/main/agent/MyAgent'

describe('MyAgent', () => {
  let agent: MyAgent

  beforeEach(() => {
    const config = loadAgentConfig('my-agent')
    agent = new MyAgent(config)
  })

  test('should execute successfully', async () => {
    const input: AgentInput = {
      task: '测试任务'
    }
    const output = await agent.execute(input)
    expect(output.status).toBe('success')
  })

  test('should handle errors', async () => {
    const input: AgentInput = {
      task: '无效任务'
    }
    const output = await agent.execute(input)
    expect(output.status).toBe('failed')
  })
})
```

### 集成测试

创建集成测试文件：

```typescript
import { MultiDialogueCoordinator } from '../src/main/agent/MultiDialogueCoordinator'

describe('MyAgent Integration', () => {
  let coordinator: MultiDialogueCoordinator

  beforeEach(() => {
    coordinator = new MultiDialogueCoordinator()
  })

  test('should integrate with coordinator', async () => {
    const result = await coordinator.executeAgent('my-agent', {
      task: '测试任务'
    })
    expect(result.status).toBe('success')
  })
})
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- MyAgent

# 运行测试并生成覆盖率报告
npm test -- --coverage
```

---

## 部署流程

### 1. 代码审查

在提交代码之前，确保：

- 代码符合规范
- 测试全部通过
- 文档完整准确
- 没有敏感信息

### 2. 版本管理

使用语义化版本号：

- `MAJOR.MINOR.PATCH`
- MAJOR：不兼容的API变更
- MINOR：向后兼容的功能新增
- PATCH：向后兼容的问题修复

### 3. 构建和打包

```bash
# 构建项目
npm run build

# 打包应用
npm run package
```

### 4. 部署

```bash
# 部署到生产环境
npm run deploy
```

---

## 最佳实践

### 1. System Prompt设计

- **明确角色**：清晰定义智能体的角色和职责
- **简化输出**：使用用户友好的语言，避免技术术语
- **提供示例**：提供输入输出示例，帮助模型理解
- **限制范围**：明确智能体的能力边界

### 2. 错误处理

- **捕获所有错误**：确保所有可能的错误都被捕获
- **提供友好的错误信息**：使用用户友好的语言描述错误
- **实现重试机制**：对于可恢复的错误，实现重试机制
- **记录错误日志**：记录详细的错误信息，便于调试

### 3. 性能优化

- **缓存结果**：缓存LLM响应，减少重复调用
- **并行执行**：对于独立的任务，使用并行执行
- **限制token数**：合理设置maxTokens，避免浪费
- **优化提示词**：优化System Prompt，减少不必要的token

### 4. 安全性

- **权限控制**：严格控制智能体的权限
- **输入验证**：验证所有输入，防止注入攻击
- **敏感信息保护**：不要在输出中暴露敏感信息
- **日志脱敏**：日志中的敏感信息需要脱敏

### 5. 可维护性

- **代码规范**：遵循代码规范，保持代码一致性
- **注释文档**：添加必要的注释和文档
- **模块化设计**：使用模块化设计，提高代码复用性
- **版本控制**：使用版本控制，记录变更历史

---

## 常见问题

### Q1: 如何选择合适的LLM模型？

根据智能体的需求选择：
- **简单任务**：使用 `gpt-4o-mini` 或 `deepseek-coder`
- **复杂任务**：使用 `gpt-4o` 或 `claude-3-opus`
- **代码任务**：使用 `deepseek-coder` 或 `gpt-4`

### Q2: 如何优化System Prompt？

- 明确角色和职责
- 提供清晰的输出格式
- 使用示例说明
- 限制输出范围
- 迭代优化

### Q3: 如何处理智能体之间的依赖？

在协调器中管理依赖关系：
```typescript
const executionOrder = ['pm', 'ui', 'dev', 'test', 'review']
for (const agentId of executionOrder) {
  await executeAgent(agentId, context)
}
```

### Q4: 如何调试智能体？

- 查看日志输出
- 使用调试工具
- 添加console.log
- 检查LLM响应

### Q5: 如何提高智能体的准确性？

- 优化System Prompt
- 提供更多示例
- 调整temperature参数
- 使用更好的模型
- 增加上下文信息

---

## 附录

### A. 工具列表

| 工具名称 | 描述 | 参数 |
|---------|------|------|
| read_file | 读取文件 | path |
| write_file | 写入文件 | path, content |
| list_dir | 列出目录 | path |
| execute_command | 执行命令 | command |
| grep_search | 搜索内容 | pattern, path |

### B. 模型列表

| 模型名称 | 描述 | 适用场景 |
|---------|------|---------|
| gpt-4o | OpenAI最新模型 | 复杂任务 |
| gpt-4o-mini | OpenAI轻量模型 | 简单任务 |
| deepseek-coder | DeepSeek代码模型 | 代码任务 |
| claude-3-opus | Anthropic最强模型 | 复杂推理 |

### C. 参考资料

- [OpenAI API文档](https://platform.openai.com/docs)
- [Anthropic API文档](https://docs.anthropic.com)
- [DeepSeek API文档](https://platform.deepseek.com)
- [项目README](../../README.md)
- [技术架构规划](../../技术架构规划.md)
