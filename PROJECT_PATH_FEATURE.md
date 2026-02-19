# 用户指定路径项目功能实现总结

## 功能概述

实现了用户指定路径项目功能，允许用户在执行任务前选择项目路径，项目经理智能体会在指定路径下创建项目文件夹，并生成详细的项目计划（Plan），包括目标、里程碑、步骤、细节等内容，所有文件以.md格式存储。

## 实现内容

### 1. Chat界面路径选择功能

#### 状态变量
```typescript
// 项目路径选择
const [projectPath, setProjectPath] = useState<string>('')
const [showPathSelector, setShowPathSelector] = useState(false)
```

#### 路径选择函数
```typescript
const handleSelectProjectPath = async () => {
  try {
    const result = await window.electron.dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '选择项目路径'
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return
    }
    
    const selectedPath = result.filePaths[0]
    setProjectPath(selectedPath)
    setShowPathSelector(false)
    
    console.log('[Chat] 用户选择的项目路径:', selectedPath)
  } catch (error) {
    console.error('[Chat] 选择路径失败:', error)
  }
}
```

#### UI集成
在聊天工具栏添加了路径选择按钮：
```jsx
<button 
  className="chat-tool-btn" 
  title="选择项目路径" 
  onClick={handleSelectProjectPath}
  style={{ color: projectPath ? '#007AFF' : 'currentColor' }}
>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
</button>
{projectPath && (
  <span style={{ fontSize: '11px', color: '#666', marginLeft: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {projectPath}
  </span>
)}
```

#### 发送任务时使用指定路径
```typescript
// 使用用户选择的项目路径，如果没有选择则使用默认路径
const taskDir = projectPath || `/Users/wangchao/Desktop/${input.slice(0, 15).replace(/[^\\w]/g, '_')}`

const result = await taskApi.execute(contentToSend, { 
  agentId, 
  sessionId,
  system: targetSystem,
  complexity,
  taskDir
})
```

### 2. TaskEngine支持用户指定路径

#### AgentOptions接口扩展
```typescript
export interface AgentOptions {
  agentId?: string
  sessionId?: string
  system?: string
  complexity?: string
  taskDir?: string  // 新增：支持用户指定路径
}
```

#### executeTask方法修改
```typescript
// 使用用户指定的taskDir，如果没有则使用默认路径
const taskDir = agentOptions?.taskDir || path.join(app.getPath('userData'), 'tasks', taskId)
fs.mkdirSync(taskDir, { recursive: true })
console.log(`[TaskEngine] 使用任务目录: ${taskDir}`)
```

#### executeMultiDialogueTask方法修改
```typescript
// 使用用户指定的taskDir，如果没有则使用默认路径
const taskDir = agentOptions?.taskDir || path.join(app.getPath('userData'), 'tasks', taskId)
fs.mkdirSync(taskDir, { recursive: true })
console.log(`[TaskEngine] 多智能体任务使用目录: ${taskDir}`)
```

### 3. 项目经理智能体创建项目文件夹

#### MultiAgentCoordinator接口扩展
```typescript
async executeCollaboration(
  instruction: string,
  onAgentMessage: (msg: AgentMessage) => void,
  taskDir?: string  // 新增：任务目录参数
): Promise<{ success: boolean; result: any; summary: string }>
```

#### PM创建项目文件夹逻辑
```typescript
// 如果指定了任务目录，PM需要创建项目文件夹和Plan
if (taskDir) {
  try {
    // 创建项目文件夹
    const projectFolder = path.join(taskDir, 'project')
    if (!fs.existsSync(projectFolder)) {
      fs.mkdirSync(projectFolder, { recursive: true })
      console.log(`[MultiAgentCoordinator] PM创建项目文件夹: ${projectFolder}`)
    }
    
    // 生成Plan
    const planPrompt = `作为项目经理，请为以下任务生成详细的项目计划：

任务：${instruction}

请按以下格式生成项目计划：

# 项目计划

## 项目目标
[描述项目的核心目标和预期成果]

## 里程碑
- [里程碑1]: [描述和预期完成时间]
- [里程碑2]: [描述和预期完成时间]
- [里程碑3]: [描述和预期完成时间]

## 实施步骤
### 步骤1: [步骤名称]
- [子步骤1.1]
- [子步骤1.2]
- [注意事项]

### 步骤2: [步骤名称]
- [子步骤2.1]
- [子步骤2.2]
- [注意事项]

## 技术细节
- [技术栈说明]
- [架构设计要点]
- [关键技术决策]

## 风险评估
- [潜在风险1]: [应对措施]
- [潜在风险2]: [应对措施]

