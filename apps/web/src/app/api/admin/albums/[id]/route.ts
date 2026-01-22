import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AlbumUpdate } from '@/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 单相册管理 API
 * - GET: 获取相册详情
 * - PATCH: 更新相册设置
 * - DELETE: 软删除相册
 */

// GET /api/admin/albums/[id] - 获取相册详情
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // 获取相册详情（含照片数量）
    const { data: album, error } = await supabase
      .from('albums')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !album) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json(album)
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/albums/[id] - 更新相册设置
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const body = await request.json()
    
    // 允许更新的字段白名单
    const allowedFields: (keyof AlbumUpdate)[] = [
      'title',
      'description',
      'cover_photo_id',
      'is_public',
      'layout',
      'sort_rule',
      'allow_download',
      'show_exif',
      'watermark_enabled',
      'watermark_type',
      'watermark_config',
    ]

    // 过滤只保留允许的字段
    const updateData: AlbumUpdate = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        ;(updateData as Record<string, unknown>)[field] = body[field]
      }
    }

    // 验证必要字段
    if (updateData.title !== undefined && !updateData.title.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '相册标题不能为空' } },
        { status: 400 }
      )
    }

    // 验证布局类型
    if (updateData.layout && !['masonry', 'grid', 'carousel'].includes(updateData.layout)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '无效的布局类型' } },
        { status: 400 }
      )
    }

    // 验证排序规则
    if (updateData.sort_rule && !['capture_desc', 'capture_asc', 'manual'].includes(updateData.sort_rule)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '无效的排序规则' } },
        { status: 400 }
      )
    }

    // 执行更新
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: album, error } = await (supabase as any)
      .from('albums')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    if (!album) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json(album)
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/albums/[id] - 软删除相册
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

    // 软删除：设置 deleted_at 时间戳
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: album, error } = await (supabase as any)
      .from('albums')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, title')
      .single()

    if (error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    if (!album) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在或已删除' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `相册「${album.title}」已删除`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
