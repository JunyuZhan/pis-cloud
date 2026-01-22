import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // 匹配 /admin 路由，但排除静态资源
  matcher: [
    '/admin/:path*',
  ],
}
