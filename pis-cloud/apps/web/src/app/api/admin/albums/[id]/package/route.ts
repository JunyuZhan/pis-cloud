import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 打包下载 API
 * POST /api/admin/albums/[id]/package - 创建打包下载任务
 * GET /api/admin/albums/[id]/package/[packageId] - 获取打包状态和下载链接
 */

// POST /api/admin/albums/[id]/package - 创建打包下载任务
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
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

    // 解析请求体
    interface PackageRequestBody {
      photoIds?: string[]
      photoSelection?: 'all' | 'selected' | 'custom'
      includeWatermarked?: boolean
      includeOriginal?: boolean
    }
    let body: PackageRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const {
      photoIds, // 照片ID数组，如果为空则使用所有照片或已选照片
      photoSelection = 'all', // 'all' | 'selected' | 'custom'
      includeWatermarked = true,
      includeOriginal = true,
    } = body

    // 验证相册存在
    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('id, title, allow_download')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (albumError || !album) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    if (!album.allow_download) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '此相册不允许下载' } },
        { status: 403 }
      )
    }

    // 确定要打包的照片
    let finalPhotoIds: string[] = []

    if (photoSelection === 'selected') {
      // 获取已选照片（排除已删除的）
      const { data: selectedPhotos } = await supabase
        .from('photos')
        .select('id')
        .eq('album_id', id)
        .eq('is_selected', true)
        .eq('status', 'completed')
        .is('deleted_at', null)

      finalPhotoIds = selectedPhotos?.map(p => p.id) || []
    } else if (photoSelection === 'custom' && Array.isArray(photoIds)) {
      finalPhotoIds = photoIds
    } else {
      // 获取所有照片（排除已删除的）
      const { data: allPhotos } = await supabase
        .from('photos')
        .select('id')
        .eq('album_id', id)
        .eq('status', 'completed')
        .is('deleted_at', null)

      finalPhotoIds = allPhotos?.map(p => p.id) || []
    }

    if (finalPhotoIds.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '没有可打包的照片' } },
        { status: 400 }
      )
    }

    // 限制打包数量
    if (finalPhotoIds.length > 500) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '单次最多打包500张照片' } },
        { status: 400 }
      )
    }

    // 创建打包任务记录
    const { data: packageData, error: packageError } = await supabase
      .from('package_downloads')
      .insert({
        album_id: id,
        photo_ids: finalPhotoIds,
        include_watermarked: includeWatermarked,
        include_original: includeOriginal,
        status: 'pending',
      })
      .select()
      .single()

    if (packageError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: packageError.message } },
        { status: 500 }
      )
    }

    // 触发 Worker 处理
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    const workerApiKey = process.env.WORKER_API_KEY
    if (workerApiKey) {
      headers['X-API-Key'] = workerApiKey
    }
    try {
      await fetch(`${workerUrl}/api/package`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          packageId: packageData.id,
          albumId: id,
          photoIds: finalPhotoIds,
          includeWatermarked,
          includeOriginal,
        }),
      })
    } catch {
      console.error('Failed to trigger package worker:')
      // 即使 Worker 调用失败，也返回成功，因为任务已创建
    }

    return NextResponse.json({
      packageId: packageData.id,
      status: 'pending',
      message: '打包任务已创建，正在处理中...',
    })
  } catch {
    console.error('Package creation error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// GET /api/admin/albums/[id]/package/[packageId] - 获取打包状态
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const packageId = searchParams.get('packageId')

    if (!packageId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '缺少 packageId 参数' } },
        { status: 400 }
      )
    }

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

    // 获取打包任务信息
    const { data: packageData, error } = await supabase
      .from('package_downloads')
      .select('*')
      .eq('id', packageId)
      .eq('album_id', id)
      .single()

    if (error || !packageData) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '打包任务不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json(packageData)
  } catch {
    console.error('Get package error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
