import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { purgePhotoCache } from '@/lib/cloudflare-purge'
import { revalidatePath } from 'next/cache'

/**
 * 永久删除照片（从回收站删除）
 * POST /api/admin/photos/permanent-delete
 * 
 * 功能：
 * 1. 删除 MinIO 中的所有文件（原图、缩略图、预览图）
 * 2. 删除数据库记录
 * 3. 清除 CDN 缓存
 * 4. 更新相册照片计数
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 验证登录状态
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { status: 401 }
      )
    }

    // 解析请求体
    interface PermanentDeleteRequestBody {
      photoIds: string[]
    }

    let body: PermanentDeleteRequestBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }

    const { photoIds } = body

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '请选择要删除的照片' } },
        { status: 400 }
      )
    }

    // 限制批量删除数量
    if (photoIds.length > 100) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '单次最多删除100张照片' } },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // 查询照片记录（获取文件路径和相册信息）
    const { data: photosData, error: checkError } = await adminClient
      .from('photos')
      .select('id, album_id, original_key, thumb_key, preview_key')
      .in('id', photoIds)
      .not('deleted_at', 'is', null) // 只允许删除已在回收站的照片

    if (checkError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: checkError.message } },
        { status: 500 }
      )
    }

    const validPhotos = photosData as Array<{
      id: string
      album_id: string
      original_key: string
      thumb_key: string | null
      preview_key: string | null
    }> | null

    if (!validPhotos || validPhotos.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '未找到有效的照片（照片可能不在回收站中）' } },
        { status: 404 }
      )
    }

    const validPhotoIds = validPhotos.map((p) => p.id)
    const albumIds = [...new Set(validPhotos.map((p) => p.album_id))]

    // 获取相册信息（用于缓存清除）
    const { data: albumsData } = await adminClient
      .from('albums')
      .select('id, slug, cover_photo_id')
      .in('id', albumIds)

    const albumsMap = new Map(
      (albumsData || []).map((album) => [album.id, album])
    )

    // 1. 删除 MinIO 文件（通过 Worker API）
    const requestUrl = new URL(request.url)
    const protocol = requestUrl.protocol
    const host = requestUrl.host
    const proxyUrl = `http://localhost:3000/api/worker/cleanup-file`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      headers['cookie'] = cookieHeader
    }

    const filesToDelete: string[] = []
    for (const photo of validPhotos) {
      if (photo.original_key) filesToDelete.push(photo.original_key)
      if (photo.thumb_key) filesToDelete.push(photo.thumb_key)
      if (photo.preview_key) filesToDelete.push(photo.preview_key)
    }

    // 批量删除文件（并行执行，但不阻塞）
    Promise.all(
      filesToDelete.map((key) =>
        fetch(proxyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ key }),
        }).catch((error) => {
          console.warn(`[Permanent Delete] Failed to delete file ${key}:`, error)
        })
      )
    ).catch((error) => {
      console.warn('[Permanent Delete] Error deleting files:', error)
    })

    // 2. 清除 Cloudflare CDN 缓存（如果配置了）
    // 注意：即使清除失败也不阻止删除操作，但会等待清除完成以确保执行
    const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL
    const zoneId = process.env.CLOUDFLARE_ZONE_ID
    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    
    if (mediaUrl && zoneId && apiToken) {
      try {
        const purgeResults = await Promise.allSettled(
          validPhotos.map((photo) =>
            purgePhotoCache(mediaUrl, {
              original_key: photo.original_key,
              thumb_key: photo.thumb_key,
              preview_key: photo.preview_key,
            }, zoneId, apiToken)
          )
        )
        
        // 统计清除结果
        const successCount = purgeResults.filter(r => r.status === 'fulfilled' && r.value.success).length
        const failCount = purgeResults.length - successCount
        
        if (failCount > 0) {
          console.warn(`[Permanent Delete] CDN cache purge: ${successCount} succeeded, ${failCount} failed`)
          // 记录失败的详情
          purgeResults.forEach((result, index) => {
            if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success)) {
              console.warn(`[Permanent Delete] Failed to purge cache for photo ${validPhotos[index]?.id}:`, 
                result.status === 'rejected' ? result.reason : result.value.error)
            }
          })
        } else {
          console.log(`[Permanent Delete] Successfully purged CDN cache for ${successCount} photos`)
        }
      } catch (error) {
        console.warn('[Permanent Delete] Error purging CDN cache:', error)
      }
    } else if (mediaUrl) {
      console.warn('[Permanent Delete] Cloudflare API not configured (missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN), skipping cache purge')
    }

    // 3. 删除数据库记录
    const { error: deleteError } = await adminClient
      .from('photos')
      .delete()
      .in('id', validPhotoIds)

    if (deleteError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: deleteError.message } },
        { status: 500 }
      )
    }

    // 4. 更新相册封面（如果封面照片被删除）
    for (const album of albumsMap.values()) {
      if (album.cover_photo_id && validPhotoIds.includes(album.cover_photo_id)) {
        await adminClient
          .from('albums')
          .update({ cover_photo_id: null })
          .eq('id', album.id)
      }
    }

    // 5. 更新相册照片计数
    for (const albumId of albumIds) {
      const { count: actualPhotoCount } = await adminClient
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('album_id', albumId)
        .eq('status', 'completed')
        .is('deleted_at', null)

      await adminClient
        .from('albums')
        .update({ photo_count: actualPhotoCount ?? 0 })
        .eq('id', albumId)
    }

    // 6. 清除 Next.js/Vercel 路由缓存
    for (const album of albumsMap.values()) {
      if (album.slug) {
        try {
          revalidatePath(`/api/public/albums/${album.slug}/photos`)
          revalidatePath(`/api/public/albums/${album.slug}/groups`)
          revalidatePath(`/api/public/albums/${album.slug}`)
          revalidatePath(`/album/${album.slug}`)
        } catch (revalidateError) {
          console.warn(
            `[Permanent Delete] Failed to revalidate cache for album ${album.slug}:`,
            revalidateError
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount: validPhotoIds.length,
      message: `已永久删除 ${validPhotoIds.length} 张照片`,
    })
  } catch (error) {
    console.error('[Permanent Delete] API error:', error)
    const errorMessage = error instanceof Error ? error.message : '服务器错误'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: errorMessage } },
      { status: 500 }
    )
  }
}
