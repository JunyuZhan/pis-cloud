# 安全最佳实践

> 本文档说明 PIS 系统的安全措施和部署建议

**最后更新**: 2026-01-25

---

## 🔒 安全检查清单

### 部署前必检项目

- [ ] 运行安全检查脚本: `bash scripts/check-security.sh`
- [ ] 验证环境变量配置: `bash scripts/setup.sh` (选项 3)
- [ ] 确保 `.env.local` 不包含真实密钥
- [ ] 检查 `.gitignore` 正确配置敏感文件
- [ ] 生产环境启用 HTTPS
- [ ] 配置强密码和安全密钥
- [ ] 启用 Redis 密码认证
- [ ] 配置防火墙规则
- [ ] 设置备份策略

### 环境变量安全

**❌ 危险配置**:
```bash
# 不要在代码中硬编码真实密钥
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
STORAGE_ACCESS_KEY="minioadmin"  # 生产环境不要使用默认密钥
```

**✅ 安全配置**:
```bash
# 使用占位符或环境变量注入
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
STORAGE_ACCESS_KEY="${MINIO_ACCESS_KEY}"  # 从环境变量获取
```

---

## 🔒 已实施的安全措施

### 1. EXIF 隐私保护 ✅

**问题**: EXIF 数据可能包含 GPS 地理位置信息，泄露拍摄地点隐私。

**解决方案**:
- ✅ Worker 在处理图片时自动剥离所有 GPS 相关信息
- ✅ 只保留相机参数（光圈、快门、ISO 等）
- ✅ 移除所有包含 `gps`、`location` 的字段
- ✅ 移除 `GPSInfo`、`GPSVersionID` 等 GPS 相关字段

**代码位置**: `services/worker/src/processor.ts` - `sanitizeExif()` 方法

**效果**: 所有上传的照片都会自动清理敏感位置信息，保护用户隐私。

**测试方法**:
1. 上传一张包含 GPS 信息的照片
2. 检查数据库中的 `exif` 字段
3. 确认没有 GPS 相关字段

---

### 2. 上传速率限制 ✅

**问题**: 恶意用户可能通过大量并发上传耗尽服务器资源。

**解决方案**:
- ✅ 每个用户每分钟最多 20 次上传请求
- ✅ 基于用户 ID + IP 地址的速率限制
- ✅ 返回标准的 HTTP 429 状态码和重试时间

**代码位置**: 
- `apps/web/src/middleware-rate-limit.ts` - 速率限制工具
- `apps/web/src/app/api/admin/albums/[id]/upload/route.ts` - 上传 API

**限制规则**:
- 上传请求: 20 次/分钟/用户
- 文件大小: 100MB/文件
- 文件类型: 仅允许图片格式（JPEG, PNG, HEIC, WebP）

**生产环境建议**:
- 使用 Redis 实现分布式速率限制
- 在 Nginx 层配置更严格的限制
- 监控异常上传行为

---

### 3. 密码保护 ✅

**问题**: UUID 虽然难以猜测，但一旦泄露，任何人都能访问相册。

**解决方案**:
- ✅ 支持为相册设置访问密码
- ✅ 密码验证 API
- ✅ 密码验证失败返回 401 错误
- ✅ 相册 API 返回 `requires_password` 字段（不返回密码本身）

**代码位置**:
- `apps/web/src/app/api/public/albums/[slug]/verify-password/route.ts` - 密码验证
- `apps/web/src/app/api/public/albums/[slug]/route.ts` - 相册信息（不返回密码）
- `database/full_schema.sql` - 包含密码字段在内的完整数据库架构

**使用方式**:
1. 管理员在相册设置中设置密码
2. 访客访问相册时，API 返回 `requires_password: true`
3. 前端调用 `/api/public/albums/[slug]/verify-password` 验证密码
4. 密码验证通过后，可以正常浏览相册

**安全建议**:
- 当前使用明文存储（向后兼容）
- **生产环境建议**: 使用 bcrypt 加密存储密码
- 建议密码长度至少 6 位
- 定期更换密码
- 对高私密性相册必须设置密码

---

### 4. 访问控制

**已实施**:
- ✅ 相册过期时间控制
- ✅ 软删除机制（`deleted_at`）
- ✅ RLS (Row Level Security) 策略
- ✅ 公开/私有相册控制

