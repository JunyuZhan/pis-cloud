import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupabaseAdapter } from './supabase-adapter.js'
import type { DatabaseConfig } from './types.js'

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => {
  const mockSupabaseClient = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    auth: {
      getUser: vi.fn(),
    },
  }
  
  return {
    createClient: vi.fn().mockReturnValue(mockSupabaseClient),
    SupabaseClient: class {},
  }
})

describe('SupabaseAdapter', () => {
  const baseConfig: DatabaseConfig = {
    type: 'supabase',
    supabaseUrl: 'https://test.supabase.co',
    supabaseKey: 'test-key',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create Supabase adapter with config', () => {
      const adapter = new SupabaseAdapter(baseConfig)
      expect(adapter).toBeDefined()
    })

    it('should throw error if supabaseUrl missing', () => {
      expect(() => {
        new SupabaseAdapter({
          type: 'supabase',
          supabaseKey: 'test-key',
        } as any)
      }).toThrow('Supabase adapter requires supabaseUrl and supabaseKey')
    })

    it('should throw error if supabaseKey missing', () => {
      expect(() => {
        new SupabaseAdapter({
          type: 'supabase',
          supabaseUrl: 'https://test.supabase.co',
        } as any)
      }).toThrow('Supabase adapter requires supabaseUrl and supabaseKey')
    })
  })

  describe('getClient', () => {
    it('should return Supabase client', async () => {
      const adapter = new SupabaseAdapter(baseConfig)
      const { createClient } = await import('@supabase/supabase-js')
      const mockClient = createClient('', '')
      const client = adapter.getClient()
      expect(client).toBe(mockClient)
    })
  })

  describe('findOne', () => {
    it('should find one record', async () => {
      const adapter = new SupabaseAdapter(baseConfig)
      const { createClient } = await import('@supabase/supabase-js')
      const mockClient = createClient('', '')
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
      }
      vi.mocked(mockClient.from).mockReturnValue(mockQuery as any)

      const result = await adapter.findOne('albums', { id: '1' })
      expect(result.data).toBeDefined()
    })

    it('should handle null filters', async () => {
      const adapter = new SupabaseAdapter(baseConfig)
      const { createClient } = await import('@supabase/supabase-js')
      const mockClient = createClient('', '')
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
      vi.mocked(mockClient.from).mockReturnValue(mockQuery as any)

      const result = await adapter.findOne('albums', { deleted_at: null })
      expect(result.data).toBeNull()
    })
  })

  describe('findMany', () => {
    it('should find many records', async () => {
      const adapter = new SupabaseAdapter(baseConfig)
      const { createClient } = await import('@supabase/supabase-js')
      const mockClient = createClient('', '')
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
      }
      vi.mocked(mockClient.from).mockReturnValue(mockQuery as any)
      vi.spyOn(mockQuery, 'limit').mockResolvedValue({ data: [{ id: '1' }], error: null, count: 1 } as any)

      const result = await adapter.findMany('albums', { is_public: true }, { limit: 10 })
      expect(result).toBeDefined()
    })
  })

  describe('insert', () => {
    it('should insert record', async () => {
      const adapter = new SupabaseAdapter(baseConfig)
      const { createClient } = await import('@supabase/supabase-js')
      const mockClient = createClient('', '')
      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      }
      vi.mocked(mockClient.from).mockReturnValue(mockQuery as any)

      const result = await adapter.insert('albums', { title: 'Test' })
      expect(result.data).toBeDefined()
    })
  })

  describe('update', () => {
    it('should update record', async () => {
      const adapter = new SupabaseAdapter(baseConfig)
      const { createClient } = await import('@supabase/supabase-js')
      const mockClient = createClient('', '')
      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      }
      vi.mocked(mockClient.from).mockReturnValue(mockQuery as any)

      const result = await adapter.update('albums', { id: '1' }, { title: 'Updated' })
      expect(result.data).toBeDefined()
    })
  })

  describe('delete', () => {
    it('should delete record', async () => {
      const adapter = new SupabaseAdapter(baseConfig)
      const { createClient } = await import('@supabase/supabase-js')
      const mockClient = createClient('', '')
      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      }
      vi.mocked(mockClient.from).mockReturnValue(mockQuery as any)

      const result = await adapter.delete('albums', { id: '1' })
      expect(result.error).toBeNull()
    })
  })

  describe('count', () => {
    it('should count records', async () => {
      const adapter = new SupabaseAdapter(baseConfig)
      const { createClient } = await import('@supabase/supabase-js')
      const mockClient = createClient('', '')
      // 创建一个支持链式调用的 mock query
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        // 添加 then 方法使其成为 thenable，支持 await
        then: vi.fn((resolve) => {
          resolve({ count: 10, error: null })
          return Promise.resolve({ count: 10, error: null })
        }),
      }
      vi.mocked(mockClient.from).mockReturnValue(mockQuery as any)

      const result = await adapter.count('albums', { is_public: true })
      expect(result).toBe(10)
    })
  })

  describe('close', () => {
    it('should close connection', async () => {
      const adapter = new SupabaseAdapter(baseConfig)
      // SupabaseAdapter 实现了 close 方法（即使 Supabase 客户端没有显式关闭方法）
      await expect(adapter.close()).resolves.toBeUndefined()
    })
  })
})
