import { sql, and, asc, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';

export class GenericQuery<T> {
  private conditions: Array<{ path: string; operator: string; value: any }> = [];
  private orderByClause?: { field: string; direction: 'asc' | 'desc' };
  private limitCount?: number;
  private offsetCount?: number;

  constructor(
    private tableName: string,
    private drizzleTable: any,
    private db: ReturnType<typeof drizzle>,
    private schema: z.ZodSchema<T>
  ) {}

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

  async get(): Promise<Array<T & { id: string; createdAt: Date; updatedAt: Date }>> {
    let query: any = this.db.select().from(this.drizzleTable);

    if (this.conditions.length > 0) {
      const whereConditions = this.conditions.map((c) => {
        const jsonPath = `$.${c.path}`;
        switch (c.operator) {
          case '==':
            return sql`json_extract(data, ${jsonPath}) = ${c.value}`;
          case '!=':
            return sql`json_extract(data, ${jsonPath}) != ${c.value}`;
          case '>':
            return sql`json_extract(data, ${jsonPath}) > ${c.value}`;
          case '<':
            return sql`json_extract(data, ${jsonPath}) < ${c.value}`;
          case 'includes':
            return sql`json_extract(data, ${jsonPath}) LIKE '%' || ${c.value} || '%'`;
          default:
            throw new Error(`Unsupported operator: ${c.operator}`);
        }
      });
      query = query.where(and(...whereConditions));
    }

    if (this.orderByClause) {
      const { field, direction } = this.orderByClause;
      if (field === 'createdAt' || field === 'updatedAt') {
        query = query.orderBy(direction === 'asc' ? asc(this.drizzleTable[field]) : desc(this.drizzleTable[field]));
      } else {
        const jsonPath = `$.${field}`;
        query = query.orderBy(direction === 'asc' ? sql`json_extract(data, ${jsonPath}) ASC` : sql`json_extract(data, ${jsonPath}) DESC`);
      }
    }

    if (this.limitCount) {
      query = query.limit(this.limitCount);
    }
    if (this.offsetCount) {
      query = query.offset(this.offsetCount);
    }

    const records = await query;
    return records.map((record: any) => ({
      ...JSON.parse(record.data),
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  async first(): Promise<(T & { id: string; createdAt: Date; updatedAt: Date }) | null> {
    const results = await this.limit(1).get();
    return results[0] || null;
  }

  async count(): Promise<number> {
    let query: any = this.db.select({ count: sql`count(*)` }).from(this.drizzleTable) as any;
    if (this.conditions.length > 0) {
      const whereConditions = this.conditions.map((c) => {
        const jsonPath = `$.${c.path}`;
        switch (c.operator) {
          case '==':
            return sql`json_extract(data, ${jsonPath}) = ${c.value}`;
          case '!=':
            return sql`json_extract(data, ${jsonPath}) != ${c.value}`;
          case '>':
            return sql`json_extract(data, ${jsonPath}) > ${c.value}`;
          case '<':
            return sql`json_extract(data, ${jsonPath}) < ${c.value}`;
          case 'includes':
            return sql`json_extract(data, ${jsonPath}) LIKE '%' || ${c.value} || '%'`;
          default:
            throw new Error(`Unsupported operator: ${c.operator}`);
        }
      });
      query = query.where(and(...whereConditions));
    }
    const [result] = await query;
    return Number(result.count);
  }
}
