import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

interface RouteParams {
  params: Promise<{ id: string }>
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
    const body = await request.json()
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

    // 获取 Presigned URL (从内网 Worker API)
    const workerApiUrl = process.env.WORKER_API_URL || 'http://localhost:3001'
    
    let presignedUrl: string
    try {
      const presignRes = await fetch(`${workerApiUrl}/api/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: originalKey }),
      })
      
      if (!presignRes.ok) {
        throw new Error('Failed to get presigned URL')
      }
      
      const presignData = await presignRes.json()
      presignedUrl = presignData.url
    } catch (err) {
      console.error('Worker API error:', err)
      return NextResponse.json(
        { error: { code: 'WORKER_ERROR', message: '无法连接存储服务' } },
        { status: 503 }
      )
    }

    // 返回上传信息
    return NextResponse.json({
      photoId,
      uploadUrl: presignedUrl,  // MinIO Presigned URL
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
