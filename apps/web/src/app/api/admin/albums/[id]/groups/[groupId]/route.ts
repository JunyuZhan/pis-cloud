import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PhotoGroupUpdate } from '@/types/database'

interface RouteParams {
  params: Promise<{ id: string; groupId: string }>
}

/**
 * 分组操作 API
 * - GET: 获取分组详情
 * - PATCH: 更新分组
 * - DELETE: 删除分组
 */

// GET /api/admin/albums/[id]/groups/[groupId] - 获取分组详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: albumId, groupId } = await params
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

    // 验证相册存在
    const { data: album } = await supabase
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (!album) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 获取分组详情
    const { data: group, error: groupError } = await supabase
      .from('photo_groups')
      .select('*')
      .eq('id', groupId)
      .eq('album_id', albumId)
      .single()

    if (groupError || !group) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '分组不存在' } },
        { status: 404 }
      )
    }

    // 获取照片数量
    const { count } = await supabase
      .from('photo_group_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)

    return NextResponse.json({
      group: {
        ...group,
        photo_count: count || 0,
      },
    })
  } catch {
    console.error('Get group API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/albums/[id]/groups/[groupId] - 更新分组
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: albumId, groupId } = await params
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

    // 验证相册存在
    const { data: album } = await supabase
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (!album) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 验证分组存在
    const { data: group } = await supabase
      .from('photo_groups')
      .select('id')
      .eq('id', groupId)
      .eq('album_id', albumId)
      .single()

    if (!group) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '分组不存在' } },
        { status: 404 }
      )
    }

    // 解析请求体
    interface UpdateRequestBody {
      name?: string
      description?: string | null
      sort_order?: number
    }
    let body: UpdateRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const updateData: PhotoGroupUpdate = {}

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: '分组名称不能为空' } },
          { status: 400 }
        )
      }

      // 检查名称是否与其他分组重复
      const { data: existingGroup } = await supabase
        .from('photo_groups')
        .select('id')
        .eq('album_id', albumId)
        .eq('name', body.name.trim())
        .neq('id', groupId)
        .single()

      if (existingGroup) {
        return NextResponse.json(
          { error: { code: 'DUPLICATE_ERROR', message: '分组名称已存在' } },
          { status: 409 }
        )
      }

      updateData.name = body.name.trim()
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null
    }

    if (body.sort_order !== undefined) {
      updateData.sort_order = Number(body.sort_order)
    }

    // 更新分组
    const { data: updatedGroup, error: updateError } = await supabaseAdmin
      .from('photo_groups')
      .update(updateData)
      .eq('id', groupId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: updateError.message } },
        { status: 500 }
      )
    }

    // 获取照片数量
    const { count } = await supabase
      .from('photo_group_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)

    return NextResponse.json({
      group: {
        ...updatedGroup,
        photo_count: count || 0,
      },
    })
  } catch {
    console.error('Update group API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/albums/[id]/groups/[groupId] - 删除分组
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: albumId, groupId } = await params
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

    // 验证相册存在
    const { data: album } = await supabase
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (!album) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 验证分组存在
    const { data: group } = await supabase
      .from('photo_groups')
      .select('id')
      .eq('id', groupId)
      .eq('album_id', albumId)
      .single()

    if (!group) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '分组不存在' } },
        { status: 404 }
      )
    }

    // 删除分组（关联的照片会自动解除关联，因为外键设置了 ON DELETE CASCADE）
    const { error: deleteError } = await supabaseAdmin
      .from('photo_groups')
      .delete()
      .eq('id', groupId)

    if (deleteError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: deleteError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    console.error('Delete group API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
