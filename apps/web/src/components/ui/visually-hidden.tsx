import * as React from 'react'
import { cn } from '@/lib/utils'

export const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => {
  return (
    <span
      ref={ref}
      className={cn("sr-only", className)}
      {...props}
    />
  )
})
VisuallyHidden.displayName = "VisuallyHidden"
