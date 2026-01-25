#!/bin/bash

# ============================================
# 此脚本已迁移到新的模块化部署系统
# 
# 请使用: bash scripts/deploy.sh
# ============================================

echo ""
echo "⚠️  此脚本已更新为新的模块化部署系统"
echo ""
echo "请使用以下命令："
echo ""
echo "  bash scripts/deploy.sh"
echo ""
echo "新系统特点："
echo "  - 交互式引导，无需记参数"
echo "  - 支持 Supabase/PostgreSQL/MySQL"
echo "  - 支持内网/公网模式"
echo ""

# 如果用户同意，直接启动新脚本
read -p "是否现在运行新的部署脚本? [Y/n]: " CONFIRM
CONFIRM=${CONFIRM:-Y}

if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    exec bash "${SCRIPT_DIR}/deploy.sh" "$@"
fi