## 交付物清单
- [交付物1]
- [交付物2]
- [交付物3]`

    const planResult = await this.executeAgentTask(
      pmAgent,
      planPrompt,
      {}
    )
    
    // 保存Plan为.md文件
    const planFilePath = path.join(projectFolder, 'PROJECT_PLAN.md')
    fs.writeFileSync(planFilePath, planResult, 'utf-8')
    console.log(`[MultiAgentCoordinator] PM保存项目计划: ${planFilePath}`)
    
    // 发送项目创建完成消息
    const planMsg: AgentMessage = {
      agentId: pmAgent.id,
      agentName: pmAgent.name,
      role: pmAgent.role,
      content: `📁 **项目初始化完成**

已创建项目文件夹: ${projectFolder}
已生成项目计划: PROJECT_PLAN.md

${planResult}`,
      timestamp: Date.now(),
      phase: '项目初始化',
      messageType: 'response',
      priority: 'high'
    }
    this.collaborationHistory.push(planMsg)
    onAgentMessage(planMsg)
  } catch (error) {
    console.error('[MultiAgentCoordinator] PM创建项目失败:', error)
  }
}
```

### 4. Plan生成功能

#### Plan模板结构
```markdown
# 项目计划

## 项目目标
[描述项目的核心目标和预期成果]

## 里程碑
- [里程碑1]: [描述和预期完成时间]
- [里程碑2]: [描述和预期完成时间]
- [里程碑3]: [描述和预期完成时间]

## 实施步骤
### 步骤1: [步骤名称]
- [子步骤1.1]
- [子步骤1.2]
- [注意事项]

### 步骤2: [步骤名称]
- [子步骤2.1]
- [子步骤2.2]
- [注意事项]

## 技术细节
- [技术栈说明]
- [架构设计要点]
- [关键技术决策]

## 风险评估
- [潜在风险1]: [应对措施]
- [潜在风险2]: [应对措施]

## 交付物清单
- [交付物1]
- [交付物2]
- [交付物3]
```

#### Plan内容示例
```markdown
# 项目计划

## 项目目标
开发一个基于React的电商系统商品列表组件，实现商品展示、筛选、排序和分页功能，提供良好的用户体验和性能优化。

## 里程碑
- 里程碑1: 完成需求分析和UI设计 (预计1天)
- 里程碑2: 完成组件基础功能开发 (预计2天)
- 里程碑3: 完成测试和优化 (预计1天)

## 实施步骤
### 步骤1: 需求分析与设计
- 分析商品列表的核心功能需求
- 设计组件结构和数据流
- 确定API接口规范
- 注意事项：确保组件的可复用性和可维护性

### 步骤2: UI设计与实现
- 设计商品卡片组件
- 实现筛选和排序功能
- 添加加载状态和错误处理
- 注意事项：确保响应式设计和良好的用户体验

### 步骤3: 数据获取与状态管理
- 集成API获取商品数据
- 实现本地状态管理
- 添加数据缓存机制
- 注意事项：优化数据加载性能，减少不必要的请求

### 步骤4: 测试与优化
- 编写单元测试
- 进行性能测试
- 优化渲染性能
- 注意事项：确保代码质量和用户体验

## 技术细节
- 技术栈: React 18, TypeScript, Tailwind CSS
- 架构设计: 组件化设计，单向数据流
- 关键技术决策: 使用React Query进行数据管理，使用虚拟滚动优化长列表性能

## 风险评估
- 潜在风险1: API响应慢导致用户体验差 - 应对措施：实现数据缓存和加载骨架屏
- 潜在风险2: 大量数据导致性能问题 - 应对措施：使用虚拟滚动和分页加载

## 交付物清单
- 商品列表组件源代码
- 组件文档和使用说明
- 单元测试代码
- 性能优化报告
```

### 5. 文件存储为.md格式

#### 文件存储逻辑
```typescript
// 保存Plan为.md文件
const planFilePath = path.join(projectFolder, 'PROJECT_PLAN.md')
fs.writeFileSync(planFilePath, planResult, 'utf-8')
console.log(`[MultiAgentCoordinator] PM保存项目计划: ${planFilePath}`)
```

#### 文件结构
```
用户指定路径/
└── project/
    └── PROJECT_PLAN.md
```

## 使用场景

### 场景1: 创建新项目
1. 用户点击路径选择按钮
2. 选择或创建项目文件夹（如：`/Users/wangchao/Desktop/my-ecommerce-project`）
3. 输入任务描述："开发一个电商系统的商品列表组件"
4. 点击发送
5. 项目经理智能体创建项目文件夹并生成Plan
6. 其他智能体开始协作开发

