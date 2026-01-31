import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 登出 API 路由
 * 清除用户会话并重定向到登录页
 */
export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  return NextResponse.json({ success: true })
}
