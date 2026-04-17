// tests/unit/npc_spawner.test.js
// Covers the NPCSpawner retry loop and dead-letter queue semantics.

import { jest } from '@jest/globals';

jest.mock('../../logger.js', () => {
  const stub = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return { logger: { ...stub, child: () => stub } };
});

jest.mock('../../core/npc_microcore.js', () => ({
  startLoop: jest.fn(() => ({})),
  stopLoop: jest.fn(),
}));

import { NPCSpawner } from '../../npc_spawner.js';
import { MAX_BOTS, WORLD_BOUNDS } from '../../constants.js';

function makeSpawner({ bots = [], bridge, engine, maxRetries = 2 } = {}) {
  const registry = {
    getAll: jest.fn(() => bots),
    listActive: jest.fn(() => bots),
    ensureProfile: jest.fn(async (opts) => ({
      id: opts.id || 'new_bot',
      npcType: opts.npcType || 'builder',
      role: opts.role || 'builder',
      appearance: {},
      spawnPosition: opts.spawnPosition,
      personality: {},
      personalitySummary: '',
      personalityTraits: [],
      metadata: {},
      description: null,
    })),
    recordSpawn: jest.fn(async (id, position) => ({
      id,
      npcType: 'builder',
      role: 'builder',
      appearance: {},
      spawnPosition: position,
      personality: {},
      personalitySummary: '',
      personalityTraits: [],
      metadata: {},
      description: null,
      status: 'active',
    })),
    upsert: jest.fn(async (p) => p),
    load: jest.fn(async () => {}),
  };

  const spawner = new NPCSpawner({
    engine: engine ?? null,
    bridge: bridge ?? null,
    registry,
    learningEngine: false,
    autoSpawn: false,
    maxRetries,
    retryDelay: 0, // keep tests fast
  });

  return { spawner, registry };
}

