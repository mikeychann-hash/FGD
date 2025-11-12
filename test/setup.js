/**
 * Jest Setup
 *
 * Global test configuration and utilities
 */

// Suppress console logs in tests (unless debugging)
if (process.env.DEBUG !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for debugging
    error: console.error
  };
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.MINEFLAYER_ENABLED = 'true';

// Global test utilities
global.testUtils = {
  // Delay utility for async tests
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Create test bot object
  createMockBot: () => ({
    username: 'TestBot',
    entity: {
      position: { x: 0, y: 64, z: 0 },
      yaw: 0,
      pitch: 0
    },
    health: 20,
    food: 20,
    inventory: {
      items: () => [],
      emptySlotCount: () => 36,
      slots: new Array(36).fill(null)
    },
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    pathfinder: {
      goto: jest.fn().mockResolvedValue(undefined),
      setGoal: jest.fn()
    },
    dig: jest.fn().mockResolvedValue(undefined),
    placeBlock: jest.fn().mockResolvedValue(undefined),
    attack: jest.fn().mockResolvedValue(undefined),
    equip: jest.fn().mockResolvedValue(undefined),
    openBlock: jest.fn().mockResolvedValue(undefined),
    closeWindow: jest.fn().mockResolvedValue(undefined),
    chat: jest.fn(),
    disconnect: jest.fn(),
    quit: jest.fn()
  }),

  // Create test bridge
  createMockBridge: () => ({
    bots: new Map(),
    createBot: jest.fn().mockResolvedValue({
      success: true,
      botId: 'test-bot',
      position: { x: 0, y: 64, z: 0 },
      health: 20,
      food: 20
    }),
    disconnectBot: jest.fn().mockResolvedValue({ success: true }),
    getBotState: jest.fn().mockReturnValue({
      position: { x: 0, y: 64, z: 0 },
      health: 20,
      food: 20
    }),
    listBots: jest.fn().mockReturnValue([]),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    emit: jest.fn()
  }),

  // Create test position
  createPosition: (x = 0, y = 64, z = 0) => ({ x, y, z }),

  // Assert position equality
  assertPositionEqual: (pos1, pos2, tolerance = 0.1) => {
    expect(Math.abs(pos1.x - pos2.x)).toBeLessThan(tolerance);
    expect(Math.abs(pos1.y - pos2.y)).toBeLessThan(tolerance);
    expect(Math.abs(pos1.z - pos2.z)).toBeLessThan(tolerance);
  }
};

// Setup global timeout
jest.setTimeout(30000);

// After all tests
afterAll(async () => {
  // Cleanup
  jest.clearAllMocks();
});
