import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 批量重新生成预览图 API
 * POST /api/admin/photos/reprocess
 * 
 * 用途：
 * - 当预览图标准修改后，重新生成已上传照片的预览图
 * - 确保所有照片都使用最新的预览图标准
 */
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
    interface ReprocessRequestBody {
      photoIds?: string[] // 可选：指定要重新处理的照片ID，如果不提供则处理所有照片
      albumId?: string // 可选：指定相册ID，只处理该相册的照片
    }

    let body: ReprocessRequestBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }

    const { photoIds, albumId } = body

    // 构建查询：获取需要重新处理的照片（排除已删除的）
    // 支持处理 completed 和 failed 状态的照片
    let query = supabase
      .from('photos')
      .select('id, album_id, original_key, status')
      .in('status', ['completed', 'failed']) // 支持处理已完成和失败状态的照片
      .not('original_key', 'is', null) // 必须有原图
      .is('deleted_at', null) // 排除已删除的照片

    // 如果指定了照片ID，只处理这些照片
    if (photoIds && Array.isArray(photoIds) && photoIds.length > 0) {
      // 限制批量处理数量
      if (photoIds.length > 100) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: '单次最多重新处理100张照片' } },
          { status: 400 }
        )
      }
      query = query.in('id', photoIds)
    }

    // 如果指定了相册ID，只处理该相册的照片
    if (albumId) {
      query = query.eq('album_id', albumId)
    }

    // 如果没有指定任何条件，返回错误（防止误操作处理所有照片）
    if (!photoIds && !albumId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '请指定要重新处理的照片ID或相册ID' } },
        { status: 400 }
      )
    }

    const { data: photos, error: queryError } = await query

    if (queryError) {
      console.error('Query photos error:', queryError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: queryError.message } },
        { status: 500 }
      )
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要重新处理的照片',
        queued: 0,
      })
    }

    // 使用代理路由调用 Worker API 触发重新处理
    // 代理路由会自动处理 Worker URL 配置和认证
    const requestUrl = new URL(request.url)
    const protocol = requestUrl.protocol
    const host = requestUrl.host
    const proxyUrl = `http://localhost:3000/api/worker/process`

    // 批量添加到处理队列
    let queuedCount = 0
    let failedCount = 0
    const errors: string[] = []

    // 限制并发请求数量，避免过载
    const batchSize = 10
    for (let i = 0; i < photos.length; i += batchSize) {
      const batch = photos.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (photo) => {
          try {
            // 先将状态设置为 pending，以便重新处理
            await supabase
              .from('photos')
              .update({ status: 'pending' })
              .eq('id', photo.id)

            // 使用代理路由调用 Worker API 触发处理
            const headers: HeadersInit = {
              'Content-Type': 'application/json',
            }
            
            // 传递认证 cookie，代理路由会处理认证
            const cookieHeader = request.headers.get('cookie')
            if (cookieHeader) {
              headers['cookie'] = cookieHeader
            }
            
            const processRes = await fetch(proxyUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                photoId: photo.id,
                albumId: photo.album_id,
                originalKey: photo.original_key,
              }),
            })

            if (processRes.ok) {
              queuedCount++
            } else {
              failedCount++
              const errorText = await processRes.text()
              errors.push(`照片 ${photo.id}: ${errorText}`)
              // 恢复状态
              await supabase
                .from('photos')
                .update({ status: 'completed' })
                .eq('id', photo.id)
            }
          } catch (error) {
            failedCount++
            const errorMessage = error instanceof Error ? error.message : '未知错误'
            errors.push(`照片 ${photo.id}: ${errorMessage}`)
            // 恢复状态
            await supabase
              .from('photos')
              .update({ status: 'completed' })
              .eq('id', photo.id)
          }
        })
      )
    }

    return NextResponse.json({
      success: true,
      message: `已排队 ${queuedCount} 张照片重新处理`,
      queued: queuedCount,
      failed: failedCount,
      total: photos.length,
      ...(errors.length > 0 && { errors: errors.slice(0, 10) }), // 最多返回10个错误
    })
  } catch (err) {
    console.error('Reprocess photos API error:', err)
    const errorMessage = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误：' + errorMessage } },
      { status: 500 }
    )
  }
}
