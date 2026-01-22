# 安全最佳实践

> 本文档说明 PIS 系统的安全措施和部署建议

**最后更新**: 2026-01-24

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
- `database/migrations/003_album_features.sql` - 密码字段

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

### 部署前检查

- [ ] HTTPS 已配置并测试
- [ ] CORS 配置正确（不是 `*`）
- [ ] 环境变量已设置且足够复杂
- [ ] Nginx 速率限制已配置
- [ ] 数据库 RLS 策略已启用
- [ ] 密码使用 bcrypt 加密（新相册）
- [ ] MinIO 访问密钥已更换
- [ ] Supabase Service Role Key 已保护

### 运行时监控

- [ ] 监控异常上传行为
- [ ] 监控 API 错误率
- [ ] 监控磁盘使用情况
- [ ] 监控 Worker 队列积压
- [ ] 定期检查日志中的安全事件

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
