import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface FileInfo {
  key: string
  size?: number
  lastModified?: string
}

/**
 * 检查相册在 MinIO 中的文件情况
 * GET /api/admin/albums/[id]/check-storage
 * 
 * 对比数据库记录和 MinIO 中的实际文件
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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
    const { data: albumData, error: albumError } = await supabase
      .from('albums')
      .select('id, title')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (albumError || !albumData) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 查询数据库中的所有照片记录（排除已删除的）
    const adminClient = createAdminClient()
    const { data: dbPhotos, error: dbError } = await adminClient
      .from('photos')
      .select('id, original_key, thumb_key, preview_key, filename, status')
      .eq('album_id', albumId)
      .is('deleted_at', null)

    if (dbError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: dbError.message } },
        { status: 500 }
      )
    }

    // 使用代理路由调用 Worker API 检查 MinIO 中的文件
    // 代理路由会自动处理 Worker URL 配置和认证
    const requestUrl = new URL(request.url)
    const protocol = requestUrl.protocol
    const host = requestUrl.host
    const proxyUrl = `http://localhost:3000/api/worker/list-files`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    // 传递认证 cookie，代理路由会处理认证
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      headers['cookie'] = cookieHeader
    }

    // 检查 raw/{albumId}/ 路径下的文件
    let rawFiles: FileInfo[] = []
    try {
      const rawResponse = await fetch(proxyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prefix: `raw/${albumId}/` }),
      })
      if (rawResponse.ok) {
        const rawData = await rawResponse.json()
        rawFiles = rawData.files || []
      }
    } catch (err) {
      console.error('Failed to list raw files:', err)
    }

    // 检查 processed/{albumId}/ 路径下的文件
    let processedFiles: FileInfo[] = []
    try {
      const processedResponse = await fetch(proxyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prefix: `processed/${albumId}/` }),
      })
      if (processedResponse.ok) {
        const processedData = await processedResponse.json()
        processedFiles = processedData.files || []
      }
    } catch (err) {
      console.error('Failed to list processed files:', err)
    }

    // 分析结果
    const dbPhotoKeys = new Set<string>()
    const dbThumbKeys = new Set<string>()
    const dbPreviewKeys = new Set<string>()

    dbPhotos?.forEach(photo => {
      if (photo.original_key) dbPhotoKeys.add(photo.original_key)
      if (photo.thumb_key) dbThumbKeys.add(photo.thumb_key)
      if (photo.preview_key) dbPreviewKeys.add(photo.preview_key)
    })

    const rawFileKeys = new Set(rawFiles.map((f) => f.key))
    const processedFileKeys = new Set(processedFiles.map((f) => f.key))

    // 找出数据库中有但 MinIO 中没有的文件
    const missingInStorage: string[] = []
    dbPhotos?.forEach(photo => {
      if (photo.original_key && !rawFileKeys.has(photo.original_key)) {
        missingInStorage.push(`原始文件: ${photo.original_key}`)
      }
      if (photo.thumb_key && !processedFileKeys.has(photo.thumb_key)) {
        missingInStorage.push(`缩略图: ${photo.thumb_key}`)
      }
      if (photo.preview_key && !processedFileKeys.has(photo.preview_key)) {
        missingInStorage.push(`预览图: ${photo.preview_key}`)
      }
    })

    // 找出 MinIO 中有但数据库中没有的文件
    const missingInDb: string[] = []
    rawFiles.forEach((file) => {
      if (!dbPhotoKeys.has(file.key)) {
        missingInDb.push(`原始文件: ${file.key}`)
      }
    })
    processedFiles.forEach((file) => {
      if (!dbThumbKeys.has(file.key) && !dbPreviewKeys.has(file.key)) {
        missingInDb.push(`处理文件: ${file.key}`)
      }
    })

    return NextResponse.json({
      album: {
        id: albumData.id,
        title: albumData.title,
      },
      summary: {
        dbPhotos: dbPhotos?.length || 0,
        rawFiles: rawFiles.length,
        processedFiles: processedFiles.length,
        missingInStorage: missingInStorage.length,
        missingInDb: missingInDb.length,
      },
      details: {
        dbPhotos: dbPhotos?.map(p => ({
          id: p.id,
          filename: p.filename,
          status: p.status,
          original_key: p.original_key,
          thumb_key: p.thumb_key,
          preview_key: p.preview_key,
        })),
        missingInStorage,
        missingInDb,
      },
    })
  } catch (error) {
    console.error('[Check Storage] API error:', error)
    const errorMessage = error instanceof Error ? error.message : '服务器错误'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: errorMessage } },
      { status: 500 }
    )
  }
}
