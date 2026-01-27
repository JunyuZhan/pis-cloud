import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient, createClientFromRequest, createAdminClient } from './server'
import { createMockRequest } from '@/test/test-utils'

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => {
  const mockSupabaseClient = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  }
  return {
    createServerClient: vi.fn().mockReturnValue(mockSupabaseClient),
  }
})

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}))

describe('supabase/server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })

  describe('createClient', () => {
    it('should create Supabase client for server components', async () => {
      const client = await createClient()
      expect(client).toBeDefined()
    })
  })

  describe('createClientFromRequest', () => {
    it('should create Supabase client from request', () => {
      const request = createMockRequest('http://localhost:3000/api/test')
      const client = createClientFromRequest(request)
      
      expect(client).toBeDefined()
    })

    it('should use provided response object', () => {
      const request = createMockRequest('http://localhost:3000/api/test')
      const response = new Response()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = createClientFromRequest(request, response as any)
      
      expect(client).toBeDefined()
    })
  })

})
