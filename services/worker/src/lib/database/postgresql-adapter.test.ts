/**
 * PostgreSQL 适配器测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import { PostgreSQLAdapter } from './postgresql-adapter.js';
import type { DatabaseConfig } from './types.js';

// Mock pg 模块
vi.mock('pg', () => {
  // vitest 4.x: 创建一个可以被 new 调用的构造函数 mock
  const MockPool = vi.fn(function MockPool() {
    this.query = vi.fn();
    this.end = vi.fn();
    this.on = vi.fn();
    return this;
  });

  return {
    Pool: MockPool,
    default: { Pool: MockPool },
  };
});

describe('PostgreSQLAdapter', () => {
  let adapter: PostgreSQLAdapter;
  let mockPool: any;
  let config: DatabaseConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      user: 'test_user',
      password: 'test_password',
      ssl: false,
    };

    adapter = new PostgreSQLAdapter(config);
    // vitest 4.x: 从 Pool mock 的最后一个调用结果获取实例
    const poolCalls = (Pool as any).mock.results;
    mockPool = poolCalls[poolCalls.length - 1].value;
  });

  describe('构造函数', () => {
    it('应该正确创建连接池', () => {
      expect(Pool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
        ssl: false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    });

    it('应该设置SSL配置', () => {
      const sslConfig = {
        ...config,
        ssl: true,
      };
      new PostgreSQLAdapter(sslConfig);
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false },
        })
      );
    });

    it('缺少必需配置时应该抛出错误', () => {
      expect(() => {
        new PostgreSQLAdapter({
          type: 'postgresql',
          host: undefined as any,
          database: 'test',
          user: 'test',
          password: 'test',
        });
      }).toThrow('PostgreSQL adapter requires host, database, user, and password');
    });
  });

  describe('findOne', () => {
    it('应该正确查询单条记录', async () => {
      const mockData = { id: '1', name: 'test' };
      mockPool.query.mockResolvedValueOnce({
        rows: [mockData],
      });

      const result = await adapter.findOne('test_table', { id: '1' });

      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM "test_table"'),
        ['1']
      );
    });

    it('应该处理空结果', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const result = await adapter.findOne('test_table', { id: '1' });

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it('应该处理NULL值', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: '1', name: null }],
      });

      const result = await adapter.findOne('test_table', { name: null });

      expect(result.data).toEqual({ id: '1', name: null });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('"name" IS NULL'),
        []
      );
    });

    it('应该处理数组值（IN查询）', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: '1' }],
      });

      const result = await adapter.findOne('test_table', { id: ['1', '2', '3'] });

      expect(result.data).toEqual({ id: '1' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('"id" IN ($1, $2, $3)'),
        ['1', '2', '3']
      );
    });

    it('应该处理查询错误', async () => {
      const error = new Error('Database error');
      mockPool.query.mockRejectedValueOnce(error);

      const result = await adapter.findOne('test_table', { id: '1' });

      expect(result.data).toBeNull();
      expect(result.error).toEqual(error);
    });
  });

  describe('findMany', () => {
    it('应该正确查询多条记录', async () => {
      const mockData = [
        { id: '1', name: 'test1' },
        { id: '2', name: 'test2' },
      ];
      mockPool.query
        .mockResolvedValueOnce({
          rows: mockData,
        })
        .mockResolvedValueOnce({
          rows: [{ count: '2' }],
        });

      const result = await adapter.findMany('test_table', { status: 'active' });

      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
      expect(result.count).toBe(2);
    });

    it('应该支持分页', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: '1' }],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
        });

      const result = await adapter.findMany(
        'test_table',
        {},
        { limit: 10, offset: 0 }
      );

      expect(result.data).toEqual([{ id: '1' }]);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1'),
        expect.arrayContaining([10])
      );
    });

    it('应该支持排序', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await adapter.findMany(
        'test_table',
        {},
        { orderBy: [{ column: 'created_at', direction: 'desc' }] }
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY "created_at" DESC'),
        []
      );
    });

    it('应该支持字段选择', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await adapter.findMany('test_table', {}, { select: ['id', 'name'] });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT "id", "name" FROM'),
        []
      );
    });
  });

  describe('insert', () => {
    it('应该正确插入单条记录', async () => {
      const mockData = { id: '1', name: 'test' };
      mockPool.query.mockResolvedValueOnce({
        rows: [mockData],
      });

      const result = await adapter.insert('test_table', mockData);

      expect(result.data).toEqual([mockData]);
      expect(result.error).toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "test_table"'),
        ['1', 'test']
      );
    });

    it('应该支持批量插入', async () => {
      const mockData = [
        { id: '1', name: 'test1' },
        { id: '2', name: 'test2' },
      ];
      mockPool.query.mockResolvedValueOnce({
        rows: mockData,
      });

      const result = await adapter.insert('test_table', mockData);

      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
    });

    it('应该处理空数组', async () => {
      const result = await adapter.insert('test_table', []);

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('应该处理插入错误', async () => {
      const error = new Error('Insert error');
      mockPool.query.mockRejectedValueOnce(error);

      const result = await adapter.insert('test_table', { id: '1' });

      expect(result.data).toBeNull();
      expect(result.error).toEqual(error);
    });
  });

  describe('update', () => {
    it('应该正确更新记录', async () => {
      const mockData = { id: '1', name: 'updated' };
      mockPool.query.mockResolvedValueOnce({
        rows: [mockData],
      });

      const result = await adapter.update('test_table', { id: '1' }, { name: 'updated' });

      expect(result.data).toEqual([mockData]);
      expect(result.error).toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "test_table" SET'),
        expect.arrayContaining(['updated', '1'])
      );
    });

    it('应该处理空更新字段', async () => {
      const result = await adapter.update('test_table', { id: '1' }, {});

      expect(result.data).toBeNull();
      expect(result.error).toEqual(new Error('No fields to update'));
    });

    it('应该处理更新错误', async () => {
      const error = new Error('Update error');
      mockPool.query.mockRejectedValueOnce(error);

      const result = await adapter.update('test_table', { id: '1' }, { name: 'test' });

      expect(result.data).toBeNull();
      expect(result.error).toEqual(error);
    });
  });

  describe('delete', () => {
    it('应该正确删除记录', async () => {
      mockPool.query.mockResolvedValueOnce({});

      const result = await adapter.delete('test_table', { id: '1' });

      expect(result.error).toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM "test_table"'),
        ['1']
      );
    });

    it('应该处理删除错误', async () => {
      const error = new Error('Delete error');
      mockPool.query.mockRejectedValueOnce(error);

      const result = await adapter.delete('test_table', { id: '1' });

      expect(result.error).toEqual(error);
    });
  });

  describe('count', () => {
    it('应该正确计数', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: '10' }],
      });

      const result = await adapter.count('test_table', { status: 'active' });

      expect(result).toBe(10);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count'),
        ['active']
      );
    });

    it('应该处理无过滤条件的计数', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: '5' }],
      });

      const result = await adapter.count('test_table');

      expect(result).toBe(5);
    });

    it('应该处理计数错误', async () => {
      const error = new Error('Count error');
      mockPool.query.mockRejectedValueOnce(error);

      await expect(adapter.count('test_table')).rejects.toThrow('Count error');
    });
  });

  describe('close', () => {
    it('应该正确关闭连接池', async () => {
      await adapter.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});
