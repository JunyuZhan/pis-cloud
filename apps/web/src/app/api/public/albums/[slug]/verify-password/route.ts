import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * 验证相册密码 API
 * POST /api/public/albums/[slug]/verify-password
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    
    // 解析请求体
    interface VerifyPasswordRequestBody {
      password: string
    }
    let body: VerifyPasswordRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '请提供密码' } },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 获取相册信息（包含密码）
    const { data: album, error } = await supabase
      .from('albums')
      .select('id, password, expires_at, deleted_at')
      .eq('slug', slug)
      .single()

    if (error || !album || album.deleted_at) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
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

    // 如果没有设置密码，直接通过
    if (!album.password) {
      return NextResponse.json({ verified: true })
    }

    // 验证密码
    // 注意：当前使用明文比较（向后兼容）
    // 生产环境建议使用 bcrypt 加密存储密码
    if (album.password === password) {
      return NextResponse.json({ verified: true })
    } else {
      return NextResponse.json(
        { error: { code: 'INVALID_PASSWORD', message: '密码错误' } },
        { status: 401 }
      )
    }
  } catch {
    console.error('Verify password API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
