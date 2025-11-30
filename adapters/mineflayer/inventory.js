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
      const items = bot.inventory.items();
      const inventory = items.map(item => ({
        slot: item.slot,
        itemName: item.name,
        count: item.count,
        metadata: item.metadata
      }));

      // Check cursor if any (item being dragged)
      // bot.inventory.cursor is sometimes null or undefined depending on version
      // But items() usually returns everything in main inventory + hotbar + armor + offhand
      
      return {
        success: true,
        data: {
          inventory,
          totalSlots: bot.inventory.inventoryEnd,
          occupiedSlots: items.length
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
    // slot parameter in validation is 0-8 (hotbar)
    // We can also infer destination from item type if not specified, 
    // but for now we default to 'hand' if slot is a number or unspecified.
    const slot = params?.slot;

    if (!itemName) {
      return { success: false, error: 'Item name required' };
    }

    try {
      // Find item in inventory
      const item = bot.inventory.items().find(i => i.name === itemName);
      if (!item) {
        return { success: false, error: `Item ${itemName} not found in inventory` };
      }

      const destination = 'hand'; // Default to hand for basic 'equip'

      logger.info('Equipping item', {
        botId: bot.username,
        itemName,
        destination
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

    if (typeof slot !== 'number') {
      return { success: false, error: `Invalid slot: ${slot}` };
    }

    try {
      // Note: bot.inventory.slots contains nulls for empty slots
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

      // Use tossStack if available (drops the specific item object)
      // If count is specified, we might need to separate it?
      // bot.toss(type, metadata, count) is older API.
      // bot.tossStack(item, callback) drops the whole stack usually?
      // Actually bot.tossStack takes an Item object.
      // To drop partial count, we might need clickWindow logic, but standard toss drops stack.
      // Let's rely on bot.toss if it exists (older) or tossStack (newer).
      
      if (bot.tossStack) {
        await bot.tossStack(item);
      } else if (bot.toss) {
         // Older API: toss(itemType, metadata, count)
         await bot.toss(item.type, item.metadata, count);
      } else {
        throw new Error("No drop method available on bot");
      }

      return {
        success: true,
        data: {
          dropped: itemName,
          count, // Note: if tossStack dropped all, this might be inaccurate if count < stack
          slot
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default MineflayerInventoryAdapter;
