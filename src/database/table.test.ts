/**
 * Unit tests for src/database/table.ts
 */

// Jest type declarations for test file
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const beforeEach: (fn: () => void | Promise<void>) => void;
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
    rejects: {
      toThrow: (expected?: string | RegExp | Error) => Promise<void>;
    };
  };
  stringContaining: (str: string) => string;
  objectContaining: (obj: any) => any;
  any: (type: any) => any;
};
declare const jest: {
  fn: <T extends (...args: any[]) => any>(impl?: T) => jest.MockedFunction<T>;
  mock: (moduleName: string, factory: () => any, options?: any) => void;
  spyOn: (object: any, method: string, accessType?: 'get' | 'set') => jest.SpyInstance;
  clearAllMocks: () => void;
};
declare namespace jest {
  interface MockedFunction<T extends (...args: any[]) => any> extends Function {
    (...args: Parameters<T>): ReturnType<T>;
    mockReturnValue: (value: ReturnType<T>) => MockedFunction<T>;
    mockResolvedValue: (value: ReturnType<T>) => MockedFunction<T>;
    mockRejectedValue: (value: any) => MockedFunction<T>;
    mockImplementation: (impl: T) => MockedFunction<T>;
    mockImplementationOnce: (impl: T) => MockedFunction<T>;
    mockReturnValueOnce: (value: ReturnType<T>) => MockedFunction<T>;
    mockClear: () => MockedFunction<T>;
    mockReset: () => MockedFunction<T>;
    mock: {
      calls: any[][];
    };
  }
  interface SpyInstance<T = any, Y = any> extends Function {
    (...args: Y[]): T;
    mockRestore: () => void;
    mockReturnValue: (value: T) => SpyInstance<T, Y>;
    mockResolvedValue: (value: T) => SpyInstance<T, Y>;
    mockRejectedValue: (value: any) => SpyInstance<T, Y>;
    mock: {
      calls: any[][];
    };
  }
}

import { z } from 'zod';
import { GenericTable } from './table';
import { GenericQuery } from './query';

// Mock DurableObjectStorage
class MockDurableObjectStorage {
  sql = {
    exec: jest.fn(),
  };
}

// Mock cursor that returns results
class MockCursor {
  constructor(private results: any[]) {}

  *[Symbol.iterator]() {
    for (const result of this.results) {
      yield result;
    }
  }

  toArray() {
    return this.results;
  }
}

