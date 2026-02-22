# 本地化TRAE 目录结构设计

## 📁 目录结构设计

```
本地化TRAE/
├── 📦 软件本体（核心代码和配置）
│   ├── src/                    # 源代码
│   │   ├── main/              # 主进程
│   │   ├── renderer/          # 渲染进程
│   │   └── shared/           # 共享代码
│   ├── config/                # 配置文件
│   │   └── agents/           # 智能体配置
│   ├── .github/               # GitHub配置
│   │   └── workflows/        # CI/CD工作流
│   ├── .agent/                # 浏览器缓存
│   ├── .docs/                # 文档
│   ├── coverage/              # 测试覆盖率
│   ├── data/                 # 数据文件
│   ├── demo-assets/           # 演示资源
│   ├── node_modules/          # 依赖包
│   ├── package.json           # 项目配置
│   ├── tsconfig.json         # TypeScript配置
│   ├── vite.config.ts        # Vite配置
│   └── electron.vite.config.ts # Electron配置
│
├── 🗂️ 临时工作项目（智能体生成的项目）
│   ├── workspaces/           # 工作区（WorkspaceManager使用）
│   │   └── session_xxx/     # 按会话ID组织
│   │       ├── 简易记事本/
│   │       ├── calculator-app/
│   │       └── ...
│   ├── projects/             # 已完成的项目（可归档）
│   │   ├── calculator-app/
│   │   ├── CodeLite/
│   │   └── ...
│   ├── .trae-ai/            # 智能管家数据
│   │   └── projects.json    # 项目追踪数据
│   └── temp/                # 临时文件
│       └── ...
│
├── 📄 文档（设计文档、总结等）
│   ├── API密钥管理系统设计.md
│   ├── IMAGE_PROCESSING_SUMMARY.md
│   ├── LIBRARY_IMPLEMENTATION_SUMMARY.md
│   ├── LIBRARY_SYSTEM_DESIGN.md
│   ├── ONLINE_DISTILLER_IMPLEMENTATION.md
│   ├── OPENCODE_INTEGRATION.md
│   ├── PERFORMANCE_OPTIMIZATION.md
│   ├── PROJECT_MANAGEMENT_SUMMARY.md
│   ├── PROJECT_PATH_FEATURE.md
│   ├── README.md
│   ├── REASONING_OPTIMIZATION_SUMMARY.md
│   ├── SKILL_DISPLAY_FEATURE.md
│   ├── SKILL_STORAGE_AND_CALLING_SYSTEM.md
│   ├── SKILL_SYSTEM_IMPLEMENTATION_SUMMARY.md
│   ├── SMART_BUTLER_GUIDE.md
│   ├── SMART_BUTLER_IMPLEMENTATION.md
│   ├── SMART_BUTLER_SOLUTION.md
│   ├── SYSTEM2_ISSUES_AND_SOLUTIONS.md
│   ├── TESTING_GUIDE.md
│   ├── TEST_GUIDE.md
│   ├── TEST_SUMMARY.md
│   └── VS Code集成模块设计.md
│
└── 🗑️ 其他（可以删除或归档）
    ├── check_task_history.js
    └── ...
```

## 🎯 目录说明

### 📦 软件本体

**用途**：本地化TRAE应用的核心代码和配置文件

**包含**：
- `src/` - 源代码（主进程、渲染进程、共享代码）
- `config/` - 配置文件（智能体配置等）
- `.github/` - GitHub配置（CI/CD工作流）
- `.agent/` - 浏览器缓存（自动生成）
- `.docs/` - 文档（自动生成）
- `coverage/` - 测试覆盖率（自动生成）
- `data/` - 数据文件
- `demo-assets/` - 演示资源
- `node_modules/` - 依赖包（自动生成）
- `package.json` - 项目配置
- `tsconfig.json` - TypeScript配置
- `vite.config.ts` - Vite配置
- `electron.vite.config.ts` - Electron配置

**管理**：
- ✅ 不需要手动管理
- ✅ 通过Git版本控制
- ✅ 定期更新依赖

### 🗂️ 临时工作项目

**用途**：智能体生成的项目文件，按会话ID组织

**包含**：
- `workspaces/` - 工作区（WorkspaceManager使用）
  - `session_xxx/` - 按会话ID组织
    - `简易记事本/` - 智能体生成的项目
    - `calculator-app/` - 智能体生成的项目
    - ...
- `projects/` - 已完成的项目（可归档）
  - `calculator-app/` - 用户选择保留的项目
  - `CodeLite/` - 用户选择保留的项目
  - ...
- `.trae-ai/` - 智能管家数据
  - `projects.json` - 项目追踪数据
- `temp/` - 临时文件

**管理**：
- ✅ 定期清理旧的工作区
- ✅ 将有用的项目移到 `projects/` 目录
- ✅ 删除不需要的项目
- ✅ 添加到 `.gitignore`

### 📄 文档

**用途**：设计文档、总结、指南等

**包含**：
- 设计文档（如 `API密钥管理系统设计.md`）
- 实现总结（如 `LIBRARY_IMPLEMENTATION_SUMMARY.md`）
- 指南（如 `TESTING_GUIDE.md`）
- 其他文档

