#!/bin/bash

# 检查相册照片的 thumb_key 和 preview_key

ALBUM_ID="e6ce4da1-86f5-4655-a926-1440fa4b3f26"
PHOTO_IDS=(
  "bb670af4-e11c-4dd9-8d95-95de320c9889"
  "92ef01c4-6bba-4806-849f-05b00562bf28"
  "9cafca2a-c19a-4528-80d5-385dd50575c0"
  "63a9c310-eb72-4812-b142-945c6d348ed7"
)

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
