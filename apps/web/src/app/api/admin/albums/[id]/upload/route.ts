import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'
import { checkRateLimit } from '@/middleware-rate-limit'
import { Client as MinioClient } from 'minio'

interface RouteParams {
  params: Promise<{ id: string }>
}

// MinIO 客户端（懒初始化）
let minioClient: MinioClient | null = null

function getMinioClient(): MinioClient {
  if (!minioClient) {
    // 优先使用新的环境变量名，兼容旧的
    const endpoint = process.env.STORAGE_ENDPOINT || process.env.MINIO_ENDPOINT_HOST || 'localhost'
    const port = parseInt(process.env.STORAGE_PORT || process.env.MINIO_ENDPOINT_PORT || '9000')
    const useSSL = process.env.STORAGE_USE_SSL === 'true' || process.env.MINIO_USE_SSL === 'true'
    const accessKey = process.env.STORAGE_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || ''
    const secretKey = process.env.STORAGE_SECRET_KEY || process.env.MINIO_SECRET_KEY || ''
    
    minioClient = new MinioClient({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    })
  }
  return minioClient
}

/**
 * 获取上传凭证 API
 * 返回 Presigned URL 用于直接上传到 MinIO
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: albumId } = await params
    const supabase = await createClient()

    // 验证登录状态
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { status: 401 }
      )
    }

    // 速率限制：每个用户每分钟最多 20 次上传请求
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const identifier = `upload:${user.id}:${ip}`
    const rateLimit = checkRateLimit(identifier, 20, 60 * 1000) // 20 次/分钟

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `上传请求过于频繁，请稍后再试。将在 ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)} 秒后重置`,
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // 验证相册存在
    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (albumError || !album) {
      return NextResponse.json(
        { error: { code: 'ALBUM_NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 解析请求体
    let body: any
    try {
      body = await request.json()
    } catch (err) {
      console.error('Failed to parse request body:', err)
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { filename, contentType, fileSize } = body

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' } },
        { status: 400 }
      )
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: { code: 'INVALID_FILE_TYPE', message: '不支持的文件格式' } },
        { status: 400 }
      )
    }

    // 验证文件大小 (100MB)
    if (fileSize && fileSize > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: { code: 'FILE_TOO_LARGE', message: '文件大小不能超过 100MB' } },
        { status: 400 }
      )
    }

    // 生成照片 ID 和存储路径
    const photoId = uuidv4()
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
    const originalKey = `raw/${albumId}/${photoId}.${ext}`

    // 创建照片记录 (状态为 pending)
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (adminClient as any)
      .from('photos')
      .insert({
        id: photoId,
        album_id: albumId,
        original_key: originalKey,
        filename,
        file_size: fileSize,
        mime_type: contentType,
        status: 'pending',
      })

    if (insertError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: insertError.message } },
        { status: 500 }
      )
    }

    // 使用 Next.js 代理上传（避免 CORS 问题）
    // 浏览器 → Next.js API → 远程 Worker → MinIO
    const uploadUrl = `/api/admin/upload-proxy?key=${encodeURIComponent(originalKey)}`

    return NextResponse.json({
      photoId,
      uploadUrl,  // Worker 代理上传 URL
      originalKey,
      albumId,
    })
  } catch (err) {
    console.error('Upload API error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