**管理**：
- ✅ 可以整理到 `docs/` 子目录
- ✅ 可以创建分类（如 `docs/design/`, `docs/guides/`）
- ✅ 通过Git版本控制

### 🗑️ 其他

**用途**：临时文件、测试文件等

**包含**：
- `check_task_history.js` - 测试脚本
- 其他临时文件

**管理**：
- ✅ 删除不需要的文件
- ✅ 移到 `temp/` 目录
- ✅ 添加到 `.gitignore`

## 📋 .gitignore 配置

```gitignore
# 依赖
node_modules/
package-lock.json

# 构建输出
dist/
build/
out/

# 测试覆盖率
coverage/

# 浏览器缓存
.agent/

# 临时工作项目
workspaces/
projects/
temp/

# 智能管家数据
.trae-ai/

# 日志
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# 系统文件
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# 临时文件
check_task_history.js
*.tmp
```

## 🔄 目录迁移计划

### 第一步：创建新目录结构

```bash
cd /Users/wangchao/Desktop/本地化TRAE

# 创建临时工作项目目录
mkdir -p workspaces
mkdir -p projects
mkdir -p temp

# 移动现有项目到 projects 目录
mv calculator-app projects/
mv CodeLite projects/
```

### 第二步：更新 .gitignore

```bash
# 添加到 .gitignore
cat >> .gitignore << 'EOF'

# 临时工作项目
workspaces/
projects/
temp/

# 智能管家数据
.trae-ai/

# 临时文件
check_task_history.js
*.tmp
EOF
```

### 第三步：更新 WorkspaceManager 配置

确保 `WorkspaceManager` 使用 `workspaces/` 目录：

```typescript
// src/main/services/WorkspaceManager.ts
constructor(sessionId?: string) {
  this.sessionId = sessionId || `session_${Date.now()}`
  
  // 使用 workspaces 目录
  this.workspaceRoot = path.join(PATHS.PROJECT_ROOT, 'workspaces', this.sessionId)
  this.ensureWorkspaceExists()
}
```

### 第四步：更新智能管家配置

确保智能管家数据保存在 `.trae-ai/` 目录：

```typescript
// src/main/agent/SmartButlerAgent.ts
private getProjectsFilePath(): string {
  return path.join(os.homedir(), '.trae-ai', 'projects.json')
}
```

## 📊 目录大小管理

### 定期清理

```bash
# 清理旧的工作区（保留最近7天）
find workspaces -type d -mtime +7 -exec rm -rf {} \;

# 清理临时文件
find temp -type f -mtime +1 -delete

# 清理日志文件
find . -name "*.log" -mtime +7 -delete
```

### 监控目录大小

```bash
# 查看目录大小
du -sh workspaces projects temp

# 查看最大的目录
du -sh workspaces/* | sort -rh | head -10
```

## 🎁 管理建议

### 1. 定期清理

- **每周**：清理超过7天的工作区
- **每月**：清理不需要的项目
- **每季度**：归档有用的项目

### 2. 项目归档

对于有用的项目，可以：
- 移到 `projects/` 目录
- 添加 README.md 说明
- 压缩归档（如 `projects/archives/`）

### 3. 文档整理

将文档整理到 `docs/` 子目录：

```
docs/
├── design/          # 设计文档
│   ├── API密钥管理系统设计.md
│   └── LIBRARY_SYSTEM_DESIGN.md
├── implementation/  # 实现总结
│   ├── LIBRARY_IMPLEMENTATION_SUMMARY.md
│   └── SKILL_SYSTEM_IMPLEMENTATION_SUMMARY.md
├── guides/         # 指南
│   ├── TESTING_GUIDE.md
│   └── TEST_GUIDE.md
└── features/        # 功能文档
    ├── PROJECT_PATH_FEATURE.md
    └── SKILL_DISPLAY_FEATURE.md
```

### 4. 版本控制

- ✅ 软件本体通过Git管理
- ❌ 临时工作项目不通过Git管理
- ✅ 文档通过Git管理
- ❌ 依赖包不通过Git管理

## 🔧 实施步骤

### 立即执行

1. **创建目录结构**
   ```bash
   mkdir -p workspaces projects temp
   ```

2. **移动现有项目**
   ```bash
   mv calculator-app projects/
   mv CodeLite projects/
   ```

3. **更新 .gitignore**
   ```bash
   # 添加临时工作项目到 .gitignore
   ```

4. **测试系统**
   - 运行应用
   - 创建新项目
   - 验证项目保存在 `workspaces/` 目录

### 后续优化

1. **添加项目归档功能**
   - 实现项目归档到 `projects/archives/`
   - 添加压缩功能

2. **添加自动清理**
   - 定期清理旧的工作区
   - 清理临时文件

3. **添加项目管理界面**
   - 查看所有项目
   - 删除不需要的项目
   - 归档有用的项目

## 📝 总结

通过这个目录结构设计，可以：

✅ 清晰区分软件本体和临时工作项目  
✅ 方便管理智能体生成的项目  
✅ 定期清理不需要的文件  
✅ 保持Git仓库干净  
✅ 提高开发效率  

---

**版本**：1.0.0  
**最后更新**：2026-02-21  
**作者**：AI Assistant