**数据库安全**:
- ✅ 所有表启用 RLS
- ✅ 管理员使用 Service Role Key（绕过 RLS）
- ✅ 访客只能访问公开相册或通过密码验证的相册

---

## ⚠️ 需要配置的安全措施

### 1. HTTPS 配置

**必须**: 生产环境必须启用 HTTPS。

**Nginx 配置示例**:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
}
```

---

### 2. CORS 和安全头配置 ✅

**问题**: 如果 CORS 配置过宽，恶意网站可以嵌入你的图片。

**解决方案**:
- ✅ 限制 `Access-Control-Allow-Origin` 为你的域名（不是 `*`）
- ✅ 添加安全响应头（X-Content-Type-Options, X-Frame-Options 等）
- ✅ 限制权限策略（Permissions-Policy）

**代码位置**: `apps/web/next.config.ts` - `headers()` 配置

**已配置的安全头**:
- `Access-Control-Allow-Origin`: 限制为你的域名
- `X-Content-Type-Options: nosniff`: 防止 MIME 类型嗅探
- `X-Frame-Options: DENY`: 防止点击劫持
- `X-XSS-Protection: 1; mode=block`: XSS 保护
- `Referrer-Policy: strict-origin-when-cross-origin`: 控制 Referer 信息
- `Permissions-Policy`: 禁用摄像头、麦克风、地理位置

**MinIO CORS 配置**:
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://yourdomain.com"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

---

### 3. Nginx 速率限制

**建议**: 在 Nginx 层配置更严格的速率限制。

**配置文件**: `docker/nginx/rate-limit.conf` - 速率限制配置示例

**Nginx 配置示例**:
```nginx
# 定义速率限制区域
limit_req_zone $binary_remote_addr zone=upload_limit:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=global_limit:10m rate=100r/m;

server {
    # 上传接口限制
    location /api/admin/albums/[id]/upload {
        limit_req zone=upload_limit burst=5 nodelay;
        limit_req_status 429;
        proxy_pass http://nextjs:3000;
    }
    
    # API 接口限制
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        limit_req_status 429;
        proxy_pass http://nextjs:3000;
    }
    
    # 全局限制
    location / {
        limit_req zone=global_limit burst=50 nodelay;
        proxy_pass http://nextjs:3000;
    }
}
```

**说明**:
- `burst`: 允许突发请求数
- `nodelay`: 立即处理突发请求
- `limit_req_status 429`: 超过限制时返回 429 状态码

---

### 4. 环境变量安全

**必须保护的环境变量**:
- `SUPABASE_SERVICE_ROLE_KEY` - 拥有完全数据库权限
- `MINIO_SECRET_KEY` - MinIO 访问密钥
- `SUPABASE_URL` - Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - 虽然公开，但应限制使用

**安全建议**:
- ✅ 使用强密码（至少 32 位随机字符串）
- ✅ 定期轮换密钥
- ✅ 不要将 `.env` 文件提交到 Git
- ✅ 使用密钥管理服务（如 AWS Secrets Manager）

---

### 5. 文件大小限制

**当前限制**:
- 单文件: 100MB
- Worker 并发: 5 个任务
- Worker 速率: 10 任务/秒

**建议**:
- 根据服务器配置调整并发数
- 监控磁盘使用情况
- 设置自动清理策略（删除 30 天前的临时文件）

---

## 🛡️ 安全检查清单

### 🔐 环境变量安全

**必须配置**:
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - 已设置为强密码（至少 32 位随机字符串）
- [ ] `MINIO_SECRET_KEY` - 已设置为强密码（至少 32 位随机字符串）
- [ ] `MINIO_ACCESS_KEY` - 已设置为强密码
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] 生产环境使用密钥管理服务（如 AWS Secrets Manager）

**检查命令**:
```bash
# 检查环境变量是否泄露
grep -r "SUPABASE_SERVICE_ROLE_KEY\|MINIO_SECRET_KEY" .git/
# 应该没有输出
```

### 🔒 HTTPS 配置

**Nginx 配置**:
- [ ] SSL 证书已配置
- [ ] 强制 HTTPS 重定向
- [ ] TLS 版本 >= 1.2
- [ ] 禁用不安全的加密套件

**检查项**:
```nginx
# 必须配置
listen 443 ssl http2;
ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;
ssl_protocols TLSv1.2 TLSv1.3;

# 必须重定向 HTTP 到 HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

