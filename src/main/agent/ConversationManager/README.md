# ConversationManager - 对话管理器

## 概述

ConversationManager 是一个功能完整的对话管理系统，将全能智能体（OmniAgent）作为对话核心，对标 MiniMax Agent，提供多轮对话、上下文管理、意图识别、记忆持久化等功能。

## 核心功能

### 1. 对话上下文管理
- ✅ 多轮对话历史管理
- ✅ 会话状态跟踪
- ✅ 上下文窗口管理
- ✅ 对话轮次管理
- ✅ 相关历史检索

### 2. 消息预处理
- ✅ 意图识别
- ✅ 实体提取
- ✅ 消息分类
- ✅ 优先级评估
- ✅ 消息规范化

### 3. OmniAgent 集成
- ✅ 传递对话历史
- ✅ 执行任务
- ✅ 获取推理结果
- ✅ 支持多种推理模式

### 4. 结果后处理
- ✅ 格式化输出（Markdown、HTML）
- ✅ 代码块提取和高亮
- ✅ 表格提取
- ✅ 附加动作执行
- ✅ 错误处理

### 5. 记忆持久化
- ✅ 短期记忆（当前会话）
- ✅ 中期记忆（任务级）
- ✅ 长期记忆（持久化知识）
- ✅ 记忆查询和检索

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                  ConversationManager                      │
│              对话管理器 - 核心协调层                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
         ┌────────────────┴────────────────┐
         ↓                                 ↓
┌─────────────────┐              ┌─────────────────┐
│ MessageProcessor│              │  ContextManager │
│  消息处理器     │              │  上下文管理器    │
└─────────────────┘              └─────────────────┘
         ↓                                 ↓
┌─────────────────┐              ┌─────────────────┐
│ IntentAnalyzer  │              │  StateTracker   │
│  意图分析器     │              │  状态跟踪器      │
└─────────────────┘              └─────────────────┘
         ↓                                 ↓
         └────────────────┬────────────────┘
                          ↓
              ┌─────────────────┐
              │   OmniAgent    │
              │  全能智能体     │
              └─────────────────┘
                          ↓
         ┌────────────────┴────────────────┐
         ↓                                 ↓
┌─────────────────┐              ┌─────────────────┐
│ ResultProcessor │              │  MemoryService  │
│  结果处理器     │              │  记忆服务       │
└─────────────────┘              └─────────────────┘
```

## 核心组件

### ConversationManager（对话管理器）
- 管理对话会话
- 协调各个组件
- 处理消息流程
- 提供统一接口

### ContextManager（上下文管理器）
- 管理对话历史
- 维护会话状态
- 管理上下文窗口
- 支持相关历史检索

### IntentAnalyzer（意图分析器）
- 识别用户意图
- 提取实体
- 分类消息类型
- 评估优先级

### StateTracker（状态跟踪器）
- 跟踪对话状态
- 管理任务状态
- 检测状态变化
- 记录状态历史

### ResultProcessor（结果处理器）
- 格式化输出
- 执行附加动作
- 处理错误
- 生成记忆条目

### MemoryService（记忆服务）
- 短期记忆管理
- 中期记忆管理
- 长期记忆管理
- 支持记忆查询

## 数据流

```
用户消息
  ↓
MessageProcessor（预处理）
  ↓
IntentAnalyzer（意图识别、实体提取）
  ↓
ContextManager（获取对话历史、上下文）
  ↓
StateTracker（更新状态）
  ↓
OmniAgent（执行任务，传入对话历史）
  ↓
ResultProcessor（后处理、格式化）
  ↓
MemoryService（存储记忆）
  ↓
返回结果
```

## 文件结构

```
ConversationManager/
├── ConversationManager.ts       # 对话管理器核心
├── ContextManager.ts           # 上下文管理器
├── IntentAnalyzer.ts           # 意图分析器
├── StateTracker.ts             # 状态跟踪器
├── ResultProcessor.ts          # 结果处理器
├── types.ts                   # 类型定义
├── index.ts                   # 导出
├── 对话管理器设计方案.md        # 设计方案文档
├── 使用示例.md                 # 使用示例
└── README.md                  # 本文件
```

## 快速开始

### 1. 初始化

```typescript
import { ConversationManager } from './ConversationManager'
import { OmniAgent } from '../OmniAgent'
import { MemoryService } from '../memory/MemoryService'

