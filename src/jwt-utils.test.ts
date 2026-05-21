/**
 * Unit tests for src/jwt-utils.ts
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
  toBeGreaterThan: (expected: number) => void;
  toBeLessThan: (expected: number) => void;
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
  interface SpyInstance<T = any, Y = any> extends Function {
    (...args: Y[]): T;
    mockRestore: () => void;
    mockReturnValue: (value: T) => SpyInstance<T, Y>;
    mockResolvedValue: (value: T) => SpyInstance<T, Y>;
    mockRejectedValue: (value: any) => SpyInstance<T, Y>;
  }
}

// Mock the jwt module before importing jwt-utils
jest.mock('@tsndr/cloudflare-worker-jwt', () => {
  return {
    default: {
      sign: async (payload: any, secret: string) => {
        // Simple base64 encoding without Buffer
        const payloadStr = JSON.stringify(payload);
        const encoded = btoa(payloadStr);
        return `mocked.${encoded}.${secret}`;
      },
      verify: async (token: string, secret: string) => {
        if (token.includes('invalid')) return false;
        // Check if token was signed with the correct secret
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        if (parts[2] !== secret) return false;
        // Decode payload to check expiration
        try {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return false;
          }
        } catch {
          return false;
        }
        return true;
      },
      decode: (token: string) => {
        try {
          const parts = token.split('.');
          if (parts.length !== 3) return null;
          const payload = JSON.parse(atob(parts[1]));
          return { payload };
        } catch {
          return null;
        }
      }
    }
  };
});

import {
  decodeJWT,
  verifyJWT,
  hashEmailForId,
  isTokenExpired,
  getEmailFromToken,
  signJWT,
  generateAccessToken,
  generateRefreshToken,
  verifyTokens,
  generatePasswordResetToken,
  JwtPayload
} from './jwt-utils';

const TEST_SECRET = 'test-secret-key-12345';

describe('jwt-utils', () => {
  describe('decodeJWT', () => {
    it('should decode a valid JWT token', async () => {
      const payload = { sub: 'user123', email: 'test@example.com', exp: 9999999999 };
      const token = await signJWT(payload, TEST_SECRET);
      const decoded = decodeJWT(token);
      expect(decoded).toEqual(payload);
    });

    it('should return null for invalid token format', () => {
      expect(decodeJWT('invalid')).toBeNull();
      expect(decodeJWT('')).toBeNull();
      expect(decodeJWT('not.a.valid.jwt')).toBeNull();
    });

    it('should return null for malformed base64 payload', () => {
      expect(decodeJWT('header.!!!invalid!!!.signature')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(decodeJWT('')).toBeNull();
    });
  });

  describe('verifyJWT', () => {
    it('should verify a valid JWT token', async () => {
      const payload = { sub: 'user123', email: 'test@example.com', exp: 9999999999 };
      const token = await signJWT(payload, TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      expect(result.ok).toBe(true);
      expect(result.payload).toEqual(payload);
    });

    it('should fail verification with wrong secret', async () => {
      const payload = { sub: 'user123', email: 'test@example.com', exp: 9999999999 };
      const token = await signJWT(payload, TEST_SECRET);
      const result = await verifyJWT(token, 'wrong-secret');
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail verification for invalid token', async () => {
      const result = await verifyJWT('invalid.token.here', TEST_SECRET);
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail verification for expired token', async () => {
      const payload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) - 1000 };
      const token = await signJWT(payload, TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      expect(result.ok).toBe(false);
    });
  });

  describe('hashEmailForId', () => {
    it('should hash email to a consistent hex string', async () => {
      const email = 'test@example.com';
      const hash1 = await hashEmailForId(email);
      const hash2 = await hashEmailForId(email);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be case-insensitive', async () => {
      const hash1 = await hashEmailForId('Test@Example.com');
      const hash2 = await hashEmailForId('test@example.com');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different emails', async () => {
      const hash1 = await hashEmailForId('user1@example.com');
      const hash2 = await hashEmailForId('user2@example.com');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      const payload: JwtPayload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) - 1000 };
      expect(isTokenExpired(payload)).toBe(true);
    });

    it('should return false for non-expired token', () => {
      const payload: JwtPayload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };
      expect(isTokenExpired(payload)).toBe(false);
    });

    it('should return false when no exp is present', () => {
      const payload: JwtPayload = { sub: 'user123' };
      expect(isTokenExpired(payload)).toBe(false);
    });
  });

  describe('getEmailFromToken', () => {
    it('should extract email from valid token', async () => {
      const payload = { sub: 'user123', email: 'Test@Example.com', exp: 9999999999 };
      const token = await signJWT(payload, TEST_SECRET);
      const email = getEmailFromToken(token);
      expect(email).toBe('test@example.com');
    });

    it('should return null for token without email', async () => {
      const payload = { sub: 'user123', exp: 9999999999 };
      const token = await signJWT(payload, TEST_SECRET);
      const email = getEmailFromToken(token);
      expect(email).toBeNull();
    });

    it('should return null for invalid token', () => {
      const email = getEmailFromToken('invalid.token.here');
      expect(email).toBeNull();
    });
  });

  describe('signJWT', () => {
    it('should sign a JWT token with given payload', async () => {
      const payload: JwtPayload = { sub: 'user123', email: 'test@example.com' };
      const token = await signJWT(payload, TEST_SECRET);
      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should create verifiable token', async () => {
      const payload: JwtPayload = { sub: 'user123', exp: 9999999999 };
      const token = await signJWT(payload, TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      expect(result.ok).toBe(true);
      expect(result.payload?.sub).toBe('user123');
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', async () => {
      const token = await generateAccessToken('user123', 'test@example.com', TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      expect(result.ok).toBe(true);
      expect(result.payload?.sub).toBe('user123');
      expect(result.payload?.email).toBe('test@example.com');
    });

    it('should lowercase the email', async () => {
      const token = await generateAccessToken('user123', 'TEST@EXAMPLE.COM', TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      expect(result.payload?.email).toBe('test@example.com');
    });

    it('should set expiration correctly', async () => {
      const token = await generateAccessToken('user123', 'test@example.com', TEST_SECRET, 30);
      const result = await verifyJWT(token, TEST_SECRET);
      expect(result.payload?.exp).toBeDefined();
      const now = Math.floor(Date.now() / 1000);
      expect(result.payload!.exp!).toBeGreaterThan(now);
      expect(result.payload!.exp!).toBeLessThan(now + 30 * 60 + 10);
    });

    it('should use default 15 minutes expiration', async () => {
      const token = await generateAccessToken('user123', 'test@example.com', TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      const now = Math.floor(Date.now() / 1000);
      expect(result.payload!.exp!).toBeLessThan(now + 16 * 60);
      expect(result.payload!.exp!).toBeGreaterThan(now + 14 * 60);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', async () => {
      const token = await generateRefreshToken('user123', TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      expect(result.ok).toBe(true);
      expect(result.payload?.sub).toBe('user123');
      expect(result.payload?.type).toBe('refresh');
    });

    it('should set type to refresh', async () => {
      const token = await generateRefreshToken('user123', TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      expect(result.payload?.type).toBe('refresh');
    });

    it('should set expiration correctly', async () => {
      const token = await generateRefreshToken('user123', TEST_SECRET, 14);
      const result = await verifyJWT(token, TEST_SECRET);
      const now = Math.floor(Date.now() / 1000);
      expect(result.payload!.exp!).toBeGreaterThan(now + 13 * 24 * 60 * 60);
      expect(result.payload!.exp!).toBeLessThan(now + 15 * 24 * 60 * 60);
    });

    it('should use default 7 days expiration', async () => {
      const token = await generateRefreshToken('user123', TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      const now = Math.floor(Date.now() / 1000);
      expect(result.payload!.exp!).toBeGreaterThan(now + 6 * 24 * 60 * 60);
      expect(result.payload!.exp!).toBeLessThan(now + 8 * 24 * 60 * 60);
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate a valid password reset token', async () => {
      const token = await generatePasswordResetToken('user123', 'test@example.com', TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      expect(result.ok).toBe(true);
      expect(result.payload?.sub).toBe('user123');
      expect(result.payload?.email).toBe('test@example.com');
      expect(result.payload?.type).toBe('password_reset');
    });

    it('should lowercase the email', async () => {
      const token = await generatePasswordResetToken('user123', 'TEST@EXAMPLE.COM', TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      expect(result.payload?.email).toBe('test@example.com');
    });

    it('should set type to password_reset', async () => {
      const token = await generatePasswordResetToken('user123', 'test@example.com', TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      expect(result.payload?.type).toBe('password_reset');
    });

    it('should use default 60 minutes expiration', async () => {
      const token = await generatePasswordResetToken('user123', 'test@example.com', TEST_SECRET);
      const result = await verifyJWT(token, TEST_SECRET);
      const now = Math.floor(Date.now() / 1000);
      expect(result.payload!.exp!).toBeGreaterThan(now + 59 * 60);
      expect(result.payload!.exp!).toBeLessThan(now + 61 * 60);
    });
  });

  describe('verifyTokens', () => {
    it('should verify valid access token', async () => {
      const token = await generateAccessToken('user123', 'test@example.com', TEST_SECRET);
      const result = await verifyTokens(token, undefined, TEST_SECRET);
      expect(result.ok).toBe(true);
      expect(result.payload?.sub).toBe('user123');
      expect(result.newToken).toBeUndefined();
    });

    it('should refresh expired access token with valid refresh token', async () => {
      // Create expired access token
      const expiredPayload: JwtPayload = {
        sub: 'user123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) - 1000
      };
      const expiredToken = await signJWT(expiredPayload, TEST_SECRET);

      // Create valid refresh token
      const refreshToken = await generateRefreshToken('user123', TEST_SECRET);

      const result = await verifyTokens(expiredToken, refreshToken, TEST_SECRET);
      expect(result.ok).toBe(true);
      expect(result.payload?.sub).toBe('user123');
      expect(result.newToken).toBeDefined();
    });

    it('should fail when refresh token is not type refresh', async () => {
      const expiredPayload: JwtPayload = {
        sub: 'user123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) - 1000
      };
      const expiredToken = await signJWT(expiredPayload, TEST_SECRET);

      // Create an access token instead of refresh token
      const invalidRefreshToken = await generateAccessToken('user123', 'test@example.com', TEST_SECRET);

      const result = await verifyTokens(expiredToken, invalidRefreshToken, TEST_SECRET);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Invalid refresh token type');
    });

    it('should fail when access token has no email', async () => {
      const expiredPayload: JwtPayload = {
        sub: 'user123',
        exp: Math.floor(Date.now() / 1000) - 1000
      };
      const expiredToken = await signJWT(expiredPayload, TEST_SECRET);
      const refreshToken = await generateRefreshToken('user123', TEST_SECRET);

      const result = await verifyTokens(expiredToken, refreshToken, TEST_SECRET);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Cannot decode email from access token');
    });

    it('should fail with invalid refresh token', async () => {
      const expiredPayload: JwtPayload = {
        sub: 'user123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) - 1000
      };
      const expiredToken = await signJWT(expiredPayload, TEST_SECRET);

      const result = await verifyTokens(expiredToken, 'invalid.refresh.token', TEST_SECRET);
      expect(result.ok).toBe(false);
    });

    it('should fail when both tokens are invalid', async () => {
      const result = await verifyTokens('invalid.token', 'invalid.refresh', TEST_SECRET);
      expect(result.ok).toBe(false);
    });
  });
});
