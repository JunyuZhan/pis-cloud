'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Images, Settings, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin', label: '相册', icon: Images },
  { href: '/admin/settings', label: '设置', icon: Settings },
  { href: '/', label: '首页', icon: Home, external: true },
]

/**
 * 移动端底部导航栏
 * 仅在移动端显示（< 768px）
 */
export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border safe-area-inset-bottom z-50 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin' || pathname.startsWith('/admin/albums')
              : pathname.startsWith(item.href)

          const content = (
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-1 min-w-[60px] px-2 py-1 rounded-lg transition-colors',
                isActive
                  ? 'text-accent'
                  : 'text-text-muted active:text-text-primary'
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive && 'text-accent')} />
              <span className="text-xs font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full" />
              )}
            </div>
          )

          if (item.external) {
            return (
              <Link
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="relative"
              >
                {content}
              </Link>
            )
          }

          return (
            <Link key={item.href} href={item.href} className="relative">
              {content}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
