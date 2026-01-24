# PIS 开发指南

## 目录

1. [开发环境搭建](#开发环境搭建)
2. [项目结构](#项目结构)
3. [开发流程](#开发流程)
4. [新功能说明](#新功能说明)
5. [代码规范](#代码规范)
6. [调试技巧](#调试技巧)
7. [常见问题](#常见问题)
8. [新功能使用指南](#新功能使用指南)

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
│       │   │   │   ├── (dashboard)/  # 仪表板布局
│       │   │   │   │   ├── albums/   # 相册管理
│       │   │   │   │   └── settings/ # 系统设置（含模板管理）
│       │   │   ├── album/        # 访客相册页
│       │   │   ├── api/          # API Routes
│       │   │   │   ├── admin/    # 管理端 API
│       │   │   │   │   ├── albums/      # 相册 API
│       │   │   │   │   │   └── batch/   # 批量操作
│       │   │   │   │   └── templates/   # 模板 API
│       │   │   │   └── public/   # 公开 API
│       │   │   └── page.tsx      # 首页
│       │   ├── components/       # React 组件
│       │   │   ├── admin/        # 后台组件
│       │   │   │   ├── album-list.tsx        # 相册列表
│       │   │   │   ├── album-detail-client.tsx # 相册详情
│       │   │   │   ├── create-album-dialog.tsx # 创建相册对话框
│       │   │   │   ├── template-manager.tsx   # 模板管理
│       │   │   │   └── change-password-form.tsx # 修改密码
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
│       ├── 001_init.sql          # 初始化表结构
│       ├── 002_secure_rls.sql    # RLS 安全修复
│       ├── 003_album_features.sql # 相册高级功能
│       └── 004_album_templates.sql # 相册模板功能
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

## 新功能说明

### 相册模板功能

相册模板功能允许管理员创建可复用的相册配置模板，在创建新相册时快速应用预设的配置。

#### 数据库迁移

运行以下迁移文件以启用模板功能：

```bash
# 在 Supabase Dashboard 的 SQL Editor 中执行
database/migrations/004_album_templates.sql
```

#### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/templates` | 获取所有模板列表 |
| POST | `/api/admin/templates` | 创建新模板 |
| GET | `/api/admin/templates/[id]` | 获取模板详情 |
| PATCH | `/api/admin/templates/[id]` | 更新模板 |
| DELETE | `/api/admin/templates/[id]` | 删除模板 |

#### 使用方式

1. **创建模板**：
   - 进入管理后台 → 系统设置 → 相册模板
   - 点击"新建模板"
   - 输入模板名称和描述（详细配置可在相册设置页面保存）

2. **使用模板创建相册**：
   - 在相册列表页面点击"新建相册"
   - 在创建对话框中选择模板
   - 模板的配置（布局、水印、访问控制等）会自动应用到新相册

3. **从相册保存模板**：
   - 在相册设置页面配置好所有选项
   - 点击"保存为模板"（功能待实现）

#### 代码位置

- 数据库表：`album_templates`
- API 路由：`apps/web/src/app/api/admin/templates/`
- UI 组件：`apps/web/src/components/admin/template-manager.tsx`
- 类型定义：`apps/web/src/types/database.ts` (AlbumTemplate)

---

### 相册批量管理

支持在相册列表页面批量选择和操作多个相册。

#### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| DELETE | `/api/admin/albums/batch` | 批量删除相册 |
| PATCH | `/api/admin/albums/batch` | 批量更新相册设置 |

#### 使用方式

1. **批量删除**：
   - 在相册列表页面点击"批量管理"
   - 选择要删除的相册（可多选）
   - 点击"删除"按钮
   - 确认后批量删除选中的相册

2. **批量更新**（API 已实现，UI 待完善）：
   - 支持批量更新 `is_public`、`layout`、`sort_rule` 等字段
   - 通过 API 调用实现

#### 代码位置

- API 路由：`apps/web/src/app/api/admin/albums/batch/route.ts`
- UI 组件：`apps/web/src/components/admin/album-list.tsx`

---

### 照片批量管理增强

在相册详情页面增强照片批量操作功能。

#### 新增功能

1. **批量设置封面**：
   - 在批量选择模式下，当只选择一张照片时
   - 显示"设为封面"按钮
   - 快速将选中的照片设置为相册封面

2. **批量删除**（已存在）：
   - 选择多张照片后可以批量删除

#### 使用方式

1. **设置封面**：
   - 进入相册详情页面
   - 点击"选择"按钮进入批量选择模式
   - 选择一张照片
   - 点击"设为封面"按钮

2. **批量删除**：
   - 在批量选择模式下选择多张照片
   - 点击"删除"按钮
   - 确认后批量删除

#### 代码位置

- UI 组件：`apps/web/src/components/admin/album-detail-client.tsx`
- API 端点：`/api/admin/albums/[id]/photos` (DELETE)

---

### 相册活动元数据

支持为相册添加活动时间和地点信息，方便访客了解活动详情。

#### 数据库迁移

运行以下迁移文件以启用活动元数据功能：

```bash
# 在 Supabase Dashboard 的 SQL Editor 中执行
database/migrations/008_album_event_metadata.sql
```

#### 新增字段

- `event_date` (TIMESTAMPTZ): 活动时间（实际活动日期，区别于相册创建时间）
- `location` (TEXT): 活动地点

#### 使用方式

1. **创建相册时设置**：
   - 在创建相册对话框中填写"活动时间"和"活动地点"
   - 活动时间为可选，支持日期时间选择器
   - 活动地点为可选文本输入

2. **编辑相册设置**：
   - 在相册设置页面的"基本信息"部分
   - 可以修改活动时间和地点
   - 保存后立即生效

3. **访客查看**：
   - 在相册封面 Hero 区域显示活动时间和地点
   - 如果设置了活动时间，优先显示活动时间而非创建时间
   - 地点信息以图标形式展示

#### 代码位置

- 数据库迁移：`database/migrations/008_album_event_metadata.sql`
- 类型定义：`apps/web/src/types/database.ts` (albums 表)
- 创建表单：`apps/web/src/components/admin/create-album-dialog.tsx`
- 设置表单：`apps/web/src/components/admin/album-settings-form.tsx`
- 展示组件：`apps/web/src/components/album/album-hero.tsx`
- 列表展示：`apps/web/src/components/admin/album-list.tsx`
- API 路由：`apps/web/src/app/api/admin/albums/route.ts` (POST)

---

### 照片和相册删除功能

支持删除单张照片和单个相册，提供更灵活的内容管理。

#### 照片删除

**功能说明**：
- 支持在相册详情页删除单张照片
- 支持批量删除多张照片（已有功能）
- 删除操作不可恢复，需确认

**使用方式**：
1. **单张删除**：
   - 在相册详情页，鼠标悬停在照片上
   - 点击照片底部的"删除"按钮
   - 确认后删除该照片

2. **批量删除**：
   - 点击"批量管理"按钮
   - 选择要删除的照片
   - 点击"删除选中照片"按钮
   - 确认后批量删除

**API 端点**：
- `DELETE /api/admin/albums/[id]/photos` - 批量删除照片

**代码位置**：
- UI 组件：`apps/web/src/components/admin/album-detail-client.tsx`
- API 路由：`apps/web/src/app/api/admin/albums/[id]/photos/route.ts`

#### 相册删除

**功能说明**：
- 支持在相册列表页删除单个相册
- 支持批量删除多个相册（已有功能）
- 删除为软删除（设置 `deleted_at` 字段）

**使用方式**：
1. **单张删除**：
   - 在相册列表页，鼠标悬停在相册卡片上
   - 点击右上角的删除按钮（垃圾桶图标）
   - 确认后删除该相册

2. **批量删除**：
   - 点击"批量管理"按钮
   - 选择要删除的相册
   - 点击"删除"按钮
   - 确认后批量删除

**API 端点**：
- `DELETE /api/admin/albums/[id]` - 删除单个相册（软删除）
- `DELETE /api/admin/albums/batch` - 批量删除相册

**代码位置**：
- UI 组件：`apps/web/src/components/admin/album-list.tsx`
- API 路由：`apps/web/src/app/api/admin/albums/[id]/route.ts`

**注意事项**：
- 删除相册会同时删除相册中的所有照片
- 删除操作会设置 `deleted_at` 字段，数据不会物理删除
- 已删除的相册不会在列表中显示

---

### 照片查看客户端错误修复

修复了访客相册页面中照片分组筛选器的客户端错误。

#### 问题描述

在服务端组件中使用了 `window.location.href`，导致客户端渲染错误。

#### 修复方案

将分组筛选器的导航逻辑移到客户端组件中，使用 Next.js 的 `useRouter` 和 `useSearchParams` 处理 URL 参数更新。

#### 代码变更

- 文件：`apps/web/src/components/album/photo-group-filter.tsx`
- 变更：添加 `useRouter` 和 `useSearchParams` hooks，实现客户端导航
- 文件：`apps/web/src/app/album/[slug]/page.tsx`
- 变更：移除服务端组件中的 `window` 对象使用

#### 影响范围

- ✅ 修复了照片查看页面的客户端错误
- ✅ 分组筛选功能正常工作
- ✅ URL 参数更新正常

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

### Q: 模板功能无法使用？

1. **确认数据库迁移已执行**：
   ```sql
   -- 在 Supabase Dashboard 中检查表是否存在
   SELECT * FROM album_templates LIMIT 1;
   ```

2. **检查 RLS 策略**：
   - 确保 `album_templates` 表有正确的 RLS 策略
   - 迁移文件 `004_album_templates.sql` 已包含策略设置

3. **检查 API 权限**：
   - 确保已登录管理员账户
   - API 路由需要认证用户才能访问

### Q: 批量操作失败？

1. **检查选择数量限制**：
   - 批量删除相册：最多 50 个
   - 批量删除照片：最多 100 张

2. **查看浏览器控制台**：
   - 检查是否有错误信息
   - 确认 API 请求是否成功

3. **检查网络请求**：
   ```bash
   # 使用浏览器开发者工具 Network 标签
   # 查看 API 请求的响应状态和错误信息
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

## 新功能使用指南

本文档已包含以下功能的详细说明：

- 📦 打包下载功能详细使用方法（见上文）
- 🎨 多位置水印配置指南（见"水印功能逻辑"章节）
- 📱 微信分享优化设置（见"新功能说明"章节）
- 📋 相册复制功能说明（见"新功能说明"章节）
- 🎯 相册模板管理（见"新功能说明"章节）
- 📅 相册活动元数据（活动时间、地点）（见"新功能说明"章节）
- 🗑️ 照片和相册删除功能（见"新功能说明"章节）
- 🔄 批量操作技巧（见"新功能说明"章节）
- ❓ 常见问题解答（见"常见问题"章节）

**最后更新**: 2026-01-24

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

**新功能提交示例:**
```
feat(templates): add album template management

- Add album_templates table migration
- Create template CRUD API endpoints
- Add template manager UI in settings page
- Support template selection when creating albums

feat(albums): add batch management

- Add batch delete API for albums
- Implement batch selection UI in album list
- Support selecting multiple albums for deletion

feat(photos): enhance batch operations

- Add quick set cover button in batch mode
- Improve batch selection UX
- Support single photo cover setting
```

### 分支命名

- `main` - 生产分支
- `develop` - 开发分支
- `feature/xxx` - 功能分支
- `fix/xxx` - 修复分支

---

## 按钮风格指南

### 使用 Button 组件（推荐）

```tsx
import { Button } from '@/components/ui/button'

<Button variant="primary" size="md" isLoading={loading}>
  提交
</Button>
```

### 使用 CSS 类（兼容现有代码）

```tsx
<button className="btn-primary" type="button">
  提交
</button>
```

### 按钮变体

- **Primary（主要操作）**: 金色背景，用于提交、确认、创建
- **Secondary（次要操作）**: 浅色背景，边框，用于取消、返回
- **Ghost（幽灵按钮）**: 透明背景，用于编辑、设置
- **Danger（危险操作）**: 红色背景，用于删除、永久删除

### 按钮尺寸

- **Small (sm)**: 36px 高度，用于紧凑空间
- **Medium (md)**: 44px 高度（默认，移动端标准触摸目标）
- **Large (lg)**: 48px 高度，用于主要 CTA

### 必需属性

**所有按钮都必须设置 `type="button"`**，除非是表单提交按钮。

对于图标按钮，必须提供无障碍标签：
```tsx
<button type="button" aria-label="删除" onClick={handleDelete}>
  <Trash2 className="w-4 h-4" />
</button>
```

### 移动端优化

- 最小触摸目标：44px × 44px（Apple HIG 推荐）
- 所有按钮默认 `min-h-[44px]`

---

## 水印功能逻辑

### 核心原则

**水印配置变更后，只对新上传的照片生效，已上传的照片不会被重新处理。**

### 工作原理

1. **照片上传流程**:
   ```
   用户上传照片 → 保存到 MinIO（原图） → 创建照片记录（status: 'pending'）
   → Worker 处理任务触发 → Worker 读取相册当前水印配置
   → 应用水印到预览图（如果启用） → 生成缩略图和预览图
   → 更新照片状态（status: 'completed'）
   ```

2. **水印配置变更**:
   - 管理员修改相册水印设置
   - 更新相册的 `watermark_config`
   - ✅ 只影响之后上传的新照片
   - ❌ 不会重新处理已上传的照片

### 为什么不能重新处理已上传的照片？

1. **数据库状态冲突**: 可能导致状态不一致和约束错误
2. **性能问题**: 重新处理大量照片会消耗大量资源，阻塞 Worker 队列
3. **数据一致性**: 已上传的照片可能已被用户查看，重新处理会改变预览图

### 打包下载的特殊处理

打包下载时：
- **如果预览图存在**: 直接使用预览图（已处理过水印）
- **如果预览图不存在**: 临时处理添加水印（仅用于下载，不更新数据库）

### 正确的工作流程

**场景1：上传照片前设置水印**
1. 管理员设置相册水印配置
2. 用户上传照片
3. Worker 读取当前水印配置
4. ✅ 照片处理时应用水印

**场景2：上传照片后设置水印**
1. 用户上传照片（无水印）
2. 照片处理完成（status: 'completed'）
3. 管理员设置相册水印配置
4. ✅ 已上传的照片保持不变（无水印）
5. ✅ 之后上传的新照片会应用水印

**场景3：修改水印配置**
1. 相册已有水印配置
2. 已上传的照片已应用旧水印
3. 管理员修改水印配置
4. ✅ 已上传的照片保持旧水印
5. ✅ 之后上传的新照片会应用新水印

### 代码位置

- Worker 处理逻辑: `services/worker/src/index.ts`
- API 更新逻辑: `apps/web/src/app/api/admin/albums/[id]/route.ts`
- 打包下载处理: `services/worker/src/package-creator.ts`

**最后更新**: 2026-01-24
