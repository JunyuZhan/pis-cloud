/**
 * 照片选择 API 路由测试
 * 
 * 测试 GET 和 PATCH 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => {
  const mockAuth = {
    getUser: vi.fn(),
  }

  const mockSupabaseClient = {
    auth: mockAuth,
    from: vi.fn(),
  }

  const mockAdminClient = {
    from: vi.fn(),
  }

  return {
    createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
    createAdminClient: vi.fn().mockReturnValue(mockAdminClient),
  }
})

describe('GET /api/public/photos/[id]/select', () => {
  let mockSupabaseClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/supabase/server')
    mockSupabaseClient = await createClient()
  })

  describe('photo retrieval', () => {
    it('should return photo selection status successfully', async () => {
      const mockPhoto = {
        id: 'photo-123',
        is_selected: true,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select')
      const response = await GET(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('photo-123')
      expect(data.isSelected).toBe(true)
    })

    it('should return 404 if photo does not exist', async () => {
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

      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select')
      const response = await GET(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if photo is deleted', async () => {
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

      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select')
      const response = await GET(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select')
      const response = await GET(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on database error', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockRejectedValue(new Error('Database error'))

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select')
      const response = await GET(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})

describe('PATCH /api/public/photos/[id]/select', () => {
  let mockSupabaseClient: any
  let mockAdminClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient, createAdminClient } = await import('@/lib/supabase/server')
    mockSupabaseClient = await createClient()
    mockAdminClient = createAdminClient()
  })

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select', {
        method: 'PATCH',
        body: 'invalid-json',
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 for invalid isSelected type', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select', {
        method: 'PATCH',
        body: { isSelected: 'true' }, // 字符串而不是布尔值
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('photo validation', () => {
    it('should return 404 if photo does not exist', async () => {
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

      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if photo is deleted', async () => {
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

      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if album is deleted', async () => {
      const mockPhoto = {
        id: 'photo-123',
        album_id: 'album-123',
        deleted_at: null,
        albums: {
          id: 'album-123',
          deleted_at: '2024-01-01T00:00:00Z', // 相册已删除
        },
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null, // 由于相册已删除，inner join会返回null
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('successful update', () => {
    it('should update selection status to true', async () => {
      const mockPhoto = {
        id: 'photo-123',
        album_id: 'album-123',
        deleted_at: null,
        albums: {
          id: 'album-123',
          deleted_at: null,
        },
      }

      const mockUpdatedPhoto = {
        id: 'photo-123',
        is_selected: true,
      }

      // Mock photo query
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      // Mock admin update
      const mockAdminUpdate = vi.fn().mockReturnThis()
      const mockAdminEq = vi.fn().mockReturnThis()
      const mockAdminSelect = vi.fn().mockReturnThis()
      const mockAdminSingle = vi.fn().mockResolvedValue({
        data: mockUpdatedPhoto,
        error: null,
      })

      mockAdminClient.from.mockReturnValue({
        update: mockAdminUpdate,
        eq: mockAdminEq,
        select: mockAdminSelect,
        single: mockAdminSingle,
      })

      mockAdminUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('photo-123')
      expect(data.isSelected).toBe(true)
    })

    it('should update selection status to false', async () => {
      const mockPhoto = {
        id: 'photo-123',
        album_id: 'album-123',
        deleted_at: null,
        albums: {
          id: 'album-123',
          deleted_at: null,
        },
      }

      const mockUpdatedPhoto = {
        id: 'photo-123',
        is_selected: false,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const mockAdminUpdate = vi.fn().mockReturnThis()
      const mockAdminEq = vi.fn().mockReturnThis()
      const mockAdminSelect = vi.fn().mockReturnThis()
      const mockAdminSingle = vi.fn().mockResolvedValue({
        data: mockUpdatedPhoto,
        error: null,
      })

      mockAdminClient.from.mockReturnValue({
        update: mockAdminUpdate,
        eq: mockAdminEq,
        select: mockAdminSelect,
        single: mockAdminSingle,
      })

      mockAdminUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select', {
        method: 'PATCH',
        body: { isSelected: false },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('photo-123')
      expect(data.isSelected).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })

      const response = await PATCH(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on database update error', async () => {
      const mockPhoto = {
        id: 'photo-123',
        album_id: 'album-123',
        deleted_at: null,
        albums: {
          id: 'album-123',
          deleted_at: null,
        },
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const mockAdminUpdate = vi.fn().mockReturnThis()
      const mockAdminEq = vi.fn().mockReturnThis()
      const mockAdminSelect = vi.fn().mockReturnThis()
      const mockAdminSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      })

      mockAdminClient.from.mockReturnValue({
        update: mockAdminUpdate,
        eq: mockAdminEq,
        select: mockAdminSelect,
        single: mockAdminSingle,
      })

      mockAdminUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/public/photos/photo-123/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('DB_ERROR')
    })
  })
})
