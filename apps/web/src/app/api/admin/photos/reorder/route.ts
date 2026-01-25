import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 照片排序 API
 * PATCH /api/admin/photos/reorder - 批量更新照片排序
 */
export async function PATCH(request: NextRequest) {
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
    interface ReorderRequestBody {
      albumId: string
      orders: Array<{ photoId: string; sortOrder: number }>
    }
    let body: ReorderRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { albumId, orders } = body

    // 验证参数
    if (!albumId || typeof albumId !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '缺少相册ID' } },
        { status: 400 }
      )
    }

    if (!Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '排序数据不能为空' } },
        { status: 400 }
      )
    }

    // 验证排序数据格式
    for (const item of orders) {
      if (!item.photoId || typeof item.sortOrder !== 'number') {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: '排序数据格式错误' } },
          { status: 400 }
        )
      }
    }

    // 限制批量操作数量
    if (orders.length > 500) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '单次最多更新500张照片排序' } },
        { status: 400 }
      )
    }

    // 验证相册存在
    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (albumError || !album) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 批量更新排序
    // 使用事务确保原子性
    const photoIds = orders.map((o) => o.photoId)

    // 先验证所有照片都属于该相册
    const { data: photos, error: checkError } = await supabase
      .from('photos')
      .select('id')
      .eq('album_id', albumId)
      .in('id', photoIds)

    if (checkError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: checkError.message } },
        { status: 500 }
      )
    }

    const validPhotoIds = new Set(photos?.map((p) => p.id) || [])
    const invalidIds = photoIds.filter((id) => !validPhotoIds.has(id))

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: `部分照片不属于该相册: ${invalidIds.slice(0, 5).join(', ')}...` 
          } 
        },
        { status: 400 }
      )
    }

    // 执行批量更新
    const updatePromises = orders.map((item) =>
      supabase
        .from('photos')
        .update({ sort_order: item.sortOrder })
        .eq('id', item.photoId)
        .eq('album_id', albumId)
    )

    const results = await Promise.all(updatePromises)

    // 检查是否有失败
    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: '部分更新失败' } },
        { status: 500 }
      )
    }

    // 更新相册的 sort_rule 为 manual
    await supabase
      .from('albums')
      .update({ sort_rule: 'manual' })
      .eq('id', albumId)

    return NextResponse.json({
      success: true,
      updatedCount: orders.length,
      message: `已更新 ${orders.length} 张照片的排序`,
    })
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
