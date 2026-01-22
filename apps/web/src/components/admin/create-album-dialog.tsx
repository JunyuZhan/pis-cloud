'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface CreateAlbumDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateAlbumDialog({ open, onOpenChange }: CreateAlbumDialogProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{
    id: string
    slug: string
    shareUrl: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('请输入相册标题')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || '创建失败')
        return
      }

      setCreated(data)
    } catch (err) {
      setError('创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (created?.shareUrl) {
      await navigator.clipboard.writeText(created.shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    if (created) {
      router.push(`/admin/albums/${created.id}`)
      router.refresh()
    }
    setTitle('')
    setDescription('')
    setError('')
    setCreated(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        {!created ? (
          <>
            <DialogHeader>
              <DialogTitle>新建相册</DialogTitle>
              <DialogDescription>
                创建一个新的相册来存放您的摄影作品
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-text-secondary mb-2"
                >
                  相册标题 <span className="text-red-400">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="例如：婚礼拍摄 - 张三李四"
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-text-secondary mb-2"
                >
                  相册描述
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input min-h-[80px] resize-none"
                  placeholder="可选的相册描述..."
                />
              </div>

              <DialogFooter className="mt-6">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="btn-secondary"
                  disabled={loading}
                >
                  取消
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    '创建相册'
                  )}
                </button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>相册创建成功</DialogTitle>
              <DialogDescription>
                您可以复制下方链接分享给客户
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  分享链接
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={created.shareUrl}
                    readOnly
                    className="input flex-1 text-sm"
                  />
                  <button
                    onClick={handleCopy}
                    className="btn-secondary shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <DialogFooter>
                <button onClick={handleClose} className="btn-primary w-full">
                  开始上传照片
                </button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
