# 智能管家使用指南

## 概述

智能管家是一个自动化的项目追踪和问题管理系统，它能够：
- 自动检测智能体执行过程中的问题
- 尝试自动修复常见问题
- 追踪项目创建和开发过程
- 生成详细的项目报告
- 提供问题解决方案和修复建议

## 核心功能

### 1. 问题自动检测

智能管家会自动监控智能体的执行过程，当出现以下问题时会自动检测：

- **权限问题**：文件或目录访问权限不足
- **文件未找到**：目标文件或目录不存在
- **依赖问题**：npm包安装失败或依赖冲突
- **配置问题**：配置文件错误或缺失
- **网络问题**：网络连接失败
- **未知错误**：其他类型的错误

### 2. 问题自动修复

对于常见问题，智能管家会尝试自动修复：

#### 权限问题修复
```typescript
// 自动执行 chmod 755 命令修复目录权限
chmod 755 /path/to/directory
```

#### 路径问题修复
```typescript
// 自动创建缺失的目录
fs.mkdirSync(path, { recursive: true })
```

#### 依赖问题修复
```typescript
// 自动运行 npm install
npm install
```

### 3. 项目追踪

智能管家会自动追踪项目创建过程：

- 项目基本信息（名称、路径、类型）
- 项目状态（创建中、已完成、失败）
- 文件列表和大小统计
- 问题记录和解决方案

### 4. 项目报告

智能管家会生成详细的项目报告，包括：

- 项目基本信息
- 文件统计信息
- 问题记录
- 文件列表

## 使用方法

### 基本使用

智能管家会在多智能体协作时自动启动，无需手动配置。

```typescript
// 在 MultiAgentCoordinator 中自动初始化
const coordinator = new MultiAgentCoordinator()
await coordinator.executeCollaboration(instruction, onMessage, taskDir)
```

### 手动注册问题

如果需要在其他地方使用智能管家，可以手动注册问题：

```typescript
import { smartButlerAgent } from './SmartButlerAgent'

try {
  // 执行可能出错的操作
  fs.writeFileSync('/path/to/file', content)
} catch (error) {
  // 注册问题到智能管家
  await smartButlerAgent.registerProblem(
    error,
    'agent-id',
    'phase-name',
    { path: '/path/to/file' }
  )
}
```

### 获取项目信息

```typescript
// 获取所有项目
const projects = smartButlerAgent.getAllProjects()

// 获取活跃项目
const activeProject = smartButlerAgent.getActiveProject()

// 获取特定项目
const project = smartButlerAgent.getProjectInfo('project-id')

// 生成项目报告
const report = smartButlerAgent.generateProjectReport('project-id')
```

### 获取问题信息

```typescript
// 获取所有问题
const problems = smartButlerAgent.getAllProblems()

// 获取特定问题
const problem = smartButlerAgent.getProblem('problem-id')

// 获取解决方案
const solution = smartButlerAgent.getSolution('problem-id')
```

### 手动修复问题

```typescript
// 手动触发问题修复
const problem = smartButlerAgent.getProblem('problem-id')
if (problem) {
  const solution = await smartButlerAgent.generateSolution(problem)
  const success = await smartButlerAgent.executeSolution(solution)
  console.log('修复结果:', success)
}
```

## IPC 接口

智能管家提供了完整的 IPC 接口，可以在前端调用：

### 项目相关

```typescript
// 获取所有项目
const result = await window.electron.ipcRenderer.invoke('butler:getAllProjects')

// 获取活跃项目
const result = await window.electron.ipcRenderer.invoke('butler:getActiveProject')

// 获取项目详情
const result = await window.electron.ipcRenderer.invoke('butler:getProject', projectId)

// 获取项目报告
const result = await window.electron.ipcRenderer.invoke('butler:getProjectReport', projectId)
```

### 问题相关

```typescript
// 获取所有问题
const result = await window.electron.ipcRenderer.invoke('butler:getAllProblems')

// 获取问题详情
const result = await window.electron.ipcRenderer.invoke('butler:getProblem', problemId)

// 获取解决方案
const result = await window.electron.ipcRenderer.invoke('butler:getSolution', problemId)

// 手动修复问题
const result = await window.electron.ipcRenderer.invoke('butler:fixProblem', problemId)
```

### 能力管理

```typescript
// 获取所有能力
const result = await window.electron.ipcRenderer.invoke('butler:getCapabilities')

// 启用能力
await window.electron.ipcRenderer.invoke('butler:enableCapability', 'permission_fix')

// 禁用能力
await window.electron.ipcRenderer.invoke('butler:disableCapability', 'permission_fix')
```

