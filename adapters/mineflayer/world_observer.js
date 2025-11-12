/**
 * World State Observer - Real-time environmental awareness
 *
 * This module provides comprehensive world state snapshots for autonomous
 * decision-making. It scans and caches:
 *
 * 1. Bot state (position, health, inventory, etc.)
 * 2. Nearby entities (players, mobs, items)
 * 3. Block data (resources, hazards, structures)
 * 4. Biome and environmental conditions
 * 5. Events (block breaks, entity spawns, chat messages)
 *
 * Used by the autonomy loop for the "Observe" phase.
 */

import { logger } from '../../logger.js';

export class WorldStateObserver {
  constructor(bridge, options = {}) {
    if (!bridge) {
      throw new Error('WorldStateObserver requires a valid MineflayerBridge');
    }

    this.bridge = bridge;
    this.options = {
      scanRadius: options.scanRadius || 32,
      blockScanRadius: options.blockScanRadius || 16,
      updateInterval: options.updateInterval || 2000,
      cacheSize: options.cacheSize || 100,
      trackEvents: options.trackEvents !== false,
      ...options
    };

    this.worldState = new Map(); // botId -> world state snapshot
    this.eventHistory = new Map(); // botId -> [{type, data, timestamp}]
    this.blockCache = new Map(); // botId -> {position -> block_info}
    this.entityCache = new Map(); // botId -> {entityId -> entity_info}
    this.scanTimers = new Map(); // botId -> interval ID

    logger.info('WorldStateObserver initialized', {
      scanRadius: this.options.scanRadius,
      updateInterval: this.options.updateInterval
    });
  }

  /**
   * Start observing a bot
   * @param {string} botId - Bot ID to observe
   */
  startObserving(botId) {
    if (this.scanTimers.has(botId)) {
      logger.warn('Already observing bot', { botId });
      return;
    }

    logger.info('Starting world observation', { botId });

    // Initialize caches
    this.worldState.set(botId, null);
    this.eventHistory.set(botId, []);
    this.blockCache.set(botId, new Map());
    this.entityCache.set(botId, new Map());

    // Perform initial scan
    this._performScan(botId);

    // Set up periodic scanning
    const timer = setInterval(() => {
      this._performScan(botId);
    }, this.options.updateInterval);

    this.scanTimers.set(botId, timer);
  }

  /**
   * Stop observing a bot
   * @param {string} botId - Bot ID
   */
  stopObserving(botId) {
    const timer = this.scanTimers.get(botId);
    if (timer) {
      clearInterval(timer);
      this.scanTimers.delete(botId);
      logger.info('Stopped world observation', { botId });
    }
  }

  /**
   * Get current world state snapshot
   * @param {string} botId - Bot ID
   * @returns {Object|null}
   */
  getWorldState(botId) {
    return this.worldState.get(botId) || null;
  }

  /**
   * Get event history for a bot
   * @param {string} botId - Bot ID
   * @param {number} limit - Max events to return (default 50)
   * @returns {Array}
   */
  getEventHistory(botId, limit = 50) {
    const events = this.eventHistory.get(botId) || [];
    return events.slice(-limit);
  }

  /**
   * Scan area for blocks with specific properties
   * @param {string} botId - Bot ID
   * @param {Object} filter - {name?, hardness?, minY?, maxY?}
   * @returns {Array} - Matching blocks with positions
   */
  scanForBlocks(botId, filter = {}) {
    const state = this.worldState.get(botId);
    if (!state) return [];

    const blockCache = this.blockCache.get(botId) || new Map();
    const results = [];

    for (const [posStr, blockInfo] of blockCache.entries()) {
      // Apply filters
      if (filter.name && blockInfo.name !== filter.name) continue;
      if (filter.hardness !== undefined && blockInfo.hardness !== filter.hardness) continue;
      if (filter.minY && blockInfo.position.y < filter.minY) continue;
      if (filter.maxY && blockInfo.position.y > filter.maxY) continue;

      results.push(blockInfo);
    }

    return results;
  }

