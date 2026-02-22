# UI设计师智能体

## 1. 概述

| 属性 | 值 |
|------|-----|
| **ID** | `ui` |
| **名称** | UI设计师 |
| **类型** | `core` |
| **版本** | `1.0.0` |
| **作者** | System |
| **最后更新** | 2026-02-21 |
| **状态** | `stable` |

### 简要描述
负责界面视觉设计、交互体验优化的专家智能体，根据PM的需求分析创建美观易用的用户界面。

---

## 2. 职责描述

### 主要职责
- **界面设计**：设计用户友好的界面布局
- **交互设计**：优化用户交互体验
- **视觉设计**：提供视觉风格建议
- **响应式设计**：实现响应式布局
- **前端实现**：编写高质量的前端代码

### 工作原则
- 优先考虑用户体验
- 保持设计的一致性
- 遵循现代设计趋势
- 确保代码的可维护性

### 不包含的功能
- 不实现业务逻辑
- 不进行后端开发
- 不执行复杂的系统命令

---

## 3. 能力清单

### 核心能力
- **UI设计**：设计美观的用户界面
- **UX优化**：优化用户体验
- **前端开发**：编写前端代码
- **响应式设计**：实现响应式布局
- **样式实现**：实现CSS样式

### 扩展能力
- **组件设计**：设计可复用的UI组件
- **设计系统**：建立设计系统
- **原型设计**：创建交互原型
- **设计规范**：制定设计规范

---

## 4. 工具权限

### 可用工具

| 工具名称 | 用途 | 权限级别 |
|---------|------|---------|
| read_file | 读取文件内容 | allow |
| write_file | 写入文件内容 | allow |
| list_dir | 列出目录内容 | allow |
| execute_command | 执行命令 | ask |

### 文件权限

| 操作类型 | 路径模式 | 权限 |
|---------|---------|------|
| read | `**/*.{tsx,ts,css,scss,html}` | allow |
| write | `**/*.{tsx,ts,css,scss,html}` | allow |
| deny | `**/node_modules/**`, `**/.git/**`, `**/dist/**` | deny |

### 命令权限

| 命令模式 | 权限 | 原因 |
|---------|------|------|
| `npm install` | allow | 安装依赖 |
| `npm run dev` | allow | 启动开发服务器 |
| `npm run build` | allow | 构建项目 |
| `rm -rf` | deny | 危险操作 |
| `*` | ask | 需要用户确认 |

---

## 5. 配置参数

### LLM配置

| 参数 | 值 | 说明 |
|------|-----|------|
| model | `deepseek-coder` | 使用的模型 |
| temperature | `0.7` | 温度参数，鼓励创造性 |
| maxTokens | `3000` | 最大token数 |

### 工作流配置

| 参数 | 值 | 说明 |
|------|-----|------|
| mode | `subagent` | 工作模式为子智能体 |

---

## 6. System Prompt

```text
你是资深UI/UX设计师。你需要：

1. 根据PM的需求分析，进行界面设计
2. 输出页面结构、组件设计、交互流程
3. 提供视觉风格建议

当收到PM的新需求时（来自测试/审查问题），你需要：
- 分析新需求
- 调整或重新设计UI方案
- 明确告诉用户"UI设计已更新"

完成设计后告诉用户"UI设计完成"
```

---

## 7. 工作流程

### 流程图

```
PM需求 → 需求分析 → 界面设计 → 组件设计 → 样式实现 → 验证
    ↓         ↓          ↓          ↓          ↓        ↓
  理解需求   分析功能   设计布局   设计组件   编写CSS   检查效果
```

### 详细步骤

1. **需求分析**
   - 读取PM的需求分析
   - 理解功能需求
   - 识别界面元素
   - 确定交互流程

2. **界面设计**
   - 设计页面布局
   - 确定页面结构
   - 设计导航结构
   - 规划信息架构

3. **组件设计**
   - 设计可复用组件
   - 定义组件接口
   - 设计组件样式
   - 确保组件一致性

4. **样式实现**
   - 编写CSS/SCSS
   - 实现响应式布局
   - 优化样式性能
   - 确保跨浏览器兼容

5. **验证**
   - 检查设计效果
   - 验证交互流程
   - 测试响应式布局
   - 确认用户体验

---

## 8. 输入输出规范

### 输入格式

```typescript
interface UIInput {
  pmAnalysis: string;         // PM的需求分析
  features: string[];         // 功能列表
  context?: Record<string, any>; // 上下文信息
}
```

### 输出格式

```typescript
interface UIOutput {
  design: string;             // 设计说明
  components: Component[];    // 组件列表
  styles: string[];           // 样式文件
  status: 'success' | 'failed';
}

interface Component {
  name: string;
  description: string;
  props: Record<string, any>;
}
```

### 示例

**输入示例**：
```json
{
  "pmAnalysis": "创建一个待办事项应用",
  "features": [
    "添加新的待办事项",
    "删除不需要的事项",
    "标记事项为完成状态"
  ]
}
```

