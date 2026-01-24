#!/bin/bash

# ============================================
# PIS 服务检查和启动脚本
# 用途: 检查并启动缺失的 PIS 服务
# ============================================

SSH_HOST=${1:-"your-server-ip"}
SSH_USER=${SSH_USER:-"root"}

echo "🔍 PIS 服务检查和启动"
echo "===================="
echo "服务器: $SSH_USER@$SSH_HOST"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 检查当前服务状态
echo -e "${BLUE}1️⃣  检查当前服务状态${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
echo "PIS 相关容器:"
docker ps -a | grep -E "pis-|PIS" || echo "未找到 PIS 容器"
EOF

# 2. 检查 docker-compose.yml
echo ""
echo -e "${BLUE}2️⃣  检查 Docker Compose 配置${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
if [ -f "/opt/pis/docker/docker-compose.yml" ]; then
    echo "✅ docker-compose.yml 存在"
    echo ""
    echo "当前配置的服务:"
    grep -E "^  [a-z-]+:" /opt/pis/docker/docker-compose.yml | sed 's/://' | sed 's/^/  - /'
else
    echo "❌ docker-compose.yml 不存在"
    echo "路径: /opt/pis/docker/docker-compose.yml"
    echo ""
    echo "检查其他可能的位置:"
    find /opt -name "docker-compose.yml" 2>/dev/null | grep pis || echo "未找到"
fi
EOF

# 3. 检查环境变量
echo ""
echo -e "${BLUE}3️⃣  检查环境变量${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
if [ -f "/opt/pis/.env" ]; then
    echo "✅ .env 文件存在"
    echo ""
    echo "关键配置:"
    grep -E "^(SUPABASE_URL|MINIO_|REDIS_)" /opt/pis/.env | sed 's/=.*/=***/' || echo "未找到相关配置"
else
    echo "❌ .env 文件不存在"
    echo "路径: /opt/pis/.env"
fi
EOF

# 4. 检查端口占用
echo ""
echo -e "${BLUE}4️⃣  检查端口占用${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
echo "检查端口 19000, 19001, 16379:"
if command -v ss &> /dev/null; then
    ss -tuln | grep -E ":(19000|19001|16379) " || echo "端口可用"
else
    netstat -tuln | grep -E ":(19000|19001|16379) " || echo "端口可用"
fi
EOF

# 5. 检查目录结构
echo ""
echo -e "${BLUE}5️⃣  检查项目目录结构${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
if [ -d "/opt/pis" ]; then
    echo "✅ /opt/pis 目录存在"
    echo ""
    echo "目录结构:"
    ls -la /opt/pis/ | head -10
    echo ""
    if [ -d "/opt/pis/docker" ]; then
        echo "Docker 目录内容:"
        ls -la /opt/pis/docker/
    fi
else
    echo "❌ /opt/pis 目录不存在"
fi
EOF

echo ""
echo "===================="
echo -e "${GREEN}检查完成！${NC}"
echo ""
echo "💡 下一步操作:"
echo "  1. 如果 docker-compose.yml 不存在，需要上传"
echo "  2. 如果 .env 文件配置不完整，需要补充"
echo "  3. 启动服务: cd /opt/pis/docker && docker-compose up -d"
echo "  4. 更新 FRP 配置: 将 pis-media 的 localPort 改为 19000"
