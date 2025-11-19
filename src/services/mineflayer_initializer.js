/**
 * MineflayerBridge Initialization Module
 *
 * Manages Mineflayer bot bridge initialization and integration with NPCSystem.
 * Supports both Mineflayer (native) and RCON (fallback) modes.
 */

import { logger } from '../../logger.js';
import { MineflayerBridge } from '../../minecraft_bridge_mineflayer.js';
import { MineTaskExecutor } from '../executors/MineTaskExecutor.js';
import { MovementTaskExecutor } from '../executors/MovementTaskExecutor.js';
import { InventoryTaskExecutor } from '../executors/InventoryTaskExecutor.js';
import { CombatTaskExecutor } from '../executors/CombatTaskExecutor.js';
import { CraftTaskExecutor } from '../executors/CraftTaskExecutor.js';

/**
 * Initialize Mineflayer bridge
 * @param {Object} options - Configuration options
 * @returns {Promise<MineflayerBridge|null>}
 */
export async function initializeMineflayerBridge(options = {}) {
  try {
    const host = options.host || process.env.MINECRAFT_HOST || 'localhost';
    const port = parseInt(options.port || process.env.MINECRAFT_PORT || '25565');
    const version = options.version || process.env.MINECRAFT_VERSION || '1.20.1';

    logger.info('Initializing Mineflayer Bridge', { host, port, version });
    console.log(`🎮 Initializing Mineflayer Bridge for ${host}:${port} (v${version})`);

    const bridge = new MineflayerBridge({
      host,
      port,
      version,
      auth: 'offline',
    });

    // Attach event listeners for logging
    bridge.on('bot_spawned', (data) => {
      logger.info('Bot spawned via Mineflayer', { botId: data.botId, position: data.position });
      console.log(
        `✅ Bot spawned: ${data.botId} at (${data.position.x}, ${data.position.y}, ${data.position.z})`
      );
    });

    bridge.on('bot_disconnected', (data) => {
      logger.warn('Bot disconnected', { botId: data.botId });
      console.log(`🔴 Bot disconnected: ${data.botId}`);
    });

    bridge.on('bot_error', (data) => {
      logger.error('Bot error', { botId: data.botId, error: data.error });
      console.error(`❌ Bot error: ${data.botId} - ${data.error}`);
    });

    logger.info('Mineflayer Bridge initialized successfully');
    console.log('✅ Mineflayer Bridge initialized');

    return bridge;
  } catch (err) {
    logger.error('Failed to initialize Mineflayer Bridge', { error: err.message });
    console.error('❌ Failed to initialize Mineflayer Bridge:', err.message);
    return null;
  }
}

/**
 * Create task executors
 * @param {MineflayerBridge} bridge - Mineflayer bridge instance
 * @returns {Object} Map of executor instances
 */
export function createTaskExecutors(bridge) {
  if (!bridge) {
    logger.warn('Task executors cannot be created without Mineflayer bridge');
    return {};
  }

  try {
    const executors = {
      mine: new MineTaskExecutor(bridge),
      move: new MovementTaskExecutor(bridge),
      movement: new MovementTaskExecutor(bridge), // Alias
      inventory: new InventoryTaskExecutor(bridge),
      combat: new CombatTaskExecutor(bridge),
      craft: new CraftTaskExecutor(bridge),
    };

    logger.info('Task executors created', { executors: Object.keys(executors) });
    console.log(`✅ Task executors created: ${Object.keys(executors).join(', ')}`);

    return executors;
  } catch (err) {
    logger.error('Failed to create task executors', { error: err.message });
    console.error('❌ Failed to create task executors:', err.message);
    return {};
  }
}

/**
 * Attach Mineflayer bridge to NPC Engine
 * @param {NPCEngine} npcEngine - NPC engine instance
 * @param {MineflayerBridge} bridge - Mineflayer bridge instance
 * @param {Object} executors - Task executors map
 */
export function attachMineflayerBridge(npcEngine, bridge, executors) {
  if (!npcEngine || !bridge) {
    logger.warn('Cannot attach Mineflayer bridge without NPCEngine and bridge');
    return;
  }

  try {
    // Store bridge in engine
    npcEngine.mineflayerBridge = bridge;
    npcEngine.taskExecutors = executors;

    logger.info('Mineflayer bridge attached to NPC engine');
    console.log('✅ Mineflayer bridge attached to NPC engine');
  } catch (err) {
    logger.error('Failed to attach Mineflayer bridge', { error: err.message });
    console.error('❌ Failed to attach Mineflayer bridge:', err.message);
  }
}

/**
 * Bridge Mineflayer events to NPC system
 * @param {MineflayerBridge} bridge - Mineflayer bridge
 * @param {NPCEngine} npcEngine - NPC engine
 * @param {Object} io - Socket.IO instance for WebSocket events
 */
