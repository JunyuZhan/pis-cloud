# Docker 存储卷命名规范

## 统一的卷命名规则

PIS 使用 Vercel + Supabase + 自建 Worker 架构，所有 Docker Compose 文件使用统一的存储卷命名规范：

### 存储卷
- **MinIO**: `pis_minio_data` - 对象存储
- **Redis**: `pis_redis_data` - 缓存/队列

## 命名格式

格式：`pis_<服务名>_<类型>`

- `pis_`: 项目前缀
- `<服务名>`: 服务名称（minio, redis）
- `<类型>`: 数据类型（data）

## Vercel + Supabase 架构的卷配置

### Docker Compose (`docker-compose.yml`)
- `pis_minio_data` - MinIO 对象存储
- `pis_redis_data` - Redis 缓存/队列

**注意**: 数据库由 Supabase 托管，前端由 Vercel 托管，无需本地卷。

## 卷管理命令

```bash
# 查看所有卷
docker volume ls | grep pis_

# 查看卷详情
docker volume inspect pis_minio_data

# 备份 MinIO 卷
docker run --rm -v pis_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio_backup.tar.gz /data

# 备份 Redis 卷
docker run --rm -v pis_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis_backup.tar.gz /data

# 删除卷（谨慎操作）
docker volume rm pis_minio_data pis_redis_data
```
