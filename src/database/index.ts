import { drizzle } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { GenericTable } from './table';

export interface TableOptions {
  userScoped?: boolean;
  indexes?: string[];
}

export class UserDODatabase {
  private db: ReturnType<typeof drizzle>;
  private tables = new Map<string, GenericTable<any>>();
  private schemas = new Map<string, z.ZodSchema>();

  constructor(
    d1Database: D1Database,
    private currentUserId: string,
    private broadcast: (event: string, data: any) => void
  ) {
    this.db = drizzle(d1Database);
  }

  table<T extends z.ZodSchema>(
    name: string,
    schema: T,
    options: TableOptions = {}
  ): GenericTable<z.infer<T>> {
    if (!this.tables.has(name)) {
      this.ensureTableExists(name, options);
      const table = new GenericTable<z.infer<T>>(
        name,
        schema,
        this.db,
        this.currentUserId,
        this.broadcast
      );
      this.tables.set(name, table);
      this.schemas.set(name, schema);
    }
    return this.tables.get(name)! as GenericTable<z.infer<T>>;
  }

  get raw() {
    return this.db;
  }

  private async ensureTableExists(name: string, options: TableOptions): Promise<void> {
    const createSQL = `\n      CREATE TABLE IF NOT EXISTS "${name}" (\n        id TEXT PRIMARY KEY,\n        data TEXT NOT NULL,\n        created_at INTEGER NOT NULL,\n        updated_at INTEGER NOT NULL,\n        user_id TEXT${options.userScoped ? ' NOT NULL' : ''}\n      );\n    `;
    try {
      await this.db.run(sql`${createSQL}`);
    } catch (err) {
      console.log(`Table ${name} creation result:`, err);
    }
  }
}
