/**
 * Toast 工具函数
 * 统一管理所有提示消息
 */

import { toast } from 'sonner'

/**
 * 显示成功提示
 */
export function showSuccess(message: string, duration?: number) {
  toast.success(message, { duration: duration || 3000 })
}

/**
 * 显示错误提示
 */
export function showError(message: string, duration?: number) {
  toast.error(message, { duration: duration || 4000 })
}

/**
 * 显示信息提示
 */
export function showInfo(message: string, duration?: number) {
  toast.info(message, { duration: duration || 3000 })
}

/**
 * 显示警告提示
 */
export function showWarning(message: string, duration?: number) {
  toast.warning(message, { duration: duration || 3000 })
}

/**
 * 显示加载提示（返回 toastId，用于后续更新）
 */
export function showLoading(message: string): string | number {
  return toast.loading(message)
}

/**
 * 更新加载提示为成功
 */
export function updateLoadingSuccess(toastId: string | number, message: string) {
  toast.success(message, { id: toastId })
}

/**
 * 更新加载提示为错误
 */
export function updateLoadingError(toastId: string | number, message: string) {
  toast.error(message, { id: toastId })
}

/**
 * 处理 API 错误
 */
export function handleApiError(error: unknown, defaultMessage = '操作失败，请重试') {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    showError('网络连接失败，请检查网络后重试')
  } else if (error instanceof Error) {
    showError(error.message || defaultMessage)
  } else {
    showError(defaultMessage)
  }
}
