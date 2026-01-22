import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/sidebar'
import { MobileSidebar } from '@/components/admin/mobile-sidebar'

/**
 * 管理后台布局
 * 包含侧边栏导航
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 桌面端侧边栏 */}
      <AdminSidebar user={user} />
      
      {/* 移动端侧边栏 */}
      <MobileSidebar user={user} />

      {/* 主内容区 */}
      <main className="md:ml-64 min-h-screen">
        <div className="p-4 pt-16 md:p-8 md:pt-8">{children}</div>
      </main>
    </div>
  )
}
