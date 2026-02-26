# Octopus Agent - 智能体开发平台

一个基于 Electron 的本地化 AI Agent 桌面应用，采用插件化架构，支持多模型对话、智能体协作、工具扩展等功能。

## 项目简介

Octopus Agent 是一个高度可扩展的 AI Agent 开发平台，采用插件化架构设计，将 OmniAgent 作为核心平台，其他功能模块通过插件系统动态加载。项目专注于提供高效、灵活的智能体开发和使用体验。

### 核心理念

- **插件化架构**: 核心平台 + 插件扩展，灵活可扩展
- **本地优先**: 所有数据存储在本地，保护隐私
- **多模型支持**: 支持 OpenAI、Claude、DeepSeek、MiniMax 等多种大语言模型
- **智能体协作**: 支持多智能体协同工作，提高任务完成效率
- **工具生态**: 丰富的工具插件，支持文件操作、命令执行、浏览器自动化等

## 核心特性

### 1. 插件系统

完整的插件架构，支持以下类型的插件：

- **工具插件**: 文件工具、命令工具、浏览器工具、工作流工具等
- **服务插件**: LLM服务、模型服务、图库服务、多模态服务等
- **记忆插件**: 短期记忆、中期记忆、长期记忆等
- **推理引擎插件**: ReAct、思维树、认知引擎等

### 2. 智能体系统

- **OmniAgent**: 统一智能体核心，提供标准化的智能体接口
- **MultiAgentCoordinator**: 多智能体协调器，支持智能体协作
- **SmartButlerAgent**: 智能管家，自动诊断和解决项目问题
- **特种兵Agent**: 轻量级、高效的任务执行智能体

### 3. 推理引擎

- **UnifiedReasoningEngine**: 统一推理引擎，支持多种推理策略
- **ReActEngine**: ReAct 推理策略
- **ThoughtTreeEngine**: 思维树推理策略
- **CognitiveEngine**: 认知引擎（System 1/2）
- **SelfCorrectionEngine**: 自我修正引擎

### 4. 工具系统

- **文件工具**: 文件读写、目录操作、文件搜索等
- **命令工具**: Shell命令执行、包管理器操作等
- **浏览器工具**: 网页访问、信息提取等
- **工作流工具**: 工作流创建、执行、调度等
- **文档工具**: 文档生成、编辑、格式转换等

### 5. 记忆系统

- **ShortTermMemory**: 短期记忆，存储当前会话信息
- **MediumTermMemory**: 中期记忆，存储项目相关信息
- **LongTermMemory**: 长期记忆，存储历史经验和知识

### 6. 用户界面

- **对话界面**: 支持多模型切换、文件/图片附件
- **图库管理**: 瀑布流布局，支持标签管理和重命名
- **插件管理**: 插件安装、卸载、启用、禁用
- **任务日志**: 任务执行历史和状态追踪

## 技术架构

### 技术栈

- **框架**: Electron 40+
- **构建工具**: Vite 4+
- **前端**: React 18 + TypeScript
- **状态管理**: React Hooks
- **UI组件**: 自定义组件 + React Markdown
- **代码编辑器**: Monaco Editor
- **图表**: Chart.js + React Chart.js 2

### 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                   渲染进程 (Renderer)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   React UI   │  │  Monaco      │  │  Chart.js  │ │
│  │   Components │  │  Editor      │  │            │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │ IPC
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   主进程 (Main)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ OmniAgent    │  │ Plugin       │  │  Services  │ │
│  │   Core       │  │   System     │  │            │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Reasoning    │  │  Tools       │  │  Memory    │ │
│  │   Engines    │  │   Registry   │  │  System    │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   插件层 (Plugins)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Tool Plugins │  │ Service      │  │  Memory    │ │
│  │              │  │  Plugins     │  │  Plugins   │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 目录结构

```
本地化TRAE/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── agent/              # 智能体核心
│   │   │   ├── OmniAgent.ts    # 统一智能体
│   │   │   ├── reasoning/      # 推理引擎
│   │   │   ├── tools/          # 工具系统
│   │   │   ├── memory/         # 记忆系统
│   │   │   └── workflow/       # 工作流系统
│   │   ├── plugin-system/       # 插件系统
│   │   │   ├── PluginInterface.ts
│   │   │   ├── PluginManager.ts
│   │   │   ├── ToolPluginManager.ts
│   │   │   ├── ServicePluginManager.ts
│   │   │   └── MemoryPluginManager.ts
│   │   ├── services/           # 核心服务
│   │   │   ├── LLMService.ts
│   │   │   ├── ModelService.ts
│   │   │   └── ...
│   │   └── ipc/                # IPC 通信
│   │       └── handlers/       # IPC 处理器
│   ├── preload/                # 预加载脚本
│   └── renderer/              # React 前端
│       └── src/
│           ├── components/     # UI 组件
│           ├── pages/          # 页面组件
│           └── main.tsx        # 入口文件
├── plugins/                    # 插件目录
│   ├── tools/                 # 工具插件
│   ├── services/              # 服务插件
│   └── memory/               # 记忆插件
├── docs/                      # 文档
│   ├── agents/                # 智能体文档
│   └── PLUGIN_SYSTEM_GUIDE.md # 插件系统指南
├── config/                    # 配置文件
│   └── agents/               # 智能体配置
├── scripts/                   # 脚本工具
│   ├── pack-plugins.js        # 插件打包
│   └── install.js            # 安装脚本
└── package.json              # 项目配置
```

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- macOS / Windows / Linux

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
npm run build
```

### 打包应用

```bash
# macOS
npm run dist:mac

