'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Eye, EyeOff } from 'lucide-react'
import { Turnstile } from '@/components/auth/turnstile'

/**
 * 管理员登录页
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileContainerRef = useRef<HTMLDivElement>(null)
  const [isClient, setIsClient] = useState(false)

  // 检查是否配置了 Turnstile（只在客户端检查，避免 Hydration 错误）
  useEffect(() => {
    setIsClient(true)
  }, [])

  const hasTurnstile = isClient && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // 注意：错误消息现在由服务端统一处理，不再需要客户端映射
  // 保留此函数用于向后兼容，但实际不再使用

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 前端验证
    if (!email.trim()) {
      setError('请输入邮箱地址')
      setLoading(false)
      return
    }
    if (!password) {
      setError('请输入密码')
      setLoading(false)
      return
    }

    // 如果配置了 Turnstile，等待验证完成
    // Invisible 模式会在页面加载时自动执行验证
    if (hasTurnstile && !turnstileToken) {
      // 等待 Turnstile 验证完成（最多等待 2 秒）
      let waited = 0
      const maxWait = 2000
      while (!turnstileToken && waited < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        waited += 100
      }
      
      // 如果超时仍未获取到 token，允许继续（降级策略）
      // 服务端会验证 token，如果没有 token 且配置了 Turnstile，会拒绝登录
      if (!turnstileToken && waited >= maxWait) {
        setError('验证超时，请刷新页面重试')
        setLoading(false)
        return
      }
    }

    try {

      // 调用服务端登录 API（包含速率限制和登录逻辑）
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          turnstileToken: turnstileToken || undefined, // 可选：如果配置了 Turnstile
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // 处理速率限制错误
        if (response.status === 429) {
          setError(data.error?.message || '请求过于频繁，请稍后再试')
        } else if (response.status === 401) {
          // 统一错误消息，不暴露具体错误原因
          setError('邮箱或密码错误')
        } else if (response.status === 400) {
          setError(data.error?.message || '请求格式错误')
        } else {
          setError(data.error?.message || '登录失败，请重试')
        }
        return
      }

      // 登录成功，刷新页面以更新会话
      router.push('/admin')
      router.refresh()
    } catch (err) {
      console.error('Login error:', err)
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-elevated rounded-2xl mb-4">
            <Camera className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-serif font-bold">PIS 管理后台</h1>
          <p className="text-text-secondary mt-2">请登录以继续</p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleLogin} className="card space-y-6 p-6 sm:p-8">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              邮箱地址
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              密码
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Cloudflare Turnstile (Invisible 模式) */}
          {hasTurnstile && (
            <div ref={turnstileContainerRef} className="hidden">
              <Turnstile
                onVerify={(token) => {
                  setTurnstileToken(token)
                }}
                onError={() => {
                  setError('验证失败，请刷新页面重试')
                }}
                onExpire={() => {
                  setTurnstileToken(null)
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                登录中...
              </>
            ) : (
              '登录'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
