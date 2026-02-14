# API密钥管理系统设计

## 1. 系统概述

API密钥管理系统是macOS本地化智能体编码工具的核心组件之一，负责管理用户的AI大模型API密钥，提供统一的模型调用接口，确保密钥的安全存储和高效使用。

## 2. 功能需求

### 2.1 核心功能
- 支持多种AI大模型的API密钥管理（OpenAI、Claude、Minimax等）
- 本地加密存储API密钥
- 提供统一的模型调用接口
- 支持模型参数配置
- API请求速率限制管理
- 密钥有效性验证

### 2.2 扩展功能
- 支持环境变量配置
- 多用户支持（可选）
- 密钥轮换提醒
- 用量统计与监控

## 3. 架构设计

### 3.1 系统架构

```
┌───────────────────────────────────────────────────────────────────────────┐
│                            应用层                                       │
├───────────────┬───────────────┬───────────────┬───────────────────────────┤
│  智能体引擎   │  插件系统     │  控制台界面   │  VS Code集成             │
├───────────────┴───────────────┴───────────────┴───────────────────────────┤
│                            API管理系统                                  │
├───────────────┬───────────────┬───────────────┬───────────────────────────┤
│  密钥存储     │  模型适配器   │  API请求处理  │  速率限制管理             │
├───────────────┴───────────────┴───────────────┴───────────────────────────┤
│                            底层依赖                                     │
├───────────────┬───────────────┬───────────────┬───────────────────────────┤
│  加密库       │  文件系统     │  网络请求     │  环境变量                 │
└───────────────┴───────────────┴───────────────┴───────────────────────────┘
```

### 3.2 核心组件

#### 3.2.1 密钥存储模块
- **功能**：安全存储和管理API密钥
- **实现方案**：
  - 使用Node.js的`keytar`库进行本地加密存储
  - 支持文件系统加密存储（备用方案）
  - 提供密钥导入/导出功能
  - 实现密钥权限控制

#### 3.2.2 模型适配器模块
- **功能**：为不同AI模型提供统一的调用接口
- **实现方案**：
  - 采用适配器设计模式
  - 为每种模型实现专用适配器
  - 统一模型参数格式
  - 处理模型特定的请求/响应格式

#### 3.2.3 API请求处理模块
- **功能**：处理API请求的发送和响应
- **实现方案**：
  - 使用Axios进行HTTP请求
  - 实现请求重试机制
  - 处理错误和异常
  - 支持流式响应

#### 3.2.4 速率限制管理模块
- **功能**：管理API请求速率，避免超过模型限制
- **实现方案**：
  - 实现令牌桶算法
  - 监控API使用情况
  - 提供速率限制配置
  - 实现请求队列

## 4. 技术实现

### 4.1 技术栈

| 类别 | 技术/库 | 版本 | 用途 |
|------|---------|------|------|
| 开发语言 | TypeScript | ^5.0.0 | 核心代码开发 |
| 加密存储 | keytar | ^7.9.0 | 安全存储API密钥 |
| 网络请求 | axios | ^1.6.0 | HTTP请求处理 |
| 配置管理 | dotenv | ^16.0.0 | 环境变量管理 |
| 加密库 | crypto | 内置 | 数据加密 |
| 类型定义 | @types/node | ^18.0.0 | TypeScript类型支持 |

### 4.2 核心类设计

#### 4.2.1 ApiKeyManager

```typescript
class ApiKeyManager {
  // 存储API密钥
  private keyStore: KeyStore;
  // 模型适配器映射
  private modelAdapters: Map<string, ModelAdapter>;
  // 速率限制管理器
  private rateLimiter: RateLimiter;

  // 初始化
  constructor();

  // 添加API密钥
  addApiKey(model: string, apiKey: string): Promise<void>;

  // 获取API密钥
  getApiKey(model: string): Promise<string | null>;

  // 删除API密钥
  removeApiKey(model: string): Promise<void>;

  // 验证API密钥
  validateApiKey(model: string, apiKey: string): Promise<boolean>;

  // 调用模型API
  callModel(model: string, params: ModelParams): Promise<ModelResponse>;

  // 获取支持的模型列表
  getSupportedModels(): string[];
}
```

#### 4.2.2 KeyStore

```typescript
class KeyStore {
  // 存储API密钥
  storeApiKey(model: string, apiKey: string): Promise<void>;

  // 获取API密钥
  getApiKey(model: string): Promise<string | null>;

  // 删除API密钥
  removeApiKey(model: string): Promise<void>;

  // 列出所有存储的密钥
  listApiKeys(): Promise<Array<{ model: string }>>;

  // 导出所有密钥
  exportApiKeys(): Promise<string>;

  // 导入密钥
  importApiKeys(keys: string): Promise<void>;
}
```

#### 4.2.3 ModelAdapter

