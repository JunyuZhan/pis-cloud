'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Folder } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PhotoGroup } from '@/types/database'

interface PhotoGroupFilterProps {
  albumId: string
  albumSlug?: string
  selectedGroupId?: string | null
  onGroupSelect?: (groupId: string | null) => void
}

interface GroupWithCount extends PhotoGroup {
  photo_count: number
}

export function PhotoGroupFilter({
  albumId,
  albumSlug,
  selectedGroupId: externalSelectedGroupId,
  onGroupSelect: externalOnGroupSelect,
}: PhotoGroupFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [groups, setGroups] = useState<GroupWithCount[]>([])
  const [loading, setLoading] = useState(true)
  
  // 使用外部传入的 selectedGroupId，如果没有则从 URL 参数获取
  const selectedGroupId = externalSelectedGroupId ?? searchParams.get('group')

  useEffect(() => {
    const loadGroups = async () => {
      try {
        // 使用 slug 或 albumId 获取分组列表
        const identifier = albumSlug || albumId
        const response = await fetch(`/api/public/albums/${identifier}/groups`)
        if (response.ok) {
          const data = await response.json()
          setGroups(data.groups || [])
        }
      } catch (error) {
        console.error('Failed to load groups:', error)
      } finally {
        setLoading(false)
      }
    }
    if (albumId || albumSlug) {
      loadGroups()
    }
  }, [albumId, albumSlug])

  const handleGroupSelect = (groupId: string | null) => {
    // 如果外部提供了 onGroupSelect，优先使用
    if (externalOnGroupSelect) {
      externalOnGroupSelect(groupId)
      return
    }
    
    // 否则使用路由导航
    const params = new URLSearchParams(searchParams.toString())
    if (groupId) {
      params.set('group', groupId)
    } else {
      params.delete('group')
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  if (loading || groups.length === 0) {
    return null
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
      {/* 全部照片 */}
      <button
        onClick={() => handleGroupSelect(null)}
        className={cn(
          'px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0',
          'min-h-[44px] flex items-center justify-center', // 移动端最小触摸目标
          selectedGroupId === null
            ? 'bg-accent text-background'
            : 'bg-surface text-text-secondary hover:bg-surface-elevated active:scale-95'
        )}
      >
        全部照片
      </button>

      {/* 分组标签 */}
      {groups.map((group) => (
        <button
          key={group.id}
          onClick={() => handleGroupSelect(group.id)}
          className={cn(
            'px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap flex-shrink-0',
            'min-h-[44px]', // 移动端最小触摸目标
            selectedGroupId === group.id
              ? 'bg-accent text-background'
              : 'bg-surface text-text-secondary hover:bg-surface-elevated active:scale-95'
          )}
        >
          <Folder className="w-4 h-4 flex-shrink-0" />
          <span>{group.name}</span>
          {group.photo_count > 0 && (
            <span className="text-xs opacity-75">({group.photo_count})</span>
          )}
        </button>
      ))}
    </div>
  )
}
