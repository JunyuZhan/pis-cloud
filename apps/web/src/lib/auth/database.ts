/**
 * 自定义认证系统 - PostgreSQL 数据库适配器
 */
import { Pool } from 'pg'
import type { AuthDatabase } from './index'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'pis',
      user: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'pis',
      password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || '',
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }
  return pool
}

export const postgresAuthDatabase: AuthDatabase = {
  async findUserByEmail(email: string) {
    const pool = getPool()
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1',
      [email.toLowerCase()]
    )
    return result.rows[0] || null
  },

  async createUser(email: string, passwordHash: string) {
    const pool = getPool()
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, created_at, updated_at) 
       VALUES ($1, $2, NOW(), NOW()) 
       RETURNING id, email`,
      [email.toLowerCase(), passwordHash]
    )
    return result.rows[0]
  },

  async updateUserPassword(userId: string, passwordHash: string) {
    const pool = getPool()
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    )
  },
}

/**
 * 初始化 PostgreSQL 认证数据库
 */
export async function initPostgresAuth(): Promise<void> {
  const { setAuthDatabase } = await import('./index')
  setAuthDatabase(postgresAuthDatabase)
}
