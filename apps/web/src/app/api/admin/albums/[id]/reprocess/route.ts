import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 重新处理相册照片 API
 * 
 * @route POST /api/admin/albums/[id]/reprocess
 * 
 * @requestBody
 * {
 *   "apply_color_grading": true  // 可选，默认 true，是否应用调色配置
 * }
 * 
 * @returns
 * - 200: 成功加入处理队列
 *   {
 *     "message": "已加入处理队列",
 *     "total_photos": 25,
 *     "estimated_time": "2-3 分钟"
 *   }
 * - 400: 请求参数错误
 * - 401: 未授权
 * - 404: 相册不存在
 * - 500: 服务器错误
 * 
 * @security
 * - 需要用户认证（Supabase Auth）
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    interface ReprocessRequestBody {
      apply_color_grading?: boolean  // 是否应用调色配置
    }
    
    let body: ReprocessRequestBody = {}
    try {
      const bodyText = await request.text()
      if (bodyText) {
        body = JSON.parse(bodyText)
      }
    } catch {
      // 如果请求体为空或格式错误，使用默认值
      body = { apply_color_grading: true }
    }

    // apply_color_grading 参数保留用于未来扩展，当前总是应用调色配置
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _apply_color_grading = body.apply_color_grading ?? true

    // 验证相册存在
    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('id, photo_count')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (albumError || !album) {
      return NextResponse.json(
        { error: { code: 'ALBUM_NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 获取需要重新处理的照片
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('id, album_id, original_key, status')
      .eq('album_id', id)
      .in('status', ['completed', 'failed'])
      .not('original_key', 'is', null)
      .is('deleted_at', null)

    if (photosError) {
      console.error('Query photos error:', photosError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: photosError.message } },
        { status: 500 }
      )
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: { code: 'NO_PHOTOS', message: '相册中没有需要重新处理的照片' } },
        { status: 400 }
      )
    }

    // 使用现有的重新处理 API
    const reprocessUrl = new URL(request.url)
    reprocessUrl.pathname = '/api/admin/photos/reprocess'
    
    const reprocessResponse = await fetch(reprocessUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        albumId: id,
        photoIds: photos.map(p => p.id),
      }),
    })

    if (!reprocessResponse.ok) {
      const errorData = await reprocessResponse.json().catch(() => ({}))
      return NextResponse.json(
        { error: { code: 'REPROCESS_ERROR', message: errorData.error?.message || '重新处理失败' } },
        { status: reprocessResponse.status }
      )
    }

    const result = await reprocessResponse.json()

    // 估算处理时间（每张照片约 1-2 秒）
    const estimatedMinutes = Math.ceil(photos.length / 30)  // 假设每分钟处理 30 张

    return NextResponse.json({
      message: result.message || '已加入处理队列',
      total_photos: photos.length,
      estimated_time: estimatedMinutes <= 1 ? '1 分钟' : `${estimatedMinutes}-${estimatedMinutes + 1} 分钟`,
    })
  } catch (error) {
    console.error('[Album Reprocess API] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: errorMessage,
        },
      },
      { status: 500 }
    )
  }
}
