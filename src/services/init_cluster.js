// src/services/init_cluster.js
// Centralized initialization wiring for core services (Golden Path)

import { progressionEngine } from '../../core/progression_engine.js';
import { PolicyEngine } from '../../adapters/mineflayer/policy_engine.js';
import { logger } from '../../logger.js';
import { setServiceContainer } from './service_container.js';

/**
 * Initialize and wire all core services into a single container.
 * Does not replace existing NPCSystem initialization, but records instances
 * and performs a self-check for health reporting.
 */
export async function initializeClusterServices(npcSystem) {
  const policyEngine = new PolicyEngine();

  // Initialize progression engine if available
  if (typeof progressionEngine.init === 'function') {
    try {
      await progressionEngine.init();
    } catch (err) {
      logger.warn('Progression engine init failed', { error: err.message });
    }
  }

  const status = await runSelfCheck(npcSystem);

  setServiceContainer({
    npcSystem,
    npcSpawner: npcSystem?.npcSpawner || null,
    npcRegistry: npcSystem?.npcRegistry || null,
    progressionEngine,
    policyEngine,
    minecraftBridge: npcSystem?.minecraftBridge || null,
    mineflayerBridge: npcSystem?.mineflayerBridge || null,
    status,
  });

  return {
    progressionEngine,
    policyEngine,
    status,
  };
}

export async function runSelfCheck(npcSystem) {
  const status = {
    timestamp: new Date().toISOString(),
    progressionPhase: null,
    deadLetterQueueSize: 0,
    bridge: {
      rconConnected: false,
      pluginConnected: false,
      pluginHeartbeatAgeSeconds: null,
      mineflayerConnected: false,
    },
  };

  try {
    status.progressionPhase =
      typeof progressionEngine.getPhase === 'function'
        ? progressionEngine.getPhase()
        : progressionEngine.currentPhase || null;
  } catch (err) {
    logger.warn('Progression phase check failed', { error: err.message });
  }

  if (npcSystem?.npcSpawner?.getDeadLetterQueue) {
    try {
      status.deadLetterQueueSize = npcSystem.npcSpawner.getDeadLetterQueue().length;
    } catch (err) {
      logger.warn('Dead letter queue check failed', { error: err.message });
    }
  }

  const bridge = npcSystem?.minecraftBridge;
  if (bridge) {
    try {
      const result =
        typeof bridge.checkConnection === 'function'
          ? bridge.checkConnection()
          : { rconConnected: bridge.isConnected?.() || false };
      status.bridge.rconConnected = Boolean(result.rconConnected);
      status.bridge.pluginConnected = Boolean(result.pluginConnected);
      status.bridge.pluginHeartbeatAgeSeconds =
        typeof result.pluginHeartbeatAgeSeconds === 'number'
          ? result.pluginHeartbeatAgeSeconds
          : bridge.getHeartbeatAgeSeconds?.() ?? null;
    } catch (err) {
      logger.warn('Bridge connection check failed', { error: err.message });
    }
  }

  const mineflayer = npcSystem?.mineflayerBridge;
  if (mineflayer) {
    try {
      status.bridge.mineflayerConnected =
        typeof mineflayer.isConnected === 'function' ? mineflayer.isConnected() : false;
    } catch (err) {
      logger.warn('Mineflayer bridge check failed', { error: err.message });
    }
  }

  setServiceContainer({ status });

  return status;
}
