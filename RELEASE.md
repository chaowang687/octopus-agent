# GitHub Releases 发布指南

## 自动发布流程

### 1. 配置 GitHub Secrets

在 GitHub 仓库的 Settings > Secrets and variables > Actions 中添加以下 secrets：

- `GITHUB_TOKEN`: 自动提供，无需配置
- `CSC_LINK`: macOS 代码签名证书（可选，用于公证）
- `CSC_KEY_PASSWORD`: 证书密码（可选）

### 2. 推送标签触发自动发布

```bash
# 创建并推送标签
git tag v0.1.1
git push origin v0.1.1
```

这将自动触发 `.github/workflows/release.yml` 工作流，完成以下操作：
1. 构建应用
2. 打包成 .dmg 和 .zip 文件
3. 创建 GitHub Release
4. 上传构建产物

## 手动发布流程

如果自动发布失败，可以按照以下步骤手动发布：

### 1. 本地构建

```bash
# 构建应用
npm run build

# 打包应用（需要网络连接）
npm run dist
```

### 2. 查找构建产物

构建完成后，在 `release/` 目录下会生成以下文件：

```
release/
├── mac-arm64/
│   ├── Octopus-Agent-0.1.1-arm64.dmg
│   ├── Octopus-Agent-0.1.1-arm64.zip
│   └── latest-mac.yml
└── builder-effective-config.yaml
```

### 3. 创建 GitHub Release

#### 方法一：通过 GitHub Web 界面

1. 访问 GitHub 仓库的 Releases 页面
2. 点击 "Create a new release"
3. 选择标签（如 `v0.1.1`）
4. 填写 Release 标题和描述
5. 上传以下文件：
   - `Octopus-Agent-0.1.1-arm64.dmg`
   - `Octopus-Agent-0.1.1-arm64.zip`
   - `latest-mac.yml`
6. 点击 "Publish release"

#### 方法二：通过 GitHub CLI

```bash
# 安装 GitHub CLI
brew install gh

# 登录 GitHub
gh auth login

# 创建 Release
gh release create v0.1.1 \
  --title "Octopus Agent v0.1.1" \
  --notes "Release notes here" \
  release/mac-arm64/Octopus-Agent-0.1.1-arm64.dmg \
  release/mac-arm64/Octopus-Agent-0.1.1-arm64.zip \
  release/mac-arm64/latest-mac.yml
```

### 4. 验证 Release

1. 访问 GitHub Releases 页面，确认 Release 已创建
2. 下载并测试安装包
3. 验证应用功能是否正常

## 更新配置

### 修改 package.json

在 `package.json` 的 `build.publish` 字段中配置正确的 GitHub 仓库信息：

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-github-username",
      "repo": "octopus-agent"
    }
  }
}
```

### 配置自动更新

在 `UpdateService.ts` 中配置更新服务器：

```typescript
const feedURL = process.env.UPDATE_FEED_URL || 'https://github.com/your-github-username/octopus-agent/releases/latest'
```

## 常见问题

### 构建失败

如果 `npm run dist` 失败，可能是因为：

1. **网络问题**：Electron 下载超时
   - 解决方案：使用代理或镜像源
   - 设置环境变量：`export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`

2. **证书问题**：代码签名失败
   - 解决方案：暂时移除 `hardenedRuntime` 配置
   - 或配置正确的 `CSC_LINK` 和 `CSC_KEY_PASSWORD`

### Release 创建失败

如果 GitHub Release 创建失败，检查：

1. GitHub Token 权限是否正确
2. 标签是否已推送
3. 仓库是否为公开仓库

### 自动更新不工作

如果自动更新不工作，检查：

1. `latest-mac.yml` 文件是否正确上传
2. `UpdateService.ts` 中的 `feedURL` 是否正确
3. 应用是否正确签名（macOS）

## 版本号管理

遵循语义化版本号规范：

- `MAJOR.MINOR.PATCH`
- `MAJOR`: 不兼容的 API 变更
- `MINOR`: 向后兼容的功能新增
- `PATCH`: 向后兼容的问题修复

示例：
- `v0.1.1` - 初始版本
- `v0.2.0` - 新增功能
- `v0.2.1` - Bug 修复
- `v1.0.0` - 正式发布

## 发布检查清单

发布前请确认：

- [ ] 版本号已更新
- [ ] CHANGELOG.md 已更新
- [ ] 所有测试通过
- [ ] 构建成功
- [ ] 安装包可正常安装
- [ ] 主要功能测试通过
- [ ] Release Notes 已编写
- [ ] 构建产物已上传
