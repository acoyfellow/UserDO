/**
 * Unit tests for src/server.ts
 * 
 * This file tests the exports from server.ts which re-exports:
 * - UserDO related exports from UserDO.js
 * - Database exports from database/index.js, table.js, query.js
 * - Client exports from client.js
 * - JWT utilities from jwt-utils.js
 * - Worker exports from worker.js
 * - Auth middleware from authMiddleware.js
 * - Worker types from worker-types.js
 */

// Jest type declarations for test file
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
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
  not: {
    toBe: (expected: any) => void;
    toEqual: (expected: any) => void;
    toBeNull: () => void;
    toBeUndefined: () => void;
  };
  toHaveBeenCalled: () => void;
  toHaveBeenCalledWith: (...args: any[]) => void;
  toThrow: (expected?: string | RegExp | Error) => void;
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
  }
  interface SpyInstance {
    mockRestore: () => void;
    mockImplementation: (impl: (...args: any[]) => any) => SpyInstance;
  }
}

// Helper functions for base64 encoding/decoding (avoiding Buffer dependency)
function toBase64(str: string): string {
  return btoa(str);
}

function fromBase64(str: string): string {
  return atob(str);
}

// Helper to create mock functions
function createMock<T extends (...args: any[]) => any>(impl?: T): jest.MockedFunction<T> {
  return jest.fn(impl) as jest.MockedFunction<T>;
}

// Import the server module
import {
  UserDO,
  getUserDO,
  hashEmailForId,
  migrateUserEmail,
  UserDODatabase,
  GenericTable,
  GenericQuery,
  UserDOClient,
  decodeJWT,
  verifyJWT,
  isTokenExpired,
  getEmailFromToken,
  signJWT,
  generateAccessToken,
  generateRefreshToken,
  generatePasswordResetToken,
  userDOWorker,
  createUserDOWorker,
  createWebSocketHandler,
  getUserDOFromContext,
  broadcastToUser,
  createAuthMiddleware,
} from './server';

import type { Env } from './server';

describe('server.ts exports', () => {
  it('should export UserDO class', () => {
    expect(UserDO).toBeDefined();
    expect(typeof UserDO).toBe('function');
  });

  it('should export getUserDO function', () => {
    expect(getUserDO).toBeDefined();
    expect(typeof getUserDO).toBe('function');
  });

  it('should export hashEmailForId function', () => {
    expect(hashEmailForId).toBeDefined();
    expect(typeof hashEmailForId).toBe('function');
  });

  it('should export migrateUserEmail function', () => {
    expect(migrateUserEmail).toBeDefined();
    expect(typeof migrateUserEmail).toBe('function');
  });

  it('should export UserDODatabase class', () => {
    expect(UserDODatabase).toBeDefined();
    expect(typeof UserDODatabase).toBe('function');
  });

  it('should export GenericTable class', () => {
    expect(GenericTable).toBeDefined();
    expect(typeof GenericTable).toBe('function');
  });

  it('should export GenericQuery class', () => {
    expect(GenericQuery).toBeDefined();
    expect(typeof GenericQuery).toBe('function');
  });

  it('should export UserDOClient class', () => {
    expect(UserDOClient).toBeDefined();
    expect(typeof UserDOClient).toBe('function');
  });

  it('should export JWT utility functions', () => {
    expect(decodeJWT).toBeDefined();
    expect(verifyJWT).toBeDefined();
    expect(isTokenExpired).toBeDefined();
    expect(getEmailFromToken).toBeDefined();
    expect(signJWT).toBeDefined();
    expect(generateAccessToken).toBeDefined();
    expect(generateRefreshToken).toBeDefined();
    expect(generatePasswordResetToken).toBeDefined();
  });

  it('should export worker utilities', () => {
    expect(userDOWorker).toBeDefined();
    expect(createUserDOWorker).toBeDefined();
    expect(createWebSocketHandler).toBeDefined();
    expect(getUserDOFromContext).toBeDefined();
    expect(broadcastToUser).toBeDefined();
  });

  it('should export createAuthMiddleware function', () => {
    expect(createAuthMiddleware).toBeDefined();
    expect(typeof createAuthMiddleware).toBe('function');
  });
});

