/**
 * Mineflayer Adapter - Phase 1 Skeleton
 *
 * Provides a clean abstraction layer between FGD's task system and native
 * Mineflayer bot control. This adapter ensures:
 *
 * 1. All inputs are structured and validated
 * 2. All operations are logged for auditing
 * 3. No arbitrary evaluation or code injection from LLM outputs
 * 4. Explicit method signatures for all bot capabilities
 * 5. Deterministic, inspectable execution flow
 *
 * Architecture:
 * - One MineflayerAdapter instance per NPC system
 * - Manages multiple bot connections internally
 * - Provides stable task interface to coordinator
 * - Handles Mineflayer-specific protocol details internally
 */

import { logger } from '../../logger.js';
import { validateBotCommand } from './validation.js';
import { MineflayerMovementAdapter } from './movement.js';
import { MineflayerInteractionAdapter } from './interaction.js';
import { MineflayerInventoryAdapter } from './inventory.js';

export class MineflayerAdapter {
  constructor(mineflayerBridge, options = {}) {
    if (!mineflayerBridge) {
      throw new Error('MineflayerAdapter requires a valid MineflayerBridge instance');
    }

    this.bridge = mineflayerBridge;
    this.options = {
      logAllOperations: true,
      validateAllInputs: true,
      maxConcurrentTasks: options.maxConcurrentTasks || 10,
      taskTimeoutMs: options.taskTimeoutMs || 30000,
      ...options
    };

    this.activeTasks = new Map(); // botId -> Set of task IDs
    this.taskResults = new Map(); // taskId -> { status, result, error }

    // Initialize sub-adapters for specific domains
    this.movement = new MineflayerMovementAdapter(this.bridge, this.options);
    this.interaction = new MineflayerInteractionAdapter(this.bridge, this.options);
    this.inventory = new MineflayerInventoryAdapter(this.bridge, this.options);

    logger.info('MineflayerAdapter initialized', {
      bridge: this.bridge.constructor.name,
      maxConcurrentTasks: this.options.maxConcurrentTasks
    });
  }