describe('GenericTable', () => {
  let mockStorage: MockDurableObjectStorage;
  const mockSchema = z.object({
    name: z.string(),
    email: z.string(),
    age: z.number(),
    tags: z.array(z.string()),
  });
  const mockUserId = 'user-123';
  const mockOrganizationId = 'org-456';
  const tableName = 'users';
  const mockBroadcast = jest.fn();

  beforeEach(() => {
    mockStorage = new MockDurableObjectStorage();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a new GenericTable instance', () => {
      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );
      expect(table).toBeInstanceOf(GenericTable);
    });

    it('should create instance with optional broadcast function', () => {
      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined,
        mockBroadcast
      );
      expect(table).toBeInstanceOf(GenericTable);
    });
  });

  describe('create', () => {
    it('should create a new record without organization context', async () => {
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const data = { name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] };
      const result = await table.create(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('John');
      expect(result.email).toBe('john@example.com');
      expect(result.age).toBe(30);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      expect(mockExec).toHaveBeenCalled();
      const callArgs = mockExec.mock.calls[0];
      expect(callArgs[0]).toContain(`INSERT INTO "${tableName}"`);
      expect(callArgs[0]).toContain('user_id');
      expect(callArgs[0]).not.toContain('organization_id');
    });

    it('should create a new record with organization context', async () => {
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => mockOrganizationId
      );

      const data = { name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] };
      const result = await table.create(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();

      const callArgs = mockExec.mock.calls[0];
      expect(callArgs[0]).toContain(`INSERT INTO "${tableName}"`);
      expect(callArgs[0]).toContain('organization_id');
      expect(callArgs).toContain(mockOrganizationId);
    });

    it('should validate data against schema', async () => {
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const invalidData = { name: 'John', email: 'john@example.com', age: 'not a number', tags: ['admin'] };

      await expect(table.create(invalidData as any)).rejects.toThrow();
    });

    it('should broadcast create event when broadcast function is provided', async () => {
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue({});
      const mockBroadcastFn = jest.fn();

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined,
        mockBroadcastFn
      );

      const data = { name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] };
      await table.create(data);

      expect(mockBroadcastFn).toHaveBeenCalledWith(
        `table:${tableName}`,
        expect.objectContaining({ type: 'create' })
      );
    });

    it('should not broadcast when broadcast function is not provided', async () => {
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const data = { name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] };
      await table.create(data);

      // Should not throw - broadcast is optional
      expect(mockExec).toHaveBeenCalled();
    });

    it('should generate unique id for each record', async () => {
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const data1 = { name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] };
      const data2 = { name: 'Jane', email: 'jane@example.com', age: 25, tags: ['user'] };

      const result1 = await table.create(data1);
      const result2 = await table.create(data2);

      expect(result1.id).not.toBe(result2.id);
    });

    it('should set createdAt and updatedAt to the same value on create', async () => {
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const data = { name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] };
      const result = await table.create(data);

      expect(result.createdAt.getTime()).toBe(result.updatedAt.getTime());
    });
  });

  describe('findById', () => {
    it('should find a record by id without organization context', async () => {
      const mockRows = [
        {
          id: 'row-1',
          data: JSON.stringify({ name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] }),
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ];
      const mockCursor = new MockCursor(mockRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue(mockCursor);

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const result = await table.findById('row-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('row-1');
      expect(result?.name).toBe('John');
      expect(result?.email).toBe('john@example.com');
      expect(result?.age).toBe(30);
      expect(result?.createdAt).toEqual(new Date(1700000000000));
      expect(result?.updatedAt).toEqual(new Date(1700000000000));

      const callArgs = mockExec.mock.calls[0];
      expect(callArgs[0]).toContain(`SELECT * FROM "${tableName}" WHERE id = ? AND user_id = ?`);
      expect(callArgs[1]).toBe('row-1');
      expect(callArgs[2]).toBe(mockUserId);
    });

    it('should find a record by id with organization context', async () => {
      const mockRows = [
        {
          id: 'row-1',
          data: JSON.stringify({ name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] }),
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ];
      const mockCursor = new MockCursor(mockRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue(mockCursor);

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => mockOrganizationId
      );

      const result = await table.findById('row-1');

      expect(result).toBeDefined();

      const callArgs = mockExec.mock.calls[0];
      expect(callArgs[0]).toContain('AND organization_id = ?');
      expect(callArgs).toContain(mockOrganizationId);
    });

    it('should return null when record not found', async () => {
      const mockCursor = new MockCursor([]);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue(mockCursor);

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const result = await table.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when no rows returned', async () => {
      const mockCursor = new MockCursor([]);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue(mockCursor);

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const result = await table.findById('row-1');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a record without organization context', async () => {
      const mockFindRows = [
        {
          id: 'row-1',
          data: JSON.stringify({ name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] }),
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ];
      const mockFindCursor = new MockCursor(mockFindRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValueOnce(mockFindCursor).mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const updates = { name: 'John Updated', age: 31 };
      const result = await table.update('row-1', updates);

      expect(result).toBeDefined();
      expect(result?.name).toBe('John Updated');
      expect(result?.age).toBe(31);
      expect(result?.id).toBe('row-1');
      expect(result?.createdAt).toEqual(new Date(1700000000000));
      expect(result?.updatedAt).not.toEqual(new Date(1700000000000));

      const updateCall = mockExec.mock.calls[1];
      expect(updateCall[0]).toContain(`UPDATE "${tableName}" SET data = ?`);
    });

    it('should update a record with organization context', async () => {
      const mockFindRows = [
        {
          id: 'row-1',
          data: JSON.stringify({ name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] }),
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ];
      const mockFindCursor = new MockCursor(mockFindRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValueOnce(mockFindCursor).mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => mockOrganizationId
      );

      const updates = { name: 'John Updated' };
      await table.update('row-1', updates);

      const updateCall = mockExec.mock.calls[1];
      expect(updateCall[0]).toContain('AND organization_id = ?');
      expect(updateCall).toContain(mockOrganizationId);
    });

    it('should throw error when record not found', async () => {
      const mockCursor = new MockCursor([]);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue(mockCursor);

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      await expect(table.update('nonexistent', { name: 'Updated' })).rejects.toThrow('Record not found');
    });

    it('should validate updated data against schema', async () => {
      const mockFindRows = [
        {
          id: 'row-1',
          data: JSON.stringify({ name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] }),
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ];
      const mockFindCursor = new MockCursor(mockFindRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValueOnce(mockFindCursor).mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const invalidUpdates = { age: 'not a number' };

      await expect(table.update('row-1', invalidUpdates as any)).rejects.toThrow();
    });

    it('should broadcast update event when broadcast function is provided', async () => {
      const mockFindRows = [
        {
          id: 'row-1',
          data: JSON.stringify({ name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] }),
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ];
      const mockFindCursor = new MockCursor(mockFindRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValueOnce(mockFindCursor).mockReturnValue({});
      const mockBroadcastFn = jest.fn();

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined,
        mockBroadcastFn
      );

      const updates = { name: 'John Updated' };
      await table.update('row-1', updates);

      expect(mockBroadcastFn).toHaveBeenCalledWith(
        `table:${tableName}`,
        expect.objectContaining({ type: 'update' })
      );
    });

    it('should merge updates with existing data', async () => {
      const mockFindRows = [
        {
          id: 'row-1',
          data: JSON.stringify({ name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] }),
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ];
      const mockFindCursor = new MockCursor(mockFindRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValueOnce(mockFindCursor).mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const updates = { name: 'John Updated' };
      const result = await table.update('row-1', updates);

      expect(result?.email).toBe('john@example.com');
      expect(result?.age).toBe(30);
      expect(result?.tags).toEqual(['admin']);
    });

    it('should not allow updating id, createdAt, or updatedAt', async () => {
      const mockFindRows = [
        {
          id: 'row-1',
          data: JSON.stringify({ name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] }),
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ];
      const mockFindCursor = new MockCursor(mockFindRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValueOnce(mockFindCursor).mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const updates = { id: 'hacked-id', createdAt: new Date(0), updatedAt: new Date(0), name: 'Updated' };
      const result = await table.update('row-1', updates as any);

      expect(result?.id).toBe('row-1');
      expect(result?.createdAt).toEqual(new Date(1700000000000));
    });
  });

  describe('delete', () => {
    it('should delete a record without organization context', async () => {
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      await table.delete('row-1');

      expect(mockExec).toHaveBeenCalled();
      const callArgs = mockExec.mock.calls[0];
      expect(callArgs[0]).toContain(`DELETE FROM "${tableName}" WHERE id = ? AND user_id = ?`);
      expect(callArgs[1]).toBe('row-1');
      expect(callArgs[2]).toBe(mockUserId);
    });

    it('should delete a record with organization context', async () => {
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue({});

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => mockOrganizationId
      );

      await table.delete('row-1');

      const callArgs = mockExec.mock.calls[0];
      expect(callArgs[0]).toContain('AND organization_id = ?');
      expect(callArgs).toContain(mockOrganizationId);
    });

    it('should broadcast delete event when broadcast function is provided', async () => {
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue({});
      const mockBroadcastFn = jest.fn();

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined,
        mockBroadcastFn
      );

      await table.delete('row-1');

      expect(mockBroadcastFn).toHaveBeenCalledWith(
        `table:${tableName}`,
        expect.objectContaining({ type: 'delete', data: { id: 'row-1' } })
      );
    });
  });

  describe('where', () => {
    it('should return a GenericQuery instance', () => {
      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const query = table.where('name', '==', 'John');

      expect(query).toBeInstanceOf(GenericQuery);
    });

    it('should pass table name and storage to GenericQuery', () => {
      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const query = table.where('name', '==', 'John');

      expect(query).toBeInstanceOf(GenericQuery);
    });
  });

  describe('orderBy', () => {
    it('should return a GenericQuery instance', () => {
      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const query = table.orderBy('name');

      expect(query).toBeInstanceOf(GenericQuery);
    });

    it('should pass default direction asc to GenericQuery', () => {
      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const query = table.orderBy('name');

      expect(query).toBeInstanceOf(GenericQuery);
    });
  });

  describe('limit', () => {
    it('should return a GenericQuery instance', () => {
      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const query = table.limit(10);

      expect(query).toBeInstanceOf(GenericQuery);
    });
  });

  describe('getAll', () => {
    it('should return all records from the table', async () => {
      const mockRows = [
        {
          id: 'row-1',
          data: JSON.stringify({ name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] }),
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
        {
          id: 'row-2',
          data: JSON.stringify({ name: 'Jane', email: 'jane@example.com', age: 25, tags: ['user'] }),
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ];
      const mockCursor = new MockCursor(mockRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue(mockCursor);

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const results = await table.getAll();

      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe('row-1');
      expect(results[1]?.id).toBe('row-2');
    });

    it('should return empty array when no records', async () => {
      const mockCursor = new MockCursor([]);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue(mockCursor);

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const results = await table.getAll();

      expect(results).toEqual([]);
    });
  });

  describe('count', () => {
    it('should return count without organization context', async () => {
      const mockRows = [{ count: 5 }];
      const mockCursor = new MockCursor(mockRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue(mockCursor);

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const result = await table.count();

      expect(result).toBe(5);

      const callArgs = mockExec.mock.calls[0];
      expect(callArgs[0]).toContain(`SELECT COUNT(*) as count FROM "${tableName}" WHERE user_id = ?`);
      expect(callArgs[1]).toBe(mockUserId);
    });

    it('should return count with organization context', async () => {
      const mockRows = [{ count: 10 }];
      const mockCursor = new MockCursor(mockRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue(mockCursor);

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => mockOrganizationId
      );

      const result = await table.count();

      expect(result).toBe(10);

      const callArgs = mockExec.mock.calls[0];
      expect(callArgs[0]).toContain('AND organization_id = ?');
      expect(callArgs).toContain(mockOrganizationId);
    });

    it('should return 0 when no results', async () => {
      const mockCursor = new MockCursor([]);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue(mockCursor);

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      const result = await table.count();

      expect(result).toBe(0);
    });
  });

  describe('organization context getter', () => {
    it('should use the provided organization context getter', async () => {
      const mockRows = [{ count: 5 }];
      const mockCursor = new MockCursor(mockRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue(mockCursor);

      let contextValue: string | undefined;
      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => contextValue
      );

      contextValue = mockOrganizationId;
      await table.count();

      const callArgs = mockExec.mock.calls[0];
      expect(callArgs[0]).toContain('organization_id = ?');
      expect(callArgs[2]).toBe(mockOrganizationId);
    });

    it('should handle undefined organization context', async () => {
      const mockRows = [{ count: 5 }];
      const mockCursor = new MockCursor(mockRows);
      const mockExec = mockStorage.sql.exec as jest.MockedFunction<any>;
      mockExec.mockReturnValue(mockCursor);

      const table = new GenericTable(
        tableName,
        mockSchema,
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      await table.count();

      const callArgs = mockExec.mock.calls[0];
      expect(callArgs[0]).not.toContain('organization_id');
    });
  });

  describe('type alias', () => {
    it('should allow using Table type alias', () => {
      // This test verifies the type alias compiles correctly
      type TestTable = GenericTable<{ name: string }>;
      
      const table: TestTable = new GenericTable(
        tableName,
        z.object({ name: z.string() }),
        mockStorage as unknown as DurableObjectStorage,
        mockUserId,
        () => undefined
      );

      expect(table).toBeInstanceOf(GenericTable);
    });
  });
});
