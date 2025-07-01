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
    private getOrganizationContext: () => string | undefined,
    private broadcast?: (event: string, data: any) => void
  ) { }

  private get organizationContext(): string | undefined {
    return this.getOrganizationContext();
  }

  async create(data: T): Promise<T & { id: string; createdAt: Date; updatedAt: Date }> {
    const validated = this.schema.parse(data);
    const id = crypto.randomUUID();
    const now = Date.now();

    let insertSQL: string;
    let params: any[];

    if (this.organizationContext) {
      insertSQL = `INSERT INTO "${this.tableName}" (id, data, created_at, updated_at, user_id, organization_id) VALUES (?, ?, ?, ?, ?, ?)`;
      params = [id, JSON.stringify(validated), now, now, this.userId, this.organizationContext];
    } else {
      insertSQL = `INSERT INTO "${this.tableName}" (id, data, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?)`;
      params = [id, JSON.stringify(validated), now, now, this.userId];
    }

    this.storage.sql.exec(insertSQL, ...params);

    const result = { ...validated, id, createdAt: new Date(now), updatedAt: new Date(now) };

    // Broadcast table change
    this.broadcast?.(`table:${this.tableName}`, { type: 'create', data: result });

    return result;
  }

  async findById(id: string): Promise<(T & { id: string; createdAt: Date; updatedAt: Date }) | null> {
    let selectSQL: string;
    let params: any[];

    if (this.organizationContext) {
      selectSQL = `SELECT * FROM "${this.tableName}" WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`;
      params = [id, this.userId, this.organizationContext];
    } else {
      selectSQL = `SELECT * FROM "${this.tableName}" WHERE id = ? AND user_id = ? LIMIT 1`;
      params = [id, this.userId];
    }

    const cursor = this.storage.sql.exec(selectSQL, ...params);
    const results = cursor.toArray();

    if (results.length === 0) {
      return null;
    }

    const row = results[0];

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

    let updateSQL: string;
    let params: any[];

    if (this.organizationContext) {
      updateSQL = `UPDATE "${this.tableName}" SET data = ?, updated_at = ? WHERE id = ? AND user_id = ? AND organization_id = ?`;
      params = [JSON.stringify(validated), now, id, this.userId, this.organizationContext];
    } else {
      updateSQL = `UPDATE "${this.tableName}" SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?`;
      params = [JSON.stringify(validated), now, id, this.userId];
    }

    this.storage.sql.exec(updateSQL, ...params);

    const result = { ...validated, id, createdAt: existing.createdAt, updatedAt: new Date(now) };

    // Broadcast table change
    this.broadcast?.(`table:${this.tableName}`, { type: 'update', data: result });

    return result;
  }

  async delete(id: string): Promise<void> {
    let deleteSQL: string;
    let params: any[];

    if (this.organizationContext) {
      deleteSQL = `DELETE FROM "${this.tableName}" WHERE id = ? AND user_id = ? AND organization_id = ?`;
      params = [id, this.userId, this.organizationContext];
    } else {
      deleteSQL = `DELETE FROM "${this.tableName}" WHERE id = ? AND user_id = ?`;
      params = [id, this.userId];
    }

    this.storage.sql.exec(deleteSQL, ...params);

    // Broadcast table change
    this.broadcast?.(`table:${this.tableName}`, { type: 'delete', data: { id } });
  }

  where(path: string, operator: '==' | '!=' | '>' | '<' | 'includes', value: any): GenericQuery<T> {
    return new GenericQuery<T>(this.tableName, this.storage, this.schema, this.userId, this.getOrganizationContext).where(path, operator, value);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): GenericQuery<T> {
    return new GenericQuery<T>(this.tableName, this.storage, this.schema, this.userId, this.getOrganizationContext).orderBy(field, direction);
  }

  limit(count: number): GenericQuery<T> {
    return new GenericQuery<T>(this.tableName, this.storage, this.schema, this.userId, this.getOrganizationContext).limit(count);
  }

  async getAll(): Promise<Array<T & { id: string; createdAt: Date; updatedAt: Date }>> {
    return new GenericQuery<T>(this.tableName, this.storage, this.schema, this.userId, this.getOrganizationContext).get();
  }

  async count(): Promise<number> {
    let sql: string;
    let params: any[];

    if (this.organizationContext) {
      sql = `SELECT COUNT(*) as count FROM "${this.tableName}" WHERE user_id = ? AND organization_id = ?`;
      params = [this.userId, this.organizationContext];
    } else {
      sql = `SELECT COUNT(*) as count FROM "${this.tableName}" WHERE user_id = ?`;
      params = [this.userId];
    }

    const cursor = this.storage.sql.exec(sql, ...params);
    const results = cursor.toArray();
    return results.length > 0 ? Number(results[0].count) : 0;
  }
}
