/**
 * Next.js Middleware - i18n + Supabase Auth
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { locales, defaultLocale, type Locale } from './i18n/config'

export async function middleware(request: NextRequest) {
  // Handle i18n: Set locale cookie if not present
  const localeCookie = request.cookies.get('NEXT_LOCALE')?.value
  let locale: Locale = defaultLocale

  // Check Accept-Language header for browser preference
  if (!localeCookie) {
    const acceptLanguage = request.headers.get('accept-language')
    if (acceptLanguage) {
      // Simple language detection
      if (acceptLanguage.includes('en')) {
        locale = 'en'
      } else {
        locale = 'zh-CN'
      }
    }
  } else if (locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale
  }

  // Set locale cookie if not present or different
  if (!localeCookie || localeCookie !== locale) {
    const response = NextResponse.next()
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    })
    
    // Handle Supabase auth for admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
      const authResponse = await updateSession(request)
      if (authResponse) {
        authResponse.headers.forEach((value, key) => {
          response.headers.set(key, value)
        })
      }
    }
    
    return response
  }

  // Handle Supabase auth for admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    return await updateSession(request)
  }

  return NextResponse.next()
}

export const config = {
  // Match all routes except static files and API routes
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
