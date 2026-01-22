import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 访客选片 API
 * 允许匿名用户标记照片为「选中」状态
 * 用于客户挑选喜欢的照片
 */

// PATCH /api/public/photos/[id]/select - 切换选中状态
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 解析请求体
    const body = await request.json()
    const { isSelected } = body

    if (typeof isSelected !== 'boolean') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '请提供有效的选中状态' } },
        { status: 400 }
      )
    }

    // 首先验证照片存在且所属相册未删除
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select(`
        id,
        album_id,
        albums!inner (
          id,
          deleted_at
        )
      `)
      .eq('id', id)
      .eq('status', 'completed')
      .single()

    if (photoError || !photo) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '照片不存在' } },
        { status: 404 }
      )
    }

    // 更新选中状态
    const { data: updatedPhoto, error: updateError } = await supabase
      .from('photos')
      .update({ is_selected: isSelected })
      .eq('id', id)
      .select('id, is_selected')
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: updateError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: updatedPhoto.id,
      isSelected: updatedPhoto.is_selected,
    })
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// GET /api/public/photos/[id]/select - 获取当前选中状态
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: photo, error } = await supabase
      .from('photos')
      .select('id, is_selected')
      .eq('id', id)
      .eq('status', 'completed')
      .single()

    if (error || !photo) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '照片不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: photo.id,
      isSelected: photo.is_selected,
    })
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
