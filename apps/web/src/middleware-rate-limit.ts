/**
 * 内存速率限制工具
 * 
 * 安全特性：
 * - 自动清理过期记录，防止内存泄漏
 * - 限制存储大小，防止内存耗尽攻击
 * - 支持基于 IP、邮箱等多维度限制
 * 
 * 生产环境建议：
 * - 使用 Redis 实现分布式速率限制（多服务器部署）
 * - 使用专业的速率限制中间件（如 Upstash Rate Limit）
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetAt: number
    createdAt: number
  }
}

const store: RateLimitStore = {}

// 最大存储记录数（防止内存耗尽攻击）
const MAX_STORE_SIZE = 10000

/**
 * 速率限制检查
 * @param identifier 标识符（如 IP 地址或用户 ID）
 * @param maxRequests 最大请求数
 * @param windowMs 时间窗口（毫秒）
 * @returns 是否允许请求
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  
  // 清理过期记录（每次检查时清理，避免内存泄漏）
  cleanupExpiredRecords()
  
  // 如果存储过大，清理最旧的记录
  if (Object.keys(store).length >= MAX_STORE_SIZE) {
    cleanupOldestRecords()
  }

  const key = identifier
  const record = store[key]

  // 如果记录不存在或已过期，创建新记录
  if (!record || now > record.resetAt) {
    store[key] = {
      count: 1,
      resetAt: now + windowMs,
      createdAt: now,
    }
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    }
  }

  // 如果未超过限制
  if (record.count < maxRequests) {
    record.count++
    return {
      allowed: true,
      remaining: maxRequests - record.count,
      resetAt: record.resetAt,
    }
  }

  // 超过限制
  return {
    allowed: false,
    remaining: 0,
    resetAt: record.resetAt,
  }
}

/**
 * 清理过期的记录
 */
function cleanupExpiredRecords() {
  const now = Date.now()
  const keysToDelete: string[] = []
  
  Object.keys(store).forEach((key) => {
    if (now > store[key].resetAt) {
      keysToDelete.push(key)
    }
  })
  
  keysToDelete.forEach((key) => {
    delete store[key]
  })
}

/**
 * 清理最旧的记录（当存储过大时）
 */
function cleanupOldestRecords() {
  const entries = Object.entries(store)
  
  // 按创建时间排序，删除最旧的 10%
  entries.sort((a, b) => a[1].createdAt - b[1].createdAt)
  const toDelete = entries.slice(0, Math.floor(entries.length * 0.1))
  
  toDelete.forEach(([key]) => {
    delete store[key]
  })
}

/**
 * 获取当前存储统计信息（用于监控）
 */
export function getRateLimitStats() {
  return {
    totalRecords: Object.keys(store).length,
    maxSize: MAX_STORE_SIZE,
  }
}

// 每 5 分钟清理一次过期记录（定期清理，双重保障）
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredRecords, 5 * 60 * 1000)
}
