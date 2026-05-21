const ReconnectingWebSocket = require('./reconnecting-websocket');

describe('ReconnectingWebSocket mock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should be a jest mock function', () => {
    expect(ReconnectingWebSocket).toBeDefined();
    expect(typeof ReconnectingWebSocket).toBe('function');
  });

  test('should have a default export', () => {
    expect(ReconnectingWebSocket.default).toBe(ReconnectingWebSocket);
  });

  test('should create instances with event handlers initialized to null', () => {
    const instance = new ReconnectingWebSocket('ws://localhost');

    expect(instance.onopen).toBeNull();
    expect(instance.onmessage).toBeNull();
    expect(instance.onclose).toBeNull();
    expect(instance.onerror).toBeNull();
  });

  test('should have a close method that is a jest mock function', () => {
    const instance = new ReconnectingWebSocket('ws://localhost');

    expect(instance.close).toBeDefined();
    expect(typeof instance.close).toBe('function');
    expect(jest.isMockFunction(instance.close)).toBe(true);
  });

  test('should allow setting event handlers', () => {
    const instance = new ReconnectingWebSocket('ws://localhost');
    const openHandler = jest.fn();
    const messageHandler = jest.fn();
    const closeHandler = jest.fn();
    const errorHandler = jest.fn();

    instance.onopen = openHandler;
    instance.onmessage = messageHandler;
    instance.onclose = closeHandler;
    instance.onerror = errorHandler;

    expect(instance.onopen).toBe(openHandler);
    expect(instance.onmessage).toBe(messageHandler);
    expect(instance.onclose).toBe(closeHandler);
    expect(instance.onerror).toBe(errorHandler);
  });

  test('should track constructor calls', () => {
    const instance1 = new ReconnectingWebSocket('ws://localhost');
    const instance2 = new ReconnectingWebSocket('ws://localhost:8080');

    expect(ReconnectingWebSocket).toHaveBeenCalledTimes(2);
  });

  test('should return this from constructor implementation', () => {
    const instance = new ReconnectingWebSocket('ws://localhost');

    expect(instance).toBeDefined();
    expect(typeof instance).toBe('object');
  });

  test('close method should be mockable and track calls', () => {
    const instance = new ReconnectingWebSocket('ws://localhost');

    instance.close();

    expect(instance.close).toHaveBeenCalledTimes(1);
  });

  test('close method should accept arguments', () => {
    const instance = new ReconnectingWebSocket('ws://localhost');

    instance.close(1000, 'Normal closure');

    expect(instance.close).toHaveBeenCalledWith(1000, 'Normal closure');
  });

  test('multiple instances should have independent close mocks', () => {
    const instance1 = new ReconnectingWebSocket('ws://localhost');
    const instance2 = new ReconnectingWebSocket('ws://localhost');

    instance1.close();
    instance2.close();
    instance2.close();

    expect(instance1.close).toHaveBeenCalledTimes(1);
    expect(instance2.close).toHaveBeenCalledTimes(2);
  });
});
