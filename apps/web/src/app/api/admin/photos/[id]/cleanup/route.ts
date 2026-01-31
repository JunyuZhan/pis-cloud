import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 清理上传失败的照片记录
 * DELETE /api/admin/photos/[id]/cleanup
 * 
 * 协调机制：
 * 1. 删除数据库记录（如果存在）
 * 2. 清理 MinIO 中的原图文件（如果存在）
 * 3. Worker 队列中的任务会自动跳过（因为记录不存在）
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: photoId } = await params
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

    // 查询照片记录（获取 original_key 用于清理 MinIO 文件）
    const adminClient = createAdminClient()
    const { data: photo, error: fetchError } = await adminClient
      .from('photos')
      .select('id, status, album_id, original_key')
      .eq('id', photoId)
      .single()

    // 如果记录不存在，可能已经被清理，返回成功
    if (fetchError || !photo) {
      return NextResponse.json({
        success: true,
        message: '照片记录不存在（可能已被清理）',
      })
    }

    // 只允许删除pending或failed状态的照片（上传失败或处理失败的记录）
    // 注意：processing 状态的照片正在处理中，不应该被清理
    // 如果 processing 状态的照片卡住了，应该由 Worker 的恢复机制处理，而不是手动清理
    if (!['pending', 'failed'].includes(photo.status)) {
      return NextResponse.json(
        { error: { code: 'INVALID_STATUS', message: `只能清理pending或failed状态的照片，当前状态：${photo.status}。processing状态的照片正在处理中，请等待处理完成或由系统自动恢复。` } },
        { status: 400 }
      )
    }

    // 1. 清理 MinIO 中的原图文件（如果存在）
    if (photo.original_key) {
      try {
        // 使用代理路由调用 Worker API
        // 代理路由会自动处理 Worker URL 配置和认证
        const requestUrl = new URL(request.url)
        const protocol = requestUrl.protocol
        const host = requestUrl.host
        const proxyUrl = `http://localhost:3000/api/worker/cleanup-file`
        
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        }
        
        // 传递认证 cookie，代理路由会处理认证
        const cookieHeader = request.headers.get('cookie')
        if (cookieHeader) {
          headers['cookie'] = cookieHeader
        }
        
        const cleanupRes = await fetch(proxyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ key: photo.original_key }),
        })
        
        if (cleanupRes.ok) {
          console.log(`[Cleanup] MinIO file deleted: ${photo.original_key}`)
        } else {
          console.warn(`[Cleanup] Failed to delete MinIO file: ${photo.original_key}`)
        }
      } catch (cleanupErr) {
        // MinIO 清理失败不影响数据库清理
        console.warn(`[Cleanup] Error cleaning MinIO file:`, cleanupErr)
      }
    }

    // 2. 删除数据库记录
    const { error: deleteError } = await adminClient
      .from('photos')
      .delete()
      .eq('id', photoId)

    if (deleteError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: deleteError.message } },
        { status: 500 }
      )
    }

    console.log(`[Cleanup] Photo record deleted: ${photoId}, status was: ${photo.status}`)

    return NextResponse.json({
      success: true,
      message: '照片记录和文件已清理',
    })
  } catch (error) {
    console.error('[Cleanup] API error:', error)
    const errorMessage = error instanceof Error ? error.message : '服务器错误'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: errorMessage } },
      { status: 500 }
    )
  }
}
