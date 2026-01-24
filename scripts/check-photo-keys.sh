#!/bin/bash

# 检查相册照片的 thumb_key 和 preview_key
# 使用方法: ALBUM_ID="your-album-id" PHOTO_IDS=("id1" "id2") ./scripts/check-photo-keys.sh

# 从环境变量获取，如果没有则提示用户
ALBUM_ID="${ALBUM_ID:-}"
PHOTO_IDS=(${PHOTO_IDS[@]})

if [ -z "$ALBUM_ID" ] || [ ${#PHOTO_IDS[@]} -eq 0 ]; then
  echo "用法: ALBUM_ID=\"your-album-id\" PHOTO_IDS=(\"id1\" \"id2\" \"id3\") ./scripts/check-photo-keys.sh"
  echo ""
  echo "示例:"
  echo "  ALBUM_ID=\"e6ce4da1-86f5-4655-a926-1440fa4b3f26\" \\"
  echo "  PHOTO_IDS=(\"bb670af4-e11c-4dd9-8d95-95de320c9889\" \"92ef01c4-6bba-4806-849f-05b00562bf28\") \\"
  echo "  ./scripts/check-photo-keys.sh"
  exit 1
fi

echo "=== 检查照片数据库记录 ==="
echo ""

for photo_id in "${PHOTO_IDS[@]}"; do
  echo "照片 ID: $photo_id"
  echo "检查 MinIO 文件..."
  
  # 检查缩略图
  echo -n "  缩略图: "
  docker exec pis-minio mc stat pis-photos/processed/thumbs/$ALBUM_ID/$photo_id.jpg 2>&1 | grep -q "Object" && echo "✅ 存在" || echo "❌ 不存在"
  
  # 检查预览图
  echo -n "  预览图: "
  docker exec pis-minio mc stat pis-photos/processed/previews/$ALBUM_ID/$photo_id.jpg 2>&1 | grep -q "Object" && echo "✅ 存在" || echo "❌ 不存在"
  
  echo ""
done

echo "=== 检查 Worker 队列状态 ==="
docker exec pis-worker curl -s http://localhost:3001/health | jq '.' 2>/dev/null || echo "无法获取 Worker 健康状态"

echo ""
echo "=== 检查最近处理的照片 ==="
docker logs pis-worker --tail 20 | grep -E "Processing|Completed|Failed"
