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
  } catch {
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
      color_grading?: { preset?: string } | null  // 新增：调色配置
      password?: string | null
      expires_at?: string | null
      share_title?: string | null
      share_description?: string | null
      share_image_url?: string | null
      poster_image_url?: string | null
      event_date?: string | null
      location?: string | null
    }
    let body: UpdateAlbumRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
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
      'allow_share',
      'watermark_enabled',
      'watermark_type',
      'watermark_config',
      'color_grading',  // 新增：调色配置
      'password',
      'expires_at',
      'share_title',
      'share_description',
      'share_image_url',
      'poster_image_url',
      'event_date',
      'location',
    ]

    // 过滤只保留允许的字段
    const updateData: AlbumUpdate = {}
    for (const field of allowedFields) {
      if ((body as Record<string, unknown>)[field] !== undefined) {
        // 密码字段：如果为空字符串，设置为 null；否则保持原值
        if (field === 'password') {
          const passwordValue = (body as Record<string, unknown>)[field]
          ;(updateData as Record<string, unknown>)[field] = passwordValue === '' ? null : passwordValue
        } else if (field === 'event_date' || field === 'expires_at') {
          // 时间戳字段：如果为空字符串或无效值，设置为 null
          const value = (body as Record<string, unknown>)[field] as string | undefined
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
          const watermarkConfigValue = (body as Record<string, unknown>)[field]
          if (watermarkConfigValue !== null && typeof watermarkConfigValue !== 'object') {
            console.error('Invalid watermark_config format:', watermarkConfigValue)
            return NextResponse.json(
              { error: { code: 'VALIDATION_ERROR', message: '水印配置格式错误' } },
              { status: 400 }
            )
          }
          
          // 验证水印配置内容
          if (watermarkConfigValue && typeof watermarkConfigValue === 'object') {
            const config = watermarkConfigValue as Record<string, unknown>
            
            // 验证新格式（watermarks 数组）
            if (config.watermarks && Array.isArray(config.watermarks)) {
              if (config.watermarks.length > 6) {
                return NextResponse.json(
                  { error: { code: 'VALIDATION_ERROR', message: '最多支持6个水印' } },
                  { status: 400 }
                )
              }
              
              for (const wm of config.watermarks) {
                if (typeof wm !== 'object' || wm === null) {
                  return NextResponse.json(
                    { error: { code: 'VALIDATION_ERROR', message: '水印配置项格式错误' } },
                    { status: 400 }
                  )
                }
                
                const watermark = wm as Record<string, unknown>
                
                // 验证类型
                if (watermark.type !== 'text' && watermark.type !== 'logo') {
                  return NextResponse.json(
                    { error: { code: 'VALIDATION_ERROR', message: '水印类型必须是 text 或 logo' } },
                    { status: 400 }
                  )
                }
                
                // 验证文字水印
                if (watermark.type === 'text' && (!watermark.text || typeof watermark.text !== 'string' || !watermark.text.trim())) {
                  return NextResponse.json(
                    { error: { code: 'VALIDATION_ERROR', message: '文字水印内容不能为空' } },
                    { status: 400 }
                  )
                }
                
                // 验证 Logo 水印
                if (watermark.type === 'logo' && (!watermark.logoUrl || typeof watermark.logoUrl !== 'string' || !watermark.logoUrl.trim())) {
                  return NextResponse.json(
                    { error: { code: 'VALIDATION_ERROR', message: 'Logo URL 不能为空' } },
                    { status: 400 }
                  )
                }
                
                // 验证透明度
                if (watermark.opacity !== undefined) {
                  const opacity = typeof watermark.opacity === 'number' ? watermark.opacity : parseFloat(String(watermark.opacity))
                  if (isNaN(opacity) || opacity < 0 || opacity > 1) {
                    return NextResponse.json(
                      { error: { code: 'VALIDATION_ERROR', message: '透明度必须在 0-1 之间' } },
                      { status: 400 }
                    )
                  }
                }
              }
            }
          }
          
          ;(updateData as Record<string, unknown>)[field] = watermarkConfigValue
        } else if (field === 'color_grading') {
          // 验证调色配置格式
          const colorGradingValue = (body as Record<string, unknown>)[field]
          
          // null 是允许的（表示无风格）
          if (colorGradingValue === null) {
            ;(updateData as Record<string, unknown>)[field] = null
          } else if (colorGradingValue !== undefined) {
            // 必须是对象
            if (typeof colorGradingValue !== 'object' || colorGradingValue === null) {
              return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '调色配置格式错误' } },
                { status: 400 }
              )
            }
            
            const config = colorGradingValue as Record<string, unknown>
            
            // 必须包含 preset 字段
            if (!config.preset || typeof config.preset !== 'string') {
              return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '调色配置必须包含 preset 字段' } },
                { status: 400 }
              )
            }
            
            // 预设 ID 不能为空
            if (config.preset.trim() === '') {
              return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '预设 ID 不能为空' } },
                { status: 400 }
              )
            }
            
            // 验证预设 ID 是否有效（可选，如果需要严格校验）
            // 这里只做基本格式校验，具体预设 ID 的验证在数据库层面完成
            
            ;(updateData as Record<string, unknown>)[field] = colorGradingValue
          }
        } else if (field === 'share_image_url') {
          // 验证分享图片URL格式和安全性
          const shareImageUrl = (body as Record<string, unknown>)[field] as string | null | undefined
          if (shareImageUrl && shareImageUrl.trim()) {
            try {
              const url = new URL(shareImageUrl.trim())
              // 只允许 http 和 https 协议
              if (!['http:', 'https:'].includes(url.protocol)) {
                return NextResponse.json(
                  { error: { code: 'VALIDATION_ERROR', message: '分享图片URL必须使用 http 或 https 协议' } },
                  { status: 400 }
                )
              }
              // 检查是否为内网地址（SSRF 防护）
              const hostname = url.hostname.toLowerCase()
              const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
              const isPrivateIP = 
                hostname.startsWith('192.168.') ||
                hostname.startsWith('10.') ||
                (hostname.startsWith('172.') && 
                 parseInt(hostname.split('.')[1] || '0') >= 16 && 
                 parseInt(hostname.split('.')[1] || '0') <= 31) ||
                hostname.endsWith('.local')
              
              if (isLocalhost || isPrivateIP) {
                return NextResponse.json(
                  { error: { code: 'VALIDATION_ERROR', message: '分享图片URL不能使用内网地址' } },
                  { status: 400 }
                )
              }
              
              ;(updateData as Record<string, unknown>)[field] = shareImageUrl.trim()
            } catch {
              return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '分享图片URL格式无效' } },
                { status: 400 }
              )
            }
          } else {
            // 空字符串或null，设置为null
            ;(updateData as Record<string, unknown>)[field] = null
          }
        } else if (field === 'poster_image_url') {
          // 验证海报图片URL格式和安全性（与share_image_url相同的验证逻辑）
          const posterImageUrl = (body as Record<string, unknown>)[field] as string | null | undefined
          if (posterImageUrl && posterImageUrl.trim()) {
            try {
              const url = new URL(posterImageUrl.trim())
              // 只允许 http 和 https 协议
              if (!['http:', 'https:'].includes(url.protocol)) {
                return NextResponse.json(
                  { error: { code: 'VALIDATION_ERROR', message: '海报图片URL必须使用 http 或 https 协议' } },
                  { status: 400 }
                )
              }
              // 检查是否为内网地址（SSRF 防护）
              const hostname = url.hostname.toLowerCase()
              const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
              const isPrivateIP =
                hostname.startsWith('192.168.') ||
                hostname.startsWith('10.') ||
                (hostname.startsWith('172.') &&
                  parseInt(hostname.split('.')[1] || '0') >= 16 &&
                  parseInt(hostname.split('.')[1] || '0') <= 31) ||
                hostname.endsWith('.local')

              if (isLocalhost || isPrivateIP) {
                return NextResponse.json(
                  { error: { code: 'VALIDATION_ERROR', message: '海报图片URL不能使用内网地址' } },
                  { status: 400 }
                )
              }

              ;(updateData as Record<string, unknown>)[field] = posterImageUrl.trim()
            } catch {
              return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '海报图片URL格式无效' } },
                { status: 400 }
              )
            }
          } else {
            // 空字符串或null，设置为null
            ;(updateData as Record<string, unknown>)[field] = null
          }
        } else if (field === 'share_title' || field === 'share_description') {
          // 分享标题和描述：空字符串转换为 null
          const value = (body as Record<string, unknown>)[field] as string | null | undefined
          ;(updateData as Record<string, unknown>)[field] = (value && value.trim()) ? value.trim() : null
        } else {
          ;(updateData as Record<string, unknown>)[field] = (body as Record<string, unknown>)[field]
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

    // 同步照片计数（确保计数准确，排除已删除的）
    const { count: actualPhotoCount } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('album_id', id)
      .eq('status', 'completed')
      .is('deleted_at', null)
    
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
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
