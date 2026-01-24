/**
 * Worker API 代理
 * 
 * 将所有请求转发到 Worker 服务，避免 CORS 问题
 * 
 * 路由映射:
 * - /api/worker/multipart/init -> WORKER_URL/api/multipart/init
 * - /api/worker/multipart/upload -> WORKER_URL/api/multipart/upload
 * - /api/worker/multipart/complete -> WORKER_URL/api/multipart/complete
 * - /api/worker/multipart/abort -> WORKER_URL/api/multipart/abort
 * - /api/worker/upload -> WORKER_URL/api/upload
 * - /api/worker/presign -> WORKER_URL/api/presign
 * - /api/worker/health -> WORKER_URL/health
 */

import { NextRequest, NextResponse } from 'next/server'

// Worker 服务 URL (服务端环境变量，不暴露给客户端)
// 支持多个变量名，确保兼容性
const WORKER_URL = process.env.WORKER_URL || process.env.WORKER_API_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params)
}

async function proxyRequest(
  request: NextRequest,
  params: { path: string[] }
) {
  try {
    const pathSegments = params.path
    
    // 构建目标 URL
    let targetPath = '/api/' + pathSegments.join('/')
    
    // 特殊处理 health 端点
    if (pathSegments[0] === 'health') {
      targetPath = '/health'
    }
    
    // 保留查询参数
    const url = new URL(request.url)
    const queryString = url.search
    
    const targetUrl = `${WORKER_URL}${targetPath}${queryString}`
    
    console.log(`[Worker Proxy] ${request.method} ${targetUrl}`)
    
    // 准备请求头
    const headers: HeadersInit = {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
    }
    
    // 转发请求
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    }
    
    // 对于有 body 的请求，转发 body
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers.get('Content-Type') || ''
      
      if (contentType.includes('application/json')) {
        // JSON 请求
        const body = await request.text()
        fetchOptions.body = body
      } else {
        // 二进制数据 (如分片上传)
        const body = await request.arrayBuffer()
        fetchOptions.body = body
        headers['Content-Type'] = contentType || 'application/octet-stream'
      }
    }
    
    const response = await fetch(targetUrl, fetchOptions)
    
    // 读取响应
    const responseContentType = response.headers.get('Content-Type') || ''
    
    if (responseContentType.includes('application/json')) {
      const data = await response.json()
      return NextResponse.json(data, { status: response.status })
    } else {
      const data = await response.arrayBuffer()
      return new NextResponse(data, {
        status: response.status,
        headers: {
          'Content-Type': responseContentType,
        },
      })
    }
  } catch (error) {
    console.error('[Worker Proxy] Error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // 检查是否是连接错误
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      return NextResponse.json(
        { 
          error: 'Worker 服务不可用',
          details: `无法连接到 ${WORKER_URL}`,
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
