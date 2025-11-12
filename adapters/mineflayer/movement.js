/**
 * Mineflayer Movement Adapter
 *
 * Handles all movement-related tasks:
 * - move_to: Move to absolute position
 * - follow: Follow an entity
 * - navigate: Multi-waypoint navigation
 */

import { logger } from '../../logger.js';
import { validateCoordinates } from './validation.js';

export class MineflayerMovementAdapter {
  constructor(bridge, options = {}) {
    this.bridge = bridge;
    this.options = options;
  }

  /**
   * Execute a movement task
   * @param {string} taskId - Task UUID
   * @param {string} botId - Bot ID
   * @param {Object} task - Movement task
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async execute(taskId, botId, task) {
    try {
      const bot = this.bridge.bots.get(botId);
      if (!bot) {
        return { success: false, error: `Bot ${botId} not found` };
      }

      switch (task.type) {
        case 'move_to':
          return await this._moveTo(bot, task.parameters);

        case 'follow':
          return await this._follow(bot, task.parameters);

        case 'navigate':
          return await this._navigate(bot, task.parameters);

        default:
          return { success: false, error: `Unknown movement type: ${task.type}` };
      }
    } catch (error) {
      logger.error('Movement task error', { taskId, botId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Move bot to absolute position
   * @private
   */
  async _moveTo(bot, params) {
    const target = params?.target;
    if (!target) {
      return { success: false, error: 'Target position required' };
    }

    const { x, y, z } = target;

    // Validate coordinates
    if (!validateCoordinates(x, y, z)) {
      return { success: false, error: 'Target coordinates out of bounds' };
    }

    try {
      // Use pathfinder if available
      if (bot.pathfinder) {
        const { goals } = require('mineflayer-pathfinder');
        const goal = new goals.GoalXZ(x, z);
        bot.pathfinder.setGoal(goal);

        // Wait for pathfinding to complete (with timeout)
        return await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve({
              success: false,
              error: 'Pathfinding timeout'
            });
          }, this.options.taskTimeoutMs || 30000);

          bot.once('goal_reached', () => {
            clearTimeout(timeout);
            resolve({
              success: true,
              data: {
                moved_to: { x, y, z },
                distance: 0
              }
            });
          });
        });
      } else {
        // Fallback: Simple velocity-based movement
        const currentPos = bot.entity.position;
        const distance = currentPos.distanceTo({ x, y, z });

        if (distance < 1) {
          return { success: true, data: { already_at: { x, y, z } } };
        }

        // Attempt movement (naive implementation)
        const direction = { x, y, z };
        direction.x -= currentPos.x;
        direction.y -= currentPos.y;
        direction.z -= currentPos.z;

        const len = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
        if (len === 0) {
          return { success: true, data: { already_at: { x, y, z } } };
        }

        direction.x /= len;
        direction.y /= len;
        direction.z /= len;

        // Move towards target (simplified)
        bot.setControlState('forward', true);
        await new Promise(r => setTimeout(r, 1000));
        bot.setControlState('forward', false);

        return {
          success: true,
          data: {
            moved_towards: { x, y, z },
            distance_remaining: distance
          }
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Follow an entity
   * @private
   */
  async _follow(bot, params) {
    const target = params?.target;
    if (!target || !target.entity) {
      return { success: false, error: 'Target entity required' };
    }

    try {
      const entityName = target.entity;
      const nearbyEntities = Object.values(bot.entities).filter(
        e => e.name === entityName || e.username === entityName
      );

      if (nearbyEntities.length === 0) {
        return { success: false, error: `Entity ${entityName} not found` };
      }

      const targetEntity = nearbyEntities[0];

      // Use pathfinder to follow
      if (bot.pathfinder) {
        const { goals } = require('mineflayer-pathfinder');
        const goal = new goals.GoalFollow(targetEntity, 2);
        bot.pathfinder.setGoal(goal);

        return {
          success: true,
          data: {
            following: entityName,
            targetPosition: {
              x: targetEntity.position.x,
              y: targetEntity.position.y,
              z: targetEntity.position.z
            }
          }
        };
      } else {
        return { success: false, error: 'Pathfinder plugin not available' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Navigate through multiple waypoints
   * @private
   */
  async _navigate(bot, params) {
    const waypoints = params?.waypoints;
    if (!Array.isArray(waypoints) || waypoints.length === 0) {
      return { success: false, error: 'Waypoints array required' };
    }

    // Validate all waypoints
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      if (!validateCoordinates(wp.x, wp.y, wp.z)) {
        return { success: false, error: `Waypoint ${i} out of bounds` };
      }
    }

    try {
      const results = [];

      for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        const result = await this._moveTo(bot, { target: wp });

        if (!result.success) {
          return {
            success: false,
            error: `Failed at waypoint ${i}: ${result.error}`,
            completedWaypoints: i,
            results
          };
        }

        results.push(result.data);
      }

      return {
        success: true,
        data: {
          navigated_waypoints: waypoints.length,
          results
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default MineflayerMovementAdapter;
