/**
 * Cloudflare CDN 缓存清除工具 (Worker 版本)
 * 
 * 用于在删除照片时清除 CDN 缓存，确保删除后无法通过 CDN 访问
 */

interface PurgeCacheOptions {
  urls: string[]
  zoneId?: string
  apiToken?: string
}

interface PurgeCacheResult {
  success: boolean
  purgedUrls: string[]
  failedUrls: string[]
  error?: string
}

/**
 * 清除 Cloudflare CDN 缓存
 * 
 * @param options 清除选项
 * @returns 清除结果
 */
export async function purgeCloudflareCache(
  options: PurgeCacheOptions
): Promise<PurgeCacheResult> {
  const { urls, zoneId, apiToken } = options

  // 如果没有配置，跳过清除
  if (!zoneId || !apiToken) {
    console.warn('[Cloudflare Purge] Zone ID or API Token not configured, skipping cache purge')
    return {
      success: false,
      purgedUrls: [],
      failedUrls: urls,
      error: 'Cloudflare API not configured',
    }
  }

  if (urls.length === 0) {
    return {
      success: true,
      purgedUrls: [],
      failedUrls: [],
    }
  }

  try {
    // Cloudflare API 限制：单次最多清除 30 个 URL
    const BATCH_SIZE = 30
    const batches: string[][] = []
    
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      batches.push(urls.slice(i, i + BATCH_SIZE))
    }

    const purgedUrls: string[] = []
    const failedUrls: string[] = []

    // 批量清除
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
          console.error('[Cloudflare Purge] Failed to purge cache:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            urls: batch,
          })
          failedUrls.push(...batch)
        } else {
          const result = (await response.json()) as { success: boolean; errors?: unknown[] }
          if (result.success) {
            purgedUrls.push(...batch)
            console.log(`[Cloudflare Purge] Successfully purged ${batch.length} URLs`)
          } else {
            console.error('[Cloudflare Purge] API returned success=false:', result.errors)
            failedUrls.push(...batch)
          }
        }
      } catch (error) {
        console.error('[Cloudflare Purge] Error purging batch:', error)
        failedUrls.push(...batch)
      }

      // 避免触发速率限制：每批之间延迟 100ms
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Cloudflare Purge] Unexpected error:', error)
    return {
      success: false,
      purgedUrls: [],
      failedUrls: urls,
      error: errorMessage,
    }
  }
}

/**
 * 构建图片的完整 URL（用于清除缓存）
 * 
 * @param mediaUrl 媒体服务器基础 URL
 * @param imageKey 图片存储路径（如 processed/thumbs/xxx.jpg）
 * @returns 完整的图片 URL
 */
export function buildImageUrl(mediaUrl: string, imageKey: string): string {
  const baseUrl = mediaUrl.replace(/\/$/, '')
  const key = imageKey.replace(/^\//, '')
  return `${baseUrl}/${key}`
}

/**
 * 清除照片的 CDN 缓存
 * 
 * @param mediaUrl 媒体服务器基础 URL
 * @param photo 照片对象（包含 original_key, thumb_key, preview_key）
 * @param zoneId Cloudflare Zone ID（可选，从环境变量获取）
 * @param apiToken Cloudflare API Token（可选，从环境变量获取）
 * @returns 清除结果
 */
export async function purgePhotoCache(
  mediaUrl: string,
  photo: {
    original_key?: string | null
    thumb_key?: string | null
    preview_key?: string | null
  },
  zoneId?: string,
  apiToken?: string
): Promise<PurgeCacheResult> {
  const urls: string[] = []

  // 构建所有图片 URL
  if (photo.original_key) {
    urls.push(buildImageUrl(mediaUrl, photo.original_key))
  }
  if (photo.thumb_key) {
    urls.push(buildImageUrl(mediaUrl, photo.thumb_key))
  }
  if (photo.preview_key) {
    urls.push(buildImageUrl(mediaUrl, photo.preview_key))
  }

  if (urls.length === 0) {
    return {
      success: true,
      purgedUrls: [],
      failedUrls: [],
    }
  }

  // 使用传入的参数或从环境变量获取
  const finalZoneId = zoneId || process.env.CLOUDFLARE_ZONE_ID
  const finalApiToken = apiToken || process.env.CLOUDFLARE_API_TOKEN

  return purgeCloudflareCache({
    urls,
    zoneId: finalZoneId,
    apiToken: finalApiToken,
  })
}
