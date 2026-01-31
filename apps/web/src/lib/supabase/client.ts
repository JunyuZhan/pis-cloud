import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * 创建 Supabase 浏览器客户端
 * PIS 使用 Supabase 作为唯一认证后端
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
