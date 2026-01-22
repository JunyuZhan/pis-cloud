import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold">系统设置</h1>
        <p className="text-text-secondary mt-1">管理您的账户和系统配置</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-4 text-text-secondary">
          <Settings className="w-12 h-12" />
          <div>
            <p className="font-medium text-text-primary">设置功能开发中</p>
            <p className="text-sm">更多设置选项即将推出</p>
          </div>
        </div>
      </div>
    </div>
  )
}
