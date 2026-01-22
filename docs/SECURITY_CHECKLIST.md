# 安全部署检查清单

> 生产环境部署前必须完成的安全检查

**最后更新**: 2026-01-24

---

## 🔐 环境变量安全

### 必须配置

- [ ] `SUPABASE_SERVICE_ROLE_KEY` - 已设置为强密码（至少 32 位随机字符串）
- [ ] `MINIO_SECRET_KEY` - 已设置为强密码（至少 32 位随机字符串）
- [ ] `MINIO_ACCESS_KEY` - 已设置为强密码
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] 生产环境使用密钥管理服务（如 AWS Secrets Manager）

### 检查命令

```bash
# 检查环境变量是否泄露
grep -r "SUPABASE_SERVICE_ROLE_KEY\|MINIO_SECRET_KEY" .git/
# 应该没有输出
```

---

## 🔒 HTTPS 配置

### Nginx 配置

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

---

## 🛡️ CORS 配置

### Next.js 配置

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

### MinIO CORS 配置

- [ ] CORS 规则已设置
- [ ] 只允许你的域名

**配置命令**:
```bash
mc cors set download pis-photos --config-dir ~/.mc
```

---

## ⚡ 速率限制

### Nginx 层限制

- [ ] 上传接口速率限制（建议：10 次/分钟）
- [ ] API 接口速率限制（建议：60 次/分钟）
- [ ] 全局速率限制（建议：100 次/分钟）

**配置示例**:
```nginx
limit_req_zone $binary_remote_addr zone=upload_limit:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=60r/m;

location /api/admin/albums/[id]/upload {
    limit_req zone=upload_limit burst=5 nodelay;
}
```

### 应用层限制

- [ ] 上传 API 已启用速率限制（✅ 已实现：20 次/分钟）
- [ ] 其他敏感 API 已启用速率限制

---

## 🔍 EXIF 隐私保护

- [ ] Worker 已更新到最新版本（包含 EXIF 清理功能）
- [ ] 测试上传照片，确认 GPS 信息已被移除

**测试方法**:
1. 上传一张包含 GPS 信息的照片
2. 检查数据库中的 `exif` 字段
3. 确认没有 `gps`、`GPSInfo` 等字段

---

## 🗄️ 数据库安全

### RLS 策略

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

### 密码存储

- [ ] 密码字段已添加（✅ 已实现）
- [ ] 密码验证 API 已实现（✅ 已实现）
- [ ] 建议：使用 bcrypt 加密存储（可选，当前支持明文向后兼容）

---

## 📁 文件存储安全

### MinIO 配置

- [ ] MinIO 访问密钥已更换
- [ ] MinIO 使用 HTTPS
- [ ] Bucket 策略已配置
- [ ] 定期备份策略已设置

---

## 🔐 访问控制

### 相册访问

- [ ] 密码保护功能已测试
- [ ] 过期时间功能已测试
- [ ] 软删除功能已测试

### 管理员权限

- [ ] 只有认证用户才能访问管理后台
- [ ] Service Role Key 未泄露
- [ ] 管理员账户使用强密码

---

## 📊 监控和日志

### 日志配置

- [ ] API 错误日志已配置
- [ ] Worker 处理日志已配置
- [ ] 异常行为监控已设置

### 监控指标

- [ ] 磁盘使用率监控
- [ ] API 响应时间监控
- [ ] 错误率监控
- [ ] 异常上传行为告警

---

## 🚨 应急响应

### 安全事件处理

- [ ] 安全事件响应流程已制定
- [ ] 密钥泄露处理流程已制定
- [ ] 数据泄露处理流程已制定

---

## ✅ 部署前最终检查

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

## 📚 相关文档

- [安全最佳实践](./SECURITY.md) - 详细的安全措施说明
- [部署指南](./DEPLOYMENT.md) - 部署步骤和配置
- [开发文档](./DEVELOPMENT.md) - 开发环境配置

---

**最后更新**: 2026-01-24
