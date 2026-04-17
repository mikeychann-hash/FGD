// tests/unit/spawn_pipeline.test.js
// Covers the canonical spawn pipeline: budget enforcement, position validation,
// the Golden Path success path, and dead-letter retry behaviour.

import { jest } from '@jest/globals';

jest.mock('../../logger.js', () => ({
  logger: {
    child: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../src/services/metrics.js', () => ({
  incrementSpawnSuccess: jest.fn(),
  incrementSpawnFailure: jest.fn(),
}));

import { MAX_BOTS } from '../../constants.js';
import {
  spawnBot,
  spawnAllBots,
  retryDeadLetters,
  enforceSpawnBudget,
  countActiveBots,
  SpawnError,
} from '../../src/services/spawn_pipeline.js';

function makeNpcSystem({ activeBots = 0, knownBots = [], deadLetters = [] } = {}) {
  const bots = [...knownBots];
  for (let i = 0; i < activeBots; i += 1) {
    bots.push({ id: `active_${i}`, status: 'active' });
  }

  const registry = {
    getAll: jest.fn(() => bots),
    get: jest.fn((id) => bots.find((b) => b.id === id) || null),
    upsert: jest.fn(async () => {}),
  };

  const npcSpawner = {
    bridge: {},
    defaultPosition: { x: 0, y: 64, z: 0 },
    spawn: jest.fn(async ({ id, position }) => ({
      id,
      spawnPosition: position,
      lastSpawnResponse: { success: true },
    })),
    spawnAllKnown: jest.fn(async () =>
      bots
        .filter((b) => b.status !== 'active')
        .map((b) => ({
          id: b.id,
          spawnPosition: b.spawnPosition || { x: 0, y: 64, z: 0 },
          lastSpawnResponse: { success: true },
        }))
    ),
    getDeadLetterQueue: jest.fn(() => [...deadLetters]),
    drainDeadLetterQueue: jest.fn(() => deadLetters.splice(0)),
    requeueDeadLetters: jest.fn((entries) => deadLetters.push(...entries)),
  };

  const npcEngine = {
    registry,
    mineflayerBridge: {},
  };

  return { npcSpawner, npcEngine };
}

const makeIo = () => ({ emit: jest.fn() });

describe('spawn_pipeline', () => {
  afterEach(() => jest.clearAllMocks());

  describe('enforceSpawnBudget', () => {
    it('allows spawns when under the budget', () => {
      const system = makeNpcSystem({ activeBots: 3 });
      expect(enforceSpawnBudget(system, 1)).toEqual({ ok: true });
    });

    it('rejects spawns that would exceed MAX_BOTS', () => {
      const system = makeNpcSystem({ activeBots: MAX_BOTS });
      const result = enforceSpawnBudget(system, 1);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Spawn limit exceeded');
      expect(result.maxBots).toBe(MAX_BOTS);
    });

    it('counts only bots with status="active"', () => {
      const system = makeNpcSystem({
        knownBots: [
          { id: 'a', status: 'active' },
          { id: 'b', status: 'idle' },
          { id: 'c', status: 'inactive' },
        ],
      });
      expect(countActiveBots(system)).toBe(1);
    });
  });

  describe('spawnBot', () => {
    it('spawns through the Golden Path and broadcasts bot:spawned', async () => {
      const system = makeNpcSystem({
        knownBots: [{ id: 'miner_01', status: 'idle', spawnPosition: { x: 10, y: 64, z: 10 } }],
      });
      const io = makeIo();

      const result = await spawnBot(system, io, {
        botId: 'miner_01',
        user: { username: 'alice' },
        source: 'rest',
      });

      expect(result.success).toBe(true);
      expect(result.spawned).toBe(true);
      expect(system.npcSpawner.spawn).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'miner_01', position: { x: 10, y: 64, z: 10 } })
      );
      expect(io.emit).toHaveBeenCalledWith(
        'bot:spawned',
        expect.objectContaining({ botId: 'miner_01', spawned: true })
      );
    });

    it('throws a 404 SpawnError when the bot is not in the registry', async () => {
      const system = makeNpcSystem();
      await expect(
        spawnBot(system, null, { botId: 'unknown', source: 'test' })
      ).rejects.toMatchObject({ status: 404 });
    });

    it('throws a 400 SpawnError when the position Y is outside world bounds', async () => {
      const system = makeNpcSystem({
        knownBots: [{ id: 'digger', status: 'idle' }],
      });
      await expect(
        spawnBot(system, null, {
          botId: 'digger',
          position: { x: 0, y: 9999, z: 0 },
          source: 'test',
        })
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects spawns that breach the budget before calling the spawner', async () => {
      const system = makeNpcSystem({ activeBots: MAX_BOTS });
      system.npcEngine.registry.getAll.mockImplementation(() =>
        Array.from({ length: MAX_BOTS }, (_, i) => ({ id: `active_${i}`, status: 'active' }))
          .concat([{ id: 'pending', status: 'idle' }])
      );

      await expect(
        spawnBot(system, null, { botId: 'pending', source: 'test' })
      ).rejects.toBeInstanceOf(SpawnError);

      expect(system.npcSpawner.spawn).not.toHaveBeenCalled();
    });

    it('throws 503 SpawnError when no bridge is configured', async () => {
      const system = makeNpcSystem();
      system.npcEngine.mineflayerBridge = null;
      system.npcSpawner.bridge = null;
      await expect(
        spawnBot(system, null, { botId: 'x', source: 'test' })
      ).rejects.toMatchObject({ status: 503 });
    });
  });

  describe('spawnAllBots', () => {
    it('spawns every inactive bot and emits per-bot events', async () => {
      const system = makeNpcSystem({
        knownBots: [
          { id: 'a', status: 'idle' },
          { id: 'b', status: 'idle' },
          { id: 'c', status: 'active' },
        ],
      });
      const io = makeIo();

      const result = await spawnAllBots(system, io, { source: 'rest' });

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(io.emit).toHaveBeenCalledWith('bot:spawn_all', expect.any(Object));
      const perBot = io.emit.mock.calls.filter(([event]) => event === 'bot:spawned');
      expect(perBot).toHaveLength(2);
    });

    it('rejects when inactive count would exceed MAX_BOTS', async () => {
      const inactive = Array.from({ length: MAX_BOTS + 2 }, (_, i) => ({
        id: `bot_${i}`,
        status: 'idle',
      }));
      const system = makeNpcSystem({ knownBots: inactive });

      await expect(spawnAllBots(system, null, { source: 'test' })).rejects.toBeInstanceOf(
        SpawnError
      );
      expect(system.npcSpawner.spawnAllKnown).not.toHaveBeenCalled();
    });
  });

  describe('retryDeadLetters', () => {
    it('drains the queue, re-spawns successful entries, and requeues failures', async () => {
      const deadLetters = [
        { botId: 'stuck_a', profile: { id: 'stuck_a', spawnPosition: { x: 0, y: 64, z: 0 } } },
        { botId: 'stuck_b', profile: { id: 'stuck_b', spawnPosition: { x: 1, y: 64, z: 1 } } },
      ];
      const system = makeNpcSystem({
        knownBots: [
          { id: 'stuck_a', status: 'idle' },
          { id: 'stuck_b', status: 'idle' },
        ],
        deadLetters,
      });
      system.npcSpawner.spawn
        .mockResolvedValueOnce({
          id: 'stuck_a',
          spawnPosition: { x: 0, y: 64, z: 0 },
          lastSpawnResponse: { success: true },
        })
        .mockRejectedValueOnce(new Error('bridge down'));

      const result = await retryDeadLetters(system, null, {});

      expect(result.attempted).toBe(2);
      expect(result.successes).toHaveLength(1);
      expect(result.failures).toHaveLength(1);
      expect(result.success).toBe(false);
      expect(system.npcSpawner.requeueDeadLetters).toHaveBeenCalled();
    });

    it('throws when the spawner cannot expose a dead-letter queue', async () => {
      const system = makeNpcSystem();
      delete system.npcSpawner.getDeadLetterQueue;
      delete system.npcSpawner.drainDeadLetterQueue;
      await expect(retryDeadLetters(system, null, {})).rejects.toBeInstanceOf(SpawnError);
    });
  });
});
