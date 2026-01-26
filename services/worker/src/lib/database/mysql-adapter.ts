/**
 * MySQL 数据库适配器
 * 使用 mysql2 库连接 MySQL/MariaDB 数据库
 */
import mysql from 'mysql2/promise';
import type { DatabaseAdapter, DatabaseConfig, QueryResult as AdapterQueryResult } from './types.js';

export class MySQLAdapter implements DatabaseAdapter {
  private pool: mysql.Pool;

  constructor(config: DatabaseConfig) {
    if (!config.host || !config.database || !config.user || !config.password) {
      throw new Error('MySQL adapter requires host, database, user, and password');
    }

    this.pool = mysql.createPool({
      host: config.host,
      port: config.port || 3306,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? {} : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  /**
   * 转义表名和列名（防止SQL注入）
   */
  private escapeIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  /**
   * 构建 WHERE 子句
   */
  private buildWhereClause(filters: Record<string, any>): { clause: string; values: any[] } {
    const conditions: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(filters)) {
      const escapedKey = this.escapeIdentifier(key);
      if (value === null) {
        conditions.push(`${escapedKey} IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(', ');
        conditions.push(`${escapedKey} IN (${placeholders})`);
        values.push(...value);
      } else {
        conditions.push(`${escapedKey} = ?`);
        values.push(value);
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values,
    };
  }

  /**
   * 构建 ORDER BY 子句
   */
  private buildOrderByClause(orderBy?: { column: string; direction: 'asc' | 'desc' }[]): string {
    if (!orderBy || orderBy.length === 0) {
      return '';
    }

    const clauses = orderBy.map((order) => {
      const escapedColumn = this.escapeIdentifier(order.column);
      const direction = order.direction.toUpperCase();
      return `${escapedColumn} ${direction}`;
    });

    return `ORDER BY ${clauses.join(', ')}`;
  }

  async findOne<T = any>(
    table: string,
    filters: Record<string, any>
  ): Promise<{ data: T | null; error: Error | null }> {
    try {
      const escapedTable = this.escapeIdentifier(table);
      const { clause, values } = this.buildWhereClause(filters);
      const query = `SELECT * FROM ${escapedTable} ${clause} LIMIT 1`;

      const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(query, values);

      return {
        data: (rows[0] as T) || null,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
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
  ): Promise<AdapterQueryResult<T>> {
    try {
      const escapedTable = this.escapeIdentifier(table);
      const selectFields = options?.select
        ? options.select.map((field) => this.escapeIdentifier(field)).join(', ')
        : '*';
      const { clause, values } = filters ? this.buildWhereClause(filters) : { clause: '', values: [] };
      const orderByClause = this.buildOrderByClause(options?.orderBy);

      let query = `SELECT ${selectFields} FROM ${escapedTable} ${clause} ${orderByClause}`;
      const queryValues = [...values];

      if (options?.limit) {
        query += ' LIMIT ?';
        queryValues.push(options.limit);
      }

      if (options?.offset) {
        query += ' OFFSET ?';
        queryValues.push(options.offset);
      }

      const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(query, queryValues);

      // 获取总数（如果需要）
      let count: number | undefined;
      if (filters) {
        const { clause: countClause, values: countValues } = this.buildWhereClause(filters);
        const [countRows] = await this.pool.execute<mysql.RowDataPacket[]>(
          `SELECT COUNT(*) as count FROM ${escapedTable} ${countClause}`,
          countValues
        );
        count = countRows[0].count as number;
      }

      return {
        data: rows as T[],
        error: null,
        count,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async insert<T = any>(
    table: string,
    data: T | T[]
  ): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const records = Array.isArray(data) ? data : [data];
      if (records.length === 0) {
        return { data: [], error: null };
      }

      const escapedTable = this.escapeIdentifier(table);
      const firstRecord = records[0] as Record<string, any>;
      const columns = Object.keys(firstRecord);
      const escapedColumns = columns.map((col) => this.escapeIdentifier(col));
      const placeholders: string[] = [];
      const values: any[] = [];

      for (const record of records) {
        const rowPlaceholders: string[] = [];
        for (const column of columns) {
          rowPlaceholders.push('?');
          values.push((record as Record<string, any>)[column]);
        }
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
      }

      const columnsStr = escapedColumns.join(', ');
      const valuesStr = placeholders.join(', ');
      const query = `INSERT INTO ${escapedTable} (${columnsStr}) VALUES ${valuesStr}`;

      const [result] = await this.pool.execute<mysql.ResultSetHeader>(query, values);

      // MySQL 的 INSERT 不直接返回插入的记录，需要再次查询
      if (result.insertId) {
        // 单条插入
        if (records.length === 1) {
          const inserted = await this.findOne<T>(table, { id: result.insertId } as any);
          return {
            data: inserted.data ? [inserted.data] : null,
            error: inserted.error,
          };
        } else {
          // 批量插入，返回所有插入的记录（简化处理，返回原始数据）
          return {
            data: records as T[],
            error: null,
          };
        }
      }

      return {
        data: records as T[],
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async update<T = any>(
    table: string,
    filters: Record<string, any>,
    data: Partial<T>
  ): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const escapedTable = this.escapeIdentifier(table);
      const updateFields = Object.keys(data);
      if (updateFields.length === 0) {
        return { data: null, error: new Error('No fields to update') };
      }

      const setClauses: string[] = [];
      const values: any[] = [];

      for (const field of updateFields) {
        const escapedField = this.escapeIdentifier(field);
        setClauses.push(`${escapedField} = ?`);
        values.push((data as Record<string, any>)[field]);
      }

      const { clause: whereClause, values: whereValues } = this.buildWhereClause(filters);
      const setClause = setClauses.join(', ');

      const query = `UPDATE ${escapedTable} SET ${setClause} ${whereClause}`;
      const allValues = [...values, ...whereValues];

      await this.pool.execute(query, allValues);

      // MySQL 的 UPDATE 不直接返回更新的记录，需要再次查询
      const updated = await this.findMany<T>(table, filters);

      return {
        data: updated.data,
        error: updated.error,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async delete(
    table: string,
    filters: Record<string, any>
  ): Promise<{ error: Error | null }> {
    try {
      const escapedTable = this.escapeIdentifier(table);
      const { clause, values } = this.buildWhereClause(filters);
      const query = `DELETE FROM ${escapedTable} ${clause}`;

      await this.pool.execute(query, values);

      return {
        error: null,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async count(
    table: string,
    filters?: Record<string, any>
  ): Promise<number> {
    try {
      const escapedTable = this.escapeIdentifier(table);
      const { clause, values } = filters ? this.buildWhereClause(filters) : { clause: '', values: [] };
      const query = `SELECT COUNT(*) as count FROM ${escapedTable} ${clause}`;

      const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(query, values);

      return rows[0].count as number;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
