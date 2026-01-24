# 多存储和多数据库支持

PIS 现已支持多种对象存储服务和数据库，提供更灵活的部署选择。

## 🎯 新增功能

### 1. 多存储支持

支持以下对象存储服务：

- ✅ **MinIO** - 自建对象存储（默认）
- ✅ **阿里云 OSS** - 阿里云对象存储服务
- ✅ **腾讯云 COS** - 腾讯云对象存储服务
- ✅ **AWS S3** - Amazon S3 存储服务

所有存储服务通过统一的抽象层接口，代码无需修改即可切换。

### 2. 多数据库支持

支持以下数据库：

- ✅ **Supabase** - PostgreSQL + Auth + Realtime（推荐）
- 🚧 **PostgreSQL** - 原生 PostgreSQL（接口已实现，适配器待完善）
- 🚧 **MySQL** - MySQL/MariaDB（接口已实现，适配器待完善）

## 📦 架构设计

### 存储抽象层

```
┌─────────────────────────────────────────┐
│          Worker 业务逻辑                  │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴─────────┐
         │   Storage Adapter │
         └─────────┬─────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼───┐    ┌────▼────┐    ┌───▼───┐
│ MinIO │    │   OSS   │    │  COS  │
└───────┘    └─────────┘    └───────┘
```

### 数据库抽象层

```
┌─────────────────────────────────────────┐
│          Worker 业务逻辑                  │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴─────────┐
         │ Database Adapter   │
         └─────────┬─────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼──────┐  ┌───▼──────┐  ┌───▼────┐
│ Supabase │  │PostgreSQL│  │ MySQL  │
└──────────┘  └──────────┘  └────────┘
```

## 🚀 快速开始

### 切换到阿里云 OSS

1. **配置环境变量：**
   ```bash
   STORAGE_TYPE=oss
   STORAGE_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
   STORAGE_REGION=cn-hangzhou
   STORAGE_ACCESS_KEY=your-access-key-id
   STORAGE_SECRET_KEY=your-access-key-secret
   STORAGE_BUCKET=your-bucket-name
   STORAGE_PUBLIC_URL=https://your-bucket-name.oss-cn-hangzhou.aliyuncs.com
   STORAGE_USE_SSL=true
   ```

2. **重启 Worker：**
   ```bash
   docker-compose restart worker
   ```

3. **验证：**
   - 上传一张测试照片
   - 检查 Worker 日志确认使用 OSS
   - 验证照片可以正常访问

### 切换到腾讯云 COS

1. **配置环境变量：**
   ```bash
   STORAGE_TYPE=cos
   STORAGE_ENDPOINT=cos.ap-guangzhou.myqcloud.com
   STORAGE_REGION=ap-guangzhou
   STORAGE_ACCESS_KEY=your-secret-id
   STORAGE_SECRET_KEY=your-secret-key
   STORAGE_BUCKET=your-bucket-name
   STORAGE_PUBLIC_URL=https://your-bucket-name.cos.ap-guangzhou.myqcloud.com
   STORAGE_USE_SSL=true
   ```

2. **重启 Worker：**
   ```bash
   docker-compose restart worker
   ```

## 🔧 代码示例

### 使用存储抽象层

```typescript
import { getStorageAdapter } from './lib/storage/index';

const storage = getStorageAdapter();

// 上传文件
await storage.upload('path/to/file.jpg', buffer, {
  'Content-Type': 'image/jpeg'
});

// 下载文件
const buffer = await storage.download('path/to/file.jpg');

// 生成预签名 URL
const url = await storage.getPresignedGetUrl('path/to/file.jpg', 3600);
```

### 使用数据库抽象层

```typescript
import { getDatabaseAdapter } from './lib/database/index';

const db = getDatabaseAdapter();

// 查询单条记录
const { data: photo } = await db.findOne('photos', { id: photoId });

// 查询多条记录
const { data: photos } = await db.findMany('photos', {
  album_id: albumId,
  status: 'completed'
}, {
  limit: 20,
  orderBy: [{ column: 'created_at', direction: 'desc' }]
});

// 更新记录
await db.update('photos', { id: photoId }, {
  status: 'completed'
});
```

## 📝 迁移指南

### 从 MinIO 迁移到 OSS

1. **备份数据：**
   ```bash
   # 使用 MinIO Client 导出数据
   mc mirror local/pis-photos ./backup/
   ```

2. **配置 OSS：**
   ```bash
   STORAGE_TYPE=oss
   # ... 其他 OSS 配置
   ```

3. **导入数据到 OSS：**
   ```bash
   # 使用 OSS 命令行工具导入
   ossutil cp -r ./backup/ oss://your-bucket-name/pis-photos/
   ```

4. **更新 Worker 配置并重启**

### 从 Supabase 迁移到 PostgreSQL

1. **导出数据：**
   ```bash
   pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres > backup.sql
   ```

2. **导入到 PostgreSQL：**
   ```bash
   psql -h localhost -U postgres -d pis < backup.sql
   ```

3. **更新配置：**
   ```bash
   DATABASE_TYPE=postgresql
   DATABASE_URL=postgresql://user:password@host:5432/pis
   ```

## 🎨 扩展开发

### 添加新的存储适配器

1. **实现 StorageAdapter 接口：**
   ```typescript
   import { StorageAdapter } from './types';
   
   export class CustomStorageAdapter implements StorageAdapter {
     async download(key: string): Promise<Buffer> {
       // 实现下载逻辑
     }
     
     async upload(key: string, buffer: Buffer): Promise<UploadResult> {
       // 实现上传逻辑
     }
     
     // ... 实现其他方法
   }
   ```

2. **在 index.ts 中注册：**
   ```typescript
   case 'custom':
     return new CustomStorageAdapter(finalConfig);
   ```

### 添加新的数据库适配器

1. **实现 DatabaseAdapter 接口：**
   ```typescript
   import { DatabaseAdapter } from './types';
   
   export class CustomDatabaseAdapter implements DatabaseAdapter {
     async findOne<T>(table: string, filters: Record<string, any>) {
       // 实现查询逻辑
     }
     
     // ... 实现其他方法
   }
   ```

2. **在 index.ts 中注册：**
   ```typescript
   case 'custom':
     return new CustomDatabaseAdapter(finalConfig);
   ```

## ⚠️ 注意事项

1. **向后兼容：** 旧的 `MINIO_*` 环境变量仍然支持，会自动映射到新的 `STORAGE_*` 配置

2. **数据库限制：** PostgreSQL 和 MySQL 适配器目前仅提供接口，完整实现需要：
   - 实现用户认证系统
   - 实现实时数据同步
   - 转换数据库迁移脚本

3. **存储迁移：** 切换存储类型时，需要迁移现有数据，否则已上传的文件将无法访问

4. **性能考虑：** 不同存储服务的性能特征不同，建议根据实际需求选择

## 📚 相关文档

- [存储配置指南](STORAGE_CONFIG.md)
- [数据库配置指南](DATABASE_CONFIG.md)
- [部署文档](DEPLOYMENT.md)
