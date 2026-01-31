/**
 * i18n Utilities - Simplified i18n without route changes
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

'use client'

import { useLocale as useNextIntlLocale } from 'next-intl'
import { locales, defaultLocale, type Locale } from '@/i18n/config'

/**
 * Get current locale from cookie or default
 */
export function getLocaleFromCookie(): Locale {
  if (typeof window === 'undefined') return defaultLocale
  
  const cookies = document.cookie.split(';')
  const localeCookie = cookies.find(c => c.trim().startsWith('NEXT_LOCALE='))
  
  if (localeCookie) {
    const locale = localeCookie.split('=')[1]?.trim() as Locale
    if (locales.includes(locale)) {
      return locale
    }
  }
  
  return defaultLocale
}

/**
 * Set locale in cookie
 */
export function setLocaleCookie(locale: Locale) {
  if (typeof window === 'undefined') return
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`
  
  // Dispatch custom event to notify locale change
  window.dispatchEvent(new CustomEvent('localechange', { detail: { locale } }))
}

/**
 * Hook to use locale (client component)
 */
export function useLocale(): Locale {
  try {
    return useNextIntlLocale() as Locale
  } catch {
    // Fallback if not in NextIntlProvider
    return getLocaleFromCookie()
  }
}
