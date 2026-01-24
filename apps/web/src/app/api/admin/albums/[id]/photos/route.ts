import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface PhotoRow {
  id: string
  album_id: string
  original_key: string
  preview_key: string | null
  thumb_key: string | null
  filename: string
  file_size: number | null
  width: number | null
  height: number | null
  mime_type: string | null
  blur_data: string | null
  exif: Record<string, unknown> | null
  captured_at: string | null
  status: string
  is_selected: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/**
 * 管理员照片列表 API
 * - GET: 获取相册中的照片（含选中状态统计）
 */

// GET /api/admin/albums/[id]/photos - 获取照片列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
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

    // 分页参数
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // 筛选参数
    const status = searchParams.get('status') // pending, processing, completed, failed
    const selected = searchParams.get('selected') // true, false

    // 验证相册存在
    const { data: albumData, error: albumError } = await supabase
      .from('albums')
      .select('id, title')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (albumError || !albumData) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    const album = albumData as { id: string; title: string }

    // 构建照片查询
    let query = supabase
      .from('photos')
      .select('*', { count: 'exact' })
      .eq('album_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 可选：按状态筛选
    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      query = query.eq('status', status)
    }

    // 可选：按选中状态筛选
    if (selected === 'true') {
      query = query.eq('is_selected', true)
    } else if (selected === 'false') {
      query = query.eq('is_selected', false)
    }

    const { data, error: photosError, count } = await query

    if (photosError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: photosError.message } },
        { status: 500 }
      )
    }

    const photos = data as PhotoRow[] | null

    // 获取选中统计
    const { count: selectedCount } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('album_id', id)
      .eq('is_selected', true)
      .eq('status', 'completed')

    // 构造响应（添加 URL）
    const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL

    return NextResponse.json({
      album: {
        id: album.id,
        title: album.title,
      },
      photos: photos?.map((photo) => ({
        id: photo.id,
        album_id: photo.album_id,
        original_key: photo.original_key,
        preview_key: photo.preview_key,
        thumb_key: photo.thumb_key,
        filename: photo.filename,
        file_size: photo.file_size,
        width: photo.width,
        height: photo.height,
        mime_type: photo.mime_type,
        blur_data: photo.blur_data,
        exif: photo.exif,
        captured_at: photo.captured_at,
        status: photo.status,
        is_selected: photo.is_selected,
        sort_order: photo.sort_order,
        created_at: photo.created_at,
        updated_at: photo.updated_at,
        thumbUrl: photo.thumb_key ? `${mediaUrl}/${photo.thumb_key}` : null,
        previewUrl: photo.preview_key ? `${mediaUrl}/${photo.preview_key}` : null,
      })),
      stats: {
        selectedCount: selectedCount || 0,
      },
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

// DELETE /api/admin/albums/[id]/photos - 批量删除照片
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
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
    let body: any
    try {
      body = await request.json()
    } catch (err) {
      console.error('Failed to parse request body:', err)
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

    // 验证照片属于该相册
    const { data: photosData, error: checkError } = await supabase
      .from('photos')
      .select('id')
      .eq('album_id', id)
      .in('id', photoIds)

    if (checkError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: checkError.message } },
        { status: 500 }
      )
    }

    const validPhotos = photosData as { id: string }[] | null
    const validPhotoIds = validPhotos?.map((p) => p.id) || []

    if (validPhotoIds.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '未找到有效的照片' } },
        { status: 404 }
      )
    }

    // 执行删除
    const { error: deleteError } = await supabase
      .from('photos')
      .delete()
      .in('id', validPhotoIds)

    if (deleteError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: deleteError.message } },
        { status: 500 }
      )
    }

    // 注意：MinIO 文件清理策略
    // 我们目前不在这里同步删除 MinIO 文件，而是依赖数据库的软删除/定期清理机制
    // 或者后续添加一个专门的清理 Worker。对于 MVP，保留文件是更安全的策略。

    return NextResponse.json({
      success: true,
      deletedCount: validPhotoIds.length,
      message: `已删除 ${validPhotoIds.length} 张照片`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
