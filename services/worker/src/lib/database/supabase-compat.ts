/**
 * Supabase 兼容层
 * 
 * 提供与 Supabase Client 相同的 API，但可以使用 PostgreSQL 直接连接
 * 这使得 Worker 可以在没有 Supabase 的情况下运行
 */
import { Pool, QueryResult as PgQueryResult } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseCompatConfig {
  type: 'supabase' | 'postgresql';
  // Supabase 配置
  supabaseUrl?: string;
  supabaseKey?: string;
  // PostgreSQL 配置
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

/**
 * 查询构建器 - 模拟 Supabase 的链式调用 API
 */
class QueryBuilder<T = any> {
  private pool: Pool;
  private tableName: string;
  private selectColumns: string = '*';
  private whereConditions: { column: string; operator: string; value: any }[] = [];
  private orderByClause: { column: string; direction: string }[] = [];
  private limitCount?: number;
  private offsetCount?: number;
  private returnSingle: boolean = false;
  private updateData?: Record<string, any>;
  private insertData?: Record<string, any> | Record<string, any>[];
  private isDelete: boolean = false;
  private isCount: boolean = false;
  private isHeadOnly: boolean = false;

  constructor(pool: Pool, tableName: string) {
    this.pool = pool;
    this.tableName = tableName;
  }

  select(columns: string = '*', options?: { count?: 'exact'; head?: boolean }): this {
    this.selectColumns = columns;
    if (options?.count === 'exact') {
      this.isCount = true;
    }
    if (options?.head) {
      this.isHeadOnly = true;
    }
    return this;
  }

  insert(data: Record<string, any> | Record<string, any>[]): this {
    this.insertData = data;
    return this;
  }

  update(data: Record<string, any>): this {
    this.updateData = data;
    return this;
  }

  delete(): this {
    this.isDelete = true;
    return this;
  }

  eq(column: string, value: any): this {
    this.whereConditions.push({ column, operator: '=', value });
    return this;
  }

  neq(column: string, value: any): this {
    this.whereConditions.push({ column, operator: '!=', value });
    return this;
  }

  is(column: string, value: null): this {
    this.whereConditions.push({ column, operator: 'IS', value: null });
    return this;
  }

  isNot(column: string, value: null): this {
    this.whereConditions.push({ column, operator: 'IS NOT', value: null });
    return this;
  }

  /**
   * Supabase 兼容的 not 方法
   * 用法: .not('column', 'is', null) 或 .not('column', 'eq', value)
   */
  not(column: string, operator: string, value: any): this {
    if (operator === 'is' && value === null) {
      this.whereConditions.push({ column, operator: 'IS NOT', value: null });
    } else if (operator === 'eq') {
      this.whereConditions.push({ column, operator: '!=', value });
    } else {
      // 其他情况，尝试反转操作符
      const negatedOp = operator === 'gt' ? '<=' : operator === 'lt' ? '>=' : '!=';
      this.whereConditions.push({ column, operator: negatedOp, value });
    }
    return this;
  }

  in(column: string, values: any[]): this {
    this.whereConditions.push({ column, operator: 'IN', value: values });
    return this;
  }

  lt(column: string, value: any): this {
    this.whereConditions.push({ column, operator: '<', value });
    return this;
  }

  lte(column: string, value: any): this {
    this.whereConditions.push({ column, operator: '<=', value });
    return this;
  }

  gt(column: string, value: any): this {
    this.whereConditions.push({ column, operator: '>', value });
    return this;
  }

  gte(column: string, value: any): this {
    this.whereConditions.push({ column, operator: '>=', value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderByClause.push({
      column,
      direction: options?.ascending === false ? 'DESC' : 'ASC'
    });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): this {
    this.returnSingle = true;
    this.limitCount = 1;
    return this;
  }

  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private buildWhereClause(): { clause: string; values: any[] } {
    if (this.whereConditions.length === 0) {
      return { clause: '', values: [] };
    }

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const cond of this.whereConditions) {
      const escapedColumn = this.escapeIdentifier(cond.column);
      
      if (cond.operator === 'IS' || cond.operator === 'IS NOT') {
        conditions.push(`${escapedColumn} ${cond.operator} NULL`);
      } else if (cond.operator === 'IN') {
        const placeholders = cond.value.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`${escapedColumn} IN (${placeholders})`);
        values.push(...cond.value);
      } else {
        conditions.push(`${escapedColumn} ${cond.operator} $${paramIndex++}`);
        values.push(cond.value);
      }
    }

    return {
      clause: `WHERE ${conditions.join(' AND ')}`,
      values
    };
  }

  async then<TResult1 = { data: T | T[] | null; error: Error | null; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: T | T[] | null; error: Error | null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.execute();
      if (onfulfilled) {
        return onfulfilled(result);
      }
      return result as unknown as TResult1;
    } catch (error) {
      if (onrejected) {
        return onrejected(error);
      }
      throw error;
    }
  }

  private async execute(): Promise<{ data: T | T[] | null; error: Error | null; count?: number }> {
    try {
      // INSERT
      if (this.insertData) {
        const dataArray = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        if (dataArray.length === 0) {
          return { data: [], error: null };
        }

        const columns = Object.keys(dataArray[0]);
        const escapedColumns = columns.map(c => this.escapeIdentifier(c)).join(', ');
        
        const allValues: any[] = [];
        const valueGroups: string[] = [];
        let paramIndex = 1;

        for (const row of dataArray) {
          const placeholders: string[] = [];
          for (const col of columns) {
            placeholders.push(`$${paramIndex++}`);
            allValues.push(row[col]);
          }
          valueGroups.push(`(${placeholders.join(', ')})`);
        }

        const sql = `INSERT INTO ${this.escapeIdentifier(this.tableName)} (${escapedColumns}) VALUES ${valueGroups.join(', ')} RETURNING *`;
        const result = await this.pool.query(sql, allValues);
        return { data: result.rows as T[], error: null };
      }

      // UPDATE
      if (this.updateData) {
        const { clause: whereClause, values: whereValues } = this.buildWhereClause();
        const setClauses: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = whereValues.length + 1;

        for (const [key, value] of Object.entries(this.updateData)) {
          setClauses.push(`${this.escapeIdentifier(key)} = $${paramIndex++}`);
          updateValues.push(value);
        }

        const sql = `UPDATE ${this.escapeIdentifier(this.tableName)} SET ${setClauses.join(', ')} ${whereClause} RETURNING *`;
        const result = await this.pool.query(sql, [...whereValues, ...updateValues]);
        
        if (this.returnSingle) {
          return { data: result.rows[0] as T || null, error: null };
        }
        return { data: result.rows as T[], error: null };
      }

      // DELETE
      if (this.isDelete) {
        const { clause: whereClause, values } = this.buildWhereClause();
        const sql = `DELETE FROM ${this.escapeIdentifier(this.tableName)} ${whereClause}`;
        await this.pool.query(sql, values);
        return { data: null, error: null };
      }

      // SELECT
      const { clause: whereClause, values } = this.buildWhereClause();
      
      // Count query
      if (this.isCount && this.isHeadOnly) {
        const countSql = `SELECT COUNT(*) as count FROM ${this.escapeIdentifier(this.tableName)} ${whereClause}`;
        const countResult = await this.pool.query(countSql, values);
        const count = parseInt(countResult.rows[0]?.count || '0', 10);
        return { data: null, error: null, count };
      }

      let sql = `SELECT ${this.selectColumns} FROM ${this.escapeIdentifier(this.tableName)} ${whereClause}`;

      if (this.orderByClause.length > 0) {
        const orderParts = this.orderByClause.map(o => 
          `${this.escapeIdentifier(o.column)} ${o.direction}`
        );
        sql += ` ORDER BY ${orderParts.join(', ')}`;
      }

      if (this.limitCount !== undefined) {
        sql += ` LIMIT ${this.limitCount}`;
      }

      if (this.offsetCount !== undefined) {
        sql += ` OFFSET ${this.offsetCount}`;
      }

      const result = await this.pool.query(sql, values);

      if (this.returnSingle) {
        if (result.rows.length === 0) {
          return { data: null, error: null };
        }
        return { data: result.rows[0] as T, error: null };
      }

      return { data: result.rows as T[], error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }
}

/**
 * Supabase 兼容客户端
 */
export class SupabaseCompatClient {
  private pool?: Pool;
  private supabaseClient?: SupabaseClient;
  private config: SupabaseCompatConfig;

  constructor(config: SupabaseCompatConfig) {
    this.config = config;

    if (config.type === 'supabase') {
      if (!config.supabaseUrl || !config.supabaseKey) {
        throw new Error('Supabase URL and Key are required for Supabase mode');
      }
      this.supabaseClient = createClient(config.supabaseUrl, config.supabaseKey);
    } else if (config.type === 'postgresql') {
      if (!config.host || !config.database || !config.user || !config.password) {
        throw new Error('PostgreSQL host, database, user, and password are required');
      }
      this.pool = new Pool({
        host: config.host,
        port: config.port || 5432,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      this.pool.on('error', (err) => {
        console.error('PostgreSQL pool error:', err);
      });
    }
  }

  from<T = any>(table: string): QueryBuilder<T> | ReturnType<SupabaseClient['from']> {
    if (this.supabaseClient) {
      return this.supabaseClient.from(table);
    }
    if (this.pool) {
      return new QueryBuilder<T>(this.pool, table);
    }
    throw new Error('No database connection available');
  }

  /**
   * 调用数据库函数 (RPC)
   */
  async rpc(functionName: string, params?: Record<string, any>): Promise<{ data: any; error: Error | null }> {
    if (this.supabaseClient) {
      return this.supabaseClient.rpc(functionName, params);
    }

    if (this.pool) {
      try {
        // 构建函数调用
        const paramNames = params ? Object.keys(params) : [];
        const paramValues = params ? Object.values(params) : [];
        const placeholders = paramNames.map((_, i) => `$${i + 1}`);
        
        // PostgreSQL 函数调用：SELECT function_name($1, $2, ...)
        // 或者使用命名参数：SELECT function_name(param1 := $1, param2 := $2, ...)
        let sql: string;
        if (paramNames.length > 0) {
          const namedParams = paramNames.map((name, i) => `${name} := $${i + 1}`).join(', ');
          sql = `SELECT ${functionName}(${namedParams})`;
        } else {
          sql = `SELECT ${functionName}()`;
        }

        const result = await this.pool.query(sql, paramValues);
        return { data: result.rows[0]?.[functionName] ?? null, error: null };
      } catch (err: any) {
        return { data: null, error: err };
      }
    }

    throw new Error('No database connection available');
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      if (this.supabaseClient) {
        const { error } = await this.supabaseClient.from('albums').select('id').limit(1);
        if (error) throw error;
        return { ok: true };
      }

      if (this.pool) {
        const result = await this.pool.query('SELECT 1');
        return { ok: result.rows.length > 0 };
      }

      return { ok: false, error: 'No database connection' };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}

/**
 * 从环境变量创建兼容客户端
 */
export function createSupabaseCompatClient(): SupabaseCompatClient {
  const databaseType = process.env.DATABASE_TYPE || 'supabase';

  if (databaseType === 'postgresql') {
    return new SupabaseCompatClient({
      type: 'postgresql',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'pis',
      user: process.env.DATABASE_USER || 'pis',
      password: process.env.DATABASE_PASSWORD || '',
      ssl: process.env.DATABASE_SSL === 'true',
    });
  }

  // 默认使用 Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Database configuration missing. Set DATABASE_TYPE=postgresql with DATABASE_* vars, ' +
      'or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for Supabase.'
    );
  }

  return new SupabaseCompatClient({
    type: 'supabase',
    supabaseUrl,
    supabaseKey,
  });
}
