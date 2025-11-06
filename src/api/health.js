import express from "express";
import { logger } from "../../logger.js";

/**
 * Initialize health check and metrics routes
 */
export function initHealthRoutes(npcSystem, stateManager) {
  const router = express.Router();

  /**
   * Health check endpoint
   */
  router.get("/health", (req, res) => {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      components: {
        npcRegistry: npcSystem.npcRegistry ? "healthy" : "not_initialized",
        npcSpawner: npcSystem.npcSpawner ? "healthy" : "not_initialized",
        npcFinalizer: npcSystem.npcFinalizer ? "healthy" : "not_initialized",
        learningEngine: npcSystem.learningEngine ? "healthy" : "not_initialized"
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: "MB"
      }
    };

    const allHealthy = Object.values(health.components).every(status => status === "healthy");
    res.status(allHealthy ? 200 : 503).json(health);
  });

  /**
   * System metrics endpoint
   */
  router.get("/metrics/system", async (req, res) => {
    try {
      const systemState = stateManager.getState();
      const metrics = {
        timestamp: new Date().toISOString(),
        npc: {
          total: npcSystem.npcRegistry ? npcSystem.npcRegistry.getAll().length : 0,
          active: npcSystem.npcRegistry ? npcSystem.npcRegistry.listActive().length : 0,
          archived: npcSystem.npcFinalizer ? (await npcSystem.npcFinalizer.getArchive()).length : 0,
          deadLetterQueue: npcSystem.npcSpawner ? npcSystem.npcSpawner.getDeadLetterQueue().length : 0
        },
        learning: {
          profiles: npcSystem.learningEngine ? Object.keys(npcSystem.learningEngine.profiles).length : 0
        },
        system: systemState.metrics
      };

      res.json(metrics);
    } catch (err) {
      logger.error('Failed to get system metrics', { error: err.message });
      res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  });

  /**
   * Get autonomic core status
   */
  router.get("/autonomic", (req, res) => {
    try {
      if (!npcSystem.autonomicCore) {
        return res.status(503).json({ error: 'Autonomic core not initialized' });
      }

      const status = npcSystem.autonomicCore.getStatus();
      res.json(status);
    } catch (err) {
      logger.error('Failed to get autonomic status', { error: err.message });
      res.status(500).json({ error: 'Failed to get autonomic status' });
    }
  });

  return router;
}
