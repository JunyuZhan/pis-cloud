#!/bin/bash
# 批量将pending照片重新加入处理队列

echo "🔄 开始批量处理pending照片..."

# 获取pending照片列表
PHOTOS_JSON=$(ssh root@192.168.50.10 "docker exec pis-worker node -e \"import('@supabase/supabase-js').then(m => { const s = m.createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); s.from('photos').select('id,album_id,original_key').eq('status','pending').then(r => console.log(JSON.stringify(r.data || []))); })\"")

# 解析JSON并批量处理
echo "$PHOTOS_JSON" | jq -r '.[] | "\(.id)|\(.album_id)|\(.original_key)"' | while IFS='|' read -r photo_id album_id original_key; do
  echo "处理照片: $photo_id"
  response=$(ssh root@192.168.50.10 "curl -s -X POST http://localhost:3001/api/process -H 'Content-Type: application/json' -d '{\"photoId\":\"$photo_id\",\"albumId\":\"$album_id\",\"originalKey\":\"$original_key\"}'")
  echo "  响应: $response"
  sleep 0.1  # 避免过快请求
done

echo "✅ 完成"
