# 简易记事本 (Simple Notepad)

一个功能完整的命令行记事本应用，支持本地存储和CRUD操作。

## 功能特性

- 📝 **创建笔记** - 添加新笔记，支持标题、内容和优先级设置
- 📋 **查看笔记** - 列出所有笔记，按优先级分类显示
- 🔍 **搜索笔记** - 根据关键词搜索标题和内容
- ✏️ **编辑笔记** - 修改现有笔记内容
- 🗑️ **删除笔记** - 删除不需要的笔记
- 📊 **统计信息** - 查看笔记统计数据和分布
- 💾 **本地存储** - 数据自动保存到本地JSON文件
- 🎨 **彩色界面** - 使用Chalk提供美观的命令行界面

## 安装步骤

### 1. 克隆或下载项目
```bash
# 克隆项目
cd /Users/wangchao/Desktop/本地化TRAE/简易记事本

# 或直接进入项目目录
cd simple-notepad
```

### 2. 安装依赖
```bash
npm install
```

### 3. 运行应用
```bash
# 启动应用
npm start

# 或直接运行
node src/index.js
```

## 使用说明

### 主菜单
启动应用后，您将看到以下菜单选项：

```
========================================
          简易记事本 v1.0.0
========================================

请选择操作:
  📝 创建新笔记
  📋 查看所有笔记
  🔍 搜索笔记
  ✏️ 编辑笔记
  🗑️ 删除笔记
  📊 统计信息
  🚪 退出
```

### 创建笔记
1. 选择 "📝 创建新笔记"
2. 输入笔记标题
3. 输入笔记内容
4. 选择优先级（高/中/低）
5. 笔记将自动保存到本地

### 查看笔记
- 选择 "📋 查看所有笔记" 查看所有笔记
- 笔记按创建时间倒序排列
- 不同优先级使用不同颜色标识

### 搜索笔记
- 选择 "🔍 搜索笔记"
- 输入关键词
- 系统将搜索标题和内容中包含关键词的笔记

### 编辑笔记
1. 选择 "✏️ 编辑笔记"
2. 从列表中选择要编辑的笔记
3. 修改标题、内容或优先级
4. 保存更改

### 删除笔记
1. 选择 "🗑️ 删除笔记"
2. 从列表中选择要删除的笔记
3. 确认删除操作

### 统计信息
- 选择 "📊 统计信息" 查看笔记统计数据
- 包括总笔记数、优先级分布、平均内容长度等

## 项目结构

```
simple-notepad/
├── src/
│   ├── index.js          # 主应用程序文件
│   └── data/
│       └── notes.json    # 笔记数据存储文件
├── package.json          # 项目配置和依赖
├── README.md             # 项目说明文档
├── index.js              # 入口文件
├── models/               # 数据模型（预留）
├── routes/               # API路由（预留）
├── utils/                # 工具函数（预留）
└── public/               # 静态资源（预留）
```

## 数据存储

笔记数据存储在 `src/data/notes.json` 文件中，格式如下：

```json
[
  {
    "id": "uuid-string",
    "title": "笔记标题",
    "content": "笔记内容",
    "priority": "high|medium|low",
    "createdAt": "ISO日期字符串",
    "updatedAt": "ISO日期字符串"
  }
]
```

## 技术栈

- **Node.js** - JavaScript运行时环境
- **Inquirer.js** - 交互式命令行界面
- **Chalk** - 命令行彩色输出
- **UUID** - 生成唯一标识符
- **Jest** - 测试框架
- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化

## 开发指南

### 运行测试
```bash
npm test
```

### 代码检查
```bash
npm run lint
```

### 代码格式化
```bash
npm run format
```

### 添加新功能
1. 在 `src/index.js` 中添加新功能函数
2. 在主菜单中添加对应选项
3. 更新 `package.json` 中的导出
4. 编写测试用例

## 故障排除

### 常见问题

1. **权限问题**
   ```bash
   # 确保有读写权限
   chmod +x src/index.js
   ```

2. **依赖安装失败**
   ```bash
   # 清除npm缓存
   npm cache clean --force
   
   # 重新安装
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **数据文件损坏**
   ```bash
   # 备份并重新初始化数据文件
   mv src/data/notes.json src/data/notes.json.backup
   echo '[]' > src/data/notes.json
   ```

### 日志文件

应用会在控制台输出详细的操作日志，包括：
- 创建、编辑、删除笔记的确认信息
- 搜索结果的统计信息
- 错误信息和异常处理

## 扩展计划

### 短期计划
- [ ] 添加笔记分类/标签功能
- [ ] 支持导出笔记为Markdown文件
- [ ] 添加笔记提醒功能
- [ ] 支持富文本内容

### 长期计划
- [ ] Web界面版本
- [ ] 移动端应用
- [ ] 云同步功能
- [ ] 团队协作功能

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

ISC License

## 作者

简易记事本开发团队

## 版本历史

- v1.0.0 (2024) - 初始版本发布
  - 基础CRUD功能
  - 本地JSON存储
  - 命令行交互界面
  - 优先级分类系统
