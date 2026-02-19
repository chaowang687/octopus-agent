# 文库系统与智能体协作设计方案

## 📋 方案概述

本文档详细说明如何实现一个让用户和智能体协作完成开发计划的文库系统，核心特点是：
- **先计划，后执行**：用户和智能体先共同完善计划，再开始执行
- **用户参与决策**：用户可在计划阶段随时修改、调整
- **智能体命令行能力**：赋予智能体类似 OpenCode 的开发能力
- **可视化协作**：通过文库系统直观展示计划和进度

## 🏗️ 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  文库编辑器   │  │   聊天面板    │  │  计划看板    │          │
│  │ (Notion风格) │  │  (智能体交互)  │  │  (进度追踪)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        文库系统层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  文档管理     │  │  版本控制     │  │  搜索引擎     │          │
│  │ (CRUD API)   │  │ (Git集成)    │  │ (语义搜索)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      智能体协作层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 计划协调器    │  │  决策引擎     │  │  执行引擎     │          │
│  │ (Plan模式)    │  │ (用户参与)    │  │ (Build模式)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      核心服务层                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  权限系统     │  │  记忆系统     │  │  项目上下文    │          │
│  │ (Permission) │  │  (Memory)    │  │ (Context)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 智能体配置    │  │  工具注册     │  │  LLM服务      │          │
│  │ (AgentConfig) │  │ (ToolRegistry)│  │ (LLMService) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 协作流程设计

### 阶段一：需求收集与初步规划

```
用户操作                          智能体操作
   │                                │
   ├─ 1. 创建需求文档                │
   │   - 标题：用户注册功能           │
   │   - 内容：功能描述、技术要求      │
   │                                │
   │                                ├─ 2. 分析需求
   │                                │   - 读取需求文档
   │                                │   - 识别技术栈
   │                                │   - 评估复杂度
   │                                │
   │                                ├─ 3. 生成初步计划
   │                                │   - 创建计划文档
   │                                │   - 列出主要步骤
   │                                │   - 标记待确认项
   │                                │
   ├─ 4. 查看并修改计划              │
   │   - 调整步骤顺序                │
   │   - 添加补充说明                │
   │   - 标记关键决策点              │
   │                                │
   │                                └─ 5. 监听计划修改
   │                                    - 重新分析
   │                                    - 更新依赖关系
```

### 阶段二：详细规划与决策

```
用户操作                          智能体操作
   │                                │
   ├─ 6. 标记需要决策的步骤          │
   │   - 步骤3：数据库设计            │
   │   - 步骤5：API认证方案           │
   │                                │
   │                                ├─ 7. 提供决策选项
   │                                │   - 选项A：使用PostgreSQL
   │                                │   - 选项B：使用MongoDB
   │                                │   - 分析优缺点
   │                                │
   ├─ 8. 选择方案并添加理由           │
   │   - 选择PostgreSQL              │
   │   - 理由：已有PostgreSQL实例      │
   │                                │
   │                                ├─ 9. 根据决策完善计划
   │                                │   - 更新技术栈
   │                                │   - 调整依赖步骤
   │                                │   - 添加实施细节
   │                                │
   ├─ 10. 审查完整计划               │
   │   - 检查逻辑完整性              │
   │   - 确认资源需求                │
   │   - 标记风险点                  │
   │                                │
   │                                └─ 11. 生成执行清单
   │                                    - 按优先级排序
   │                                    - 标记可并行任务
   │                                    - 估算时间
```

### 阶段三：执行与监控

