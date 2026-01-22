import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * 访客相册 API
 * 获取相册的公开信息（不包含照片列表，照片列表由 photos 子路由处理）
 */

// GET /api/public/albums/[slug] - 获取相册信息
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    // 获取相册信息
    const { data: album, error } = await supabase
      .from('albums')
      .select('id, title, description, layout, allow_download, show_exif, photo_count')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single()

    if (error || !album) {
      return NextResponse.json(
        { error: { code: 'ALBUM_NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json(album)
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
