#!/usr/bin/env tsx
/**
 * 批量清除已删除照片的 Cloudflare CDN 缓存
 * 
 * 使用方法:
 *   tsx scripts/purge-deleted-photos-cache.ts
 * 
 * 环境变量:
 *   - NEXT_PUBLIC_MEDIA_URL: 媒体服务器 URL
 *   - CLOUDFLARE_ZONE_ID: Cloudflare Zone ID
 *   - CLOUDFLARE_API_TOKEN: Cloudflare API Token
 *   - SUPABASE_URL: Supabase URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase Service Role Key
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// 加载环境变量
config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL
const zoneId = process.env.CLOUDFLARE_ZONE_ID
const apiToken = process.env.CLOUDFLARE_API_TOKEN

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 错误: 缺少 Supabase 配置')
  console.error('请设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!mediaUrl || !zoneId || !apiToken) {
  console.error('❌ 错误: 缺少 Cloudflare 配置')
  console.error('请设置 NEXT_PUBLIC_MEDIA_URL, CLOUDFLARE_ZONE_ID 和 CLOUDFLARE_API_TOKEN')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface PurgeCacheResult {
  success: boolean
  purgedUrls: string[]
  failedUrls: string[]
  error?: string
}

async function purgeCloudflareCache(urls: string[]): Promise<PurgeCacheResult> {
  const BATCH_SIZE = 30
  const batches: string[][] = []
  
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    batches.push(urls.slice(i, i + BATCH_SIZE))
  }

  const purgedUrls: string[] = []
  const failedUrls: string[] = []

  for (const batch of batches) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: batch,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error(`❌ 批次清除失败:`, errorData)
        failedUrls.push(...batch)
      } else {
        const result = await response.json()
        if (result.success) {
          purgedUrls.push(...batch)
          console.log(`✅ 成功清除 ${batch.length} 个 URL`)
        } else {
          console.error(`❌ API 返回失败:`, result.errors)
          failedUrls.push(...batch)
        }
      }
    } catch (error) {
      console.error(`❌ 清除批次时出错:`, error)
      failedUrls.push(...batch)
    }

    // 避免速率限制
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return {
    success: failedUrls.length === 0,
    purgedUrls,
    failedUrls,
    ...(failedUrls.length > 0 && {
      error: `Failed to purge ${failedUrls.length} URLs`,
    }),
  }
}

function buildImageUrl(imageKey: string): string {
  const baseUrl = mediaUrl!.replace(/\/$/, '')
  const key = imageKey.replace(/^\//, '')
  return `${baseUrl}/${key}`
}

async function main() {
  console.log('🔍 查询已删除的照片...')
  
  // 查询所有已删除但未永久删除的照片（deleted_at 不为空）
  const { data: deletedPhotos, error } = await supabase
    .from('photos')
    .select('id, original_key, thumb_key, preview_key')
    .not('deleted_at', 'is', null)
    .limit(1000) // 限制一次处理的数量

  if (error) {
    console.error('❌ 查询失败:', error)
    process.exit(1)
  }

  if (!deletedPhotos || deletedPhotos.length === 0) {
    console.log('✅ 没有找到已删除的照片')
    return
  }

  console.log(`📸 找到 ${deletedPhotos.length} 张已删除的照片`)
  console.log('🔄 开始清除 CDN 缓存...\n')

  // 构建所有图片 URL
  const urls: string[] = []
  for (const photo of deletedPhotos) {
    if (photo.original_key) urls.push(buildImageUrl(photo.original_key))
    if (photo.thumb_key) urls.push(buildImageUrl(photo.thumb_key))
    if (photo.preview_key) urls.push(buildImageUrl(photo.preview_key))
  }

  console.log(`📋 准备清除 ${urls.length} 个 URL 的缓存\n`)

  // 清除缓存
  const result = await purgeCloudflareCache(urls)

  console.log('\n📊 清除结果:')
  console.log(`  ✅ 成功: ${result.purgedUrls.length} 个 URL`)
  console.log(`  ❌ 失败: ${result.failedUrls.length} 个 URL`)

  if (result.failedUrls.length > 0) {
    console.log('\n❌ 失败的 URL:')
    result.failedUrls.slice(0, 10).forEach(url => {
      console.log(`  - ${url}`)
    })
    if (result.failedUrls.length > 10) {
      console.log(`  ... 还有 ${result.failedUrls.length - 10} 个失败的 URL`)
    }
  }

  if (result.success) {
    console.log('\n✅ 所有缓存清除完成！')
  } else {
    console.log('\n⚠️  部分缓存清除失败，请检查错误信息')
  }
}

main().catch(console.error)
