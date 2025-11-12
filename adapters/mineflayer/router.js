/**
 * Task Router - Single routing layer for all Mineflayer task execution
 *
 * This module provides the unified routing logic that directs tasks from
 * the NPC engine / API routes to the MineflayerAdapter.
 *
 * Architecture:
 * 1. API Request → initMineflayerRouter() creates router
 * 2. Task arrives → routeTask() determines execution path
 * 3. Task validated → adapter.executeTask() handles implementation
 * 4. Result logged → audit trail and metrics
 *
 * This ensures a single, clear place where all Mineflayer tasks are routed.
 */

import { logger } from '../../logger.js';
import { validateBotCommand } from './validation.js';

/**
 * Task routing configuration
 * Maps task types to their handler modules and safety requirements
 */
export const TASK_ROUTING_TABLE = {
  'move_to': {
    handler: 'movement',
    requiresLocation: true,
    requiresBot: true,
    dangerousAction: false,
    description: 'Move bot to absolute position'
  },
  'follow': {
    handler: 'movement',
    requiresLocation: true,
    requiresBot: true,
    dangerousAction: false,
    description: 'Follow an entity'
  },
  'navigate': {
    handler: 'movement',
    requiresLocation: true,
    requiresBot: true,
    dangerousAction: false,
    description: 'Navigate multiple waypoints'
  },
  'mine_block': {
    handler: 'interaction',
    requiresLocation: true,
    requiresBot: true,
    dangerousAction: false,
    description: 'Mine a block'
  },
  'place_block': {
    handler: 'interaction',
    requiresLocation: true,
    requiresBot: true,
    dangerousAction: true, // Requires logging
    description: 'Place a block'
  },
  'interact': {
    handler: 'interaction',
    requiresLocation: true,
    requiresBot: true,
    dangerousAction: false,
    description: 'Interact with a block'
  },
  'use_item': {
    handler: 'interaction',
    requiresBot: true,
    dangerousAction: false,
    description: 'Use an item'
  },
  'look_at': {
    handler: 'basic',
    requiresLocation: true,
    requiresBot: true,
    dangerousAction: false,
    description: 'Look at position'
  },
  'chat': {
    handler: 'basic',
    requiresBot: true,
    dangerousAction: false,
    description: 'Send chat message'
  },
  'get_inventory': {
    handler: 'inventory',
    requiresBot: true,
    dangerousAction: false,
    description: 'Get bot inventory'
  },
  'equip_item': {
    handler: 'inventory',
    requiresBot: true,
    dangerousAction: false,
    description: 'Equip an item'
  },
  'drop_item': {
    handler: 'inventory',
    requiresBot: true,
    dangerousAction: false,
    description: 'Drop items'
  }
};

/**
 * Router instance management
 */
class MineflayerRouter {
  constructor(adapter, options = {}) {
    if (!adapter) {
      throw new Error('MineflayerRouter requires an adapter instance');
    }

    this.adapter = adapter;
    this.options = {
      logAllTasks: true,
      logDangerousActionsOnly: false,
      requireApprovalForDangerous: false,
      maxTasksPerBot: 10,
      taskTimeoutMs: 30000,
      ...options
    };

    this.stats = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      rejectedTasks: 0,
      dangerousTasksLogged: 0
    };

