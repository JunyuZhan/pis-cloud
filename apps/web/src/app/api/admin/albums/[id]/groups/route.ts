import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PhotoGroupInsert } from '@/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 分组管理 API
 * - GET: 获取相册的所有分组
 * - POST: 创建新分组
 */

// GET /api/admin/albums/[id]/groups - 获取分组列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: albumId } = await params
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

    // 获取分组列表
    const { data: groups, error: groupsError } = await supabase
      .from('photo_groups')
      .select('*')
      .eq('album_id', albumId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (groupsError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: groupsError.message } },
        { status: 500 }
      )
    }

    // 获取每个分组的照片数量
    const groupsWithCounts = await Promise.all(
      (groups || []).map(async (group) => {
        const { count } = await supabase
          .from('photo_group_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)

        return {
          ...group,
          photo_count: count || 0,
        }
      })
    )

    return NextResponse.json({ groups: groupsWithCounts })
  } catch {
    console.error('Groups API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// POST /api/admin/albums/[id]/groups - 创建新分组
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: albumId } = await params
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

    // 解析请求体
    interface CreateRequestBody {
      name: string
      description?: string | null
      sort_order?: number
    }
    let body: CreateRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { name, description, sort_order } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '分组名称不能为空' } },
        { status: 400 }
      )
    }

    // 检查分组名称是否已存在
    const { data: existingGroup } = await supabase
      .from('photo_groups')
      .select('id')
      .eq('album_id', albumId)
      .eq('name', name.trim())
      .single()

    if (existingGroup) {
      return NextResponse.json(
        { error: { code: 'DUPLICATE_ERROR', message: '分组名称已存在' } },
        { status: 409 }
      )
    }

    // 创建分组
    const insertData: PhotoGroupInsert = {
      album_id: albumId,
      name: name.trim(),
      description: description?.trim() || null,
      sort_order: sort_order ?? 0,
    }

    const { data: newGroup, error: insertError } = await supabaseAdmin
      .from('photo_groups')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: insertError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      group: {
        ...newGroup,
        photo_count: 0,
      },
    })
  } catch {
    console.error('Create group API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
