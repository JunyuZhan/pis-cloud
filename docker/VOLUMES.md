# Docker 存储卷命名规范

## 统一的卷命名规则

所有 Docker Compose 文件使用统一的存储卷命名规范：

### 数据库卷
- **PostgreSQL**: `pis_postgres_data`
- **MySQL**: `pis_mysql_data`

### 存储卷
- **MinIO**: `pis_minio_data`
- **Redis**: `pis_redis_data`

### 其他卷（仅完全自托管模式）
- **Nginx 日志**: `pis_nginx_logs`
- **SSL 证书**: `pis_certs`

## 命名格式

格式：`pis_<服务名>_<类型>`

- `pis_`: 项目前缀
- `<服务名>`: 服务名称（postgres, mysql, minio, redis, nginx）
- `<类型>`: 数据类型（data, logs, certs）

## 各部署模式的卷配置

### 1. 完全自托管模式 (`docker-compose.standalone.yml`)
- `pis_postgres_data` - PostgreSQL 数据库
- `pis_minio_data` - MinIO 对象存储
- `pis_redis_data` - Redis 缓存/队列
- `pis_nginx_logs` - Nginx 日志
- `pis_certs` - SSL 证书

### 2. Supabase 混合模式 (`docker-compose.yml`)
- `pis_minio_data` - MinIO 对象存储
- `pis_redis_data` - Redis 缓存/队列

### 3. PostgreSQL 模式 (`docker-compose.postgresql.yml`)
- `pis_postgres_data` - PostgreSQL 数据库
- `pis_minio_data` - MinIO 对象存储
- `pis_redis_data` - Redis 缓存/队列

### 4. MySQL 模式 (`docker-compose.mysql.yml`)
- `pis_mysql_data` - MySQL 数据库
- `pis_minio_data` - MinIO 对象存储
- `pis_redis_data` - Redis 缓存/队列

## 卷管理命令

```bash
# 查看所有卷
docker volume ls | grep pis_

# 查看卷详情
docker volume inspect pis_postgres_data

# 备份卷
docker run --rm -v pis_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data

# 删除卷（谨慎操作）
docker volume rm pis_postgres_data
```
