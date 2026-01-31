# Supabase 数据库适配器

## 概述

PIS 使用 Supabase 作为唯一数据库后端。本目录包含 Supabase 数据库适配器的实现和测试。

## 架构

- **SupabaseAdapter**: Supabase 数据库适配器实现
- **supabase-compat**: Supabase 兼容层，提供统一的数据库操作接口
- **types**: 数据库适配器类型定义

## 运行测试

### 安装依赖

```bash
cd services/worker
pnpm install
```

### 运行所有测试

```bash
pnpm test
```

### 监听模式运行测试

```bash
pnpm test:watch
```

### 生成测试覆盖率报告

```bash
pnpm test:coverage
```

## 测试结构

### Supabase 适配器测试 (`supabase-adapter.test.ts`)

测试覆盖：
- ✅ 构造函数和配置验证
- ✅ `findOne` - 单条记录查询
- ✅ `findMany` - 多条记录查询（包括分页、排序、字段选择）
- ✅ `insert` - 插入记录（单条和批量）
- ✅ `update` - 更新记录
- ✅ `delete` - 删除记录
- ✅ `count` - 计数查询
- ✅ 错误处理

### 适配器工厂测试 (`index.test.ts`)

测试覆盖：
- ✅ 从配置创建 Supabase 适配器
- ✅ 从环境变量创建适配器
- ✅ 单例模式
- ✅ 错误处理（配置缺失）

## 配置

环境变量：
- `SUPABASE_URL`: Supabase 项目 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key

## 注意事项

1. **Supabase 认证**: 使用 Service Role Key 绕过 RLS（Row Level Security）
2. **环境变量**: 确保正确配置 Supabase 凭证
3. **单例模式**: 适配器使用单例模式，避免重复创建连接
