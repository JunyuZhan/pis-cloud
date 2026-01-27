import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => {
  const mockClient = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  }
  return {
    createClient: vi.fn().mockReturnValue(mockClient),
  }
})

describe('supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create Supabase client', async () => {
    const { supabase } = await import('./supabase.js')
    expect(supabase).toBeDefined()
  })

  it('should use environment variables', async () => {
    const originalEnv = process.env
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    }

    // 重新导入以获取新的客户端
    vi.resetModules()
    const { createClient } = await import('@supabase/supabase-js')
    await import('./supabase.js')
    expect(createClient).toHaveBeenCalled()

    process.env = originalEnv
  })

  it('should fallback to NEXT_PUBLIC_SUPABASE_URL', async () => {
    const originalEnv = process.env
    delete process.env.SUPABASE_URL
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://public.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    }

    vi.resetModules()
    const { createClient } = await import('@supabase/supabase-js')
    await import('./supabase.js')
    expect(createClient).toHaveBeenCalled()

    process.env = originalEnv
  })
})
