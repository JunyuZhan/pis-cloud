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
    let body: any
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

    // 4. 如果水印配置发生变化，触发旧照片重处理
    // 让我们在 UPDATE 之前先查询当前相册的配置
    const { data: currentAlbum } = await supabase
      .from('albums')
      .select('watermark_enabled, watermark_type, watermark_config')
      .eq('id', id)
      .single();
      
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

    // 检查水印是否变更
    let watermarkChanged = false;
    if (currentAlbum) {
      const oldConfig = JSON.stringify(currentAlbum.watermark_config);
      const newConfig = JSON.stringify(album.watermark_config);
      
      watermarkChanged = 
        currentAlbum.watermark_enabled !== album.watermark_enabled ||
        currentAlbum.watermark_type !== album.watermark_type ||
        oldConfig !== newConfig;
    }

    if (watermarkChanged) {
      // 查找该相册下所有已完成的照片
      const { data: photos } = await supabase
        .from('photos')
        .select('id, original_key')
        .eq('album_id', id)
        .eq('status', 'completed');

      if (photos && photos.length > 0) {
        // 重置状态为 processing
        await supabase
          .from('photos')
          .update({ status: 'processing' })
          .eq('album_id', id)
          .eq('status', 'completed');

        // 发送重处理请求给 Worker
        const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001';
        
        // 异步批量触发，不阻塞响应
        Promise.allSettled(photos.map(photo => 
          fetch(`${workerUrl}/api/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              photoId: photo.id,
              albumId: id,
              originalKey: photo.original_key
            })
          })
        )).catch(console.error);
      }
    }

    return NextResponse.json({
      ...album,
      message: watermarkChanged ? '设置已更新，正在后台重新生成水印...' : '设置已更新'
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
