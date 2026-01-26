import { NextRequest, NextResponse } from 'next/server'
import { createClientFromRequest, createAdminClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 检查文件是否重复
 * POST /api/admin/albums/[id]/check-duplicate
 * 
 * 请求体:
 * {
 *   filename: string,
 *   fileSize: number,
 *   fileHash?: string  // 可选，如果提供则使用哈希值检测（更准确）
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    let albumId: string
    try {
      const paramsResult = await params
      albumId = paramsResult.id
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAMS', message: '无效的请求参数' } },
        { status: 400 }
      )
    }

    const response = new NextResponse()
    const supabase = createClientFromRequest(request, response)

    // 验证登录状态
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { 
          status: 401,
          headers: response.headers,
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
        { 
          status: 404,
          headers: response.headers,
        }
      )
    }

    // 解析请求体
    interface CheckDuplicateRequestBody {
      filename: string
      fileSize: number
      fileHash?: string
    }

    let body: CheckDuplicateRequestBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误' } },
        { 
          status: 400,
          headers: response.headers,
        }
      )
    }

    const { filename, fileSize, fileHash } = body

    if (!filename || fileSize === undefined) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' } },
        { 
          status: 400,
          headers: response.headers,
        }
      )
    }

    const adminClient = createAdminClient()

    // 检查重复：优先使用文件哈希（如果提供），否则使用文件名+文件大小
    let duplicatePhoto = null

    if (fileHash) {
      // 使用哈希值检测（最准确）
      // 注意：如果数据库中没有 hash 字段，这个查询会失败，需要先添加字段
      // 暂时先使用文件名+大小检测
      // TODO: 添加 hash 字段到数据库后启用此检测
      /*
      const { data: hashMatch } = await adminClient
        .from('photos')
        .select('id, filename')
        .eq('album_id', albumId)
        .eq('hash', fileHash)
        .is('deleted_at', null)
        .limit(1)
        .single()
      
      if (hashMatch) {
        duplicatePhoto = hashMatch
      }
      */
    }

    // 如果没有通过哈希找到，使用文件名+文件大小检测
    if (!duplicatePhoto) {
      const { data: sizeMatch, error: sizeError } = await adminClient
        .from('photos')
        .select('id, filename, file_size')
        .eq('album_id', albumId)
        .eq('filename', filename)
        .eq('file_size', fileSize)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()

      // maybeSingle() 在找不到记录时返回 null 而不是抛出错误
      if (!sizeError && sizeMatch) {
        duplicatePhoto = sizeMatch
      }
    }

    return NextResponse.json(
      {
        isDuplicate: !!duplicatePhoto,
        duplicatePhoto: duplicatePhoto || null,
      },
      {
        headers: response.headers,
      }
    )
  } catch (error) {
    console.error('[Check Duplicate API] Error:', error)
    const errorMessage = error instanceof Error ? error.message : '服务器错误'
    
    return NextResponse.json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: errorMessage
        } 
      },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
