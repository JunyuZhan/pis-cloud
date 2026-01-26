import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

/**
 * 恢复已删除的照片
 * POST /api/admin/photos/restore
 * 
 * 请求体：
 * {
 *   photoIds: string[]  // 要恢复的照片ID数组
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

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
    interface RestorePhotosRequestBody {
      photoIds: string[]
    }
    let body: RestorePhotosRequestBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }

    const { photoIds } = body

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '请选择要恢复的照片' } },
        { status: 400 }
      )
    }

    // 限制批量恢复数量
    if (photoIds.length > 100) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '单次最多恢复100张照片' } },
        { status: 400 }
      )
    }

    // 验证照片存在且已删除
    const { data: deletedPhotos, error: checkError } = await adminClient
      .from('photos')
      .select('id, album_id, deleted_at')
      .in('id', photoIds)
      .not('deleted_at', 'is', null)

    if (checkError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: checkError.message } },
        { status: 500 }
      )
    }

    if (!deletedPhotos || deletedPhotos.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '未找到已删除的照片' } },
        { status: 404 }
      )
    }

    const validPhotoIds = deletedPhotos.map(p => p.id)

    // 恢复照片：清除 deleted_at
    const { error: restoreError } = await adminClient
      .from('photos')
      .update({ deleted_at: null })
      .in('id', validPhotoIds)

    if (restoreError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: restoreError.message } },
        { status: 500 }
      )
    }

    // 更新相册照片计数（重新统计 completed 状态且未删除的照片）
    const albumIds = [...new Set(deletedPhotos.map(p => p.album_id))]
    for (const albumId of albumIds) {
      const { count: actualPhotoCount } = await adminClient
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('album_id', albumId)
        .eq('status', 'completed')
        .is('deleted_at', null)

      await adminClient
        .from('albums')
        .update({ photo_count: actualPhotoCount ?? 0 })
        .eq('id', albumId)
    }

    return NextResponse.json({
      success: true,
      restoredCount: validPhotoIds.length,
      message: `已恢复 ${validPhotoIds.length} 张照片`,
    })
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
