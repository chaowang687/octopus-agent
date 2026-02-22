# Octopus Agent

这是一个本地化的 AI Agent 桌面应用，集成了 AI 对话、开发工具管理、本地图库管理等功能。

## 功能特性

- **AI 对话**: 支持多模型（OpenAI, Claude, DeepSeek, MiniMax）切换，支持文件/图片附件。
- **智能体协作**: 支持创建自定义 AI 角色和聊天小组，进行多智能体协作。
- **本地工具**: 自动检测本地开发环境（VS Code, SourceTree, Unity 等）。
- **图库管理**: 瀑布流布局，支持标签管理、重命名（保留扩展名）。
- **隐私优先**: 所有数据存储在本地。

## 开发环境

- **框架**: Electron + Vite + React + TypeScript
- **包管理**: npm / yarn

## 快速开始

1. 安装依赖:
   ```bash
   npm install
   ```

2. 启动开发模式:
   ```bash
   npm run dev
   ```

3. 构建应用:
   ```bash
   npm run build
   ```

4. 打包应用:
   ```bash
   npm run dist
   ```

## 目录结构

- `src/main`: Electron 主进程代码
- `src/preload`: 预加载脚本
- `src/renderer`: React 前端代码
- `demo-assets`: 演示用的图片资源

## 注意事项

- 本项目需要配置相应的 API Key 才能使用 AI 功能。

## 发布

详细的发布指南请参考 [GITHUB_SETUP.md](GITHUB_SETUP.md) 和 [RELEASE.md](RELEASE.md)。