describe('hashEmailForId', () => {
  it('should hash email to a consistent hex string', async () => {
    const email = 'test@example.com';
    const hash = await hashEmailForId(email);
    
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64); // SHA-256 produces 64 hex characters
    expect(hash).toMatch(/^[0-9a-f]+$/); // Should be valid hex
  });

  it('should produce the same hash for the same email (case insensitive)', async () => {
    const email1 = 'Test@Example.com';
    const email2 = 'test@example.com';
    const email3 = 'TEST@EXAMPLE.COM';

    const hash1 = await hashEmailForId(email1);
    const hash2 = await hashEmailForId(email2);
    const hash3 = await hashEmailForId(email3);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it('should produce different hashes for different emails', async () => {
    const hash1 = await hashEmailForId('user1@example.com');
    const hash2 = await hashEmailForId('user2@example.com');

    expect(hash1).not.toBe(hash2);
  });
});

describe('getUserDO', () => {
  it('should return a UserDO instance from namespace and email', () => {
    const mockDO = { id: 'mock-id' };
    const mockIdFromName = createMock().mockReturnValue('mock-id');
    const mockGet = createMock().mockReturnValue(mockDO);
    const mockNamespace = {
      idFromName: mockIdFromName,
      get: mockGet
    };

    const result = getUserDO(mockNamespace as any, 'test@example.com');

    expect(mockIdFromName).toHaveBeenCalledWith('test@example.com');
    expect(mockGet).toHaveBeenCalledWith('mock-id');
    expect(result).toBe(mockDO);
  });
});

describe('decodeJWT', () => {
  it('should decode a valid JWT payload', () => {
    const payload = { sub: '123', email: 'test@example.com', exp: 9999999999 };
    const header = toBase64(JSON.stringify({ alg: 'HS256' }));
    const payloadB64 = toBase64(JSON.stringify(payload));
    const signature = 'mock-signature';
    const token = `${header}.${payloadB64}.${signature}`;

    const result = decodeJWT(token);

    expect(result).toEqual(payload);
  });

  it('should return null for invalid JWT format', () => {
    expect(decodeJWT('invalid')).toBeNull();
    expect(decodeJWT('invalid.token')).toBeNull();
    expect(decodeJWT('')).toBeNull();
  });

  it('should return null for malformed JWT payload', () => {
    const token = 'header.notbase64.signature';
    expect(decodeJWT(token)).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('should return true for expired token', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 1000;
    expect(isTokenExpired({ sub: '123', exp: pastExp })).toBe(true);
  });

  it('should return false for non-expired token', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpired({ sub: '123', exp: futureExp })).toBe(false);
  });

  it('should return false for token without exp claim', () => {
    expect(isTokenExpired({ sub: '123' })).toBe(false);
  });
});

describe('getEmailFromToken', () => {
  it('should extract email from JWT', () => {
    const payload = { sub: '123', email: 'Test@Example.com' };
    const header = toBase64(JSON.stringify({ alg: 'HS256' }));
    const payloadB64 = toBase64(JSON.stringify(payload));
    const token = `${header}.${payloadB64}.signature`;

    const result = getEmailFromToken(token);

    expect(result).toBe('test@example.com');
  });

  it('should return null if no email in token', () => {
    const payload = { sub: '123' };
    const header = toBase64(JSON.stringify({ alg: 'HS256' }));
    const payloadB64 = toBase64(JSON.stringify(payload));
    const token = `${header}.${payloadB64}.signature`;

    expect(getEmailFromToken(token)).toBeNull();
  });

  it('should return null for invalid token', () => {
    expect(getEmailFromToken('invalid')).toBeNull();
  });
});