```
用户操作                          智能体操作
   │                                │
   ├─ 12. 批准计划并开始执行          │
   │                                │
   │                                ├─ 13. 切换到Build模式
   │                                │   - 获取写权限
   │                                │   - 准备执行环境
   │                                │
   │                                ├─ 14. 执行步骤1
   │                                │   - 创建数据库表
   │                                │   - 更新计划状态
   │                                │
   ├─ 15. 查看进度                  │
   │   - 步骤1：✅ 已完成            │
   │   - 步骤2：🔄 执行中            │
   │   - 步骤3：⏳ 待执行            │
   │                                │
   │                                ├─ 16. 执行步骤2
   │                                │   - 编写API代码
   │                                │   - 遇到问题
   │                                │
   │                                ├─ 17. 请求用户决策
   │                                │   - 问题：认证方案选择
   │                                │   - 选项：JWT vs Session
   │                                │
   ├─ 18. 做出决策                  │
   │   - 选择JWT                     │
   │   - 添加实现要求                │
   │                                │
   │                                └─ 19. 继续执行
   │                                    - 实现JWT认证
   │                                    - 完成剩余步骤
```

## 📊 数据模型设计

### 文档类型

```typescript
enum DocumentType {
  REQUIREMENT = 'requirement',  // 需求文档
  PLAN = 'plan',              // 计划文档
  DECISION = 'decision',       // 决策记录
  SKILL = 'skill',            // 技能文档
  CONTEXT = 'context',        // 上下文文档
  LOG = 'log'                // 执行日志
}

interface Document {
  id: string
  type: DocumentType
  title: string
  content: string              // Markdown内容
  metadata: {
    status: 'draft' | 'active' | 'completed' | 'archived'
    projectId?: string
    parentId?: string
    tags: string[]
    createdBy: string          // 'user' 或 'agent:{agentId}'
    createdAt: number
    updatedAt: number
    version: number
  }
  relations: {
    dependencies: string[]     // 依赖的文档ID
    related: string[]         // 相关的文档ID
    decisions: string[]       // 关联的决策记录
  }
}
```

### 计划文档结构

```markdown
# 用户注册功能 - 开发计划

## 元数据
- 状态: 待执行
- 优先级: 高
- 预计时间: 4小时
- 创建者: project-manager

## 目标
实现用户注册功能，包括邮箱验证、密码加密、JWT认证

## 步骤

### 步骤1: 数据库设计 [🔄 执行中]
**状态**: 进行中
**执行者**: fullstack-developer
**开始时间**: 2025-02-19 14:00

**任务**:
- 创建User表
- 添加索引
- 编写迁移脚本

**依赖**: 无

**决策点**:
- [x] 数据库选择: PostgreSQL (用户决策)
- [ ] 密码加密: bcrypt (待确认)

### 步骤2: 注册API开发 [⏳ 待执行]
**状态**: 待执行
**执行者**: fullstack-developer

**任务**:
- 实现注册接口
- 输入验证
- 错误处理

**依赖**: 步骤1

**决策点**:
- [ ] 认证方案: JWT vs Session (待用户决策)

### 步骤3: 邮箱验证 [⏳ 待执行]
**状态**: 待执行
**执行者**: fullstack-developer

**任务**:
- 发送验证邮件
- 验证链接处理
- 过期机制

**依赖**: 步骤2

## 风险与缓解
1. **风险**: 邮件服务不稳定
   **缓解**: 使用多个邮件服务商，实现重试机制

2. **风险**: 密码泄露
   **缓解**: 使用bcrypt加密，强制密码复杂度

## 资源需求
- 数据库: PostgreSQL
- 邮件服务: SendGrid
- 依赖包: bcrypt, jsonwebtoken, nodemailer

## 版本历史
- v1.0 (2025-02-19 14:00): 初始计划
- v1.1 (2025-02-19 14:30): 添加邮箱验证步骤
```

### 决策记录文档

