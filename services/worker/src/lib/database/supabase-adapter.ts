/**
 * Supabase 数据库适配器
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseAdapter, DatabaseConfig, QueryResult } from './types.js';

export class SupabaseAdapter implements DatabaseAdapter {
  private client: SupabaseClient;

  constructor(config: DatabaseConfig) {
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error('Supabase adapter requires supabaseUrl and supabaseKey');
    }

    this.client = createClient(config.supabaseUrl, config.supabaseKey);
  }

  async findOne<T = any>(
    table: string,
    filters: Record<string, any>
  ): Promise<{ data: T | null; error: Error | null }> {
    let query = this.client.from(table).select('*');

    // 应用过滤条件
    for (const [key, value] of Object.entries(filters)) {
      if (value === null) {
        query = query.is(key, null);
      } else if (Array.isArray(value)) {
        query = query.in(key, value);
      } else {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query.single();

    return {
      data: data as T | null,
      error: error ? new Error(error.message) : null,
    };
  }

  async findMany<T = any>(
    table: string,
    filters?: Record<string, any>,
    options?: {
      select?: string[];
      limit?: number;
      offset?: number;
      orderBy?: { column: string; direction: 'asc' | 'desc' }[];
    }
  ): Promise<QueryResult<T>> {
    let query = this.client.from(table).select(
      options?.select ? options.select.join(',') : '*'
    );

    // 应用过滤条件
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value === null) {
          query = query.is(key, null);
        } else if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    }

    // 应用排序
    if (options?.orderBy) {
      for (const order of options.orderBy) {
        query = query.order(order.column, {
          ascending: order.direction === 'asc',
        });
      }
    }

    // 应用分页
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    return {
      data: (data as T[]) || null,
      error: error ? new Error(error.message) : null,
      count: count || undefined,
    };
  }

  async insert<T = any>(
    table: string,
    data: T | T[]
  ): Promise<{ data: T[] | null; error: Error | null }> {
    const { data: result, error } = await this.client
      .from(table)
      .insert(data as any)
      .select();

    return {
      data: (result as T[]) || null,
      error: error ? new Error(error.message) : null,
    };
  }

  async update<T = any>(
    table: string,
    filters: Record<string, any>,
    data: Partial<T>
  ): Promise<{ data: T[] | null; error: Error | null }> {
    let query = this.client.from(table).update(data as any);

    // 应用过滤条件
    for (const [key, value] of Object.entries(filters)) {
      if (value === null) {
        query = query.is(key, null);
      } else if (Array.isArray(value)) {
        query = query.in(key, value);
      } else {
        query = query.eq(key, value);
      }
    }

    const { data: result, error } = await query.select();

    return {
      data: (result as T[]) || null,
      error: error ? new Error(error.message) : null,
    };
  }

  async delete(
    table: string,
    filters: Record<string, any>
  ): Promise<{ error: Error | null }> {
    let query = this.client.from(table).delete();

    // 应用过滤条件
    for (const [key, value] of Object.entries(filters)) {
      if (value === null) {
        query = query.is(key, null);
      } else if (Array.isArray(value)) {
        query = query.in(key, value);
      } else {
        query = query.eq(key, value);
      }
    }

    const { error } = await query;

    return {
      error: error ? new Error(error.message) : null,
    };
  }

  async count(
    table: string,
    filters?: Record<string, any>
  ): Promise<number> {
    let query = this.client.from(table).select('*', { count: 'exact', head: true });

    // 应用过滤条件
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value === null) {
          query = query.is(key, null);
        } else if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return count || 0;
  }

  /**
   * 关闭连接（Supabase 客户端不需要显式关闭，但为了接口一致性提供此方法）
   */
  async close(): Promise<void> {
    // Supabase 客户端不需要显式关闭连接
    // 但为了与其他适配器保持一致，提供此方法
  }

  /**
   * 获取原始 Supabase 客户端（用于高级用法）
   */
  getClient(): SupabaseClient {
    return this.client;
  }
}
