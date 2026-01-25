# MinIO 局域网上传指南

本文档介绍如何在局域网中将图片上传到 MinIO，用于扫描同步功能。

## 📋 前置条件

1. **获取 MinIO 连接信息**
   - 内网地址：`192.168.50.10`（你的服务器 IP）
   - MinIO API 端口：`19000`（或通过 FRP 代理的公网地址）
   - MinIO Console 端口：`19001`
   - Access Key：查看服务器上的 `.env` 文件中的 `MINIO_ACCESS_KEY`
   - Secret Key：查看服务器上的 `.env` 文件中的 `MINIO_SECRET_KEY`
   - Bucket 名称：`pis-photos`（默认）

2. **获取相册 ID**
   - 在后台相册管理页面，URL 中的 `[id]` 就是相册 ID
   - 例如：`/admin/albums/550e8400-e29b-41d4-a716-446655440000`

---

## 方法一：MinIO Client (mc) - 推荐 ⭐

### 安装 MinIO Client

**macOS:**
```bash
brew install minio-mc
```

**Linux:**
```bash
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/
```

**Windows:**
下载：https://dl.min.io/client/mc/release/windows-amd64/mc.exe

### 配置连接

#### 方式 A：连接到内网 MinIO（局域网内）

```bash
# 配置别名（替换为你的实际 IP 和端口）
mc alias set pis http://192.168.50.10:19000 minioadmin minioadmin

# 测试连接
mc ls pis
```

#### 方式 B：连接到公网 MinIO（通过 FRP 代理）

```bash
# 如果 MinIO 通过 FRP 代理到公网（如 media.albertzhan.top）
mc alias set pis http://media.albertzhan.top minioadmin minioadmin

# 或使用 HTTPS（如果配置了 SSL）
mc alias set pis https://media.albertzhan.top minioadmin minioadmin
```

### 上传图片到扫描目录

```bash
# 1. 查看 bucket 结构
mc ls pis/pis-photos/

# 2. 创建相册扫描目录（如果不存在）
mc mb pis/pis-photos/sync/550e8400-e29b-41d4-a716-446655440000 --ignore-existing

# 3. 上传单个文件
mc cp /path/to/photo.jpg pis/pis-photos/sync/550e8400-e29b-41d4-a716-446655440000/

# 4. 批量上传目录中的所有图片
mc cp --recursive /path/to/photos/ pis/pis-photos/sync/550e8400-e29b-41d4-a716-446655440000/

# 5. 只上传图片文件（过滤其他文件）
find /path/to/photos -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.heic" -o -name "*.webp" \) -exec mc cp {} pis/pis-photos/sync/550e8400-e29b-41d4-a716-446655440000/ \;

# 6. 查看上传的文件
mc ls pis/pis-photos/sync/550e8400-e29b-41d4-a716-446655440000/
```

### 常用命令

```bash
# 查看文件列表
mc ls pis/pis-photos/sync/{album_id}/

# 删除文件
mc rm pis/pis-photos/sync/{album_id}/photo.jpg

# 删除目录（递归）
mc rm --recursive pis/pis-photos/sync/{album_id}/

# 同步本地目录到 MinIO（增量同步）
mc mirror --overwrite /local/photos/ pis/pis-photos/sync/{album_id}/

# 查看文件信息
mc stat pis/pis-photos/sync/{album_id}/photo.jpg
```

---

## 方法二：MinIO Console（Web 界面）

### 访问控制台

1. **内网访问**：`http://192.168.50.10:19001`
2. **公网访问**（如果配置了 FRP）：`http://minio-console.yourdomain.com`

### 登录

- Username: `minioadmin`（或你的 `MINIO_ACCESS_KEY`）
- Password: `minioadmin`（或你的 `MINIO_SECRET_KEY`）

### 上传步骤

1. 登录后，点击左侧 **Buckets** → 选择 `pis-photos`
2. 导航到 `sync/{album_id}/` 目录（如果不存在，点击 **Create Folder**）
3. 点击 **Upload** 按钮
4. 选择文件或拖拽文件上传
5. 等待上传完成

**注意**：Web 界面上传大文件可能较慢，建议使用命令行工具。

---

## 方法三：rclone（高级用户）

### 安装 rclone

```bash
# macOS
brew install rclone

# Linux
curl https://rclone.org/install.sh | sudo bash
```

### 配置

