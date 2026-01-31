import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 模板详情 API
 * - GET: 获取模板详情
 * - PATCH: 更新模板
 * - DELETE: 删除模板
 */

// GET /api/admin/templates/[id] - 获取模板详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

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
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '模板不存在' } },
        { status: 404 }
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

// PATCH /api/admin/templates/[id] - 更新模板
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

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
    interface UpdateTemplateRequestBody {
      name?: string
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
      watermark_config?: Record<string, unknown> | null
    }
    let body: UpdateTemplateRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const updateData: Record<string, string | boolean | number | Record<string, unknown> | null> = {}

    // 只更新提供的字段
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.is_public !== undefined) updateData.is_public = body.is_public
    if (body.layout !== undefined) updateData.layout = body.layout
    if (body.sort_rule !== undefined) updateData.sort_rule = body.sort_rule
    if (body.allow_download !== undefined) updateData.allow_download = body.allow_download
    if (body.allow_batch_download !== undefined) updateData.allow_batch_download = body.allow_batch_download
    if (body.show_exif !== undefined) updateData.show_exif = body.show_exif
    if (body.password !== undefined) updateData.password = body.password || null
    if (body.expires_at !== undefined) updateData.expires_at = body.expires_at || null
    if (body.watermark_enabled !== undefined) updateData.watermark_enabled = body.watermark_enabled
    if (body.watermark_type !== undefined) updateData.watermark_type = body.watermark_type || null
    if (body.watermark_config !== undefined) updateData.watermark_config = body.watermark_config || {}

    const { data, error } = await supabase
      .from('album_templates')
      .update(updateData)
      .eq('id', id)
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

// DELETE /api/admin/templates/[id] - 删除模板
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { status: 401 }
      )
    }

    const { error } = await supabase
      .from('album_templates')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: '模板已删除' })
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
