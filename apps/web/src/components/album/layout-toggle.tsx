'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutGrid, Grid } from 'lucide-react'
import { cn } from '@/lib/utils'

export type LayoutMode = 'masonry' | 'grid'

interface LayoutToggleProps {
  currentLayout: LayoutMode
}

export function LayoutToggle({ currentLayout }: LayoutToggleProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleLayoutChange = (layout: LayoutMode) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('layout', layout)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center bg-surface-elevated rounded-lg p-1 border border-border">
      <button
        onClick={() => handleLayoutChange('masonry')}
        className={cn(
          'p-1.5 rounded-md transition-colors',
          currentLayout === 'masonry'
            ? 'bg-surface shadow-sm text-accent'
            : 'text-text-secondary hover:text-text-primary'
        )}
        title="瀑布流布局"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleLayoutChange('grid')}
        className={cn(
          'p-1.5 rounded-md transition-colors',
          currentLayout === 'grid'
            ? 'bg-surface shadow-sm text-accent'
            : 'text-text-secondary hover:text-text-primary'
        )}
        title="网格布局"
      >
        <Grid className="w-4 h-4" />
      </button>
    </div>
  )
}
