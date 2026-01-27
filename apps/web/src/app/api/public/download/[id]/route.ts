import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 原图下载 API
 * 生成带签名的临时下载链接
 * 仅当相册允许下载时才返回
 */

// GET /api/public/download/[id] - 获取原图下载链接
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 获取照片信息，同时检查相册下载权限
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select(`
        id,
        original_key,
        filename,
        album_id,
        albums!inner (
          id,
          allow_download,
          deleted_at
        )
      `)
      .eq('id', id)
      .eq('status', 'completed')
      .single()

    if (photoError || !photo) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '照片不存在' } },
        { status: 404 }
      )
    }

    // 类型断言处理嵌套查询结果
    const album = photo.albums as unknown as {
      id: string
      allow_download: boolean
      deleted_at: string | null
    }

    // 检查相册是否已删除
    if (album.deleted_at) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 检查下载权限
    if (!album.allow_download) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '该相册不允许下载原图' } },
        { status: 403 }
      )
    }

    // 通过 Worker API 生成 Presigned URL（Vercel 无法直接连接内网 MinIO）
    const workerUrl = process.env.WORKER_API_URL || process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
    const workerApiKey = process.env.WORKER_API_KEY
    
    if (!workerApiKey) {
      console.error('[Download API] WORKER_API_KEY not configured')
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: '服务器配置错误' } },
        { status: 500 }
      )
    }

    // 调用 Worker API 生成 presigned URL
    const workerResponse = await fetch(`${workerUrl}/api/presign/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': workerApiKey,
      },
      body: JSON.stringify({
        key: photo.original_key,
        expirySeconds: 5 * 60, // 5 分钟有效期
        responseContentDisposition: `attachment; filename="${encodeURIComponent(photo.filename)}"`,
      }),
    })

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text()
      console.error('[Download API] Worker API error:', workerResponse.status, errorText)
      return NextResponse.json(
        { error: { code: 'WORKER_ERROR', message: '生成下载链接失败' } },
        { status: 500 }
      )
    }

    const { url: downloadUrl } = await workerResponse.json()

    return NextResponse.json({
      downloadUrl,
      filename: photo.filename,
      expiresIn: 300, // 5 分钟
    })
  } catch (error: unknown) {
    console.error('[Download API] Error:', error)
    const errorMessage = error instanceof Error ? error.message : '服务器错误'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: errorMessage } },
      { status: 500 }
    )
  }
}