### 🛡️ CORS 配置

**Next.js 配置**:
- [ ] `Access-Control-Allow-Origin` 不是 `*`
- [ ] 限制为你的域名

**检查项** (`next.config.ts`):
```typescript
headers: [
  {
    key: 'Access-Control-Allow-Origin',
    value: 'https://yourdomain.com', // 不是 '*'
  },
]
```

**MinIO CORS 配置**:
- [ ] CORS 规则已设置
- [ ] 只允许你的域名

### ⚡ 速率限制

**Nginx 层限制**:
- [ ] 上传接口速率限制（建议：10 次/分钟）
- [ ] API 接口速率限制（建议：60 次/分钟）
- [ ] 全局速率限制（建议：100 次/分钟）

**应用层限制**:
- [x] 上传 API 已启用速率限制（✅ 已实现：20 次/分钟）
- [x] 登录 API 已启用速率限制（✅ 已实现：5 次/分钟/IP，防止撞库攻击）
- [ ] 其他敏感 API 已启用速率限制

### 🔐 登录安全 ✅

**已实施**:
- ✅ **服务端登录验证**：登录逻辑完全在服务端执行，客户端无法绕过
- ✅ **双重速率限制**：
  - 基于 IP：5 次/分钟（防止单 IP 暴力破解）
  - 基于邮箱：3 次/分钟（防止针对特定账户的攻击）
- ✅ **改进的 IP 提取**：支持 Cloudflare、代理服务器等多种场景
- ✅ **统一错误消息**：不暴露具体错误原因（防止用户枚举和信息泄露）
- ✅ **内存管理**：自动清理过期记录，防止内存泄漏和 DoS 攻击
- ✅ Supabase Auth 内置保护：Supabase 本身有速率限制（双重保护）

**代码位置**:
- `apps/web/src/app/api/auth/login/route.ts` - 服务端登录 API（包含速率限制和登录逻辑）
- `apps/web/src/app/admin/login/page.tsx` - 登录页面（只调用服务端 API）
- `apps/web/src/middleware-rate-limit.ts` - 速率限制工具（改进的内存管理）

**限制规则**:
- IP 速率限制: 5 次/分钟/IP
- 邮箱速率限制: 3 次/分钟/邮箱
- 超过限制后需要等待 1 分钟才能重试
- 返回 HTTP 429 状态码和 `Retry-After` 头

**安全特性**:
- ✅ 客户端无法绕过速率限制（登录逻辑在服务端）
- ✅ 统一错误消息（不泄露具体错误原因）
- ✅ 双重限制（IP + 邮箱）
- ✅ 自动内存清理（防止内存泄漏）

**详细审计报告**: 参见 `docs/LOGIN_SECURITY_AUDIT.md`

**已改进**:
- ✅ 邮箱格式验证：使用正则表达式验证邮箱格式
- ✅ 输入长度限制：限制邮箱（254字符）和密码（128字符）最大长度
- ✅ 登录尝试日志：记录所有登录尝试（成功/失败），用于安全审计

**可选增强**:
- ✅ **Cloudflare Turnstile**：已实现 Invisible 模式（可选，完全免费）
  - 完全后台验证，用户无感知
  - 防止自动化攻击和机器人
  - 配置方式：参见 `docs/TURNSTILE_SETUP.md`
  - 如果不配置，登录功能仍然正常工作（降级策略）

**生产环境建议**:
- [ ] 使用 Redis 实现分布式速率限制（多服务器部署时）
- [ ] 添加账户锁定机制（连续失败 5 次后锁定 15 分钟）
- [ ] 将登录日志发送到日志服务（如 Sentry, LogRocket）
- [ ] 监控异常登录行为（异地登录、异常时间等）
- [ ] 启用双因素认证（2FA）

**详细补充审计报告**: 参见 `docs/LOGIN_SECURITY_DEEP_AUDIT.md`

### 🔍 EXIF 隐私保护

- [ ] Worker 已更新到最新版本（包含 EXIF 清理功能）
- [ ] 测试上传照片，确认 GPS 信息已被移除

**测试方法**:
1. 上传一张包含 GPS 信息的照片
2. 检查数据库中的 `exif` 字段
3. 确认没有 `gps`、`GPSInfo` 等字段

### 🗄️ 数据库安全

**RLS 策略**:
- [ ] 所有表已启用 RLS
- [ ] RLS 策略已测试
- [ ] 匿名用户权限已限制

