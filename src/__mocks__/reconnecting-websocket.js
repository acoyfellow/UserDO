// Mock ReconnectingWebSocket
const mockFn = jest.fn().mockImplementation(function() {
  this.onopen = null;
  this.onmessage = null;
  this.onclose = null;
  this.onerror = null;
  this.close = jest.fn();
  return this;
});

module.exports = mockFn;
module.exports.default = mockFn;
