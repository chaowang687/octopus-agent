# GitHub 仓库创建和发布指南

## 步骤 1: 创建 GitHub 仓库

### 方法一：通过 GitHub Web 界面（推荐）

1. 访问 https://github.com/new
2. 填写仓库信息：
   - **Repository name**: `octopus-agent`
   - **Description**: `Octopus Agent - 智能体编码工具`
   - **Visibility**: 选择 Public 或 Private
   - **不要勾选** "Add a README file"（本地已有）
   - **不要勾选** "Add .gitignore"（本地已有）
   - **不要勾选** "Choose a license"（本地已有）
3. 点击 "Create repository"

### 方法二：使用 GitHub CLI（需要先安装）

```bash
# 安装 GitHub CLI
brew install gh

# 登录 GitHub
gh auth login

# 创建仓库
gh repo create octopus-agent \
  --description "Octopus Agent - 智能体编码工具" \
  --public \
  --source=. \
  --remote=origin \
  --push
```

## 步骤 2: 配置远程仓库

创建仓库后，GitHub 会显示配置远程仓库的命令。运行以下命令：

```bash
# 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/octopus-agent.git

# 或者使用 SSH（推荐）
git remote add origin git@github.com:YOUR_USERNAME/octopus-agent.git
```

## 步骤 3: 修改 package.json

将 `package.json` 中的 GitHub 仓库信息修改为你的实际信息：

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "YOUR_USERNAME",
      "repo": "octopus-agent"
    }
  }
}
```

## 步骤 4: 提交并推送代码

```bash
# 查看当前状态
git status

# 添加所有更改
git add .

# 提交更改
git commit -m "feat: 添加 GitHub Releases 配置

- 添加自动发布工作流
- 添加发布脚本和文档
- 添加 CHANGELOG.md
- 配置 electron-builder 发布选项"

# 推送到 GitHub
git push -u origin main
```

## 步骤 5: 创建第一个 Release

### 方法一：自动发布（推荐）

```bash
# 创建并推送标签
git tag -a v0.1.1 -m "Octopus Agent v0.1.1"
git push origin v0.1.1
```

GitHub Actions 会自动：
- 构建应用
- 打包成 .dmg 和 .zip
- 创建 GitHub Release
- 上传构建产物

### 方法二：手动发布

如果自动发布失败，可以手动创建 Release：

1. 访问 GitHub 仓库的 Releases 页面
2. 点击 "Create a new release"
3. 选择标签 `v0.1.1`
4. 填写 Release 标题：`Octopus Agent v0.1.1`
5. 填写 Release 描述（可以从 CHANGELOG.md 复制）
6. 上传以下文件：
   - `Octopus-Agent-0.1.1-arm64.dmg`
   - `Octopus-Agent-0.1.1-arm64.zip`
   - `latest-mac.yml`
7. 点击 "Publish release"

## 步骤 6: 验证 Release

1. 访问 GitHub Releases 页面
2. 确认 Release 已创建
3. 下载并测试安装包
4. 验证应用功能

## 常见问题

### Q: 推送时提示认证失败

**A**: 使用 SSH 而不是 HTTPS：
```bash
# 删除现有的远程仓库
git remote remove origin

# 添加 SSH 远程仓库
git remote add origin git@github.com:YOUR_USERNAME/octopus-agent.git

# 推送
git push -u origin main
```

### Q: GitHub Actions 构建失败

**A**: 检查以下几点：
1. 确认 `package.json` 中的 GitHub 仓库信息正确
2. 确认 GitHub Token 权限正确
3. 查看 Actions 日志了解具体错误

### Q: 本地构建失败

**A**: 可能是网络问题，尝试使用镜像源：
```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm run dist
```

### Q: 如何查看构建进度？

**A**: 访问 GitHub 仓库的 Actions 页面，可以看到工作流的执行状态。

## 下一步

完成以上步骤后，你的应用就可以通过以下方式分发：

1. **直接下载**: 用户可以从 GitHub Releases 页面下载 .dmg 文件
2. **自动更新**: 应用会自动检查更新并提示用户下载新版本
3. **链接分享**: 可以直接分享 Release 的下载链接

## 示例 Release URL

创建成功后，Release URL 格式如下：

```
https://github.com/YOUR_USERNAME/octopus-agent/releases/tag/v0.1.1
```

下载链接格式：

```
https://github.com/YOUR_USERNAME/octopus-agent/releases/download/v0.1.1/Octopus-Agent-0.1.1-arm64.dmg
```
