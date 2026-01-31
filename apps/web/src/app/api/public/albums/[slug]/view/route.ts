import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * 增加相册浏览次数
 * POST /api/public/albums/[slug]/view
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    // 获取相册ID
    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single()

    if (albumError || !album) {
      return NextResponse.json(
        { error: { code: 'ALBUM_NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 增加浏览次数（使用原子操作避免并发问题）
    // 先尝试使用RPC函数
    const { error: rpcError } = await supabase.rpc('increment_album_view_count', {
      album_id: album.id,
    })

    let newViewCount: number

    // 如果RPC函数不存在，使用降级方案：先查询当前值，然后更新
    if (rpcError) {
      const { data: currentAlbum } = await supabase
        .from('albums')
        .select('view_count')
        .eq('id', album.id)
        .single()

      if (currentAlbum) {
        newViewCount = (currentAlbum.view_count || 0) + 1
        await supabase
          .from('albums')
          .update({ view_count: newViewCount })
          .eq('id', album.id)
      } else {
        newViewCount = 1
      }
    } else {
      // RPC成功，查询更新后的值
      const { data: updatedAlbum } = await supabase
        .from('albums')
        .select('view_count')
        .eq('id', album.id)
        .single()
      
      newViewCount = updatedAlbum?.view_count || 1
    }

    return NextResponse.json({ success: true, view_count: newViewCount })
  } catch {
    console.error('View count increment error:')
    // 即使出错，也尝试查询当前的 view_count 返回
    try {
      const { slug } = await params
      const supabase = await createClient()
      const { data: album } = await supabase
        .from('albums')
        .select('view_count')
        .eq('slug', slug)
        .is('deleted_at', null)
        .single()
      
      return NextResponse.json({ 
        success: false, 
        view_count: album?.view_count || 0,
        error: 'Failed to increment view count'
      })
    } catch {
      return NextResponse.json({ 
        success: false, 
        view_count: 0,
        error: 'Failed to query view count'
      })
    }
  }
}