const memoryService = new MemoryService()
const omniAgent = new OmniAgent()

const conversationManager = new ConversationManager({
  memoryService,
  omniAgent,
  maxHistorySize: 100,
  contextWindowSize: 20
})
```

### 2. 创建会话

```typescript
const session = await conversationManager.createSession('user_123', {
  projectId: 'project_456',
  enableMemory: true
})
```

### 3. 处理消息

```typescript
const response = await conversationManager.processMessage(
  session.id,
  '帮我分析一下这个项目的代码结构'
)

console.log(response.content)
```

### 4. 获取历史

```typescript
const history = conversationManager.getHistory(session.id, 10)
```

## 对标 MiniMax Agent

### 相似功能
- ✅ 多轮对话管理
- ✅ 上下文理解
- ✅ 意图识别
- ✅ 记忆管理
- ✅ 状态跟踪

### 增强功能
- ✅ 更强的推理能力（集成5种推理引擎）
- ✅ 自我修正能力
- ✅ 权限管理
- ✅ 项目上下文管理
- ✅ 多模态支持
- ✅ 事件驱动架构
- ✅ 可扩展的插件系统

## 事件系统

ConversationManager 提供丰富的事件系统，支持以下事件：

- `session_created` - 会话创建
- `session_deleted` - 会话删除
- `message_received` - 消息接收
- `message_processed` - 消息处理完成
- `intent_analyzed` - 意图分析完成
- `context_updated` - 上下文更新
- `state_changed` - 状态变化
- `task_started` - 任务开始
- `task_completed` - 任务完成
- `task_failed` - 任务失败
- `error` - 错误发生
- `memory_stored` - 记忆存储
- `memory_retrieved` - 记忆检索
- `history_cleared` - 历史清除

### 事件监听示例

```typescript
conversationManager.on('message_received', (event) => {
  console.log('收到消息:', event.data.message)
})

conversationManager.on('intent_analyzed', (event) => {
  console.log('意图:', event.data.intent)
})

conversationManager.on('task_completed', (event) => {
  console.log('任务完成')
})
```

## 性能优化

### 1. 上下文窗口管理
- 合理设置 `contextWindowSize`（推荐 20-50）
- 使用滑动窗口机制
- 优先保留相关历史

### 2. 记忆管理
- 合理设置 TTL（短期1小时，中期24小时）
- 定期清理过期记忆
- 使用关键词优化检索

### 3. 缓存机制
- 缓存意图分析结果
- 缓存格式化输出
- 复用推理结果

## 安全考虑

### 1. 权限控制
- 实现细粒度权限管理
- 验证用户操作权限
- 记录权限使用日志

### 2. 输入验证
- 验证用户输入
- 防止注入攻击
- 限制消息长度

### 3. 数据保护
- 加密敏感数据
- 实现数据脱敏
- 遵循隐私法规

## 扩展性

### 1. 自定义意图分析器
```typescript
class CustomIntentAnalyzer extends IntentAnalyzer {
  async analyze(message: string): Promise<IntentAnalysis> {
    // 自定义分析逻辑
  }
}
```

### 2. 自定义结果处理器
```typescript
class CustomResultProcessor extends ResultProcessor {
  format(result: OmniAgentResult): FormattedOutput {
    // 自定义格式化逻辑
  }
}
```

### 3. 自定义记忆服务
```typescript
class CustomMemoryService extends MemoryService {
  async store(content: any, type: string): Promise<MemoryEntry> {
    // 自定义存储逻辑
  }
}
```

## 最佳实践

1. **会话生命周期管理**
   - 及时清理不活跃的会话
   - 合理设置上下文窗口大小
   - 定期归档历史对话

2. **记忆管理**
   - 合理设置记忆TTL
   - 定期清理过期记忆
   - 使用关键词优化检索

3. **错误处理**
   - 实现优雅的错误处理
   - 提供有意义的错误信息
   - 考虑重试机制

4. **性能优化**
   - 控制上下文窗口大小
   - 使用缓存机制
   - 异步处理耗时操作

## 文档

- [设计方案](./对话管理器设计方案.md) - 详细的设计方案
- [使用示例](./使用示例.md) - 完整的使用示例

## 贡献

欢迎贡献代码、报告问题或提出建议！

## 许可证

MIT License