### 场景2: 在现有项目中添加功能
1. 用户选择现有项目路径（如：`/Users/wangchao/Desktop/my-ecommerce-project`）
2. 输入任务描述："添加购物车功能"
3. 点击发送
4. 项目经理智能体在现有项目文件夹中生成新的Plan
5. 其他智能体开始协作开发

## 技术细节

### 路径处理
- 使用`window.electron.dialog.showOpenDialog`让用户选择路径
- 支持`createDirectory`属性，允许用户创建新文件夹
- 路径信息存储在React状态中，并在发送任务时传递给后端

### 文件系统操作
- 使用Node.js的`fs`模块进行文件操作
- 使用`path.join`确保跨平台路径兼容性
- 使用`fs.mkdirSync`创建文件夹，支持递归创建
- 使用`fs.writeFileSync`保存.md文件

### 智能体协作
- 项目经理智能体（document_generator）负责创建项目文件夹和生成Plan
- 其他智能体（UI设计师、开发工程师等）在项目文件夹中工作
- 所有智能体通过AgentMessage进行通信

### 事件传递
- 前端通过`taskApi.execute`传递taskDir参数
- TaskEngine将taskDir传递给MultiAgentCoordinator
- MultiAgentCoordinator将taskDir传递给各个智能体
- 智能体通过`onAgentMessage`回调发送进度消息

## 修复的问题

1. ✅ 移除了未使用的`app`导入
2. ✅ 扩展了`AgentOptions`接口，添加`taskDir`参数
3. ✅ 修改了`executeCollaboration`方法签名，支持`taskDir`参数
4. ✅ 在Chat界面添加了路径选择功能
5. ✅ 修改了TaskEngine以支持用户指定路径
6. ✅ 实现了项目经理智能体创建项目文件夹功能
7. ✅ 实现了Plan生成功能（目标、里程碑、步骤、细节）
8. ✅ 实现了文件存储为.md格式

## 文件修改清单

### 前端文件
- `src/renderer/src/pages/Chat.tsx`
  - 添加了`projectPath`和`showPathSelector`状态变量
  - 添加了`handleSelectProjectPath`函数
  - 在工具栏添加了路径选择按钮
  - 修改了`handleSendMessage`函数，使用用户指定的路径

### 后端文件
- `src/main/agent/TaskEngine.ts`
  - 扩展了`AgentOptions`接口，添加`taskDir`参数
  - 修改了`executeTask`方法，支持用户指定路径
  - 修改了`executeMultiDialogueTask`方法，支持用户指定路径
  - 修改了`executeCollaboration`调用，传递`taskDir`参数

- `src/main/agent/MultiAgentCoordinator.ts`
  - 修改了`executeCollaboration`方法签名，添加`taskDir`参数
  - 实现了项目经理智能体创建项目文件夹功能
  - 实现了Plan生成功能
  - 实现了文件存储为.md格式
  - 移除了未使用的`app`导入

## 测试建议

### 功能测试
1. 测试路径选择功能，验证用户可以选择或创建文件夹
2. 测试项目经理智能体创建项目文件夹功能
3. 测试Plan生成功能，验证生成的Plan包含所有必要部分
4. 测试文件存储功能，验证.md文件正确保存
5. 测试多智能体协作，验证所有智能体都能正常工作

### 边界测试
1. 测试路径不存在的情况
2. 测试路径权限不足的情况
3. 测试路径名称包含特殊字符的情况
4. 测试Plan生成失败的情况
5. 测试文件写入失败的情况

### 性能测试
1. 测试大量文件的创建和写入性能
2. 测试Plan生成的响应时间
3. 测试多智能体协作的整体性能

## 未来优化方向

1. **项目管理界面**: 添加专门的项目管理界面，显示所有项目和其Plan
2. **Plan编辑功能**: 允许用户编辑和更新Plan
3. **版本控制**: 集成Git，实现Plan的版本控制
4. **模板系统**: 提供项目模板，快速创建常见类型的项目
5. **进度跟踪**: 实时显示项目进度和完成情况
6. **协作增强**: 支持多人协作编辑Plan
7. **导出功能**: 支持导出Plan为PDF或其他格式
8. **智能推荐**: 基于历史项目推荐最佳实践

## 总结

用户指定路径项目功能已成功实现，用户现在可以在执行任务前选择项目路径，项目经理智能体会在指定路径下创建项目文件夹，并生成详细的项目计划（Plan），包括目标、里程碑、步骤、细节等内容，所有文件以.md格式存储。这个功能提升了项目的组织性和可管理性，让用户能够更好地控制项目结构和文件存储位置。
