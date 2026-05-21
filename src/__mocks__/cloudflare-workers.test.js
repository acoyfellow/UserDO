const { DurableObject } = require('./cloudflare-workers');

describe('cloudflare-workers mock', () => {
  describe('DurableObject', () => {
    it('should be a class', () => {
      expect(typeof DurableObject).toBe('function');
    });

    it('should be instantiable with state and env parameters', () => {
      const mockState = { id: 'test-id' };
      const mockEnv = { API_KEY: 'test-key' };

      const instance = new DurableObject(mockState, mockEnv);

      expect(instance).toBeInstanceOf(DurableObject);
    });

    it('should accept state and env parameters without throwing', () => {
      const mockState = { id: 'test-id', storage: {} };
      const mockEnv = { API_KEY: 'test-key', DB: {} };

      expect(() => {
        new DurableObject(mockState, mockEnv);
      }).not.toThrow();
    });

    it('should create distinct instances', () => {
      const instance1 = new DurableObject({ id: '1' }, {});
      const instance2 = new DurableObject({ id: '2' }, {});

      expect(instance1).not.toBe(instance2);
    });
  });
});
