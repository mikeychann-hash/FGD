/**
 * MovementTaskExecutor - Movement and pathfinding operations
 *
 * Handles:
 * - Moving to positions
 * - Following entities
 * - Pathfinding with obstacles
 * - Movement validation
 */

import { BaseTaskExecutor } from './BaseTaskExecutor.js';
import { logger } from '../../logger.js';

export class MovementTaskExecutor extends BaseTaskExecutor {
  /**
   * Execute a movement task
   * @param {string} botId - Bot identifier
   * @param {Object} task - Movement task
   *   - action: 'move'
   *   - params: {
   *       target: {x, y, z} (required),
   *       range: number (default: 1),
   *       timeout: number (default: 60000),
   *       followEntity: boolean (default: false),
   *       entityId: string (if followEntity is true)
   *     }
   * @returns {Promise<Object>} Result object
   */
  async execute(botId, task) {
    try {
      this._verifyBot(botId);

      const validation = this.validateTask(task);
      if (!validation.valid) {
        throw new Error(`Invalid task: ${validation.errors.join(', ')}`);
      }

      const { target, range = 1, timeout = 60000, followEntity = false, entityId } = task.params || {};

      if (followEntity && !entityId) {
        throw new Error('entityId is required when followEntity is true');
      }

      this._logAction(botId, 'Starting movement task', {
        target,
        range,
        followEntity,
        entityId
      });

      const startPos = this.bridge.getPosition(botId);
      const distance = this._distance(startPos, target);

      this._logAction(botId, 'Distance to target', { distance });

      let result;

      if (followEntity) {
        result = await this._withTimeout(
          this.bridge.followEntity(botId, { x: target.x, y: target.y, z: target.z }, { range, timeout }),
          timeout,
          'Entity following timed out'
        );
      } else {
        result = await this._withTimeout(
          this.bridge.moveToPosition(botId, target, { range, timeout }),
          timeout,
          'Movement timed out'
        );
      }

      const endPos = this.bridge.getPosition(botId);
      const distanceTraveled = this._distance(startPos, endPos);
      const reachedTarget = this._distance(endPos, target) <= (range + 1);

      const taskResult = {
        success: reachedTarget,
        position: endPos,
        target,
        distanceTraveled,
        reached: reachedTarget,
        distance: this._distance(endPos, target)
      };

      this._logAction(botId, 'Movement task completed', taskResult);
      return taskResult;

    } catch (err) {
      return this._handleError(botId, err, 'Movement task');
    }
  }

  validateTask(task) {
    const validation = super.validateTask(task);

    if (task?.action !== 'move' && task?.action !== 'movement') {
      validation.errors.push(`Expected action 'move', got '${task?.action}'`);
    }

    if (!task?.params?.target) {
      validation.errors.push('params.target is required');
    } else if (!task.params.target.x || task.params.target.y === undefined || !task.params.target.z) {
      validation.errors.push('target must have x, y, z coordinates');
    }

    validation.valid = validation.errors.length === 0;
    return validation;
  }

  _distance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

export default MovementTaskExecutor;
