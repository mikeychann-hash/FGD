// tests/unit/action_pipeline.test.js
// Covers the Unified Action Framework pipeline: validation, planning,
// dispatch, dead-letter capture, and retry.

import { jest } from '@jest/globals';

jest.mock('../../logger.js', () => {
  const stub = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return { logger: { ...stub, child: () => stub } };
});

jest.mock('../../src/services/metrics.js', () => ({
  incrementAction: jest.fn(),
  incrementActionFailure: jest.fn(),
  incrementSpawnSuccess: jest.fn(),
  incrementSpawnFailure: jest.fn(),
}));

import { createActionPipeline } from '../../src/services/action_pipeline/index.js';

function makeNpcSystem({ bots = [], bridge } = {}) {
  const registry = {
    get: jest.fn((id) => bots.find((b) => b.id === id) || null),
    upsert: jest.fn(async (b) => b),
  };
  return {
    npcEngine: { registry, bridge },
    minecraftBridge: bridge,
  };
}

const activeBot = () => ({
  id: 'miner_01',
  status: 'active',
  inventory: [],
  spawnPosition: { x: 0, y: 64, z: 0 },
  metadata: {},
});

describe('createActionPipeline', () => {
  afterEach(() => jest.clearAllMocks());

  describe('validation', () => {
    it('rejects unknown bot with 404', async () => {
      const pipeline = createActionPipeline(makeNpcSystem(), null);
      await expect(
        pipeline.run('ghost', { type: 'openInventory' })
      ).rejects.toMatchObject({ status: 404 });
    });

    it('rejects inactive bot with 400', async () => {
      const pipeline = createActionPipeline(
        makeNpcSystem({ bots: [{ ...activeBot(), status: 'idle' }] }),
        null
      );
      await expect(
        pipeline.run('miner_01', { type: 'openInventory' })
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects unsupported action types', async () => {
      const pipeline = createActionPipeline(
        makeNpcSystem({ bots: [activeBot()] }),
        null
      );
      await expect(
        pipeline.run('miner_01', { type: 'teleport_to_moon' })
      ).rejects.toThrow(/Unsupported action type/);
    });

    it('rejects positions with non-numeric coordinates', async () => {
      const pipeline = createActionPipeline(
        makeNpcSystem({ bots: [activeBot()] }),
        null
      );
      await expect(
        pipeline.run('miner_01', {
          type: 'openInventory',
          position: { x: '1', y: 2, z: 3 },
        })
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects mining of forbidden blocks', async () => {
      const pipeline = createActionPipeline(
        makeNpcSystem({ bots: [activeBot()] }),
        null
      );
      await expect(
        pipeline.run('miner_01', { type: 'mine', block: 'bedrock' })
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('run (happy path)', () => {
    it('dispatches, emits bot:actionDispatched, and upserts registry state', async () => {
      const bridge = {
        dispatchAction: jest.fn().mockResolvedValue({ ok: true }),
      };
      const system = makeNpcSystem({ bots: [activeBot()], bridge });
      const io = { emit: jest.fn() };

      const pipeline = createActionPipeline(system, io);
      const result = await pipeline.run('miner_01', { type: 'openInventory' });

      expect(result.success).toBe(true);
      expect(bridge.dispatchAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'openInventory', botId: 'miner_01' })
      );
      expect(io.emit).toHaveBeenCalledWith(
        'bot:actionDispatched',
        expect.objectContaining({ botId: 'miner_01', action: 'openInventory' })
      );
      expect(system.npcEngine.registry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'miner_01',
          metadata: expect.objectContaining({
            lastAction: 'openInventory',
            actionState: 'dispatched',
          }),
        })
      );
    });
  });

  describe('dispatch failure → dead letter', () => {
    it('queues the failed plan and rethrows the bridge error', async () => {
      const bridge = {
        dispatchAction: jest.fn().mockRejectedValue(new Error('bridge offline')),
      };
      const system = makeNpcSystem({ bots: [activeBot()], bridge });
      const io = { emit: jest.fn() };

      const pipeline = createActionPipeline(system, io);
      await expect(
        pipeline.run('miner_01', { type: 'openInventory' })
      ).rejects.toThrow('bridge offline');

      expect(io.emit).toHaveBeenCalledWith(
        'bot:actionFailed',
        expect.objectContaining({ botId: 'miner_01', error: 'bridge offline' })
      );

      const queue = pipeline.getDeadLetters();
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({
        botId: 'miner_01',
        action: 'openInventory',
        error: 'bridge offline',
      });
    });

    it('throws when no bridge dispatchAction is available', async () => {
      const system = makeNpcSystem({ bots: [activeBot()], bridge: null });
      const pipeline = createActionPipeline(system, null);
      await expect(
        pipeline.run('miner_01', { type: 'openInventory' })
      ).rejects.toThrow(/Bridge dispatchAction unavailable/);
    });

    it('getDeadLetters returns a shallow copy', async () => {
      const bridge = {
        dispatchAction: jest.fn().mockRejectedValue(new Error('nope')),
      };
      const pipeline = createActionPipeline(
        makeNpcSystem({ bots: [activeBot()], bridge }),
        null
      );
      await pipeline.run('miner_01', { type: 'openInventory' }).catch(() => {});

      const copy = pipeline.getDeadLetters();
      copy.pop();
      expect(pipeline.getDeadLetters()).toHaveLength(1);
    });
  });

  describe('retryDeadLetters', () => {
    it('drains the queue, retries, and requeues anything that fails again', async () => {
      const bridge = {
        // first two calls (original runs) both fail, then retry calls one
        // succeeds and one fails.
        dispatchAction: jest
          .fn()
          .mockRejectedValueOnce(new Error('fail-a-first'))
          .mockRejectedValueOnce(new Error('fail-b-first'))
          .mockResolvedValueOnce({ ok: true }) // retry a → success
          .mockRejectedValueOnce(new Error('fail-b-retry')),
      };
      const system = makeNpcSystem({
        bots: [
          { ...activeBot(), id: 'bot_a' },
          { ...activeBot(), id: 'bot_b' },
        ],
        bridge,
      });
      const pipeline = createActionPipeline(system, null);

      await pipeline.run('bot_a', { type: 'openInventory' }).catch(() => {});
      await pipeline.run('bot_b', { type: 'openInventory' }).catch(() => {});
      expect(pipeline.getDeadLetters()).toHaveLength(2);

      const result = await pipeline.retryDeadLetters();

      expect(result.successes).toHaveLength(1);
      expect(result.successes[0].botId).toBe('bot_a');
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].botId).toBe('bot_b');
      expect(result.remaining).toBe(1);
      expect(pipeline.getDeadLetters().map((e) => e.botId)).toEqual(['bot_b']);
    });
  });
});
