'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { Toaster } from 'sonner'
import { useState, useEffect } from 'react'
import { getLocaleFromCookie } from '@/lib/i18n'
import { defaultLocale, type Locale } from '@/i18n/config'
import messagesEn from '@/messages/en.json'
import messagesZhCN from '@/messages/zh-CN.json'

const messages = {
  en: messagesEn,
  'zh-CN': messagesZhCN,
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 分钟（提高缓存时间，减少请求）
            gcTime: 10 * 60 * 1000, // 10 分钟垃圾回收（原 cacheTime）
            refetchOnWindowFocus: false,
            refetchOnReconnect: true, // 网络重连时刷新
            retry: 1, // 减少重试次数，快速失败
            retryDelay: 1000, // 重试延迟 1 秒
          },
          mutations: {
            retry: false, //  mutations 不重试
          },
        },
      })
  )

  const [locale, setLocale] = useState<Locale>(defaultLocale)

  useEffect(() => {
    // Initialize locale from cookie
    const cookieLocale = getLocaleFromCookie()
    if (cookieLocale !== locale) {
      setLocale(cookieLocale)
    }

    // Listen for locale changes
    const handleLocaleChange = (event: CustomEvent<{ locale: Locale }>) => {
      setLocale(event.detail.locale)
    }

    window.addEventListener('localechange', handleLocaleChange as EventListener)

    return () => {
      window.removeEventListener('localechange', handleLocaleChange as EventListener)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Always wrap with NextIntlClientProvider to ensure context is available
  // Use default locale during SSR/hydration, then update after mount
  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster 
          position="top-center"
          richColors
          closeButton
          duration={3000}
        />
      </QueryClientProvider>
    </NextIntlClientProvider>
  )
}
