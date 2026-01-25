import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * 公开相册分组 API
 * - GET: 获取相册的所有分组（访客可访问）
 */

// GET /api/public/albums/[slug]/groups - 获取分组列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    // 获取相册信息（使用 slug）
    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('id, is_public, deleted_at, expires_at')
      .eq('slug', slug)
      .single()

    if (albumError || !album) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 验证相册是否公开且未过期
    if (!album.is_public || album.deleted_at) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '无权访问此相册' } },
        { status: 403 }
      )
    }

    if (album.expires_at && new Date(album.expires_at) < new Date()) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '相册已过期' } },
        { status: 403 }
      )
    }

    // 获取分组列表
    const { data: groups, error: groupsError } = await supabase
      .from('photo_groups')
      .select('*')
      .eq('album_id', album.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (groupsError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: groupsError.message } },
        { status: 500 }
      )
    }

    // 获取每个分组的照片数量（只统计已完成且相册未删除的照片）
    const groupsWithCounts = await Promise.all(
      (groups || []).map(async (group) => {
        const { count } = await supabase
          .from('photo_group_assignments')
          .select(`
            photo_id,
            photos!inner(
              id,
              status,
              album_id,
              albums!inner(
                id,
                deleted_at
              )
            )
          `, { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('photos.status', 'completed')
          .is('albums.deleted_at', null)

        return {
          ...group,
          photo_count: count || 0,
        }
      })
    )

    // 只返回有照片的分组
    const groupsWithPhotos = groupsWithCounts.filter((g) => g.photo_count > 0)

    return NextResponse.json({ groups: groupsWithPhotos })
  } catch {
    console.error('Public groups API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
