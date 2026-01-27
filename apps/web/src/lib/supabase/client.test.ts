import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from './client'

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => {
  const mockSupabaseClient = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  }
  return {
    createBrowserClient: vi.fn().mockReturnValue(mockSupabaseClient),
  }
})

describe('supabase/client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('should create browser Supabase client', () => {
    const client = createClient()
    expect(client).toBeDefined()
  })
})
