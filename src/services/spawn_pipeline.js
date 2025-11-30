// src/services/spawn_pipeline.js
// Canonical Golden Path spawn helpers shared across all entry points

import { MAX_BOTS, WORLD_BOUNDS } from '../../constants.js';
import { logger as baseLogger } from '../../logger.js';
import { incrementSpawnFailure, incrementSpawnSuccess } from './metrics.js';

class SpawnError extends Error {
  constructor(message, status = 500, meta = {}) {
    super(message);
    this.status = status;
    this.meta = meta;
  }
}

const log = baseLogger.child({ component: 'SpawnPipeline' });

export function countActiveBots(npcSystem) {
  const registry = npcSystem?.npcRegistry || npcSystem?.npcEngine?.registry;
  if (!registry?.getAll) return 0;
  return registry.getAll().filter((bot) => bot.status === 'active').length;
}

export function enforceSpawnBudget(npcSystem, count = 1) {
  const active = countActiveBots(npcSystem);
  if (active + count > MAX_BOTS) {
    return {
      ok: false,
      error: 'Spawn limit exceeded',
      message: `Cannot spawn ${count} bot(s): would exceed maximum of ${MAX_BOTS} bots. Currently ${active} bot(s) active.`,
      currentCount: active,
      maxBots: MAX_BOTS,
      requested: count,
    };
  }
  return { ok: true };
}

function assertSpawnInfrastructure(npcSystem) {
  if (!npcSystem?.npcSpawner || !npcSystem?.npcEngine) {
    throw new SpawnError('NPC system not initialized', 503);
  }
  const hasBridge =
    npcSystem.npcEngine?.mineflayerBridge ||
    npcSystem.npcEngine?.bridge ||
    npcSystem.npcSpawner?.bridge;
  if (!hasBridge) {
    throw new SpawnError('Minecraft bridge not configured', 503);
  }
}

function validatePosition(position) {
  if (!position) return;
  const { y } = position;
  if (typeof y === 'number' && (y < WORLD_BOUNDS.MIN_Y || y > WORLD_BOUNDS.MAX_Y)) {
    throw new SpawnError(
      `Y coordinate must be between ${WORLD_BOUNDS.MIN_Y} and ${WORLD_BOUNDS.MAX_Y}`,
      400
    );
  }
}

function resolvePosition(bot, spawner, requestedPosition) {
  return (
    requestedPosition ||
    bot?.lastKnownPosition ||
    bot?.spawnPosition ||
    spawner?.defaultPosition || { x: 0, y: 64, z: 0 }
  );
}

export async function spawnBot(npcSystem, io, { botId, position, user, source = 'api' }) {
  assertSpawnInfrastructure(npcSystem);

  const { npcSpawner, npcEngine } = npcSystem;
  const registry = npcEngine.registry;

  const budget = enforceSpawnBudget(npcSystem, 1);
  if (!budget.ok) {
    throw new SpawnError(budget.message, 400, budget);
  }

  const bot = registry.get(botId);
  if (!bot) {
    throw new SpawnError(`Bot ${botId} not found`, 404);
  }

  const spawnPosition = resolvePosition(bot, npcSpawner, position);
  validatePosition(spawnPosition);

  try {
    const profile = await npcSpawner.spawn({
      id: botId,
      position: spawnPosition,
      autoSpawn: true,
      persist: true,
      metadata: {
        ...bot.metadata,
        spawnedBy: user?.username || source,
        spawnedVia: source,
      },
    });

    const spawnResponse = profile?.lastSpawnResponse || null;
    const spawned = Boolean(spawnResponse && spawnResponse.success !== false);

    const payload = {
      botId,
      position: spawnPosition,
      spawnedBy: user?.username || source,
      source,
      spawned,
      spawnResponse,
      timestamp: new Date().toISOString(),
    };

    if (spawned) {
      incrementSpawnSuccess(1, botId);
    } else {
      incrementSpawnFailure(1, botId);
    }

    if (io) {
      io.emit('bot:spawned', payload);
    }

    log.info('Bot spawned via canonical pipeline', {
      botId,
      spawned,
      source,
      user: user?.username,
    });

    return {
      success: true,
      spawned,
      bot: profile,
      position: spawnPosition,
      spawnResponse,
      meta: payload,
    };
  } catch (error) {
    if (error instanceof SpawnError) {
      incrementSpawnFailure(1);
      throw error;
    }
    incrementSpawnFailure(1);
    log.error('Spawn failed', { botId, error: error.message });
    throw new SpawnError(error.message || 'Spawn failed', 500);
  }
}

