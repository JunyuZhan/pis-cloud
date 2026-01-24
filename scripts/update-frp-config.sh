#!/bin/bash

# ============================================
# FRP 配置更新脚本
# 用途: 更新 FRP 配置，将 PIS MinIO 端口改为 19000
# ============================================

SSH_HOST=${1:-"192.168.50.10"}
SSH_USER=${SSH_USER:-"root"}

echo "🔧 FRP 配置更新脚本"
echo "===================="
echo "服务器: $SSH_USER@$SSH_HOST"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 常见的 FRP 配置文件路径
FRP_CONFIG_PATHS=(
    "/etc/frp/frpc.ini"
    "/opt/frp/frpc.ini"
    "/root/frp/frpc.ini"
    "/usr/local/frp/frpc.ini"
    "~/.frpc.ini"
)

echo -e "${BLUE}查找 FRP 配置文件...${NC}"

# 查找配置文件
FRP_CONFIG=""
for path in "${FRP_CONFIG_PATHS[@]}"; do
    expanded_path=$(ssh $SSH_USER@$SSH_HOST "echo $path")
    if ssh $SSH_USER@$SSH_HOST "test -f $expanded_path" 2>/dev/null; then
        FRP_CONFIG=$expanded_path
        echo -e "${GREEN}✅ 找到配置文件: $FRP_CONFIG${NC}"
        break
    fi
done

if [ -z "$FRP_CONFIG" ]; then
    echo -e "${YELLOW}⚠️  未找到 FRP 配置文件${NC}"
    echo "请手动指定配置文件路径:"
    read -p "FRP 配置文件路径: " FRP_CONFIG
fi

# 备份配置文件
echo ""
echo -e "${BLUE}备份配置文件...${NC}"
ssh $SSH_USER@$SSH_HOST << EOF
cp "$FRP_CONFIG" "$FRP_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ 备份完成"
EOF

# 检查当前配置
echo ""
echo -e "${BLUE}检查当前配置...${NC}"
ssh $SSH_USER@$SSH_HOST << EOF
echo "当前 pis-media 配置:"
grep -A 4 "name = \"pis-media\"" "$FRP_CONFIG" || echo "未找到 pis-media 配置"
EOF

# 更新配置
echo ""
echo -e "${BLUE}更新配置...${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
# 使用 sed 更新配置
sed -i 's/name = "pis-media"/&/; /name = "pis-media"/,/customDomains/ {
    s/localPort = 9000/localPort = 19000/
}' "$FRP_CONFIG"

echo "✅ 配置已更新"
EOF

# 显示更新后的配置
echo ""
echo -e "${BLUE}更新后的配置:${NC}"
ssh $SSH_USER@$SSH_HOST << EOF
grep -A 4 "name = \"pis-media\"" "$FRP_CONFIG"
EOF

# 验证配置
echo ""
echo -e "${BLUE}验证配置...${NC}"
ssh $SSH_USER@$SSH_HOST << EOF
if grep -q "localPort = 19000" "$FRP_CONFIG"; then
    echo "✅ 配置验证通过"
else
    echo "❌ 配置更新失败，请手动检查"
    exit 1
fi
EOF

# 提示重启 FRP
echo ""
echo -e "${YELLOW}⚠️  需要重启 FRP 客户端使配置生效${NC}"
echo ""
echo "重启命令（根据你的部署方式选择）:"
echo "  systemctl restart frpc"
echo "  或"
echo "  docker restart frpc"
echo "  或"
echo "  supervisorctl restart frpc"
echo ""
read -p "是否现在重启 FRP? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "重启 FRP..."
    ssh $SSH_USER@$SSH_HOST "systemctl restart frpc 2>/dev/null || docker restart frpc 2>/dev/null || supervisorctl restart frpc 2>/dev/null || echo '请手动重启 FRP'"
    echo "✅ 重启完成"
fi

echo ""
echo "===================="
echo -e "${GREEN}配置更新完成！${NC}"
echo ""
echo "💡 下一步:"
echo "  1. 验证外部访问: curl https://media.albertzhan.top/minio/health/live"
echo "  2. 检查 Vercel 环境变量: NEXT_PUBLIC_MEDIA_URL=https://media.albertzhan.top/pis-photos"
echo "  3. 测试前端图片加载"
