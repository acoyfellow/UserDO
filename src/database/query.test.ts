/**
 * Unit tests for src/database/query.ts
 */

// Jest type declarations for test file
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const beforeEach: (fn: () => void | Promise<void>) => void;
declare const expect: (actual: any) => {
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
  not: {
    toBe: (expected: any) => void;
    toEqual: (expected: any) => void;
    toBeNull: () => void;
    toBeUndefined: () => void;
  };
  toHaveBeenCalled: () => void;
  toHaveBeenCalledWith: (...args: any[]) => void;
  toThrow: (expected?: string | RegExp | Error) => void;
  toBeGreaterThan: (expected: number) => void;
  toBeLessThan: (expected: number) => void;
  rejects: {
    toThrow: (expected?: string | RegExp | Error) => Promise<void>;
  };
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

describe('GenericQuery', () => {
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

  beforeEach(() => {
    mockStorage = new MockDurableObjectStorage();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a new GenericQuery instance', () => {
      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );
      expect(query).toBeInstanceOf(GenericQuery);
    });
  });

  describe('where', () => {
    it('should add a condition with == operator', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.where('name', '==', 'John').get();

      expect(mockStorage.sql.exec).toHaveBeenCalled();
      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('json_extract(data, \'$.name\') = ?');
      expect(callArgs).toContain('John');
    });

    it('should add a condition with != operator', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.where('age', '!=', 30).get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('json_extract(data, \'$.age\') != ?');
      expect(callArgs).toContain(30);
    });

    it('should add a condition with > operator', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.where('age', '>', 18).get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('json_extract(data, \'$.age\') > ?');
      expect(callArgs).toContain(18);
    });

    it('should add a condition with < operator', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.where('age', '<', 65).get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('json_extract(data, \'$.age\') < ?');
      expect(callArgs).toContain(65);
    });

    it('should add a condition with includes operator', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.where('tags', 'includes', 'admin').get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('json_extract(data, \'$.tags\') LIKE ?');
      expect(callArgs).toContain('%admin%');
    });

    it('should throw an error for unsupported operator', async () => {
      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      // @ts-expect-error - Testing invalid operator
      query.where('name', 'invalid', 'value');

      await expect(query.get()).rejects.toThrow('Unsupported operator: invalid');
    });

    it('should chain multiple where conditions', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query
        .where('name', '==', 'John')
        .where('age', '>', 18)
        .get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('json_extract(data, \'$.name\') = ?');
      expect(callArgs[0]).toContain('json_extract(data, \'$.age\') > ?');
    });
  });

  describe('orderBy', () => {
    it('should order by field ascending by default', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.orderBy('name').get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('ORDER BY json_extract(data, \'$.name\') ASC');
    });

    it('should order by field ascending explicitly', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.orderBy('name', 'asc').get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('ORDER BY json_extract(data, \'$.name\') ASC');
    });

    it('should order by field descending', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.orderBy('age', 'desc').get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('ORDER BY json_extract(data, \'$.age\') DESC');
    });

    it('should order by createdAt', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.orderBy('createdAt', 'desc').get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('ORDER BY created_at DESC');
    });

    it('should order by updatedAt', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.orderBy('updatedAt', 'asc').get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('ORDER BY updated_at ASC');
    });
  });

  describe('limit', () => {
    it('should add LIMIT clause', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.limit(10).get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('LIMIT 10');
    });
  });

  describe('offset', () => {
    it('should add OFFSET clause', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.offset(20).get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('OFFSET 20');
    });

    it('should combine LIMIT and OFFSET', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.limit(10).offset(20).get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('LIMIT 10');
      expect(callArgs[0]).toContain('OFFSET 20');
    });
  });

  describe('get', () => {
    it('should return results without organization context', async () => {
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
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      const results = await query.get();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: 'row-1',
        name: 'John',
        email: 'john@example.com',
        age: 30,
        tags: ['admin'],
        createdAt: new Date(1700000000000),
        updatedAt: new Date(1700000000000),
      });
      expect(results[1]).toEqual({
        id: 'row-2',
        name: 'Jane',
        email: 'jane@example.com',
        age: 25,
        tags: ['user'],
        createdAt: new Date(1700000000000),
        updatedAt: new Date(1700000000000),
      });

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain(`SELECT * FROM "${tableName}" WHERE user_id = ?`);
      expect(callArgs[1]).toBe(mockUserId);
    });

    it('should return results with organization context', async () => {
      const mockRows = [
        {
          id: 'row-1',
          data: JSON.stringify({ name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] }),
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ];
      const mockCursor = new MockCursor(mockRows);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => mockOrganizationId
      );

      const results = await query.get();

      expect(results).toHaveLength(1);

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain(`SELECT * FROM "${tableName}" WHERE user_id = ? AND organization_id = ?`);
      expect(callArgs[1]).toBe(mockUserId);
      expect(callArgs[2]).toBe(mockOrganizationId);
    });

    it('should return empty array when no results', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      const results = await query.get();

      expect(results).toEqual([]);
    });

    it('should include WHERE conditions in query', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.where('name', '==', 'John').get();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('AND (json_extract(data, \'$.name\') = ?)');
    });
  });

  describe('first', () => {
    it('should return the first result', async () => {
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
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      const result = await query.first();

      expect(result).toEqual({
        id: 'row-1',
        name: 'John',
        email: 'john@example.com',
        age: 30,
        tags: ['admin'],
        createdAt: new Date(1700000000000),
        updatedAt: new Date(1700000000000),
      });

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('LIMIT 1');
    });

    it('should return null when no results', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      const result = await query.first();

      expect(result).toBeNull();
    });
  });

  describe('count', () => {
    it('should return count without organization context', async () => {
      const mockRows = [{ count: 5 }];
      const mockCursor = new MockCursor(mockRows);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      const result = await query.count();

      expect(result).toBe(5);

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain(`SELECT COUNT(*) as count FROM "${tableName}" WHERE user_id = ?`);
      expect(callArgs[1]).toBe(mockUserId);
    });

    it('should return count with organization context', async () => {
      const mockRows = [{ count: 10 }];
      const mockCursor = new MockCursor(mockRows);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => mockOrganizationId
      );

      const result = await query.count();

      expect(result).toBe(10);

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain(`SELECT COUNT(*) as count FROM "${tableName}" WHERE user_id = ? AND organization_id = ?`);
      expect(callArgs[1]).toBe(mockUserId);
      expect(callArgs[2]).toBe(mockOrganizationId);
    });

    it('should return 0 when no results', async () => {
      const mockCursor = new MockCursor([]);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      const result = await query.count();

      expect(result).toBe(0);
    });

    it('should include WHERE conditions in count', async () => {
      const mockRows = [{ count: 3 }];
      const mockCursor = new MockCursor(mockRows);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      await query.where('age', '>', 18).count();

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      expect(callArgs[0]).toContain('AND (json_extract(data, \'$.age\') > ?)');
    });
  });

  describe('method chaining', () => {
    it('should support full method chaining', async () => {
      const mockRows = [
        {
          id: 'row-1',
          data: JSON.stringify({ name: 'John', email: 'john@example.com', age: 30, tags: ['admin'] }),
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ];
      const mockCursor = new MockCursor(mockRows);
      (mockStorage.sql.exec as jest.MockedFunction<any>).mockReturnValue(mockCursor);

      const query = new GenericQuery(
        tableName,
        mockStorage as unknown as DurableObjectStorage,
        mockSchema,
        mockUserId,
        () => undefined
      );

      const results = await query
        .where('age', '>', 18)
        .where('name', 'includes', 'John')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .offset(5)
        .get();

      expect(results).toHaveLength(1);

      const callArgs = (mockStorage.sql.exec as jest.MockedFunction<any>).mock.calls[0];
      const sql = callArgs[0];
      expect(sql).toContain('WHERE user_id = ?');
      expect(sql).toContain('json_extract(data, \'$.age\') > ?');
      expect(sql).toContain('json_extract(data, \'$.name\') LIKE ?');
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(sql).toContain('LIMIT 10');
      expect(sql).toContain('OFFSET 5');
    });
  });
});