describe('signJWT', () => {
  it('should sign a JWT token', async () => {
    const payload = { sub: '123', email: 'test@example.com' };
    const secret = 'test-secret';

    const result = await signJWT(payload, secret);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});

describe('generateAccessToken', () => {
  it('should generate an access token with default expiration', async () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    const secret = 'test-secret';

    const result = await generateAccessToken(userId, email, secret);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should generate an access token with custom expiration', async () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    const secret = 'test-secret';
    const expiresInMinutes = 30;

    const result = await generateAccessToken(userId, email, secret, expiresInMinutes);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should lowercase email in token', async () => {
    const userId = 'user-123';
    const email = 'Test@Example.com';
    const secret = 'test-secret';

    const result = await generateAccessToken(userId, email, secret);

    expect(result).toBeDefined();
    // Decode to verify email is lowercased
    const decoded = decodeJWT(result);
    expect(decoded?.email).toBe('test@example.com');
  });
});

describe('generateRefreshToken', () => {
  it('should generate a refresh token with default expiration', async () => {
    const userId = 'user-123';
    const secret = 'test-secret';

    const result = await generateRefreshToken(userId, secret);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should generate a refresh token with custom expiration', async () => {
    const userId = 'user-123';
    const secret = 'test-secret';
    const expiresInDays = 14;

    const result = await generateRefreshToken(userId, secret, expiresInDays);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should include type: refresh in payload', async () => {
    const userId = 'user-123';
    const secret = 'test-secret';

    const result = await generateRefreshToken(userId, secret);

    const decoded = decodeJWT(result);
    expect(decoded?.type).toBe('refresh');
  });
});

describe('generatePasswordResetToken', () => {
  it('should generate a password reset token with default expiration', async () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    const secret = 'test-secret';

    const result = await generatePasswordResetToken(userId, email, secret);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should generate a password reset token with custom expiration', async () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    const secret = 'test-secret';
    const expiresInMinutes = 120;

    const result = await generatePasswordResetToken(userId, email, secret, expiresInMinutes);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should include type: password_reset in payload', async () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    const secret = 'test-secret';

    const result = await generatePasswordResetToken(userId, email, secret);

    const decoded = decodeJWT(result);
    expect(decoded?.type).toBe('password_reset');
  });

  it('should lowercase email in token', async () => {
    const userId = 'user-123';
    const email = 'Test@Example.com';
    const secret = 'test-secret';

    const result = await generatePasswordResetToken(userId, email, secret);

    const decoded = decodeJWT(result);
    expect(decoded?.email).toBe('test@example.com');
  });
});

describe('UserDODatabase', () => {
  it('should be constructable', () => {
    const mockStorage = {
      sql: {
        exec: createMock()
      }
    } as any;

    const db = new UserDODatabase(mockStorage, 'user-123');
    expect(db).toBeDefined();
  });

  it('should create a table', async () => {
    const z = await import('zod');
    const mockStorage = {
      sql: {
        exec: createMock()
      }
    } as any;

    const db = new UserDODatabase(mockStorage, 'user-123');
    const table = db.table('test_table', z.z.object({ name: z.z.string() }));

    expect(table).toBeDefined();
  });

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
});

describe('createAuthMiddleware', () => {
  it('should return a middleware function', () => {
    const getUserDO = createMock();
    const middleware = createAuthMiddleware(getUserDO);

    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe('function');
  });

  it('should accept optional logPrefix parameter', () => {
    const getUserDO = createMock();
    const middleware = createAuthMiddleware(getUserDO, 'test-prefix');

    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe('function');
  });
});

describe('createUserDOWorker', () => {
  it('should return a Hono app', () => {
    const app = createUserDOWorker();
    expect(app).toBeDefined();
  });

  it('should accept optional bindingName parameter', () => {
    const app = createUserDOWorker('CUSTOM_BINDING');
    expect(app).toBeDefined();
  });
});

describe('createWebSocketHandler', () => {
  it('should return an object with fetch method', () => {
    const handler = createWebSocketHandler();
    expect(handler).toBeDefined();
    expect(typeof handler.fetch).toBe('function');
  });

  it('should accept optional bindingName parameter', () => {
    const handler = createWebSocketHandler('CUSTOM_BINDING');
    expect(handler).toBeDefined();
    expect(typeof handler.fetch).toBe('function');
  });
});