```markdown
# 决策记录: 数据库选择

## 决策信息
- 决策ID: dec_001
- 决策时间: 2025-02-19 14:15
- 决策者: user
- 关联计划: plan_001

## 问题描述
用户注册功能需要选择数据库，影响数据存储和查询性能。

## 选项分析

### 选项A: PostgreSQL
**优点**:
- 关系型数据库，适合结构化数据
- 事务支持完善
- 社区活跃，文档丰富

**缺点**:
- 扩展性相对有限
- 学习曲线较陡

### 选项B: MongoDB
**优点**:
- 文档型数据库，灵活
- 易于扩展
- 适合快速迭代

**缺点**:
- 事务支持较弱
- 查询性能不如SQL

## 最终决策
**选择**: PostgreSQL

**理由**:
1. 已有PostgreSQL实例，无需额外部署
2. 用户数据结构相对固定，适合关系型数据库
3. 团队熟悉PostgreSQL

## 影响范围
- 步骤1: 使用PostgreSQL创建表
- 步骤2: 使用SQL编写查询
- 需要添加PostgreSQL依赖

## 后续行动
- [ ] 安装PostgreSQL客户端库
- [ ] 编写数据库迁移脚本
- [ ] 创建User表
```

## 🎨 用户界面设计

### 主界面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  📚 本地化TRAE - 文库系统                      [用户头像] [设置] │
├─────────────┬───────────────────────────────────────────────────┤
│             │                                               │
│  📁 项目    │  📄 用户注册功能 - 开发计划                    │
│             │                                               │
│  ├─ 需求    │  ┌─────────────────────────────────────────┐  │
│  │  └─ 用户  │  │ [编辑] [历史] [分享] [开始执行]        │  │
│  │     注册  │  └─────────────────────────────────────────┘  │
│             │                                               │
│  ├─ 计划    │  ## 目标                                    │
│  │  └─ 用户  │  实现用户注册功能，包括邮箱验证...          │
│  │     注册  │                                             │
│             │  ## 进度                                    │
│  ├─ 决策    │  ████████████░░░░░░░░░░░░ 40%             │
│  │  └─ 数据  │                                             │
│  │     库    │  ## 步骤                                    │
│  │     选择  │  ┌─────────────────────────────────────┐  │
│             │  │ ✅ 步骤1: 数据库设计                  │  │
│  ├─ 技能    │  │    状态: 已完成                      │  │
│  │  └─ 数据  │  │    执行者: fullstack-developer       │  │
│  │     库    │  └─────────────────────────────────────┘  │
│             │                                             │
│  └─ 上下文  │  ┌─────────────────────────────────────┐  │
│             │  │ 🔄 步骤2: 注册API开发                │  │
│             │  │    状态: 执行中                      │  │
│             │  │    执行者: fullstack-developer       │  │
│             │  │    进度: 60%                         │  │
│             │  │    [查看日志] [暂停]                  │  │
│             │  └─────────────────────────────────────┘  │
│             │                                             │
│             │  ┌─────────────────────────────────────┐  │
│             │  │ ⏳ 步骤3: 邮箱验证                   │  │
│             │  │    状态: 待执行                      │  │
│             │  │    依赖: 步骤2                       │  │
│             │  └─────────────────────────────────────┘  │
│             │                                             │
│             │  ## 决策点                                  │
│             │  ⚠️ 步骤2需要决策: 认证方案选择             │
│             │     [查看选项] [做出决策]                    │
│             │                                             │
├─────────────┴───────────────────────────────────────────────┤
│  💬 聊天面板                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🤖 项目经理: 计划已生成，请查看[用户注册功能-开发计划] │  │
│  │                                                       │  │
│  │ 👤 用户: 看起来不错，但我有几个问题...                 │  │
│  │                                                       │  │
│  │ 🤖 全栈开发: 我正在执行步骤2...                        │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│  [输入消息...] [@智能体] [插入文档链接] [上传文件]          │
└─────────────────────────────────────────────────────────────┘
```

### 决策界面

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 需要您的决策                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                             │
│  步骤2: 注册API开发                                         │
│                                                             │
│  问题描述:                                                   │
│  用户注册功能需要选择认证方案，影响安全性和用户体验。            │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 选项A: JWT (JSON Web Token)                         │  │
│  │                                                      │  │
│  │  优点:                                                │  │
│  │  ✓ 无状态，易于扩展                                    │  │
│  │  ✓ 支持跨域                                           │  │
│  │  ✓ 标准化，库支持好                                   │  │
│  │                                                      │  │
│  │  缺点:                                                │  │
│  │  ✗ 无法主动失效                                       │  │
│  │  ✗ Token较大                                          │  │
│  │                                                      │  │
│  │  智能体推荐: ⭐⭐⭐⭐⭐                               │  │
│  │  理由: 适合现代Web应用，易于与移动端集成                │  │
│  │                                                      │  │
│  │  [选择此选项]                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  选项B: Session                                       │  │
│  │                                                      │  │
│  │  优点:                                                │  │
│  │  ✓ 可主动失效                                         │  │
│  │  ✓ Token较小                                          │  │
│  │  ✓ 服务器控制                                         │  │
│  │                                                      │  │
│  │  缺点:                                                │  │
│  │  ✗ 有状态，扩展性差                                   │  │
│  │  ✗ 跨域问题                                           │  │
│  │                                                      │  │
│  │  智能体推荐: ⭐⭐⭐                                   │  │
│  │  理由: 适合传统Web应用，安全性较高                      │  │
│  │                                                      │  │
│  │  [选择此选项]                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  选项C: 自定义方案                                     │  │
│  │                                                      │  │
│  │  [输入自定义方案...]                                    │  │
│  │                                                      │  │
│  │  [使用自定义方案]                                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                             │
│  [稍后决定] [跳过此步骤]                                     │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 技术实现方案

### 1. 文库系统核心组件

```typescript
// 文档管理服务
class DocumentService {
  async createDocument(doc: Partial<Document>): Promise<Document>
  async getDocument(id: string): Promise<Document>
  async updateDocument(id: string, updates: Partial<Document>): Promise<Document>
  async deleteDocument(id: string): Promise<void>
  async searchDocuments(query: string, filters?: any): Promise<Document[]>
  async getDocumentHistory(id: string): Promise<Document[]>
  async restoreVersion(id: string, version: number): Promise<Document>
}

