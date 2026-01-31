/**
 * i18n Routing Configuration
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

import { defineRouting } from 'next-intl/routing'
import { locales, defaultLocale } from './config'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed', // Don't prefix default locale (zh-CN)
})
