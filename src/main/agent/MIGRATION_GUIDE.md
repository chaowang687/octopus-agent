# 代码迁移指南

## 概述

本文档记录了新架构与旧代码的映射关系，以及迁移步骤。

## 目录结构

```
src/main/agent/
├── _deprecated/           # 旧代码（待迁移）
│   ├── ReActEngine.ts
│   ├── EnhancedReActEngine.ts
│   ├── UnifiedReasoningEngine.ts
│   ├── CognitiveEngine.ts
│   ├── ThoughtTreeEngine.ts
│   ├── TaskEngine.ts     # 旧的任务引擎
│   ├── MemoryManager.ts
│   ├── MemoryService.ts
│   ├── ShortTermMemoryService.ts
│   ├── MemorySystem.ts
│   ├── WorkflowEngine.ts
│   ├── EnhancedWorkflowEngine.ts
│   ├── tools.ts          # 旧的工具文件
│   └── ...
│
├── reasoning/            # 新架构：推理模块
│   ├── ReasoningFramework.ts
│   ├── strategies/
│   │   ├── ReasoningStrategy.ts
│   │   ├── ReActStrategy.ts
│   │   ├── ThoughtTreeStrategy.ts
│   │   └── CognitiveStrategy.ts
│   └── index.ts
│
├── tasks/               # 新架构：任务模块
│   ├── TaskEngine.ts
│   ├── TaskDecomposer.ts
│   ├── TaskExecutor.ts
│   ├── TaskScheduler.ts
│   └── index.ts
│
├── memory/              # 新架构：记忆模块
│   ├── MemoryService.ts
│   ├── ShortTermMemory.ts
│   ├── MediumTermMemory.ts
│   ├── LongTermMemory.ts
│   └── index.ts
│
├── workflow/            # 新架构：工作流模块
│   ├── UnifiedWorkflowEngine.ts
│   ├── WorkflowExecutor.ts
│   ├── WorkflowScheduler.ts
│   ├── WorkflowStateMachine.ts
│   └── index.ts
│
├── tools/              # 新架构：工具模块
│   ├── index.ts
│   ├── file-tools.ts
│   ├── command-tools.ts
│   ├── browser-tools.ts
│   └── ...
│
├── errors/             # 新架构：错误处理模块
│   ├── ErrorRegistry.ts
│   ├── ErrorHandler.ts
│   └── index.ts
│
└── ...                 # 其他核心文件
```

## 迁移映射表

### 1. 推理引擎

| 旧文件 | 新文件 | 状态 |
|--------|--------|------|
| `ReActEngine.ts` | `reasoning/strategies/ReActStrategy.ts` | ✅ 已迁移 |
| `EnhancedReActEngine.ts` | `reasoning/` | ✅ 已合并 |
| `UnifiedReasoningEngine.ts` | `reasoning/ReasoningFramework.ts` | ✅ 已合并 |
| `CognitiveEngine.ts` | `reasoning/strategies/CognitiveStrategy.ts` | ✅ 已迁移 |
| `ThoughtTreeEngine.ts` | `reasoning/strategies/ThoughtTreeStrategy.ts` | ✅ 已迁移 |

**迁移方式**：
```typescript
// 旧代码
import { ReActEngine } from './ReActEngine'
const engine = new ReActEngine()

// 新代码
import { unifiedReasoningEngine } from './reasoning'
const result = await unifiedReasoningEngine.reason(context, 'react')
```

### 2. 任务引擎

| 旧文件 | 新文件 | 状态 |
|--------|--------|------|
| `TaskEngine.ts` | `tasks/TaskEngine.ts` | ✅ 已迁移 |
| `Planner.ts` | `tasks/TaskDecomposer.ts` | ✅ 已合并 |
| `Executor.ts` | `tasks/TaskExecutor.ts` | ✅ 已迁移 |
| `SelfCorrectionEngine.ts` | `tasks/` | ✅ 整合中 |

**迁移方式**：
```typescript
// 旧代码
import { TaskEngine } from './TaskEngine'
const engine = new TaskEngine()

// 新代码
import { taskEngine } from './tasks'
const result = await taskEngine.executeTask(description)
```

### 3. 记忆系统

| 旧文件 | 新文件 | 状态 |
|--------|--------|------|
| `MemoryManager.ts` | `memory/MemoryService.ts` | ✅ 已迁移 |
| `MemoryService.ts` | `memory/MemoryService.ts` | ✅ 已合并 |
| `ShortTermMemoryService.ts` | `memory/ShortTermMemory.ts` | ✅ 已迁移 |
| `MemorySystem.ts` | `memory/` | ✅ 已合并 |
| `MemoryOptimizer.ts` | - | 🔄 待处理 |

**迁移方式**：
```typescript
// 旧代码
import { MemoryManager } from './MemoryManager'
const memory = new MemoryManager()

// 新代码
import { memoryService } from './memory'
await memoryService.store(content, 'short')
```

### 4. 工作流引擎

| 旧文件 | 新文件 | 状态 |
|--------|--------|------|
| `WorkflowEngine.ts` | `workflow/UnifiedWorkflowEngine.ts` | ✅ 已迁移 |
| `EnhancedWorkflowEngine.ts` | `workflow/` | ✅ 已合并 |
| `WorkflowTools.ts` | `workflow/` | 🔄 待迁移 |
| `WorkflowModule.ts` | - | 🔄 待处理 |

**迁移方式**：
```typescript
// 旧代码
import { WorkflowEngine } from './WorkflowEngine'

// 新代码
import { unifiedWorkflowEngine } from './workflow'
await unifiedWorkflowEngine.execute(workflowId, input)
```

### 5. 工具系统

| 旧文件 | 新文件 | 状态 |
|--------|--------|------|
| `tools.ts` | `tools/file-tools.ts` | ✅ 已拆分 |
| `tools.ts` | `tools/command-tools.ts` | ✅ 已拆分 |
| `tools.ts` | `tools/browser-tools.ts` | ✅ 已拆分 |
| `AutomationTools.ts` | - | 🔄 待迁移 |
| `imageTools.ts` | - | 🔄 待迁移 |

**迁移方式**：
```typescript
// 旧代码
import './tools'

// 新代码
import { initializeTools } from './tools'
initializeTools()
```

### 6. 错误处理

| 旧文件 | 新文件 | 状态 |
|--------|--------|------|
| - | `errors/ErrorRegistry.ts` | ✅ 新增 |
| - | `errors/ErrorHandler.ts` | ✅ 新增 |

**使用方式**：
```typescript
// 新代码
import { ErrorFactory, ErrorCode, errorHandler } from './errors'

// 创建错误
const error = ErrorFactory.taskNotFound('task-123')

// 处理错误
errorHandler.handle(error, 'context')
```

## 迁移步骤

1. **逐步替换**：先在新功能中使用新架构
2. **兼容模式**：旧代码通过 re-export 支持
3. **完全迁移**：确认稳定后移除旧代码
4. **清理_deprecated**：定期清理已迁移的旧代码

## 注意事项

- 新架构使用依赖注入，告别直接 `new` 实例
- 新架构支持按需加载，提升性能
- 建议保持新旧代码并行一段时间确保稳定性
