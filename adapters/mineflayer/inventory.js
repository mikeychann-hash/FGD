/**
 * Mineflayer Inventory Adapter
 *
 * Handles inventory-related tasks:
 * - get_inventory: Retrieve bot's inventory
 * - equip_item: Equip an item to a specific slot
 * - drop_item: Drop items from inventory
 */

import { logger } from '../../logger.js';

export class MineflayerInventoryAdapter {
  constructor(bridge, options = {}) {
    this.bridge = bridge;
    this.options = options;
  }

  /**
   * Execute an inventory task
   * @param {string} taskId - Task UUID
   * @param {string} botId - Bot ID
   * @param {Object} task - Inventory task
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async execute(taskId, botId, task) {
    try {
      const bot = this.bridge.bots.get(botId);
      if (!bot) {
        return { success: false, error: `Bot ${botId} not found` };
      }

      switch (task.type) {
        case 'get_inventory':
          return this._getInventory(bot);

        case 'equip_item':
          return await this._equipItem(bot, task.parameters);

        case 'drop_item':
          return await this._dropItem(bot, task.parameters);

        default:
          return { success: false, error: `Unknown inventory type: ${task.type}` };
      }
    } catch (error) {
      logger.error('Inventory task error', { taskId, botId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get bot's current inventory
   * @private
   */
  _getInventory(bot) {
    try {
      const inventory = [];
      const cursorStack = bot.inventory.cursor();

      // Collect all items in inventory
      for (let i = 0; i < bot.inventory.inventoryEnd; i++) {
        const item = bot.inventory.slots[i];
        if (item) {
          inventory.push({
            slot: i,
            itemName: item.name,
            count: item.count,
            metadata: item.metadata
          });
        }
      }

      // Add cursor item if present
      const cursorItem = {
        slot: 'cursor',
        itemName: cursorStack?.name || null,
        count: cursorStack?.count || 0,
        metadata: cursorStack?.metadata
      };

      return {
        success: true,
        data: {
          inventory,
          cursorStack: cursorItem,
          totalSlots: bot.inventory.inventoryEnd,
          occupiedSlots: inventory.length
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Equip an item to a specific slot or hand
   * @private
   */
  async _equipItem(bot, params) {
    const itemName = params?.itemName;
    const slot = params?.slot;

    if (!itemName) {
      return { success: false, error: 'Item name required' };
    }

    try {
      // Find item in inventory
      const item = bot.inventory.findInventoryObject(itemName);
      if (!item) {
        return { success: false, error: `Item ${itemName} not found in inventory` };
      }

      // Equip to hand or specific slot
      const destination = typeof slot === 'number' ? 'hand' : 'hand';

      logger.info('Equipping item', {
        botId: bot.username,
        itemName,
        slot: destination
      });

      await bot.equip(item, destination);

      return {
        success: true,
        data: {
          equipped: itemName,
          destination
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Drop items from inventory
   * @private
   */
  async _dropItem(bot, params) {
    const slot = params?.slot;
    const count = params?.count || 1;

    if (typeof slot !== 'number' || slot < 0 || slot >= bot.inventory.inventoryEnd) {
      return { success: false, error: `Invalid slot: ${slot}` };
    }

    if (count < 1 || count > 64) {
      return { success: false, error: 'Count must be between 1 and 64' };
    }

    try {
      const item = bot.inventory.slots[slot];
      if (!item) {
        return { success: false, error: `Slot ${slot} is empty` };
      }

      const itemName = item.name;

      logger.info('Dropping item', {
        botId: bot.username,
        itemName,
        slot,
        count
      });

      // Drop the item
      await bot.drop(item, count);

      return {
        success: true,
        data: {
          dropped: itemName,
          count,
          slot
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default MineflayerInventoryAdapter;
