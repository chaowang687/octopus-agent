# 项目文档管理系统使用指南

## 概述

项目文档管理系统是一个让智能体能够自动创建、阅读和维护项目文档的系统。文档存储在项目的`.docs`目录下，便于团队协作和知识管理。

---

## 系统架构

```
项目目录/
├── .docs/                    # 文档存储目录
│   ├── requirements.md         # 需求文档
│   ├── design.md             # 设计文档
│   ├── api.md                # API文档
│   └── ...                  # 其他文档
├── src/                     # 源代码
└── package.json             # 项目配置
```

---

## 核心组件

### 1. DocumentManager

文档管理器，提供文档的CRUD操作：

- `createDocument()` - 创建文档
- `readDocument()` - 读取文档
- `updateDocument()` - 更新文档
- `appendDocument()` - 追加内容
- `listDocuments()` - 列出所有文档
- `searchDocuments()` - 搜索文档
- `deleteDocument()` - 删除文档

### 2. DocumentTools

文档工具集，提供便捷的文档操作方法：

- `createDoc()` - 创建文档
- `readDoc()` - 读取文档
- `updateDoc()` - 更新文档
- `appendDoc()` - 追加内容
- `listDocs()` - 列出文档
- `searchDocs()` - 搜索文档
- `deleteDoc()` - 删除文档
- `createRequirementsDoc()` - 创建需求文档
- `createDesignDoc()` - 创建设计文档
- `createApiDoc()` - 创建API文档

### 3. 文档模板

提供标准化的文档模板：

- `project-requirements.md` - 需求文档模板
- `project-design.md` - 设计文档模板
- `api-documentation.md` - API文档模板

---

## 智能体集成

### PM智能体

项目经理智能体负责创建和维护项目文档：

```typescript
// PM智能体的system prompt中包含文档管理说明
**【重要】项目文档管理**

作为项目经理，你负责创建和维护项目文档。项目文档存储在项目的.docs目录下。

可用的文档管理功能：
- 创建需求文档：将需求分析结果整理成结构化的需求文档
- 创建设计文档：将UI设计方案整理成设计文档
- 创建API文档：将API接口整理成API文档
- 更新文档：在项目进展时更新相关文档
- 查看文档：阅读现有文档，了解项目状态

文档创建时机：
- 完成需求分析后 → 创建需求文档
- UI设计完成后 → 更新设计文档
- 开发完成后 → 更新API文档
- 每个阶段结束时 → 更新相关文档
```

### UI智能体

UI设计师智能体可以：

- 阅读需求文档，了解功能需求
- 更新设计文档，记录设计方案
- 查看设计文档，了解设计规范

### Dev智能体

开发工程师智能体可以：

- 阅读需求文档，了解功能需求
- 阅读设计文档，了解设计方案
- 更新API文档，记录接口信息
- 查看所有文档，了解项目全貌

### Test智能体

测试工程师智能体可以：

- 阅读需求文档，了解测试依据
- 阅读API文档，了解接口规范
- 更新测试文档，记录测试结果

### Review智能体

代码审查员智能体可以：

- 阅读所有文档，了解项目全貌
- 更新文档，记录审查结果

---

## 使用流程

### 1. 项目初始化

当用户创建新项目时：

```
用户请求 → PM分析需求 → PM创建需求文档 → UI设计 → UI更新设计文档 → Dev开发 → Dev更新API文档
```

### 2. 文档创建

PM智能体完成需求分析后：

```typescript
// PM智能体调用文档工具
const result = await documentTools.createRequirementsDoc(
  projectName,
  {
    background: '项目背景',
    goals: '项目目标',
    targetUsers: '目标用户',
    coreFeatures: ['功能1', '功能2'],
    extendedFeatures: ['扩展功能1'],
    frontendTech: ['React', 'TypeScript'],
    backendTech: ['Node.js', 'Express']
  },
  'PM'
)
```

### 3. 文档更新

项目进展时，智能体可以更新文档：

```typescript
// UI智能体更新设计文档
await documentTools.updateDoc(
  'design.md',
  '## 新增设计\n\n...',
  'UI'
)

// Dev智能体更新API文档
await documentTools.appendDoc(
  'api.md',
  '## 新增接口\n\n...',
  'Dev'
)
```

### 4. 文档查询

智能体可以查询现有文档：

```typescript
// 列出所有文档
const docs = await documentTools.listDocs()

// 搜索文档
const results = await documentTools.searchDocs('API')

// 读取特定文档
const content = await documentTools.readDoc('requirements.md')
```

