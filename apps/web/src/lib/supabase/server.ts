import { createServerClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'
import {
  createCompatAuthClient,
  createCompatAuthClientFromRequest,
} from '@/lib/auth/compat'

// 类型宽松的 Supabase 客户端，避免类型推断问题
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>

/**
 * 检查是否使用自定义认证模式
 */
function isCustomAuthMode(): boolean {
  return process.env.AUTH_MODE === 'custom' || process.env.DATABASE_TYPE === 'postgresql'
}

/**
 * 创建 Supabase 客户端（用于 Server Components）
 * 在自定义认证模式下，返回兼容客户端
 */
export async function createClient(): Promise<AnySupabaseClient> {
  // 自定义认证模式
  if (isCustomAuthMode()) {
    return createCompatAuthClient() as unknown as AnySupabaseClient
  }

  // Supabase 模式
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component 中忽略
          }
        },
      },
    }
  )
}

/**
 * 从 NextRequest 创建 Supabase 客户端（用于 API Routes）
 * 这样可以正确读取请求中的 cookies
 */
export function createClientFromRequest(
  request: NextRequest,
  response?: NextResponse
): AnySupabaseClient {
  // 自定义认证模式
  if (isCustomAuthMode()) {
    return createCompatAuthClientFromRequest(request, response) as unknown as AnySupabaseClient
  }

  // 在 App Router 中，不能使用 NextResponse.next()，直接创建新的响应对象
  const responseRef = response || new NextResponse()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            responseRef.cookies.set(name, value, options)
          })
        },
      },
    }
  )
}

// 服务端 Admin 客户端 (绕过 RLS)
export function createAdminClient(): AnySupabaseClient {
  // 自定义认证模式
  if (isCustomAuthMode()) {
    return createCompatAuthClient() as unknown as AnySupabaseClient
  }

  return createServerClient<Database>(
    process.env.SUPABASE_URL! || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
    }
  )
}
