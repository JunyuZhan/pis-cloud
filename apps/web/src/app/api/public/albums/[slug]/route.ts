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

    // 获取相册信息（包含密码字段，但不直接返回）
    const { data: album, error } = await supabase
      .from('albums')
      .select('id, title, description, layout, allow_download, show_exif, photo_count, password, expires_at, is_public, allow_share')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single()

    if (error || !album) {
      return NextResponse.json(
        { error: { code: 'ALBUM_NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 检查相册是否允许分享
    if (album.allow_share === false) {
      return NextResponse.json(
        { error: { code: 'ALBUM_NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 检查相册是否过期
    if (album.expires_at && new Date(album.expires_at) < new Date()) {
      return NextResponse.json(
        { error: { code: 'EXPIRED', message: '相册已过期' } },
        { status: 403 }
      )
    }

    // 检查是否需要密码（不返回密码本身，只返回是否需要密码）
    const requiresPassword = !!album.password

    // 返回相册信息（不包含密码）
    // 添加缓存头：公开相册缓存5分钟，私有相册不缓存
    const cacheHeaders: Record<string, string> = album.is_public
      ? {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        }
      : {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        }

    // 添加 ETag 支持（基于相册 ID 和更新时间）
    const etag = `"${album.id}-${album.expires_at || 'no-expiry'}"`
    cacheHeaders['ETag'] = etag

    // 检查 If-None-Match 头（客户端缓存验证）
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304, headers: cacheHeaders })
    }

    return NextResponse.json(
      {
        id: album.id,
        title: album.title,
        description: album.description,
        layout: album.layout,
        allow_download: album.allow_download,
        show_exif: album.show_exif,
        photo_count: album.photo_count,
        requires_password: requiresPassword,
        is_public: album.is_public,
      },
      { headers: cacheHeaders }
    )
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
