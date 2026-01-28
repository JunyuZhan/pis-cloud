import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 照片旋转 API
 * PATCH /api/admin/photos/[id]/rotate - 更新照片旋转角度
 */

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

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
    interface RotateRequestBody {
      rotation: number | null
    }
    let body: RotateRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { rotation } = body

    // 验证 rotation 值
    if (rotation !== null && rotation !== undefined && ![0, 90, 180, 270].includes(rotation)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '旋转角度必须是 0, 90, 180, 270 或 null' } },
        { status: 400 }
      )
    }

    // 验证照片存在且用户有权限访问（排除已删除的照片）
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select(`
        id,
        album_id,
        deleted_at,
        albums!inner (
          id,
          deleted_at
        )
      `)
      .eq('id', id)
      .is('deleted_at', null) // 排除已删除的照片
      .single()

    if (photoError || !photo) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '照片不存在或已被删除' } },
        { status: 404 }
      )
    }
    
    // 双重检查：确保照片未删除
    if (photo.deleted_at) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '照片已被删除，无法旋转' } },
        { status: 404 }
      )
    }

    // 更新旋转角度
    const { data: updatedPhoto, error: updateError } = await supabaseAdmin
      .from('photos')
      .update({ rotation: rotation === null ? null : rotation })
      .eq('id', id)
      .select('id, rotation')
      .single()

    if (updateError) {
      console.error('Failed to update photo rotation:', updateError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: '更新失败：' + updateError.message } },
        { status: 500 }
      )
    }

    // 如果照片状态是 completed，需要重新处理图片以应用新的旋转角度
    // 注意：只处理未删除的照片
    const { data: photoStatus } = await supabaseAdmin
      .from('photos')
      .select('status, album_id, original_key, deleted_at')
      .eq('id', id)
      .is('deleted_at', null) // 排除已删除的照片
      .single()
    
    // 如果照片已删除，不触发重新处理
    if (!photoStatus || photoStatus.deleted_at) {
      return NextResponse.json({
        success: true,
        data: updatedPhoto,
        message: '旋转角度已保存，但照片已删除，无法重新处理',
      })
    }

    // 只有 completed 状态的照片才需要重新处理以应用旋转
    // pending/processing 状态的照片会在处理时自动应用新的旋转角度
    // failed 状态的照片需要手动重新处理
    let needsReprocessing = false
    let reprocessingError: string | null = null
    
    if (photoStatus.status === 'completed' && photoStatus.original_key) {
      // 触发重新处理 - 直接调用 Worker API，使用环境变量中的 API key
      try {
        const workerApiUrl = process.env.WORKER_API_URL || process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
        const headers: HeadersInit = { 'Content-Type': 'application/json' }
        const workerApiKey = process.env.WORKER_API_KEY
        
        // 添加 Worker API Key 认证
        if (workerApiKey) {
          headers['X-API-Key'] = workerApiKey
          // 开发环境：添加调试日志
          if (process.env.NODE_ENV === 'development') {
            console.log('[Rotate API] Worker URL:', workerApiUrl)
            console.log('[Rotate API] API Key configured:', workerApiKey.substring(0, 8) + '...')
          }
        } else {
          // 开发环境：如果没有设置 API key，记录警告
          if (process.env.NODE_ENV === 'development') {
            console.warn('[Rotate API] WORKER_API_KEY not set, worker may reject the request if it requires authentication')
          }
        }
        
        const processRes = await fetch(`${workerApiUrl}/api/process`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            photoId: id,
            albumId: photoStatus.album_id,
            originalKey: photoStatus.original_key,
          }),
        })

        if (processRes.ok) {
          // Worker 确认收到任务后，才更新状态为 pending
          await supabaseAdmin
            .from('photos')
            .update({ status: 'pending' })
            .eq('id', id)
          needsReprocessing = true
        } else {
          const errorText = await processRes.text()
          console.error('[Rotate API] Worker process error:', errorText)
          try {
            const errorData = JSON.parse(errorText)
            const errorMsg = errorData.message || errorData.error || 'Worker API 调用失败'
            
            // 如果是认证错误，提供更友好的提示
            if (errorMsg.includes('API key') || errorMsg.includes('Unauthorized')) {
              reprocessingError = `Worker API 认证失败。请确保 .env 中的 WORKER_API_KEY 与 Worker 服务配置一致。当前 Worker URL: ${workerApiUrl}`
            } else {
              reprocessingError = errorMsg
            }
          } catch {
            reprocessingError = errorText || 'Worker API 调用失败'
          }
          // Worker 调用失败，保持原状态，旋转角度已保存，下次处理时会应用
        }
      } catch (err) {
        console.error('[Rotate API] Failed to trigger reprocessing:', err)
        const errorMsg = err instanceof Error ? err.message : 'Worker 服务不可用'
        
        // 如果是网络错误，提供更友好的提示
        if (errorMsg.includes('fetch failed') || errorMsg.includes('ECONNREFUSED')) {
          const workerApiUrl = process.env.WORKER_API_URL || process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
          reprocessingError = `无法连接到 Worker 服务 (${workerApiUrl})。请确保 Worker 服务正在运行。`
        } else {
          reprocessingError = errorMsg
        }
        // Worker 不可用时，保持原状态，旋转角度已保存
        // 可以通过手动重新处理或定时任务来应用旋转
      }
    }

    // 如果需要重新处理但失败了，返回错误信息
    if (photoStatus.status === 'completed' && !needsReprocessing && reprocessingError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'WORKER_ERROR',
          message: `旋转角度已保存，但无法触发重新处理：${reprocessingError}。请稍后手动重新生成预览图。`,
        },
        data: updatedPhoto,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: updatedPhoto,
      needsReprocessing,
    })
  } catch (err) {
    console.error('Photo rotation API error:', err)
    const errorMessage = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误：' + errorMessage } },
      { status: 500 }
    )
  }
}
