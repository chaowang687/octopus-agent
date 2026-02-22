# 智能体文档中心

本目录包含所有智能体的详细文档，方便开发、维护和二次开发。

## 📚 文档结构

### 核心智能体 (`core/`)
项目核心智能体的详细文档：
- [项目经理 (PM)](core/pm.md) - 需求分析、项目规划、进度管理
- [UI设计师](core/ui.md) - 界面设计、交互体验
- [开发工程师](core/dev.md) - 代码实现、调试
- [测试工程师](core/test.md) - 测试执行、质量评估
- [代码审查员](core/review.md) - 代码审查、安全分析

### 协调器 (`coordinators/`)
智能体协调和工作流管理：
- [多对话协调器](coordinators/multi-dialogue-coordinator.md) - 管理多智能体对话流程
- [多智能体协调器](coordinators/multi-agent-coordinator.md) - 协调多个智能体协作

### 推理引擎 (`engines/`)
智能体推理和决策引擎：
- [ReAct引擎](engines/react-engine.md) - 基础推理引擎
- [增强ReAct引擎](engines/enhanced-react-engine.md) - 增强推理能力
- [思想树引擎](engines/thought-tree-engine.md) - 树形思维推理
- [统一推理引擎](engines/unified-reasoning-engine.md) - 统一推理接口

### 特殊智能体 (`special/`)
特殊用途的智能体：
- [全能智能体管家](special/omni-agent.md) - 多模态分析、跨项目调用
- [Solo构建服务](special/solo-builder.md) - 独立构建服务

### 工具 (`tools/`)
工具相关文档：
- [工具注册表](tools/tool-registry.md) - 可用工具列表和说明
- [工具使用指南](tools/tool-usage.md) - 工具调用方法

### 模板 (`templates/`)
文档模板：
- [智能体模板](templates/agent-template.md) - 创建新智能体的标准模板
- [协调器模板](templates/coordinator-template.md) - 创建新协调器的模板
- [引擎模板](templates/engine-template.md) - 创建新推理引擎的模板

### 指南 (`guides/`)
开发指南：
- [智能体开发指南](guides/agent-development-guide.md) - 如何开发新智能体
- [最佳实践](guides/best-practices.md) - 开发最佳实践
- [故障排查](guides/troubleshooting.md) - 常见问题和解决方案

## 🚀 快速开始

### 创建新智能体

1. 复制 [智能体模板](templates/agent-template.md)
2. 根据模板填写智能体信息
3. 在 `config/agents/` 目录创建对应的JSON配置文件
4. 在代码中实现智能体逻辑
5. 更新相关文档

### 了解现有智能体

选择感兴趣的智能体，查看对应的文档了解其：
- 职责和能力
- 配置参数
- 工作流程
- 输入输出规范

### 开发指南

阅读 [智能体开发指南](guides/agent-development-guide.md) 了解：
- 智能体架构设计
- 开发流程
- 测试方法
- 部署流程

## 📖 文档规范

所有智能体文档应遵循以下规范：

1. **完整性**：包含所有必需的章节
2. **准确性**：信息与代码实现保持一致
3. **清晰性**：使用简洁明了的语言
4. **时效性**：及时更新变更内容

## 🔗 相关资源

- [项目README](../../README.md) - 项目总览
- [技术架构规划](../../技术架构规划.md) - 系统架构
- [API文档](../../API文档/) - API接口文档

## 🤝 贡献指南

如果你要添加或修改智能体文档：

1. 遵循现有文档结构
2. 使用模板创建新文档
3. 确保信息准确完整
4. 更新相关索引

## 📞 联系方式

如有问题或建议，请联系开发团队。
