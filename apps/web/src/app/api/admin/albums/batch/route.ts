import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 相册批量操作 API
 * DELETE /api/admin/albums/batch - 批量删除相册
 */

export async function DELETE(request: NextRequest) {
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
    interface DeleteBatchRequestBody {
      albumIds: string[]
    }
    let body: DeleteBatchRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { albumIds } = body

    if (!Array.isArray(albumIds) || albumIds.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '请选择要删除的相册' } },
        { status: 400 }
      )
    }

    // 限制批量删除数量
    if (albumIds.length > 50) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '单次最多删除50个相册' } },
        { status: 400 }
      )
    }

    // 验证相册存在且未删除
    const { data: albumsData, error: checkError } = await supabase
      .from('albums')
      .select('id, title')
      .in('id', albumIds)
      .is('deleted_at', null)

    if (checkError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: checkError.message } },
        { status: 500 }
      )
    }

    const validAlbums = albumsData as { id: string; title: string }[] | null
    const validAlbumIds = validAlbums?.map((a) => a.id) || []

    if (validAlbumIds.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '未找到有效的相册' } },
        { status: 404 }
      )
    }

    // 执行软删除
    const { error: deleteError } = await supabase
      .from('albums')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', validAlbumIds)
      .is('deleted_at', null)

    if (deleteError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: deleteError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deletedCount: validAlbumIds.length,
      message: `已删除 ${validAlbumIds.length} 个相册`,
    })
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/albums/batch - 批量更新相册
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

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
    interface UpdateBatchRequestBody {
      albumIds: string[]
      updates: {
        is_public?: boolean
        layout?: 'masonry' | 'grid' | 'carousel'
        sort_rule?: 'capture_desc' | 'capture_asc' | 'manual'
        allow_download?: boolean
        show_exif?: boolean
      }
    }
    let body: UpdateBatchRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { albumIds, updates } = body

    if (!Array.isArray(albumIds) || albumIds.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '请选择要更新的相册' } },
        { status: 400 }
      )
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '更新数据无效' } },
        { status: 400 }
      )
    }

    // 限制批量更新数量
    if (albumIds.length > 50) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '单次最多更新50个相册' } },
        { status: 400 }
      )
    }

    // 构建更新数据（只允许更新特定字段）
    const allowedFields = ['is_public', 'layout', 'sort_rule', 'allow_download', 'show_exif'] as const
    const updateData: Record<string, boolean | string> = {}
    
    for (const field of allowedFields) {
      const fieldValue = (updates as Record<string, unknown>)[field]
      if (fieldValue !== undefined) {
        updateData[field] = fieldValue as boolean | string
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '没有有效的更新字段' } },
        { status: 400 }
      )
    }

    // 执行批量更新
    const { error: updateError } = await supabase
      .from('albums')
      .update(updateData)
      .in('id', albumIds)
      .is('deleted_at', null)

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: updateError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      updatedCount: albumIds.length,
      message: `已更新 ${albumIds.length} 个相册`,
    })
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
