/**
 * MineTaskExecutor - Mining operations
 *
 * Handles:
 * - Finding blocks by type
 * - Navigating to blocks
 * - Mining with tool selection
 * - Vein mining (multi-block)
 * - Inventory management
 */

import { BaseTaskExecutor } from './BaseTaskExecutor.js';
import { logger } from '../../logger.js';

export class MineTaskExecutor extends BaseTaskExecutor {
  /**
   * Execute a mining task
   * @param {string} botId - Bot identifier
   * @param {Object} task - Mining task
   *   - action: 'mine'
   *   - params: {
   *       blockType: string (required),
   *       count: number (default: 1),
   *       range: number (default: 32),
   *       veinMine: boolean (default: false),
   *       equipTool: boolean (default: true)
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

      const {
        blockType,
        count = 1,
        range = 32,
        veinMine = false,
        equipTool = true,
      } = task.params || {};

      if (!blockType) {
        throw new Error('blockType is required for mining task');
      }

      this._logAction(botId, 'Starting mining task', { blockType, count, range, veinMine });

      let totalMined = 0;
      const blocks = [];

      // Mine blocks
      for (let i = 0; i < count; i++) {
        // Check inventory space
        if (!this._hasInventorySpace(botId)) {
          this._logAction(botId, 'Inventory full, stopping mining', { mined: totalMined });
          break;
        }

        // Find block
        const foundBlocks = this.bridge.findBlocks(botId, {
          blockType,
          maxDistance: range,
          count: veinMine ? 10 : 1,
        });

        if (!foundBlocks.length) {
          this._logAction(botId, 'No blocks found', { blockType, range });
          break;
        }

        const block = foundBlocks[0];
        blocks.push(block);

        try {
          // Move to block
          this._logAction(botId, 'Moving to block', { position: block });
          await this._withTimeout(
            this.bridge.moveToPosition(botId, block, { range: 4 }),
            30000,
            'Movement to block timed out'
          );

          // Mine block
          this._logAction(botId, 'Mining block', { blockType: block.name });
          const result = await this._withTimeout(
            this.bridge.digBlock(botId, block, { equipTool }),
            30000,
            'Block digging timed out'
          );

          if (result.success) {
            totalMined++;
            this._logProgress(botId, totalMined / count, { mined: totalMined, target: count });
          }
        } catch (err) {
          logger.warn('Failed to mine block', { botId, error: err.message });
          // Continue with next block instead of failing entire task
        }
      }

      const result = {
        success: totalMined > 0,
        mined: totalMined,
        requested: count,
        blockType,
        blocks,
        inventory: this.bridge.getInventory(botId),
      };

      this._logAction(botId, 'Mining task completed', result);
      return result;
    } catch (err) {
      return this._handleError(botId, err, 'Mining task');
    }
  }

  validateTask(task) {
    const validation = super.validateTask(task);

    if (task?.action !== 'mine') {
      validation.errors.push(`Expected action 'mine', got '${task?.action}'`);
    }

    if (!task?.params?.blockType) {
      validation.errors.push('params.blockType is required');
    }

    validation.valid = validation.errors.length === 0;
    return validation;
  }
}

export default MineTaskExecutor;
