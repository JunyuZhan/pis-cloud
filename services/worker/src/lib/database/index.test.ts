/**
 * 数据库适配器工厂测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDatabaseAdapter, getDatabaseAdapter } from './index.js';
import { SupabaseAdapter } from './supabase-adapter.js';
import { PostgreSQLAdapter } from './postgresql-adapter.js';
import { MySQLAdapter } from './mysql-adapter.js';
import type { DatabaseConfig } from './types.js';

// Mock 适配器类
class MockSupabaseAdapter {
  constructor(public config: any) {}
  getClient() {
    return {};
  }
}

class MockPostgreSQLAdapter {
  constructor(public config: any) {}
}

class MockMySQLAdapter {
  constructor(public config: any) {}
}

vi.mock('./supabase-adapter.js', () => ({
  SupabaseAdapter: vi.fn().mockImplementation((config) => new MockSupabaseAdapter(config)),
}));

vi.mock('./postgresql-adapter.js', () => ({
  PostgreSQLAdapter: vi.fn().mockImplementation((config) => new MockPostgreSQLAdapter(config)),
}));

vi.mock('./mysql-adapter.js', () => ({
  MySQLAdapter: vi.fn().mockImplementation((config) => new MockMySQLAdapter(config)),
}));

describe('Database Adapter Factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清除模块缓存以重置单例
    vi.resetModules();
  });

  describe('createDatabaseAdapter', () => {
    it('应该创建 Supabase 适配器', () => {
      const config: DatabaseConfig = {
        type: 'supabase',
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'test-key',
      };

      const adapter = createDatabaseAdapter(config);

      expect(SupabaseAdapter).toHaveBeenCalledWith(config);
      expect(adapter).toBeDefined();
    });

    it('应该创建 PostgreSQL 适配器', () => {
      const config: DatabaseConfig = {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      const adapter = createDatabaseAdapter(config);

      expect(PostgreSQLAdapter).toHaveBeenCalledWith(config);
      expect(adapter).toBeDefined();
    });

    it('应该创建 MySQL 适配器', () => {
      const config: DatabaseConfig = {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      const adapter = createDatabaseAdapter(config);

      expect(MySQLAdapter).toHaveBeenCalledWith(config);
      expect(adapter).toBeDefined();
    });

    it('应该从环境变量创建 Supabase 适配器', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DATABASE_TYPE: 'supabase',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      };

      const adapter = createDatabaseAdapter();

      expect(SupabaseAdapter).toHaveBeenCalled();
      expect(adapter).toBeDefined();

      process.env = originalEnv;
    });

    it('应该从环境变量创建 PostgreSQL 适配器', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DATABASE_TYPE: 'postgresql',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      };

      const adapter = createDatabaseAdapter();

      expect(PostgreSQLAdapter).toHaveBeenCalled();
      expect(adapter).toBeDefined();

      process.env = originalEnv;
    });

    it('应该从环境变量创建 MySQL 适配器', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DATABASE_TYPE: 'mysql',
        DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
      };

      const adapter = createDatabaseAdapter();

      expect(MySQLAdapter).toHaveBeenCalled();
      expect(adapter).toBeDefined();

      process.env = originalEnv;
    });

    it('应该从分离的环境变量创建适配器', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DATABASE_TYPE: 'postgresql',
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: '5432',
        DATABASE_NAME: 'test_db',
        DATABASE_USER: 'test_user',
        DATABASE_PASSWORD: 'test_password',
      };

      const adapter = createDatabaseAdapter();

      expect(PostgreSQLAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
          password: 'test_password',
        })
      );

      process.env = originalEnv;
    });

    it('应该处理不支持的数据库类型', () => {
      const config: DatabaseConfig = {
        type: 'unsupported' as any,
      };

      expect(() => createDatabaseAdapter(config)).toThrow(
        'Unsupported database type: unsupported'
      );
    });
  });

  describe('getDatabaseAdapter', () => {
    it('应该返回单例适配器', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DATABASE_TYPE: 'supabase',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      };

      // 清除之前的调用记录
      vi.clearAllMocks();
      
      const adapter1 = getDatabaseAdapter();
      const adapter2 = getDatabaseAdapter();

      expect(adapter1).toBe(adapter2);
      // 注意：由于单例模式，第二次调用不会创建新实例，所以这里只调用一次
      expect(SupabaseAdapter).toHaveBeenCalled();

      process.env = originalEnv;
    });
  });
});
