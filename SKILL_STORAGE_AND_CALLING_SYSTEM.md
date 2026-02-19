# 技能存储与调用系统设计

## 概述

设计了一个完整的技能管理和调用系统，实现了技能的存储、检索、评估和注入功能，支持不同类型智能体（项目经理、UI设计师、开发、测试等）的技能调用。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    技能存储与调用系统                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────┐                    ┌────────▼────────┐
│  技能存储层      │                    │  技能管理层      │
├────────────────┤                    ├────────────────┤
│ CognitiveEngine│                    │ SkillManager    │
│ - 技能库       │                    │ - 技能检索       │
│ - 持久化存储    │                    │ - 匹配评估       │
│ - 技能更新       │                    │ - 使用统计       │
└───────┬────────┘                    └────────┬────────┘
        │                                       │
        └───────────────────┬───────────────────┘
                            ↓
                    ┌───────▼────────┐
                    │  技能调用层      │
                    ├────────────────┤
                    │ TaskEngine     │
                    │ - 智能体识别     │
                    │ - 技能检索       │
                    │ - 技能注入       │
                    └───────┬────────┘
                            ↓
                    ┌───────▼────────┐
                    │  智能体执行层    │
                    ├────────────────┤
                    │ - 项目经理       │
                    │ - UI设计师       │
                    │ - 前端开发       │
                    │ - 后端开发       │
                    │ - 测试工程师     │
                    │ - 运维工程师     │
                    └────────────────┘
```

## 技能存储机制

### 1. CognitiveEngine - 认知引擎技能库

**文件位置**: `src/main/agent/CognitiveEngine.ts`

**存储位置**: 
```
~/Library/Application Support/<app-name>/cognitive/skills.json
```

**技能结构**:
```typescript
interface CognitiveSkill {
  id: string                    // 技能ID
  name: string                  // 技能名称
  description: string           // 技能描述
  triggerPatterns: string[]     // 触发模式（正则表达式）
  complexityThreshold: number    // 复杂度阈值
  confidenceThreshold: number    // 置信度阈值
  judgmentLogic?: string        // 判断逻辑（JSON字符串）
  expectedBehavior: {          // 预期行为
    recommendedSystem: 'system1' | 'system2'
    recommendedTools?: string[]
    requiresMultiStep: boolean
  }
  statistics: {                // 统计信息
    usageCount: number
    successCount: number
    avgDurationMs: number
    lastUsedAt?: number
    createdAt: number
    updateCount: number
  }
  trainingSamples: number        // 训练样本数
  version: number              // 版本号
}
```

**存储特点**:
- **持久化存储**: 技能保存到本地JSON文件
- **版本管理**: 每次更新增加版本号
- **统计追踪**: 记录使用次数、成功率、平均执行时间
- **自动加载**: 启动时自动加载技能库

### 2. OnlineDistiller - 在线蒸馏技能缓存

**文件位置**: `src/main/agent/OnlineDistiller.ts`

**存储位置**:
```
~/Library/Application Support/<app-name>/cognitive/online_distiller/
├── cache.json              # 蒸馏缓存
├── history.json            # 蒸馏历史
└── reports.json           # 评估报告
```

**缓存结构**:
```typescript
interface DistillationCache {
  key: string              // 缓存键
  skill: DistilledSkill    // 蒸馏的技能
  timestamp: number        // 创建时间
  hitCount: number        // 命中次数
  lastUsed: number        // 最后使用时间
}

interface DistilledSkill {
  id: string
  name: string
  description: string
  taskType: string
  triggerPatterns: string[]
  complexityThreshold: number
  confidenceThreshold: number
  expectedBehavior: { ... }
  distilledKnowledge: {     // 蒸馏的知识
    coreConcepts: string[]
    keySteps: string[]
    bestPractices: string[]
    codeTemplates?: string[]
    references: string[]
    warnings: string[]
  }
  sources: {               // 信息源
    url: string
    credibility: number
    relevance: number
  }[]
  createdAt: number
  version: number
}
```

**缓存策略**:
- **TTL**: 7天
- **最大缓存**: 100条
- **自动清理**: 超时自动清理
- **命中率追踪**: 记录每个缓存条目的命中次数

### 3. SkillManager - 技能管理统计

**文件位置**: `src/main/agent/SkillManager.ts`

**存储位置**:
```
~/Library/Application Support/<app-name>/cognitive/skill_manager/
├── retrieval_history.json  # 检索历史
└── skill_usage_stats.json  # 使用统计
```

**统计结构**:
```typescript
interface SkillRetrievalResult {
  agentType: AgentType
  task: string
  matchedSkills: SkillMatch[]
  totalSkills: number
  retrievalTime: number
  timestamp: number
}

