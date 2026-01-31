import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind CSS 类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 格式化日期 - 使用固定格式避免 hydration 不匹配
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  return `${year}年${monthNames[month - 1]}${day}日`
}

/**
 * 格式化相对时间 - 使用固定格式避免 hydration 不匹配
 * 注意：此函数在服务器端和客户端可能返回不同结果，建议在客户端组件中使用
 */
export function formatRelativeTime(date: string | Date): string {
  // 在服务器端渲染时，返回固定格式的日期以避免 hydration 不匹配
  if (typeof window === 'undefined') {
    return formatDate(date)
  }

  const now = new Date()
  const target = new Date(date)
  const diff = now.getTime() - target.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`

  return formatDate(date)
}

/**
 * 获取应用基础URL（用于生成分享链接）
 * 优先使用环境变量，否则使用 window.location.origin（客户端）或默认值（服务端）
 */
export function getAppBaseUrl(): string {
  // 服务端：使用环境变量
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  }
  // 客户端：优先使用环境变量，否则使用当前域名
  return process.env.NEXT_PUBLIC_APP_URL || window.location.origin
}

/**
 * 生成相册分享URL
 * @param slug - 相册slug，会自动进行URL编码
 */
export function getAlbumShareUrl(slug: string): string {
  // 验证slug有效性
  if (!slug || typeof slug !== 'string' || slug.trim() === '') {
    throw new Error('Invalid album slug')
  }
  // 对slug进行URL编码，防止特殊字符导致URL无效
  const encodedSlug = encodeURIComponent(slug.trim())
  return `${getAppBaseUrl()}/album/${encodedSlug}`
}
