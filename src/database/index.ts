import { z } from 'zod';
import { GenericTable } from './table.js';

export interface TableOptions {
  userScoped?: boolean;
  organizationScoped?: boolean;
  indexes?: string[];
}

export class UserDODatabase {
  private tables = new Map<string, GenericTable<any>>();
  private schemas = new Map<string, z.ZodSchema>();
  private organizationContext?: string;

  constructor(
    private storage: DurableObjectStorage,
    private currentUserId: string,
    private broadcast?: (event: string, data: any) => void
  ) { }

  setOrganizationContext(organizationId?: string): void {
    this.organizationContext = organizationId;
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
        this.storage,
        this.currentUserId,
        () => options.organizationScoped ? this.organizationContext : undefined,
        this.broadcast
      );
      this.tables.set(name, table);
      this.schemas.set(name, schema);
    }
    return this.tables.get(name)! as GenericTable<z.infer<T>>;
  }

  get raw() {
    return this.storage.sql;
  }

  private ensureTableExists(name: string, options: TableOptions): void {
    const createSQL = `CREATE TABLE IF NOT EXISTS "${name}" (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      user_id TEXT${options.userScoped ? ' NOT NULL' : ''},
      organization_id TEXT${options.organizationScoped ? ' NOT NULL' : ''}
    )`;

    try {
      this.storage.sql.exec(createSQL);
    } catch (err) {
      console.log(`Table ${name} creation result:`, err);
    }
  }
}
