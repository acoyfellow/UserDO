import { z } from 'zod';
import { GenericQuery } from './query';

// Type alias for better DX
export type Table<T = any> = GenericTable<T>;

export class GenericTable<T = any> {
  constructor(
    private tableName: string,
    private schema: z.ZodSchema<T>,
    private storage: DurableObjectStorage,
    private userId: string,
    private broadcast: (event: string, data: any) => void
  ) { }

  async create(data: T): Promise<T & { id: string; createdAt: Date; updatedAt: Date }> {
    const validated = this.schema.parse(data);
    const id = crypto.randomUUID();
    const now = Date.now();

    const insertSQL = `INSERT INTO "${this.tableName}" (id, data, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?)`;

    this.storage.sql.exec(insertSQL, id, JSON.stringify(validated), now, now, this.userId);

    const result = { ...validated, id, createdAt: new Date(now), updatedAt: new Date(now) };
    this.broadcast(`table:${this.tableName}:create`, { type: 'create', data: result });
    return result;
  }

  async findById(id: string): Promise<(T & { id: string; createdAt: Date; updatedAt: Date }) | null> {
    const selectSQL = `SELECT * FROM "${this.tableName}" WHERE id = ? AND user_id = ? LIMIT 1`;
    const cursor = this.storage.sql.exec(selectSQL, id, this.userId);
    const row = cursor.one();

    if (!row) return null;

    const data = JSON.parse(row.data as string);
    return {
      ...data,
      id: row.id as string,
      createdAt: new Date(row.created_at as number),
      updatedAt: new Date(row.updated_at as number)
    };
  }

  async update(id: string, updates: Partial<T>): Promise<T & { id: string; createdAt: Date; updatedAt: Date }> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Record not found');

    const merged: any = { ...existing, ...updates };
    delete merged.id;
    delete merged.createdAt;
    delete merged.updatedAt;

    const validated = this.schema.parse(merged);
    const now = Date.now();

    const updateSQL = `UPDATE "${this.tableName}" SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?`;
    this.storage.sql.exec(updateSQL, JSON.stringify(validated), now, id, this.userId);

    const result = { ...validated, id, createdAt: existing.createdAt, updatedAt: new Date(now) };
    this.broadcast(`table:${this.tableName}:update`, { type: 'update', data: result });
    return result;
  }

  async delete(id: string): Promise<void> {
    const deleteSQL = `DELETE FROM "${this.tableName}" WHERE id = ? AND user_id = ?`;
    this.storage.sql.exec(deleteSQL, id, this.userId);
    this.broadcast(`table:${this.tableName}:delete`, { type: 'delete', data: { id } });
  }

  where(path: string, operator: '==' | '!=' | '>' | '<' | 'includes', value: any): GenericQuery<T> {
    return new GenericQuery<T>(this.tableName, this.storage, this.schema, this.userId).where(path, operator, value);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): GenericQuery<T> {
    return new GenericQuery<T>(this.tableName, this.storage, this.schema, this.userId).orderBy(field, direction);
  }

  limit(count: number): GenericQuery<T> {
    return new GenericQuery<T>(this.tableName, this.storage, this.schema, this.userId).limit(count);
  }

  async getAll(): Promise<Array<T & { id: string; createdAt: Date; updatedAt: Date }>> {
    return new GenericQuery<T>(this.tableName, this.storage, this.schema, this.userId).get();
  }

  async count(): Promise<number> {
    const countSQL = `SELECT COUNT(*) as count FROM "${this.tableName}" WHERE user_id = ?`;
    const cursor = this.storage.sql.exec(countSQL, this.userId);
    const row = cursor.one();
    return row ? Number(row.count) : 0;
  }
}
