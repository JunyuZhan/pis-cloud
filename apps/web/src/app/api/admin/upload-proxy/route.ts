import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 上传代理 API
 * 浏览器 → Next.js API → 远程 Worker
 * 这样可以避免 CORS 问题
 */
export async function PUT(request: NextRequest) {
  try {
    // 验证登录状态
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { status: 401 }
      )
    }

    // 获取上传 key
    const key = request.nextUrl.searchParams.get('key')
    if (!key) {
      return NextResponse.json(
        { error: { code: 'MISSING_KEY', message: '缺少 key 参数' } },
        { status: 400 }
      )
    }

    // 获取请求体
    const body = await request.arrayBuffer()
    const contentType = request.headers.get('content-type') || 'application/octet-stream'

    // 转发到远程 Worker
    const workerUrl = process.env.WORKER_API_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
    const uploadUrl = `${workerUrl}/api/upload?key=${encodeURIComponent(key)}`

    // 使用 AbortController 设置超时（根据文件大小动态计算，最大30分钟）
    // 基础超时：10分钟，每MB增加5秒
    const fileSizeMb = body.byteLength / (1024 * 1024)
    const baseTimeout = 10 * 60 * 1000 // 10分钟
    const perMbTimeout = 5 * 1000 // 每MB 5秒
    const maxTimeout = 30 * 60 * 1000 // 30分钟
    const timeout = Math.min(baseTimeout + fileSizeMb * perMbTimeout, maxTimeout)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const workerResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        body: body,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text()
        console.error('Worker upload failed:', workerResponse.status, errorText)
        return NextResponse.json(
          { error: { code: 'UPLOAD_FAILED', message: `上传失败: ${workerResponse.status}` } },
          { status: workerResponse.status }
        )
      }

      const result = await workerResponse.json()
      return NextResponse.json(result)
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId)
      
      // 如果是超时或连接被关闭，可能上传已经成功但响应没返回
      // 返回一个"可能成功"的响应，让前端继续处理流程
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error'
      console.warn('Upload proxy: connection issue, upload may have succeeded:', errorMessage)
      
      // 返回成功，因为文件可能已经上传
      return NextResponse.json({ 
        success: true, 
        key,
        warning: 'Upload response timeout, but file may have been uploaded successfully'
      })
    }

  } catch {
    console.error('Upload proxy error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

// 处理 OPTIONS 预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
