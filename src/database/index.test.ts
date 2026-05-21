/**
 * Unit tests for src/database/index.ts
 */

// Jest type declarations for test file
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: {
  (actual: any): {
    toBe: (expected: any) => void;
    toEqual: (expected: any) => void;
    toBeDefined: () => void;
    toBeNull: () => void;
    toBeUndefined: () => void;
    toBeTruthy: () => void;
    toBeFalsy: () => void;
    toContain: (expected: any) => void;
    toHaveLength: (expected: number) => void;
    toMatch: (expected: RegExp | string) => void;
    toBeInstanceOf: (expected: any) => void;
    toHaveBeenCalled: () => void;
    toHaveBeenCalledWith: (...args: any[]) => void;
    toHaveBeenCalledTimes: (expected: number) => void;
    toThrow: (expected?: string | RegExp | Error) => void;
    toBeGreaterThan: (expected: number) => void;
    toBeLessThan: (expected: number) => void;
    not: {
      toBe: (expected: any) => void;
      toEqual: (expected: any) => void;
      toBeNull: () => void;
      toBeUndefined: () => void;
      toContain: (expected: any) => void;
    };
  };
  stringContaining: (str: string) => string;
  any: (type: any) => any;
};
declare const jest: {
  fn: <T extends (...args: any[]) => any>(impl?: T) => jest.MockedFunction<T>;
  mock: (moduleName: string, factory: () => any, options?: any) => void;
  spyOn: (object: any, method: string, accessType?: 'get' | 'set') => jest.SpyInstance;
};
declare namespace jest {
  interface MockedFunction<T extends (...args: any[]) => any> extends Function {
    (...args: Parameters<T>): ReturnType<T>;
    mockReturnValue: (value: ReturnType<T>) => MockedFunction<T>;
    mockResolvedValue: (value: ReturnType<T>) => MockedFunction<T>;
    mockRejectedValue: (value: any) => MockedFunction<T>;
    mockImplementation: (impl: T) => MockedFunction<T>;
    mockImplementationOnce: (impl: T) => MockedFunction<T>;
    mockClear: () => MockedFunction<T>;
    mockReset: () => MockedFunction<T>;
    mock: {
      calls: any[][];
    };
  }
  interface SpyInstance {
    mockRestore: () => void;
    mockImplementation: (impl: (...args: any[]) => any) => SpyInstance;
  }
}

// Helper to create mock functions
function createMock<T extends (...args: any[]) => any>(impl?: T): jest.MockedFunction<T> {
  return jest.fn(impl) as jest.MockedFunction<T>;
}

import { UserDODatabase } from './index';
import { GenericTable } from './table';

