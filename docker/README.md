# PIS Docker 部署指南

## 部署方式对比

| 方式 | 存储/Worker | 数据库 | 认证 | 第三方依赖 | 复杂度 |
|------|------------|--------|------|-----------|--------|
| **混合部署** | 自托管 | Supabase | Supabase | ✅ 需要 | ⭐ 简单 |
| **半自托管** | 自托管 | PostgreSQL | Supabase | ✅ 需要 | ⭐⭐ 中等 |
| **完全自托管** | 自托管 | PostgreSQL | 自定义 JWT | ❌ 无需 | ⭐⭐ 中等 |

## 快速开始（一键部署）

### 方法一：一键安装（推荐）

```bash
# 复制粘贴到终端执行
curl -sSL https://raw.githubusercontent.com/JunyuZhan/PIS/main/scripts/install.sh | bash

# 国内用户（使用代理加速）
curl -sSL https://ghproxy.com/https://raw.githubusercontent.com/JunyuZhan/PIS/main/scripts/install.sh | bash
```

### 方法二：手动安装

```bash
git clone https://github.com/JunyuZhan/PIS.git
cd pis/docker
bash deploy.sh
```

脚本会引导你完成：
- 选择部署方式（三选一）
- 配置域名
- 配置数据库（自动生成密码）
- 配置存储（自动生成密钥）
- 自动生成 SSL 证书
- 自动创建管理员账号（完全自托管模式）

## 手动部署

### 1. 混合部署（前端 Vercel + 后端自托管）

```bash
# 复制并编辑配置文件
cp ../.env.example ../.env
nano ../.env

# 启动后端服务
docker compose up -d
```

### 2. 半自托管（PostgreSQL + Supabase 认证）

```bash
# 复制并编辑配置文件
cp ../.env.standalone.example ../.env
# 设置 Supabase 密钥和 PostgreSQL 密码
nano ../.env

# 生成 SSL 证书
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/CN=localhost"

# 启动所有服务
docker compose -f docker-compose.standalone.yml up -d
```

### 3. 完全自托管（无第三方依赖）

```bash
# 复制配置文件
cp ../.env.standalone.example ../.env

# 编辑配置（注意设置 AUTH_MODE=custom）
nano ../.env
# 必须设置:
#   AUTH_MODE=custom
#   NEXT_PUBLIC_AUTH_MODE=custom
#   DATABASE_TYPE=postgresql
#   POSTGRES_PASSWORD=<your-password>
#   ALBUM_SESSION_SECRET=<random-secret>

# 生成 SSL 证书
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/CN=localhost"

# 启动所有服务
docker compose -f docker-compose.standalone.yml up -d

# 等待服务启动后，创建管理员账号
curl -X POST http://localhost:3000/api/auth/init \
    -H "Content-Type: application/json" \
    -H "x-init-key: <your-ALBUM_SESSION_SECRET>" \
    -d '{"email": "admin@example.com", "password": "your-password"}'
```

## 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f worker

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 重新构建并启动
docker compose up -d --build
```

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| web | 3000 | Next.js 前端 |
| worker | 3001 | 图片处理服务 |
| minio | 9000/9001 | 对象存储 |
| redis | 6379 | 任务队列 |
| postgres | 5432 | 数据库（自托管） |
| nginx | 80/443 | 反向代理（自托管） |

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker compose logs --tail=100 <服务名>

# 检查容器状态
docker compose ps -a
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 是否正常
docker compose exec postgres pg_isready -U pis
```

### MinIO 无法访问

```bash
# 检查 MinIO 健康状态
curl http://localhost:9000/minio/health/live
```

## 获取 Let's Encrypt 证书

```bash
# 1. 停止 nginx
docker compose -f docker-compose.standalone.yml stop nginx

# 2. 安装 certbot（如果未安装）
apt install certbot

# 3. 获取证书
certbot certonly --standalone -d your-domain.com

# 4. 复制证书
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# 5. 重启 nginx
docker compose -f docker-compose.standalone.yml start nginx
```

## 备份与恢复

### 备份数据

```bash
# 备份数据库
docker compose exec postgres pg_dump -U pis pis > backup.sql

# 备份 MinIO 数据
docker run --rm -v pis_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz /data
```

### 恢复数据

```bash
# 恢复数据库
docker compose exec -T postgres psql -U pis pis < backup.sql

# 恢复 MinIO 数据
docker run --rm -v pis_minio_data:/data -v $(pwd):/backup alpine tar xzf /backup/minio-backup.tar.gz -C /
```
