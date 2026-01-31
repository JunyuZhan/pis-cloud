import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAlbumShareUrl } from '@/lib/utils'
import type { AlbumInsert, Database } from '@/types/database'

type Album = Database['public']['Tables']['albums']['Row']

interface RouteParams {
  params: Promise<{ id: string }>
}

// 静态导出模式下跳过此路由
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/albums/[id]/duplicate - 复制相册
 * 复制相册的所有配置，但不复制照片
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
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

    // 获取原相册信息
    const { data: originalAlbum, error: albumError } = await supabase
      .from('albums')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (albumError || !originalAlbum) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 构建新相册数据（复制所有配置，但不复制照片）
    const album = originalAlbum as Album
    const newAlbumData: AlbumInsert = {
      title: `${album.title} (副本)`,
      description: album.description,
      is_public: album.is_public,
      layout: album.layout,
      sort_rule: album.sort_rule,
      allow_download: album.allow_download,
      allow_batch_download: album.allow_batch_download,
      show_exif: album.show_exif,
      allow_share: album.allow_share ?? true,
      password: album.password || null,
      expires_at: album.expires_at || null,
      watermark_enabled: album.watermark_enabled,
      watermark_type: album.watermark_type,
      watermark_config: album.watermark_config,
      share_title: album.share_title || null,
      share_description: album.share_description || null,
      share_image_url: album.share_image_url || null,
      // 不复制封面和照片
      cover_photo_id: null,
      photo_count: 0,
      selected_count: 0,
      view_count: 0,
    }

    // 创建新相册
    const { data: newAlbum, error: createError } = await supabase
      .from('albums')
      .insert(newAlbumData)
      .select()
      .single()

    if (createError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: createError.message } },
        { status: 500 }
      )
    }

    // 生成分享URL（添加错误处理）
    let shareUrl: string
    try {
      shareUrl = getAlbumShareUrl(newAlbum.slug)
    } catch (error) {
      console.error('Failed to generate share URL:', error)
      // 如果slug无效，使用降级方案
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      shareUrl = `${appUrl}/album/${encodeURIComponent(newAlbum.slug || '')}`
    }

    return NextResponse.json({
      id: newAlbum.id,
      slug: newAlbum.slug,
      title: newAlbum.title,
      shareUrl,
      message: '相册已复制',
    })
  } catch {
    console.error('Duplicate album error')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
