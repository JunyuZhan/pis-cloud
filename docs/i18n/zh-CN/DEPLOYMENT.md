# PIS 部署指南

> 作者: junyuzhan (junyuzhan@outlook.com)  
> 许可证: MIT

## 目录

1. [架构概览](#架构概览)
2. [前置要求](#前置要求)
3. [Supabase 配置](#supabase-配置)
4. [本地开发环境](#本地开发环境)
5. [生产环境部署](#生产环境部署)
6. [环境变量配置](#环境变量配置)
7. [验证与测试](#验证与测试)
8. [维护与运维](#维护与运维)
9. [故障排除](#故障排除)

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              互联网                                      │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────────────────────┐
│    Vercel     │    │   Supabase    │    │        内网服务器              │
│  (Next.js)    │    │    Cloud      │    │                               │
│               │    │               │    │  ┌─────────┐  ┌─────────────┐ │
│  • 前端页面    │    │  • PostgreSQL │    │  │  MinIO  │  │   Worker    │ │
│  • API Routes │    │  • Auth       │    │  │ (存储)   │  │ (图片处理)  │ │
│  • SSR/SSG    │    │  • Realtime   │    │  └─────────┘  └─────────────┘ │
│               │    │               │    │       ▲              │        │
└───────┬───────┘    └───────┬───────┘    │       └──────────────┘        │
        │                    │            │              Redis            │
        │                    │            │           (任务队列)           │
        └────────────────────┴────────────┴───────────────────────────────┘
```

| 组件 | 部署位置 | 用途 |
|------|---------|------|
| Next.js 前端 | Vercel | 用户界面、API 路由 |
| PostgreSQL | Supabase | 元数据存储 |
| Auth | Supabase | 用户认证 |
| Realtime | Supabase | 实时推送 |
| MinIO | 内网 Docker | 照片存储 |
| Worker | 内网 Docker | 图片处理 |
| Redis | 内网 Docker | 任务队列 |

---

## 前置要求

### 本地开发

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Docker** & Docker Compose
- **Git**

### 生产部署

- 一台 Linux 服务器 (推荐 2核4G+)
- 已安装 Docker
- 域名已解析到服务器 (需要两个: 主站 + 媒体)
- Supabase 账号 (免费版即可)
- Vercel 账号 (免费版即可)

---

## Supabase 配置

### 1. 创建项目

1. 访问 [https://supabase.com](https://supabase.com) 并登录
2. 点击 **New Project**
3. 填写项目信息:
   - **Name**: `pis`
   - **Database Password**: 设置强密码并保存
   - **Region**: 选择离你最近的区域 (推荐新加坡)
4. 点击 **Create new project**，等待 2-3 分钟

### 2. 获取 API Keys

进入项目 → **Settings** → **API**，复制以下信息:

| 名称 | 用途 | 示例 |
|------|------|------|
| Project URL | 所有客户端 | `https://xxxxx.supabase.co` |
| anon public | 前端浏览器 | `eyJhbGciOiJIUzI1NiIs...` |
| service_role | Worker 后端 | `eyJhbGciOiJIUzI1NiIs...` (⚠️ 保密!) |

### 3. 执行数据库迁移

1. 进入项目 → **SQL Editor**
2. 点击 **New query**
3. 按顺序执行以下迁移文件（必须按顺序执行）：

```sql
-- 1. 初始化数据库结构
-- 复制 database/migrations/001_init.sql 的全部内容
-- 点击 Run 执行
-- 确认出现 albums 和 photos 表

-- 2. 修复 RLS 安全策略
-- 复制 database/migrations/002_secure_rls.sql 的全部内容
-- 点击 Run 执行

-- 3. 添加相册高级功能
-- 复制 database/migrations/003_album_features.sql 的全部内容
-- 点击 Run 执行

-- 4. 添加相册模板功能（可选，如需使用模板功能）
-- 复制 database/migrations/004_album_templates.sql 的全部内容
-- 点击 Run 执行

-- 5. 添加打包下载功能（可选，如需使用打包下载）
-- 复制 database/migrations/005_package_downloads.sql 的全部内容
-- 点击 Run 执行

-- 6. 添加相册分享配置（可选，如需使用微信分享优化）
-- 复制 database/migrations/006_album_share_config.sql 的全部内容
-- 点击 Run 执行

-- 7. 添加相册分组功能（可选，如需使用照片分组）
-- 复制 database/migrations/007_photo_groups.sql 的全部内容
-- 点击 Run 执行

-- 8. 添加相册活动元数据（可选，如需使用活动时间和地点）
-- 复制 database/migrations/008_album_event_metadata.sql 的全部内容
-- 点击 Run 执行
```

**注意**：迁移文件必须按顺序执行，后续迁移依赖前面的表结构。

### 4. 创建管理员账号

1. 进入 **Authentication** → **Users**
2. 点击 **Add user** → **Create new user**
3. 填写:
   - Email: 你的管理员邮箱
   - Password: 强密码
   - ☑️ Auto Confirm User
4. 点击 **Create user**

### 5. 配置 Auth URLs

1. 进入 **Authentication** → **URL Configuration**
2. 设置:

| 配置项 | 值 |
|--------|-----|
| Site URL | `https://yourdomain.com` |
| Redirect URLs | `https://yourdomain.com/auth/callback` |
| | `http://localhost:3000/auth/callback` |

### 6. 启用 Realtime (可选但推荐)

1. 进入 **Database** → **Replication**
2. 点击 **Tables** 标签
3. 找到 `photos` 表，点击开关启用

---

## 本地开发环境

### 1. 克隆并安装

```bash
git clone https://github.com/your-username/pis.git
cd pis
pnpm install
```

### 2. 启动基础服务

```bash
cd docker
docker-compose up -d minio redis minio-init
```

验证服务启动:
```bash
docker-compose ps
# 应该看到 pis-minio 和 pis-redis 状态为 Up (healthy)
```

### 3. 配置环境变量

**apps/web/.env.local:**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 应用配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MEDIA_URL=http://localhost:9000/pis-photos
```

**services/worker/.env:**

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MinIO (本地 Docker)
MINIO_ENDPOINT_HOST=localhost
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=pis-photos

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 4. 启动开发服务器

```bash
# 终端 1: 启动 Worker
cd services/worker
pnpm dev

# 终端 2: 启动前端
cd ../..   # 回到项目根目录
pnpm dev
```

### 5. 访问应用

| 地址 | 说明 |
|------|------|
| http://localhost:3000 | 前端首页 |
| http://localhost:3000/admin/login | 管理后台登录 |
| http://localhost:9001 | MinIO 控制台 (minioadmin/minioadmin) |

---

## 生产环境部署

### 服务器端 (Docker)

#### 1. 准备服务器

```bash
# 安装 Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. 上传项目文件

将以下文件上传到服务器 `/opt/pis/`:

```
/opt/pis/
├── docker/
│   ├── docker-compose.yml
│   ├── worker.Dockerfile
│   └── nginx/
│       └── media.conf
├── services/
│   └── worker/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
└── .env
```

#### 3. 配置环境变量

创建 `/opt/pis/.env`:

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MinIO (自定义强密码!)
MINIO_ACCESS_KEY=your-strong-access-key
MINIO_SECRET_KEY=your-strong-secret-key-at-least-8-chars

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
```

#### 4. 启动服务

```bash
cd /opt/pis/docker
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 5. 配置 Nginx 反向代理

创建 `/etc/nginx/sites-available/media.yourdomain.com`:

```nginx
server {
    listen 80;
    server_name media.yourdomain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name media.yourdomain.com;

    # SSL 证书 (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/media.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/media.yourdomain.com/privkey.pem;

    # 允许大文件上传
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 缓存静态资源
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800";

        # CORS
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
    }
}
```

启用配置:
```bash
sudo ln -s /etc/nginx/sites-available/media.yourdomain.com /etc/nginx/sites-enabled/
sudo certbot --nginx -d media.yourdomain.com
sudo nginx -t && sudo nginx -s reload
```

### Vercel 部署

#### 1. 连接仓库

1. 访问 [https://vercel.com](https://vercel.com) 并登录
2. 点击 **Add New Project**
3. 选择你的 GitHub 仓库

#### 2. 配置构建

| 配置项 | 值 |
|--------|-----|
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Build Command | `pnpm build` |
| Install Command | `pnpm install` |

#### 3. 配置环境变量

在 **Settings** → **Environment Variables** 添加:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_MEDIA_URL=https://media.yourdomain.com/pis-photos
```

#### 4. 部署

点击 **Deploy**，等待构建完成。

#### 5. 绑定域名

1. **Settings** → **Domains**
2. 添加 `yourdomain.com`
3. 按提示配置 DNS (CNAME 或 A 记录)

---

## 环境变量配置

### 前端 (Vercel / apps/web/.env.local)

| 变量 | 说明 | 示例 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 公开密钥 | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 | `eyJ...` |
| `NEXT_PUBLIC_APP_URL` | 应用访问地址 | `https://yourdomain.com` |
| `NEXT_PUBLIC_MEDIA_URL` | 媒体 CDN 地址 | `https://media.yourdomain.com/pis-photos` |

### Worker (Docker / .env)

| 变量 | 说明 | 示例 |
|------|------|------|
| `SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 | `eyJ...` |
| `MINIO_ENDPOINT_HOST` | MinIO 主机 | `minio` (Docker) / `localhost` |
| `MINIO_ENDPOINT_PORT` | MinIO 端口 | `9000` |
| `MINIO_USE_SSL` | 是否使用 SSL | `false` |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | 自定义强密码 |
| `MINIO_SECRET_KEY` | MinIO 密钥 | 自定义强密码 (≥8字符) |
| `MINIO_BUCKET` | 存储桶名称 | `pis-photos` |
| `REDIS_HOST` | Redis 主机 | `redis` (Docker) / `localhost` |
| `REDIS_PORT` | Redis 端口 | `6379` |

---

## 验证与测试

### 1. 检查 Docker 服务

```bash
# 查看服务状态
docker-compose ps

# 预期输出:
# NAME            STATUS
# pis-minio       Up (healthy)
# pis-redis       Up (healthy)
# pis-worker      Up

# MinIO 健康检查
curl http://localhost:9000/minio/health/live
# 预期: OK

# Redis 连接测试
docker exec pis-redis redis-cli ping
# 预期: PONG
```

### 2. 测试完整流程

1. 访问 `https://yourdomain.com/admin/login`
2. 使用管理员账号登录
3. 创建新相册
4. 上传测试图片
5. 观察 Worker 日志: `docker-compose logs -f worker`
6. 确认图片处理完成 (状态变为 completed)
7. 复制相册链接，在无痕模式测试访客访问

### 3. 性能检查

```bash
# Lighthouse 测试
npx lighthouse https://yourdomain.com --view

# 目标指标:
# - FCP < 1.5s
# - LCP < 2.5s
# - Score > 90
```

---

## 维护与运维

### 常用命令

```bash
# 查看日志
docker-compose logs -f [service]

# 重启服务
docker-compose restart [service]

# 更新 Worker 代码
docker-compose build worker
docker-compose up -d worker

# 清理未使用的镜像
docker system prune -a
```

### 数据备份

```bash
# 备份 MinIO 数据
docker run --rm \
  -v pis_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/minio-backup-$(date +%Y%m%d).tar.gz /data

# 恢复 MinIO 数据
docker run --rm \
  -v pis_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/minio-backup.tar.gz -C /

# Supabase 数据导出
# 在 Dashboard → Settings → Database → Backups
```

### 监控建议

- **Uptime Kuma**: 监控服务可用性
- **Grafana + Prometheus**: Docker 容器监控
- **Sentry**: 前端错误追踪

---

## 故障排除

### Worker 无法连接 MinIO

```bash
# 检查 Docker 网络
docker network ls
docker-compose exec worker ping minio

# 确认 MinIO 环境变量
docker-compose exec worker env | grep MINIO
```

### 图片无法显示

1. 检查 MinIO Bucket 是否存在且有权限
   ```bash
   docker exec pis-minio mc ls local/pis-photos
   ```
2. 检查 Nginx 反向代理日志
   ```bash
   tail -f /var/log/nginx/error.log
   ```
3. 确认 `NEXT_PUBLIC_MEDIA_URL` 配置正确

### Supabase 连接失败

1. 确认 API Keys 正确 (注意 anon vs service_role)
2. 检查 RLS 策略是否阻止访问
3. 查看 Supabase Dashboard → Logs

### 上传失败

1. 检查 Nginx `client_max_body_size` 配置
2. 确认 MinIO 凭证正确
3. 查看 Worker 日志:
   ```bash
   docker-compose logs -f worker
   ```

### 登录循环问题

1. 清除浏览器 Cookies (所有 `sb-` 开头的)
2. 确认 Supabase Auth URLs 配置正确
3. 检查 Middleware 日志

---

## 安全建议

### 必须做

- [ ] 修改默认 MinIO 密码
- [ ] 使用 HTTPS
- [ ] 服务端口只监听 127.0.0.1
- [ ] 定期备份数据
- [ ] 保护 `SUPABASE_SERVICE_ROLE_KEY`

### 建议做

- [ ] 配置防火墙规则
- [ ] 启用 Supabase MFA
- [ ] 设置日志轮转
- [ ] 配置监控告警

---

## 联系支持

如遇到问题，请:

1. 查看本文档的故障排除部分
2. 搜索 GitHub Issues
3. 提交新 Issue，附上:
   - 错误日志
   - 环境信息 (OS, Docker 版本)
   - 复现步骤