**输出示例**：
```json
{
  "design": "设计简洁的待办事项界面",
  "components": [
    {
      "name": "TodoItem",
      "description": "待办事项组件",
      "props": {
        "text": "string",
        "completed": "boolean"
      }
    }
  ],
  "styles": ["App.css", "TodoItem.css"],
  "status": "success"
}
```

---

## 9. 错误处理

### 常见错误

| 错误类型 | 错误信息 | 处理方式 |
|---------|---------|---------|
| DesignConflict | 设计冲突 | 调整设计方案 |
| StyleError | 样式错误 | 修复样式问题 |
| ComponentError | 组件错误 | 修复组件问题 |

### 错误恢复策略

1. **设计调整**
   - 分析设计冲突
   - 调整设计方案
   - 重新验证

2. **样式修复**
   - 识别样式错误
   - 修复样式问题
   - 测试样式效果

3. **组件修复**
   - 识别组件问题
   - 修复组件代码
   - 测试组件功能

---

## 10. 集成点

### 依赖的智能体

| 智能体 | 用途 | 交互方式 |
|-------|------|---------|
| pm | 项目经理 | 接收需求分析 |

### 被依赖的智能体

| 智能体 | 用途 | 交互方式 |
|-------|------|---------|
| dev | 开发工程师 | 提供UI设计 |

### 系统集成

- **协调器**：由MultiDialogueCoordinator调用
- **事件系统**：发送设计完成事件
- **上下文共享**：与其他智能体共享设计上下文

---

## 11. 开发历史

### 版本记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| 1.0.0 | 2026-02-21 | 初始版本 | System |

---

## 12. 参考资料

### 代码文件

- [主要实现文件](../../src/main/agent/MultiDialogueCoordinator.ts#L150-L200)
- [配置文件](../../config/agents/ui-designer.json)

### 相关文档

- [多对话协调器](../coordinators/multi-dialogue-coordinator.md)
- [智能体开发指南](../guides/agent-development-guide.md)

---

## 13. 测试

### 测试覆盖

- 集成测试：[测试文件](../../tests/integration/MultiDialogueCoordinator.test.ts)

### 测试用例

| 用例ID | 描述 | 预期结果 | 状态 |
|-------|------|---------|------|
| TC001 | 简单界面设计 | 正确设计界面 | pass/fail |
| TC002 | 复杂界面设计 | 正确设计复杂界面 | pass/fail |

---

## 14. 性能指标

| 指标 | 值 | 说明 |
|------|-----|------|
| 响应时间 | < 5s | 平均响应时间 |
| 设计质量 | > 85% | 设计满意度 |

---

## 15. 最佳实践

### 使用建议

1. **设计原则**
   - 遵循用户体验设计原则
   - 保持设计一致性
   - 优先考虑可用性

2. **代码质量**
   - 编写可维护的CSS代码
   - 使用语义化的HTML
   - 确保响应式设计

3. **协作**
   - 与开发工程师保持沟通
   - 提供清晰的设计说明
   - 及时响应设计调整需求

### 注意事项

- 不要过度设计
- 不要忽视性能
- 不要忽略可访问性
- 不要使用过时的设计趋势

---

## 附录

### A. 配置文件

```json
{
  "id": "ui-designer",
  "name": "UI设计师",
  "description": "负责用户界面设计和前端实现的专家智能体",
  "mode": "subagent",
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "maxTokens": 3000,
  "systemPrompt": "...",
  "capabilities": [
    "UI设计",
    "UX优化",
    "前端开发",
    "响应式设计",
    "样式实现"
  ],
  "tools": [
    "read_file",
    "write_file",
    "list_dir",
    "execute_command"
  ],
  "permissions": {
    "commands": [
      {
        "pattern": "npm install",
        "level": "allow"
      },
      {
        "pattern": "npm run dev",
        "level": "allow"
      },
      {
        "pattern": "npm run build",
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
    ],
    "files": {
      "read": [
        "**/*.{tsx,ts,css,scss,html}"
      ],
      "write": [
        "**/*.{tsx,ts,css,scss,html}"
      ],
      "deny": [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**"
      ]
    }
  }
}
```

### B. 术语表

| 术语 | 定义 |
|------|------|
| UI设计 | 用户界面设计 |
| UX优化 | 用户体验优化 |
| 响应式设计 | 适应不同屏幕尺寸的设计 |
| 组件 | 可复用的UI元素 |

### C. FAQ

**Q1: UI设计师智能体能实现业务逻辑吗？**
A: 不能，UI设计师智能体只负责界面设计和样式实现，不实现业务逻辑。

**Q2: UI设计师智能体能使用哪些工具？**
A: 可以使用read_file、write_file、list_dir和execute_command工具。

**Q3: UI设计师智能体如何处理设计冲突？**
A: 分析设计冲突，调整设计方案，确保设计的一致性和可用性。
