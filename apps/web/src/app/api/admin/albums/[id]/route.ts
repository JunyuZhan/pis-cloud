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
    interface UpdateAlbumRequestBody {
      title?: string
      description?: string | null
      cover_photo_id?: string | null
      is_public?: boolean
      is_live?: boolean
      layout?: 'masonry' | 'grid' | 'carousel'
      sort_rule?: 'capture_desc' | 'capture_asc' | 'manual'
      allow_download?: boolean
      allow_batch_download?: boolean
      show_exif?: boolean
      watermark_enabled?: boolean
      watermark_type?: 'text' | 'logo' | null
      watermark_config?: Record<string, unknown> | null
      password?: string | null
      expires_at?: string | null
      share_title?: string | null
      share_description?: string | null
      share_image_url?: string | null
      event_date?: string | null
      location?: string | null
    }
    let body: UpdateAlbumRequestBody
    try {
      body = await request.json()
    } catch (err) {
      console.error('Failed to parse request body:', err)
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误' } },
        { status: 400 }
      )
    }
    
    // 允许更新的字段白名单
    const allowedFields: (keyof AlbumUpdate)[] = [
      'title',
      'description',
      'cover_photo_id',
      'is_public',
      'is_live',
      'layout',
      'sort_rule',
      'allow_download',
      'allow_batch_download',
      'show_exif',
      'watermark_enabled',
      'watermark_type',
      'watermark_config',
      'password',
      'expires_at',
      'share_title',
      'share_description',
      'share_image_url',
      'event_date',
      'location',
    ]

    // 过滤只保留允许的字段
    const updateData: AlbumUpdate = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // 密码字段：如果为空字符串，设置为 null；否则保持原值
        if (field === 'password') {
          ;(updateData as Record<string, unknown>)[field] = body[field] === '' ? null : body[field]
        } else if (field === 'event_date' || field === 'expires_at') {
          // 时间戳字段：如果为空字符串或无效值，设置为 null
          const value = body[field]
          if (!value || value === '' || value.trim() === '') {
            ;(updateData as Record<string, unknown>)[field] = null
          } else {
            // 验证时间格式，如果是 ISO 格式的日期时间字符串，需要转换为完整的 ISO 格式
            try {
              const date = new Date(value)
              if (isNaN(date.getTime())) {
                ;(updateData as Record<string, unknown>)[field] = null
              } else {
                // 如果只有日期部分（YYYY-MM-DDTHH:mm），补充秒和时区
                if (value.length === 16) {
                  ;(updateData as Record<string, unknown>)[field] = date.toISOString()
                } else {
                  ;(updateData as Record<string, unknown>)[field] = value
                }
              }
            } catch {
              ;(updateData as Record<string, unknown>)[field] = null
            }
          }
        } else if (field === 'watermark_config') {
          // 确保 watermark_config 是有效的 JSON 对象
          if (body[field] !== null && typeof body[field] !== 'object') {
            console.error('Invalid watermark_config format:', body[field])
            return NextResponse.json(
              { error: { code: 'VALIDATION_ERROR', message: '水印配置格式错误' } },
              { status: 400 }
            )
          }
          ;(updateData as Record<string, unknown>)[field] = body[field]
        } else {
          ;(updateData as Record<string, unknown>)[field] = body[field]
        }
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

    // 同步照片计数（确保计数准确）
    const { count: actualPhotoCount } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('album_id', id)
      .eq('status', 'completed')
    
    if (actualPhotoCount !== null) {
      updateData.photo_count = actualPhotoCount
    }

    // 执行更新
    // 注意：水印配置变更后，只对新上传的照片生效
    // 已上传的照片不会被重新处理，避免数据库错误和性能问题
    // 水印配置会在照片上传时由 Worker 读取并应用
    const { data: album, error } = await supabase
      .from('albums')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      console.error('Database update error:', error)
      console.error('Update data:', JSON.stringify(updateData, null, 2))
      return NextResponse.json(
        { 
          error: { 
            code: 'DB_ERROR', 
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? JSON.stringify(error) : undefined,
          } 
        },
        { status: 500 }
      )
    }

    if (!album) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 注意：水印配置变更后，只对新上传的照片生效
    // 已上传的照片不会被重新处理，避免数据库错误和性能问题
    // 水印配置会在照片上传时由 Worker 读取并应用（见 services/worker/src/index.ts）

    return NextResponse.json({
      ...album,
      message: '设置已更新。水印配置将应用于之后上传的新照片。'
    })
  } catch (err) {
    console.error('PATCH /api/admin/albums/[id] error:', err)
    const errorMessage = err instanceof Error ? err.message : '未知错误'
    const errorStack = err instanceof Error ? err.stack : undefined
    
    return NextResponse.json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: '服务器错误',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
        } 
      },
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
    const { data: album, error } = await supabase
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
