import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AlbumInsert, Json } from '@/types/database'

/**
 * 相册列表 API
 * - GET: 获取所有相册
 * - POST: 创建新相册
 */

// GET /api/admin/albums - 获取相册列表
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

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
    const isPublic = searchParams.get('is_public')

    // 构建查询
    let query = supabase
      .from('albums')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 可选：按公开状态筛选
    if (isPublic === 'true') {
      query = query.eq('is_public', true)
    } else if (isPublic === 'false') {
      query = query.eq('is_public', false)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      albums: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// POST /api/admin/albums - 创建新相册
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
    interface CreateAlbumRequestBody {
      title: string
      description?: string | null
      event_date?: string | null
      location?: string | null
      is_public?: boolean
      layout?: 'masonry' | 'grid' | 'carousel'
      sort_rule?: 'capture_desc' | 'capture_asc' | 'manual'
      allow_download?: boolean
      show_exif?: boolean
      watermark_enabled?: boolean
      watermark_type?: 'text' | 'logo' | null
      watermark_config?: Json
    }
    let body: CreateAlbumRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const {
      title,
      description,
      event_date,
      location,
      is_public,
      layout,
      sort_rule,
      allow_download,
      show_exif,
      watermark_enabled,
      watermark_type,
      watermark_config,
    } = body

    // 验证必填字段
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '相册标题不能为空' } },
        { status: 400 }
      )
    }

    // 验证标题长度
    if (title.length > 100) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '相册标题不能超过100个字符' } },
        { status: 400 }
      )
    }

    // 验证布局类型
    if (layout && !['masonry', 'grid', 'carousel'].includes(layout)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '无效的布局类型' } },
        { status: 400 }
      )
    }

    // 验证排序规则
    if (sort_rule && !['capture_desc', 'capture_asc', 'manual'].includes(sort_rule)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '无效的排序规则' } },
        { status: 400 }
      )
    }

    // 验证水印类型
    if (watermark_type && !['text', 'logo'].includes(watermark_type)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '无效的水印类型' } },
        { status: 400 }
      )
    }

    // 构建插入数据
    const insertData: AlbumInsert = {
      title: title.trim(),
      description: description?.trim() || null,
      event_date: event_date || null,
      location: location?.trim() || null,
      is_public: is_public ?? false,
      layout: layout || 'masonry',
      sort_rule: sort_rule || 'capture_desc',
      allow_download: allow_download ?? true,
      show_exif: show_exif ?? true,
      watermark_enabled: watermark_enabled ?? false,
      watermark_type: watermark_type || null,
      watermark_config: (watermark_config || {}) as Json,
    }

    // 创建相册
    const { data, error } = await supabase
      .from('albums')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // 处理唯一约束冲突（slug 重复）
      if (error.code === '23505') {
        return NextResponse.json(
          { error: { code: 'DUPLICATE_ERROR', message: '相册创建失败，请重试' } },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    // 返回创建结果
    return NextResponse.json({
      id: data.id,
      slug: data.slug,
      title: data.title,
      is_public: data.is_public,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/album/${data.slug}`,
    })
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
