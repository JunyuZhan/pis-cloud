import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 清理上传失败的照片记录
 * DELETE /api/admin/photos/[id]/cleanup
 * 用于在上传失败时删除pending状态的记录
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

    // 查询照片记录
    const adminClient = createAdminClient()
    const { data: photo, error: fetchError } = await adminClient
      .from('photos')
      .select('id, status, album_id')
      .eq('id', photoId)
      .single()

    if (fetchError || !photo) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '照片不存在' } },
        { status: 404 }
      )
    }

    // 只允许删除pending或failed状态的照片（上传失败的记录）
    if (photo.status !== 'pending' && photo.status !== 'failed') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATUS', message: '只能清理pending或failed状态的照片' } },
        { status: 400 }
      )
    }

    // 删除记录
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

    return NextResponse.json({
      success: true,
      message: '照片记录已清理',
    })
  } catch {
    console.error('Cleanup API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
