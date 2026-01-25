import { createClient } from '@supabase/supabase-js'

// 支持两种变量名 (兼容 monorepo 统一配置)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''

export const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)
