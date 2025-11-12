/**
 * InventoryTaskExecutor - Inventory management operations
 *
 * Handles:
 * - Getting inventory contents
 * - Equipping items
 * - Dropping items
 * - Inventory organization
 */

import { BaseTaskExecutor } from './BaseTaskExecutor.js';
import { logger } from '../../logger.js';

export class InventoryTaskExecutor extends BaseTaskExecutor {
  /**
   * Execute an inventory task
   * @param {string} botId - Bot identifier
   * @param {Object} task - Inventory task
   *   - action: 'inventory'
   *   - subAction: 'get' | 'equip' | 'drop' | 'organize'
   *   - params: {
   *       item: string (for equip/drop),
   *       count: number (for drop),
   *       destination: string (for equip - 'hand', 'head', 'torso', etc.)
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

      const subAction = task.subAction || task.params?.subAction || 'get';
      const params = task.params || {};

      this._logAction(botId, `Starting inventory task: ${subAction}`, params);

      let result;

      switch (subAction) {
        case 'get':
          result = await this._getInventory(botId);
          break;
        case 'equip':
          result = await this._equipItem(botId, params);
          break;
        case 'drop':
          result = await this._dropItem(botId, params);
          break;
        case 'organize':
          result = await this._organizeInventory(botId);
          break;
        default:
          throw new Error(`Unknown inventory subAction: ${subAction}`);
      }

      this._logAction(botId, `Inventory task completed: ${subAction}`, result);
      return result;

    } catch (err) {
      return this._handleError(botId, err, 'Inventory task');
    }
  }

  validateTask(task) {
    const validation = super.validateTask(task);

    if (task?.action !== 'inventory') {
      validation.errors.push(`Expected action 'inventory', got '${task?.action}'`);
    }

    const subAction = task?.subAction || task?.params?.subAction || 'get';
    const validSubActions = ['get', 'equip', 'drop', 'organize'];
    if (!validSubActions.includes(subAction)) {
      validation.errors.push(`Invalid subAction '${subAction}'. Must be one of: ${validSubActions.join(', ')}`);
    }

    if ((subAction === 'equip' || subAction === 'drop') && !task?.params?.item) {
      validation.errors.push(`params.item is required for '${subAction}' action`);
    }

    validation.valid = validation.errors.length === 0;
    return validation;
  }

  async _getInventory(botId) {
    const inventory = this.bridge.getInventory(botId);
    return {
      success: true,
      action: 'get',
      itemCount: inventory.length,
      items: inventory,
      slots: {
        used: inventory.length,
        total: 36
      }
    };
  }

  async _equipItem(botId, params) {
    const { item, destination = 'hand' } = params;

    if (!item) {
      throw new Error('item parameter required');
    }

    const result = await this._withRetry(
      async () => {
        return await this.bridge.equipItem(botId, { item, destination });
      },
      3,
      500
    );

    return {
      success: result.success,
      action: 'equip',
      item,
      destination,
      inventory: this.bridge.getInventory(botId)
    };
  }

  async _dropItem(botId, params) {
    const { item, count = 1 } = params;

    if (!item) {
      throw new Error('item parameter required');
    }

    const result = await this._withRetry(
      async () => {
        return await this.bridge.dropItem(botId, { item, count });
      },
      3,
      500
    );

    return {
      success: result.success || !result.error,
      action: 'drop',
      item,
      count,
      inventory: this.bridge.getInventory(botId)
    };
  }

  async _organizeInventory(botId) {
    const inventory = this.bridge.getInventory(botId);

    // Simple organization: identify full stacks vs partial
    const fullStacks = inventory.filter(item => item.count >= 64);
    const partialStacks = inventory.filter(item => item.count < 64);

    return {
      success: true,
      action: 'organize',
      analysis: {
        totalItems: inventory.length,
        fullStacks: fullStacks.length,
        partialStacks: partialStacks.length,
        wasted: partialStacks.reduce((sum, item) => sum + (64 - item.count), 0)
      },
      inventory
    };
  }
}

export default InventoryTaskExecutor;
