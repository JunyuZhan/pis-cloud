/**
 * 数据库抽象层工厂
 * 根据配置自动选择数据库适配器
 */
import type { DatabaseAdapter, DatabaseConfig } from './types.js';
import { SupabaseAdapter } from './supabase-adapter.js';

let databaseAdapter: DatabaseAdapter | null = null;

/**
 * 从环境变量创建数据库配置
 */
function getDatabaseConfigFromEnv(): DatabaseConfig {
  const type = (process.env.DATABASE_TYPE || 'supabase') as DatabaseConfig['type'];

  if (type === 'supabase') {
    return {
      type: 'supabase',
      // 支持两种变量名 (兼容 monorepo 统一配置)
      supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.DATABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.DATABASE_KEY,
    };
  }

  // PostgreSQL 或 MySQL 配置
  const url = process.env.DATABASE_URL || '';
  const urlMatch = url.match(/^(postgresql|mysql):\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);

  if (urlMatch) {
    return {
      type: type === 'postgresql' ? 'postgresql' : 'mysql',
      host: urlMatch[4],
      port: parseInt(urlMatch[5]),
      database: urlMatch[6],
      user: urlMatch[2],
      password: urlMatch[3],
      ssl: process.env.DATABASE_SSL === 'true',
    };
  }

  return {
    type,
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT) : undefined,
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.DATABASE_SSL === 'true',
  };
}

/**
 * 创建数据库适配器
 */
export function createDatabaseAdapter(config?: DatabaseConfig): DatabaseAdapter {
  const finalConfig = config || getDatabaseConfigFromEnv();

  switch (finalConfig.type) {
    case 'supabase':
      return new SupabaseAdapter(finalConfig);
    case 'postgresql':
      // TODO: 实现 PostgreSQL 适配器
      throw new Error('PostgreSQL adapter not yet implemented. Please use Supabase or contribute an implementation.');
    case 'mysql':
      // TODO: 实现 MySQL 适配器
      throw new Error('MySQL adapter not yet implemented. Please use Supabase or contribute an implementation.');
    default:
      throw new Error(`Unsupported database type: ${finalConfig.type}`);
  }
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

// 向后兼容：导出 Supabase 客户端（如果使用 Supabase）
export function getSupabaseClient() {
  const adapter = getDatabaseAdapter();
  if (adapter instanceof SupabaseAdapter) {
    return adapter.getClient();
  }
  throw new Error('Supabase client is only available when using Supabase adapter');
}