**检查命令** (Supabase SQL Editor):
```sql
-- 检查所有表的 RLS 状态
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- 应该所有表都是 true
```

**密码存储**:
- [x] 密码字段已添加（✅ 已实现）
- [x] 密码验证 API 已实现（✅ 已实现）
- [ ] 建议：使用 bcrypt 加密存储（可选，当前支持明文向后兼容）

### 📁 文件存储安全

**MinIO 配置**:
- [ ] MinIO 访问密钥已更换
- [ ] MinIO 使用 HTTPS
- [ ] Bucket 策略已配置
- [ ] 定期备份策略已设置

### 🔐 访问控制

**相册访问**:
- [ ] 密码保护功能已测试
- [ ] 过期时间功能已测试
- [ ] 软删除功能已测试

**管理员权限**:
- [ ] 只有认证用户才能访问管理后台
- [ ] Service Role Key 未泄露
- [ ] 管理员账户使用强密码

### 📊 监控和日志

**日志配置**:
- [ ] API 错误日志已配置
- [ ] Worker 处理日志已配置
- [ ] 异常行为监控已设置

**监控指标**:
- [ ] 磁盘使用率监控
- [ ] API 响应时间监控
- [ ] 错误率监控
- [ ] 异常上传行为告警

### 🚨 应急响应

**安全事件处理**:
- [ ] 安全事件响应流程已制定
- [ ] 密钥泄露处理流程已制定
- [ ] 数据泄露处理流程已制定

### ✅ 部署前最终检查

1. [ ] 所有环境变量已设置
2. [ ] HTTPS 已配置并测试
3. [ ] CORS 配置正确
4. [ ] 速率限制已配置
5. [ ] 数据库迁移已执行
6. [ ] RLS 策略已启用
7. [ ] 密码功能已测试
8. [ ] EXIF 清理功能已测试
9. [ ] 监控和日志已配置
10. [ ] 备份策略已设置

---

## 🔍 潜在风险与缓解措施

### 1. UUID 遍历风险

**风险**: UUID 虽然难以猜测，但一旦泄露，任何人都能访问。

**缓解措施**:
- ✅ 支持密码保护
- ✅ 支持过期时间
- ✅ 建议：对高私密性相册必须设置密码

**未来改进**:
- 考虑添加"申请访问"功能
- 考虑添加访问日志

---

### 2. DoS 攻击

**风险**: 恶意用户可能通过大量请求耗尽服务器资源。

**缓解措施**:
- ✅ 应用层速率限制
- ⚠️ 建议：Nginx 层速率限制
- ⚠️ 建议：使用 CDN 和 DDoS 防护

---

### 3. EXIF 隐私泄露

**风险**: GPS 信息可能泄露拍摄地点。

**缓解措施**:
- ✅ 自动剥离 GPS 信息
- ✅ 只保留相机参数

---

### 4. SSRF (Server-Side Request Forgery)

**风险**: 如果未来添加"从 URL 抓取图片"功能，可能被利用攻击内网。

**当前状态**: ✅ 无此功能，风险低

**未来建议**:
- 如果添加此功能，必须验证 URL 白名单
- 禁止访问内网 IP（127.0.0.1, 10.x.x.x, 192.168.x.x）
- 使用代理服务器隔离请求

---

### 5. SQL 注入

**风险**: 用户输入未正确转义可能导致 SQL 注入。

**缓解措施**:
- ✅ 使用 Supabase 客户端（自动转义）
- ✅ 使用参数化查询
- ✅ RLS 策略限制数据访问

---

## 📚 参考资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [MinIO Security](https://min.io/docs/minio/linux/operations/security.html)

---

**最后更新**: 2026-01-24

---

## 📋 开源前安全检查清单

在公开 GitHub 仓库之前，请完成以下检查：

### 1. 敏感文件检查

确认以下文件**未被 Git 跟踪**：

```bash
# 检查是否有敏感文件被 Git 跟踪
git ls-files | grep -E "\.env$|\.env\.local$|\.key$|\.pem$"
```

**预期结果：** 应该没有输出，表示这些文件未被跟踪。

**需要排除的文件：**
- ✅ `.env.local` - 应在 `.gitignore` 中
- ✅ `services/worker/.env` - 应在 `.gitignore` 中
- ✅ 所有密钥文件（`.key`, `.pem`, `.p12`）
- ✅ SSH 密钥文件

