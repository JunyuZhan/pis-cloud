#!/bin/bash

# ============================================
# MinIO 上传配置脚本
# 用途：快速配置 MinIO Client 连接
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}MinIO 上传配置脚本${NC}"
echo "================================"
echo ""

# 检查是否安装了 mc
if ! command -v mc &> /dev/null; then
    echo -e "${YELLOW}未检测到 MinIO Client (mc)${NC}"
    echo ""
    echo "请先安装："
    echo "  macOS:   brew install minio-mc"
    echo "  Linux:   wget https://dl.min.io/client/mc/release/linux-amd64/mc && chmod +x mc && sudo mv mc /usr/local/bin/"
    echo "  Windows: https://dl.min.io/client/mc/release/windows-amd64/mc.exe"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ MinIO Client 已安装${NC}"
echo ""

# 读取配置
read -p "MinIO 服务器地址 (默认: 192.168.50.10): " MINIO_HOST
MINIO_HOST=${MINIO_HOST:-192.168.50.10}

read -p "MinIO API 端口 (默认: 19000): " MINIO_PORT
MINIO_PORT=${MINIO_PORT:-19000}

read -p "使用 HTTPS? (y/N): " USE_HTTPS
USE_HTTPS=${USE_HTTPS:-n}

read -p "Access Key (默认: minioadmin): " ACCESS_KEY
ACCESS_KEY=${ACCESS_KEY:-minioadmin}

read -sp "Secret Key (默认: minioadmin): " SECRET_KEY
SECRET_KEY=${SECRET_KEY:-minioadmin}
echo ""

# 构建 URL
if [[ "$USE_HTTPS" =~ ^[Yy]$ ]]; then
    PROTOCOL="https"
else
    PROTOCOL="http"
fi

MINIO_URL="${PROTOCOL}://${MINIO_HOST}:${MINIO_PORT}"

echo ""
echo "配置信息："
echo "  URL: ${MINIO_URL}"
echo "  Access Key: ${ACCESS_KEY}"
echo "  Secret Key: ${SECRET_KEY:0:4}****"
echo ""

read -p "确认配置? (Y/n): " CONFIRM
if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
    echo "已取消"
    exit 0
fi

# 配置别名
echo ""
echo "正在配置 MinIO 连接..."
mc alias set pis "${MINIO_URL}" "${ACCESS_KEY}" "${SECRET_KEY}" 2>/dev/null || {
    echo -e "${RED}✗ 配置失败，请检查连接信息${NC}"
    exit 1
}

echo -e "${GREEN}✓ 配置成功${NC}"
echo ""

# 测试连接
echo "正在测试连接..."
if mc ls pis &> /dev/null; then
    echo -e "${GREEN}✓ 连接成功${NC}"
    echo ""
    echo "可用的 bucket:"
    mc ls pis | head -5
    echo ""
    echo "使用示例："
    echo "  # 查看 bucket 内容"
    echo "  mc ls pis/pis-photos/"
    echo ""
    echo "  # 上传文件到扫描目录"
    echo "  mc cp photo.jpg pis/pis-photos/sync/{album_id}/"
    echo ""
    echo "  # 批量上传"
    echo "  mc cp --recursive ./photos/ pis/pis-photos/sync/{album_id}/"
else
    echo -e "${RED}✗ 连接失败，请检查网络和配置${NC}"
    exit 1
fi