  /**
   * Find nearby entities matching criteria
   * @param {string} botId - Bot ID
   * @param {Object} filter - {type?, name?, health?, distance?}
   * @returns {Array} - Matching entities
   */
  findEntities(botId, filter = {}) {
    const entities = this.entityCache.get(botId);
    if (!entities) return [];

    const results = [];

    for (const entity of entities.values()) {
      // Apply filters
      if (filter.type && entity.type !== filter.type) continue;
      if (filter.name && entity.name !== filter.name) continue;
      if (filter.health !== undefined && entity.health < filter.health) continue;
      if (
        filter.distance &&
        entity.distance > filter.distance
      )
        continue;

      results.push(entity);
    }

    return results;
  }

  /**
   * Get nearest entity of a type
   * @param {string} botId - Bot ID
   * @param {string} type - Entity type (player, zombie, creeper, etc.)
   * @returns {Object|null}
   */
  getNearestEntity(botId, type) {
    const entities = this.findEntities(botId, { type });
    if (entities.length === 0) return null;

    // Sort by distance and return nearest
    entities.sort((a, b) => a.distance - b.distance);
    return entities[0];
  }

  /**
   * Get nearest block of type
   * @param {string} botId - Bot ID
   * @param {string} blockName - Block name (stone, ore_diamond, etc.)
   * @returns {Object|null}
   */
  getNearestBlock(botId, blockName) {
    const blocks = this.scanForBlocks(botId, { name: blockName });
    if (blocks.length === 0) return null;

    // Sort by distance and return nearest
    blocks.sort((a, b) => a.distance - b.distance);
    return blocks[0];
  }

  /**
   * Check if position is safe to move to
   * @param {string} botId - Bot ID
   * @param {Object} position - {x, y, z}
   * @returns {Object} - {safe: boolean, hazards: []}
   */
  isSafePosition(botId, position) {
    const bot = this.bridge.getBot(botId);
    if (!bot) return { safe: false, hazards: ['Bot not found'] };

    const hazards = [];

    // Check for lava
    const lavaBlock = bot.blockAt({ x: position.x, y: position.y, z: position.z });
    if (lavaBlock && lavaBlock.name.includes('lava')) {
      hazards.push('Lava');
    }

    // Check for dangerous mobs nearby
    const dangerousMobs = this.findEntities(botId, { type: 'hostile', distance: 10 });
    if (dangerousMobs.length > 0) {
      hazards.push(`${dangerousMobs.length} hostile mob(s) nearby`);
    }

    // Check for water below (might be okay for swimming)
    const blockBelow = bot.blockAt({
      x: position.x,
      y: position.y - 1,
      z: position.z
    });
    if (blockBelow && blockBelow.name.includes('water')) {
      // Water is generally okay, just note it
      // hazards.push('Water');
    }

    // Check for fall damage
    const blockAbove = bot.blockAt(position);
    if (!blockAbove || !blockAbove.name || blockAbove.name === 'air') {
      const blocksBelowGround = bot.blockAt({
        x: position.x,
        y: position.y - 5,
        z: position.z
      });
      if (!blocksBelowGround || blocksBelowGround.name === 'air') {
        hazards.push('High fall risk');
      }
    }

    return {
      safe: hazards.length === 0,
      hazards,
      position
    };
  }

  /**
   * Record an event (internal or external)
   * @param {string} botId - Bot ID
   * @param {string} type - Event type
   * @param {Object} data - Event data
   */
  recordEvent(botId, type, data = {}) {
    if (!this.options.trackEvents) return;

    if (!this.eventHistory.has(botId)) {
      this.eventHistory.set(botId, []);
    }

    const event = {
      type,
      data,
      timestamp: new Date().toISOString(),
      botId
    };

    const history = this.eventHistory.get(botId);
    history.push(event);

    // Trim history to cache size
    if (history.length > this.options.cacheSize) {
      history.shift();
    }

    logger.debug('Event recorded', { botId, type });
  }

