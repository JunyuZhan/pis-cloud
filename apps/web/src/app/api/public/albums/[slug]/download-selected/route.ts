import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * GET /api/public/albums/[slug]/download-selected
 * 获取所有已选照片的下载链接
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const supabase = createAdminClient()

    // 1. 获取相册信息
    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('id, title, allow_download, allow_batch_download')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single()

    if (albumError || !album) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 2. 检查是否允许下载
    if (!album.allow_download) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '此相册不允许下载' } },
        { status: 403 }
      )
    }

    if (!album.allow_batch_download) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '此相册不允许批量下载' } },
        { status: 403 }
      )
    }

    // 3. 获取所有已选照片
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('id, filename, original_key')
      .eq('album_id', album.id)
      .eq('is_selected', true)
      .eq('status', 'completed')
      .order('sort_order', { ascending: true })

    if (photosError) {
      throw photosError
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: { code: 'NO_SELECTION', message: '没有已选照片' } },
        { status: 400 }
      )
    }

    // 4. 通过 Worker API 生成 presigned URL
    const workerUrl = process.env.WORKER_API_URL || process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
    const workerApiKey = process.env.WORKER_API_KEY
    
    if (!workerApiKey) {
      console.error('[Batch Download API] WORKER_API_KEY not configured')
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: '服务器配置错误' } },
        { status: 500 }
      )
    }

    // 为每张照片生成 presigned URL
    const downloadLinks = await Promise.all(
      photos.map(async (photo) => {
        try {
          const workerResponse = await fetch(`${workerUrl}/api/presign/get`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': workerApiKey,
            },
            body: JSON.stringify({
              key: photo.original_key,
              expirySeconds: 5 * 60, // 5 分钟有效期
              responseContentDisposition: `attachment; filename="${encodeURIComponent(photo.filename)}"`,
            }),
          })

          if (!workerResponse.ok) {
            console.error(`[Batch Download API] Failed to generate presigned URL for photo ${photo.id}`)
            throw new Error('Failed to generate download URL')
          }

          const { url: downloadUrl } = await workerResponse.json()

          return {
            id: photo.id,
            filename: photo.filename,
            url: downloadUrl,
          }
        } catch (error) {
          console.error(`[Batch Download API] Error generating URL for photo ${photo.id}:`, error)
          // 如果生成失败，返回 null，前端可以跳过这张照片
          return null
        }
      })
    )

    // 过滤掉生成失败的链接
    const validLinks = downloadLinks.filter((link): link is NonNullable<typeof link> => link !== null)

    if (validLinks.length === 0) {
      return NextResponse.json(
        { error: { code: 'GENERATION_ERROR', message: '无法生成下载链接' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      albumTitle: album.title,
      count: validLinks.length,
      photos: validLinks,
    })

  } catch (error) {
    console.error('Download selected error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
