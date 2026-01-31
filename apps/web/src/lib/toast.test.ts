import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  showSuccess,
  showError,
  showInfo,
  showWarning,
  showLoading,
  updateLoadingSuccess,
  updateLoadingError,
  handleApiError,
} from './toast'

// Mock sonner toast
vi.mock('sonner', () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn().mockReturnValue('toast-id'),
  }
  return {
    toast: mockToast,
  }
})

describe('toast', () => {
  let mockToast: {
    success: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
    info: ReturnType<typeof vi.fn>
    warning: ReturnType<typeof vi.fn>
    loading: ReturnType<typeof vi.fn>
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    const sonner = await import('sonner')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockToast = sonner.toast as any
  })

  describe('showSuccess', () => {
    it('should show success toast with default duration', () => {
      showSuccess('操作成功')
      expect(mockToast.success).toHaveBeenCalledWith('操作成功', { duration: 3000 })
    })

    it('should show success toast with custom duration', () => {
      showSuccess('操作成功', 5000)
      expect(mockToast.success).toHaveBeenCalledWith('操作成功', { duration: 5000 })
    })
  })

  describe('showError', () => {
    it('should show error toast with default duration', () => {
      showError('操作失败')
      expect(mockToast.error).toHaveBeenCalledWith('操作失败', { duration: 4000 })
    })

    it('should show error toast with custom duration', () => {
      showError('操作失败', 6000)
      expect(mockToast.error).toHaveBeenCalledWith('操作失败', { duration: 6000 })
    })
  })

  describe('showInfo', () => {
    it('should show info toast with default duration', () => {
      showInfo('提示信息')
      expect(mockToast.info).toHaveBeenCalledWith('提示信息', { duration: 3000 })
    })

    it('should show info toast with custom duration', () => {
      showInfo('提示信息', 5000)
      expect(mockToast.info).toHaveBeenCalledWith('提示信息', { duration: 5000 })
    })
  })

  describe('showWarning', () => {
    it('should show warning toast with default duration', () => {
      showWarning('警告信息')
      expect(mockToast.warning).toHaveBeenCalledWith('警告信息', { duration: 3000 })
    })

    it('should show warning toast with custom duration', () => {
      showWarning('警告信息', 5000)
      expect(mockToast.warning).toHaveBeenCalledWith('警告信息', { duration: 5000 })
    })
  })

  describe('showLoading', () => {
    it('should show loading toast and return toastId', () => {
      const toastId = showLoading('加载中...')
      expect(mockToast.loading).toHaveBeenCalledWith('加载中...')
      expect(toastId).toBe('toast-id')
    })
  })

  describe('updateLoadingSuccess', () => {
    it('should update loading toast to success', () => {
      updateLoadingSuccess('toast-id', '加载成功')
      expect(mockToast.success).toHaveBeenCalledWith('加载成功', { id: 'toast-id' })
    })
  })

  describe('updateLoadingError', () => {
    it('should update loading toast to error', () => {
      updateLoadingError('toast-id', '加载失败')
      expect(mockToast.error).toHaveBeenCalledWith('加载失败', { id: 'toast-id' })
    })
  })

  describe('handleApiError', () => {
    it('should handle network fetch error', () => {
      const error = new TypeError('Failed to fetch')
      handleApiError(error)
      expect(mockToast.error).toHaveBeenCalledWith('网络连接失败，请检查网络后重试', { duration: 4000 })
    })

    it('should handle Error with message', () => {
      const error = new Error('Custom error message')
      handleApiError(error)
      expect(mockToast.error).toHaveBeenCalledWith('Custom error message', { duration: 4000 })
    })

    it('should handle Error without message', () => {
      const error = new Error()
      handleApiError(error, '默认错误消息')
      expect(mockToast.error).toHaveBeenCalledWith('默认错误消息', { duration: 4000 })
    })

    it('should handle unknown error type', () => {
      handleApiError('unknown error', '默认错误消息')
      expect(mockToast.error).toHaveBeenCalledWith('默认错误消息', { duration: 4000 })
    })

    it('should use default message if not provided', () => {
      handleApiError('unknown error')
      expect(mockToast.error).toHaveBeenCalledWith('操作失败，请重试', { duration: 4000 })
    })
  })
})
