import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AlbumInsert } from '@/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

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
    const newAlbumData: AlbumInsert = {
      title: `${originalAlbum.title} (副本)`,
      description: originalAlbum.description,
      is_public: originalAlbum.is_public,
      layout: originalAlbum.layout,
      sort_rule: originalAlbum.sort_rule,
      allow_download: originalAlbum.allow_download,
      allow_batch_download: originalAlbum.allow_batch_download,
      show_exif: originalAlbum.show_exif,
      password: (originalAlbum as any).password || null,
      expires_at: (originalAlbum as any).expires_at || null,
      watermark_enabled: originalAlbum.watermark_enabled,
      watermark_type: originalAlbum.watermark_type,
      watermark_config: originalAlbum.watermark_config,
      share_title: (originalAlbum as any).share_title || null,
      share_description: (originalAlbum as any).share_description || null,
      share_image_url: (originalAlbum as any).share_image_url || null,
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

    return NextResponse.json({
      id: newAlbum.id,
      slug: newAlbum.slug,
      title: newAlbum.title,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/album/${newAlbum.slug}`,
      message: '相册已复制',
    })
  } catch (err) {
    console.error('Duplicate album error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
