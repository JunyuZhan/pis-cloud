#!/bin/bash

# ============================================
# PIS 更新配置并启动服务脚本
# ============================================

SSH_HOST=${1:-"your-server-ip"}
SSH_USER=${SSH_USER:-"root"}

echo "🚀 PIS 更新配置并启动服务"
echo "===================="
echo "服务器: $SSH_USER@$SSH_HOST"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 检查现有配置
echo -e "${BLUE}1️⃣  检查现有配置${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
echo "检查 docker-compose.yml 位置:"
if [ -f "/opt/pis/docker-compose.yml" ]; then
    echo "✅ 找到: /opt/pis/docker-compose.yml"
    echo ""
    echo "当前配置的端口:"
    grep -E "ports:|19000|19001|16379" /opt/pis/docker-compose.yml | head -10
elif [ -f "/opt/pis/docker/docker-compose.yml" ]; then
    echo "✅ 找到: /opt/pis/docker/docker-compose.yml"
else
    echo "❌ 未找到 docker-compose.yml"
fi
EOF

# 2. 备份现有配置
echo ""
echo -e "${BLUE}2️⃣  备份现有配置${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
if [ -f "/opt/pis/docker-compose.yml" ]; then
    cp /opt/pis/docker-compose.yml /opt/pis/docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份到: /opt/pis/docker-compose.yml.backup.*"
fi
EOF

# 3. 上传新配置
echo ""
echo -e "${BLUE}3️⃣  上传新配置${NC}"
echo "上传 docker-compose.yml..."
scp docker/docker-compose.yml $SSH_USER@$SSH_HOST:/opt/pis/docker-compose.yml

# 4. 检查并更新环境变量
echo ""
echo -e "${BLUE}4️⃣  检查环境变量${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
cd /opt/pis

# 检查必要的环境变量
echo "检查环境变量配置:"
if ! grep -q "^MINIO_ACCESS_KEY=" .env; then
    echo "添加 MinIO 配置..."
    echo "" >> .env
    echo "# MinIO 配置" >> .env
    echo "MINIO_ACCESS_KEY=minioadmin" >> .env
    echo "MINIO_SECRET_KEY=minioadmin" >> .env
fi

if ! grep -q "^MINIO_ENDPOINT_HOST=" .env; then
    echo "MINIO_ENDPOINT_HOST=minio" >> .env
fi

if ! grep -q "^MINIO_ENDPOINT_PORT=" .env; then
    echo "MINIO_ENDPOINT_PORT=9000" >> .env
fi

if ! grep -q "^REDIS_HOST=" .env; then
    echo "REDIS_HOST=redis" >> .env
fi

if ! grep -q "^REDIS_PORT=" .env; then
    echo "REDIS_PORT=6379" >> .env
fi

echo "✅ 环境变量检查完成"
EOF

# 5. 停止旧服务（如果存在）
echo ""
echo -e "${BLUE}5️⃣  停止旧服务${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
cd /opt/pis

# 停止可能存在的旧容器
docker stop pis-minio pis-redis pis-minio-init 2>/dev/null || true
docker rm pis-minio pis-redis pis-minio-init 2>/dev/null || true

echo "✅ 旧服务已清理"
EOF

# 6. 启动新服务
echo ""
echo -e "${BLUE}6️⃣  启动新服务${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
cd /opt/pis

echo "启动服务..."
docker-compose up -d

echo "等待服务启动..."
sleep 10

echo "检查服务状态:"
docker-compose ps
EOF

# 7. 验证服务
echo ""
echo -e "${BLUE}7️⃣  验证服务${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
cd /opt/pis

echo "健康检查:"
echo -n "MinIO: "
curl -s http://localhost:19000/minio/health/live || echo "❌"

echo -n "Redis: "
docker exec pis-redis redis-cli ping 2>/dev/null || echo "❌"

echo -n "Worker: "
curl -s http://localhost:3001/health || echo "❌"

echo ""
echo "端口监听状态:"
if command -v ss &> /dev/null; then
    ss -tuln | grep -E ":(19000|19001|16379|3001) "
else
    netstat -tuln | grep -E ":(19000|19001|16379|3001) "
fi
EOF

echo ""
echo "===================="
echo -e "${GREEN}配置更新完成！${NC}"
echo ""
echo "💡 下一步:"
echo "  1. 更新 FRP 配置: 将 pis-media 的 localPort 改为 19000"
echo "  2. 重启 FRP: systemctl restart frpc (或 docker restart frpc)"
echo "  3. 验证外部访问: curl \${NEXT_PUBLIC_MEDIA_URL:-https://media.example.com}/minio/health/live"
