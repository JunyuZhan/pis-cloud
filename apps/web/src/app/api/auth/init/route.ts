import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import crypto from 'crypto'

/**
 * 初始化管理员账号 API
 * 仅在自定义认证模式下可用，且只能在数据库中没有用户时使用
 */

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(32).toString('hex')
  const iterations = 100000
  const keylen = 64
  const digest = 'sha512'
  
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
      if (err) reject(err)
      resolve(`${salt}:${iterations}:${derivedKey.toString('hex')}`)
    })
  })
}

export async function POST(request: NextRequest) {
  // 检查是否是自定义认证模式
  if (process.env.AUTH_MODE !== 'custom' && process.env.DATABASE_TYPE !== 'postgresql') {
    return NextResponse.json(
      { error: 'This endpoint is only available in custom auth mode' },
      { status: 400 }
    )
  }

  // 验证初始化密钥
  const initKey = request.headers.get('x-init-key')
  const expectedKey = process.env.ALBUM_SESSION_SECRET || process.env.AUTH_JWT_SECRET
  
  if (!initKey || initKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Invalid initialization key' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // 连接数据库
    const pool = new Pool({
      host: process.env.DATABASE_HOST || 'postgres',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'pis',
      user: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'pis',
      password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || '',
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    })

    // 检查是否已有用户
    const existingUsers = await pool.query('SELECT COUNT(*) FROM users')
    const userCount = parseInt(existingUsers.rows[0].count, 10)

    if (userCount > 0) {
      await pool.end()
      return NextResponse.json(
        { error: 'Users already exist. Use the login page to access your account.' },
        { status: 400 }
      )
    }

    // 创建管理员账号
    const passwordHash = await hashPassword(password)
    
    await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, 'admin', true, NOW(), NOW())`,
      [email.toLowerCase(), passwordHash]
    )

    await pool.end()

    return NextResponse.json({
      success: true,
      message: 'Admin account created successfully',
    })
  } catch (error) {
    console.error('Init admin error:', error)
    return NextResponse.json(
      { error: 'Failed to create admin account' },
      { status: 500 }
    )
  }
}