export async function spawnAllBots(npcSystem, io, { user, source = 'api' } = {}) {
  assertSpawnInfrastructure(npcSystem);

  const { npcSpawner, npcEngine } = npcSystem;
  const registry = npcEngine.registry;

  const inactiveBots = registry.getAll().filter((bot) => bot.status !== 'active');
  const budget = enforceSpawnBudget(npcSystem, inactiveBots.length);
  if (!budget.ok) {
    throw new SpawnError(budget.message, 400, budget);
  }

  try {
    const results = await npcSpawner.spawnAllKnown({ autoSpawn: true, persist: true });

    if (Array.isArray(results)) {
      let successCount = 0;
      let failureCount = 0;
      results.forEach((bot) => {
        const ok = bot?.lastSpawnResponse && bot.lastSpawnResponse.success !== false;
        if (ok) {
          successCount += 1;
          incrementSpawnSuccess(1, bot?.id);
        } else {
          failureCount += 1;
          incrementSpawnFailure(1, bot?.id);
        }
      });
      if (successCount === 0 && failureCount === 0) {
        // No responses; treat as failures to keep counters consistent
        incrementSpawnFailure(results.length || 1);
      }
    }

    const meta = {
      spawnedBy: user?.username || source,
      count: results.length,
      timestamp: new Date().toISOString(),
    };

    if (io) {
      io.emit('bot:spawn_all', meta);
      results.forEach((bot) => {
        io.emit('bot:spawned', {
          botId: bot.id,
          position: bot.spawnPosition,
          spawnedBy: user?.username || source,
          source,
          spawned: Boolean(bot.lastSpawnResponse && bot.lastSpawnResponse.success !== false),
          spawnResponse: bot.lastSpawnResponse || null,
          timestamp: meta.timestamp,
        });
      });
    }

    log.info('Spawn-all executed via canonical pipeline', {
      count: results.length,
      source,
      user: user?.username,
    });

    return {
      success: true,
      count: results.length,
      bots: results,
      meta,
    };
  } catch (error) {
    if (error instanceof SpawnError) {
      incrementSpawnFailure(1);
      throw error;
    }
    incrementSpawnFailure(1);
    log.error('Spawn-all failed', { error: error.message });
    throw new SpawnError(error.message || 'Spawn-all failed', 500);
  }
}

/**
 * Retry dead-lettered spawns through the canonical REST pipeline
 */
export async function retryDeadLetters(npcSystem, io, { user, source = 'dead-letter:retry', maxRetries = 1 } = {}) {
  assertSpawnInfrastructure(npcSystem);
  const npcSpawner = npcSystem.npcSpawner;
  const registry = npcSystem?.npcEngine?.registry;

  if (!npcSpawner?.getDeadLetterQueue) {
    throw new SpawnError('Dead letter queue not available', 400);
  }

  const queue =
    typeof npcSpawner.drainDeadLetterQueue === 'function'
      ? npcSpawner.drainDeadLetterQueue()
      : [...npcSpawner.getDeadLetterQueue()];

  const successes = [];
  const failures = [];

  for (const entry of queue) {
    const botId = entry?.profile?.id || entry?.botId;
    const position = entry?.position || entry?.profile?.spawnPosition || null;

    if (!botId) {
      failures.push({ error: 'Missing botId', entry });
      continue;
    }

    try {
      if (registry && entry?.profile && typeof registry.get === 'function' && typeof registry.upsert === 'function') {
        const existing = registry.get(botId);
        if (!existing) {
          await registry.upsert(entry.profile);
        }
      }

      const result = await spawnBot(npcSystem, io, {
        botId,
        position,
        user,
        source,
      });
      successes.push({ botId, position, result });
    } catch (error) {
      failures.push({ botId, error: error.message });
    }
  }

  if (failures.length && typeof npcSpawner.requeueDeadLetters === 'function') {
    const failedEntries = queue.filter((entry) => failures.find((f) => f.botId === (entry?.profile?.id || entry?.botId)));
    npcSpawner.requeueDeadLetters(failedEntries);
  }

  return {
    success: failures.length === 0,
    successes,
    failures,
    attempted: queue.length,
    remaining: npcSpawner.getDeadLetterQueue().length,
  };
}

export { SpawnError };
