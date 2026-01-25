'use client'

import { useState, useEffect } from 'react'
import { Share2, Copy, Check, ExternalLink, QrCode, Download, MessageCircle, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { showError, showInfo } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface ShareLinkButtonProps {
  url: string
  albumTitle?: string
}

// 检测是否在微信环境中
const isWeChat = () => {
  if (typeof window === 'undefined') return false
  return /MicroMessenger/i.test(navigator.userAgent)
}

export function ShareLinkButton({ url, albumTitle = '相册' }: ShareLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [isWeixin, setIsWeixin] = useState(false)

  useEffect(() => {
    setIsWeixin(isWeChat())
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      // 关闭对话框，提供更好的反馈
      setTimeout(() => setOpen(false), 1500)
    } catch {
      console.error('复制失败:')
      // 降级方案：使用传统复制方法
      const textArea = document.createElement('textarea')
      textArea.value = url
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        setTimeout(() => setOpen(false), 1500)
      } catch {
        showError('复制失败，请手动复制链接')
      }
      document.body.removeChild(textArea)
    }
  }

  const handleOpen = () => {
    window.open(url, '_blank')
  }

  const handleDownloadQR = () => {
    const svg = document.getElementById('qr-code-svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.download = `${albumTitle}-二维码.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  // 微信分享到朋友圈
  const handleWeChatTimeline = () => {
    if (isWeixin) {
      // 在微信中，引导用户使用右上角分享菜单
      showInfo('请点击右上角菜单，选择"分享到朋友圈"')
      setOpen(false)
    } else {
      // 非微信环境，尝试打开微信（需要用户安装微信）
      const shareText = `${albumTitle} - ${url}`
      const weixinUrl = `weixin://dl/moments/?text=${encodeURIComponent(shareText)}`
      window.location.href = weixinUrl
      setTimeout(() => {
        showInfo('如果未打开微信，请复制链接后在微信中分享')
      }, 1000)
    }
  }

  // 微信分享给好友
  const handleWeChatFriend = () => {
    if (isWeixin) {
      // 在微信中，引导用户使用右上角分享菜单
      showInfo('请点击右上角菜单，选择"发送给朋友"')
      setOpen(false)
    } else {
      // 非微信环境，尝试打开微信（需要用户安装微信）
      const shareText = `${albumTitle} - ${url}`
      const weixinUrl = `weixin://dl/chat?text=${encodeURIComponent(shareText)}`
      window.location.href = weixinUrl
      setTimeout(() => {
        showInfo('如果未打开微信，请复制链接后在微信中分享')
      }, 1000)
    }
  }

  // 原生分享（移动端）
  const handleNativeShare = async () => {
    if (typeof window !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: albumTitle,
          text: `查看 ${albumTitle} 的精彩照片`,
          url: url,
        })
        setOpen(false)
      } catch (err) {
        // 用户取消分享
        if (err instanceof Error && err.name !== 'AbortError') {
          showError('分享失败，请重试')
        }
      }
    } else {
      showInfo('您的设备不支持原生分享，请使用其他方式')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary text-sm !min-h-[32px] md:!min-h-[44px] !px-2 md:!px-3 !py-1 md:!py-2"
        aria-label="分享相册"
        title="分享相册"
      >
        <Share2 className="w-4 h-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>分享相册</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {showQR ? '扫描二维码即可访问相册' : '复制链接分享给客户'}
          </DialogDescription>

          {/* 标签切换 */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setShowQR(false)}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                !showQR 
                  ? 'bg-accent text-background' 
                  : 'bg-surface text-text-secondary hover:text-text-primary'
              )}
            >
              链接分享
            </button>
            <button
              type="button"
              onClick={() => setShowQR(true)}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 min-h-[44px]',
                showQR 
                  ? 'bg-accent text-background' 
                  : 'bg-surface text-text-secondary hover:text-text-primary'
              )}
            >
              <QrCode className="w-4 h-4" />
              二维码
            </button>
          </div>

          {!showQR ? (
            <>
              <p className="text-sm text-text-secondary mb-3">分享此相册给客户：</p>
              
              {/* 分享选项网格 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {/* 微信朋友圈 */}
                <button
                  type="button"
                  onClick={handleWeChatTimeline}
                  className="flex flex-col items-center justify-center gap-2 p-4 bg-surface hover:bg-surface-elevated rounded-lg transition-colors min-h-[100px]"
                >
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-text-secondary">朋友圈</span>
                </button>

                {/* 微信好友 */}
                <button
                  type="button"
                  onClick={handleWeChatFriend}
                  className="flex flex-col items-center justify-center gap-2 p-4 bg-surface hover:bg-surface-elevated rounded-lg transition-colors min-h-[100px]"
                >
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-text-secondary">微信好友</span>
                </button>

                {/* 原生分享（移动端） */}
                {typeof window !== 'undefined' && 'share' in navigator && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-surface hover:bg-surface-elevated rounded-lg transition-colors min-h-[100px]"
                  >
                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                      <Share2 className="w-6 h-6 text-background" />
                    </div>
                    <span className="text-xs text-text-secondary">更多</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 p-2 bg-surface rounded-lg mb-3">
                <input
                  type="text"
                  value={url}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-text-primary outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 btn-primary text-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      复制链接
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleOpen}
                  className="btn-secondary text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  预览
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-text-secondary mb-3 text-center">扫描二维码访问相册</p>
              
              {/* 二维码 - 响应式尺寸 */}
              <div className="flex justify-center p-4 bg-white rounded-lg mb-3">
                <QRCodeSVG
                  id="qr-code-svg"
                  value={url}
                  size={typeof window !== 'undefined' && window.innerWidth < 640 ? 160 : 200}
                  level="H"
                  includeMargin
                />
              </div>

              <button
                type="button"
                onClick={handleDownloadQR}
                className="w-full btn-primary text-sm"
              >
                <Download className="w-4 h-4" />
                下载二维码
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
