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

    // 验证照片存在且用户有权限访问
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select(`
        id,
        album_id,
        albums!inner (
          id,
          deleted_at
        )
      `)
      .eq('id', id)
      .single()

    if (photoError || !photo) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '照片不存在' } },
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
    const { data: photoStatus } = await supabaseAdmin
      .from('photos')
      .select('status, album_id, original_key')
      .eq('id', id)
      .single()

    if (photoStatus?.original_key) {
      // 触发重新处理
      try {
        const workerApiUrl = process.env.WORKER_API_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
        const processRes = await fetch(`${workerApiUrl}/api/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        } else {
          console.error('Worker process error:', await processRes.text())
          // Worker 调用失败，保持原状态，旋转角度已保存，下次处理时会应用
        }
      } catch {
        console.error('Failed to trigger reprocessing:')
        // Worker 不可用时，保持原状态，旋转角度已保存
        // 可以通过手动重新处理或定时任务来应用旋转
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedPhoto,
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
