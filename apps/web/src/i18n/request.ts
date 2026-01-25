/**
 * i18n Request Configuration
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { defaultLocale, locales, type Locale } from './config'

export default getRequestConfig(async ({ requestLocale }) => {
  // Try to get locale from route parameter first (if using [locale] routing)
  let locale = await requestLocale

  // If not in route, get from cookie
  if (!locale && process.env.NEXT_PHASE !== 'phase-production-build' && process.env.NEXT_PHASE !== 'phase-production-export') {
    try {
      const cookieStore = await cookies()
      const localeCookie = cookieStore.get('NEXT_LOCALE')?.value
      if (localeCookie && locales.includes(localeCookie as Locale)) {
        locale = localeCookie as Locale
      }
    } catch {
      // During static generation, cookies() may not be available
      // Fall back to default locale
    }
  }

  // Ensure that a valid locale is used
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
