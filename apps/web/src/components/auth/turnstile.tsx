'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Cloudflare Turnstile 组件（Invisible 模式）
 * 完全后台验证，用户无感知
 * 
 * 使用方式：
 * 1. 在 Cloudflare Dashboard 创建站点密钥和密钥
 *    https://dash.cloudflare.com/ -> Turnstile -> Add Site
 * 2. 设置环境变量：
 *    NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key
 *    TURNSTILE_SECRET_KEY=your-secret-key
 * 3. 在登录表单中使用此组件
 * 
 * 注意：如果不配置 Turnstile，登录功能仍然正常工作（降级策略）
 */
interface TurnstileProps {
  onVerify: (token: string) => void
  onError?: () => void
  onExpire?: () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement | string,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          size?: 'invisible'
          theme?: 'light' | 'dark' | 'auto'
        }
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

export function Turnstile({ onVerify, onError, onExpire }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isRendered, setIsRendered] = useState(false)

  useEffect(() => {
    // 检查是否已加载 Turnstile 脚本
    if (window.turnstile) {
      setIsLoaded(true)
      return
    }

    // 加载 Turnstile 脚本
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => setIsLoaded(true)
    script.onerror = () => {
      console.error('Failed to load Cloudflare Turnstile')
      // 如果 Turnstile 加载失败，仍然允许登录（降级策略）
      setIsLoaded(true)
    }
    document.head.appendChild(script)

    return () => {
      // 清理脚本
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !window.turnstile || !containerRef.current || isRendered) {
      return
    }

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

    // 如果没有配置 Turnstile，跳过（可选功能）
    if (!siteKey) {
      return
    }

    try {
      // 渲染 Turnstile widget（Invisible 模式）
      // Invisible 模式会在页面加载时自动执行验证
      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          // 验证成功，token 有效期为 5 分钟
          onVerify(token)
        },
        'error-callback': () => {
          console.error('Turnstile verification failed')
          onError?.()
        },
        'expired-callback': () => {
          console.warn('Turnstile token expired')
          onExpire?.()
        },
        size: 'invisible', // Invisible 模式：完全隐藏，用户无感知
        theme: 'auto', // 自动适应主题
      })

      widgetIdRef.current = widgetId
      setIsRendered(true)
    } catch (error) {
      console.error('Failed to render Turnstile:', error)
      // 如果渲染失败，仍然允许登录（降级策略）
    }

    return () => {
      // 清理 widget
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch (error) {
          console.error('Failed to remove Turnstile widget:', error)
        }
      }
    }
  }, [isLoaded, isRendered, onVerify, onError, onExpire])

  // Invisible 模式不显示任何 UI，但需要一个隐藏的容器
  return <div ref={containerRef} className="hidden" aria-hidden="true" />
}
