import express from 'express';
import { logger } from '../../logger.js';
import { getServiceContainer, getServiceStatus } from '../services/service_container.js';
import { getPool } from '../database/connection.js';
import { fail } from '../middleware/response.js';

/**
 * Initialize health check and metrics routes
 */
export function initHealthRoutes(npcSystem, stateManager) {
  const router = express.Router();

  async function buildHealthPayload() {
    const serviceStatus = getServiceStatus();
    const bridgeStatus = serviceStatus?.bridge || {};

    // Database check
    let database = 'not_configured';
    try {
      const pool = getPool();
      const res = await pool.query('SELECT 1');
      database = res?.rows ? 'ok' : 'error';
    } catch (err) {
      database = 'error';
      logger.warn('Health check: database error', { error: err.message });
    }

    // Redis not configured in this stack
    const redis = 'not_configured';

    const minecraft =
      bridgeStatus.rconConnected && bridgeStatus.pluginConnected ? 'ok' :
      bridgeStatus.rconConnected ? 'degraded' :
      'error';

    const npcEngineReady = Boolean(npcSystem?.npcEngine);
    const registryReady = Boolean(npcSystem?.npcRegistry);

    return {
      status: minecraft === 'ok' && database === 'ok' && npcEngineReady && registryReady ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database,
      redis,
      minecraft,
      npcEngine: npcEngineReady ? 'ok' : 'error',
      registry: registryReady ? 'ok' : 'error',
      components: {
        npcRegistry: registryReady ? 'healthy' : 'not_initialized',
        npcSpawner: npcSystem.npcSpawner ? 'healthy' : 'not_initialized',
        npcFinalizer: npcSystem.npcFinalizer ? 'healthy' : 'not_initialized',
        learningEngine: npcSystem.learningEngine ? 'healthy' : 'not_initialized',
        minecraftBridge: npcSystem.minecraftBridge
          ? npcSystem.minecraftBridge.isConnected?.() ? 'healthy' : 'disconnected'
          : 'not_configured',
        mineflayerBridge: npcSystem.mineflayerBridge
          ? npcSystem.mineflayerBridge.isConnected?.() ? 'healthy' : 'disconnected'
          : 'not_configured',
        progressionEngine: getServiceContainer().progressionEngine ? 'healthy' : 'not_initialized',
        policyEngine: getServiceContainer().policyEngine ? 'healthy' : 'not_initialized',
      },
      details: {
        progressionPhase: serviceStatus?.progressionPhase ?? null,
        deadLetterQueueSize: serviceStatus?.deadLetterQueueSize ?? 0,
        bridge: {
          ...bridgeStatus,
          minecraft,
        },
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    };
  }

  /**
   * Health check endpoint (preferred path: /api/health)
   */
  router.get('/', async (req, res) => {
    await sendHealth(res);
  });

  /**
   * Legacy health path retained for compatibility (/api/health/health)
   */
  router.get('/health', async (req, res) => {
    await sendHealth(res);
  });

  async function sendHealth(res) {
    const payload = await buildHealthPayload();
    payload.serviceStatus = getServiceStatus();
    const ok = payload.status === 'ok';
    res.status(ok ? 200 : 503).json(payload);
  }

  /**
   * System metrics endpoint
   */
  router.get('/metrics/system', async (req, res) => {
    try {
      const systemState = stateManager.getState();
      const metrics = {
        timestamp: new Date().toISOString(),
        npc: {
          total: npcSystem.npcRegistry ? npcSystem.npcRegistry.getAll().length : 0,
          active: npcSystem.npcRegistry ? npcSystem.npcRegistry.listActive().length : 0,
          archived: npcSystem.npcFinalizer ? (await npcSystem.npcFinalizer.getArchive()).length : 0,
          deadLetterQueue: npcSystem.npcSpawner
            ? npcSystem.npcSpawner.getDeadLetterQueue().length
            : 0,
        },
        learning: {
          profiles: npcSystem.learningEngine
            ? Object.keys(npcSystem.learningEngine.profiles).length
            : 0,
        },
        system: systemState.metrics,
      };

      res.json(metrics);
    } catch (err) {
      logger.error('Failed to get system metrics', { error: err.message });
      return fail(res, 500, 'Failed to retrieve metrics', err.message);
    }
  });

  /**
   * Get autonomic core status
   */
  router.get('/autonomic', (req, res) => {
    try {
      if (!npcSystem.autonomicCore) {
        return fail(res, 503, 'Autonomic core not initialized');
      }

      const status = npcSystem.autonomicCore.getStatus();
      res.json(status);
    } catch (err) {
      logger.error('Failed to get autonomic status', { error: err.message });
      return fail(res, 500, 'Failed to get autonomic status', err.message);
    }
  });

  return router;
}
