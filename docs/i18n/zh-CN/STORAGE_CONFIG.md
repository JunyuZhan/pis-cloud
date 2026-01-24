# 存储配置指南

PIS 支持多种对象存储服务，包括 MinIO、阿里云 OSS、腾讯云 COS、AWS S3 等。

## 支持的存储类型

| 存储类型 | 说明 | 适用场景 |
|---------|------|---------|
| `minio` | MinIO 自建存储 | 私有部署、内网环境 |
| `oss` | 阿里云 OSS | 国内用户、阿里云生态 |
| `cos` | 腾讯云 COS | 国内用户、腾讯云生态 |
| `s3` | AWS S3 | 海外用户、AWS 生态 |

## 配置方式

### 1. MinIO（默认）

```bash
STORAGE_TYPE=minio
STORAGE_ENDPOINT=localhost
STORAGE_PORT=9000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=admin
STORAGE_SECRET_KEY=password123
STORAGE_BUCKET=pis-photos
STORAGE_PUBLIC_URL=https://media.yourdomain.com
```

**Docker 部署：**
```bash
# 使用 docker-compose.yml 中的 MinIO 服务
STORAGE_ENDPOINT=minio  # Docker 内部网络使用服务名
STORAGE_PORT=9000
```

### 2. 阿里云 OSS

```bash
STORAGE_TYPE=oss
STORAGE_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
STORAGE_REGION=cn-hangzhou
STORAGE_ACCESS_KEY=your-access-key-id
STORAGE_SECRET_KEY=your-access-key-secret
STORAGE_BUCKET=your-bucket-name
STORAGE_PUBLIC_URL=https://your-bucket-name.oss-cn-hangzhou.aliyuncs.com
STORAGE_USE_SSL=true
```

**获取凭证：**
1. 登录 [阿里云控制台](https://oss.console.aliyun.com/)
2. 创建 Bucket
3. 在 AccessKey 管理中创建 AccessKey
4. 配置 Bucket 的读写权限和 CORS

**区域代码：**
- `cn-hangzhou` - 华东1（杭州）
- `cn-shanghai` - 华东2（上海）
- `cn-beijing` - 华北2（北京）
- `cn-shenzhen` - 华南1（深圳）

### 3. 腾讯云 COS

```bash
STORAGE_TYPE=cos
STORAGE_ENDPOINT=cos.ap-guangzhou.myqcloud.com
STORAGE_REGION=ap-guangzhou
STORAGE_ACCESS_KEY=your-secret-id
STORAGE_SECRET_KEY=your-secret-key
STORAGE_BUCKET=your-bucket-name
STORAGE_PUBLIC_URL=https://your-bucket-name.cos.ap-guangzhou.myqcloud.com
STORAGE_USE_SSL=true
```

**获取凭证：**
1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/cos)
2. 创建存储桶
3. 在访问管理 -> API密钥管理中创建密钥
4. 配置存储桶的读写权限和跨域访问

**区域代码：**
- `ap-guangzhou` - 广州
- `ap-shanghai` - 上海
- `ap-beijing` - 北京
- `ap-chengdu` - 成都

### 4. AWS S3

```bash
STORAGE_TYPE=s3
STORAGE_ENDPOINT=s3.amazonaws.com
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=your-access-key-id
STORAGE_SECRET_KEY=your-secret-access-key
STORAGE_BUCKET=your-bucket-name
STORAGE_PUBLIC_URL=https://your-bucket-name.s3.amazonaws.com
STORAGE_USE_SSL=true
```

**获取凭证：**
1. 登录 [AWS 控制台](https://s3.console.aws.amazon.com/)
2. 创建 S3 Bucket
3. 在 IAM 中创建用户并分配 S3 权限
4. 创建 Access Key

## 前端配置

无论使用哪种存储，前端都需要配置 `NEXT_PUBLIC_MEDIA_URL`：

```bash
# 指向存储的公网访问地址（CDN 或直接访问）
NEXT_PUBLIC_MEDIA_URL=https://media.yourdomain.com/pis-photos
```

## 迁移存储

如果需要从一种存储迁移到另一种存储：

1. **备份数据**：使用各存储服务提供的工具导出数据
2. **更新配置**：修改 `STORAGE_TYPE` 和相关配置
3. **重新上传**：将备份的数据导入新存储
4. **更新数据库**：更新数据库中的文件路径（如果需要）

## 性能优化建议

1. **使用 CDN**：配置 `STORAGE_PUBLIC_URL` 指向 CDN 地址
2. **启用 HTTPS**：设置 `STORAGE_USE_SSL=true`
3. **配置缓存**：在 CDN 或 Nginx 中配置适当的缓存策略
4. **分片上传**：大文件使用分片上传功能

## 故障排除

### 连接失败

1. 检查网络连接和防火墙设置
2. 确认 `STORAGE_ENDPOINT` 和 `STORAGE_PORT` 正确
3. 验证 `STORAGE_ACCESS_KEY` 和 `STORAGE_SECRET_KEY` 有效

### 权限错误

1. 检查存储桶的访问权限配置
2. 确认 AccessKey 有足够的权限（读写、删除等）
3. 检查 CORS 配置（前端直接访问时）

### 文件无法访问

1. 确认 `STORAGE_PUBLIC_URL` 配置正确
2. 检查存储桶的公共访问策略
3. 验证 CDN 配置（如果使用）
