# FRP 内网穿透配置指南

## 📋 当前配置分析

根据你提供的 FRP 配置，需要更新 `pis-media` 代理的端口：

### 当前配置（需要修改）

```toml
# PIS 图片存储 API
[[proxies]]
name = "pis-media"
type = "http"
localIP = "127.0.0.1"
localPort = 9000  # ❌ 这是另一个应用的 MinIO 端口
customDomains = ["media.albertzhan.top"]
```

### 更新后的配置

```toml
# PIS 图片存储 API
[[proxies]]
name = "pis-media"
type = "http"
localIP = "127.0.0.1"
localPort = 19000  # ✅ PIS MinIO 的新端口
customDomains = ["media.albertzhan.top"]
```

## 🔧 完整 FRP 配置示例

```toml
# ============================================
# FRP 客户端配置 (frpc.ini)
# ============================================

[common]
serverAddr = "your-frp-server.com"
serverPort = 7000
token = "your-token"

# ============================================
# 其他应用服务
# ============================================

# MinIO 控制台（另一个应用）
[[proxies]]
name = "minio"
type = "http"
localIP = "127.0.0.1"
localPort = 9001
customDomains = ["minio.albertzhan.top"]

# Prometheus 监控（可选）
[[proxies]]
name = "prometheus"
type = "http"
localIP = "127.0.0.1"
localPort = 9090
customDomains = ["jk.albertzhan.top"]

# Grafana 监控面板（可选）
[[proxies]]
name = "grafana"
type = "http"
localIP = "127.0.0.1"
localPort = 3000
customDomains = ["ks.albertzhan.top"]

# ============================================
# PIS 系统服务
# ============================================

# PIS 图片存储 API（MinIO）
[[proxies]]
name = "pis-media"
type = "http"
localIP = "127.0.0.1"
localPort = 19000  # ✅ 使用新端口
customDomains = ["media.albertzhan.top"]

# PIS Worker API
[[proxies]]
name = "pis-worker"
type = "http"
localIP = "127.0.0.1"
localPort = 3001
customDomains = ["worker.albertzhan.top"]

# PIS MinIO Console（可选，如果需要外部访问控制台）
[[proxies]]
name = "pis-minio-console"
type = "http"
localIP = "127.0.0.1"
localPort = 19001
customDomains = ["pis-minio.albertzhan.top"]
```

## ✅ Vercel 环境变量配置

**不需要修改！** 因为域名 `media.albertzhan.top` 没有变化，只需要更新 FRP 配置即可。

Vercel 环境变量保持：

```
NEXT_PUBLIC_MEDIA_URL=https://media.albertzhan.top/pis-photos
```

## 🔄 更新步骤

### 1. 更新 FRP 配置

```bash
# SSH 到服务器
ssh root@192.168.50.10

# 编辑 FRP 配置文件（路径可能不同，根据实际情况）
nano /path/to/frpc.ini
# 或
nano /etc/frp/frpc.ini
```

修改 `pis-media` 的 `localPort` 从 `9000` 改为 `19000`

### 2. 重启 FRP 客户端

```bash
# 重启 FRP 客户端（根据你的部署方式）
systemctl restart frpc
# 或
docker restart frpc
# 或
supervisorctl restart frpc
```

### 3. 验证配置

```bash
# 检查端口监听
netstat -tuln | grep 19000
# 或
ss -tuln | grep 19000

# 测试外部访问
curl https://media.albertzhan.top/minio/health/live
# 预期: OK
```

### 4. 验证 Vercel 连接

访问 Vercel 部署的前端，测试图片加载是否正常。

## 📊 端口分配总结

| 服务 | 内部端口 | 外部端口 | FRP 域名 | 说明 |
|------|---------|---------|---------|------|
| **其他应用 MinIO** | 9000 | - | - | 另一个应用使用 |
| **其他应用 MinIO Console** | 9001 | - | minio.albertzhan.top | 另一个应用 |
| **PIS MinIO API** | 9000 (容器内) | **19000** (宿主机) | media.albertzhan.top | PIS 使用 |
| **PIS MinIO Console** | 9001 (容器内) | **19001** (宿主机) | - | 可选 |
| **PIS Worker API** | 3001 | **3001** | worker.albertzhan.top | PIS Worker |
| **Prometheus** | 9090 | - | jk.albertzhan.top | 监控 |
| **Grafana** | 3000 | - | ks.albertzhan.top | 监控 |

## 🔍 故障排查

### 问题 1: FRP 连接失败

```bash
# 检查 FRP 客户端状态
systemctl status frpc
# 或
docker logs frpc

# 检查端口是否监听
netstat -tuln | grep 19000
```

### 问题 2: 外部无法访问

1. 检查 FRP 服务端配置
2. 检查域名 DNS 解析
3. 检查防火墙规则

### 问题 3: 图片无法加载

1. 检查 Vercel 环境变量 `NEXT_PUBLIC_MEDIA_URL`
2. 检查 FRP 代理是否正常
3. 检查 MinIO 服务是否运行

```bash
# 在服务器上测试
curl http://localhost:19000/minio/health/live

# 通过 FRP 测试
curl https://media.albertzhan.top/minio/health/live
```

## 🎯 快速检查命令

```bash
# 1. 检查 PIS MinIO 是否运行
docker ps | grep pis-minio

# 2. 检查端口监听
netstat -tuln | grep 19000

# 3. 检查 FRP 状态
systemctl status frpc

# 4. 测试本地访问
curl http://localhost:19000/minio/health/live

# 5. 测试外部访问（通过 FRP）
curl https://media.albertzhan.top/minio/health/live
```
