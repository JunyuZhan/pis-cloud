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

    // 优化：批量查询所有分组的照片数量，避免 N+1 查询问题
    const groupIds = (groups || []).map(g => g.id)
    
    const counts = new Map<string, number>()
    
    if (groupIds.length > 0) {
      // 批量查询所有分组的照片关联（只统计已完成且相册和照片都未删除的）
      const { data: assignments, error: assignmentsError } = await supabase
        .from('photo_group_assignments')
        .select(`
          group_id,
          photo_id,
          photos!inner(
            id,
            status,
            deleted_at,
            album_id,
            albums!inner(
              id,
              deleted_at
            )
          )
        `)
        .in('group_id', groupIds)
        .eq('photos.status', 'completed')
        .is('photos.deleted_at', null) // 排除已删除的照片
        .is('albums.deleted_at', null)

      if (assignmentsError) {
        console.error('Failed to fetch group assignments:', assignmentsError)
      } else if (assignments) {
        // 在前端聚合计数
        assignments.forEach((assignment: { group_id: string; photo_id: string }) => {
          const groupId = assignment.group_id
          counts.set(groupId, (counts.get(groupId) || 0) + 1)
        })
      }
    }

    // 为每个分组添加照片数量
    const groupsWithCounts = (groups || []).map(group => ({
      ...group,
      photo_count: counts.get(group.id) || 0,
    }))

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
