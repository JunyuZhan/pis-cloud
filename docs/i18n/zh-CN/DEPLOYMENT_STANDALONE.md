# PIS 完全自托管部署指南

> 本地部署方案，所有服务容器化运行在你的服务器上

---

## 目录

1. [架构概览](#架构概览)
2. [前置要求](#前置要求)
3. [快速部署](#快速部署)
4. [详细配置](#详细配置)
5. [数据库迁移](#数据库迁移)
6. [SSL 证书配置](#ssl-证书配置)
7. [日常运维](#日常运维)
8. [故障排除](#故障排除)

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                       你的服务器                             │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Nginx (反向代理)                   │   │
│  │              :80/:443 → 对外服务                     │   │
│  └───────────────┬──────────────────────────────────────┘   │
│                  │                                          │
│  ┌───────────────┼───────────────┐                        │
│  ▼               ▼               ▼                        │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐                 │
│  │   Web   │  │  Worker │  │  MinIO   │                 │
│  │ (Next.js)│  │(图片处理)│  │ (对象存储)│                 │
│  └────┬────┘  └────┬────┘  └────┬─────┘                 │
│       │            │             │                         │
│  ┌────┼────────────┼─────────────┼──────┐                 │
│  ▼    ▼            ▼             ▼      ▼                 │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐               │
│  │PostgreSQL│  │  Redis  │  │  文件存储  │               │
│  │  (数据库) │  │ (队列)  │  │           │               │
│  └─────────┘  └─────────┘  └──────────┘               │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**服务说明：**

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| Nginx | pis-nginx | 80, 443 | 反向代理、SSL |
| Web | pis-web | 3000 (内部) | Next.js 前端 |
| Worker | pis-worker | 3001 (内部) | 图片处理服务 |
| PostgreSQL | pis-postgres | 5432 (内部) | 数据库 |
| Redis | pis-redis | 6379 (内部) | 任务队列 |
| MinIO | pis-minio | 9000, 9001 (内部) | 对象存储 |

---

## 前置要求

### 硬件要求

| 配置 | 最低 | 推荐 |
|------|------|------|
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 存储 | 40 GB | 100 GB+ SSD |

### 软件要求

- **操作系统**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **域名**: 已解析到服务器 IP
- **开放端口**: 80, 443

### 安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

---

## 快速部署

### 一键部署

```bash
# 1. 克隆项目
git clone <你的仓库地址> /opt/pis
cd /opt/pis

# 2. 执行部署脚本
bash docker/deploy-standalone.sh
```

部署脚本会自动：
1. 检查 Docker 环境
2. 创建并配置环境变量文件
3. 生成必要的安全密钥
4. 创建自签名 SSL 证书
5. 构建 Docker 镜像
6. 启动所有服务

### 手动部署

如果需要更多控制，可以手动执行：

```bash
# 1. 创建环境变量文件
cp .env.standalone.example .env.standalone

# 2. 编辑配置（必须修改以下项）
vim .env.standalone
```

**必须修改的配置：**
- `DOMAIN` - 你的域名
- `POSTGRES_PASSWORD` - 数据库密码
- `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` - MinIO 密钥
- `WORKER_API_KEY` - Worker API 密钥
- `ALBUM_SESSION_SECRET` - 会话密钥

```bash
# 3. 创建 SSL 证书目录
mkdir -p docker/nginx/ssl

# 4. 生成自签名证书（首次启动用）
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/key.pem \
  -out docker/nginx/ssl/cert.pem \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=PIS/CN=localhost"

# 5. 构建并启动
docker-compose -f docker/docker-compose.standalone.yml build
docker-compose -f docker/docker-compose.standalone.yml up -d

# 6. 查看状态
docker-compose -f docker/docker-compose.standalone.yml ps
```

---

## 详细配置

### 环境变量说明

编辑 `.env.standalone` 文件：

```bash
# ==================== 域名配置 ====================
DOMAIN=yourdomain.com

# ==================== 数据库 ====================
POSTGRES_DB=pis
POSTGRES_USER=pis
POSTGRES_PASSWORD=<强密码>

# ==================== MinIO 存储 ====================
MINIO_ACCESS_KEY=<访问密钥>
MINIO_SECRET_KEY=<密钥>
MINIO_BUCKET=pis-photos
STORAGE_PUBLIC_URL=https://yourdomain.com/media

# ==================== Worker ====================
WORKER_API_KEY=<API密钥>

# ==================== 应用 ====================
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_MEDIA_URL=https://yourdomain.com/media
NEXT_PUBLIC_WORKER_URL=https://yourdomain.com/worker-api

# ==================== 安全 ====================
ALBUM_SESSION_SECRET=<会话密钥>

# ==================== 告警（可选）====================
ALERT_ENABLED=true
ALERT_TYPE=log  # telegram|email|log
```

### Nginx 配置

Nginx 配置文件位于 `docker/nginx/conf.d/default.conf`，包含：

- HTTP 自动跳转 HTTPS
- Next.js 前端代理
- API Routes 代理
- 媒体文件代理（带缓存）
- Worker API 代理

自定义域名后，修改配置中的 `server_name`：

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;  # 修改这里
    ...
}
```

---

## 数据库迁移

自托管模式使用 PostgreSQL，需要执行数据库架构迁移：

### 方式一：直接连接数据库执行

```bash
# 连接到容器内的数据库
docker exec -it pis-postgres psql -U pis -d pis

# 在 psql 中执行迁移脚本
\i /docker-entrypoint-initdb.d/init-db.sql

# 或者从外部执行
docker exec -i pis-postgres psql -U pis -d pis < database/migrations/001_initial.sql
```

### 方式二：使用迁移脚本

```bash
# 从项目根目录执行
docker exec -i pis-postgres psql -U pis -d pis < database/schema.sql
```

### 创建管理员账号

由于不使用 Supabase，需要手动创建管理员账号：

```sql
-- 连接到数据库
docker exec -it pis-postgres psql -U pis -d pis

-- 插入管理员（需要根据实际表结构调整）
-- 此处仅为示例，请根据实际表结构执行
```

或者注册第一个用户后，直接在数据库中将其标记为管理员。

---

## SSL 证书配置

### 使用 Let's Encrypt（推荐）

```bash
# 1. 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 2. 停止 Nginx 容器
docker-compose -f docker/docker-compose.standalone.yml stop nginx

# 3. 获取证书
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email your@email.com

# 4. 复制证书到项目
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem docker/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem docker/nginx/ssl/key.pem

# 5. 重启 Nginx
docker-compose -f docker/docker-compose.standalone.yml start nginx
```

### 自动续期

创建定时任务：

```bash
# 编辑 crontab
sudo crontab -e

# 添加以下行（每月 1 号凌晨 3 点续期）
0 3 1 * * certbot renew --quiet && docker-compose -f /opt/pis/docker/docker-compose.standalone.yml restart nginx
```

---

## 日常运维

### 常用命令

```bash
# 查看服务状态
docker-compose -f docker/docker-compose.standalone.yml ps

# 查看日志
docker-compose -f docker/docker-compose.standalone.yml logs -f [服务名]

# 重启服务
docker-compose -f docker/docker-compose.standalone.yml restart [服务名]

# 更新代码
git pull
docker-compose -f docker/docker-compose.standalone.yml build
docker-compose -f docker/docker-compose.standalone.yml up -d

# 停止所有服务
docker-compose -f docker/docker-compose.standalone.yml down

# 完全清理（包括数据卷，慎用！）
docker-compose -f docker/docker-compose.standalone.yml down -v
```

### 数据备份

```bash
# 备份 PostgreSQL
docker exec pis-postgres pg_dump -U pis pis > backup-$(date +%Y%m%d).sql

# 恢复 PostgreSQL
docker exec -i pis-postgres psql -U pis pis < backup-20250129.sql

# 备份 MinIO 数据
docker run --rm \
  -v pis_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/minio-backup-$(date +%Y%m%d).tar.gz /data
```

### 更新部署

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建镜像
docker-compose -f docker/docker-compose.standalone.yml build

# 3. 重启服务
docker-compose -f docker/docker-compose.standalone.yml up -d
```

---

## 故障排除

### 服务无法启动

```bash
# 查看详细日志
docker-compose -f docker/docker-compose.standalone.yml logs

# 检查端口占用
sudo netstat -tulpn | grep -E ':(80|443|5432|9000)'

# 检查磁盘空间
df -h
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 是否正常运行
docker exec pis-postgres pg_isready

# 检查数据库日志
docker logs pis-postgres

# 手动连接测试
docker exec -it pis-postgres psql -U pis -d pis
```

### 图片无法显示

1. 检查 MinIO 是否正常运行：
   ```bash
   curl http://localhost:9000/minio/health/live
   ```

2. 检查 Bucket 是否存在：
   ```bash
   docker exec pis-minio mc ls local/pis-photos
   ```

3. 检查 Nginx 配置：
   ```bash
   docker logs pis-nginx
   ```

### Worker 处理失败

```bash
# 查看 Worker 日志
docker logs pis-worker --tail 100

# 重启 Worker
docker-compose -f docker/docker-compose.standalone.yml restart worker
```

---

## 性能优化

### 调整 Worker 并发

编辑 `.env.standalone`：

```bash
# 增加 Worker 并发数（根据服务器配置调整）
PHOTO_PROCESSING_CONCURRENCY=5
```

### 调整 PostgreSQL 配置

创建 `docker/postgresql.conf`：

```ini
shared_buffers = 256MB
effective_cache_size = 1GB
max_connections = 100
```

修改 docker-compose.yml 挂载配置文件。

---

## 安全建议

1. **修改所有默认密码**
2. **使用防火墙限制访问**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```
3. **定期更新系统和 Docker**
4. **定期备份数据**
5. **监控日志异常**

---

## 与 Supabase 方案对比

| 特性 | 自托管方案 | Supabase 方案 |
|------|-----------|---------------|
| 数据库 | 本地 PostgreSQL | Supabase Cloud |
| 认证 | 自己实现 | Supabase Auth |
| 复杂度 | 较高 | 较低 |
| 成本 | 仅服务器成本 | 免费额度后付费 |
| 数据控制 | 完全掌控 | 托管在云端 |
| 维护 | 需要自己维护 | Supabase 维护 |

选择建议：
- **技术能力强** → 自托管
- **快速上线** → Supabase
- **数据敏感** → 自托管
- **团队协作** → Supabase
