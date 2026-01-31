/**
 * Supabase 数据库适配器工厂
 * PIS 使用 Supabase 作为唯一数据库后端
 */
import type { DatabaseAdapter, DatabaseConfig } from './types.js';
import { SupabaseAdapter } from './supabase-adapter.js';

let databaseAdapter: DatabaseAdapter | null = null;

/**
 * 从环境变量创建数据库配置
 */
function getDatabaseConfigFromEnv(): DatabaseConfig {
  return {
    type: 'supabase',
    // 支持两种变量名 (兼容 monorepo 统一配置)
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.DATABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.DATABASE_KEY,
  };
}

/**
 * 创建数据库适配器
 */
export function createDatabaseAdapter(config?: DatabaseConfig): DatabaseAdapter {
  const finalConfig = config || getDatabaseConfigFromEnv();
  
  if (finalConfig.type !== 'supabase') {
    throw new Error('PIS only supports Supabase database. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  
  return new SupabaseAdapter(finalConfig);
}

/**
 * 获取单例数据库适配器
 */
export function getDatabaseAdapter(): DatabaseAdapter {
  if (!databaseAdapter) {
    databaseAdapter = createDatabaseAdapter();
  }
  return databaseAdapter;
}

/**
 * 导出类型和适配器类（供高级用法）
 */
export * from './types.js';
export { SupabaseAdapter } from './supabase-adapter.js';

// 导出 Supabase 客户端
export function getSupabaseClient() {
  const adapter = getDatabaseAdapter();
  if (adapter instanceof SupabaseAdapter) {
    return adapter.getClient();
  }
  throw new Error('Supabase client is only available when using Supabase adapter');
}
