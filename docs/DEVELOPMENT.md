# PIS 开发指南

## 目录

1. [开发环境搭建](#开发环境搭建)
2. [项目结构](#项目结构)
3. [开发流程](#开发流程)
4. [代码规范](#代码规范)
5. [调试技巧](#调试技巧)
6. [常见问题](#常见问题)

---

## 开发环境搭建

### 系统要求

| 软件 | 版本 | 安装命令 |
|------|------|----------|
| Node.js | >= 20.0.0 | [nvm](https://github.com/nvm-sh/nvm) 推荐 |
| pnpm | >= 9.0.0 | `npm install -g pnpm` |
| Docker | Latest | [官方安装](https://docs.docker.com/get-docker/) |
| Git | Latest | 系统自带或官方安装 |

### 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/your-username/pis.git
cd pis

# 2. 安装依赖
pnpm install

# 3. 启动基础服务 (MinIO + Redis)
cd docker
docker-compose up -d minio redis minio-init
cd ..

# 4. 配置环境变量
cp env.example apps/web/.env.local
cp env.example services/worker/.env
# 编辑这两个文件，填入 Supabase 凭据

# 5. 启动开发服务器
pnpm dev
```

### 环境变量配置

**apps/web/.env.local** (前端):

```bash
# Supabase - 从 Dashboard 获取
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 本地开发
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MEDIA_URL=http://localhost:9000/pis-photos
```

**services/worker/.env** (Worker):

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MinIO (Docker 本地)
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

---

## 项目结构

```
pis/
├── apps/
│   └── web/                      # Next.js 15 前端
│       ├── src/
│       │   ├── app/              # App Router 页面
│       │   │   ├── admin/        # 管理后台
│       │   │   ├── album/        # 访客相册页
│       │   │   ├── api/          # API Routes
│       │   │   └── page.tsx      # 首页
│       │   ├── components/       # React 组件
│       │   │   ├── admin/        # 后台组件
│       │   │   ├── album/        # 相册组件
│       │   │   └── ui/           # 通用 UI 组件
│       │   ├── hooks/            # 自定义 Hooks
│       │   ├── lib/              # 工具库
│       │   │   ├── supabase/     # Supabase 客户端
│       │   │   └── utils.ts      # 通用工具
│       │   ├── types/            # TypeScript 类型
│       │   └── middleware.ts     # Next.js 中间件
│       ├── public/               # 静态资源
│       ├── tailwind.config.ts    # Tailwind 配置
│       └── next.config.ts        # Next.js 配置
│
├── services/
│   └── worker/                   # 图片处理 Worker
│       └── src/
│           ├── index.ts          # BullMQ Worker 入口
│           ├── processor.ts      # Sharp 图片处理
│           └── lib/              # MinIO/Redis 客户端
│
├── database/
│   └── migrations/               # SQL 迁移脚本
│       └── 001_init.sql          # 初始化表结构
│
├── docker/
│   ├── docker-compose.yml        # Docker 编排
│   ├── worker.Dockerfile         # Worker 镜像
│   └── nginx/
│       └── media.conf            # Nginx 配置
│
├── docs/                         # 文档
│   ├── PRD.md                    # 产品需求文档
│   ├── DEPLOYMENT.md             # 部署指南
│   └── DEVELOPMENT.md            # 开发指南
│
├── env.example                   # 环境变量模板
├── package.json                  # 根 package.json
├── pnpm-workspace.yaml           # pnpm 工作区
└── turbo.json                    # Turborepo 配置
```

---

## 开发流程

### 启动服务

```bash
# 方式 1: 全部启动 (推荐)
pnpm dev

# 方式 2: 分别启动
# 终端 1 - 前端
cd apps/web && pnpm dev

# 终端 2 - Worker
cd services/worker && pnpm dev
```

### 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:3000 | Next.js 开发服务器 |
| 管理后台 | http://localhost:3000/admin | 需要登录 |
| MinIO Console | http://localhost:9001 | minioadmin/minioadmin |
| MinIO API | http://localhost:9000 | 图片存储 |

### 常用命令

```bash
# 开发
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产版本
pnpm lint             # 代码检查
pnpm format           # 格式化代码

# 数据库
pnpm db:types         # 生成 Supabase 类型

# Docker
cd docker
docker-compose up -d              # 启动所有服务
docker-compose up -d minio redis  # 只启动存储服务
docker-compose logs -f worker     # 查看 Worker 日志
docker-compose down               # 停止所有服务
```

---

## 代码规范

### TypeScript

- 使用 TypeScript 严格模式
- 所有组件和函数都要有类型声明
- 优先使用 `interface` 而非 `type`

```typescript
// ✅ Good
interface AlbumProps {
  id: string
  title: string
  photos: Photo[]
}

// ❌ Avoid
type AlbumProps = {
  id: string
  // ...
}
```

### React 组件

- 使用函数组件 + Hooks
- 文件名使用 kebab-case: `album-detail.tsx`
- 组件名使用 PascalCase: `AlbumDetail`
- 服务端组件默认，客户端组件加 `'use client'`

```tsx
// 服务端组件 (默认)
export default async function AlbumPage() {
  const data = await fetchData()
  return <div>{data}</div>
}

// 客户端组件
'use client'
export function AlbumClient() {
  const [state, setState] = useState()
  return <div>{state}</div>
}
```

### 文件组织

```
components/
├── admin/              # 后台专用组件
├── album/              # 相册相关组件
├── ui/                 # 通用 UI 组件
└── providers.tsx       # Context Providers
```

### CSS / Tailwind

- 使用 Tailwind CSS
- 复杂样式抽取为组件
- 使用 `cn()` 合并类名

```tsx
import { cn } from '@/lib/utils'

<div className={cn(
  'base-styles',
  isActive && 'active-styles',
  className
)} />
```

---

## 调试技巧

### 前端调试

```typescript
// 使用 console 分组
console.group('Album Loading')
console.log('ID:', id)
console.log('Data:', data)
console.groupEnd()

// React DevTools
// 安装浏览器扩展查看组件状态
```

### Worker 调试

```bash
# 查看实时日志
docker-compose logs -f worker

# 或本地运行时
cd services/worker
pnpm dev
# 日志会直接输出到终端
```

### Supabase 调试

1. 打开 Supabase Dashboard
2. 进入 **Logs** → **Edge Functions** / **API**
3. 查看请求和错误日志

### 网络调试

```bash
# 检查 MinIO 连接
curl http://localhost:9000/minio/health/live

# 检查 Redis 连接
docker exec pis-redis redis-cli ping

# 检查 API 响应
curl http://localhost:3000/api/admin/albums
```

---

## 常见问题

### Q: 图片上传后不显示？

1. 检查 Worker 是否运行:
   ```bash
   docker-compose logs worker
   ```
2. 检查 MinIO 中是否有文件:
   ```bash
   docker exec pis-minio mc ls local/pis-photos
   ```
3. 确认 `NEXT_PUBLIC_MEDIA_URL` 配置正确

### Q: 登录后一直跳转？

1. 清除浏览器 Cookies (F12 → Application → Cookies)
2. 删除所有 `sb-` 开头的 cookie
3. 重新登录

### Q: TypeScript 类型错误？

```bash
# 重新生成 Supabase 类型
pnpm db:types

# 或手动更新
cd apps/web
npx supabase gen types typescript --project-id your-project-id > src/types/database.ts
```

### Q: Docker 服务启动失败？

```bash
# 查看详细错误
docker-compose logs

# 重建镜像
docker-compose build --no-cache

# 清理并重启
docker-compose down -v
docker-compose up -d
```

### Q: 热更新不生效？

```bash
# 删除 .next 缓存
rm -rf apps/web/.next

# 重启开发服务器
pnpm dev
```

---

## 开发工具推荐

### VS Code 扩展

- **ESLint** - 代码检查
- **Prettier** - 代码格式化
- **Tailwind CSS IntelliSense** - Tailwind 提示
- **TypeScript Hero** - TS 辅助
- **Docker** - Docker 管理

### 浏览器扩展

- **React Developer Tools** - React 调试
- **Supabase DevTools** - Supabase 调试 (可选)

### 其他工具

- **TablePlus** / **pgAdmin** - 数据库管理
- **Postman** / **Insomnia** - API 测试
- **MinIO Client (mc)** - MinIO 命令行

---

## 提交规范

### Commit Message

```
<type>(<scope>): <subject>

<body>
```

**Type:**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

**示例:**
```
feat(album): add watermark configuration UI

- Add watermark type selection (text/logo)
- Add opacity and position controls
- Connect to API for saving settings
```

### 分支命名

- `main` - 生产分支
- `develop` - 开发分支
- `feature/xxx` - 功能分支
- `fix/xxx` - 修复分支