```bash
# 启动配置向导
rclone config

# 选择 "New remote"
# Name: pis
# Storage: s3 (MinIO 兼容 S3)
# Provider: MinIO
# Access Key ID: minioadmin
# Secret Access Key: minioadmin
# Endpoint: http://192.168.50.10:19000
# Region: us-east-1（任意）
```

### 上传

```bash
# 同步本地目录到 MinIO
rclone sync /local/photos/ pis:pis-photos/sync/{album_id}/

# 只同步图片文件
rclone sync /local/photos/ pis:pis-photos/sync/{album_id}/ \
  --include "*.jpg" --include "*.jpeg" --include "*.png" \
  --include "*.heic" --include "*.webp"

# 查看文件列表
rclone ls pis:pis-photos/sync/{album_id}/

# 复制单个文件
rclone copy /path/to/photo.jpg pis:pis-photos/sync/{album_id}/
```

---

## 方法四：S3 兼容客户端

### Cyberduck（macOS/Windows）

1. 下载：https://cyberduck.io/
2. 新建连接：
   - Protocol: **S3 (MinIO)**
   - Server: `192.168.50.10:19000`
   - Access Key ID: `minioadmin`
   - Secret Access Key: `minioadmin`
3. 连接后，导航到 `pis-photos/sync/{album_id}/`
4. 拖拽文件上传

### FileZilla Pro（支持 S3）

1. 下载 FileZilla Pro：https://filezilla-project.org/
2. 新建站点：
   - Protocol: **Amazon S3**
   - Host: `192.168.50.10`
   - Port: `19000`
   - Logon Type: **Normal**
   - User: `minioadmin`
   - Password: `minioadmin`
3. 连接后上传文件

---

## 🔍 扫描同步

上传完成后，在后台相册详情页点击 **「扫描同步」** 按钮，系统会自动：

1. 扫描 `sync/{album_id}/` 目录
2. 识别新图片（跳过已存在的）
3. 复制到 `raw/{album_id}/` 并重命名
4. 创建数据库记录
5. 加入处理队列（生成缩略图/预览图）

---

## 📝 完整示例

假设相册 ID 是 `550e8400-e29b-41d4-a716-446655440000`，服务器 IP 是 `192.168.50.10`：

```bash
# 1. 配置连接
mc alias set pis http://192.168.50.10:19000 minioadmin minioadmin

# 2. 创建扫描目录
mc mb pis/pis-photos/sync/550e8400-e29b-41d4-a716-446655440000 --ignore-existing

# 3. 上传图片（假设图片在 ~/Photos/event/ 目录）
mc cp --recursive ~/Photos/event/ pis/pis-photos/sync/550e8400-e29b-41d4-a716-446655440000/

# 4. 验证上传
mc ls pis/pis-photos/sync/550e8400-e29b-41d4-a716-446655440000/

# 5. 在后台点击「扫描同步」按钮
```

---

## ⚠️ 注意事项

1. **文件命名**：上传的文件名会保留，但系统会根据文件名去重
2. **文件大小**：单文件建议不超过 100MB
3. **文件格式**：只支持 `jpg`, `jpeg`, `png`, `heic`, `webp`
4. **目录结构**：必须上传到 `sync/{album_id}/` 目录，否则扫描不到
5. **权限**：确保有写入权限（使用正确的 Access Key/Secret Key）

---

## 🐛 故障排查

### 连接失败

```bash
# 检查网络连接
ping 192.168.50.10

# 检查端口是否开放
telnet 192.168.50.10 19000

# 检查防火墙
# Linux: sudo ufw status
# macOS: 系统偏好设置 -> 安全性与隐私 -> 防火墙
```

### 认证失败

```bash
# 检查 Access Key 和 Secret Key
# 在服务器上查看：cat /opt/pis/.env | grep MINIO

# 重新配置连接
mc alias remove pis
mc alias set pis http://192.168.50.10:19000 <正确的AccessKey> <正确的SecretKey>
```

### 上传失败

```bash
# 检查磁盘空间
mc admin info pis

# 检查 bucket 是否存在
mc ls pis/pis-photos/

# 检查目录权限
mc stat pis/pis-photos/sync/{album_id}/
```

---

## 📚 参考资源

- MinIO Client 文档：https://min.io/docs/minio/linux/reference/minio-mc.html
- rclone 文档：https://rclone.org/docs/
- S3 API 兼容性：https://min.io/docs/minio/linux/developers/minio-drivers.html
