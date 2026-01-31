/**
 * 相册查看统计 API 路由测试
 * 
 * 测试 POST 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => {
  const mockSupabaseClient = {
    from: vi.fn(),
    rpc: vi.fn(),
  }

  return {
    createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
  }
})

describe('POST /api/public/albums/[slug]/view', () => {
  let mockSupabaseClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/supabase/server')
    mockSupabaseClient = await createClient()
  })

  describe('album validation', () => {
    it('should return 404 if album does not exist', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/view', {
        method: 'POST',
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('ALBUM_NOT_FOUND')
    })

    it('should return 404 if album is deleted', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/view', {
        method: 'POST',
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('ALBUM_NOT_FOUND')
    })
  })

  describe('view count increment', () => {
    it('should increment view count using RPC successfully', async () => {
      const mockAlbum = {
        id: 'album-123',
      }

      const mockUpdatedAlbum = {
        view_count: 5,
      }

      // Mock album query
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      // Mock RPC call - 成功
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null,
      })

      // Mock updated album query
      const mockSelect2 = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockReturnThis()
      const mockSingle2 = vi.fn().mockResolvedValue({
        data: mockUpdatedAlbum,
        error: null,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          is: mockIs,
          single: mockSingle,
        })
        .mockReturnValueOnce({
          select: mockSelect2,
          eq: mockEq2,
          single: mockSingle2,
        })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/view', {
        method: 'POST',
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.view_count).toBe(5)
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('increment_album_view_count', {
        album_id: 'album-123',
      })
    })

    it('should fallback to manual increment if RPC fails', async () => {
      const mockAlbum = {
        id: 'album-123',
      }

      const mockCurrentAlbum = {
        view_count: 3,
      }

      // Mock album query
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      // Mock RPC call - 失败（RPC函数不存在）
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Function not found' },
      })

      // Mock current album query
      const mockSelect2 = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockReturnThis()
      const mockSingle2 = vi.fn().mockResolvedValue({
        data: mockCurrentAlbum,
        error: null,
      })

      // Mock update
      const mockUpdate = vi.fn().mockReturnThis()
      const mockEq3 = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          is: mockIs,
          single: mockSingle,
        })
        .mockReturnValueOnce({
          select: mockSelect2,
          eq: mockEq2,
          single: mockSingle2,
        })
        .mockReturnValueOnce({
          update: mockUpdate,
          eq: mockEq3,
        })

      mockUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/view', {
        method: 'POST',
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.view_count).toBe(4) // 3 + 1
    })

    it('should handle album without view_count', async () => {
      const mockAlbum = {
        id: 'album-123',
      }

      const mockCurrentAlbum = {
        view_count: null, // 没有view_count
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Function not found' },
      })

      const mockSelect2 = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockReturnThis()
      const mockSingle2 = vi.fn().mockResolvedValue({
        data: mockCurrentAlbum,
        error: null,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockEq3 = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          is: mockIs,
          single: mockSingle,
        })
        .mockReturnValueOnce({
          select: mockSelect2,
          eq: mockEq2,
          single: mockSingle2,
        })
        .mockReturnValueOnce({
          update: mockUpdate,
          eq: mockEq3,
        })

      mockUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/view', {
        method: 'POST',
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.view_count).toBe(1) // null + 1 = 1
    })
  })

  describe('error handling', () => {
    it('should handle params error gracefully', async () => {
      // Mock fallback query in catch block
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: { view_count: 0 },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/view', {
        method: 'POST',
      })

      const response = await POST(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      // 代码在catch块中会尝试查询view_count，所以返回200而不是500
      expect(response.status).toBe(200)
      expect(data.success).toBe(false)
      expect(data.view_count).toBeDefined()
    })

    it('should handle errors gracefully and return current view_count', async () => {
      const mockAlbum = {
        id: 'album-123',
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      // RPC失败
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC error' },
      })

      // 查询当前值也失败
      const mockSelect2 = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockReturnThis()
      const mockSingle2 = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query error' },
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          is: mockIs,
          single: mockSingle,
        })
        .mockReturnValueOnce({
          select: mockSelect2,
          eq: mockEq2,
          single: mockSingle2,
        })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/view', {
        method: 'POST',
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      // 即使出错，也应该返回一个默认值
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.view_count).toBe(1) // 默认值
    })
  })
})