  /**
   * Perform a full world scan
   * @private
   */
  _performScan(botId) {
    try {
      const bot = this.bridge.getBot(botId);
      if (!bot || !bot.entity) {
        logger.warn('Cannot scan: bot not found or not spawned', { botId });
        return;
      }

      const botPos = bot.entity.position;

      // Create world state object
      const state = {
        timestamp: new Date().toISOString(),
        botId,
        botState: {
          position: { x: botPos.x, y: botPos.y, z: botPos.z },
          health: bot.health,
          food: bot.food,
          yaw: bot.entity.yaw,
          pitch: bot.entity.pitch,
          dimension: bot.game?.dimension || 'unknown',
          isAlive: bot.health > 0
        },
        entities: [],
        blocks: [],
        biome: this._getBiomeInfo(bot),
        summary: {
          nearbyPlayers: 0,
          nearbyHostiles: 0,
          nearbyPassives: 0,
          resourceBlocks: []
        }
      };

      // Scan entities
      const entities = this.entityCache.get(botId) || new Map();
      entities.clear();

      for (const entity of bot.nearestEntity() || []) {
        if (!entity || !entity.position) continue;

        const distance = botPos.distanceTo(entity.position);
        if (distance > this.options.scanRadius) continue;

        const entityInfo = {
          id: entity.id,
          name: entity.name,
          type: entity.type,
          position: { x: entity.position.x, y: entity.position.y, z: entity.position.z },
          distance,
          health: entity.health,
          yaw: entity.yaw,
          pitch: entity.pitch
        };

        entities.set(entity.id, entityInfo);
        state.entities.push(entityInfo);

        // Update summary
        if (entity.type === 'player') state.summary.nearbyPlayers++;
        if (entity.type === 'hostile') state.summary.nearbyHostiles++;
        if (entity.type === 'passive') state.summary.nearbyPassives++;
      }

      // Scan blocks
      const blockCache = this.blockCache.get(botId) || new Map();
      blockCache.clear();

      const radius = this.options.blockScanRadius;
      const blockTypes = new Set();

      for (let x = botPos.x - radius; x <= botPos.x + radius; x++) {
        for (let y = botPos.y - radius; y <= botPos.y + radius; y++) {
          for (let z = botPos.z - radius; z <= botPos.z + radius; z++) {
            const block = bot.blockAt({ x, y, z });
            if (!block || block.name === 'air' || block.name === 'void_air') continue;

            const distance = Math.sqrt(
              Math.pow(x - botPos.x, 2) +
              Math.pow(y - botPos.y, 2) +
              Math.pow(z - botPos.z, 2)
            );

            const blockInfo = {
              name: block.name,
              position: { x, y, z },
              distance,
              hardness: block.hardness,
              material: block.material,
              isDiggable: block.diggable
            };

            const posStr = `${x},${y},${z}`;
            blockCache.set(posStr, blockInfo);
            state.blocks.push(blockInfo);
            blockTypes.add(block.name);

            // Track resource blocks
            if (this._isResourceBlock(block.name)) {
              state.summary.resourceBlocks.push({
                type: block.name,
                position: { x, y, z },
                distance
              });
            }
          }
        }
      }

      // Store state
      this.worldState.set(botId, state);

      logger.debug('World scan completed', {
        botId,
        entities: state.entities.length,
        blocks: state.blocks.length,
        blockTypes: blockTypes.size
      });

    } catch (error) {
      logger.error('Scan error', { botId, error: error.message });
    }
  }

  /**
   * Get biome information
   * @private
   */
  _getBiomeInfo(bot) {
    try {
      const biomeId = bot.getBiome?.();
      return {
        id: biomeId?.id || 'unknown',
        name: biomeId?.name || 'unknown',
        rain: bot.world?.isRaining || false,
        thunder: bot.world?.isThundering || false
      };
    } catch (e) {
      return {
        id: 'unknown',
        name: 'unknown',
        rain: false,
        thunder: false
      };
    }
  }

  /**
   * Check if block is a resource
   * @private
   */
  _isResourceBlock(blockName) {
    const resources = [
      'coal_ore',
      'iron_ore',
      'gold_ore',
      'diamond_ore',
      'emerald_ore',
      'redstone_ore',
      'lapis_ore',
      'copper_ore',
      'stone',
      'cobblestone',
      'oak_log',
      'birch_log',
      'spruce_log',
      'dark_oak_log',
      'jungle_log',
      'acacia_log'
    ];

    return resources.some((r) => blockName.includes(r));
  }
}

export default WorldStateObserver;
