import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ id: string; groupId: string }>
}

/**
 * 照片分组分配 API
 * - GET: 获取分组中的所有照片ID
 * - POST: 将照片分配到分组
 * - DELETE: 从分组移除照片
 */

// GET /api/admin/albums/[id]/groups/[groupId]/photos - 获取分组中的照片ID列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: albumId, groupId } = await params
    const supabase = await createClient()

    // 验证登录状态（管理员）或公开访问（访客）
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // 验证相册存在
    const { data: album } = await supabase
      .from('albums')
      .select('id, user_id, is_public')
      .eq('id', albumId)
      .single()

    if (!album) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 验证权限：管理员或公开相册的访客
    if (user && album.user_id === user.id) {
      // 管理员可以访问
    } else if (album.is_public) {
      // 公开相册的访客可以访问
    } else {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '无权访问此相册' } },
        { status: 403 }
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

    // 获取分组中的照片ID列表
    const { data: assignments, error: assignmentsError } = await supabase
      .from('photo_group_assignments')
      .select('photo_id')
      .eq('group_id', groupId)

    if (assignmentsError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: assignmentsError.message } },
        { status: 500 }
      )
    }

    const photoIds = (assignments || []).map((a) => a.photo_id)

    return NextResponse.json({ photo_ids: photoIds })
  } catch {
    console.error('Get group photos API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// POST /api/admin/albums/[id]/groups/[groupId]/photos - 分配照片到分组
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    interface PostRequestBody {
      photo_ids: string[]
    }
    let body: PostRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { photo_ids } = body

    if (!Array.isArray(photo_ids) || photo_ids.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '请提供照片ID数组' } },
        { status: 400 }
      )
    }

    // 验证所有照片都属于该相册
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('id')
      .eq('album_id', albumId)
      .in('id', photo_ids)

    if (photosError || !photos || photos.length !== photo_ids.length) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '部分照片不存在或不属于此相册' } },
        { status: 400 }
      )
    }

    // 批量插入分组关联（忽略已存在的关联）
    const assignments = photo_ids.map((photoId: string) => ({
      photo_id: photoId,
      group_id: groupId,
    }))

    const { error: insertError } = await supabaseAdmin
      .from('photo_group_assignments')
      .upsert(assignments, { onConflict: 'photo_id,group_id' })

    if (insertError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: insertError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      assigned_count: photo_ids.length,
    })
  } catch {
    console.error('Assign photos API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/albums/[id]/groups/[groupId]/photos - 从分组移除照片
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

    // 解析请求体
    interface DeleteRequestBody {
      photo_ids: string[]
    }
    let body: DeleteRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { photo_ids } = body

    if (!Array.isArray(photo_ids) || photo_ids.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '请提供照片ID数组' } },
        { status: 400 }
      )
    }

    // 删除分组关联
    const { error: deleteError } = await supabaseAdmin
      .from('photo_group_assignments')
      .delete()
      .eq('group_id', groupId)
      .in('photo_id', photo_ids)

    if (deleteError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: deleteError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      removed_count: photo_ids.length,
    })
  } catch {
    console.error('Remove photos API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
