#!/bin/bash

# Cloudflare 缓存清除脚本
# 使用方法: ./scripts/purge-cf-cache.sh [URL1] [URL2] ...

# 从环境变量读取配置
ZONE_ID="${CLOUDFLARE_ZONE_ID:-55be2d2f25313170ff6a622cda4c37ec}"
API_TOKEN="${CLOUDFLARE_API_TOKEN:-eefd8ypDgq_kJO2OivNQy7VFU6qj12KM7c1u03k3}"

# 如果没有提供 URL，使用默认的测试 URL
if [ $# -eq 0 ]; then
  echo "用法: $0 [URL1] [URL2] ..."
  echo "示例: $0 https://media.albertzhan.top/pis-photos/processed/previews/xxx/xxx.jpg"
  echo ""
  echo "或者设置环境变量后运行:"
  echo "  export CLOUDFLARE_ZONE_ID=your-zone-id"
  echo "  export CLOUDFLARE_API_TOKEN=your-api-token"
  echo "  $0 https://media.albertzhan.top/pis-photos/..."
  exit 1
fi

# 构建 URL 数组
URLS=("$@")

# Cloudflare API 限制：每次最多 30 个 URL
BATCH_SIZE=30

echo "准备清除 ${#URLS[@]} 个 URL 的缓存..."
echo "Zone ID: $ZONE_ID"
echo ""

# 分批处理
for ((i=0; i<${#URLS[@]}; i+=BATCH_SIZE)); do
  BATCH=("${URLS[@]:i:BATCH_SIZE}")
  
  echo "清除批次 $((i/BATCH_SIZE + 1)) (${#BATCH[@]} 个 URL)..."
  
  # 构建 JSON 数组
  JSON_URLS=$(printf '%s\n' "${BATCH[@]}" | jq -R . | jq -s .)
  
  # 调用 Cloudflare API
  RESPONSE=$(curl -s -X POST \
    "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"files\": ${JSON_URLS}}")
  
  # 检查结果
  SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
  
  if [ "$SUCCESS" = "true" ]; then
    echo "✅ 成功清除 ${#BATCH[@]} 个 URL"
  else
    echo "❌ 清除失败:"
    echo "$RESPONSE" | jq '.'
  fi
  
  # 避免速率限制：批次之间延迟
  if [ $((i + BATCH_SIZE)) -lt ${#URLS[@]} ]; then
    sleep 0.1
  fi
done

echo ""
echo "完成！"
