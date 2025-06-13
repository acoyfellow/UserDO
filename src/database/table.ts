import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { sql, asc, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { GenericQuery } from './query';

export class GenericTable<T = any> {
  private drizzleTable: any;

  constructor(
    private tableName: string,
    private schema: z.ZodSchema<T>,
    private db: ReturnType<typeof drizzle>,
    private userId: string,
    private broadcast: (event: string, data: any) => void
  ) {
    this.drizzleTable = sqliteTable(tableName, {
      id: text('id').primaryKey(),
      data: text('data', { mode: 'json' }),
      createdAt: integer('created_at', { mode: 'timestamp' }),
      updatedAt: integer('updated_at', { mode: 'timestamp' }),
      userId: text('user_id'),
    });
  }

  async create(data: T): Promise<T & { id: string; createdAt: Date; updatedAt: Date }> {
    const validated = this.schema.parse(data);
    const id = crypto.randomUUID();
    const now = new Date();
    const record = {
      id,
      data: JSON.stringify(validated),
      createdAt: now,
      updatedAt: now,
      userId: this.userId,
    };
    await this.db.insert(this.drizzleTable).values(record);
    const result = { ...validated, id, createdAt: now, updatedAt: now };
    this.broadcast(`table:${this.tableName}:create`, { type: 'create', data: result });
    return result;
  }

  async findById(id: string): Promise<(T & { id: string; createdAt: Date; updatedAt: Date }) | null> {
    const [record] = await this.db
      .select()
      .from(this.drizzleTable)
      .where(eq(this.drizzleTable.id, id))
      .limit(1);
    if (!record) return null;
    const data = JSON.parse(record.data);
    return { ...data, id: record.id, createdAt: record.createdAt, updatedAt: record.updatedAt };
  }

  async update(id: string, updates: Partial<T>): Promise<T & { id: string; createdAt: Date; updatedAt: Date }> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Record not found');
    const merged: any = { ...existing, ...updates };
    delete merged.id;
    delete merged.createdAt;
    delete merged.updatedAt;
    const validated = this.schema.parse(merged);
    const now = new Date();
    await this.db
      .update(this.drizzleTable)
      .set({ data: JSON.stringify(validated), updatedAt: now })
      .where(eq(this.drizzleTable.id, id));
    const result = { ...validated, id, createdAt: existing.createdAt, updatedAt: now };
    this.broadcast(`table:${this.tableName}:update`, { type: 'update', data: result });
    return result;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(this.drizzleTable).where(eq(this.drizzleTable.id, id));
    this.broadcast(`table:${this.tableName}:delete`, { type: 'delete', data: { id } });
  }

  where(path: string, operator: '==' | '!=' | '>' | '<' | 'includes', value: any): GenericQuery<T> {
    return new GenericQuery<T>(this.tableName, this.drizzleTable, this.db, this.schema).where(path, operator, value);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): GenericQuery<T> {
    return new GenericQuery<T>(this.tableName, this.drizzleTable, this.db, this.schema).orderBy(field, direction);
  }

  limit(count: number): GenericQuery<T> {
    return new GenericQuery<T>(this.tableName, this.drizzleTable, this.db, this.schema).limit(count);
  }

  async getAll(): Promise<Array<T & { id: string; createdAt: Date; updatedAt: Date }>> {
    return new GenericQuery<T>(this.tableName, this.drizzleTable, this.db, this.schema).get();
  }

  async count(): Promise<number> {
    const [result] = await this.db.select({ count: sql`count(*)` }).from(this.drizzleTable);
    return Number(result.count);
  }
}
