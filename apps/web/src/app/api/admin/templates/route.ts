import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AlbumTemplateInsert, Json } from '@/types/database'

/**
 * 模板管理 API
 * - GET: 获取所有模板
 * - POST: 创建新模板
 */

// GET /api/admin/templates - 获取模板列表
export async function GET() {
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

    const { data, error } = await supabase
      .from('album_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ templates: data || [] })
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// POST /api/admin/templates - 创建新模板
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
    interface CreateTemplateRequestBody {
      name: string
      description?: string | null
      is_public?: boolean
      layout?: 'masonry' | 'grid' | 'carousel'
      sort_rule?: 'capture_desc' | 'capture_asc' | 'manual'
      allow_download?: boolean
      allow_batch_download?: boolean
      show_exif?: boolean
      password?: string | null
      expires_at?: string | null
      watermark_enabled?: boolean
      watermark_type?: 'text' | 'logo' | null
      watermark_config?: Json
    }
    let body: CreateTemplateRequestBody
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
      name,
      description,
      is_public,
      layout,
      sort_rule,
      allow_download,
      allow_batch_download,
      show_exif,
      password,
      expires_at,
      watermark_enabled,
      watermark_type,
      watermark_config,
    } = body

    // 验证必填字段
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '模板名称不能为空' } },
        { status: 400 }
      )
    }

    // 构建插入数据
    const insertData: AlbumTemplateInsert = {
      name: name.trim(),
      description: description?.trim() || null,
      is_public: is_public ?? false,
      layout: layout || 'masonry',
      sort_rule: sort_rule || 'capture_desc',
      allow_download: allow_download ?? false,
      allow_batch_download: allow_batch_download ?? true,
      show_exif: show_exif ?? true,
      password: password || null,
      expires_at: expires_at || null,
      watermark_enabled: watermark_enabled ?? false,
      watermark_type: watermark_type || null,
      watermark_config: (watermark_config || {}) as Json,
    }

    const { data, error } = await supabase
      .from('album_templates')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
