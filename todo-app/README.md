# Todo Master - 现代待办事项应用

一个简洁、美观、功能完整的待办事项管理应用，采用React + TypeScript + Vite构建。

## 功能特性

- ✅ 添加新任务
- ✅ 标记任务完成/未完成
- ✅ 删除任务
- ✅ 任务创建时间显示
- ✅ 数据持久化（localStorage）
- ✅ 响应式设计（移动端优先）
- ✅ 空状态提示
- ✅ 任务统计
- ✅ 输入验证
- ✅ 平滑动画效果

## 技术栈

- React 18 + TypeScript
- Vite 构建工具
- Tailwind CSS 样式框架
- Lucide React 图标库
- Framer Motion 动画库
- date-fns 日期处理

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 项目结构

```
todo-app/
├── src/
│   ├── components/     # React组件
│   ├── hooks/         # 自定义Hooks
│   ├── types/         # TypeScript类型定义
│   ├── utils/         # 工具函数
│   ├── App.tsx        # 主应用组件
│   └── main.tsx       # 应用入口
├── public/            # 静态资源
└── index.html         # HTML模板
```

## 设计理念

遵循现代UI/UX设计原则，提供流畅的用户体验：
- 简洁直观的界面
- 即时反馈的交互
- 移动端优先的响应式设计
- 无障碍访问支持
- 性能优化
