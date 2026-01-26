/**
 * MySQL 适配器测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import mysql from 'mysql2/promise';
import { MySQLAdapter } from './mysql-adapter.js';
import type { DatabaseConfig } from './types.js';

// Mock mysql2 模块
vi.mock('mysql2/promise', () => {
  // vitest 4.x: 创建一个返回 mock pool 的函数
  const createPool = vi.fn(() => {
    return {
      execute: vi.fn(),
      end: vi.fn(),
    };
  });

  return {
    default: {
      createPool,
    },
    createPool,
  };
});

describe('MySQLAdapter', () => {
  let adapter: MySQLAdapter;
  let mockPool: any;
  let config: DatabaseConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      database: 'test_db',
      user: 'test_user',
      password: 'test_password',
      ssl: false,
    };

    adapter = new MySQLAdapter(config);
    mockPool = (mysql.createPool as any).mock.results[0].value;
  });

  describe('构造函数', () => {
    it('应该正确创建连接池', () => {
      expect(mysql.createPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
        ssl: undefined,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    });

    it('应该设置SSL配置', () => {
      const sslConfig = {
        ...config,
        ssl: true,
      };
      new MySQLAdapter(sslConfig);
      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: {},
        })
      );
    });

    it('缺少必需配置时应该抛出错误', () => {
      expect(() => {
        new MySQLAdapter({
          type: 'mysql',
          host: undefined as any,
          database: 'test',
          user: 'test',
          password: 'test',
        });
      }).toThrow('MySQL adapter requires host, database, user, and password');
    });
  });

  describe('findOne', () => {
    it('应该正确查询单条记录', async () => {
      const mockData = [{ id: '1', name: 'test' }];
      mockPool.execute.mockResolvedValueOnce([mockData]);

      const result = await adapter.findOne('test_table', { id: '1' });

      expect(result.data).toEqual(mockData[0]);
      expect(result.error).toBeNull();
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM `test_table`'),
        ['1']
      );
    });

    it('应该处理空结果', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await adapter.findOne('test_table', { id: '1' });

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it('应该处理NULL值', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ id: '1', name: null }]]);

      const result = await adapter.findOne('test_table', { name: null });

      expect(result.data).toEqual({ id: '1', name: null });
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('`name` IS NULL'),
        []
      );
    });

    it('应该处理数组值（IN查询）', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ id: '1' }]]);

      const result = await adapter.findOne('test_table', { id: ['1', '2', '3'] });

      expect(result.data).toEqual({ id: '1' });
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('`id` IN (?, ?, ?)'),
        ['1', '2', '3']
      );
    });

    it('应该处理查询错误', async () => {
      const error = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(error);

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
      mockPool.execute
        .mockResolvedValueOnce([mockData])
        .mockResolvedValueOnce([[{ count: 2 }]]);

      const result = await adapter.findMany('test_table', { status: 'active' });

      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
      expect(result.count).toBe(2);
    });

    it('应该支持分页', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ id: '1' }]])
        .mockResolvedValueOnce([[{ count: 1 }]]);

      const result = await adapter.findMany(
        'test_table',
        {},
        { limit: 10, offset: 0 }
      );

      expect(result.data).toEqual([{ id: '1' }]);
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        expect.arrayContaining([10])
      );
    });

    it('应该支持排序', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await adapter.findMany(
        'test_table',
        {},
        { orderBy: [{ column: 'created_at', direction: 'desc' }] }
      );

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY `created_at` DESC'),
        []
      );
    });

    it('应该支持字段选择', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await adapter.findMany('test_table', {}, { select: ['id', 'name'] });

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT `id`, `name` FROM'),
        []
      );
    });
  });

  describe('insert', () => {
    it('应该正确插入单条记录', async () => {
      const mockData = { id: '1', name: 'test' };
      const mockResult = {
        insertId: 1,
        affectedRows: 1,
      };
      mockPool.execute
        .mockResolvedValueOnce([mockResult])
        .mockResolvedValueOnce([[mockData]]);

      const result = await adapter.insert('test_table', mockData);

      expect(result.data).toEqual([mockData]);
      expect(result.error).toBeNull();
    });

    it('应该支持批量插入', async () => {
      const mockData = [
        { id: '1', name: 'test1' },
        { id: '2', name: 'test2' },
      ];
      const mockResult = {
        insertId: 1,
        affectedRows: 2,
      };
      mockPool.execute.mockResolvedValueOnce([mockResult]);

      const result = await adapter.insert('test_table', mockData);

      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
    });

    it('应该处理空数组', async () => {
      const result = await adapter.insert('test_table', []);

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
      expect(mockPool.execute).not.toHaveBeenCalled();
    });

    it('应该处理插入错误', async () => {
      const error = new Error('Insert error');
      mockPool.execute.mockRejectedValueOnce(error);

      const result = await adapter.insert('test_table', { id: '1' });

      expect(result.data).toBeNull();
      expect(result.error).toEqual(error);
    });
  });

  describe('update', () => {
    it('应该正确更新记录', async () => {
      const mockData = [{ id: '1', name: 'updated' }];
      // 第一次调用是UPDATE，后续调用是findMany（包括COUNT查询）
      mockPool.execute
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
        .mockResolvedValueOnce([mockData]) // SELECT from findMany
        .mockResolvedValueOnce([[{ count: 1 }]]); // COUNT from findMany

      const result = await adapter.update('test_table', { id: '1' }, { name: 'updated' });

      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
    });

    it('应该处理空更新字段', async () => {
      const result = await adapter.update('test_table', { id: '1' }, {});

      expect(result.data).toBeNull();
      expect(result.error).toEqual(new Error('No fields to update'));
    });

    it('应该处理更新错误', async () => {
      const error = new Error('Update error');
      mockPool.execute.mockRejectedValueOnce(error);

      const result = await adapter.update('test_table', { id: '1' }, { name: 'test' });

      expect(result.data).toBeNull();
      expect(result.error).toEqual(error);
    });
  });

  describe('delete', () => {
    it('应该正确删除记录', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await adapter.delete('test_table', { id: '1' });

      expect(result.error).toBeNull();
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM `test_table`'),
        ['1']
      );
    });

    it('应该处理删除错误', async () => {
      const error = new Error('Delete error');
      mockPool.execute.mockRejectedValueOnce(error);

      const result = await adapter.delete('test_table', { id: '1' });

      expect(result.error).toEqual(error);
    });
  });

  describe('count', () => {
    it('应该正确计数', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ count: 10 }]]);

      const result = await adapter.count('test_table', { status: 'active' });

      expect(result).toBe(10);
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count'),
        ['active']
      );
    });

    it('应该处理无过滤条件的计数', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ count: 5 }]]);

      const result = await adapter.count('test_table');

      expect(result).toBe(5);
    });

    it('应该处理计数错误', async () => {
      const error = new Error('Count error');
      mockPool.execute.mockRejectedValueOnce(error);

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
