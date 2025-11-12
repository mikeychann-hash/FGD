/**
 * Mineflayer Interaction Adapter
 *
 * Handles all world interaction tasks:
 * - mine_block: Mine a block
 * - place_block: Place a block
 * - interact: Interact with a block (e.g., open chest)
 * - use_item: Use an item in bot's hand
 */

import { logger } from '../../logger.js';
import { validateCoordinates, isSafeBlockType } from './validation.js';

export class MineflayerInteractionAdapter {
  constructor(bridge, options = {}) {
    this.bridge = bridge;
    this.options = options;
  }

  /**
   * Execute an interaction task
   * @param {string} taskId - Task UUID
   * @param {string} botId - Bot ID
   * @param {Object} task - Interaction task
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async execute(taskId, botId, task) {
    try {
      const bot = this.bridge.bots.get(botId);
      if (!bot) {
        return { success: false, error: `Bot ${botId} not found` };
      }

      switch (task.type) {
        case 'mine_block':
          return await this._mineBlock(bot, task.parameters);

        case 'place_block':
          return await this._placeBlock(bot, task.parameters);

        case 'interact':
          return await this._interact(bot, task.parameters);

        case 'use_item':
          return await this._useItem(bot, task.parameters);

        default:
          return { success: false, error: `Unknown interaction type: ${task.type}` };
      }
    } catch (error) {
      logger.error('Interaction task error', { taskId, botId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Mine a block at target position
   * @private
   */
  async _mineBlock(bot, params) {
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
      // Get block at position
      const block = bot.blockAt({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });
      if (!block) {
        return { success: false, error: 'No block found at target position' };
      }

      // Check if it's air (can't mine air)
      if (block.type === 0 || block.name === 'air') {
        return { success: false, error: 'Cannot mine air' };
      }

      // Log mining attempt
      logger.info('Mining block', {
        botId: bot.username,
        blockType: block.name,
        position: { x, y, z }
      });

      // Attempt to mine
      return await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, error: 'Mining timeout' });
        }, this.options.taskTimeoutMs || 30000);

        bot.dig(block)
          .then(() => {
            clearTimeout(timeout);
            resolve({
              success: true,
              data: {
                mined: {
                  blockType: block.name,
                  position: { x, y, z }
                }
              }
            });
          })
          .catch(err => {
            clearTimeout(timeout);
            resolve({ success: false, error: err.message });
          });
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Place a block at target position
   * @private
   */
  async _placeBlock(bot, params) {
    const target = params?.target;
    const blockType = params?.blockType;

    if (!target || !blockType) {
      return { success: false, error: 'Target position and blockType required' };
    }

    const { x, y, z } = target;
    const face = params?.face || 'top';

    // Validate coordinates
    if (!validateCoordinates(x, y, z)) {
      return { success: false, error: 'Target coordinates out of bounds' };
    }

    // Safety check: prevent placement of dangerous blocks
    if (!isSafeBlockType(blockType)) {
      return {
        success: false,
        error: `Dangerous block type '${blockType}' requires explicit approval`
      };
    }

    try {
      // Check bot has block in inventory
      const itemInHand = bot.inventory.findInventoryObject(blockType);
      if (!itemInHand) {
        return {
          success: false,
          error: `Bot does not have ${blockType} in inventory`
        };
      }

      // Equip the block
      await bot.equip(itemInHand, 'hand');

      // Place the block
      const placementBlock = bot.blockAt({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });
      if (!placementBlock) {
        return { success: false, error: 'Cannot find block to place against' };
      }

      logger.info('Placing block', {
        botId: bot.username,
        blockType,
        position: { x, y, z }
      });

      return await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, error: 'Block placement timeout' });
        }, this.options.taskTimeoutMs || 30000);

        bot.placeBlock(placementBlock, { face })
          .then(() => {
            clearTimeout(timeout);
            resolve({
              success: true,
              data: {
                placed: {
                  blockType,
                  position: { x, y, z }
                }
              }
            });
          })
          .catch(err => {
            clearTimeout(timeout);
            resolve({ success: false, error: err.message });
          });
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Interact with a block (e.g., open chest, press button)
   * @private
   */
  async _interact(bot, params) {
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
      const block = bot.blockAt({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });
      if (!block) {
        return { success: false, error: 'No block found at target position' };
      }

      logger.info('Interacting with block', {
        botId: bot.username,
        blockType: block.name,
        position: { x, y, z }
      });

      // Activate the block (right-click)
      return await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, error: 'Interaction timeout' });
        }, this.options.taskTimeoutMs || 30000);

        bot.activateBlock(block)
          .then(() => {
            clearTimeout(timeout);
            resolve({
              success: true,
              data: {
                interacted: {
                  blockType: block.name,
                  position: { x, y, z }
                }
              }
            });
          })
          .catch(err => {
            clearTimeout(timeout);
            resolve({ success: false, error: err.message });
          });
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Use an item in bot's hand
   * @private
   */
  async _useItem(bot, params) {
    const itemName = params?.itemName;
    if (!itemName) {
      return { success: false, error: 'Item name required' };
    }

    try {
      // Find item in inventory
      const item = bot.inventory.findInventoryObject(itemName);
      if (!item) {
        return { success: false, error: `Item ${itemName} not found in inventory` };
      }

      // Equip item
      await bot.equip(item, 'hand');

      // Use the item (activate right-click action)
      logger.info('Using item', {
        botId: bot.username,
        itemName
      });

      bot.activateItem();

      return {
        success: true,
        data: {
          used_item: itemName
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default MineflayerInteractionAdapter;