// 计划管理服务
class PlanService {
  async createPlan(requirementId: string): Promise<Document>
  async updatePlanStatus(planId: string, stepId: string, status: string): Promise<void>
  async getPlanProgress(planId: string): Promise<Progress>
  async addDecisionPoint(planId: string, stepId: string, options: DecisionOption[]): Promise<void>
  async makeDecision(planId: string, stepId: string, decision: Decision): Promise<void>
}

// 决策管理服务
class DecisionService {
  async createDecision(decision: Partial<Decision>): Promise<Decision>
  async getDecision(id: string): Promise<Decision>
  async getDecisionsByPlan(planId: string): Promise<Decision[]>
}
```

### 2. 智能体集成层

```typescript
// 文库客户端（供智能体使用）
class LibraryClient {
  private documentService: DocumentService
  private planService: PlanService
  private decisionService: DecisionService

  // Plan模式API
  async createPlan(requirement: string): Promise<string>
  async readPlan(planId: string): Promise<Plan>
  async updatePlanStep(planId: string, stepId: string, updates: any): Promise<void>
  async requestDecision(planId: string, stepId: string, options: DecisionOption[]): Promise<Decision>

  // Build模式API
  async updateStepStatus(planId: string, stepId: string, status: string): Promise<void>
  async logExecution(planId: string, stepId: string, log: string): Promise<void>
  async reportError(planId: string, stepId: string, error: Error): Promise<void>

  // 通用API
  async searchDocuments(query: string): Promise<Document[]>
  async readDocument(id: string): Promise<Document>
  async createDocument(doc: Partial<Document>): Promise<string>
}

// 智能体包装器
class AgentWithLibrary {
  constructor(
    private agent: Agent,
    private libraryClient: LibraryClient
  ) {}

  async plan(task: Task): Promise<string> {
    const planId = await this.libraryClient.createPlan(task.description)
    await this.agent.executeInPlanMode(task, planId)
    return planId
  }

  async execute(planId: string): Promise<void> {
    await this.agent.executeInBuildMode(planId)
  }
}
```

### 3. 用户决策参与机制

```typescript
// 决策引擎
class DecisionEngine {
  private pendingDecisions: Map<string, Decision> = new Map()

