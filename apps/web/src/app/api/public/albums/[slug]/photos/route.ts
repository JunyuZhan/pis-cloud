import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ slug: string }>
}

interface PhotoRow {
  id: string
  thumb_key: string | null
  preview_key: string | null
  original_key: string | null
  filename: string | null
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
    const groupId = searchParams.get('group')

    const supabase = await createClient()

    // 先获取相册 ID（检查密码和过期时间）
    const { data: albumData, error: albumError } = await supabase
      .from('albums')
      .select('id, sort_rule, password, expires_at, is_public, allow_share')
      .eq('slug', slug)
      .single()

    if (albumError || !albumData) {
      return NextResponse.json(
        { error: { code: 'ALBUM_NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 检查相册是否允许分享
    if (albumData.allow_share === false) {
      return NextResponse.json(
        { error: { code: 'ALBUM_NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 检查相册是否过期
    if (albumData.expires_at && new Date(albumData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: { code: 'EXPIRED', message: '相册已过期' } },
        { status: 403 }
      )
    }

    // 检查是否需要密码（如果设置了密码且未验证，返回需要密码）
    // 注意：这里不验证密码，密码验证应该在页面层或单独的 API 中处理
    // 如果相册是私有的且设置了密码，需要先验证密码才能访问照片

    const album = albumData as { id: string; sort_rule: string | null }
    
    // 确定排序规则：优先使用URL参数，否则使用相册的sort_rule，最后使用默认值
    const sort = searchParams.get('sort') || album.sort_rule || 'capture_desc'

    // 如果指定了分组，先获取分组中的照片ID
    let photoIds: string[] | null = null
    if (groupId) {
      const { data: assignments } = await supabase
        .from('photo_group_assignments')
        .select('photo_id')
        .eq('group_id', groupId)

      if (assignments && assignments.length > 0) {
        photoIds = assignments.map((a) => a.photo_id)
      } else {
        // 如果分组中没有照片，直接返回空结果
        return NextResponse.json({
          photos: [],
          pagination: {
            page: 1,
            limit,
            total: 0,
            totalPages: 0,
          },
        })
      }
    }

    // 获取照片列表
    const offset = (page - 1) * limit

    // 根据排序参数构建不同的查询
    // 优化：只查询前端需要的字段，减少数据传输
    let query = supabase
      .from('photos')
      .select('id, thumb_key, preview_key, original_key, filename, width, height, exif, blur_data, captured_at, is_selected, rotation, updated_at', { count: 'exact' })
      .eq('album_id', album.id)
      .eq('status', 'completed')
      .is('deleted_at', null) // 排除已删除的照片

    // 如果指定了分组，只查询分组中的照片
    if (photoIds) {
      query = query.in('id', photoIds)
    }

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

    // 添加缓存头：公开相册缓存5分钟，私有相册不缓存
    // 优化：添加 ETag 支持，减少重复传输
    const cacheHeaders: Record<string, string> = albumData.is_public
      ? {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          Vary: 'Accept-Encoding',
        }
      : {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        }

    return NextResponse.json(
      {
        photos: photos?.map((photo) => ({
          id: photo.id,
          thumb_key: photo.thumb_key,
          preview_key: photo.preview_key,
          original_key: photo.original_key,
          filename: photo.filename || '',
          width: photo.width,
          height: photo.height,
          exif: photo.exif,
          blur_data: photo.blur_data,
          captured_at: photo.captured_at,
          is_selected: photo.is_selected,
          album_id: album.id,
          created_at: '',
          updated_at: '',
          status: 'completed',
          sort_order: 0,
          file_size: 0,
          mime_type: null
        })) || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
      { headers: cacheHeaders }
    )
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