---

## 文档格式

### 元数据格式

每个文档都包含元数据：

```html
<!-- DOCUMENT_METADATA -->
<!-- id: doc_1234567890_abc123 -->
<!-- name: 项目需求文档 -->
<!-- type: requirement -->
<!-- createdAt: 2026-02-21T10:00:00.000Z -->
<!-- updatedAt: 2026-02-21T12:00:00.000Z -->
<!-- author: PM -->
<!-- version: 1.0.0 -->
<!-- END_METADATA -->

# 文档内容...

## 章节1

内容...

## 章节2

内容...
```

### 文档类型

| 类型 | 说明 | 文件名 |
|------|------|--------|
| requirement | 需求文档 | requirements.md |
| design | 设计文档 | design.md |
| api | API文档 | api.md |
| test | 测试文档 | test.md |
| deployment | 部署文档 | deployment.md |
| changelog | 变更日志 | changelog.md |
| general | 通用文档 | 其他.md |

---

## 最佳实践

### 1. 文档创建时机

- **需求分析完成后** → 创建需求文档
- **UI设计完成后** → 更新设计文档
- **开发完成后** → 更新API文档
- **测试完成后** → 更新测试文档
- **每个阶段结束时** → 更新相关文档

### 2. 文档更新原则

- 及时更新：项目进展时立即更新文档
- 准确记录：确保文档内容与实际情况一致
- 版本控制：每次更新都记录版本和作者
- 变更说明：在文档中说明变更内容

### 3. 文档阅读建议

- 开始新任务前，先阅读相关文档
- 遇到问题时，查阅相关文档
- 完成任务后，更新相关文档

### 4. 文档命名规范

- 使用小写字母
- 使用连字符分隔单词
- 文件名要能反映文档内容
- 示例：`requirements.md`, `api-documentation.md`

---

## 示例场景

### 场景1：创建新项目

```
用户: 创建一个待办事项应用

PM: 
1. 分析需求
2. 创建需求文档
3. 输出: "需求文档已创建: requirements.md"

UI:
1. 阅读需求文档
2. 设计UI
3. 更新设计文档
4. 输出: "设计文档已更新: design.md"

Dev:
1. 阅读需求文档和设计文档
2. 开发功能
3. 更新API文档
4. 输出: "API文档已更新: api.md"
```

### 场景2：修复Bug

```
Test: 发现Bug
1. 阅读需求文档
2. 执行测试
3. 记录问题

PM:
1. 阅读测试结果
2. 更新需求文档（记录Bug）
3. 分配修复任务

Dev:
1. 阅读需求文档和API文档
2. 修复Bug
3. 更新API文档（记录修复）
```

---

## 扩展功能

### 1. 自定义文档模板

可以根据项目需求创建自定义文档模板：

```typescript
const customTemplate: DocumentTemplate = {
  name: '自定义文档',
  description: '自定义文档描述',
  content: '# 自定义文档\n\n内容...',
  filename: 'custom.md'
}

await documentTools.createDoc(customTemplate, { author: 'Custom' })
```

### 2. 文档版本控制

文档系统内置版本控制：

- 每次更新都记录版本号
- 记录更新时间和作者
- 可以查看文档历史

### 3. 文档搜索

支持关键词搜索：

```typescript
// 搜索包含"API"的文档
const results = await documentTools.searchDocs('API')
```

---

## 故障排查

### 问题1：文档创建失败

**原因**：项目目录不存在或没有权限

**解决方案**：
1. 检查项目目录是否存在
2. 检查是否有写入权限
3. 确保`.docs`目录可以创建

### 问题2：文档读取失败

**原因**：文档不存在或路径错误

**解决方案**：
1. 检查文档文件名是否正确
2. 使用`listDocs()`查看所有文档
3. 确认文档在`.docs`目录下

### 问题3：文档更新失败

**原因**：文档被锁定或没有权限

**解决方案**：
1. 确认文档没有被其他程序打开
2. 检查是否有写入权限
3. 尝试重新打开文档

---

## 总结

项目文档管理系统为智能体提供了强大的文档管理能力：

1. **自动化**：智能体可以自动创建和更新文档
2. **标准化**：使用统一的文档模板和格式
3. **协作性**：所有智能体都可以访问和更新文档
4. **可追溯**：记录文档的创建和更新历史
5. **易查询**：支持文档搜索和列表查看

通过这个系统，智能体可以更好地协作，项目文档也可以得到及时维护。