describe('NPCSpawner', () => {
  afterEach(() => jest.clearAllMocks());

  describe('_countSpawnedBots + _checkSpawnLimit', () => {
    it('counts only bots with status="active"', () => {
      const { spawner } = makeSpawner({
        bots: [
          { id: 'a', status: 'active' },
          { id: 'b', status: 'idle' },
          { id: 'c', status: 'active' },
        ],
      });
      expect(spawner._countSpawnedBots()).toBe(2);
    });

    it('throws when spawning would exceed MAX_BOTS', () => {
      const bots = Array.from({ length: MAX_BOTS }, (_, i) => ({
        id: `b${i}`,
        status: 'active',
      }));
      const { spawner } = makeSpawner({ bots });
      expect(() => spawner._checkSpawnLimit(1)).toThrow(/exceed maximum of/);
    });

    it('allows spawning up to but not over the limit', () => {
      const bots = Array.from({ length: MAX_BOTS - 1 }, (_, i) => ({
        id: `b${i}`,
        status: 'active',
      }));
      const { spawner } = makeSpawner({ bots });
      expect(() => spawner._checkSpawnLimit(1)).not.toThrow();
      expect(() => spawner._checkSpawnLimit(2)).toThrow();
    });
  });

  describe('_validatePosition', () => {
    it('accepts a null/undefined position', () => {
      const { spawner } = makeSpawner();
      expect(() => spawner._validatePosition(null)).not.toThrow();
      expect(() => spawner._validatePosition(undefined)).not.toThrow();
    });

    it('rejects y below MIN_Y', () => {
      const { spawner } = makeSpawner();
      expect(() =>
        spawner._validatePosition({ x: 0, y: WORLD_BOUNDS.MIN_Y - 1, z: 0 })
      ).toThrow(/outside world bounds/);
    });

    it('rejects y above MAX_Y', () => {
      const { spawner } = makeSpawner();
      expect(() =>
        spawner._validatePosition({ x: 0, y: WORLD_BOUNDS.MAX_Y + 1, z: 0 })
      ).toThrow(/outside world bounds/);
    });
  });

  describe('_spawnWithRetry', () => {
    const profile = { id: 'bot_1', npcType: 'miner', appearance: {}, metadata: {} };
    const position = { x: 0, y: 64, z: 0 };

    it('returns the bridge response on first-attempt success', async () => {
      const bridge = {
        spawnBot: jest.fn().mockResolvedValue({ success: true }),
      };
      const { spawner } = makeSpawner({ bridge });

      const response = await spawner._spawnWithRetry(profile, position, {});

      expect(response).toEqual({ success: true });
      expect(bridge.spawnBot).toHaveBeenCalledTimes(1);
      expect(spawner.getDeadLetterQueue()).toHaveLength(0);
    });

    it('retries on failure and succeeds on a later attempt', async () => {
      const bridge = {
        spawnBot: jest
          .fn()
          .mockRejectedValueOnce(new Error('bridge stalled'))
          .mockRejectedValueOnce(new Error('bridge stalled'))
          .mockResolvedValueOnce({ success: true }),
      };
      const { spawner } = makeSpawner({ bridge, maxRetries: 2 });

      const response = await spawner._spawnWithRetry(profile, position, {});

      expect(response).toEqual({ success: true });
      expect(bridge.spawnBot).toHaveBeenCalledTimes(3);
      expect(spawner.getDeadLetterQueue()).toHaveLength(0);
    });

    it('adds to the dead-letter queue after all retries are exhausted', async () => {
      const bridge = {
        spawnBot: jest.fn().mockRejectedValue(new Error('permanent failure')),
      };
      const { spawner } = makeSpawner({ bridge, maxRetries: 2 });

      const response = await spawner._spawnWithRetry(profile, position, {});

      expect(response).toBeNull();
      expect(bridge.spawnBot).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
      const dlq = spawner.getDeadLetterQueue();
      expect(dlq).toHaveLength(1);
      expect(dlq[0]).toMatchObject({
        profile: expect.objectContaining({ id: 'bot_1' }),
        position,
        error: 'permanent failure',
        failCount: 1,
      });
    });

    it('tracks repeated failures via failureCount', async () => {
      const bridge = {
        spawnBot: jest.fn().mockRejectedValue(new Error('boom')),
      };
      const { spawner } = makeSpawner({ bridge, maxRetries: 0 });

      await spawner._spawnWithRetry(profile, position, {});
      await spawner._spawnWithRetry(profile, position, {});

      expect(spawner.failureCount.get('bot_1')).toBe(2);
      expect(spawner.getDeadLetterQueue()).toHaveLength(2);
    });
  });

  describe('dead-letter queue operations', () => {
    it('getDeadLetterQueue returns a shallow copy', () => {
      const { spawner } = makeSpawner();
      spawner.deadLetterQueue.push({ profile: { id: 'x' }, position: {}, error: 'e', failCount: 1, timestamp: 't' });
      const copy = spawner.getDeadLetterQueue();
      copy.pop();
      expect(spawner.getDeadLetterQueue()).toHaveLength(1);
    });

    it('drainDeadLetterQueue returns and empties the queue', () => {
      const { spawner } = makeSpawner();
      spawner.deadLetterQueue.push({ profile: { id: 'a' } }, { profile: { id: 'b' } });
      const drained = spawner.drainDeadLetterQueue();
      expect(drained).toHaveLength(2);
      expect(spawner.deadLetterQueue).toHaveLength(0);
    });

    it('requeueDeadLetters appends without disturbing existing entries', () => {
      const { spawner } = makeSpawner();
      spawner.deadLetterQueue.push({ profile: { id: 'a' } });
      spawner.requeueDeadLetters([{ profile: { id: 'b' } }, { profile: { id: 'c' } }]);
      expect(spawner.deadLetterQueue.map((e) => e.profile.id)).toEqual(['a', 'b', 'c']);
    });

    it('requeueDeadLetters ignores non-arrays', () => {
      const { spawner } = makeSpawner();
      spawner.requeueDeadLetters(null);
      spawner.requeueDeadLetters(undefined);
      spawner.requeueDeadLetters('oops');
      expect(spawner.deadLetterQueue).toHaveLength(0);
    });

    it('clearDeadLetterQueue empties both the queue and failureCount', () => {
      const { spawner } = makeSpawner();
      spawner.deadLetterQueue.push({ profile: { id: 'a' } }, { profile: { id: 'b' } });
      spawner.failureCount.set('a', 3);
      const count = spawner.clearDeadLetterQueue();
      expect(count).toBe(2);
      expect(spawner.deadLetterQueue).toHaveLength(0);
      expect(spawner.failureCount.size).toBe(0);
    });
  });

  describe('retryDeadLetterQueue', () => {
    it('retries every queued entry and reports successes/failures', async () => {
      const bridge = {
        spawnBot: jest
          .fn()
          .mockResolvedValueOnce({ success: true })
          .mockRejectedValueOnce(new Error('still broken')),
      };
      const { spawner } = makeSpawner({ bridge, maxRetries: 0 });
      spawner.deadLetterQueue.push(
        { profile: { id: 'a', appearance: {}, metadata: {} }, position: { x: 0, y: 64, z: 0 }, error: 'e', failCount: 1, timestamp: 't' },
        { profile: { id: 'b', appearance: {}, metadata: {} }, position: { x: 0, y: 64, z: 0 }, error: 'e', failCount: 1, timestamp: 't' }
      );

      const result = await spawner.retryDeadLetterQueue({ maxRetries: 0 });

      expect(result.successes).toHaveLength(1);
      expect(result.successes[0].npcId).toBe('a');
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].npcId).toBe('b');
      // Failed retries are added back into the queue by _addToDeadLetterQueue
      expect(spawner.getDeadLetterQueue().map((e) => e.profile.id)).toEqual(['b']);
    });
  });
});
