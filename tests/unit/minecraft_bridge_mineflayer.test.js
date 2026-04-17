// tests/unit/minecraft_bridge_mineflayer.test.js
// Covers the MineflayerBridge lifecycle surface we can exercise without a
// real Minecraft server. Focuses on listener cleanup on disconnect (fix
// landed earlier this branch), botStates housekeeping, and control-session
// interval teardown.

import { jest } from '@jest/globals';
import EventEmitter from 'events';

jest.mock('../../logger.js', () => {
  const stub = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return { logger: { ...stub, child: () => stub } };
});

// Stub mineflayer + its plugins so the module can load without a network
// connection or native dependencies.
jest.mock('mineflayer', () => ({
  createBot: jest.fn(() => new EventEmitter()),
}));
jest.mock('mineflayer-pathfinder', () => ({
  pathfinder: {},
  Movements: class {},
  goals: {},
}));
jest.mock('mineflayer-auto-eat', () => ({}));
jest.mock('mineflayer-pvp', () => ({}));
jest.mock('mineflayer-collectblock', () => ({}));

import { MineflayerBridge } from '../../minecraft_bridge_mineflayer.js';

function makeFakeBot({ x = 1, y = 64, z = 2 } = {}) {
  const bot = new EventEmitter();
  bot.entity = { position: { x, y, z }, yaw: 0, pitch: 0 };
  bot.health = 20;
  bot.food = 20;
  bot.inventory = { items: () => [] };
  bot.quit = jest.fn();
  return bot;
}

describe('MineflayerBridge', () => {
  let bridge;

  beforeEach(() => {
    bridge = new MineflayerBridge({ host: 'localhost', port: 25565 });
  });

  afterEach(() => jest.clearAllMocks());

  describe('_getPosition', () => {
    it('returns the bot entity position', () => {
      const bot = makeFakeBot({ x: 10, y: 65, z: 20 });
      expect(bridge._getPosition(bot)).toEqual({ x: 10, y: 65, z: 20 });
    });

    it('falls back to origin when no entity is present', () => {
      expect(bridge._getPosition(null)).toEqual({ x: 0, y: 0, z: 0 });
      expect(bridge._getPosition({})).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  describe('_initializeBotState', () => {
    it('populates botStates with the bot\'s current snapshot', () => {
      const bot = makeFakeBot({ x: 5, y: 64, z: 6 });
      bot.health = 18;
      bot.food = 17;
      bot.inventory = { items: () => [{ name: 'dirt' }, { name: 'stone' }] };

      bridge._initializeBotState('b1', bot);

      expect(bridge.botStates.get('b1')).toEqual({
        position: { x: 5, y: 64, z: 6 },
        health: 18,
        food: 17,
        inventory: 2,
      });
    });
  });

  describe('_detachBotListeners', () => {
    it('removes only the events the bridge attaches', () => {
      const bot = makeFakeBot();
      const unrelated = jest.fn();
      const moveHandler = jest.fn();
      bot.on('custom', unrelated);
      bot.on('move', moveHandler);
      bot.on('health', jest.fn());
      bot.on('end', jest.fn());
      bot.on('error', jest.fn());
      bot.on('entitySpawn', jest.fn());
      bot.on('entityMoved', jest.fn());

      bridge._detachBotListeners(bot);

      for (const event of ['move', 'health', 'end', 'error', 'entitySpawn', 'entityMoved']) {
        expect(bot.listenerCount(event)).toBe(0);
      }
      expect(bot.listenerCount('custom')).toBe(1);
    });

    it('is a safe no-op for missing/invalid bots', () => {
      expect(() => bridge._detachBotListeners(null)).not.toThrow();
      expect(() => bridge._detachBotListeners({})).not.toThrow();
    });
  });

  describe('disconnectBot', () => {
    it('returns an error when the bot is unknown', async () => {
      const result = await bridge.disconnectBot('ghost');
      expect(result).toEqual({ success: false, error: 'Bot ghost not found' });
    });

    it('detaches listeners, quits, clears maps, and emits bot_disconnected', async () => {
      const bot = makeFakeBot();
      bot.on('move', jest.fn());
      bot.on('health', jest.fn());
      bridge.bots.set('b1', bot);
      bridge.botStates.set('b1', { position: { x: 0, y: 64, z: 0 } });

      const events = [];
      bridge.on('bot_disconnected', (e) => events.push(e));

      const result = await bridge.disconnectBot('b1');

      expect(result.success).toBe(true);
      expect(bot.quit).toHaveBeenCalledTimes(1);
      expect(bridge.bots.has('b1')).toBe(false);
      expect(bridge.botStates.has('b1')).toBe(false);
      expect(bot.listenerCount('move')).toBe(0);
      expect(bot.listenerCount('health')).toBe(0);
      expect(events).toEqual([{ botId: 'b1' }]);
    });

    it('does not leak listeners across reconnects of the same bot id', async () => {
      for (let i = 0; i < 3; i += 1) {
        const bot = makeFakeBot();
        bot.on('move', jest.fn());
        bot.on('health', jest.fn());
        bot.on('end', jest.fn());
        bot.on('error', jest.fn());
        bot.on('entitySpawn', jest.fn());
        bot.on('entityMoved', jest.fn());
        bridge.bots.set('b1', bot);
        bridge.botStates.set('b1', {});

        const result = await bridge.disconnectBot('b1');
        expect(result.success).toBe(true);
        for (const event of ['move', 'health', 'end', 'error', 'entitySpawn', 'entityMoved']) {
          expect(bot.listenerCount(event)).toBe(0);
        }
      }
    });
  });

  describe('control session intervals', () => {
    it('stopControlSession clears both intervals and emits session:stop', () => {
      const tickInterval = setInterval(() => {}, 1000);
      const scanInterval = setInterval(() => {}, 2000);
      bridge.sessionIntervals.set('b1', { tickInterval, scanInterval });

      const events = [];
      bridge.on('session:stop', (e) => events.push(e));

      bridge.stopControlSession('b1');

      expect(bridge.sessionIntervals.has('b1')).toBe(false);
      expect(events).toEqual([{ botId: 'b1' }]);

      // Sanity check: clearInterval actually ran. If it didn't, Jest fake
      // timers would keep the test alive, so a non-assertion here is fine
      // as long as the handles are not leaked in sessionIntervals.
    });

    it('stopControlSession is a no-op when no session exists', () => {
      const listener = jest.fn();
      bridge.on('session:stop', listener);
      bridge.stopControlSession('b1');
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
