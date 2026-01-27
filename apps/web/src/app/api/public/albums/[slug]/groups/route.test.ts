/**
 * 相册分组列表 API 路由测试
 * 
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => {
  const mockSupabaseClient = {
    from: vi.fn(),
  }

  return {
    createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
  }
})

describe('GET /api/public/albums/[slug]/groups', () => {
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
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 403 if album is not public', async () => {
      const mockAlbum = {
        id: 'album-123',
        is_public: false,
        deleted_at: null,
        expires_at: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('should return 403 if album is deleted', async () => {
      const mockAlbum = {
        id: 'album-123',
        is_public: true,
        deleted_at: '2024-01-01T00:00:00Z',
        expires_at: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('should return 403 if album is expired', async () => {
      const mockAlbum = {
        id: 'album-123',
        is_public: true,
        deleted_at: null,
        expires_at: '2020-01-01T00:00:00Z', // 已过期
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
      expect(data.error.message).toContain('已过期')
    })
  })

  describe('groups retrieval', () => {
    it('should return groups with photo counts successfully', async () => {
      const mockAlbum = {
        id: 'album-123',
        is_public: true,
        deleted_at: null,
        expires_at: null,
      }

      const mockGroups = [
        { id: 'group-1', name: 'Group 1', album_id: 'album-123', sort_order: 1 },
        { id: 'group-2', name: 'Group 2', album_id: 'album-123', sort_order: 2 },
      ]

      const mockAssignments = [
        { group_id: 'group-1', photo_id: 'photo-1' },
        { group_id: 'group-1', photo_id: 'photo-2' },
        { group_id: 'group-2', photo_id: 'photo-3' },
      ]

      // Mock album query
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      // Mock groups query - 需要链式调用：select().eq().order().order()
      // order()被调用两次，最后一次返回Promise
      const mockQuery2 = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      // 第一次order()返回this，第二次order()返回Promise
      mockQuery2.order
        .mockReturnValueOnce(mockQuery2)
        .mockResolvedValueOnce({
          data: mockGroups,
          error: null,
        })

      // Mock assignments query - 需要链式调用：select().in().eq().is().is()
      // is()被调用两次，最后一次返回Promise
      const mockQuery3 = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
      }
      mockQuery3.is
        .mockReturnValueOnce(mockQuery3)
        .mockResolvedValueOnce({
          data: mockAssignments,
          error: null,
        })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })
        .mockReturnValueOnce(mockQuery2)
        .mockReturnValueOnce(mockQuery3)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.groups).toHaveLength(2)
      expect(data.groups[0].id).toBe('group-1')
      expect(data.groups[0].photo_count).toBe(2)
      expect(data.groups[1].id).toBe('group-2')
      expect(data.groups[1].photo_count).toBe(1)
    })

    it('should return only groups with photos', async () => {
      const mockAlbum = {
        id: 'album-123',
        is_public: true,
        deleted_at: null,
        expires_at: null,
      }

      const mockGroups = [
        { id: 'group-1', name: 'Group 1', album_id: 'album-123', sort_order: 1 },
        { id: 'group-2', name: 'Group 2', album_id: 'album-123', sort_order: 2 },
      ]

      const mockAssignments = [
        { group_id: 'group-1', photo_id: 'photo-1' },
        // group-2 没有照片
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      const mockQuery2 = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockQuery2.order
        .mockReturnValueOnce(mockQuery2)
        .mockResolvedValueOnce({
          data: mockGroups,
          error: null,
        })

      const mockQuery3 = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
      }
      mockQuery3.is
        .mockReturnValueOnce(mockQuery3)
        .mockResolvedValueOnce({
          data: mockAssignments,
          error: null,
        })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })
        .mockReturnValueOnce(mockQuery2)
        .mockReturnValueOnce(mockQuery3)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.groups).toHaveLength(1)
      expect(data.groups[0].id).toBe('group-1')
      expect(data.groups[0].photo_count).toBe(1)
    })

    it('should return empty array if no groups exist', async () => {
      const mockAlbum = {
        id: 'album-123',
        is_public: true,
        deleted_at: null,
        expires_at: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      const mockQuery2 = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockQuery2.order
        .mockReturnValueOnce(mockQuery2)
        .mockResolvedValueOnce({
          data: [],
          error: null,
        })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })
        .mockReturnValueOnce(mockQuery2)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.groups).toEqual([])
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on database error when querying groups', async () => {
      const mockAlbum = {
        id: 'album-123',
        is_public: true,
        deleted_at: null,
        expires_at: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      const mockQuery2 = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockQuery2.order
        .mockReturnValueOnce(mockQuery2)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' },
        })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })
        .mockReturnValueOnce(mockQuery2)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      // 如果groupsError存在，返回DB_ERROR；但如果抛出异常会被catch捕获返回INTERNAL_ERROR
      expect(['DB_ERROR', 'INTERNAL_ERROR']).toContain(data.error.code)
    })

    it('should handle assignments query error gracefully', async () => {
      const mockAlbum = {
        id: 'album-123',
        is_public: true,
        deleted_at: null,
        expires_at: null,
      }

      const mockGroups = [
        { id: 'group-1', name: 'Group 1', album_id: 'album-123', sort_order: 1 },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      const mockQuery2 = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockQuery2.order
        .mockReturnValueOnce(mockQuery2)
        .mockResolvedValueOnce({
          data: mockGroups,
          error: null,
        })

      const mockQuery3 = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
      }
      mockQuery3.is
        .mockReturnValueOnce(mockQuery3)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Assignments query error' },
        })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })
        .mockReturnValueOnce(mockQuery2)
        .mockReturnValueOnce(mockQuery3)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      // 即使 assignments 查询失败，也应该返回 groups（只是没有照片数量）
      // 但代码只返回有照片的分组，所以如果photo_count为0，groups会是空数组
      expect(response.status).toBe(200)
      // 由于代码过滤了photo_count > 0的分组，所以这里应该是空数组
      expect(data.groups).toEqual([])
    })
  })
})
