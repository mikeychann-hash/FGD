import express from "express";
import { logger } from "../../logger.js";

/**
 * Initialize NPC CRUD routes
 */
export function initNPCRoutes(npcSystem) {
  const router = express.Router();

  /**
   * List all NPCs
   */
  router.get("/", async (req, res) => {
    try {
      if (!npcSystem.npcRegistry) {
        return res.status(503).json({ error: 'NPC system not initialized' });
      }

      const { status, limit = 100, offset = 0 } = req.query;
      let npcs = npcSystem.npcRegistry.getAll();

      // Filter by status if provided
      if (status) {
        npcs = npcs.filter(npc => npc.status === status);
      }

      // Pagination
      const total = npcs.length;
      npcs = npcs.slice(Number(offset), Number(offset) + Number(limit));

      res.json({
        npcs,
        total,
        limit: Number(limit),
        offset: Number(offset)
      });
    } catch (err) {
      logger.error('Failed to list NPCs', { error: err.message });
      res.status(500).json({ error: 'Failed to retrieve NPCs' });
    }
  });

  /**
   * Get single NPC by ID
   */
  router.get("/:id", async (req, res) => {
    try {
      if (!npcSystem.npcRegistry) {
        return res.status(503).json({ error: 'NPC system not initialized' });
      }

      const npc = npcSystem.npcRegistry.get(req.params.id);
      if (!npc) {
        return res.status(404).json({ error: 'NPC not found' });
      }

      // Enrich with learning data if available
      let enriched = { ...npc };
      if (npcSystem.learningEngine) {
        const learningProfile = npcSystem.learningEngine.getProfile(req.params.id);
        if (learningProfile) {
          enriched.learning = learningProfile;
        }
      }

      res.json(enriched);
    } catch (err) {
      logger.error('Failed to get NPC', { npcId: req.params.id, error: err.message });
      res.status(500).json({ error: 'Failed to retrieve NPC' });
    }
  });

  /**
   * Create new NPC
   */
  router.post("/", async (req, res) => {
    try {
      if (!npcSystem.npcSpawner) {
        return res.status(503).json({ error: 'NPC system not initialized' });
      }

      const { id, role, npcType, appearance, personality, position, autoSpawn = false } = req.body;

      // Basic validation
      if (!role && !npcType) {
        return res.status(400).json({ error: 'Either role or npcType is required' });
      }

      const result = await npcSystem.npcSpawner.spawn({
        id,
        role,
        npcType,
        appearance,
        personality,
        position,
        autoSpawn
      });

      logger.info('NPC created via API', { npcId: result.id });
      res.status(201).json(result);
    } catch (err) {
      logger.error('Failed to create NPC', { error: err.message });
      res.status(500).json({ error: 'Failed to create NPC', message: err.message });
    }
  });

  /**
   * Update NPC
   */
  router.put("/:id", async (req, res) => {
    try {
      if (!npcSystem.npcRegistry) {
        return res.status(503).json({ error: 'NPC system not initialized' });
      }

      const existing = npcSystem.npcRegistry.get(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'NPC not found' });
      }

      const { role, appearance, personality, metadata, description } = req.body;

      const updated = await npcSystem.npcRegistry.upsert({
        id: req.params.id,
        role,
        appearance,
        personality,
        metadata,
        description
      });

      logger.info('NPC updated via API', { npcId: req.params.id });
      res.json(updated);
    } catch (err) {
      logger.error('Failed to update NPC', { npcId: req.params.id, error: err.message });
      res.status(500).json({ error: 'Failed to update NPC', message: err.message });
    }
  });

  /**
   * Delete/Finalize NPC
   */
  router.delete("/:id", async (req, res) => {
    try {
      if (!npcSystem.npcFinalizer) {
        return res.status(503).json({ error: 'NPC system not initialized' });
      }

      const { preserve = false, removeFromWorld = true } = req.query;

      const result = await npcSystem.npcFinalizer.finalizeNPC(req.params.id, {
        reason: 'api_request',
        preserveInRegistry: preserve === 'true',
        removeFromWorld: removeFromWorld !== 'false'
      });

      logger.info('NPC finalized via API', { npcId: req.params.id });
      res.json(result);
    } catch (err) {
      logger.error('Failed to finalize NPC', { npcId: req.params.id, error: err.message });
      res.status(500).json({ error: 'Failed to finalize NPC', message: err.message });
    }
  });

  /**
   * Get NPC archive
   */
  router.get("/archive/all", async (req, res) => {
    try {
      if (!npcSystem.npcFinalizer) {
        return res.status(503).json({ error: 'NPC system not initialized' });
      }

      const archive = await npcSystem.npcFinalizer.getArchive();
      res.json({ archive, total: archive.length });
    } catch (err) {
      logger.error('Failed to get archive', { error: err.message });
      res.status(500).json({ error: 'Failed to retrieve archive' });
    }
  });

  /**
   * Get dead letter queue
   */
  router.get("/deadletter/queue", (req, res) => {
    try {
      if (!npcSystem.npcSpawner) {
        return res.status(503).json({ error: 'NPC system not initialized' });
      }

      const queue = npcSystem.npcSpawner.getDeadLetterQueue();
      res.json({ queue, total: queue.length });
    } catch (err) {
      logger.error('Failed to get dead letter queue', { error: err.message });
      res.status(500).json({ error: 'Failed to retrieve dead letter queue' });
    }
  });

  /**
   * Retry dead letter queue
   */
  router.post("/deadletter/retry", async (req, res) => {
    try {
      if (!npcSystem.npcSpawner) {
        return res.status(503).json({ error: 'NPC system not initialized' });
      }

      const results = await npcSystem.npcSpawner.retryDeadLetterQueue();
      logger.info('Dead letter queue retry completed', results);
      res.json(results);
    } catch (err) {
      logger.error('Failed to retry dead letter queue', { error: err.message });
      res.status(500).json({ error: 'Failed to retry dead letter queue' });
    }
  });

  return router;
}