```typescript
interface ModelAdapter {
  // 模型名称
  modelName: string;

  // 调用模型API
  call(params: ModelParams): Promise<ModelResponse>;

  // 验证API密钥
  validateApiKey(apiKey: string): Promise<boolean>;

  // 获取模型参数默认值
  getDefaultParams(): ModelParams;

  // 获取支持的模型列表
  getSupportedModels(): string[];
}

// 具体适配器实现
class OpenAIAdapter implements ModelAdapter { ... }
class ClaudeAdapter implements ModelAdapter { ... }
class MinimaxAdapter implements ModelAdapter { ... }
```

#### 4.2.4 RateLimiter

```typescript
class RateLimiter {
  // 初始化速率限制器
  constructor(model: string, options: RateLimitOptions);

  // 检查是否可以发送请求
  canRequest(): boolean;

  // 记录请求
  recordRequest(): void;

  // 获取剩余请求次数
  getRemaining(): number;

  // 获取重置时间
  getResetTime(): number;
}
```

## 5. 数据结构

### 5.1 模型参数

```typescript
interface ModelParams {
  model: string;
  prompt: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  // 其他模型特定参数
  [key: string]: any;
}
```

### 5.2 模型响应

```typescript
interface ModelResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    text: string;
    index: number;
    logprobs?: any;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### 5.3 速率限制选项

```typescript
interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  maxConcurrentRequests?: number;
}
```

## 6. 安全设计

### 6.1 密钥存储安全
- 使用keytar库进行本地加密存储
- 避免在代码中硬编码密钥
- 支持环境变量配置（优先使用）
- 限制密钥文件的访问权限

### 6.2 网络安全
- 使用HTTPS进行API请求
- 验证API响应的完整性
- 避免在日志中记录敏感信息
- 实现请求超时和错误处理

### 6.3 系统安全
- 限制API调用的权限范围
- 实现请求频率限制
- 提供密钥轮换机制
- 支持多因素认证（可选）

## 7. 配置管理

### 7.1 配置文件结构

```json
{
  "apiKeys": {
    "openai": "encrypted_key",
    "claude": "encrypted_key",
    "minimax": "encrypted_key"
  },
  "modelConfigs": {
    "openai": {
      "defaultModel": "gpt-4",
      "rateLimit": {
        "maxRequests": 60,
        "windowMs": 60000
      }
    },
    "claude": {
      "defaultModel": "claude-3-opus-20240229",
      "rateLimit": {
        "maxRequests": 50,
        "windowMs": 60000
      }
    },
    "minimax": {
      "defaultModel": "mm-3.0-turbo",
      "rateLimit": {
        "maxRequests": 100,
        "windowMs": 60000
      }
    }
  }
}
```

### 7.2 环境变量配置

```bash
# OpenAI API密钥
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Claude API密钥
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Minimax API密钥
MINIMAX_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 其他配置
API_KEY_STORAGE=keytar
DEFAULT_MODEL=openai:gpt-4
```

## 8. 集成方案

### 8.1 与智能体引擎集成
- 智能体引擎通过ApiKeyManager调用AI模型
- 支持多模型并行调用
- 提供模型选择策略（基于任务类型自动选择）

### 8.2 与插件系统集成
- 插件可以通过API管理系统调用AI模型
- 支持插件特定的模型配置
- 提供插件API使用统计

### 8.3 与控制台界面集成
- 提供命令行接口管理API密钥
- 支持密钥添加、删除、验证等操作
- 显示API使用状态和速率限制信息

## 9. 测试策略

### 9.1 单元测试
- 测试KeyStore的存储和检索功能
- 测试ModelAdapter的API调用功能
- 测试RateLimiter的速率限制功能
- 测试ApiKeyManager的核心功能

### 9.2 集成测试
- 测试与智能体引擎的集成
- 测试与插件系统的集成
- 测试与控制台界面的集成

### 9.3 性能测试
- 测试API调用的响应时间
- 测试速率限制的准确性
- 测试并发请求处理能力

## 10. 部署与维护

### 10.1 部署方案
- 作为macOS应用的一部分安装
- 支持命令行工具独立使用
- 提供配置文件模板

### 10.2 维护策略
- 定期更新模型适配器以支持新模型
- 监控API变更并及时适配
- 提供密钥备份和恢复功能
- 实现自动更新机制

## 11. 总结

API密钥管理系统是macOS本地化智能体编码工具的关键组件，通过安全存储和高效管理API密钥，为用户提供统一、便捷的AI模型调用接口。系统采用模块化设计，支持多种AI大模型，确保密钥安全，提供速率限制管理，为整个应用的智能体能力提供坚实的基础。

实现难度适中，主要挑战在于：
1. 确保API密钥的安全存储
2. 设计统一的模型调用接口
3. 实现有效的速率限制管理
4. 适配不同模型的API差异

通过合理的架构设计和技术选型，可以有效应对这些挑战，构建一个安全、高效、可靠的API密钥管理系统。