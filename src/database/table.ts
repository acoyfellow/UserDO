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
    private broadcast?: (event: string, data: any) => void,
    private organizationId?: string
  ) { }

  async create(data: T): Promise<T & { id: string; createdAt: Date; updatedAt: Date }> {
    const validated = this.schema.parse(data);
    const id = crypto.randomUUID();
    const now = Date.now();

    const insertSQL = this.organizationId
      ? `INSERT INTO "${this.tableName}" (id, data, created_at, updated_at, user_id, organization_id) VALUES (?, ?, ?, ?, ?, ?)`
      : `INSERT INTO "${this.tableName}" (id, data, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?)`;

    const params = this.organizationId
      ? [id, JSON.stringify(validated), now, now, this.userId, this.organizationId]
      : [id, JSON.stringify(validated), now, now, this.userId];

    this.storage.sql.exec(insertSQL, ...params);

    const result = { ...validated, id, createdAt: new Date(now), updatedAt: new Date(now) };

    // Broadcast table change
    this.broadcast?.(`table:${this.tableName}`, { type: 'create', data: result });

    return result;
  }

  async findById(id: string): Promise<(T & { id: string; createdAt: Date; updatedAt: Date }) | null> {
    const selectSQL = this.organizationId
      ? `SELECT * FROM "${this.tableName}" WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`
      : `SELECT * FROM "${this.tableName}" WHERE id = ? AND user_id = ? LIMIT 1`;

    const params = this.organizationId
      ? [id, this.userId, this.organizationId]
      : [id, this.userId];

    const cursor = this.storage.sql.exec(selectSQL, ...params);
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

    console.log('Existing record:', JSON.stringify(existing, null, 2));
    console.log('Updates:', JSON.stringify(updates, null, 2));

    const merged: any = { ...existing, ...updates };
    console.log('Before deleting metadata fields:', JSON.stringify(merged, null, 2));

    // Don't delete createdAt from the merged object - we need it for validation
    delete merged.id;
    delete merged.updatedAt;
    // Keep the original createdAt as a string for validation
    if (merged.createdAt instanceof Date) {
      merged.createdAt = merged.createdAt.toISOString();
    }

    console.log('After processing for validation:', JSON.stringify(merged, null, 2));

    // Use safeParse to get better error handling
    const validationResult = this.schema.safeParse(merged);
    if (!validationResult.success) {
      console.error('Validation error in update:', validationResult.error);
      throw new Error(`Validation failed: ${JSON.stringify(validationResult.error.issues, null, 2)}`);
    }
    const validated = validationResult.data;
    const now = Date.now();

    const updateSQL = this.organizationId
      ? `UPDATE "${this.tableName}" SET data = ?, updated_at = ? WHERE id = ? AND user_id = ? AND organization_id = ?`
      : `UPDATE "${this.tableName}" SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?`;

    const params = this.organizationId
      ? [JSON.stringify(validated), now, id, this.userId, this.organizationId]
      : [JSON.stringify(validated), now, id, this.userId];

    this.storage.sql.exec(updateSQL, ...params);

    const result = { ...validated, id, createdAt: existing.createdAt, updatedAt: new Date(now) };

    // Broadcast table change
    this.broadcast?.(`table:${this.tableName}`, { type: 'update', data: result });

    return result;
  }

  async delete(id: string): Promise<void> {
    const deleteSQL = this.organizationId
      ? `DELETE FROM "${this.tableName}" WHERE id = ? AND user_id = ? AND organization_id = ?`
      : `DELETE FROM "${this.tableName}" WHERE id = ? AND user_id = ?`;

    const params = this.organizationId
      ? [id, this.userId, this.organizationId]
      : [id, this.userId];

    this.storage.sql.exec(deleteSQL, ...params);

    // Broadcast table change
    this.broadcast?.(`table:${this.tableName}`, { type: 'delete', data: { id } });
  }

  where(path: string, operator: '==' | '!=' | '>' | '<' | 'includes', value: any): GenericQuery<T> {
    return new GenericQuery<T>(this.tableName, this.storage, this.schema, this.userId, this.organizationId).where(path, operator, value);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): GenericQuery<T> {
    return new GenericQuery<T>(this.tableName, this.storage, this.schema, this.userId, this.organizationId).orderBy(field, direction);
  }

  limit(count: number): GenericQuery<T> {
    return new GenericQuery<T>(this.tableName, this.storage, this.schema, this.userId, this.organizationId).limit(count);
  }

  async getAll(): Promise<Array<T & { id: string; createdAt: Date; updatedAt: Date }>> {
    return new GenericQuery<T>(this.tableName, this.storage, this.schema, this.userId, this.organizationId).get();
  }

  async count(): Promise<number> {
    const countSQL = this.organizationId
      ? `SELECT COUNT(*) as count FROM "${this.tableName}" WHERE user_id = ? AND organization_id = ?`
      : `SELECT COUNT(*) as count FROM "${this.tableName}" WHERE user_id = ?`;

    const params = this.organizationId
      ? [this.userId, this.organizationId]
      : [this.userId];

    const cursor = this.storage.sql.exec(countSQL, ...params);
    const row = cursor.one();
    return row ? Number(row.count) : 0;
  }
}
