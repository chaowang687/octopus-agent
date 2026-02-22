# API文档

## API概述

**项目名称**: {{projectName}}
**创建日期**: {{createdAt}}
**版本**: {{version}}
**作者**: {{author}}

---

## 1. API基础信息

### 1.1 Base URL
```
{{baseUrl}}
```

### 1.2 认证方式
{{authMethod}}

### 1.3 通用请求头
| 请求头 | 值 | 说明 |
|--------|-----|------|
{{commonHeaders}}

### 1.4 通用响应格式
```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

---

## 2. 接口列表

### 2.1 用户模块

#### 2.1.1 用户注册
**接口**: `POST /api/user/register`

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
{{registerParams}}

**请求示例**:
```json
{{registerExample}}
```

**响应示例**:
```json
{{registerResponse}}
```

#### 2.1.2 用户登录
**接口**: `POST /api/user/login`

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
{{loginParams}}

**请求示例**:
```json
{{loginExample}}
```

**响应示例**:
```json
{{loginResponse}}
```

### 2.2 业务模块

{{businessApis}}

---

## 3. 数据模型

### 3.1 用户模型
```typescript
{{userModel}}
```

### 3.2 业务模型
```typescript
{{businessModels}}
```

---

## 4. 错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|---------|
{{errorCodeTable}}

---

## 5. 附录

### 5.1 更新日志
| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
{{changelogTable}}

### 5.2 联系方式
{{contactInfo}}
