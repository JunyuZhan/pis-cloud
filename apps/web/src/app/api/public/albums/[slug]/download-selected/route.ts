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

    // 4. 生成下载链接
    const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || ''

    const downloadLinks = photos.map(photo => ({
      id: photo.id,
      filename: photo.filename,
      url: `${mediaUrl}/${photo.original_key}`,
    }))

    return NextResponse.json({
      albumTitle: album.title,
      count: photos.length,
      photos: downloadLinks,
    })

  } catch (error) {
    console.error('Download selected error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
