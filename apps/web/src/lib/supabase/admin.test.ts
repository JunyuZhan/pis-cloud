import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAdminClient } from './admin'

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => {
  const mockSupabaseClient = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  }
  return {
    createClient: vi.fn().mockReturnValue(mockSupabaseClient),
  }
})

describe('supabase/admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })

  it('should create admin Supabase client', () => {
    const client = createAdminClient()
    expect(client).toBeDefined()
  })

  it('should use NEXT_PUBLIC_SUPABASE_URL as fallback', () => {
    delete process.env.SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://public.supabase.co'
    
    const client = createAdminClient()
    expect(client).toBeDefined()
  })
})
