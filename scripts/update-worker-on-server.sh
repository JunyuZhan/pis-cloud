#!/bin/bash

# Worker 更新脚本 - 在服务器上运行
# 用途: 拉取最新代码，更新环境配置，重新构建 Worker 镜像

set -e

echo "🚀 Worker 更新脚本"
echo "=================="
echo ""

# 检查是否在服务器上
if [ -z "$SSH_CONNECTION" ] && [ "$1" != "--force" ]; then
  echo "⚠️  此脚本应在服务器上运行"
  echo "   如果要在本地运行，请使用 --force 参数"
  echo ""
  read -p "继续？(y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    exit 0
  fi
fi

# 项目目录（自动检测）
if [ -d "/opt/PIS" ]; then
  PROJECT_DIR="/opt/PIS"
elif [ -d "/root/PIS" ]; then
  PROJECT_DIR="/root/PIS"
else
  echo "❌ 未找到项目目录，请手动指定 PROJECT_DIR"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "📁 项目目录: $PROJECT_DIR"
echo ""

# 1. 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main
echo "✅ 代码更新完成"
echo ""

# 2. 检查环境配置文件
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  未找到 .env 文件"
  echo "   从 .env.example 创建..."
  cp .env.example .env
  echo "✅ 已创建 .env"
  echo ""
fi

# 3. 检查 WORKER_API_KEY
if ! grep -q "^WORKER_API_KEY=" "$ENV_FILE" 2>/dev/null || grep -q "^WORKER_API_KEY=your-secret-api-key-change-this-in-production" "$ENV_FILE" 2>/dev/null; then
  echo "⚠️  WORKER_API_KEY 未设置或使用示例值"
  echo ""
  read -p "是否要生成新的 API Key？(y/N): " generate
  if [ "$generate" = "y" ] || [ "$generate" = "Y" ]; then
    NEW_API_KEY=$(openssl rand -hex 32)
    if grep -q "^WORKER_API_KEY=" "$ENV_FILE" 2>/dev/null; then
      # 替换现有的
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^WORKER_API_KEY=.*|WORKER_API_KEY=${NEW_API_KEY}|" "$ENV_FILE"
      else
        sed -i "s|^WORKER_API_KEY=.*|WORKER_API_KEY=${NEW_API_KEY}|" "$ENV_FILE"
      fi
    else
      # 添加新的
      echo "" >> "$ENV_FILE"
      echo "# Worker API Key" >> "$ENV_FILE"
      echo "WORKER_API_KEY=${NEW_API_KEY}" >> "$ENV_FILE"
    fi
    echo "✅ 已生成并设置新的 API Key: ${NEW_API_KEY:0:20}..."
    echo ""
    echo "⚠️  重要: 请确保 Next.js 应用也使用相同的 API Key！"
    echo ""
  else
    echo "⚠️  跳过 API Key 设置，请手动配置"
    echo ""
  fi
else
  echo "✅ WORKER_API_KEY 已配置"
  echo ""
fi

# 4. 检查 Docker 和 Docker Compose
if ! command -v docker &> /dev/null; then
  echo "❌ Docker 未安装"
  exit 1
fi

# 5. 重新构建 Worker 镜像
echo "🔨 重新构建 Worker 镜像..."
cd "$PROJECT_DIR"

# 检查是否有 docker-compose.yml
if [ -f "docker-compose.yml" ]; then
  echo "   使用 docker-compose 构建..."
  docker-compose build worker
  echo "✅ Worker 镜像构建完成"
  echo ""
  
  echo "🔄 重启 Worker 服务..."
  docker-compose restart worker
  echo "✅ Worker 服务已重启"
else
  # 检查是否有单独的 Dockerfile
  if [ -f "services/worker/Dockerfile" ] || [ -f "docker/worker.Dockerfile" ]; then
    echo "   使用 Dockerfile 构建..."
    DOCKERFILE="services/worker/Dockerfile"
    if [ ! -f "$DOCKERFILE" ]; then
      DOCKERFILE="docker/worker.Dockerfile"
    fi
    
    docker build -t pis-worker:latest -f "$DOCKERFILE" .
    echo "✅ Worker 镜像构建完成"
    echo ""
    
    echo "🔄 重启 Worker 容器..."
    docker restart pis-worker || docker run -d --name pis-worker --network host -v "$PROJECT_DIR/.env:/app/.env:ro" pis-worker:latest
    echo "✅ Worker 容器已重启"
  else
    echo "⚠️  未找到 Dockerfile，跳过构建"
    echo "   请手动重启 Worker 服务"
  fi
fi

echo ""
echo "📋 验证步骤:"
echo "   1. 检查 Worker 日志:"
echo "      docker logs pis-worker --tail 20"
echo ""
echo "   2. 检查 API Key 是否生效:"
echo "      curl -X POST http://your-worker-domain.com/api/process \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"photoId\":\"test\",\"albumId\":\"test\",\"originalKey\":\"test\"}'"
echo "      # 应该返回 401 Unauthorized（如果未带 API Key）"
echo ""
echo "   3. 测试健康检查:"
echo "      curl http://your-worker-domain.com/health"
echo "      # 应该返回健康状态（不需要 API Key）"
echo ""
echo "✅ 更新完成！"
