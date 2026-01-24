# 数据库配置指南

PIS 支持多种数据库，包括 Supabase（推荐）、PostgreSQL、MySQL 等。

## 支持的数据库类型

| 数据库类型 | 说明 | 适用场景 |
|-----------|------|---------|
| `supabase` | Supabase (PostgreSQL + Auth + Realtime) | **推荐**，功能完整 |
| `postgresql` | 原生 PostgreSQL | 已有 PostgreSQL 实例 |
| `mysql` | MySQL/MariaDB | 已有 MySQL 实例 |

## 配置方式

### 1. Supabase（推荐）

Supabase 提供了完整的后端服务，包括：
- PostgreSQL 数据库
- 用户认证（Auth）
- 实时订阅（Realtime）
- 存储管理
- API 自动生成

```bash
DATABASE_TYPE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**获取凭证：**
1. 访问 [supabase.com](https://supabase.com) 创建项目
2. 进入 Project Settings -> API
3. 复制 Project URL、anon public key 和 service_role key

**优势：**
- ✅ 开箱即用的认证系统
- ✅ 实时数据同步
- ✅ 自动 API 生成
- ✅ 行级安全策略（RLS）
- ✅ 免费额度充足

### 2. PostgreSQL

使用原生 PostgreSQL 需要自行处理认证和实时功能。

```bash
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:password@host:5432/database
# 或分别配置
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=postgres
DATABASE_PASSWORD=password
DATABASE_SSL=false
```

**注意事项：**
- ⚠️ 需要自行实现用户认证（可以使用 Supabase Auth 或其他方案）
- ⚠️ 需要自行实现实时功能（可以使用 WebSocket 或其他方案）
- ⚠️ 需要手动执行数据库迁移脚本

**数据库迁移：**
```bash
# 执行迁移脚本
psql -h localhost -U postgres -d pis -f database/migrations/001_init.sql
psql -h localhost -U postgres -d pis -f database/migrations/002_secure_rls.sql
# ... 其他迁移文件
```

### 3. MySQL

使用 MySQL 需要适配表结构和迁移脚本。

```bash
DATABASE_TYPE=mysql
DATABASE_URL=mysql://user:password@host:3306/database
# 或分别配置
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=pis
DATABASE_USER=root
DATABASE_PASSWORD=password
DATABASE_SSL=false
```

**注意事项：**
- ⚠️ MySQL 适配器尚未完全实现（需要贡献代码）
- ⚠️ 需要将 PostgreSQL 迁移脚本转换为 MySQL 语法
- ⚠️ 需要自行实现用户认证和实时功能

## 数据库迁移

### 从 Supabase 迁移到 PostgreSQL

1. **导出数据：**
   ```bash
   # 使用 pg_dump 导出 Supabase 数据
   pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres > backup.sql
   ```

2. **导入到新数据库：**
   ```bash
   psql -h localhost -U postgres -d pis < backup.sql
   ```

3. **更新配置：**
   ```bash
   DATABASE_TYPE=postgresql
   DATABASE_URL=postgresql://user:password@host:5432/pis
   ```

### 从 PostgreSQL 迁移到 Supabase

1. **导出数据：**
   ```bash
   pg_dump -h localhost -U postgres -d pis > backup.sql
   ```

2. **在 Supabase Dashboard 中执行 SQL：**
   - 进入 SQL Editor
   - 执行迁移脚本
   - 导入数据（如果需要）

3. **更新配置：**
   ```bash
   DATABASE_TYPE=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   ```

## 性能优化

1. **连接池配置：** 根据并发量调整连接池大小
2. **索引优化：** 确保常用查询字段有索引
3. **查询优化：** 避免 N+1 查询，使用批量查询
4. **缓存策略：** 使用 Redis 缓存热点数据

## 安全建议

1. **使用环境变量：** 不要在代码中硬编码数据库凭证
2. **最小权限原则：** 数据库用户只授予必要的权限
3. **启用 SSL：** 生产环境使用 SSL 连接
4. **定期备份：** 设置自动备份策略
5. **监控告警：** 配置数据库监控和告警

## 故障排除

### 连接失败

1. 检查数据库服务是否运行
2. 验证连接信息（主机、端口、用户名、密码）
3. 检查防火墙和网络设置
4. 确认数据库用户有远程连接权限

### 认证错误

1. 验证用户名和密码正确
2. 检查数据库用户权限
3. 确认数据库允许该用户连接

### 迁移脚本执行失败

1. 检查数据库版本兼容性
2. 确认迁移脚本语法正确
3. 查看错误日志定位问题
4. 按顺序执行迁移脚本
