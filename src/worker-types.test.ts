import {
  SignupRequestSchema,
  LoginRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  SetDataRequestSchema,
  AuthResponseSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
  DataResponseSchema,
  EventsResponseSchema,
} from './worker-types';

describe('worker-types schemas', () => {
  describe('SignupRequestSchema', () => {
    it('validates valid signup request', () => {
      const result = SignupRequestSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = SignupRequestSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects password shorter than 8 characters', () => {
      const result = SignupRequestSchema.safeParse({
        email: 'test@example.com',
        password: 'short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('LoginRequestSchema', () => {
    it('validates valid login request', () => {
      const result = LoginRequestSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = LoginRequestSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects password shorter than 8 characters', () => {
      const result = LoginRequestSchema.safeParse({
        email: 'test@example.com',
        password: 'short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('PasswordResetRequestSchema', () => {
    it('validates valid password reset request', () => {
      const result = PasswordResetRequestSchema.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = PasswordResetRequestSchema.safeParse({
        email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('PasswordResetConfirmSchema', () => {
    it('validates valid password reset confirm', () => {
      const result = PasswordResetConfirmSchema.safeParse({
        resetToken: 'token123',
        newPassword: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects new password shorter than 8 characters', () => {
      const result = PasswordResetConfirmSchema.safeParse({
        resetToken: 'token123',
        newPassword: 'short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SetDataRequestSchema', () => {
    it('validates valid set data request', () => {
      const result = SetDataRequestSchema.safeParse({
        key: 'mykey',
        value: 'myvalue',
      });
      expect(result.success).toBe(true);
    });

    it('validates with unknown value types', () => {
      const result1 = SetDataRequestSchema.safeParse({
        key: 'mykey',
        value: 123,
      });
      expect(result1.success).toBe(true);

      const result2 = SetDataRequestSchema.safeParse({
        key: 'mykey',
        value: { nested: 'object' },
      });
      expect(result2.success).toBe(true);
    });

    it('rejects missing key', () => {
      const result = SetDataRequestSchema.safeParse({
        value: 'myvalue',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('AuthResponseSchema', () => {
    it('validates valid auth response', () => {
      const result = AuthResponseSchema.safeParse({
        user: {
          id: 'user123',
          email: 'test@example.com',
          createdAt: '2024-01-01T00:00:00Z',
        },
        token: 'jwt-token',
        refreshToken: 'refresh-token',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing user fields', () => {
      const result = AuthResponseSchema.safeParse({
        user: {
          id: 'user123',
        },
        token: 'jwt-token',
        refreshToken: 'refresh-token',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ErrorResponseSchema', () => {
    it('validates valid error response', () => {
      const result = ErrorResponseSchema.safeParse({
        error: 'Something went wrong',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing error field', () => {
      const result = ErrorResponseSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('SuccessResponseSchema', () => {
    it('validates valid success response', () => {
      const result = SuccessResponseSchema.safeParse({
        ok: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects ok set to false', () => {
      const result = SuccessResponseSchema.safeParse({
        ok: false,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('DataResponseSchema', () => {
    it('validates valid data response', () => {
      const result = DataResponseSchema.safeParse({
        ok: true,
        data: { key: 'value' },
      });
      expect(result.success).toBe(true);
    });

    it('validates with various data types', () => {
      const result1 = DataResponseSchema.safeParse({
        ok: true,
        data: 'string',
      });
      expect(result1.success).toBe(true);

      const result2 = DataResponseSchema.safeParse({
        ok: true,
        data: 123,
      });
      expect(result2.success).toBe(true);
    });

    it('rejects ok set to false', () => {
      const result = DataResponseSchema.safeParse({
        ok: false,
        data: 'value',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('EventsResponseSchema', () => {
    it('validates valid events response', () => {
      const result = EventsResponseSchema.safeParse([
        {
          event: 'user.created',
          data: { id: 'user123' },
          timestamp: 1234567890,
        },
        {
          event: 'user.updated',
          data: null,
          timestamp: 1234567891,
        },
      ]);
      expect(result.success).toBe(true);
    });

    it('validates empty array', () => {
      const result = EventsResponseSchema.safeParse([]);
      expect(result.success).toBe(true);
    });

    it('rejects missing event fields', () => {
      const result = EventsResponseSchema.safeParse([
        {
          event: 'user.created',
        },
      ]);
      expect(result.success).toBe(false);
    });
  });
});