  async requestDecision(request: DecisionRequest): Promise<string> {
    const decisionId = generateId()
    const decision: Decision = {
      id: decisionId,
      ...request,
      status: 'pending',
      createdAt: Date.now()
    }

    this.pendingDecisions.set(decisionId, decision)

    // 通知用户
    await this.notifyUser(decision)

    return decisionId
  }

  async makeDecision(decisionId: string, choice: string, reason?: string): Promise<void> {
    const decision = this.pendingDecisions.get(decisionId)
    if (!decision) throw new Error('Decision not found')

    decision.status = 'completed'
    decision.choice = choice
    decision.reason = reason
    decision.completedAt = Date.now()

    // 保存决策记录
    await this.decisionService.createDecision(decision)

    // 通知智能体
    await this.notifyAgent(decision)

    this.pendingDecisions.delete(decisionId)
  }

  private async notifyUser(decision: Decision): Promise<void> {
    // 通过WebSocket或事件总线通知前端
    eventBus.emit('decision:requested', decision)
  }

  private async notifyAgent(decision: Decision): Promise<void> {
    // 通知智能体继续执行
    eventBus.emit('decision:completed', decision)
  }
}
```

### 4. 协作流程控制器

```typescript
class CollaborationController {
  async startCollaboration(requirement: string): Promise<string> {
    // 1. 创建需求文档
    const requirementDoc = await this.documentService.createDocument({
      type: DocumentType.REQUIREMENT,
      title: '新需求',
      content: requirement
    })

    // 2. 智能体分析需求并生成初步计划
    const planId = await this.agent.plan({
      description: requirement,
      mode: 'plan'
    })

    // 3. 返回计划ID
    return planId
  }

  async executePlan(planId: string): Promise<void> {
    // 1. 检查是否有待决策项
    const pendingDecisions = await this.decisionService.getPendingDecisions(planId)
    if (pendingDecisions.length > 0) {
      throw new Error('有待决策项，请先完成决策')
    }

    // 2. 切换到Build模式
    await this.agent.execute(planId)
  }

  async onPlanModified(planId: string): Promise<void> {
    // 1. 智能体重新分析计划
    const plan = await this.libraryClient.readPlan(planId)

    // 2. 更新依赖关系
    await this.agent.reanalyzePlan(plan)

    // 3. 通知用户
    await this.notifyUser('计划已更新')
  }
}
```

## 📈 实施路线图

### Phase 1: 基础功能 (2周)
- [ ] 实现文档管理服务
- [ ] 实现计划管理服务
- [ ] 创建基础UI界面
- [ ] 集成现有智能体系统

### Phase 2: 决策机制 (1周)
- [ ] 实现决策引擎
- [ ] 创建决策UI界面
- [ ] 集成智能体决策请求

### Phase 3: 执行监控 (1周)
- [ ] 实现进度追踪
- [ ] 创建执行日志界面
- [ ] 集成Build模式执行

### Phase 4: 高级功能 (2周)
- [ ] 实现版本控制
- [ ] 实现语义搜索
- [ ] 实现协作功能

### Phase 5: 优化与完善 (1周)
- [ ] 性能优化
- [ ] 用户体验优化
- [ ] 文档完善

## 🎯 关键成功因素

1. **用户体验**: 直观的界面，流畅的交互
2. **智能体能力**: 准确的计划生成，可靠的执行
3. **决策机制**: 清晰的选项，智能的推荐
4. **权限控制**: 安全的命令执行，完善的审计
5. **可扩展性**: 模块化设计，易于扩展

## 📝 总结

这个方案通过文库系统将用户和智能体紧密协作，实现了：
- **先计划，后执行**的开发流程
- **用户参与决策**的协作模式
- **智能体命令行能力**的安全使用
- **可视化进度追踪**的执行监控

与现有OpenCode架构完美契合，可以快速实现并投入使用。
