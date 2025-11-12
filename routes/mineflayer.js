/**
 * Mineflayer Bot Routes
 *
 * REST API endpoints for native Mineflayer bot control.
 * Provides direct control over bot movement, mining, inventory, etc.
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { executeMineflayerTask, spawnBotViaMinecraft, despawnBotViaMinecraft } from '../src/services/mineflayer_initializer.js';
import { TASK_ROUTING_TABLE } from '../adapters/mineflayer/router.js';
import { logger } from '../logger.js';

/**
 * Initialize Mineflayer bot routes
 * @param {NPCSystem} npcSystem - NPC system instance
 * @param {Object} io - Socket.IO instance
 * @returns {express.Router}
 */
export function initMineflayerRoutes(npcSystem, io) {
  const router = express.Router();

  // Get bridge and executors from NPC system
  const mineflayerBridge = npcSystem?.mineflayerBridge;
  const taskExecutors = npcSystem?.taskExecutors;
  const npcEngine = npcSystem?.npcEngine;

  if (!mineflayerBridge) {
    logger.warn('Mineflayer routes initialized without bridge');
    // Return router anyway, routes will return appropriate errors
  }

  // ============================================================================
  // Bot Management Endpoints
  // ============================================================================

  /**
   * POST /api/mineflayer/spawn
   * Spawn a new bot via Mineflayer
   */
  router.post('/spawn', authenticate, authorize('write'), async (req, res) => {
    try {
      if (!mineflayerBridge) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer bridge not available'
        });
      }

      const { botId, username, version } = req.body;

      if (!botId) {
        return res.status(400).json({
          success: false,
          error: 'botId is required'
        });
      }

      logger.info('Spawning bot via Mineflayer', { botId, username });

      const result = await spawnBotViaMinecraft(mineflayerBridge, botId, {
        username: username || botId,
        version
      });

      // Update NPC engine registry if available
      if (npcEngine && npcEngine.npcs) {
        if (!npcEngine.npcs.has(botId)) {
          npcEngine.npcs.set(botId, {
            id: botId,
            type: 'mineflayer',
            status: 'active',
            position: result.position,
            runtime: {
              health: result.health,
              food: result.food
            },
            lastUpdate: new Date().toISOString()
          });
        }
      }

      res.json({
        success: result.success,
        botId: result.botId,
        position: result.position,
        health: result.health,
        food: result.food
      });

    } catch (err) {
      logger.error('Failed to spawn bot', { error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * DELETE /api/mineflayer/:botId
   * Despawn a bot
   */
  router.delete('/:botId', authenticate, authorize('write'), async (req, res) => {
    try {
      if (!mineflayerBridge) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer bridge not available'
        });
      }

      const { botId } = req.params;

      logger.info('Despawning bot', { botId });

      const result = await despawnBotViaMinecraft(mineflayerBridge, botId);

      // Update NPC engine registry
      if (npcEngine && npcEngine.npcs) {
        npcEngine.npcs.delete(botId);
      }

      res.json(result);

    } catch (err) {
      logger.error('Failed to despawn bot', { error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * GET /api/mineflayer/tasks
   * List supported Mineflayer task types
   */
  router.get('/tasks', authenticate, authorize('read'), (req, res) => {
    try {
      const taskTypes = Object.entries(TASK_ROUTING_TABLE).map(([type, config]) => ({
        type,
        handler: config.handler,
        description: config.description,
        dangerousAction: Boolean(config.dangerousAction),
        requiresBot: Boolean(config.requiresBot),
        requiresLocation: Boolean(config.requiresLocation)
      }));

      res.json({
        success: true,
        count: taskTypes.length,
        taskTypes
      });
    } catch (err) {
      logger.error('Failed to list Mineflayer tasks', { error: err.message });
      res.status(500).json({
        success: false,
        error: 'Failed to list Mineflayer tasks'
      });
    }
  });

  /**
   * GET /api/mineflayer/:botId
   * Get bot state
   */
  router.get('/:botId', authenticate, authorize('read'), (req, res) => {
    try {
      if (!mineflayerBridge) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer bridge not available'
        });
      }

      const { botId } = req.params;
      const state = mineflayerBridge.getBotState(botId);

      if (!state) {
        return res.status(404).json({
          success: false,
          error: `Bot ${botId} not found`
        });
      }

      res.json({
        success: true,
        bot: state
      });

    } catch (err) {
      logger.error('Failed to get bot state', { error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * GET /api/mineflayer
   * List all connected bots
   */
  router.get('/', authenticate, authorize('read'), (req, res) => {
    try {
      if (!mineflayerBridge) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer bridge not available',
          bots: []
        });
      }

      const bots = mineflayerBridge.listBots();

      res.json({
        success: true,
        count: bots.length,
        bots
      });

    } catch (err) {
      logger.error('Failed to list bots', { error: err.message });
      res.status(500).json({
        success: false,
        error: err.message,
        bots: []
      });
    }
  });

  // ============================================================================
  // Task Execution Endpoints
  // ============================================================================

  /**
   * POST /api/mineflayer/:botId/task
   * Execute a task on a bot
   */
  router.post('/:botId/task', authenticate, authorize('write'), async (req, res) => {
    try {
      if (!mineflayerBridge || !taskExecutors) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer task executors not available'
        });
      }

      const { botId } = req.params;
      const task = req.body;

      if (!task || !task.action) {
        return res.status(400).json({
          success: false,
          error: 'Task with action field is required'
        });
      }

      logger.info('Executing task via Mineflayer', { botId, action: task.action });

      const result = await executeMineflayerTask(botId, task, taskExecutors);

      res.json({
        success: result.success,
        task: task.action,
        result
      });

    } catch (err) {
      logger.error('Failed to execute task', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * POST /api/mineflayer/:botId/move
   * Move bot to position
   */
  router.post('/:botId/move', authenticate, authorize('write'), async (req, res) => {
    try {
      if (!mineflayerBridge || !taskExecutors) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer bridge not available'
        });
      }

      const { botId } = req.params;
      const { x, y, z, range, timeout } = req.body;

      if (x === undefined || y === undefined || z === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Position (x, y, z) is required'
        });
      }

      const task = {
        action: 'move',
        params: {
          target: { x, y, z },
          range: range || 1,
          timeout: timeout || 60000
        }
      };

      const result = await executeMineflayerTask(botId, task, taskExecutors);

      res.json({
        success: result.success,
        task: 'move',
        position: result.position,
        reached: result.reached
      });

    } catch (err) {
      logger.error('Failed to move bot', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * POST /api/mineflayer/:botId/mine
   * Mine blocks
   */
  router.post('/:botId/mine', authenticate, authorize('write'), async (req, res) => {
    try {
      if (!mineflayerBridge || !taskExecutors) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer bridge not available'
        });
      }

      const { botId } = req.params;
      const { blockType, count, range, veinMine } = req.body;

      if (!blockType) {
        return res.status(400).json({
          success: false,
          error: 'blockType is required'
        });
      }

      const task = {
        action: 'mine',
        params: {
          blockType,
          count: count || 1,
          range: range || 32,
          veinMine: veinMine || false,
          equipTool: true
        }
      };

      const result = await executeMineflayerTask(botId, task, taskExecutors);

      res.json({
        success: result.success,
        task: 'mine',
        mined: result.mined,
        blockType: result.blockType,
        inventory: result.inventory
      });

    } catch (err) {
      logger.error('Failed to mine', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * GET /api/mineflayer/:botId/inventory
   * Get bot inventory
   */
  router.get('/:botId/inventory', authenticate, authorize('read'), (req, res) => {
    try {
      if (!mineflayerBridge) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer bridge not available'
        });
      }

      const { botId } = req.params;
      const inventory = mineflayerBridge.getInventory(botId);

      res.json({
        success: true,
        botId,
        items: inventory,
        itemCount: inventory.length,
        slots: {
          used: inventory.length,
          total: 36
        }
      });

    } catch (err) {
      logger.error('Failed to get inventory', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * POST /api/mineflayer/:botId/equip
   * Equip an item
   */
  router.post('/:botId/equip', authenticate, authorize('write'), async (req, res) => {
    try {
      if (!mineflayerBridge || !taskExecutors) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer bridge not available'
        });
      }

      const { botId } = req.params;
      const task = {
        action: 'inventory',
        subAction: 'equip',
        params: req.body
      };

      const result = await executeMineflayerTask(botId, task, taskExecutors);

      res.json({
        success: result.success,
        task: 'equip',
        item: result.item,
        destination: result.destination
      });

    } catch (err) {
      logger.error('Failed to equip item', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * POST /api/mineflayer/:botId/chat
   * Send chat message
   */
  router.post('/:botId/chat', authenticate, authorize('write'), async (req, res) => {
    try {
      if (!mineflayerBridge) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer bridge not available'
        });
      }

      const { botId } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'message is required'
        });
      }

      const result = await mineflayerBridge.sendChat(botId, message);

      res.json({
        success: result.success,
        botId,
        message
      });

    } catch (err) {
      logger.error('Failed to send chat', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ============================================================================
  // Combat Endpoints (Phase 3)
  // ============================================================================

  /**
   * POST /api/mineflayer/:botId/combat
   * Execute combat action (attack, target, evade, defend)
   */
  router.post('/:botId/combat', authenticate, authorize('write'), async (req, res) => {
    try {
      if (!mineflayerBridge || !taskExecutors) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer combat system not available'
        });
      }

      const { botId } = req.params;
      const task = {
        action: 'combat',
        params: req.body
      };

      logger.info('Executing combat task', { botId, subAction: task.params.subAction });

      const result = await executeMineflayerTask(botId, task, taskExecutors);

      res.json({
        success: result.success,
        task: 'combat',
        result
      });

    } catch (err) {
      logger.error('Failed to execute combat task', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * POST /api/mineflayer/:botId/combat/attack
   * Attack nearest entity
   */
  router.post('/:botId/combat/attack', authenticate, authorize('write'), async (req, res) => {
    try {
      if (!mineflayerBridge || !taskExecutors) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer combat system not available'
        });
      }

      const { botId } = req.params;
      const { entityType = 'zombie', range = 16, timeout = 30000, autoWeapon = true } = req.body;

      const task = {
        action: 'combat',
        params: {
          subAction: 'attack',
          entityType,
          range,
          timeout,
          autoWeapon
        }
      };

      const result = await executeMineflayerTask(botId, task, taskExecutors);

      res.json({
        success: result.success,
        task: 'combat:attack',
        result
      });

    } catch (err) {
      logger.error('Failed to attack', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ============================================================================
  // Crafting Endpoints (Phase 3)
  // ============================================================================

  /**
   * POST /api/mineflayer/:botId/craft
   * Execute crafting action
   */
  router.post('/:botId/craft', authenticate, authorize('write'), async (req, res) => {
    try {
      if (!mineflayerBridge || !taskExecutors) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer crafting system not available'
        });
      }

      const { botId } = req.params;
      const task = {
        action: 'craft',
        params: req.body
      };

      logger.info('Executing craft task', { botId, recipe: task.params.recipe });

      const result = await executeMineflayerTask(botId, task, taskExecutors);

      res.json({
        success: result.success,
        task: 'craft',
        result
      });

    } catch (err) {
      logger.error('Failed to execute craft task', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * POST /api/mineflayer/:botId/craft/lookup
   * Look up recipe information
   */
  router.post('/:botId/craft/lookup', authenticate, authorize('read'), async (req, res) => {
    try {
      if (!mineflayerBridge || !taskExecutors) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer crafting system not available'
        });
      }

      const { botId } = req.params;
      const { recipe } = req.body;

      if (!recipe) {
        return res.status(400).json({
          success: false,
          error: 'recipe is required'
        });
      }

      const task = {
        action: 'craft',
        params: {
          subAction: 'lookup',
          recipe
        }
      };

      const result = await executeMineflayerTask(botId, task, taskExecutors);

      res.json({
        success: result.success,
        task: 'craft:lookup',
        result
      });

    } catch (err) {
      logger.error('Failed to lookup recipe', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * GET /api/mineflayer/:botId/craft/analyze
   * Analyze which recipes can be crafted with current inventory
   */
  router.get('/:botId/craft/analyze', authenticate, authorize('read'), async (req, res) => {
    try {
      if (!mineflayerBridge || !taskExecutors) {
        return res.status(503).json({
          success: false,
          error: 'Mineflayer crafting system not available'
        });
      }

      const { botId } = req.params;

      const task = {
        action: 'craft',
        params: {
          subAction: 'analyze'
        }
      };

      const result = await executeMineflayerTask(botId, task, taskExecutors);

      res.json({
        success: result.success,
        task: 'craft:analyze',
        result
      });

    } catch (err) {
      logger.error('Failed to analyze crafting', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  return router;
}

export default initMineflayerRoutes;