export function bridgeMineflayerEvents(bridge, npcEngine, io) {
  if (!bridge || !npcEngine) {
    logger.warn('Cannot bridge Mineflayer events without bridge and engine');
    return;
  }

  try {
    // Bot movement event
    bridge.on('bot_moved', (data) => {
      const npc = npcEngine.npcs.get(data.botId);
      if (npc) {
        npc.lastPosition = data.position;
        npc.lastUpdate = new Date().toISOString();
      }
      if (io) io.emit('bot:moved', data);
    });

    // Bot health change
    bridge.on('bot_health_changed', (data) => {
      const npc = npcEngine.npcs.get(data.botId);
      if (npc && npc.runtime) {
        npc.runtime.health = data.health;
      }
      if (io) io.emit('bot:health_changed', data);
    });

    // Bot disconnection
    bridge.on('bot_disconnected', (data) => {
      const npc = npcEngine.npcs.get(data.botId);
      if (npc) {
        npc.status = 'inactive';
      }
      if (io) io.emit('bot:disconnected', data);
    });

    // Bot error
    bridge.on('bot_error', (data) => {
      const npc = npcEngine.npcs.get(data.botId);
      if (npc) {
        npc.lastError = data.error;
        npc.status = 'error';
      }
      if (io) io.emit('bot:error', data);
    });

    // Entity detected
    bridge.on('entity_detected', (data) => {
      if (io) io.emit('bot:entity_detected', data);
    });

    logger.info('Mineflayer events bridged to NPC system');
    console.log('✅ Mineflayer events bridged to NPC system');
  } catch (err) {
    logger.error('Failed to bridge Mineflayer events', { error: err.message });
    console.error('❌ Failed to bridge Mineflayer events:', err.message);
  }
}

/**
 * Execute task using Mineflayer
 * @param {string} botId - Bot identifier
 * @param {Object} task - Task to execute
 * @param {Object} executors - Task executors map
 * @returns {Promise<Object>} Task result
 */
export async function executeMineflayerTask(botId, task, executors) {
  if (!executors || !task) {
    throw new Error('Executors and task required');
  }

  const action = task.action || task.type;
  const executor = executors[action];

  if (!executor) {
    throw new Error(`No executor found for action: ${action}`);
  }

  logger.debug('Executing Mineflayer task', { botId, action });
  return await executor.execute(botId, task);
}

/**
 * Spawn bot via Mineflayer
 * @param {MineflayerBridge} bridge - Mineflayer bridge
 * @param {string} botId - Bot identifier
 * @param {Object} options - Spawn options
 * @returns {Promise<Object>} Spawn result
 */
export async function spawnBotViaMinecraft(bridge, botId, options = {}) {
  if (!bridge) {
    throw new Error('Mineflayer bridge required for bot spawning');
  }

  try {
    logger.info('Spawning bot via Mineflayer', { botId });

    const result = await bridge.createBot(botId, {
      username: options.username || botId,
      version: options.version,
    });

    if (result.success) {
      logger.info('Bot spawned successfully', { botId, position: result.position });
    }

    return result;
  } catch (err) {
    logger.error('Failed to spawn bot', { botId, error: err.message });
    throw err;
  }
}

/**
 * Despawn bot via Mineflayer
 * @param {MineflayerBridge} bridge - Mineflayer bridge
 * @param {string} botId - Bot identifier
 * @returns {Promise<Object>} Despawn result
 */
export async function despawnBotViaMinecraft(bridge, botId) {
  if (!bridge) {
    throw new Error('Mineflayer bridge required for bot despawning');
  }

  try {
    logger.info('Despawning bot via Mineflayer', { botId });
    const result = await bridge.disconnectBot(botId);
    logger.info('Bot despawned', { botId });
    return result;
  } catch (err) {
    logger.error('Failed to despawn bot', { botId, error: err.message });
    throw err;
  }
}

/**
 * Get bot state from Mineflayer
 * @param {MineflayerBridge} bridge - Mineflayer bridge
 * @param {string} botId - Bot identifier
 * @returns {Object} Bot state
 */
export function getBotStateFromMinecraft(bridge, botId) {
  if (!bridge) {
    return null;
  }

  try {
    return bridge.getBotState(botId);
  } catch (err) {
    logger.warn('Failed to get bot state', { botId, error: err.message });
    return null;
  }
}

export default {
  initializeMineflayerBridge,
  createTaskExecutors,
  attachMineflayerBridge,
  bridgeMineflayerEvents,
  executeMineflayerTask,
  spawnBotViaMinecraft,
  despawnBotViaMinecraft,
  getBotStateFromMinecraft,
};
