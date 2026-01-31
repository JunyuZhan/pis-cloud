import { NextRequest } from 'next/server'
import { vi } from 'vitest'

/**
 * 创建模拟的 NextRequest
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body } = options

  const requestInit: {
    method?: string
    headers?: Headers
    body?: string
  } = {
    method,
    headers: new Headers(headers),
  }

  if (body) {
    requestInit.body = typeof body === 'string' ? body : JSON.stringify(body)
    if (!headers['Content-Type']) {
      requestInit.headers = new Headers({
        ...headers,
        'Content-Type': 'application/json',
      })
    }
  }

  // 使用 NextRequest 构造函数，避免类型不兼容
  return new NextRequest(url, {
    method: requestInit.method,
    headers: requestInit.headers,
    body: requestInit.body,
  })
}

/**
 * 创建模拟的 Supabase 客户端
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockSupabaseClient(overrides: Record<string, any> = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: overrides.user || null },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: {
          user: overrides.signInUser || null,
          session: overrides.session || null,
        },
        error: overrides.signInError || null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: overrides.selectData || null,
        error: overrides.selectError || null,
      }),
    }),
    ...overrides,
  }
}
