/**
 * Supabase Auth 兼容层
 * 
 * 提供与 Supabase Auth API 相似的接口
 * 使现有代码无需大量修改即可在自定义认证模式下工作
 */
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import {
  getCurrentUser,
  getUserFromRequest,
  createSession,
  destroySession,
  verifyPassword,
  hashPassword,
  getAuthDatabase,
  AuthUser,
} from './index'
import { initPostgresAuth } from './database'

// ==================== 兼容类型 ====================

interface SupabaseUser {
  id: string
  email?: string
  created_at?: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

interface SupabaseSession {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: SupabaseUser
}

interface AuthError {
  message: string
  status?: number
}

// ==================== Auth 兼容对象 ====================

class CustomAuthClient {
  private initialized = false

  private async ensureInitialized() {
    if (!this.initialized) {
      await initPostgresAuth()
      this.initialized = true
    }
  }

  /**
   * 获取当前用户
   */
  async getUser(): Promise<{ data: { user: SupabaseUser | null }; error: AuthError | null }> {
    try {
      await this.ensureInitialized()
      const user = await getCurrentUser()
      
      if (!user) {
        return { data: { user: null }, error: null }
      }

      return {
        data: {
          user: {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            app_metadata: {},
            user_metadata: {},
          },
        },
        error: null,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { data: { user: null }, error: { message } }
    }
  }

  /**
   * 获取当前会话
   */
  async getSession(): Promise<{ data: { session: SupabaseSession | null }; error: AuthError | null }> {
    try {
      await this.ensureInitialized()
      const user = await getCurrentUser()
      
      if (!user) {
        return { data: { session: null }, error: null }
      }

      const cookieStore = await cookies()
      const accessToken = cookieStore.get('pis-auth-token')?.value || ''

      return {
        data: {
          session: {
            access_token: accessToken,
            refresh_token: '',
            user: {
              id: user.id,
              email: user.email,
            },
          },
        },
        error: null,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { data: { session: null }, error: { message } }
    }
  }

  /**
   * 使用密码登录
   */
  async signInWithPassword(credentials: {
    email: string
    password: string
  }): Promise<{ data: { user: SupabaseUser | null; session: SupabaseSession | null }; error: AuthError | null }> {
    try {
      await this.ensureInitialized()
      const db = getAuthDatabase()
      
      const user = await db.findUserByEmail(credentials.email)
      if (!user) {
        return {
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials', status: 401 },
        }
      }

      const validPassword = await verifyPassword(credentials.password, user.password_hash)
      if (!validPassword) {
        return {
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials', status: 401 },
        }
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
      }
      
      const session = await createSession(authUser)

      return {
        data: {
          user: {
            id: authUser.id,
            email: authUser.email,
          },
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            user: {
              id: authUser.id,
              email: authUser.email,
            },
          },
        },
        error: null,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return {
        data: { user: null, session: null },
        error: { message },
      }
    }
  }

  /**
   * 登出
   */
  async signOut(): Promise<{ error: AuthError | null }> {
    try {
      await destroySession()
      return { error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { error: { message } }
    }
  }

  /**
   * 注册新用户
   */
  async signUp(credentials: {
    email: string
    password: string
  }): Promise<{ data: { user: SupabaseUser | null; session: SupabaseSession | null }; error: AuthError | null }> {
    try {
      await this.ensureInitialized()
      const db = getAuthDatabase()
      
      // 检查用户是否已存在
      const existingUser = await db.findUserByEmail(credentials.email)
      if (existingUser) {
        return {
          data: { user: null, session: null },
          error: { message: 'User already exists', status: 400 },
        }
      }

      // 创建新用户
      const passwordHash = await hashPassword(credentials.password)
      const newUser = await db.createUser(credentials.email, passwordHash)

      const authUser: AuthUser = {
        id: newUser.id,
        email: newUser.email,
      }

      const session = await createSession(authUser)

      return {
        data: {
          user: {
            id: authUser.id,
            email: authUser.email,
          },
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            user: {
              id: authUser.id,
              email: authUser.email,
            },
          },
        },
        error: null,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return {
        data: { user: null, session: null },
        error: { message },
      }
    }
  }

  /**
   * 监听认证状态变化（客户端使用）
   * 注意：在自定义认证中，这是一个空实现
   */
  onAuthStateChange(_callback: (event: string, session: SupabaseSession | null) => void): {
    data: { subscription: { unsubscribe: () => void } }
  } {
    // 自定义认证不支持实时监听，返回空实现
    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    }
  }
}

// ==================== 兼容客户端工厂 ====================

/**
 * 创建兼容的 Auth 客户端（服务端）
 */
export function createCompatAuthClient() {
  return {
    auth: new CustomAuthClient(),
  }
}

/**
 * 从请求创建兼容的 Auth 客户端
 */
export function createCompatAuthClientFromRequest(_request: NextRequest, _response?: NextResponse) {
  return {
    auth: new CustomAuthClient(),
  }
}

// ==================== Middleware 兼容 ====================

/**
 * 自定义认证 Middleware（替代 Supabase middleware）
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request })
  
  // 初始化数据库连接
  await initPostgresAuth()
  
  const user = await getUserFromRequest(request)

  if (request.nextUrl.pathname.startsWith('/admin')) {
    // 登录页面逻辑
    if (request.nextUrl.pathname === '/admin/login') {
      if (user) {
        // 已登录，重定向到管理后台首页
        const url = request.nextUrl.clone()
        url.pathname = '/admin'
        return NextResponse.redirect(url)
      }
      // 未登录，允许访问登录页
      return response
    }

    // 其他管理后台页面逻辑
    if (!user) {
      // 未登录，重定向到登录页
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
  }

  return response
}