  /**
   * Execute a structured task via Mineflayer
   *
   * Task structure:
   * {
   *   id: "task_uuid",
   *   botId: "bot_01",
   *   type: "move_to" | "mine_block" | "place_block" | "interact" | "look_at" | "chat",
   *   parameters: { ... },
   *   caller: "admin_user",
   *   role: "ADMIN",
   *   timestamp: ISO8601
   * }
   *
   * @param {Object} task - Structured task object
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async executeTask(task) {
    if (!task) {
      return { success: false, error: 'Task is required' };
    }

    const taskId = task.id || `task_${Date.now()}_${Math.random()}`;
    const botId = task.botId;

    try {
      // Validate task structure and parameters
      const validation = validateBotCommand(task);
      if (!validation.valid) {
        logger.warn('Task validation failed', {
          taskId,
          botId,
          reason: validation.errors.join('; ')
        });
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join('; ')}`
        };
      }

      // Check concurrent task limit for this bot
      if (!this.activeTasks.has(botId)) {
        this.activeTasks.set(botId, new Set());
      }
      const botTasks = this.activeTasks.get(botId);
      if (botTasks.size >= this.options.maxConcurrentTasks) {
        return {
          success: false,
          error: `Bot ${botId} has reached concurrent task limit (${this.options.maxConcurrentTasks})`
        };
      }

      botTasks.add(taskId);

      // Log task execution start
      if (this.options.logAllOperations) {
        logger.info('Executing Mineflayer task', {
          taskId,
          botId,
          type: task.type,
          caller: task.caller,
          role: task.role
        });
      }

      // Route to appropriate sub-adapter based on task type
      let result;
      switch (task.type) {
        case 'move_to':
        case 'follow':
        case 'navigate':
          result = await this.movement.execute(taskId, botId, task);
          break;

        case 'mine_block':
        case 'place_block':
        case 'interact':
        case 'use_item':
          result = await this.interaction.execute(taskId, botId, task);
          break;

        case 'look_at':
        case 'chat':
          result = await this._executeBasicAction(taskId, botId, task);
          break;

        case 'get_inventory':
        case 'equip_item':
        case 'drop_item':
          result = await this.inventory.execute(taskId, botId, task);
          break;

        default:
          result = {
            success: false,
            error: `Unknown task type: ${task.type}`
          };
      }

      // Store result
      this.taskResults.set(taskId, {
        status: result.success ? 'completed' : 'failed',
        result: result.success ? result.data : null,
        error: result.success ? null : result.error,
        completedAt: new Date().toISOString()
      });

      if (this.options.logAllOperations) {
        logger.info('Mineflayer task completed', {
          taskId,
          botId,
          type: task.type,
          success: result.success,
          error: result.error
        });
      }

      return result;

    } catch (error) {
      logger.error('Mineflayer task execution error', {
        taskId,
        botId,
        type: task?.type,
        error: error.message
      });

      return {
        success: false,
        error: `Task execution failed: ${error.message}`
      };

    } finally {
      // Clean up task tracking
      if (this.activeTasks.has(botId)) {
        this.activeTasks.get(botId).delete(taskId);
      }
    }
  }

  /**
   * Execute basic actions (look_at, chat)
   * @private
   */
  async _executeBasicAction(taskId, botId, task) {
    try {
      const bot = this.bridge.bots.get(botId);
      if (!bot) {
        return { success: false, error: `Bot ${botId} not found` };
      }

      switch (task.type) {
        case 'look_at': {
          const { x, y, z } = task.parameters?.target || {};
          if (x === undefined || y === undefined || z === undefined) {
            return { success: false, error: 'Target coordinates (x, y, z) required' };
          }
          await bot.look(Math.atan2(z, x), Math.asin(y));
          return { success: true, data: { looked_at: { x, y, z } } };
        }

        case 'chat': {
          const message = task.parameters?.message;
          if (!message || typeof message !== 'string') {
            return { success: false, error: 'Message (string) required' };
          }
          if (message.length > 256) {
            return { success: false, error: 'Message too long (max 256 chars)' };
          }
          bot.chat(message);
          return { success: true, data: { chat_sent: message } };
        }

        default:
          return { success: false, error: `Unknown basic action: ${task.type}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get task result by ID
   * @param {string} taskId - Task UUID
   * @returns {Object|null}
   */
  getTaskResult(taskId) {
    return this.taskResults.get(taskId) || null;
  }

  /**
   * Get active task count for a bot
   * @param {string} botId - Bot ID
   * @returns {number}
   */
  getActiveTasks(botId) {
    return this.activeTasks.get(botId)?.size || 0;
  }

  /**
   * Get all active task IDs for a bot
   * @param {string} botId - Bot ID
   * @returns {Array<string>}
   */
  getActiveTaskIds(botId) {
    return Array.from(this.activeTasks.get(botId) || []);
  }

  /**
   * Clear task result cache (call periodically to avoid memory leak)
   * @param {number} olderThanMs - Clear results older than this many milliseconds
   */
  clearOldTaskResults(olderThanMs = 3600000) { // Default 1 hour
    const now = Date.now();
    for (const [taskId, result] of this.taskResults.entries()) {
      const resultTime = new Date(result.completedAt).getTime();
      if (now - resultTime > olderThanMs) {
        this.taskResults.delete(taskId);
      }
    }
  }

  /**
   * Health check - verify bridge connectivity
   * @returns {Promise<{healthy: boolean, message: string}>}
   */
  async healthCheck() {
    try {
      if (!this.bridge) {
        return { healthy: false, message: 'Bridge not initialized' };
      }

      const botCount = this.bridge.bots?.size || 0;
      return {
        healthy: true,
        message: `Adapter ready with ${botCount} connected bot(s)`,
        stats: {
          connectedBots: botCount,
          activeTasks: Array.from(this.activeTasks.values()).reduce((sum, set) => sum + set.size, 0),
          cachedResults: this.taskResults.size
        }
      };
    } catch (error) {
      return { healthy: false, message: error.message };
    }
  }
}

export default MineflayerAdapter;
