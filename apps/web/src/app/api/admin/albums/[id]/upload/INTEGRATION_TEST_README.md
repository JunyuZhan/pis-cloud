# 集成测试说明

## 概述

集成测试使用真实的依赖（Supabase、数据库等）来测试多个模块的协作。与单元测试不同，集成测试不 mock 依赖，而是使用真实的测试环境。

## 文件结构

- `route.integration.test.ts` - 集成测试文件
- `route.test.ts` - 单元测试文件（使用 mock）

## 运行集成测试

### 前置条件

1. **测试环境配置**：
   ```bash
   export RUN_INTEGRATION_TESTS=true
   export SUPABASE_URL="your-test-supabase-url"
   export SUPABASE_SERVICE_ROLE_KEY="your-test-service-role-key"
   ```

2. **测试数据库**：
   - 需要一个独立的测试 Supabase 项目
   - 或者使用本地测试数据库

### 运行命令

```bash
# 运行所有集成测试
pnpm test -- route.integration.test.ts

# 运行特定测试
pnpm test -- route.integration.test.ts -t "should create photo record"
```

## 测试用例

### 1. 数据库记录创建测试
- 验证照片记录确实被创建到数据库中
- 验证记录的所有字段都正确

### 2. 错误清理测试
- 验证当 presign API 失败时，照片记录被正确清理
- 确保不会留下孤儿记录

### 3. 文件类型验证测试
- 验证文件类型限制生效
- 验证不支持的文件类型被拒绝

### 4. 文件大小验证测试
- 验证文件大小限制生效
- 验证超过限制的文件被拒绝

## 辅助函数

使用 `@/test/integration-helpers` 中的辅助函数：

```typescript
import { 
  createTestAlbum, 
  deleteTestAlbum, 
  createTestPhoto, 
  deleteTestPhoto,
  cleanupTestData 
} from '@/test/integration-helpers'

// 创建测试相册
const album = await createTestAlbum({ title: 'Test Album' })

// 清理测试数据
await deleteTestAlbum(album.id)
```

## 注意事项

1. **数据清理**：集成测试会创建真实的数据库记录，确保在 `afterAll` 中清理
2. **环境隔离**：使用独立的测试环境，不要在生产环境运行
3. **测试顺序**：集成测试可能依赖执行顺序，注意测试的独立性
4. **性能**：集成测试比单元测试慢，因为它们使用真实依赖

## 与单元测试的区别

| 特性 | 单元测试 | 集成测试 |
|------|---------|---------|
| 依赖 | Mock | 真实依赖 |
| 速度 | 快 | 慢 |
| 隔离性 | 高 | 低 |
| 真实性 | 低 | 高 |
| 用途 | 测试单个函数 | 测试模块协作 |

## 最佳实践

1. **先写单元测试**：单元测试更快，更容易调试
2. **关键路径写集成测试**：只对关键业务流程写集成测试
3. **使用辅助函数**：使用 `integration-helpers.ts` 中的函数简化测试代码
4. **清理数据**：确保测试后清理所有创建的数据
5. **环境变量控制**：使用 `RUN_INTEGRATION_TESTS` 控制是否运行
