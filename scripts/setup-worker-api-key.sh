#!/bin/bash

# Worker API Key 快速设置脚本
# 用途: 帮助在生产服务器上快速设置 WORKER_API_KEY

set -e

echo "🔐 Worker API Key 设置工具"
echo "================================"
echo ""

# 检查是否在服务器上
if [ -z "$SSH_CONNECTION" ] && [ "$1" != "--force" ]; then
  echo "⚠️  此脚本通常在生产服务器上运行"
  echo "   如果要在本地运行，请使用 --force 参数"
  echo ""
  read -p "继续？(y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    exit 0
  fi
fi

# 生成新的 API Key
echo "📝 生成新的 API Key..."
NEW_API_KEY=$(openssl rand -hex 32)
echo "✅ 已生成: ${NEW_API_KEY:0:20}..."
echo ""

# 查找环境变量文件
ENV_FILE=""
if [ -f "/root/PIS/.env.local" ]; then
  ENV_FILE="/root/PIS/.env.local"
elif [ -f ".env.local" ]; then
  ENV_FILE=".env.local"
elif [ -f "../.env.local" ]; then
  ENV_FILE="../.env.local"
fi

if [ -z "$ENV_FILE" ]; then
  echo "❌ 未找到 .env.local 文件"
  echo ""
  echo "请手动创建并添加以下内容:"
  echo "WORKER_API_KEY=${NEW_API_KEY}"
  echo ""
  exit 1
fi

echo "📁 找到环境变量文件: ${ENV_FILE}"
echo ""

# 检查是否已存在
if grep -q "^WORKER_API_KEY=" "$ENV_FILE" 2>/dev/null; then
  echo "⚠️  检测到已存在的 WORKER_API_KEY"
  read -p "是否要替换？(y/N): " replace
  if [ "$replace" != "y" ] && [ "$replace" != "Y" ]; then
    echo "❌ 已取消"
    exit 0
  fi
  
  # 替换现有的
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|^WORKER_API_KEY=.*|WORKER_API_KEY=${NEW_API_KEY}|" "$ENV_FILE"
  else
    # Linux
    sed -i "s|^WORKER_API_KEY=.*|WORKER_API_KEY=${NEW_API_KEY}|" "$ENV_FILE"
  fi
  echo "✅ 已更新 WORKER_API_KEY"
else
  # 添加新的
  echo "WORKER_API_KEY=${NEW_API_KEY}" >> "$ENV_FILE"
  echo "✅ 已添加 WORKER_API_KEY"
fi

echo ""
echo "🔑 新的 API Key:"
echo "   ${NEW_API_KEY}"
echo ""
echo "📋 下一步操作:"
echo "   1. 重启 Worker 服务:"
echo "      docker restart pis-worker"
echo "      或"
echo "      docker-compose restart worker"
echo ""
echo "   2. 验证设置:"
echo "      docker logs pis-worker --tail 20"
echo ""
echo "   3. 测试 API (使用上面的 Key):"
echo "      curl -X POST http://worker.albertzhan.top/api/process \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -H 'X-API-Key: ${NEW_API_KEY}' \\"
echo "        -d '{\"photoId\":\"test\",\"albumId\":\"test\",\"originalKey\":\"test\"}'"
echo ""
echo "⚠️  重要: 请保存此 API Key，并确保 Next.js 应用也使用相同的 Key！"
echo ""
