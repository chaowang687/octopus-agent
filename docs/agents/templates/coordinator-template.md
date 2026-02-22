# 协调器文档模板

使用此模板创建新的协调器文档。

---

## 1. 概述

| 属性 | 值 |
|------|-----|
| **ID** | `coordinator-id` |
| **名称** | 协调器名称 |
| **类型** | `coordinator` |
| **版本** | `1.0.0` |
| **作者** | 作者名称 |
| **最后更新** | YYYY-MM-DD |
| **状态** | `stable` / `beta` / `experimental` |

### 简要描述
用1-2句话描述协调器的主要功能和用途。

---

## 2. 职责描述

详细描述协调器的主要职责和功能范围。

### 主要职责
- 协调多个智能体的工作流程
- 管理任务分配和执行顺序
- 处理智能体之间的通信
- 监控执行进度和状态

### 协调策略
- 描述协调策略
- 描述决策逻辑
- 描述冲突解决机制

---

## 3. 智能体管理

### 管理的智能体列表

| 智能体ID | 名称 | 角色 | 优先级 |
|---------|------|------|--------|
| pm | 项目经理 | 需求分析 | 1 |
| ui | UI设计师 | 界面设计 | 2 |
| dev | 开发工程师 | 代码实现 | 3 |

### 执行顺序

```
智能体1 → 智能体2 → 智能体3 → 智能体4
   ↓         ↓         ↓         ↓
  条件1    条件2    条件3    条件4
```

### 智能体交互

描述智能体之间的交互方式：
- 消息传递机制
- 共享上下文
- 状态同步

---

## 4. 工作流程

### 整体流程

```
开始 → 初始化 → 分配任务 → 执行 → 监控 → 完成
                     ↓
                  错误处理
                     ↓
                  重试/降级
```

### 详细步骤

1. **初始化阶段**
   - 加载配置
   - 初始化智能体
   - 准备执行环境

2. **任务分配**
   - 分析任务需求
   - 选择合适的智能体
   - 分配子任务

3. **执行监控**
   - 监控智能体执行状态
   - 处理进度更新
   - 检测异常情况

4. **结果汇总**
   - 收集各智能体结果
   - 整合输出
   - 生成最终报告

---

## 5. 状态管理

### 状态定义

```typescript
interface CoordinatorState {
  phase: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  currentAgent: string;
  progress: number;
  errors: Error[];
  context: Record<string, any>;
}
```

### 状态转换

| 当前状态 | 触发条件 | 目标状态 |
|---------|---------|---------|
| idle | 收到任务 | running |
| running | 完成任务 | completed |
| running | 发生错误 | failed |
| running | 用户暂停 | paused |
| paused | 用户恢复 | running |

---

## 6. 错误处理

### 错误类型

| 错误类型 | 描述 | 处理策略 |
|---------|------|---------|
| AgentError | 智能体执行失败 | 重试/跳过 |
| TimeoutError | 执行超时 | 中断/降级 |
| ValidationError | 输入验证失败 | 拒绝/修正 |

### 错误恢复

1. **重试机制**
   - 自动重试次数
   - 重试间隔
   - 退避策略

2. **降级策略**
   - 降级条件
   - 降级方案
   - 恢复机制

3. **用户干预**
   - 何时请求干预
   - 如何呈现错误
   - 提供的选项

---

## 7. 事件系统

### 事件列表

| 事件名称 | 触发时机 | 参数 | 用途 |
|---------|---------|------|------|
| task_start | 任务开始 | taskId | 通知任务开始 |
| task_progress | 进度更新 | progress, agent | 更新进度 |
| task_complete | 任务完成 | result | 通知完成 |
| task_error | 任务错误 | error | 通知错误 |

### 事件监听

```typescript
coordinator.on('task_progress', (data) => {
  console.log(`Progress: ${data.progress}%, Agent: ${data.agent}`);
});
```

---

## 8. 配置参数

### 执行配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| maxRetries | 3 | 最大重试次数 |
| timeout | 60000 | 超时时间(ms) |
| parallel | false | 是否并行执行 |

### 智能体配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| agentTimeout | 30000 | 单个智能体超时 |
| heartbeatInterval | 10000 | 心跳间隔 |

---

## 9. 性能优化

### 优化策略

1. **并行执行**
   - 描述可并行的任务
   - 并行度控制
   - 资源限制

2. **缓存机制**
   - 缓存策略
   - 缓存失效
   - 缓存更新

3. **资源管理**
   - 内存管理
   - 连接池
   - 进程管理

### 性能指标

| 指标 | 目标值 | 当前值 |
|------|--------|--------|
| 平均响应时间 | < 5s | - |
| 吞吐量 | > 10 tasks/min | - |
| 资源占用 | < 500MB | - |

---

## 10. 测试

### 测试覆盖

- 单元测试：[测试文件](../../tests/coordinator/CoordinatorFile.test.ts)
- 集成测试：[测试文件](../../tests/integration/CoordinatorFile.test.ts)

### 测试用例

| 用例ID | 描述 | 预期结果 | 状态 |
|-------|------|---------|------|
| TC001 | 正常流程 | 成功完成 | pass/fail |
| TC002 | 错误恢复 | 成功恢复 | pass/fail |
| TC003 | 超时处理 | 正确处理 | pass/fail |

---

## 11. 开发历史

### 版本记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| 1.0.0 | YYYY-MM-DD | 初始版本 | 作者名 |
| 1.1.0 | YYYY-MM-DD | 新增功能X | 作者名 |

---

## 12. 参考资料

### 代码文件

- [主要实现文件](../../src/main/agent/CoordinatorFile.ts)
- [测试文件](../../tests/coordinator/CoordinatorFile.test.ts)

### 相关文档

- [相关文档1](../other-doc.md)

---

## 附录

### A. 配置示例

```json
{
  "id": "coordinator-id",
  "name": "协调器名称",
  "agents": ["pm", "ui", "dev", "test", "review"],
  "executionOrder": ["pm", "ui", "dev", "test", "review"],
  "maxRetries": 3,
  "timeout": 60000
}
```

### B. 使用示例

```typescript
const coordinator = new Coordinator(config);

coordinator.on('progress', (data) => {
  console.log(`Progress: ${data.progress}%`);
});

await coordinator.execute(task);
```
