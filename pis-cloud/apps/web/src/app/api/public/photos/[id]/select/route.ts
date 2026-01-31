import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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
    // 使用 Admin Client 绕过 RLS 进行更新，同时在代码层面严格控制权限
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient()

    // 解析请求体
    interface SelectPhotoRequestBody {
      isSelected: boolean
    }
    let body: SelectPhotoRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { isSelected } = body

    if (typeof isSelected !== 'boolean') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '请提供有效的选中状态' } },
        { status: 400 }
      )
    }

    // 首先验证照片存在且所属相册未删除，照片也未删除
    // 这里可以使用普通客户端利用 RLS 进行安全查询，确保用户只能看到该看到的数据
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select(`
        id,
        album_id,
        deleted_at,
        albums!inner (
          id,
          deleted_at
        )
      `)
      .eq('id', id)
      .eq('status', 'completed')
      .is('deleted_at', null) // 排除已删除的照片
      .single()

    if (photoError || !photo) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '照片不存在' } },
        { status: 404 }
      )
    }

    // 更新选中状态
    // 使用 Admin Client 执行更新操作，因为我们已经移除了匿名用户的 UPDATE 权限
    const { data: updatedPhoto, error: updateError } = await supabaseAdmin
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
  } catch {
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
      .is('deleted_at', null) // 排除已删除的照片
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
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