interface SkillUsageStats {
  count: number
  lastUsed: number
  successRate: number
}
```

## 技能分类系统

### 智能体类型

```typescript
type AgentType = 
  | 'project_manager'    // 项目经理
  | 'ui_designer'       // UI设计师
  | 'frontend_developer' // 前端开发
  | 'backend_developer'  // 后端开发
  | 'fullstack_developer' // 全栈开发
  | 'tester'            // 测试工程师
  | 'devops'            // 运维工程师
  | 'architect'         // 架构师
  | 'analyst'           // 分析师
  | 'general'           // 通用智能体
```

### 技能分类

| 分类ID | 名称 | 相关智能体 | 关键词 |
|--------|------|-----------|---------|
| project_management | 项目管理 | project_manager, general | 项目、计划、进度、里程碑、风险、资源、团队 |
| ui_design | UI设计 | ui_designer, frontend_developer | 设计、界面、UI、UX、原型、线框、配色、布局 |
| frontend | 前端开发 | frontend_developer, fullstack_developer | React、Vue、JavaScript、TypeScript、CSS、HTML、组件 |
| backend | 后端开发 | backend_developer, fullstack_developer | Node.js、Python、Java、API、数据库、服务、微服务 |
| testing | 测试 | tester, general | 测试、单元测试、集成测试、端到端、质量、验证 |
| devops | 运维 | devops, general | 部署、CI/CD、Docker、Kubernetes、监控、日志、性能 |
| architecture | 架构 | architect, general | 架构、设计、系统、模式、可扩展性、高可用、分布式 |
| analysis | 分析 | analyst, project_manager | 分析、需求、调研、评估、可行性、用户研究 |

## 技能检索流程

### 1. 智能体识别

```typescript
private determineAgentType(instruction: string, targetSystem: 'system1' | 'system2'): AgentType {
  const lower = instruction.toLowerCase()
  
  // 项目经理相关
  if (/项目|计划|进度|里程碑|风险|资源|团队|管理|协调/.test(lower)) {
    return 'project_manager'
  }
  
  // UI设计相关
  if (/设计|界面|UI|UX|原型|线框|配色|布局/.test(lower)) {
    return 'ui_designer'
  }
  
  // 前端开发相关
  if (/前端|React|Vue|JavaScript|TypeScript|CSS|HTML|组件/.test(lower)) {
    return 'frontend_developer'
  }
  
  // ... 其他智能体类型
  
  return 'general'
}
```

### 2. 技能匹配

```typescript
async retrieveSkillsForAgent(
  agentType: AgentType,
  task: string,
  config?: Partial<SkillInjectionConfig>
): Promise<SkillRetrievalResult>
```

**匹配维度**:
1. **触发模式匹配** (40%): 正则表达式匹配
2. **关键词匹配** (30%): 技能名称和描述中的关键词
3. **分类匹配** (20%): 技能分类与任务分类匹配
4. **复杂度匹配** (10%): 任务复杂度与技能复杂度匹配
5. **历史成功率** (5%): 基于使用统计的成功率

**匹配结果**:
```typescript
interface SkillMatch {
  skill: CognitiveSkill | DistilledSkill
  matchScore: number              // 匹配分数 (0-1)
  relevance: 'high' | 'medium' | 'low'
  category?: SkillCategory
  reason: string                  // 匹配原因
}
```

### 3. 技能注入

```typescript
injectSkillsIntoTask(
  task: string,
  retrievalResult: SkillRetrievalResult,
  config?: Partial<SkillInjectionConfig>
): string
```

**注入格式**:
- **Markdown格式**: 默认，易于阅读
- **JSON格式**: 结构化，便于程序处理
- **Prompt格式**: 简洁，适合LLM提示词

**注入示例**:
```markdown
# 相关技能包

## React性能优化 (相关度: 85%)
**描述**: React应用性能优化最佳实践
**匹配原因**: 触发模式匹配: .*React.*; 关键词匹配: React, 性能, 优化
**分类**: 前端开发
**建议系统**: system2
**建议工具**: React DevTools, webpack

**核心概念**:
1. 虚拟DOM
2. 组件渲染
3. memoization

**关键步骤**:
1. 使用React.memo优化组件
2. 使用useMemo缓存计算结果
3. 使用useCallback缓存函数
4. 实现代码分割

**最佳实践**:
1. 避免不必要的渲染
2. 优化列表渲染
3. 使用懒加载

---

原始任务:
优化React应用的性能
```

## 智能体调用示例

### 示例1: 项目经理智能体

**用户任务**: "制定一个电商系统的项目计划"

**调用流程**:
1. **智能体识别**: `project_manager`
2. **技能检索**: 
   - 匹配技能: "项目管理", "需求分析", "进度规划"
   - 相关度: 高
3. **技能注入**: 注入项目管理最佳实践
4. **执行**: 基于技能知识制定项目计划

**注入的技能**:
```markdown
# 相关技能包

## 项目管理 (相关度: 90%)
**描述**: 项目管理核心技能
**核心概念**:
1. 项目生命周期
2. 里程碑管理
3. 风险评估