    logger.info('MineflayerRouter initialized', {
      adapter: adapter.constructor.name,
      logLevel: this.options.logAllTasks ? 'all' : 'dangerous_only'
    });
  }

  /**
   * Main task routing function
   *
   * This is the PRIMARY entry point for all Mineflayer task execution.
   * All tasks from API routes, NPC engine, or LLM should flow through here.
   *
   * @param {Object} task - Task object with validated structure
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async routeTask(task) {
    if (!task || typeof task !== 'object') {
      return this._rejectTask('Task must be an object');
    }

    this.stats.totalTasks++;

    const taskId = task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const taskType = task.type;
    const botId = task.botId;

    try {
      // Step 1: Validate task structure
      const validation = validateBotCommand(task);
      if (!validation.valid) {
        logger.warn('Task validation failed', {
          taskId,
          botId,
          type: taskType,
          errors: validation.errors
        });
        this.stats.rejectedTasks++;
        return {
          success: false,
          error: `Validation failed: ${validation.errors[0]}`,
          taskId
        };
      }

      // Step 2: Get routing info for this task type
      const routing = TASK_ROUTING_TABLE[taskType];
      if (!routing) {
        logger.warn('Unknown task type', { taskId, botId, type: taskType });
        this.stats.rejectedTasks++;
        return {
          success: false,
          error: `Unknown task type: ${taskType}`,
          taskId
        };
      }

      // Step 3: Check dangerous action policy
      if (routing.dangerousAction) {
        this.stats.dangerousTasksLogged++;
        logger.warn('Dangerous task execution', {
          taskId,
          botId,
          type: taskType,
          caller: task.caller,
          role: task.role
        });

        if (this.options.requireApprovalForDangerous && !task.approved) {
          logger.warn('Dangerous task rejected (requires approval)', {
            taskId,
            botId,
            type: taskType
          });
          this.stats.rejectedTasks++;
          return {
            success: false,
            error: 'Dangerous actions require explicit approval',
            taskId
          };
        }
      }

      // Step 4: Check bot concurrency limits
      const activeTasks = this.adapter.getActiveTasks(botId);
      if (activeTasks >= this.options.maxTasksPerBot) {
        logger.warn('Bot task limit exceeded', {
          taskId,
          botId,
          active: activeTasks,
          limit: this.options.maxTasksPerBot
        });
        this.stats.rejectedTasks++;
        return {
          success: false,
          error: `Bot ${botId} has reached concurrent task limit`,
          taskId
        };
      }

      // Step 5: Log task execution
      if (this.options.logAllTasks) {
        logger.info('Task routing', {
          taskId,
          botId,
          type: taskType,
          handler: routing.handler,
          caller: task.caller,
          role: task.role,
          description: routing.description
        });
      }

      // Step 6: Execute task via adapter
      const result = await this.adapter.executeTask(task);

      // Step 7: Update stats and log result
      if (result.success) {
        this.stats.successfulTasks++;
        if (this.options.logAllTasks) {
          logger.info('Task completed successfully', {
            taskId,
            botId,
            type: taskType
          });
        }
      } else {
        this.stats.failedTasks++;
        logger.error('Task execution failed', {
          taskId,
          botId,
          type: taskType,
          error: result.error
        });
      }

      return {
        ...result,
        taskId
      };

    } catch (error) {
      this.stats.failedTasks++;
      logger.error('Unexpected task routing error', {
        taskId,
        botId,
        type: taskType,
        error: error.message
      });

      return {
        success: false,
        error: `Task routing error: ${error.message}`,
        taskId
      };
    }
  }

  /**
   * Reject a task with logging
   * @private
   */
  _rejectTask(reason) {
    this.stats.rejectedTasks++;
    logger.warn('Task rejected', { reason });
    return { success: false, error: reason };
  }

  /**
   * Get routing table for introspection
   * Useful for documentation, debugging, and API discovery
   *
   * @returns {Object}
   */
  getRoutingTable() {
    return { ...TASK_ROUTING_TABLE };
  }

  /**
   * Get current statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalTasks > 0
        ? ((this.stats.successfulTasks / this.stats.totalTasks) * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  /**
   * Reset statistics (for testing)
   */
  resetStats() {
    this.stats = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      rejectedTasks: 0,
      dangerousTasksLogged: 0
    };
  }
}

/**
 * Factory function to create and initialize a router
 * @param {Object} npcSystem - NPC system with mineflayerBridge
 * @param {Object} options - Router options
 * @returns {MineflayerRouter|null}
 */
export function initMineflayerRouter(npcSystem, options = {}) {
  try {
    if (!npcSystem?.mineflayerBridge) {
      logger.warn('Cannot initialize MineflayerRouter: no bridge available');
      return null;
    }

    // Import adapter here to avoid circular dependencies
    const { MineflayerAdapter } = require('./index.js');
    const adapter = new MineflayerAdapter(npcSystem.mineflayerBridge, options);
    const router = new MineflayerRouter(adapter, options);

    logger.info('MineflayerRouter ready', {
      taskTypes: Object.keys(TASK_ROUTING_TABLE).length
    });

    return router;
  } catch (error) {
    logger.error('Failed to initialize MineflayerRouter', { error: error.message });
    return null;
  }
}

export { MineflayerRouter };
