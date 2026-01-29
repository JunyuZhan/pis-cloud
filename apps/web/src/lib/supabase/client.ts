import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * 检查是否使用自定义认证模式
 */
function isCustomAuthMode(): boolean {
  // 客户端检查：通过环境变量或 URL 检测
  return process.env.NEXT_PUBLIC_AUTH_MODE === 'custom'
}

/**
 * 自定义认证模式的浏览器客户端
 */
function createCustomAuthBrowserClient() {
  return {
    auth: {
      async getUser() {
        try {
          const response = await fetch('/api/auth/me')
          if (!response.ok) {
            return { data: { user: null }, error: null }
          }
          const data = await response.json()
          return { data: { user: data.user }, error: null }
        } catch {
          return { data: { user: null }, error: null }
        }
      },
      
      async getSession() {
        try {
          const response = await fetch('/api/auth/me')
          if (!response.ok) {
            return { data: { session: null }, error: null }
          }
          const data = await response.json()
          if (data.user) {
            return {
              data: {
                session: {
                  user: data.user,
                  access_token: '',
                  refresh_token: '',
                },
              },
              error: null,
            }
          }
          return { data: { session: null }, error: null }
        } catch {
          return { data: { session: null }, error: null }
        }
      },

      async signInWithPassword(credentials: { email: string; password: string }) {
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
          })
          const data = await response.json()
          if (!response.ok) {
            return { data: { user: null, session: null }, error: data.error }
          }
          return {
            data: {
              user: data.user,
              session: { user: data.user, access_token: '', refresh_token: '' },
            },
            error: null,
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          return { data: { user: null, session: null }, error: { message } }
        }
      },

      async signOut() {
        try {
          await fetch('/api/auth/signout', { method: 'POST' })
          return { error: null }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          return { error: { message } }
        }
      },

      onAuthStateChange(callback: (event: string, session: unknown) => void) {
        // 自定义认证不支持实时监听
        // 初始化时检查一次状态
        this.getSession().then(({ data }) => {
          callback('INITIAL_SESSION', data.session)
        })
        return {
          data: {
            subscription: {
              unsubscribe: () => {},
            },
          },
        }
      },
    },
  }
}

export function createClient() {
  // 自定义认证模式
  if (isCustomAuthMode()) {
    return createCustomAuthBrowserClient() as ReturnType<typeof createBrowserClient<Database>>
  }

  // Supabase 模式
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
