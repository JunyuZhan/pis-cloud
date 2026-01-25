import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Auth Callback 路由
 * 处理 Supabase Auth 的重定向回调（如邮箱验证、OAuth 登录等）
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/admin'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // 如果没有 code 或交换失败，重定向到登录页
  return NextResponse.redirect(`${origin}/admin/login?error=auth_callback_error`)
}
