/**
 * Worker API 代理
 * 
 * 将所有请求转发到 Worker 服务，避免 CORS 问题并统一处理 API Key 认证
 * 
 * 路由映射:
 * - /api/worker/multipart/init -> WORKER_URL/api/multipart/init
 * - /api/worker/multipart/upload -> WORKER_URL/api/multipart/upload
 * - /api/worker/multipart/complete -> WORKER_URL/api/multipart/complete
 * - /api/worker/multipart/abort -> WORKER_URL/api/multipart/abort
 * - /api/worker/upload -> WORKER_URL/api/upload
 * - /api/worker/presign -> WORKER_URL/api/presign
 * - /api/worker/package -> WORKER_URL/api/package
 * - /api/worker/scan -> WORKER_URL/api/scan
 * - /api/worker/process -> WORKER_URL/api/process
 * - /api/worker/check-pending -> WORKER_URL/api/check-pending
 * - /api/worker/list-files -> WORKER_URL/api/list-files
 * - /api/worker/cleanup-file -> WORKER_URL/api/cleanup-file
 * - /api/worker/health -> WORKER_URL/health
 * 
 * 注意：所有端点（除了 /health）都需要用户认证，API Key 会自动添加
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClientFromRequest } from '@/lib/supabase/server'

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
    
    // 添加认证检查（除了 health 端点）
    // health 端点用于监控，不需要认证
    if (pathSegments[0] !== 'health') {
      const response = new NextResponse()
      const supabase = createClientFromRequest(request, response)
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
    }
    
    // 构建目标 URL
    // 前端调用 /api/worker/presign，pathSegments = ['presign']
    // 需要转换为 /api/presign（Worker 服务的实际路径）
    // 前端调用 /api/worker/api/multipart/init，pathSegments = ['api', 'multipart', 'init']
    // 需要转换为 /api/multipart/init
    let targetPath: string
    
    // 特殊处理 health 端点
    if (pathSegments[0] === 'health') {
      targetPath = '/health'
    } else if (pathSegments[0] === 'presign') {
      // presign 端点需要映射到 /api/presign
      targetPath = '/api/presign'
    } else if (pathSegments[0] === 'api') {
      // 如果第一个段是 'api'，保持原样
      targetPath = '/' + pathSegments.join('/')
    } else {
      // 其他情况，添加 /api 前缀
      targetPath = '/api/' + pathSegments.join('/')
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
    
    // 添加 Worker API Key 认证
    const workerApiKey = process.env.WORKER_API_KEY
    if (workerApiKey) {
      headers['X-API-Key'] = workerApiKey
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
    
    const workerResponse = await fetch(targetUrl, fetchOptions)
    
    // 读取响应
    const responseContentType = workerResponse.headers.get('Content-Type') || ''
    
    if (responseContentType.includes('application/json')) {
      const data = await workerResponse.json()
      // 如果响应包含错误，统一错误格式
      const responseHeaders = new Headers()
      if (!workerResponse.ok && data.error) {
        return NextResponse.json(
          { 
            error: { 
              code: data.error.code || 'WORKER_ERROR',
              message: typeof data.error === 'string' ? data.error : (data.error.message || data.error),
              details: data.error.details || data.details
            } 
          },
          { 
            status: workerResponse.status,
            headers: responseHeaders,
          }
        )
      }
      return NextResponse.json(
        data, 
        { 
          status: workerResponse.status,
          headers: responseHeaders,
        }
      )
    } else {
      const data = await workerResponse.arrayBuffer()
      const responseHeaders = new Headers()
      responseHeaders.set('Content-Type', responseContentType)
      return new NextResponse(data, {
        status: workerResponse.status,
        headers: responseHeaders,
      })
    }
  } catch (error) {
    console.error('[Worker Proxy] Error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const response = new NextResponse()
    
    // 检查是否是连接错误
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed') || errorMessage.includes('ECONNRESET')) {
      return NextResponse.json(
        { 
          error: { 
            code: 'WORKER_UNAVAILABLE',
            message: 'Worker 服务不可用',
            details: `无法连接到 Worker 服务 (${WORKER_URL})。请检查 Worker 服务是否正在运行，以及 WORKER_URL 环境变量是否正确配置。`
          }
        },
        { 
          status: 503,
          headers: response.headers,
        }
      )
    }
    
    return NextResponse.json(
      { 
        error: { 
          code: 'PROXY_ERROR',
          message: errorMessage,
          details: '请求转发到 Worker 服务时发生错误'
        } 
      },
      { 
        status: 500,
        headers: response.headers,
      }
    )
  }
}