# Windows
npm run dist:win

# Linux
npm run dist:linux
```

### 类型检查

```bash
npm run typecheck
```

### 运行测试

```bash
npm test
```

## 插件开发

### 创建工具插件

1. 在 `plugins/tools/` 目录下创建插件目录
2. 创建 `manifest.json` 文件定义插件信息
3. 创建 `index.js` 文件实现插件逻辑

示例：

```json
{
  "id": "my-tool-plugin",
  "name": "My Tool Plugin",
  "version": "1.0.0",
  "description": "A sample tool plugin",
  "author": "Your Name",
  "type": "tool",
  "main": "index.js"
}
```

```javascript
const { ToolPlugin } = require('../../src/main/plugin-system/PluginInterface');

class MyToolPlugin extends ToolPlugin {
  constructor() {
    super({
      id: 'my-tool-plugin',
      name: 'My Tool Plugin',
      version: '1.0.0',
      description: 'A sample tool plugin',
      author: 'Your Name'
    });
  }

  async initialize() {
    this.registerTool({
      name: 'my_tool',
      description: 'A sample tool',
      parameters: [
        {
          name: 'input',
          type: 'string',
          description: 'Input parameter',
          required: true
        }
      ],
      handler: async (params) => {
        return {
          success: true,
          message: `Tool executed with: ${params.input}`
        };
      }
    });
  }

  async destroy() {
    // 清理逻辑
  }
}

module.exports = MyToolPlugin;
```

### 安装插件

```bash
# 从本地路径安装
npm run plugin:install -- --source ./plugins/tools/my-tool-plugin

# 从 npm 安装
npm run plugin:install -- --source my-tool-plugin --type npm

# 从 URL 安装
npm run plugin:install -- --source https://example.com/plugin.zip --type url
```

### 插件管理

应用提供了完整的插件管理界面，支持：
- 查看已安装插件
- 启用/禁用插件
- 卸载插件
- 查看插件详情

## 智能体使用

### 创建智能体

1. 打开智能体管理页面
2. 点击"创建智能体"
3. 配置智能体参数（名称、角色、能力等）
4. 保存配置

### 智能体协作

1. 创建多个智能体
2. 创建聊天小组
3. 将智能体添加到小组
4. 开始协作对话

### 特种兵Agent

特种兵Agent是轻量级、高效的任务执行智能体，特点：
- 快速部署，资源占用低
- 精准执行，效率高
- 自主决策，独立性强
- 强大推理，工具熟练

## 配置说明

### API Key 配置

在应用设置中配置各模型的 API Key：
- OpenAI API Key
- Claude API Key
- DeepSeek API Key
- MiniMax API Key

### 智能体配置

智能体配置文件位于 `config/agents/` 目录：
- `docs-writer.json`: 文档编写智能体
- `fullstack-developer.json`: 全栈开发智能体
- `general-researcher.json`: 通用研究智能体
- `project-manager.json`: 项目管理智能体
- `security-auditor.json`: 安全审计智能体
- `ui-designer.json`: UI设计智能体

### 插件配置

插件配置文件位于 `plugins/` 目录下的各插件子目录中。

## 开发指南

### 代码规范

- 使用 TypeScript 进行类型检查
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码

### 提交规范

遵循 Conventional Commits 规范：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

### 分支策略

- `main`: 主分支，稳定版本
- `develop`: 开发分支
- `feature/*`: 功能分支
- `bugfix/*`: 修复分支

## 文档

- [插件系统指南](docs/PLUGIN_SYSTEM_GUIDE.md)
- [智能体开发指南](docs/agents/guides/agent-development-guide.md)
- [智能体文档](docs/agents/README.md)
- [项目瘦身计划](项目瘦身计划.md)
- [插件化分析与特种兵Agent设计](插件化分析与特种兵Agent设计.md)

## 常见问题

### Q: 如何添加新的 AI 模型？

A: 在 `src/main/services/LLMService.ts` 中添加新的模型配置，并在前端添加相应的选项。

### Q: 如何自定义智能体？

A: 在 `config/agents/` 目录下创建新的配置文件，或在应用界面中创建。

### Q: 插件安装失败怎么办？

A: 检查插件 manifest.json 格式是否正确，查看控制台错误信息。

### Q: 如何调试插件？

A: 在开发模式下，插件日志会输出到控制台。使用 `console.log` 进行调试。

## 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

MIT License

## 联系方式

- 项目主页: [GitHub](https://github.com/chaowang687/octopus-agent)
- 问题反馈: [Issues](https://github.com/chaowang687/octopus-agent/issues)

## 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解版本更新历史。

---

**注意**: 本项目需要配置相应的 API Key 才能使用 AI 功能。请确保在使用前正确配置 API Key。
