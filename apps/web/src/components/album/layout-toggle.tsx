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
    <div className="flex items-center bg-surface-elevated rounded-md p-0.5 border border-border h-7 md:h-7 min-h-[44px] md:min-h-0">
      <button
        onClick={() => handleLayoutChange('masonry')}
        className={cn(
          'p-1.5 md:p-0.5 rounded transition-colors flex items-center justify-center min-h-[44px] md:min-h-0 active:scale-[0.98] touch-manipulation',
          currentLayout === 'masonry'
            ? 'bg-surface shadow-sm text-accent'
            : 'text-text-secondary hover:text-text-primary'
        )}
        title="瀑布流布局"
        aria-label="切换到瀑布流布局"
      >
        <LayoutGrid className="w-4 h-4 md:w-3.5 md:h-3.5" />
      </button>
      <button
        onClick={() => handleLayoutChange('grid')}
        className={cn(
          'p-1.5 md:p-0.5 rounded transition-colors flex items-center justify-center min-h-[44px] md:min-h-0 active:scale-[0.98] touch-manipulation',
          currentLayout === 'grid'
            ? 'bg-surface shadow-sm text-accent'
            : 'text-text-secondary hover:text-text-primary'
        )}
        title="网格布局"
        aria-label="切换到网格布局"
      >
        <Grid className="w-4 h-4 md:w-3.5 md:h-3.5" />
      </button>
    </div>
  )
}
