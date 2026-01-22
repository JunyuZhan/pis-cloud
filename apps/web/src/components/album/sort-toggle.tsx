'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDownUp, ArrowUp, ArrowDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type SortRule = 'capture_desc' | 'capture_asc' | 'upload_desc'

interface SortToggleProps {
  currentSort: SortRule
}

export function SortToggle({ currentSort }: SortToggleProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSortChange = (sort: SortRule) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', sort)
    router.push(`?${params.toString()}`)
  }

  const getLabel = (sort: SortRule) => {
    switch (sort) {
      case 'capture_asc':
        return '拍摄时间 (正序)'
      case 'capture_desc':
        return '拍摄时间 (倒序)'
      case 'upload_desc':
        return '上传时间 (最新)'
      default:
        return '默认排序'
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowDownUp className="w-4 h-4" />
          <span>{getLabel(currentSort)}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleSortChange('capture_desc')}>
          <ArrowDown className="w-4 h-4 mr-2" />
          拍摄时间 (倒序)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSortChange('capture_asc')}>
          <ArrowUp className="w-4 h-4 mr-2" />
          拍摄时间 (正序)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSortChange('upload_desc')}>
          <ArrowDown className="w-4 h-4 mr-2" />
          上传时间 (最新)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
