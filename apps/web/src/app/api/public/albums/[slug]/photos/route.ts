import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ slug: string }>
}

interface PhotoRow {
  id: string
  thumb_key: string | null
  preview_key: string | null
  width: number | null
  height: number | null
  exif: Record<string, unknown> | null
  blur_data: string | null
  captured_at: string | null
  is_selected: boolean
}

/**
 * 访客照片列表 API
 */

// GET /api/public/albums/[slug]/photos - 获取照片列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sort = searchParams.get('sort') || 'capture_desc'

    const supabase = await createClient()

    // 先获取相册 ID
    const { data: albumData, error: albumError } = await supabase
      .from('albums')
      .select('id, sort_rule')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single()

    if (albumError || !albumData) {
      return NextResponse.json(
        { error: { code: 'ALBUM_NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    const album = albumData as { id: string; sort_rule: string | null }

    // 获取照片列表
    const offset = (page - 1) * limit
    const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL

    // 根据排序参数构建不同的查询
    let query = supabase
      .from('photos')
      .select('id, thumb_key, preview_key, width, height, exif, blur_data, captured_at, is_selected', { count: 'exact' })
      .eq('album_id', album.id)
      .eq('status', 'completed')

    // 应用排序
    switch (sort) {
      case 'capture_asc':
        query = query.order('captured_at', { ascending: true })
        break
      case 'capture_desc':
        query = query.order('captured_at', { ascending: false })
        break
      case 'upload_desc':
        query = query.order('created_at', { ascending: false })
        break
      case 'manual':
        query = query.order('sort_order', { ascending: true })
        break
      default:
        query = query.order('captured_at', { ascending: false })
    }

    const { data, error: photosError, count } = await query.range(offset, offset + limit - 1)

    if (photosError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: photosError.message } },
        { status: 500 }
      )
    }

    const photos = data as PhotoRow[] | null

    return NextResponse.json({
      photos: photos?.map((photo) => ({
        id: photo.id,
        thumb_key: photo.thumb_key,
        preview_key: photo.preview_key,
        width: photo.width,
        height: photo.height,
        exif: photo.exif,
        blur_data: photo.blur_data,
        captured_at: photo.captured_at,
        is_selected: photo.is_selected,
        filename: '', // 补充缺失字段以匹配 Photo 类型
        album_id: album.id,
        created_at: '',
        updated_at: '',
        original_key: '',
        status: 'completed',
        sort_order: 0,
        file_size: 0,
        mime_type: null
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