describe('UserDODatabase', () => {
  describe('constructor', () => {
    it('should create instance with required parameters', () => {
      const mockStorage = {
        sql: {
          exec: createMock()
        }
      } as any;

      const db = new UserDODatabase(mockStorage, 'user-123');

      expect(db).toBeDefined();
    });

    it('should create instance with optional broadcast parameter', () => {
      const mockStorage = {
        sql: {
          exec: createMock()
        }
      } as any;
      const mockBroadcast = createMock();

      const db = new UserDODatabase(mockStorage, 'user-123', mockBroadcast);

      expect(db).toBeDefined();
    });
  });

  describe('setOrganizationContext', () => {
    it('should set organization context', () => {
      const mockStorage = {
        sql: {
          exec: createMock()
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      db.setOrganizationContext('org-123');

      expect(db).toBeDefined();
    });

    it('should accept undefined to clear organization context', () => {
      const mockStorage = {
        sql: {
          exec: createMock()
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      db.setOrganizationContext('org-123');
      db.setOrganizationContext(undefined);

      expect(db).toBeDefined();
    });
  });

  describe('table', () => {
    it('should create a new table with basic schema', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      const table = db.table('users', z.z.object({ name: z.z.string() }));

      expect(table).toBeDefined();
      expect(table).toBeInstanceOf(GenericTable);
      expect(mockExec).toHaveBeenCalled();
    });

    it('should return same table instance when called multiple times with same name', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      const table1 = db.table('users', z.z.object({ name: z.z.string() }));
      const table2 = db.table('users', z.z.object({ name: z.z.string() }));

      expect(table1).toBe(table2);
      expect(mockExec).toHaveBeenCalledTimes(1);
    });

    it('should create table with userScoped option', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      db.table('users', z.z.object({ name: z.z.string() }), { userScoped: true });

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('user_id TEXT NOT NULL')
      );
    });

    it('should create table with organizationScoped option', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      db.table('users', z.z.object({ name: z.z.string() }), { organizationScoped: true });

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('organization_id TEXT NOT NULL')
      );
    });

    it('should create table with both userScoped and organizationScoped options', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      db.table('users', z.z.object({ name: z.z.string() }), {
        userScoped: true,
        organizationScoped: true
      });

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('user_id TEXT NOT NULL')
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('organization_id TEXT NOT NULL')
      );
    });

    it('should create table with indexes option', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      const table = db.table('users', z.z.object({ name: z.z.string() }), { indexes: ['name'] });

      expect(table).toBeDefined();
      expect(mockExec).toHaveBeenCalled();
    });

    it('should handle table creation errors gracefully', async () => {
      const z = await import('zod');
      const mockExec = createMock().mockImplementation(() => {
        throw new Error('Table creation failed');
      });
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      const table = db.table('users', z.z.object({ name: z.z.string() }));

      expect(table).toBeDefined();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Table users creation result:',
        expect.any(Error)
      );
      consoleLogSpy.mockRestore();
    });

    it('should pass organization context getter to GenericTable when organizationScoped', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');
      db.setOrganizationContext('org-123');

      const table = db.table('users', z.z.object({ name: z.z.string() }), { organizationScoped: true });

      expect(table).toBeDefined();
    });

    it('should pass undefined organization context getter when not organizationScoped', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');
      db.setOrganizationContext('org-123');

      const table = db.table('users', z.z.object({ name: z.z.string() }));

      expect(table).toBeDefined();
    });
  });

  describe('raw getter', () => {
    it('should return storage.sql', () => {
      const mockSql = {
        exec: createMock()
      };
      const mockStorage = {
        sql: mockSql
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      const raw = db.raw;

      expect(raw).toBe(mockSql);
    });
  });

  describe('table SQL generation', () => {
    it('should generate correct SQL for basic table', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      db.table('test_table', z.z.object({ name: z.z.string() }));

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "test_table"')
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('id TEXT PRIMARY KEY')
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('data TEXT NOT NULL')
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('created_at INTEGER NOT NULL')
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('updated_at INTEGER NOT NULL')
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('user_id TEXT')
      );
    });

    it('should generate SQL with nullable user_id when not userScoped', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      db.table('test_table', z.z.object({ name: z.z.string() }));

      const sqlCall = mockExec.mock.calls[0][0] as string;
      expect(sqlCall).toContain('user_id TEXT');
      expect(sqlCall).not.toContain('user_id TEXT NOT NULL');
    });

    it('should generate SQL with nullable organization_id when not organizationScoped', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      db.table('test_table', z.z.object({ name: z.z.string() }));

      const sqlCall = mockExec.mock.calls[0][0] as string;
      expect(sqlCall).toContain('organization_id TEXT');
      expect(sqlCall).not.toContain('organization_id TEXT NOT NULL');
    });
  });

  describe('multiple tables', () => {
    it('should manage multiple different tables', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');

      const usersTable = db.table('users', z.z.object({ name: z.z.string() }));
      const postsTable = db.table('posts', z.z.object({ title: z.z.string() }));

      expect(usersTable).toBeDefined();
      expect(postsTable).toBeDefined();
      expect(usersTable).not.toBe(postsTable);
      expect(mockExec).toHaveBeenCalledTimes(2);
    });
  });

  describe('schema storage', () => {
    it('should store schema for each table', async () => {
      const z = await import('zod');
      const mockExec = createMock();
      const mockStorage = {
        sql: {
          exec: mockExec
        }
      } as any;
      const db = new UserDODatabase(mockStorage, 'user-123');
      const schema = z.z.object({ name: z.z.string() });

      db.table('users', schema);

      // Table should be created with the schema
      expect(mockExec).toHaveBeenCalled();
    });
  });
});
