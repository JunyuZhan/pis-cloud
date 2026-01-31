'use client'

import { useState, useEffect } from 'react'
import { X, Download, Share, Plus } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // 检查是否已经安装
    interface NavigatorStandalone extends Navigator {
      standalone?: boolean
    }
    interface WindowMSStream extends Window {
      MSStream?: unknown
    }
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as NavigatorStandalone).standalone === true
    setIsStandalone(standalone)

    if (standalone) return

    // 检查是否已经提示过（永久不再提示）
    const lastPrompt = localStorage.getItem('pwa-prompt-dismissed')
    if (lastPrompt) {
      // 如果已经关闭过，就不再提示
      return
    }

    // 检查是否是 iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as WindowMSStream).MSStream
    setIsIOS(iOS)

    // 监听 beforeinstallprompt 事件
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // 延迟显示提示，让用户先浏览
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // iOS 设备显示手动安装提示（只有在未关闭过的情况下）
    if (iOS) {
      setTimeout(() => setShowPrompt(true), 5000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      if (outcome === 'accepted') {
        console.log('[PWA] User accepted install prompt')
        // 用户接受了安装，记录到 localStorage，避免再次提示
        localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
      }
    } catch (error) {
      console.error('[PWA] Install error:', error)
    }

    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
  }

  if (isStandalone || !showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
      <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          {/* 图标 */}
          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
            <Download className="w-6 h-6 text-accent" />
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-text-primary mb-1">
              安装 PIS 应用
            </h3>
            <p className="text-sm text-text-secondary mb-3">
              {isIOS 
                ? '添加到主屏幕，获得更好的体验'
                : '安装应用，随时随地查看照片'
              }
            </p>

            {isIOS ? (
              // iOS 安装指引
              <div className="text-xs text-text-muted space-y-1">
                <p className="flex items-center gap-1">
                  <span className="bg-surface px-1.5 py-0.5 rounded">1</span>
                  点击底部的 <Share className="w-3.5 h-3.5 inline" /> 分享按钮
                </p>
                <p className="flex items-center gap-1">
                  <span className="bg-surface px-1.5 py-0.5 rounded">2</span>
                  选择 <Plus className="w-3.5 h-3.5 inline" /> &quot;添加到主屏幕&quot;
                </p>
              </div>
            ) : (
              // 其他平台安装按钮
              <div className="flex gap-2">
                <button
                  onClick={handleInstall}
                  className="btn-primary text-sm flex-1"
                >
                  <Download className="w-4 h-4" />
                  立即安装
                </button>
              </div>
            )}
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={handleDismiss}
            className="text-text-muted hover:text-text-primary p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
