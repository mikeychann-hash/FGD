/**
 * MineflayerBridge - Native Minecraft bot control via Mineflayer
 *
 * This class provides native Mineflayer bot control with:
 * - Direct bot spawning and connection
 * - Movement and pathfinding
 * - Mining and block interaction
 * - Inventory management
 * - World awareness (blocks, entities)
 * - Event-driven responsiveness
 *
 * Architecture: One MineflayerBridge instance manages multiple bot connections
 */

import EventEmitter from 'events';
import mineflayer from 'mineflayer';
import pathfinderPlugin from 'mineflayer-pathfinder';
import { logger } from './logger.js';

const { pathfinder, Movements, goals } = pathfinderPlugin;

/**
 * MineflayerBridge - Native bot control layer
 * @extends EventEmitter
 * @emits bot_spawned - Bot successfully connected
 * @emits bot_disconnected - Bot disconnected
 * @emits bot_error - Bot encountered error
 * @emits bot_moved - Bot changed position
 * @emits bot_health_changed - Bot health updated
 * @emits entity_detected - New entity discovered nearby
 */
export class MineflayerBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      host: options.host || 'localhost',
      port: options.port || 25565,
      version: options.version || '1.20.1',
      auth: options.auth || 'offline',
      ...options
    };

    this.bots = new Map(); // botId -> mineflayer bot instance
    this.botStates = new Map(); // botId -> {position, health, food, inventory}
    this.isInitialized = false;

    logger.info('MineflayerBridge initialized', { host: this.options.host, port: this.options.port });
  }

  /**
   * Spawn a bot and connect to the Minecraft server
   * @param {string} botId - Unique bot identifier
   * @param {Object} options - Bot options
   * @returns {Promise<{success: boolean, botId: string, position: Object, health: number}>}
   */
  async createBot(botId, options = {}) {
    try {
      if (this.bots.has(botId)) {
        throw new Error(`Bot ${botId} already exists`);
      }

      logger.info('Creating bot', { botId, username: botId });

      const botOptions = {
        host: this.options.host,
        port: this.options.port,
        username: options.username || botId,
        auth: this.options.auth,
        version: options.version || this.options.version
      };

      // Create bot instance
      const bot = mineflayer.createBot(botOptions);

      // Load pathfinder plugin
      bot.loadPlugin(pathfinder);

      // Wait for spawn event with timeout
      await this._waitForEvent(bot, 'spawn', 30000, `Bot ${botId} spawn timeout`);

      // Store bot instance
      this.bots.set(botId, bot);

      // Initialize bot state
      this._initializeBotState(botId, bot);

      // Attach event listeners
      this._attachBotListeners(botId, bot);

      const result = {
        success: true,
        botId,
        position: this._getPosition(bot),
        health: bot.health,
        food: bot.food
      };

      logger.info('Bot created successfully', result);
      this.emit('bot_spawned', result);
      return result;

    } catch (err) {
      logger.error('Failed to create bot', { botId, error: err.message });
      this.emit('bot_error', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * Disconnect a bot gracefully
   * @param {string} botId - Bot identifier
   * @returns {Promise<{success: boolean}>}
   */
  async disconnectBot(botId) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) {
        return { success: false, error: `Bot ${botId} not found` };
      }

      logger.info('Disconnecting bot', { botId });
      bot.quit();
      this.bots.delete(botId);
      this.botStates.delete(botId);

      logger.info('Bot disconnected', { botId });
      this.emit('bot_disconnected', { botId });
      return { success: true };

    } catch (err) {
      logger.error('Failed to disconnect bot', { botId, error: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * Move bot to a target position using pathfinding
   * @param {string} botId - Bot identifier
   * @param {Object} target - Target position {x, y, z}
   * @param {Object} options - Movement options
   * @returns {Promise<{success: boolean, position: Object}>}
   */
  async moveToPosition(botId, target, options = {}) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      logger.debug('Moving bot to position', { botId, target });

      // Setup movements
      const movements = new Movements(bot);
      bot.pathfinder.setMovements(movements);

      // Set goal
      const goal = new goals.GoalNear(target.x, target.y, target.z, options.range || 1);

      // Go to position with timeout
      const timeout = options.timeout || 60000;
      await this._withTimeout(
        bot.pathfinder.goto(goal),
        timeout,
        `Movement to ${JSON.stringify(target)} timed out`
      );

      const position = this._getPosition(bot);
      logger.debug('Bot reached destination', { botId, position });

      return {
        success: true,
        position
      };

    } catch (err) {
      logger.error('Failed to move bot', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * Follow an entity
   * @param {string} botId - Bot identifier
   * @param {Object} targetPos - Target position or entity position
   * @param {Object} options - Follow options
   * @returns {Promise<{success: boolean}>}
   */
  async followEntity(botId, targetPos, options = {}) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      const range = options.range || 3;
      logger.debug('Following entity', { botId, targetPos, range });

      const movements = new Movements(bot);
      bot.pathfinder.setMovements(movements);

      const goal = new goals.GoalFollow(targetPos, range);
      await this._withTimeout(
        bot.pathfinder.goto(goal),
        options.timeout || 30000
      );

      return { success: true };

    } catch (err) {
      logger.error('Failed to follow entity', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * Stop current movement
   * @param {string} botId - Bot identifier
   * @returns {Promise<{success: boolean}>}
   */
  async stopMovement(botId) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      bot.pathfinder.stop();
      logger.debug('Movement stopped', { botId });
      return { success: true };

    } catch (err) {
      logger.error('Failed to stop movement', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * Get current bot position
   * @param {string} botId - Bot identifier
   * @returns {Object} Position {x, y, z}
   */
  getPosition(botId) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Bot ${botId} not found`);
    return this._getPosition(bot);
  }

  /**
   * Find blocks nearby
   * @param {string} botId - Bot identifier
   * @param {Object} options - Search options
   * @returns {Array} Array of block positions
   */
  findBlocks(botId, options = {}) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      const blockType = options.blockType || options.matching;
      const maxDistance = options.maxDistance || 32;
      const count = options.count || 10;

      const blocks = bot.findBlocks({
        matching: (block) => {
          if (typeof blockType === 'string') {
            return block.name === blockType;
          }
          return blockType(block);
        },
        maxDistance,
        count
      });

      logger.debug('Blocks found', { botId, blockType, found: blocks.length });
      return blocks.map(b => ({ x: b.position.x, y: b.position.y, z: b.position.z, name: b.name }));

    } catch (err) {
      logger.error('Failed to find blocks', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * Dig a block
   * @param {string} botId - Bot identifier
   * @param {Object} position - Block position {x, y, z}
   * @param {Object} options - Dig options
   * @returns {Promise<{success: boolean, blockType: string}>}
   */
  async digBlock(botId, position, options = {}) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      logger.debug('Digging block', { botId, position });

      // Find the block
      const block = bot.blockAt({
        x: Math.round(position.x),
        y: Math.round(position.y),
        z: Math.round(position.z)
      });

      if (!block) {
        throw new Error(`No block at position ${JSON.stringify(position)}`);
      }

      // Optional: equip tool
      if (options.equipTool) {
        this._equipBestTool(bot, block);
      }

      // Dig the block
      await this._withTimeout(
        bot.dig(block),
        options.timeout || 30000,
        `Digging block timed out`
      );

      logger.debug('Block dug', { botId, blockType: block.name });
      return {
        success: true,
        blockType: block.name,
        position: { x: block.position.x, y: block.position.y, z: block.position.z }
      };

    } catch (err) {
      logger.error('Failed to dig block', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * Place a block
   * @param {string} botId - Bot identifier
   * @param {Object} position - Block position to place at {x, y, z}
   * @param {Object} options - Placement options
   * @returns {Promise<{success: boolean}>}
   */
  async placeBlock(botId, position, options = {}) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      logger.debug('Placing block', { botId, position });

      const blockType = options.blockType || options.block;
      if (!blockType) {
        throw new Error('blockType required for placement');
      }

      // Find block in inventory
      const item = bot.inventory.items().find(i => i.name === blockType || i.name.includes(blockType));
      if (!item) {
        throw new Error(`No ${blockType} in inventory`);
      }

      // Equip the block
      await bot.equip(item, 'hand');

      // Find reference block to place against
      const refBlock = bot.blockAt({
        x: Math.round(position.x),
        y: Math.round(position.y),
        z: Math.round(position.z)
      });

      if (!refBlock) {
        throw new Error(`No reference block at ${JSON.stringify(position)}`);
      }

      // Place block
      const face = options.face || 'top'; // top, bottom, north, south, east, west
      const faceDir = this._getFaceDirection(face);

      await this._withTimeout(
        bot.placeBlock(refBlock, faceDir),
        options.timeout || 30000
      );

      logger.debug('Block placed', { botId, blockType });
      return { success: true, blockType };

    } catch (err) {
      logger.error('Failed to place block', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * Get bot inventory
   * @param {string} botId - Bot identifier
   * @returns {Array} Inventory items
   */
  getInventory(botId) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      return bot.inventory.items().map(item => ({
        name: item.name,
        count: item.count,
        type: item.type,
        metadata: item.metadata,
        slot: item.slot
      }));

    } catch (err) {
      logger.error('Failed to get inventory', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * Equip an item
   * @param {string} botId - Bot identifier
   * @param {Object} options - Equip options {item, destination}
   * @returns {Promise<{success: boolean}>}
   */
  async equipItem(botId, options = {}) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      const { item, destination = 'hand' } = options;
      if (!item) throw new Error('item required');

      logger.debug('Equipping item', { botId, item, destination });

      const inventoryItem = bot.inventory.items().find(i => i.name === item);
      if (!inventoryItem) {
        throw new Error(`No ${item} in inventory`);
      }

      await bot.equip(inventoryItem, destination);
      return { success: true };

    } catch (err) {
      logger.error('Failed to equip item', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * Drop an item
   * @param {string} botId - Bot identifier
   * @param {Object} options - Drop options {item, count}
   * @returns {Promise<{success: boolean}>}
   */
  async dropItem(botId, options = {}) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      const { item, count = 1 } = options;
      if (!item) throw new Error('item required');

      logger.debug('Dropping item', { botId, item, count });

      const inventoryItem = bot.inventory.items().find(i => i.name === item);
      if (!inventoryItem) {
        return { success: false, error: `No ${item} in inventory` };
      }

      await bot.toss(inventoryItem, count);
      return { success: true };

    } catch (err) {
      logger.error('Failed to drop item', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * Find entities nearby
   * @param {string} botId - Bot identifier
   * @param {Object} options - Filter options
   * @returns {Array} Array of entities
   */
  findEntities(botId, options = {}) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      const maxDistance = options.maxDistance || 32;
      const entityType = options.type || options.entityType;

      const entities = Object.values(bot.entities)
        .filter(entity => {
          if (entity.id === bot.entity.id) return false; // Exclude self
          if (entityType && !entity.name.includes(entityType)) return false;
          if (maxDistance) {
            const dist = bot.entity.position.distanceTo(entity.position);
            if (dist > maxDistance) return false;
          }
          return true;
        })
        .map(entity => ({
          id: entity.id,
          type: entity.name,
          position: { x: entity.position.x, y: entity.position.y, z: entity.position.z },
          health: entity.metadata?.[8] || 20,
          velocity: entity.velocity
        }));

      logger.debug('Entities found', { botId, count: entities.length, type: entityType });
      return entities;

    } catch (err) {
      logger.error('Failed to find entities', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * Get blocks in view around bot
   * @param {string} botId - Bot identifier
   * @param {number} distance - Distance to check
   * @returns {Array} Blocks in view
   */
  getBlocksInView(botId, distance = 5) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      const blocks = [];
      const pos = bot.entity.position;
      const x = Math.round(pos.x);
      const y = Math.round(pos.y);
      const z = Math.round(pos.z);

      for (let dx = -distance; dx <= distance; dx++) {
        for (let dy = -distance; dy <= distance; dy++) {
          for (let dz = -distance; dz <= distance; dz++) {
            const block = bot.blockAt({ x: x + dx, y: y + dy, z: z + dz });
            if (block && block.name !== 'air') {
              blocks.push({
                position: { x: block.position.x, y: block.position.y, z: block.position.z },
                type: block.name,
                metadata: block.metadata
              });
            }
          }
        }
      }

      return blocks;

    } catch (err) {
      logger.error('Failed to get blocks in view', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * Get complete bot state
   * @param {string} botId - Bot identifier
   * @returns {Object} Bot state
   */
  getBotState(botId) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      const state = this.botStates.get(botId) || {};

      return {
        botId,
        isConnected: true,
        position: this._getPosition(bot),
        health: bot.health,
        food: bot.food,
        dimension: bot.game?.dimension,
        yaw: bot.entity?.yaw,
        pitch: bot.entity?.pitch,
        inventory: bot.inventory.items().length,
        inventoryItems: bot.inventory.items().map(i => ({ name: i.name, count: i.count })),
        nearby: {
          entities: this.findEntities(botId, { maxDistance: 32 }).length,
          blocks: this.getBlocksInView(botId, 5).length
        },
        lastUpdate: new Date().toISOString()
      };

    } catch (err) {
      logger.error('Failed to get bot state', { botId, error: err.message });
      throw err;
    }
  }

  /**
   * List all connected bots
   * @returns {Array} Array of bot info
   */
  listBots() {
    const bots = [];
    for (const [botId, bot] of this.bots) {
      try {
        bots.push({
          botId,
          position: this._getPosition(bot),
          health: bot.health,
          status: 'active'
        });
      } catch (err) {
        bots.push({
          botId,
          status: 'error',
          error: err.message
        });
      }
    }
    return bots;
  }

  /**
   * Send chat message
   * @param {string} botId - Bot identifier
   * @param {string} message - Message to send
   * @returns {Promise<{success: boolean}>}
   */
  async sendChat(botId, message) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);

      bot.chat(message);
      logger.debug('Chat sent', { botId, message });
      return { success: true };

    } catch (err) {
      logger.error('Failed to send chat', { botId, error: err.message });
      throw err;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  _getPosition(bot) {
    if (!bot?.entity?.position) return { x: 0, y: 0, z: 0 };
    return {
      x: bot.entity.position.x,
      y: bot.entity.position.y,
      z: bot.entity.position.z
    };
  }

  _initializeBotState(botId, bot) {
    this.botStates.set(botId, {
      position: this._getPosition(bot),
      health: bot.health,
      food: bot.food,
      inventory: bot.inventory.items().length
    });
  }

  _attachBotListeners(botId, bot) {
    // Position updates
    bot.on('move', () => {
      const position = this._getPosition(bot);
      this.botStates.set(botId, {
        ...this.botStates.get(botId),
        position
      });
      this.emit('bot_moved', { botId, position });
    });

    // Health updates
    bot.on('health', () => {
      this.botStates.set(botId, {
        ...this.botStates.get(botId),
        health: bot.health
      });
      this.emit('bot_health_changed', { botId, health: bot.health });
    });

    // Disconnection
    bot.on('end', () => {
      logger.warn('Bot disconnected', { botId });
      this.bots.delete(botId);
      this.botStates.delete(botId);
      this.emit('bot_disconnected', { botId });
    });

    // Errors
    bot.on('error', (err) => {
      logger.error('Bot error', { botId, error: err.message });
      this.emit('bot_error', { botId, error: err.message });
    });

    // Entity spawn
    bot.on('entitySpawn', (entity) => {
      if (entity.id !== bot.entity.id) {
        this.emit('entity_detected', { botId, entity: entity.name, position: entity.position });
      }
    });
  }

  _equipBestTool(bot, block) {
    // Find best tool for block type
    const tools = {
      'stone': ['stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe'],
      'ore': ['iron_pickaxe', 'diamond_pickaxe'],
      'wood': ['wooden_axe', 'stone_axe', 'iron_axe'],
      'dirt': ['wooden_shovel', 'stone_shovel', 'iron_shovel']
    };

    let tool = null;
    for (const [blockType, toolList] of Object.entries(tools)) {
      if (block.name.includes(blockType)) {
        tool = bot.inventory.items().find(i => toolList.includes(i.name));
        if (tool) break;
      }
    }

    if (tool) {
      bot.equip(tool, 'hand').catch(err => {
        logger.warn('Failed to equip tool', { error: err.message });
      });
    }
  }

  _getFaceDirection(face) {
    const directions = {
      'top': { x: 0, y: 1, z: 0 },
      'bottom': { x: 0, y: -1, z: 0 },
      'north': { x: 0, y: 0, z: -1 },
      'south': { x: 0, y: 0, z: 1 },
      'east': { x: 1, y: 0, z: 0 },
      'west': { x: -1, y: 0, z: 0 }
    };
    return directions[face] || directions['top'];
  }

  async _waitForEvent(emitter, eventName, timeout, timeoutMessage) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        emitter.removeListener(eventName, onEvent);
        reject(new Error(timeoutMessage));
      }, timeout);

      const onEvent = () => {
        clearTimeout(timer);
        emitter.removeListener(eventName, onEvent);
        resolve();
      };

      emitter.once(eventName, onEvent);
    });
  }

  async _withTimeout(promise, timeout, timeoutMessage = 'Operation timed out') {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(timeoutMessage)), timeout);
      })
    ]);
  }
}

export default MineflayerBridge;
