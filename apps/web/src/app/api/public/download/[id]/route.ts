import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Client as MinioClient } from 'minio'

interface RouteParams {
  params: Promise<{ id: string }>
}

// MinIO 客户端（懒初始化）
let minioClient: MinioClient | null = null

function getMinioClient(): MinioClient {
  if (!minioClient) {
    minioClient = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || '',
      secretKey: process.env.MINIO_SECRET_KEY || '',
    })
  }
  return minioClient
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

    // 生成 Presigned URL（有效期 5 分钟）
    const bucket = process.env.MINIO_BUCKET || 'pis-photos'
    const minio = getMinioClient()
    
    const downloadUrl = await minio.presignedGetObject(
      bucket,
      photo.original_key,
      5 * 60, // 5 分钟有效期
      {
        'response-content-disposition': `attachment; filename="${encodeURIComponent(photo.filename)}"`,
      }
    )

    return NextResponse.json({
      downloadUrl,
      filename: photo.filename,
      expiresIn: 300, // 5 分钟
    })
  } catch {
    console.error('Download API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
