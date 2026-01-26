# Multi-Storage and Multi-Database Support

PIS now supports multiple object storage services and databases, providing more flexible deployment options.

## 🎯 New Features

### 1. Multi-Storage Support

Supports the following object storage services:

- ✅ **MinIO** - Self-hosted object storage (default)
- ✅ **Alibaba Cloud OSS** - Alibaba Cloud Object Storage Service
- ✅ **Tencent Cloud COS** - Tencent Cloud Object Storage Service
- ✅ **AWS S3** - Amazon S3 Storage Service

All storage services use a unified abstraction layer interface, allowing you to switch without code changes.

### 2. Multi-Database Support

Supports the following databases:

- ✅ **Supabase** - PostgreSQL + Auth + Realtime (recommended)
- 🚧 **PostgreSQL** - Native PostgreSQL (interface implemented, adapter needs completion)
- 🚧 **MySQL** - MySQL/MariaDB (interface implemented, adapter needs completion)

## 📦 Architecture Design

### Storage Abstraction Layer

```
┌─────────────────────────────────────────┐
│      Worker Business Logic              │
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

### Database Abstraction Layer

```
┌─────────────────────────────────────────┐
│      Worker Business Logic              │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴─────────┐
         │ Database Adapter  │
         └─────────┬─────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼──────┐  ┌───▼──────┐  ┌───▼────┐
│ Supabase │  │PostgreSQL│  │ MySQL  │
└──────────┘  └──────────┘  └────────┘
```

## 🚀 Quick Start

### Switch to Alibaba Cloud OSS

1. **Configure Environment Variables:**
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

2. **Restart Worker:**
   ```bash
   docker-compose restart worker
   ```

3. **Verify:**
   - Upload a test photo
   - Check Worker logs to confirm using OSS
   - Verify photo can be accessed normally

### Switch to Tencent Cloud COS

1. **Configure Environment Variables:**
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

2. **Restart Worker:**
   ```bash
   docker-compose restart worker
   ```

## 🔧 Code Examples

### Using Storage Abstraction Layer

```typescript
import { getStorageAdapter } from './lib/storage/index';

const storage = getStorageAdapter();

// Upload file
await storage.upload('path/to/file.jpg', buffer, {
  'Content-Type': 'image/jpeg'
});

// Download file
const buffer = await storage.download('path/to/file.jpg');

// Generate presigned URL
const url = await storage.getPresignedGetUrl('path/to/file.jpg', 3600);
```

### Using Database Abstraction Layer

```typescript
import { getDatabaseAdapter } from './lib/database/index';

const db = getDatabaseAdapter();

// Query single record
const { data: photo } = await db.findOne('photos', { id: photoId });

// Query multiple records
const { data: photos } = await db.findMany('photos', {
  album_id: albumId,
  status: 'completed'
}, {
  limit: 20,
  orderBy: [{ column: 'created_at', direction: 'desc' }]
});

// Update record
await db.update('photos', { id: photoId }, {
  status: 'completed'
});
```

## 📝 Migration Guide

### Migrating from MinIO to OSS

1. **Backup Data:**
   ```bash
   # Use MinIO Client to export data
   mc mirror local/pis-photos ./backup/
   ```

2. **Configure OSS:**
   ```bash
   STORAGE_TYPE=oss
   # ... other OSS configurations
   ```

3. **Import Data to OSS:**
   ```bash
   # Use OSS command-line tool to import
   ossutil cp -r ./backup/ oss://your-bucket-name/pis-photos/
   ```

4. **Update Worker Configuration and Restart**

### Migrating from Supabase to PostgreSQL

1. **Export Data:**
   ```bash
   pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres > backup.sql
   ```

2. **Import to PostgreSQL:**
   ```bash
   psql -h localhost -U postgres -d pis < backup.sql
   ```

3. **Update Configuration:**
   ```bash
   DATABASE_TYPE=postgresql
   DATABASE_URL=postgresql://user:password@host:5432/pis
   ```

## 🎨 Extension Development

### Adding New Storage Adapter

1. **Implement StorageAdapter Interface:**
   ```typescript
   import { StorageAdapter } from './types';
   
   export class CustomStorageAdapter implements StorageAdapter {
     async download(key: string): Promise<Buffer> {
       // Implement download logic
     }
     
     async upload(key: string, buffer: Buffer): Promise<UploadResult> {
       // Implement upload logic
     }
     
     // ... implement other methods
   }
   ```

2. **Register in index.ts:**
   ```typescript
   case 'custom':
     return new CustomStorageAdapter(finalConfig);
   ```

### Adding New Database Adapter

1. **Implement DatabaseAdapter Interface:**
   ```typescript
   import { DatabaseAdapter } from './types';
   
   export class CustomDatabaseAdapter implements DatabaseAdapter {
     async findOne<T>(table: string, filters: Record<string, any>) {
       // Implement query logic
     }
     
     // ... implement other methods
   }
   ```

2. **Register in index.ts:**
   ```typescript
   case 'custom':
     return new CustomDatabaseAdapter(finalConfig);
   ```

## ⚠️ Notes

1. **Backward Compatibility**: Old `MINIO_*` environment variables are still supported and will automatically map to new `STORAGE_*` configurations

2. **Database Limitations**: PostgreSQL and MySQL adapters currently only provide interfaces. Full implementation requires:
   - Implementing user authentication system
   - Implementing real-time data synchronization
   - Converting database schema script (convert `database/full_schema.sql` to MySQL syntax)

3. **Storage Migration**: When switching storage types, existing data needs to be migrated, otherwise uploaded files will not be accessible

4. **Performance Considerations**: Different storage services have different performance characteristics. Choose based on actual needs

## 📚 Related Documentation

- [Storage Configuration Guide](STORAGE_CONFIG.md)
- [Database Configuration Guide](DATABASE_CONFIG.md)
- [Deployment Guide](DEPLOYMENT.md)
