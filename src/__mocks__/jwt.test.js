const jwt = require('./jwt');

describe('jwt mock', () => {
  describe('sign', () => {
    it('should sign payload and return mocked token', async () => {
      const payload = { userId: 123, email: 'test@example.com' };
      const secret = 'my-secret';

      const result = await jwt.default.sign(payload, secret);

      expect(result).toMatch(/^mocked\..+\..+$/);
    });

    it('should encode payload as base64 in the token', async () => {
      const payload = { userId: 123 };
      const secret = 'secret';

      const result = await jwt.default.sign(payload, secret);

      const parts = result.split('.');
      const decodedPayload = Buffer.from(parts[1], 'base64').toString();
      expect(JSON.parse(decodedPayload)).toEqual(payload);
    });

    it('should include secret as the third part of the token', async () => {
      const payload = { data: 'test' };
      const secret = 'my-secret-key';

      const result = await jwt.default.sign(payload, secret);

      const parts = result.split('.');
      expect(parts[2]).toBe(secret);
    });
  });

  describe('verify', () => {
    it('should return true for valid token', async () => {
      const token = 'mocked.eyJ1c2VySWQiOjEyM30.secret';

      const result = await jwt.default.verify(token, 'secret');

      expect(result).toBe(true);
    });

    it('should return false for token containing "invalid"', async () => {
      const token = 'invalid.token.here';

      const result = await jwt.default.verify(token, 'secret');

      expect(result).toBe(false);
    });

    it('should return true for any token without "invalid" string', async () => {
      const token = 'any.random.token';

      const result = await jwt.default.verify(token, 'secret');

      expect(result).toBe(true);
    });
  });

  describe('decode', () => {
    it('should decode valid token and return payload', () => {
      const payload = { userId: 123, role: 'admin' };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const token = `mocked.${encodedPayload}.secret`;

      const result = jwt.default.decode(token);

      expect(result).toEqual({ payload });
    });

    it('should return null for token without 3 parts', () => {
      const token = 'invalid.token';

      const result = jwt.default.decode(token);

      expect(result).toBe(null);
    });

    it('should return null for malformed base64 payload', () => {
      const token = 'mocked.not-valid-base64.secret';

      const result = jwt.default.decode(token);

      expect(result).toBe(null);
    });

    it('should return null for non-JSON payload', () => {
      const encodedPayload = Buffer.from('not-json').toString('base64');
      const token = `mocked.${encodedPayload}.secret`;

      const result = jwt.default.decode(token);

      expect(result).toBe(null);
    });
  });
});