### 其他

```typescript
// 注册问题
const result = await window.electron.ipcRenderer.invoke('butler:registerProblem', error, agentId, phase, context)

// 清理已解决的问题
await window.electron.ipcRenderer.invoke('butler:cleanup')
```

## 前端组件

智能管家提供了 React 组件 `ButlerPanel`，可以轻松集成到应用中：

```typescript
import { ButlerPanel } from '@/components/ButlerPanel'

function App() {
  return (
    <div className="app">
      <ButlerPanel />
    </div>
  )
}
```

### 组件功能

- **项目列表**：显示所有追踪的项目
- **问题列表**：显示所有检测到的问题
- **项目报告**：显示选中项目的详细报告
- **解决方案**：显示选中问题的解决方案

## 配置选项

智能管家可以通过配置进行调整：

```typescript
const config = {
  autoFixEnabled: true,           // 是否启用自动修复
  maxAutoFixAttempts: 3,          // 最大自动修复尝试次数
  escalationThreshold: 2,         // 升级阈值
  projectTrackingEnabled: true,   // 是否启用项目追踪
  notificationEnabled: true        // 是否启用通知
}
```

## 事件监听

智能管家会发出以下事件：

```typescript
// 问题检测
smartButlerAgent.on('problem_detected', (problem) => {
  console.log('检测到问题:', problem)
})

// 问题诊断中
smartButlerAgent.on('problem_diagnosing', (problem) => {
  console.log('诊断问题中:', problem)
})

// 问题解决中
smartButlerAgent.on('problem_resolving', (problem) => {
  console.log('解决问题中:', problem)
})

// 问题已解决
smartButlerAgent.on('problem_resolved', (problem) => {
  console.log('问题已解决:', problem)
})

// 问题升级
smartButlerAgent.on('problem_escalated', (problem) => {
  console.log('问题已升级:', problem)
})

// 项目追踪开始
smartButlerAgent.on('project_tracking_started', (project) => {
  console.log('开始追踪项目:', project)
})

// 项目状态更新
smartButlerAgent.on('project_status_updated', (project) => {
  console.log('项目状态更新:', project)
})

// 项目文件更新
smartButlerAgent.on('project_files_updated', (project) => {
  console.log('项目文件更新:', project)
})
```

## 最佳实践

### 1. 自动修复策略

对于权限和路径问题，智能管家会自动尝试修复。如果自动修复失败，会升级为需要人工干预。

### 2. 项目追踪

智能管家会自动追踪项目创建过程，包括文件列表、状态变化等。这些信息会保存在 `~/.trae-ai/projects.json` 文件中。

### 3. 问题升级

当问题无法自动修复时，智能管家会升级问题，提示用户需要人工干预。

### 4. 定期清理

建议定期清理已解决的问题，避免数据积累过多：

```typescript
// 清理一小时前已解决的问题
smartButlerAgent.cleanupResolvedProblems()
```

## 常见问题

### Q: 智能管家无法自动修复问题怎么办？

A: 可以通过前端界面手动触发修复，或者根据提示手动执行修复步骤。

### Q: 项目信息保存在哪里？

A: 项目信息保存在 `~/.trae-ai/projects.json` 文件中。

### Q: 如何禁用某个能力？

A: 可以通过 IPC 接口禁用特定能力：

```typescript
await window.electron.ipcRenderer.invoke('butler:disableCapability', 'permission_fix')
```

### Q: 如何查看项目报告？

A: 可以通过前端界面的"项目报告"标签页查看，或者下载 Markdown 格式的报告。

## 示例

### 示例1：创建一个简易记事本

```typescript
// 用户输入
const instruction = '创建一个简易记事本应用'

// 智能管家自动开始追踪项目
// 智能体协作开始...

// 如果遇到权限问题，智能管家自动修复
// 如果遇到路径问题，智能管家自动修复

// 项目完成后，智能管家生成报告
const report = smartButlerAgent.generateProjectReport(projectId)
console.log(report)
```

### 示例2：手动处理问题

```typescript
// 检测到问题
const error = new Error('EACCES: permission denied')
await smartButlerAgent.registerProblem(error, 'agent-dev', 'implementation', {
  path: '/Users/wangchao/Desktop/my-app'
})

// 获取问题
const problem = smartButlerAgent.getProblem(problemId)

// 手动修复
const solution = await smartButlerAgent.generateSolution(problem)
const success = await smartButlerAgent.executeSolution(solution)
```

## 总结

智能管家为多智能体协作系统提供了强大的问题管理和项目追踪能力，能够自动检测和修复常见问题，大大提高了系统的可靠性和用户体验。
