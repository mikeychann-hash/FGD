import express from 'express';
import { logger } from '../../logger.js';
import { ok, fail } from '../middleware/response.js';

/**
 * Initialize NPC CRUD routes
 */
export function initNPCRoutes(npcSystem) {
  const router = express.Router();

  /**
   * List all NPCs
   */
  router.get('/', async (req, res) => {
    try {
      if (!npcSystem.npcRegistry) {
        return fail(res, 503, 'NPC system not initialized');
      }

      const { status, limit = 100, offset = 0 } = req.query;
      let npcs = npcSystem.npcRegistry.getAll();

      // Filter by status if provided
      if (status) {
        npcs = npcs.filter((npc) => npc.status === status);
      }

      // Pagination
      const total = npcs.length;
      npcs = npcs.slice(Number(offset), Number(offset) + Number(limit));

      return ok(res, {
        npcs,
        total,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (err) {
      logger.error('Failed to list NPCs', { error: err.message });
      return fail(res, 500, 'Failed to retrieve NPCs', err.message);
    }
  });

  /**
   * Get single NPC by ID
   */
  router.get('/:id', async (req, res) => {
    try {
      if (!npcSystem.npcRegistry) {
        return fail(res, 503, 'NPC system not initialized');
      }

      const npc = npcSystem.npcRegistry.get(req.params.id);
      if (!npc) {
        return fail(res, 404, 'NPC not found');
      }

      // Enrich with learning data if available
      const enriched = { ...npc };
      if (npcSystem.learningEngine) {
        const learningProfile = npcSystem.learningEngine.getProfile(req.params.id);
        if (learningProfile) {
          enriched.learning = learningProfile;
        }
      }

      // Keep the legacy shape: fields like `role`, `status`, `position`
      // stay at the top level so existing clients do not break. `success`
      // is an additive field.
      return ok(res, enriched);
    } catch (err) {
      logger.error('Failed to get NPC', { npcId: req.params.id, error: err.message });
      return fail(res, 500, 'Failed to retrieve NPC', err.message);
    }
  });

  /**
   * Create new NPC
   */
  router.post('/', async (req, res) => {
    try {
      if (!npcSystem.npcSpawner) {
        return fail(res, 503, 'NPC system not initialized');
      }

      const { id, role, npcType, appearance, personality, position, autoSpawn = false } = req.body;

      // Basic validation
      if (!role && !npcType) {
        return fail(res, 400, 'Either role or npcType is required');
      }

      const result = await npcSystem.npcSpawner.spawn({
        id,
        role,
        npcType,
        appearance,
        personality,
        position,
        autoSpawn,
      });

      logger.info('NPC created via API', { npcId: result.id });
      // Preserve legacy top-level shape.
      return ok(res, result, 201);
    } catch (err) {
      logger.error('Failed to create NPC', { error: err.message });
      return fail(res, 500, 'Failed to create NPC', err.message);
    }
  });

  /**
   * Update NPC
   */
  router.put('/:id', async (req, res) => {
    try {
      if (!npcSystem.npcRegistry) {
        return fail(res, 503, 'NPC system not initialized');
      }

      const existing = npcSystem.npcRegistry.get(req.params.id);
      if (!existing) {
        return fail(res, 404, 'NPC not found');
      }

      const { role, appearance, personality, metadata, description } = req.body;

      const updated = await npcSystem.npcRegistry.upsert({
        id: req.params.id,
        role,
        appearance,
        personality,
        metadata,
        description,
      });

      logger.info('NPC updated via API', { npcId: req.params.id });
      return ok(res, updated);
    } catch (err) {
      logger.error('Failed to update NPC', { npcId: req.params.id, error: err.message });
      return fail(res, 500, 'Failed to update NPC', err.message);
    }
  });

  /**
   * Delete/Finalize NPC
   */
  router.delete('/:id', async (req, res) => {
    try {
      if (!npcSystem.npcFinalizer) {
        return fail(res, 503, 'NPC system not initialized');
      }

      const { preserve = false, removeFromWorld = true } = req.query;

      const result = await npcSystem.npcFinalizer.finalizeNPC(req.params.id, {
        reason: 'api_request',
        preserveInRegistry: preserve === 'true',
        removeFromWorld: removeFromWorld !== 'false',
      });

      logger.info('NPC finalized via API', { npcId: req.params.id });
      return ok(res, result);
    } catch (err) {
      logger.error('Failed to finalize NPC', { npcId: req.params.id, error: err.message });
      return fail(res, 500, 'Failed to finalize NPC', err.message);
    }
  });

  /**
   * Get NPC archive
   */
  router.get('/archive/all', async (req, res) => {
    try {
      if (!npcSystem.npcFinalizer) {
        return fail(res, 503, 'NPC system not initialized');
      }

      const archive = await npcSystem.npcFinalizer.getArchive();
      return ok(res, { archive, total: archive.length });
    } catch (err) {
      logger.error('Failed to get archive', { error: err.message });
      return fail(res, 500, 'Failed to retrieve archive', err.message);
    }
  });

  /**
   * Get dead letter queue
   */
  router.get('/deadletter/queue', (req, res) => {
    try {
      if (!npcSystem.npcSpawner) {
        return fail(res, 503, 'NPC system not initialized');
      }

      const queue = npcSystem.npcSpawner.getDeadLetterQueue();
      return ok(res, { queue, total: queue.length });
    } catch (err) {
      logger.error('Failed to get dead letter queue', { error: err.message });
      return fail(res, 500, 'Failed to retrieve dead letter queue', err.message);
    }
  });

  /**
   * Retry dead letter queue
   */
  router.post('/deadletter/retry', async (req, res) => {
    try {
      if (!npcSystem.npcSpawner) {
        return fail(res, 503, 'NPC system not initialized');
      }

      const results = await npcSystem.npcSpawner.retryDeadLetterQueue();
      logger.info('Dead letter queue retry completed', results);
      return ok(res, results);
    } catch (err) {
      logger.error('Failed to retry dead letter queue', { error: err.message });
      return fail(res, 500, 'Failed to retry dead letter queue', err.message);
    }
  });

  return router;
}
