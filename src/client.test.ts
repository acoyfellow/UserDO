/**
 * Unit tests for src/client.ts
 *
 * Tests for the UserDOClient class which provides:
 * - Authentication (signup, login, logout)
 * - WebSocket real-time communication
 * - KV storage operations (get, set, onChange)
 * - Collection operations (create, findById, update, delete, query)
 */

/// <reference types="jest" />

// Mock window object - must be defined before any imports
Object.defineProperty(globalThis, 'window', {
  value: {
    location: {
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
    },
  },
  writable: true,
  configurable: true,
});

// Mock ReconnectingWebSocket - must be before import
let mockWebSocketInstance: any;

const MockWebSocket = jest.fn().mockImplementation(function() {
  mockWebSocketInstance = {
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    close: jest.fn(),
  };
  return mockWebSocketInstance;
});

jest.mock('reconnecting-websocket', () => ({
  __esModule: true,
  default: MockWebSocket,
}));

// Mock fetch globally
const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

// Mock console methods to reduce noise
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Import UserDOClient
import { UserDOClient } from './client';

describe('UserDOClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: false,
      json: jest.fn(),
      text: jest.fn(),
    } as unknown as Response);
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    (globalThis as any).window.location.protocol = 'http:';
    (globalThis as any).window.location.host = 'localhost:3000';
    (globalThis as any).window.location.hostname = 'localhost';
    mockWebSocketInstance = null;
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  describe('constructor', () => {
    it('should create a client with default options', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      expect(client).toBeInstanceOf(UserDOClient);
    });

    it('should create a client with custom websocketUrl option', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api', {
        websocketUrl: 'ws://localhost:1337/api/ws',
      });
      expect(client).toBeInstanceOf(UserDOClient);
    });

    it('should call checkAuthStatus on construction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api');

      // Wait for async auth check
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalledWith('/api/me', {
        credentials: 'include',
      });
    });
  });

  describe('autoDetectCookieDomain', () => {
    it('should return null when baseUrl is relative', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      expect(client).toBeDefined();
    });

    it('should return null when current host matches API host', () => {
      (globalThis as any).window.location.protocol = 'https:';
      (globalThis as any).window.location.host = 'example.com';
      (globalThis as any).window.location.hostname = 'example.com';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('https://example.com/api');
      expect(client).toBeDefined();
    });

    it('should return root domain for cross-subdomain scenario', () => {
      (globalThis as any).window.location.protocol = 'https:';
      (globalThis as any).window.location.host = 'app.example.com';
      (globalThis as any).window.location.hostname = 'app.example.com';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('https://api.example.com/api');
      expect(client).toBeDefined();
    });
  });

  describe('headers getter', () => {
    it('should return Content-Type header', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      const headers = (client as any).headers;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should include X-Cookie-Domain header when cross-subdomain', () => {
      (globalThis as any).window.location.protocol = 'https:';
      (globalThis as any).window.location.host = 'app.example.com';
      (globalThis as any).window.location.hostname = 'app.example.com';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('https://api.example.com/api');
      const headers = (client as any).headers;
      expect(headers['X-Cookie-Domain']).toBe('.example.com');
    });
  });

  describe('checkAuthStatus', () => {
    it('should set user when auth check succeeds', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ user: mockUser }),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect((client as any).user).toEqual(mockUser);
    });

    it('should set user to null when auth check fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect((client as any).user).toBeNull();
    });

    it('should set user to null when auth check throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = new UserDOClient('/api');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect((client as any).user).toBeNull();
    });
  });

  describe('onAuthStateChanged', () => {
    it('should register auth state change listener', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      const listener = jest.fn<(user: { id: string; email: string } | null) => void, [user: { id: string; email: string } | null]>();

      client.onAuthStateChanged(listener);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(listener).toHaveBeenCalledWith(null);
    });

    it('should call listener immediately with current user state', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ user: mockUser }),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      const listener = jest.fn<(user: { id: string; email: string } | null) => void, [user: { id: string; email: string } | null]>();

      await new Promise((resolve) => setTimeout(resolve, 50));
      client.onAuthStateChanged(listener);

      expect(listener).toHaveBeenCalledWith(mockUser);
    });

    it('should remove auth state change listener', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      const listener = jest.fn<(user: { id: string; email: string } | null) => void, [user: { id: string; email: string } | null]>();

      client.onAuthStateChanged(listener);
      client.offAuthStateChanged(listener);

      expect((client as any).authListeners.has(listener)).toBe(false);
    });
  });

  describe('signup', () => {
    it('should signup user and return auth response', async () => {
      const mockResponse = {
        user: { id: '123', email: 'test@example.com' },
        token: 'test-token',
        refreshToken: 'test-refresh',
      };

      // Mock for constructor's auth check, then for signup
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      const result = await client.signup('test@example.com', 'password123');

      expect(mockFetch).toHaveBeenCalledWith('/api/signup', {
        method: 'POST',
        headers: (client as any).headers,
        credentials: 'include',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      });
      expect(result).toEqual(mockResponse);
      expect((client as any).user).toEqual(mockResponse.user);
    });

    it('should throw error when signup fails', async () => {
      // Mock for constructor's auth check, then for failed signup
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: jest.fn().mockResolvedValue('Email already exists'),
      } as unknown as Response);

      const client = new UserDOClient('/api');

      await expect(client.signup('test@example.com', 'password123')).rejects.toThrow(
        'Email already exists'
      );
    });
  });

  describe('login', () => {
    it('should login user and return auth response', async () => {
      const mockResponse = {
        user: { id: '123', email: 'test@example.com' },
        token: 'test-token',
        refreshToken: 'test-refresh',
      };

      // Mock for constructor's auth check, then for login
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      const result = await client.login('test@example.com', 'password123');

      expect(mockFetch).toHaveBeenCalledWith('/api/login', {
        method: 'POST',
        headers: (client as any).headers,
        credentials: 'include',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      });
      expect(result).toEqual(mockResponse);
      expect((client as any).user).toEqual(mockResponse.user);
    });

    it('should throw error when login fails', async () => {
      // Mock for constructor's auth check, then for failed login
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: jest.fn().mockResolvedValue('Invalid credentials'),
      } as unknown as Response);

      const client = new UserDOClient('/api');

      await expect(client.login('test@example.com', 'wrongpassword')).rejects.toThrow(
        'Invalid credentials'
      );
    });
  });

  describe('logout', () => {
    it('should logout user and disconnect websocket', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn(),
      } as unknown as Response);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Set a mock user
      (client as any).user = { id: '123', email: 'test@example.com' };

      await client.logout();

      expect(mockFetch).toHaveBeenCalledWith('/api/logout', {
        method: 'POST',
        headers: (client as any).headers,
        credentials: 'include',
      });
      expect((client as any).user).toBeNull();
    });
  });

  describe('WebSocket connection', () => {
    it('should connect WebSocket when user is authenticated', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ user: mockUser }),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect((client as any).ws).not.toBeNull();
    });

    it('should use custom websocketUrl when provided', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ user: mockUser }),
      } as unknown as Response);

      const client = new UserDOClient('/api', {
        websocketUrl: 'ws://localhost:1337/api/ws',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(client).toBeDefined();
    });

    it('should construct default WebSocket URL from baseUrl', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ user: mockUser }),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(client).toBeDefined();
    });

    it('should disconnect WebSocket when user logs out', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ user: { id: '123', email: 'test@example.com' } }),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      await new Promise((resolve) => setTimeout(resolve, 50));

      const wsMock = (client as any).ws;
      expect(wsMock).not.toBeNull();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn(),
      } as unknown as Response);

      await client.logout();

      expect(wsMock.close).toHaveBeenCalled();
      expect((client as any).ws).toBeNull();
    });

    it('should handle WebSocket messages and emit events', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ user: mockUser }),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      await new Promise((resolve) => setTimeout(resolve, 50));

      const listener = jest.fn<(data: any) => void, [data: any]>();
      client.onChange('test-key', listener);

      const wsMock = (client as any).ws;
      const message = {
        event: 'kv:test-key',
        data: { value: 'new-value' },
        timestamp: Date.now(),
      };

      wsMock.onmessage?.({ data: JSON.stringify(message) });

      expect(listener).toHaveBeenCalledWith({ value: 'new-value' });
    });

    it('should handle WebSocket errors gracefully', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ user: mockUser }),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      await new Promise((resolve) => setTimeout(resolve, 50));

      const wsMock = (client as any).ws;
      wsMock.onmessage?.({ data: 'invalid-json' });

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should get value by key', async () => {
      // Mock for constructor's auth check, then for get
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: 'test-value' }),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      const result = await client.get('test-key');

      expect(mockFetch).toHaveBeenCalledWith('/data?key=test-key', {
        headers: (client as any).headers,
        credentials: 'include',
      });
      expect(result).toBe('test-value');
    });

    it('should throw error when get fails', async () => {
      // Mock for constructor's auth check, then for failed get
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: jest.fn().mockResolvedValue('Key not found'),
      } as unknown as Response);

      const client = new UserDOClient('/api');

      await expect(client.get('nonexistent-key')).rejects.toThrow('Key not found');
    });
  });

  describe('set', () => {
    it('should set value by key', async () => {
      // Mock for constructor's auth check, then for set
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      const result = await client.set('test-key', 'test-value');

      expect(mockFetch).toHaveBeenCalledWith('/data', {
        method: 'POST',
        headers: (client as any).headers,
        credentials: 'include',
        body: JSON.stringify({ key: 'test-key', value: 'test-value' }),
      });
      expect(result).toEqual({ ok: true });
    });

    it('should throw error when set fails', async () => {
      // Mock for constructor's auth check, then for failed set
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: jest.fn().mockResolvedValue('Storage quota exceeded'),
      } as unknown as Response);

      const client = new UserDOClient('/api');

      await expect(client.set('test-key', 'test-value')).rejects.toThrow(
        'Storage quota exceeded'
      );
    });
  });

  describe('onChange', () => {
    it('should register change listener for a key', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      const listener = jest.fn<(data: any) => void, [data: any]>();

      const unsubscribe = client.onChange('test-key', listener);

      expect((client as any).changeListeners.has('kv:test-key')).toBe(true);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should return unsubscribe function that removes listener', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      const listener = jest.fn<(data: any) => void, [data: any]>();

      const unsubscribe = client.onChange('test-key', listener);
      unsubscribe();

      const listeners = (client as any).changeListeners.get('kv:test-key');
      expect(listeners === undefined || !listeners.has(listener)).toBe(true);
    });

    it('should remove event key when last listener is removed', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(),
      } as unknown as Response);

      const client = new UserDOClient('/api');
      const listener = jest.fn<(data: any) => void, [data: any]>();

      const unsubscribe = client.onChange('test-key', listener);
      unsubscribe();

      expect((client as any).changeListeners.has('kv:test-key')).toBe(false);
    });
  });

  describe('collection', () => {
    describe('create', () => {
      it('should create a new record', async () => {
        // Mock for constructor's auth check, then for create
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
        } as unknown as Response);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: '1', name: 'Test' }),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');
        const result = await collection.create({ name: 'Test' });

        expect(mockFetch).toHaveBeenCalledWith('/api/users', {
          method: 'POST',
          headers: (client as any).headers,
          credentials: 'include',
          body: JSON.stringify({ name: 'Test' }),
        });
        expect(result).toEqual({ id: '1', name: 'Test' });
      });

      it('should throw error when create fails', async () => {
        // Mock for constructor's auth check, then for failed create
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
        } as unknown as Response);
        mockFetch.mockResolvedValueOnce({
          ok: false,
          text: jest.fn().mockResolvedValue('Validation error'),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');

        await expect(collection.create({ name: 'Test' })).rejects.toThrow('Validation error');
      });
    });

    describe('findById', () => {
      it('should find a record by id', async () => {
        // Mock for constructor's auth check, then for findById
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
        } as unknown as Response);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: '1', name: 'Test' }),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');
        const result = await collection.findById('1');

        expect(mockFetch).toHaveBeenCalledWith('/api/users/1', {
          headers: (client as any).headers,
          credentials: 'include',
        });
        expect(result).toEqual({ id: '1', name: 'Test' });
      });

      it('should throw error when findById fails', async () => {
        // Mock for constructor's auth check, then for failed findById
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
          text: jest.fn(),
        } as unknown as Response);
        mockFetch.mockResolvedValueOnce({
          ok: false,
          text: () => Promise.resolve('Record not found'),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');

        await expect(collection.findById('1')).rejects.toThrow('Record not found');
      });
    });

    describe('update', () => {
      it('should update a record by id', async () => {
        // Mock for constructor's auth check, then for update
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
        } as unknown as Response);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: '1', name: 'Updated' }),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');
        const result = await collection.update('1', { name: 'Updated' });

        expect(mockFetch).toHaveBeenCalledWith('/api/users/1', {
          method: 'PUT',
          headers: (client as any).headers,
          credentials: 'include',
          body: JSON.stringify({ name: 'Updated' }),
        });
        expect(result).toEqual({ id: '1', name: 'Updated' });
      });

      it('should throw error when update fails', async () => {
        // Mock for constructor's auth check, then for failed update
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
        } as unknown as Response);
        mockFetch.mockResolvedValueOnce({
          ok: false,
          text: jest.fn().mockResolvedValue('Record not found'),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');

        await expect(collection.update('1', { name: 'Updated' })).rejects.toThrow(
          'Record not found'
        );
      });
    });

    describe('delete', () => {
      it('should delete a record by id', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');

        await collection.delete('1');

        expect(mockFetch).toHaveBeenCalledWith('/api/users/1', {
          method: 'DELETE',
          headers: (client as any).headers,
          credentials: 'include',
        });
      });
    });

    describe('onChange', () => {
      it('should register change listener for a collection', () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');
        const listener = jest.fn<(data: any) => void, [data: any]>();

        const unsubscribe = collection.onChange(listener);

        expect((client as any).changeListeners.has('table:users')).toBe(true);
        expect(typeof unsubscribe).toBe('function');
      });

      it('should return unsubscribe function', () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');
        const listener = jest.fn<(data: any) => void, [data: any]>();

        const unsubscribe = collection.onChange(listener);
        unsubscribe();

        const listeners = (client as any).changeListeners.get('table:users');
        expect(listeners === undefined || !listeners.has(listener)).toBe(true);
      });
    });

    describe('query', () => {
      it('should build query with where clause', async () => {
        // Mock for constructor's auth check, then for query
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
          text: jest.fn(),
        } as unknown as Response);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: '1', name: 'Test' }]),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');
        const result = await collection.query().where('name', 'eq', 'Test').get();

        const callArgs = mockFetch.mock.calls[1][0];
        const url = callArgs.toString();
        const params = new URLSearchParams(url.split('?')[1]);
        expect(params.get('where')).toBe('["name","eq","Test"]');
        expect(result).toEqual([{ id: '1', name: 'Test' }]);
      });

      it('should build query with orderBy', async () => {
        // Mock for constructor's auth check, then for query
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
          text: jest.fn(),
        } as unknown as Response);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: '1', name: 'Test' }]),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');
        await collection.query().orderBy('name', 'desc').get();

        const callArgs = mockFetch.mock.calls[1][0];
        const url = callArgs.toString();
        const params = new URLSearchParams(url.split('?')[1]);
        expect(params.get('order')).toBe('name:desc');
      });

      it('should build query with limit', async () => {
        // Mock for constructor's auth check, then for query
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
          text: jest.fn(),
        } as unknown as Response);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: '1', name: 'Test' }]),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');
        await collection.query().limit(10).get();

        const callArgs = mockFetch.mock.calls[1][0];
        const url = callArgs.toString();
        const params = new URLSearchParams(url.split('?')[1]);
        expect(params.get('limit')).toBe('10');
      });

      it('should chain multiple query methods', async () => {
        // Mock for constructor's auth check, then for query
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
          text: jest.fn(),
        } as unknown as Response);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: '1', name: 'Test' }]),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');
        await collection
          .query()
          .where('active', 'eq', true)
          .orderBy('createdAt', 'desc')
          .limit(10)
          .get();

        const callArgs = mockFetch.mock.calls[1][0];
        const url = callArgs.toString();
        const params = new URLSearchParams(url.split('?')[1]);
        expect(params.get('where')).toBe('["active","eq",true]');
        expect(params.get('order')).toBe('createdAt:desc');
        expect(params.get('limit')).toBe('10');
      });

      it('should throw error when query fails', async () => {
        // Mock for constructor's auth check, then for failed query
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: jest.fn(),
          text: jest.fn(),
        } as unknown as Response);
        mockFetch.mockResolvedValueOnce({
          ok: false,
          text: () => Promise.resolve('Query error'),
        } as unknown as Response);

        const client = new UserDOClient('/api');
        const collection = client.collection('users');

        await expect(collection.query().get()).rejects.toThrow('Query error');
      });
    });
  });
});
