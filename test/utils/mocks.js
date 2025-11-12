/**
 * Mock Utilities for Testing
 *
 * Provides reusable mock objects and utilities for unit and integration tests
 */

import { EventEmitter } from 'events';

/**
 * Create a mock bot instance
 */
export function createMockBot(overrides = {}) {
  const bot = new EventEmitter();

  // Bot properties
  Object.assign(bot, {
    id: 'test-bot-' + Math.random().toString(36).substr(2, 9),
    username: 'TestBot',
    uuid: '00000000-0000-0000-0000-000000000000',
    health: 20,
    food: 20,
    dimension: 'minecraft:overworld',
    entity: {
      position: { x: 0, y: 64, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      yaw: 0,
      pitch: 0,
      distanceTo: function(pos) {
        const dx = this.position.x - pos.x;
        const dy = this.position.y - pos.y;
        const dz = this.position.z - pos.z;
        return Math.sqrt(dx*dx + dy*dy + dz*dz);
      }
    },
    inventory: {
      items: jest.fn().mockReturnValue([]),
      emptySlotCount: jest.fn().mockReturnValue(36),
      slots: new Array(36).fill(null)
    },
    entities: {},
    nearestEntity: jest.fn().mockReturnValue(null),
    blockAt: jest.fn().mockReturnValue(null),

    // Mocked methods
    dig: jest.fn().mockResolvedValue(undefined),
    placeBlock: jest.fn().mockResolvedValue(undefined),
    attack: jest.fn().mockResolvedValue(undefined),
    equip: jest.fn().mockResolvedValue(undefined),
    openBlock: jest.fn().mockResolvedValue(undefined),
    closeWindow: jest.fn().mockResolvedValue(undefined),
    chat: jest.fn(),
    disconnect: jest.fn(),
    quit: jest.fn(),

    // Pathfinder
    pathfinder: {
      goto: jest.fn().mockResolvedValue(undefined),
      setGoal: jest.fn(),
      goal: null
    },

    // Windows
    currentWindow: null,

    ...overrides
  });

  return bot;
}

/**
 * Create a mock Mineflayer bridge
 */
export function createMockBridge(overrides = {}) {
  const bridge = new EventEmitter();

  Object.assign(bridge, {
    bots: new Map(),
    config: {
      host: 'localhost',
      port: 25565,
      version: '1.20.1'
    },

    // Methods
    createBot: jest.fn().mockResolvedValue({
      success: true,
      botId: 'test-bot',
      position: { x: 0, y: 64, z: 0 },
      health: 20,
      food: 20
    }),

    disconnectBot: jest.fn().mockResolvedValue({
      success: true,
      botId: 'test-bot'
    }),

    getBotState: jest.fn().mockReturnValue({
      id: 'test-bot',
      position: { x: 0, y: 64, z: 0 },
      health: 20,
      food: 20,
      status: 'active'
    }),

    listBots: jest.fn().mockReturnValue([]),

    getInventory: jest.fn().mockReturnValue([]),

    sendChat: jest.fn().mockResolvedValue({
      success: true,
      message: 'test'
    }),

    moveToPosition: jest.fn().mockResolvedValue({
      success: true,
      position: { x: 10, y: 64, z: 10 }
    }),

    digBlock: jest.fn().mockResolvedValue({
      success: true,
      block: 'stone'
    }),

    findBlocks: jest.fn().mockReturnValue([]),

    findEntities: jest.fn().mockReturnValue([]),

    ...overrides
  });

  return bridge;
}

/**
 * Create mock executors
 */
export function createMockExecutors(overrides = {}) {
  return {
    mine: {
      execute: jest.fn().mockResolvedValue({
        success: true,
        mined: 1,
        blockType: 'stone'
      })
    },
    move: {
      execute: jest.fn().mockResolvedValue({
        success: true,
        position: { x: 10, y: 64, z: 10 }
      })
    },
    movement: {
      execute: jest.fn().mockResolvedValue({
        success: true,
        position: { x: 10, y: 64, z: 10 }
      })
    },
    inventory: {
      execute: jest.fn().mockResolvedValue({
        success: true,
        inventory: []
      })
    },
    combat: {
      execute: jest.fn().mockResolvedValue({
        success: true,
        targetDead: true
      })
    },
    craft: {
      execute: jest.fn().mockResolvedValue({
        success: true,
        crafted: 1
      })
    },
    ...overrides
  };
}

/**
 * Create test task
 */
export function createTestTask(type = 'mine', params = {}) {
  const tasks = {
    mine: {
      action: 'mine',
      params: {
        blockType: 'stone',
        count: 1,
        range: 32,
        ...params
      }
    },
    move: {
      action: 'move',
      params: {
        target: { x: 10, y: 64, z: 10 },
        range: 1,
        timeout: 60000,
        ...params
      }
    },
    combat: {
      action: 'combat',
      params: {
        subAction: 'attack',
        entityType: 'zombie',
        range: 16,
        ...params
      }
    },
    craft: {
      action: 'craft',
      params: {
        subAction: 'craft',
        recipe: 'wooden_pickaxe',
        count: 1,
        ...params
      }
    }
  };

  return tasks[type] || tasks.mine;
}

/**
 * Create mock entity
 */
export function createMockEntity(overrides = {}) {
  return {
    id: Math.random(),
    name: 'zombie',
    type: 'mob',
    position: { x: 5, y: 64, z: 5 },
    velocity: { x: 0, y: 0, z: 0 },
    metadata: new Array(16).fill(undefined),
    health: 20,
    ...overrides
  };
}

/**
 * Create mock block
 */
export function createMockBlock(overrides = {}) {
  return {
    name: 'stone',
    position: { x: 0, y: 64, z: 0 },
    hardness: 1.5,
    ...overrides
  };
}

/**
 * Create mock inventory item
 */
export function createMockItem(overrides = {}) {
  return {
    name: 'stone',
    count: 1,
    metadata: 0,
    ...overrides
  };
}

/**
 * Wait for event
 */
export function waitForEvent(emitter, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    emitter.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Wait for function call
 */
export function waitForMockCall(mockFn, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (mockFn.mock.calls.length > 0) {
        clearInterval(checkInterval);
        resolve(mockFn.mock.calls[mockFn.mock.calls.length - 1]);
      }
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for mock call'));
      }
    }, 10);
  });
}

/**
 * Simulate bot event
 */
export function emitBotEvent(bot, eventName, data) {
  bot.emit(eventName, data);
}

/**
 * Simulate bridge event
 */
export function emitBridgeEvent(bridge, eventName, data) {
  bridge.emit(eventName, data);
}

/**
 * Get mock call arguments
 */
export function getMockCallArgs(mockFn, callIndex = 0) {
  return mockFn.mock.calls[callIndex] || [];
}

/**
 * Create test context
 */
export function createTestContext() {
  return {
    bridge: createMockBridge(),
    executors: createMockExecutors(),
    bots: new Map(),
    events: new EventEmitter()
  };
}

export default {
  createMockBot,
  createMockBridge,
  createMockExecutors,
  createTestTask,
  createMockEntity,
  createMockBlock,
  createMockItem,
  waitForEvent,
  waitForMockCall,
  emitBotEvent,
  emitBridgeEvent,
  getMockCallArgs,
  createTestContext
};
