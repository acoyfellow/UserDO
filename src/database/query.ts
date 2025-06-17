import { z } from 'zod';

export class GenericQuery<T> {
  private conditions: Array<{ path: string; operator: string; value: any }> = [];
  private orderByClause?: { field: string; direction: 'asc' | 'desc' };
  private limitCount?: number;
  private offsetCount?: number;

  constructor(
    private tableName: string,
    private storage: DurableObjectStorage,
    private schema: z.ZodSchema<T>,
    private userId: string
  ) { }

  where(path: string, operator: '==' | '!=' | '>' | '<' | 'includes', value: any): this {
    this.conditions.push({ path, operator, value });
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderByClause = { field, direction };
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  offset(count: number): this {
    this.offsetCount = count;
    return this;
  }

  private conditionToSQL(
    condition: { path: string; operator: string; value: any },
    params: any[]
  ): string {
    const jsonPath = `$.${condition.path}`;
    switch (condition.operator) {
      case '==':
        params.push(condition.value);
        return `json_extract(data, '${jsonPath}') = ?`;
      case '!=':
        params.push(condition.value);
        return `json_extract(data, '${jsonPath}') != ?`;
      case '>':
        params.push(condition.value);
        return `json_extract(data, '${jsonPath}') > ?`;
      case '<':
        params.push(condition.value);
        return `json_extract(data, '${jsonPath}') < ?`;
      case 'includes':
        params.push(`%${condition.value}%`);
        return `json_extract(data, '${jsonPath}') LIKE ?`;
      default:
        throw new Error(`Unsupported operator: ${condition.operator}`);
    }
  }

  async get(): Promise<Array<T & { id: string; createdAt: Date; updatedAt: Date }>> {
    let sql = `SELECT * FROM "${this.tableName}" WHERE user_id = ?`;
    const params: any[] = [this.userId];

    // Add WHERE conditions
    if (this.conditions.length > 0) {
      const whereConditions = this.conditions.map((c) =>
        this.conditionToSQL(c, params)
      );
      sql += ` AND (${whereConditions.join(' AND ')})`;
    }

    // Add ORDER BY
    if (this.orderByClause) {
      const { field, direction } = this.orderByClause;
      if (field === 'createdAt' || field === 'updatedAt') {
        const dbField = field === 'createdAt' ? 'created_at' : 'updated_at';
        sql += ` ORDER BY ${dbField} ${direction.toUpperCase()}`;
      } else {
        const jsonPath = `$.${field}`;
        sql += ` ORDER BY json_extract(data, '${jsonPath}') ${direction.toUpperCase()}`;
      }
    }

    // Add LIMIT and OFFSET
    if (this.limitCount) {
      sql += ` LIMIT ${this.limitCount}`;
    }
    if (this.offsetCount) {
      sql += ` OFFSET ${this.offsetCount}`;
    }

    const cursor = this.storage.sql.exec(sql, ...params);
    const results: Array<T & { id: string; createdAt: Date; updatedAt: Date }> = [];

    for (const row of cursor) {
      const data = JSON.parse(row.data as string);
      results.push({
        ...data,
        id: row.id as string,
        createdAt: new Date(row.created_at as number),
        updatedAt: new Date(row.updated_at as number),
      });
    }

    return results;
  }

  async first(): Promise<(T & { id: string; createdAt: Date; updatedAt: Date }) | null> {
    const results = await this.limit(1).get();
    return results[0] || null;
  }

  async count(): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM "${this.tableName}" WHERE user_id = ?`;
    const params: any[] = [this.userId];

    if (this.conditions.length > 0) {
      const whereConditions = this.conditions.map((c) =>
        this.conditionToSQL(c, params)
      );
      sql += ` AND (${whereConditions.join(' AND ')})`;
    }

    const cursor = this.storage.sql.exec(sql, ...params);
    const row = cursor.one();
    return row ? Number(row.count) : 0;
  }
}