### 2. Git 历史检查

检查 Git 历史中是否有敏感文件：

```bash
# 检查 Git 历史中是否有敏感文件
git log --all --full-history --source -- .env.local services/worker/.env .env
```

**预期结果：** 应该没有输出，表示历史记录干净。

**如果发现敏感文件在历史中：**

```bash
# 使用 git-filter-repo（推荐）
pip install git-filter-repo
git filter-repo --path .env.local --path services/worker/.env --invert-paths

# ⚠️ 警告：这会重写 Git 历史，如果已推送到远程，需要强制推送
git push origin --force --all
```

### 3. 硬编码密钥检查

检查代码中是否有硬编码的密钥：

```bash
# 检查 JWT tokens
grep -r "eyJ[A-Za-z0-9_-]\{50,\}" --exclude-dir=node_modules --exclude-dir=.git .

# 检查 AWS keys
grep -r "AKIA[0-9A-Z]\{16\}" --exclude-dir=node_modules --exclude-dir=.git .

# 检查其他常见密钥格式
grep -ri "password.*=.*['\"][^'\"]\{8,\}" --exclude-dir=node_modules --exclude-dir=.git .
```

**预期结果：** 应该没有输出，或只有 `.env.example` 中的占位符。

### 4. 环境变量示例文件检查

确认 `.env.example` 只包含占位符：

```bash
# 检查 .env.example 文件
cat .env.example | grep -E "(your-|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.\.\.)"
```

**预期结果：** 所有值都应该是占位符（`your-...`, `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`）

### 5. .gitignore 配置检查

确认 `.gitignore` 包含以下规则：

```gitignore
# Environment files
.env
.env.local
.env.*.local
!.env.example

# Keys and certificates
*.key
*.pem
*.p12
*.p8
id_rsa
id_rsa.pub
```

### 🔍 自动化安全检查

使用项目提供的安全检查脚本：

```bash
# 运行安全检查
bash scripts/check-security.sh
```

脚本会检查：
1. 敏感文件是否被 Git 跟踪
2. Git 历史中是否有敏感文件
3. 是否有硬编码的 JWT tokens
4. 是否有 AWS Access Keys
5. 是否有硬编码的密码
6. `.env.example` 是否只包含占位符
7. `.gitignore` 是否正确配置

**预期输出：**
```
✅ 安全检查通过！可以安全地公开仓库。
```

### ⚠️ 如果密钥已泄露

如果发现密钥已经被提交到公开仓库：

1. **立即撤销所有密钥**
   - **Supabase**: 登录 Dashboard → Settings → API → 重新生成 Service Role Key
   - **Vercel**: 登录 Dashboard → Settings → Tokens → 删除泄露的 token → 生成新的 token
   - **OSS/COS/S3**: 登录控制台 → 重新生成所有 Access Key

2. **从 Git 历史中删除**
   ```bash
   # 使用 git-filter-repo
   pip install git-filter-repo
   git filter-repo --path .env.local --path services/worker/.env --invert-paths
   git push origin --force --all
   ```

3. **更新本地配置**
   更新所有 `.env` 文件中的密钥。

### 📋 公开仓库前的最终检查清单

- [ ] 确认 `.env.local` 未被 Git 跟踪
- [ ] 确认 `services/worker/.env` 未被 Git 跟踪
- [ ] 确认 Git 历史中没有敏感文件
- [ ] 确认代码中没有硬编码的密钥
- [ ] 确认 `.env.example` 只包含占位符
- [ ] 确认文档中的示例都是占位符
- [ ] 确认 `.gitignore` 正确配置
- [ ] 已运行 `scripts/check-security.sh` 并通过
- [ ] 如果密钥已泄露，已重新生成所有密钥
- [ ] 已测试使用 `.env.example` 可以正常配置项目

### 🚀 公开仓库步骤

1. **运行安全检查**
   ```bash
   bash scripts/check-security.sh
   ```

2. **确认检查通过**
   - 应该看到 "✅ 安全检查通过！可以安全地公开仓库。"

3. **提交代码**
   ```bash
   git add .
   git commit -m "chore: prepare for open source release"
   ```

4. **推送到 GitHub**
   ```bash
   git push origin main
   ```

5. **在 GitHub 上设置为公开**
   - Settings → Change repository visibility → Make public

---