**关键步骤**:
1. 需求分析
2. 任务分解
3. 资源分配
4. 进度跟踪
5. 风险管理

**最佳实践**:
1. 使用敏捷开发方法
2. 定期进度评审
3. 及时沟通风险

---

原始任务:
制定一个电商系统的项目计划
```

### 示例2: UI设计师智能体

**用户任务**: "设计一个电商系统的首页UI"

**调用流程**:
1. **智能体识别**: `ui_designer`
2. **技能检索**:
   - 匹配技能: "UI设计", "响应式设计", "用户体验"
   - 相关度: 高
3. **技能注入**: 注入UI设计原则和最佳实践
4. **执行**: 基于技能知识设计UI

### 示例3: 前端开发智能体

**用户任务**: "使用React开发一个商品列表组件"

**调用流程**:
1. **智能体识别**: `frontend_developer`
2. **技能检索**:
   - 匹配技能: "React开发", "组件设计", "状态管理"
   - 相关度: 高
3. **技能注入**: 注入React开发最佳实践和代码模板
4. **执行**: 基于技能知识开发组件

### 示例4: 测试工程师智能体

**用户任务**: "为商品列表组件编写单元测试"

**调用流程**:
1. **智能体识别**: `tester`
2. **技能检索**:
   - 匹配技能: "单元测试", "React测试", "Jest"
   - 相关度: 高
3. **技能注入**: 注入测试策略和最佳实践
4. **执行**: 基于技能知识编写测试

## 技能使用统计

### 统计指标

1. **技能使用频率**: 记录每个技能的使用次数
2. **成功率**: 记录技能使用的成功率
3. **最后使用时间**: 记录技能最后使用时间
4. **检索历史**: 记录每次技能检索的详细信息

### 统计分析

```typescript
// 获取最常用的技能
skillManager.getTopUsedSkills(10)

// 获取智能体使用统计
skillManager.getAgentUsageStats()

// 分析技能覆盖度
skillManager.analyzeSkillCoverage()

// 生成优化建议
skillManager.generateOptimizationSuggestions()
```

### 优化建议类型

1. **创建建议**: 针对未覆盖领域创建新技能
2. **更新建议**: 优化低成功率的技能
3. **移除建议**: 移除长期未使用的技能
4. **改进建议**: 改进技能的触发模式和匹配逻辑

## 技能进化机制

### 1. 在线蒸馏增强

- **触发条件**: System 2 + 复杂任务
- **流程**: 
  1. 分析任务类型
  2. 爬取互联网信息
  3. LLM知识蒸馏
  4. 生成即时技能
  5. 应用到认知引擎

### 2. 离线蒸馏学习

- **触发条件**: 任务执行完成
- **流程**:
  1. 记录执行轨迹
  2. 分析成功/失败模式
  3. 提取可重用知识
  4. 创建/更新技能

### 3. 技能融合

- **触发条件**: 检索到相似技能
- **流程**:
  1. 识别相似技能
  2. 合并知识内容
  3. 更新触发模式
  4. 提升置信度

## 性能优化

### 1. 缓存机制

- **蒸馏缓存**: 7天TTL，避免重复蒸馏
- **技能缓存**: 内存缓存常用技能
- **检索缓存**: 缓存检索结果

### 2. 批量处理

- **批量技能检索**: 一次检索多个技能
- **批量技能应用**: 批量更新技能库
- **批量统计记录**: 批量记录使用统计

### 3. 增量更新

- **增量加载**: 只加载变更的技能
- **增量保存**: 只保存变更的技能
- **增量统计**: 只更新变更的统计

## 使用建议

### 1. 技能创建

- **明确触发模式**: 使用精确的正则表达式
- **详细描述**: 提供清晰的技能描述
- **完整知识**: 包含核心概念、关键步骤、最佳实践
- **合理阈值**: 设置合适的复杂度和置信度阈值

### 2. 技能维护

- **定期审查**: 检查技能使用统计
- **优化低效技能**: 更新低成功率的技能
- **移除无用技能**: 删除长期未使用的技能
- **补充新技能**: 为未覆盖领域创建新技能

### 3. 技能使用

- **合理配置**: 根据任务复杂度调整技能数量
- **选择合适格式**: 根据使用场景选择注入格式
- **记录反馈**: 记录技能使用效果，持续优化

## 总结

技能存储与调用系统提供了完整的技能管理功能：

1. **多层级存储**: CognitiveEngine、OnlineDistiller、SkillManager三层存储
2. **智能检索**: 基于多维度匹配的技能检索
3. **灵活注入**: 支持多种格式的技能注入
4. **统计分析**: 完整的技能使用统计和分析
5. **持续进化**: 在线蒸馏和离线学习相结合

这个系统让每个智能体（项目经理、UI设计师、开发、测试等）都能在执行任务前自动检索相关技能，并将技能知识注入到任务中，从而提升任务执行质量和效率。
