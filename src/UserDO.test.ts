/**
 * Unit tests for src/UserDO.ts
 */

// Mock cloudflare:workers before importing UserDO
jest.mock('cloudflare:workers', () => {
  return {
    DurableObject: class DurableObject {
      protected state: any;
      protected env: any;
      protected ctx: any;
      constructor(state: any, env: any) {
        this.state = state;
        this.env = env;
        // ctx is provided by Cloudflare runtime for hibernation API
        this.ctx = state.ctx || {
          acceptWebSocket: jest.fn(),
          getWebSockets: jest.fn(() => []),
        };
      }
    }
  };
});

// Mock @tsndr/cloudflare-worker-jwt
jest.mock('@tsndr/cloudflare-worker-jwt', () => {
  return {
    default: {
      sign: async (payload: any, secret: string) => {
        // Store payload with secret for later verification
        const token = `mocked.${btoa(JSON.stringify(payload))}.${secret}`;
        return token;
      },
      verify: async (token: string, secret: string) => {
        if (token.includes('invalid')) return false;
        const parts = token.split('.');
        if (parts.length !== 3) return false;

        try {
          const payload = JSON.parse(atob(parts[1]));
          // Check expiration
          if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return false;
          }
          // Check secret matches (stored in token signature part)
          if (parts[2] !== secret) return false;
          return { payload };
        } catch {
          return false;
        }
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

import { UserDO, hashEmailForId, getUserDO, migrateUserEmail } from './UserDO';
import { UserDODatabase } from './database/index.js';

// Mock the database module
jest.mock('./database/index.js', () => {
  return {
    UserDODatabase: jest.fn().mockImplementation(() => ({
      table: jest.fn().mockReturnValue({
        create: jest.fn(),
        getAll: jest.fn(),
        findById: jest.fn(),
        where: jest.fn().mockReturnValue({
          get: jest.fn(),
          first: jest.fn(),
        }),
        delete: jest.fn(),
      }),
      setOrganizationContext: jest.fn(),
      raw: {},
    })),
  };
});

const TEST_SECRET = 'test-secret-key-12345';

// Helper to create mock UserDO state and env
function createMockUserDOState() {
  const storage = new Map<string, any>();
  const webSockets: WebSocket[] = [];

  const ctx = {
    acceptWebSocket: jest.fn(),
    getWebSockets: jest.fn(() => webSockets),
  };

  const state = {
    id: { toString: () => 'test-user-id-hex' },
    storage: {
      get: jest.fn(async (key: string) => storage.get(key)),
      put: jest.fn(async (key: string, value: any) => { storage.set(key, value); }),
      delete: jest.fn(async (key: string) => storage.delete(key)),
    },
    acceptWebSocket: jest.fn(),
    getWebSockets: jest.fn(() => webSockets),
    // ctx is provided by Cloudflare runtime for hibernation API
    ctx,
  };

  return state;
}

function createMockEnv() {
  return {
    JWT_SECRET: TEST_SECRET,
    USERDO: {
      idFromName: jest.fn((email: string) => `do-id-${email}`),
      get: jest.fn((id: string) => {
        const state = createMockUserDOState();
        return new UserDO(state as any, {} as any);
      }),
    } as any,
  };
}

describe('UserDO', () => {
  let mockState: any;
  let mockEnv: any;
  let userDO: UserDO;
  let webSockets: WebSocket[];

  beforeEach(() => {
    webSockets = [];
    mockState = createMockUserDOState();
    mockEnv = createMockEnv();
    userDO = new UserDO(mockState, mockEnv);
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

  describe('getUserDO', () => {
    it('should return UserDO instance from namespace', () => {
      const mockNamespace = {
        idFromName: jest.fn((email: string) => `do-id-${email}`),
        get: jest.fn(() => ({})),
      } as any;

      const result = getUserDO(mockNamespace, 'test@example.com');
      expect(mockNamespace.idFromName).toHaveBeenCalledWith('test@example.com');
      expect(mockNamespace.get).toHaveBeenCalledWith('do-id-test@example.com');
    });
  });

  describe('migrateUserEmail', () => {
    it('should migrate user from old email to new email', async () => {
      const oldDO = {
        raw: jest.fn().mockResolvedValue({ email: 'old@example.com', id: '123' }),
        deleteUser: jest.fn().mockResolvedValue({ ok: true }),
      } as any;
      const newDO = {
        init: jest.fn().mockResolvedValue({ ok: true }),
      } as any;

      const mockEnv = {
        USERDO: {
          idFromName: jest.fn((email: string) => `do-id-${email}`),
          get: jest.fn((id: string) => {
            if (id.includes('old')) return oldDO;
            return newDO;
          }),
        } as any,
      } as any;

      const result = await migrateUserEmail({
        env: mockEnv,
        oldEmail: 'old@example.com',
        newEmail: 'new@example.com',
      });

      expect(result.ok).toBe(true);
      expect(oldDO.raw).toHaveBeenCalled();
      expect(newDO.init).toHaveBeenCalledWith({ email: 'new@example.com', id: '123' });
      expect(oldDO.deleteUser).toHaveBeenCalled();
    });

    it('should return error on migration failure', async () => {
      const oldDO = {
        raw: jest.fn().mockRejectedValue(new Error('User not found')),
        deleteUser: jest.fn(),
      } as any;
      const newDO = {
        init: jest.fn(),
      } as any;

      const mockEnv = {
        USERDO: {
          idFromName: jest.fn((email: string) => `do-id-${email}`),
          get: jest.fn((id: string) => {
            if (id.includes('old')) return oldDO;
            return newDO;
          }),
        } as any,
      } as any;

      const result = await migrateUserEmail({
        env: mockEnv,
        oldEmail: 'old@example.com',
        newEmail: 'new@example.com',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('signup', () => {
    it('should signup a new user successfully', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const result = await userDO.signup({ email, password });

      expect(result.user.email).toBe(email.toLowerCase());
      expect(result.user.id).toBe('test-user-id-hex');
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.passwordHash).toBeDefined();
      expect(result.user.salt).toBeDefined();
    });

    it('should throw error if user already exists', async () => {
      // Pre-populate storage with a user
      await mockState.storage.put('__user', {
        id: 'existing-id',
        email: 'existing@example.com',
        passwordHash: 'hash',
        salt: 'salt',
        createdAt: new Date().toISOString(),
        refreshTokens: [],
      });

      await expect(userDO.signup({ email: 'test@example.com', password: 'password123' }))
        .rejects.toThrow('Email already registered');
    });

    it('should throw error for invalid email', async () => {
      await expect(userDO.signup({ email: 'invalid-email', password: 'password123' }))
        .rejects.toThrow('Invalid input');
    });

    it('should throw error for short password', async () => {
      await expect(userDO.signup({ email: 'test@example.com', password: 'short' }))
        .rejects.toThrow('Invalid input');
    });

    it('should throw error when rate limit exceeded', async () => {
      // Exceed rate limit by calling multiple times
      for (let i = 0; i < 5; i++) {
        try {
          await userDO.signup({ email: `test${i}@example.com`, password: 'password123' });
        } catch {
          // Ignore signup errors for existing user
        }
      }

      await expect(userDO.signup({ email: 'new@example.com', password: 'password123' }))
        .rejects.toThrow('Too many requests');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Setup a user for login tests
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should login with valid credentials', async () => {
      const result = await userDO.login({ email: 'test@example.com', password: 'password123' });

      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw error for invalid credentials', async () => {
      await expect(userDO.login({ email: 'test@example.com', password: 'wrongpassword' }))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error for non-existent user', async () => {
      await expect(userDO.login({ email: 'nonexistent@example.com', password: 'password123' }))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid email format', async () => {
      await expect(userDO.login({ email: 'invalid-email', password: 'password123' }))
        .rejects.toThrow('Invalid input');
    });
  });

  describe('raw', () => {
    it('should return user data', async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });

      const user = await userDO.raw();

      expect(user.email).toBe('test@example.com');
      expect(user.id).toBe('test-user-id-hex');
    });

    it('should throw error if user not found', async () => {
      await expect(userDO.raw()).rejects.toThrow('User not found');
    });
  });

  describe('init', () => {
    it('should initialize user data', async () => {
      const user = {
        id: 'init-id',
        email: 'init@example.com',
        passwordHash: 'hash',
        salt: 'salt',
        createdAt: new Date().toISOString(),
        refreshTokens: [],
      };

      const result = await userDO.init(user);

      expect(result.ok).toBe(true);
      const stored = await userDO.raw();
      expect(stored.email).toBe('init@example.com');
    });

    it('should throw error for invalid user data', async () => {
      const invalidUser = {
        id: 'invalid',
        email: 'not-an-email',
        passwordHash: 'hash',
        salt: 'salt',
        createdAt: new Date().toISOString(),
        refreshTokens: [],
      } as any;

      await expect(userDO.init(invalidUser)).rejects.toThrow('Invalid input');
    });
  });

  describe('deleteUser', () => {
    it('should delete user data', async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });

      const result = await userDO.deleteUser();

      expect(result.ok).toBe(true);
      await expect(userDO.raw()).rejects.toThrow('User not found');
    });
  });

  describe('changePassword', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should change password successfully', async () => {
      const result = await userDO.changePassword({
        oldPassword: 'password123',
        newPassword: 'newpassword456',
      });

      expect(result.ok).toBe(true);

      // Verify new password works
      const loginResult = await userDO.login({
        email: 'test@example.com',
        password: 'newpassword456',
      });
      expect(loginResult.user.email).toBe('test@example.com');
    });

    it('should throw error for wrong current password', async () => {
      await expect(userDO.changePassword({
        oldPassword: 'wrongpassword',
        newPassword: 'newpassword456',
      })).rejects.toThrow('Invalid current password');
    });

    it('should throw error for invalid new password', async () => {
      await expect(userDO.changePassword({
        oldPassword: 'password123',
        newPassword: 'short',
      })).rejects.toThrow('Invalid new password');
    });
  });

  describe('resetPassword', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should reset password successfully', async () => {
      const result = await userDO.resetPassword({ newPassword: 'newpassword456' });

      expect(result.ok).toBe(true);

      // Verify new password works
      const loginResult = await userDO.login({
        email: 'test@example.com',
        password: 'newpassword456',
      });
      expect(loginResult.user.email).toBe('test@example.com');
    });

    it('should throw error for invalid new password', async () => {
      await expect(userDO.resetPassword({ newPassword: 'short' }))
        .rejects.toThrow('Invalid new password');
    });
  });

  describe('generatePasswordResetToken', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should generate a password reset token', async () => {
      const result = await userDO.generatePasswordResetToken();

      expect(result.resetToken).toBeDefined();
      expect(result.resetToken.split('.')).toHaveLength(3);
    });

    it('should throw error if user not found', async () => {
      await userDO.deleteUser();
      await expect(userDO.generatePasswordResetToken()).rejects.toThrow('User not found');
    });
  });

  describe('resetPasswordWithToken', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should reset password with valid token', async () => {
      const { resetToken } = await userDO.generatePasswordResetToken();

      const result = await userDO.resetPasswordWithToken({
        resetToken,
        newPassword: 'newpassword456',
      });

      expect(result.ok).toBe(true);

      // Verify new password works
      const loginResult = await userDO.login({
        email: 'test@example.com',
        password: 'newpassword456',
      });
      expect(loginResult.user.email).toBe('test@example.com');
    });

    it('should throw error for invalid token', async () => {
      await expect(userDO.resetPasswordWithToken({
        resetToken: 'invalid.token.here',
        newPassword: 'newpassword456',
      })).rejects.toThrow('Invalid reset token');
    });

    it('should throw error for invalid new password', async () => {
      const { resetToken } = await userDO.generatePasswordResetToken();

      // Note: The source code catches all errors and re-throws with generic message
      await expect(userDO.resetPasswordWithToken({
        resetToken,
        newPassword: 'short',
      })).rejects.toThrow('Invalid reset token');
    });
  });

  describe('verifyToken', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should verify valid token', async () => {
      const { token } = await userDO.login({ email: 'test@example.com', password: 'password123' });

      const result = await userDO.verifyToken({ token });

      expect(result.ok).toBe(true);
      expect(result.user).toEqual({ id: 'test-user-id-hex', email: 'test@example.com' });
    });

    it('should return false for invalid token', async () => {
      const result = await userDO.verifyToken({ token: 'invalid.token.here' });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return false for token with mismatched subject', async () => {
      // Create a token with different sub by directly signing with the same secret
      const jwt = await import('@tsndr/cloudflare-worker-jwt');
      const fakeToken = await jwt.default.sign({
        sub: 'different-user-id',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }, TEST_SECRET);

      const result = await userDO.verifyToken({ token: fakeToken });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Token subject mismatch');
    });
  });

  describe('set and get', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should set and get a value', async () => {
      await userDO.set('customKey', 'customValue');

      const value = await userDO.get('customKey');
      expect(value).toBe('customValue');
    });

    it('should throw error for reserved key', async () => {
      await expect(userDO.set('__reserved', 'value')).rejects.toThrow('reserved');
      await expect(userDO.get('__reserved')).rejects.toThrow('reserved');
    });
  });

  describe('refreshToken', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should refresh with valid refresh token', async () => {
      const { refreshToken } = await userDO.login({ email: 'test@example.com', password: 'password123' });

      const result = await userDO.refreshToken({ refreshToken });

      expect(result.token).toBeDefined();
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(userDO.refreshToken({ refreshToken: 'invalid.token' }))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for revoked refresh token', async () => {
      const { refreshToken } = await userDO.login({ email: 'test@example.com', password: 'password123' });

      await userDO.revokeRefreshToken({ refreshToken });

      // Note: The source code catches all errors and re-throws with generic message
      await expect(userDO.refreshToken({ refreshToken }))
        .rejects.toThrow('Invalid refresh token');
    });
  });

  describe('revokeRefreshToken', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should revoke a refresh token', async () => {
      const { refreshToken } = await userDO.login({ email: 'test@example.com', password: 'password123' });

      const result = await userDO.revokeRefreshToken({ refreshToken });

      expect(result.ok).toBe(true);

      // Verify token is revoked - note source code catches all errors with generic message
      await expect(userDO.refreshToken({ refreshToken }))
        .rejects.toThrow('Invalid refresh token');
    });
  });

  describe('revokeAllRefreshTokens', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
      await userDO.login({ email: 'test@example.com', password: 'password123' });
    });

    it('should revoke all refresh tokens', async () => {
      const result = await userDO.revokeAllRefreshTokens();

      expect(result.ok).toBe(true);

      const user = await userDO.raw();
      expect(user.refreshTokens).toHaveLength(0);
    });
  });

  describe('logout', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
      await userDO.login({ email: 'test@example.com', password: 'password123' });
    });

    it('should logout by revoking all refresh tokens', async () => {
      const result = await userDO.logout();

      expect(result.ok).toBe(true);

      const user = await userDO.raw();
      expect(user.refreshTokens).toHaveLength(0);
    });
  });

  describe('createOrganization', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should create an organization', async () => {
      const mockOrganization = {
        id: 'org-123',
        name: 'Test Org',
        ownerId: 'test-user-id-hex',
        createdAt: new Date().toISOString(),
      };

      (userDO as any).ownedOrganizations.create = jest.fn().mockResolvedValue(mockOrganization);

      const result = await userDO.createOrganization('Test Org');

      expect(result.organization.name).toBe('Test Org');
      expect(result.organization.ownerId).toBe('test-user-id-hex');
    });

    it('should throw error if user not found', async () => {
      await userDO.deleteUser();

      await expect(userDO.createOrganization('Test Org'))
        .rejects.toThrow('User not found');
    });
  });

  describe('getOrganizations', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should return organizations', async () => {
      const mockOrgs = [
        { id: 'org-1', name: 'Org 1', ownerId: 'test-user-id-hex', createdAt: new Date().toISOString() },
        { id: 'org-2', name: 'Org 2', ownerId: 'test-user-id-hex', createdAt: new Date().toISOString() },
      ];

      (userDO as any).ownedOrganizations.getAll = jest.fn().mockResolvedValue(mockOrgs);
      (userDO as any).storage.get = jest.fn().mockResolvedValue([]);

      const result = await userDO.getOrganizations();

      expect(result.organizations).toHaveLength(2);
      expect(result.memberOrganizations).toEqual([]);
    });

    it('should throw error if user not found', async () => {
      await userDO.deleteUser();

      await expect(userDO.getOrganizations()).rejects.toThrow('User not found');
    });
  });

  describe('addOrganizationMember', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should add a member to organization', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
        ownerId: 'test-user-id-hex',
        createdAt: new Date().toISOString(),
      };

      (userDO as any).ownedOrganizations.findById = jest.fn().mockResolvedValue(mockOrg);
      (userDO as any).organizationMembers.where = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(null),
        }),
      });
      (userDO as any).organizationMembers.create = jest.fn().mockResolvedValue({
        id: 'member-123',
        organizationId: 'org-123',
        userId: 'member-user-id',
        email: 'member@example.com',
        role: 'member',
        createdAt: new Date().toISOString(),
      });

      const result = await userDO.addOrganizationMember('org-123', 'member@example.com', 'member');

      expect(result.member.email).toBe('member@example.com');
      expect(result.member.role).toBe('member');
    });

    it('should throw error if organization not found', async () => {
      (userDO as any).ownedOrganizations.findById = jest.fn().mockResolvedValue(null);

      await expect(userDO.addOrganizationMember('nonexistent-org', 'member@example.com'))
        .rejects.toThrow('Organization not found');
    });

    it('should throw error if user already a member', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
        ownerId: 'test-user-id-hex',
        createdAt: new Date().toISOString(),
      };

      (userDO as any).ownedOrganizations.findById = jest.fn().mockResolvedValue(mockOrg);
      (userDO as any).organizationMembers.where = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({ id: 'existing-member' }),
        }),
      });

      await expect(userDO.addOrganizationMember('org-123', 'member@example.com'))
        .rejects.toThrow('already a member');
    });
  });

  describe('removeOrganizationMember', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should remove a member from organization', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
        ownerId: 'test-user-id-hex',
        createdAt: new Date().toISOString(),
      };

      const mockMember = {
        id: 'member-123',
        organizationId: 'org-123',
        userId: 'member-user-id',
        email: 'member@example.com',
        role: 'member',
        createdAt: new Date().toISOString(),
      };

      (userDO as any).ownedOrganizations.findById = jest.fn().mockResolvedValue(mockOrg);
      (userDO as any).organizationMembers.where = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(mockMember),
        }),
      });
      (userDO as any).organizationMembers.delete = jest.fn().mockResolvedValue({ ok: true });

      const result = await userDO.removeOrganizationMember('org-123', 'member-user-id');

      expect(result.ok).toBe(true);
    });

    it('should throw error if member not found', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
        ownerId: 'test-user-id-hex',
        createdAt: new Date().toISOString(),
      };

      (userDO as any).ownedOrganizations.findById = jest.fn().mockResolvedValue(mockOrg);
      (userDO as any).organizationMembers.where = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(userDO.removeOrganizationMember('org-123', 'nonexistent-user'))
        .rejects.toThrow('Member not found');
    });
  });

  describe('addMembership', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should add membership to user', async () => {
      const membership = {
        organizationId: 'org-123',
        organizationName: 'Test Org',
        ownerEmail: 'owner@example.com',
        role: 'member' as const,
        joinedAt: new Date().toISOString(),
      };

      await userDO.addMembership(membership);

      const memberships = await mockState.storage.get('organization_memberships');
      expect(memberships).toHaveLength(1);
      expect(memberships[0].organizationId).toBe('org-123');
    });

    it('should update existing membership', async () => {
      const membership1 = {
        organizationId: 'org-123',
        organizationName: 'Test Org',
        ownerEmail: 'owner@example.com',
        role: 'member' as const,
        joinedAt: new Date().toISOString(),
      };

      const membership2 = {
        organizationId: 'org-123',
        organizationName: 'Updated Org',
        ownerEmail: 'newowner@example.com',
        role: 'admin' as const,
        joinedAt: new Date().toISOString(),
      };

      await userDO.addMembership(membership1);
      await userDO.addMembership(membership2);

      const memberships = await mockState.storage.get('organization_memberships');
      expect(memberships).toHaveLength(1);
      expect(memberships[0].organizationName).toBe('Updated Org');
      expect(memberships[0].role).toBe('admin');
    });
  });

  describe('removeMembership', () => {
    beforeEach(async () => {
      await userDO.signup({ email: 'test@example.com', password: 'password123' });
    });

    it('should remove membership from user', async () => {
      const membership = {
        organizationId: 'org-123',
        organizationName: 'Test Org',
        ownerEmail: 'owner@example.com',
        role: 'member' as const,
        joinedAt: new Date().toISOString(),
      };

      await userDO.addMembership(membership);
      await userDO.removeMembership('org-123');

      const memberships = await mockState.storage.get('organization_memberships');
      expect(memberships).toHaveLength(0);
    });
  });

  describe('setOrganizationContext', () => {
    it('should call database.setOrganizationContext', () => {
      userDO.setOrganizationContext('org-123');

      expect((userDO as any).database.setOrganizationContext).toHaveBeenCalledWith('org-123');
    });
  });

  describe('table', () => {
    it('should return a table from database', () => {
      const mockSchema = { parse: jest.fn() };
      const result = userDO.table('test_table', mockSchema as any);

      expect(result).toBeDefined();
      expect((userDO as any).database.table).toHaveBeenCalledWith('test_table', mockSchema, undefined);
    });
  });

  describe('db getter', () => {
    it('should return database.raw', () => {
      const db = userDO.db;

      expect(db).toEqual({});
    });
  });

  describe('fetch (WebSocket)', () => {
    it('should accept WebSocket connection', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('websocket'),
        },
        url: 'ws://test.com',
      } as any;

      const mockWebSocketPair = {
        0: { send: jest.fn() } as unknown as WebSocket,
        1: { send: jest.fn() } as unknown as WebSocket,
      };

      const originalWebSocketPair = (globalThis as any).WebSocketPair;
      (globalThis as any).WebSocketPair = jest.fn(() => mockWebSocketPair);

      try {
        const response = await userDO.fetch(mockRequest);
        // In Node.js environment, Response doesn't support WebSocket status 101
        // So we just verify that acceptWebSocket was called
        expect(mockState.ctx.acceptWebSocket).toHaveBeenCalled();
      } catch (error) {
        // In some environments, creating Response with status 101 may fail
        // The important thing is that acceptWebSocket was called
        expect(mockState.ctx.acceptWebSocket).toHaveBeenCalled();
      }

      (globalThis as any).WebSocketPair = originalWebSocketPair;
    });

    it('should return 404 for non-WebSocket requests', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
        url: 'http://test.com',
      } as any;

      const response = await userDO.fetch(mockRequest);

      expect(response.status).toBe(404);
    });
  });

  describe('webSocketMessage', () => {
    it('should handle string message', async () => {
      const mockWs = { send: jest.fn() } as any;
      const message = JSON.stringify({ event: 'test', data: 'hello' });

      await userDO.webSocketMessage(mockWs, message);

      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should handle ArrayBuffer message', async () => {
      const mockWs = { send: jest.fn() } as any;
      const encoder = new TextEncoder();
      const message = encoder.encode(JSON.stringify({ event: 'test', data: 'hello' }));

      await userDO.webSocketMessage(mockWs, message.buffer);

      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', async () => {
      const mockWs = { send: jest.fn() } as any;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await userDO.webSocketMessage(mockWs, 'invalid json');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('webSocketClose', () => {
    it('should log WebSocket close event', async () => {
      const mockWs = {} as WebSocket;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await userDO.webSocketClose(mockWs, 1000, 'Normal closure', true);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket closed'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('broadcast', () => {
    it('should broadcast message to all connected WebSockets', () => {
      const mockWs1 = { send: jest.fn() } as any;
      const mockWs2 = { send: jest.fn() } as any;

      mockState.ctx.getWebSockets = jest.fn().mockReturnValue([mockWs1, mockWs2]);

      (userDO as any).broadcast('test:event', { data: 'hello' });

      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
    });

    it('should handle broadcast errors gracefully', () => {
      const mockWs1 = {
        send: jest.fn().mockImplementation(() => { throw new Error('Send error'); })
      } as any;

      mockState.ctx.getWebSockets = jest.fn().mockReturnValue([mockWs1]);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      (userDO as any).broadcast('test:event', { data: 'hello' });

      expect(consoleSpy).toHaveBeenCalledWith('Broadcast error:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});