describe('getUserDOFromContext', () => {
  it('should return UserDO from context', () => {
    const mockDO = { id: 'mock-id' };
    const mockIdFromName = createMock().mockReturnValue('mock-id');
    const mockGet = createMock().mockReturnValue(mockDO);
    const mockEnv = {
      USERDO: {
        idFromName: mockIdFromName,
        get: mockGet
      }
    };
    const mockContext = {
      env: mockEnv,
      req: { url: 'http://test.com' }
    } as any;

    const result = getUserDOFromContext(mockContext, 'test@example.com');

    expect(mockIdFromName).toHaveBeenCalledWith('test@example.com');
    expect(mockGet).toHaveBeenCalledWith('mock-id');
    expect(result).toBe(mockDO);
  });

  it('should use custom bindingName', () => {
    const mockDO = { id: 'mock-id' };
    const mockIdFromName = createMock().mockReturnValue('mock-id');
    const mockGet = createMock().mockReturnValue(mockDO);
    const mockEnv = {
      CUSTOM_BINDING: {
        idFromName: mockIdFromName,
        get: mockGet
      }
    };
    const mockContext = {
      env: mockEnv,
      req: { url: 'http://test.com' }
    } as any;

    const result = getUserDOFromContext(mockContext, 'test@example.com', 'CUSTOM_BINDING');

    expect(result).toBe(mockDO);
  });

  it('should throw error if binding not found', () => {
    const mockEnv = {};
    const mockContext = {
      env: mockEnv,
      req: { url: 'http://test.com' }
    } as any;

    expect(() => {
      getUserDOFromContext(mockContext, 'test@example.com');
    }).toThrow("Durable Object binding 'USERDO' not found");
  });
});

describe('broadcastToUser', () => {
  it('should broadcast message to user DO', () => {
    const mockBroadcast = createMock().mockResolvedValue(undefined);
    const mockIdFromName = createMock().mockReturnValue('mock-id');
    const mockGet = createMock().mockReturnValue({
      broadcast: mockBroadcast
    });
    const mockEnv = {
      USERDO: {
        idFromName: mockIdFromName,
        get: mockGet
      }
    };

    broadcastToUser('test@example.com', { event: 'test', data: {} }, 'USERDO', mockEnv);

    expect(mockIdFromName).toHaveBeenCalledWith('test@example.com');
    expect(mockGet).toHaveBeenCalledWith('mock-id');
  });

  it('should handle missing binding gracefully', () => {
    const mockEnv = {};
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    broadcastToUser('test@example.com', { event: 'test', data: {} }, 'USERDO', mockEnv);

    expect(consoleErrorSpy).toHaveBeenCalledWith("Durable Object binding 'USERDO' not found");
    consoleErrorSpy.mockRestore();
  });
});

describe('migrateUserEmail', () => {
  it('should migrate user email successfully', async () => {
    const mockOldDO = {
      raw: createMock().mockResolvedValue({ email: 'old@example.com', id: '123', passwordHash: 'hash', salt: 'salt', createdAt: '2024-01-01', refreshTokens: [] }),
      deleteUser: createMock().mockResolvedValue({ ok: true })
    };
    const mockNewDO = {
      init: createMock().mockResolvedValue({ ok: true })
    };

    const mockEnv = {
      USERDO: {
        idFromName: createMock((email: string) => email),
        get: createMock((id: string) => id === 'old@example.com' ? mockOldDO : mockNewDO)
      }
    } as any;

    const result = await migrateUserEmail({
      env: mockEnv,
      oldEmail: 'old@example.com',
      newEmail: 'new@example.com'
    });

    expect(result.ok).toBe(true);
    expect(mockNewDO.init).toHaveBeenCalled();
    expect(mockOldDO.deleteUser).toHaveBeenCalled();
  });

  it('should handle migration errors', async () => {
    const mockOldDO = {
      raw: createMock().mockRejectedValue(new Error('User not found'))
    };

    const mockEnv = {
      USERDO: {
        idFromName: createMock((email: string) => email),
        get: createMock(() => mockOldDO)
      }
    } as any;

    const result = await migrateUserEmail({
      env: mockEnv,
      oldEmail: 'old@example.com',
      newEmail: 'new@example.com'
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('userDOWorker', () => {
  it('should be defined', () => {
    expect(userDOWorker).toBeDefined();
  });
});
