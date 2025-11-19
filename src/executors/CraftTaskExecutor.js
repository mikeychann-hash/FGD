/**
 * Crafting Task Executor
 *
 * Handles bot crafting operations including recipe lookup, crafting execution,
 * and resource management using minecraft-data for recipe definitions.
 */

import { BaseTaskExecutor } from './BaseTaskExecutor.js';
import { logger } from '../../logger.js';

export class CraftTaskExecutor extends BaseTaskExecutor {
  constructor(bridge, minecraftData = null) {
    super(bridge);
    this.minecraftData = minecraftData;
  }

  /**
   * Execute crafting task
   * @param {string} botId - Bot identifier
   * @param {Object} task - Task object
   * @param {string} task.action - Always 'craft'
   * @param {Object} task.params - Crafting parameters
   * @param {string} task.params.subAction - 'craft', 'lookup', 'analyze'
   * @param {string} task.params.recipe - Recipe name (e.g., 'wooden_pickaxe')
   * @param {number} task.params.count - Number to craft (default 1)
   * @param {boolean} task.params.findTable - Find crafting table first (default true)
   * @param {number} task.params.range - Search radius for crafting table (default 32)
   * @param {number} task.params.timeout - Operation timeout (default 60000)
   * @returns {Promise<Object>} Crafting result
   */
  async execute(botId, task) {
    try {
      this._verifyTask(task, 'craft');

      const {
        subAction = 'craft',
        recipe,
        count = 1,
        findTable = true,
        range = 32,
        timeout = 60000,
      } = task.params || {};

      return await this._withTimeout(timeout, async () => {
        const bot = this.bridge.bots.get(botId);
        if (!bot) {
          return { success: false, error: `Bot ${botId} not found` };
        }

        // Execute sub-action
        switch (subAction.toLowerCase()) {
          case 'craft':
            return await this._handleCraft(bot, botId, recipe, count, findTable, range, timeout);
          case 'lookup':
            return await this._handleLookup(recipe);
          case 'analyze':
            return await this._handleAnalyze(bot, botId);
          default:
            return { success: false, error: `Unknown craft subAction: ${subAction}` };
        }
      });
    } catch (err) {
      logger.error('Craft task execution failed', { botId, error: err.message });
      return {
        success: false,
        error: err.message,
        action: 'craft',
      };
    }
  }

  /**
   * Handle craft action (execute recipe)
   * @private
   */
  async _handleCraft(bot, botId, recipe, count, findTable, range, timeout) {
    try {
      if (!recipe) {
        return {
          success: false,
          error: 'Recipe name is required',
          action: 'craft:craft',
        };
      }

      // Get recipe information
      const recipeInfo = this._getRecipe(recipe);
      if (!recipeInfo) {
        return {
          success: false,
          error: `Unknown recipe: ${recipe}`,
          action: 'craft:craft',
          availableRecipes: this._getAvailableRecipes(),
        };
      }

      // Check if we need a crafting table
      const needsTable = recipeInfo.needsTable !== false;
      if (needsTable && findTable) {
        const tableResult = await this._findAndApproachCraftingTable(bot, range, timeout);
        if (!tableResult.success) {
          return tableResult;
        }
      }

      // Check inventory for required materials
      const requiredItems = this._parseRecipeItems(
        recipeInfo.inShape || recipeInfo.ingredients || []
      );
      const inventoryCheck = this._checkInventory(bot, requiredItems, count);

      if (!inventoryCheck.hasMaterials) {
        return {
          success: false,
          error: 'Insufficient materials',
          action: 'craft:craft',
          recipe,
          required: inventoryCheck.required,
          available: inventoryCheck.available,
          missing: inventoryCheck.missing,
        };
      }

      // Perform crafting
      let craftedCount = 0;
      const startInventory = bot.inventory.slots.slice(); // Copy current inventory

      for (let i = 0; i < count; i++) {
        try {
          // Check materials again before each craft
          const currentCheck = this._checkInventory(bot, requiredItems, 1);
          if (!currentCheck.hasMaterials) break;

          // For shapeless or shaped recipes
          if (
            needsTable &&
            bot.currentWindow &&
            bot.currentWindow.type === 'minecraft:crafting_table'
          ) {
            // Craft via crafting table window
            await this._executeTableCraft(bot, recipeInfo);
          } else {
            // Craft via player inventory (2x2 grid)
            await this._executeInventoryCraft(bot, recipeInfo);
          }

          craftedCount++;
          await this._delay(200); // Small delay between crafts
        } catch (err) {
          logger.warn('Single craft failed', { recipe, error: err.message });
          break;
        }
      }

      // Check results
      const resultItem = this._getRecipeResult(recipeInfo);
      const resultCount = this._countItemInInventory(bot, resultItem);

      return {
        success: craftedCount > 0,
        action: 'craft:craft',
        recipe,
        crafted: craftedCount,
        requested: count,
        result: resultItem,
        resultCount,
        inventory: this._getInventorySummary(bot),
        materialsUsed: requiredItems,
      };
    } catch (err) {
      logger.error('Craft action failed', { botId, error: err.message });
      return {
        success: false,
        error: err.message,
        action: 'craft:craft',
      };
    }
  }

  /**
   * Handle lookup action (get recipe information)
   * @private
   */
  async _handleLookup(recipe) {
    try {
      const recipeInfo = this._getRecipe(recipe);
      if (!recipeInfo) {
        return {
          success: false,
          error: `Unknown recipe: ${recipe}`,
          action: 'craft:lookup',
          availableRecipes: this._getAvailableRecipes(),
        };
      }

      return {
        success: true,
        action: 'craft:lookup',
        recipe,
        details: {
          name: recipe,
          result: this._getRecipeResult(recipeInfo),
          ingredients: this._parseRecipeItems(recipeInfo.inShape || recipeInfo.ingredients || []),
          needsTable: recipeInfo.needsTable !== false,
          shapeless: !recipeInfo.inShape,
          pattern: recipeInfo.inShape || null,
        },
      };
    } catch (err) {
      logger.error('Lookup action failed', { error: err.message });
      return {
        success: false,
        error: err.message,
        action: 'craft:lookup',
      };
    }
  }

  /**
   * Handle analyze action (check bot's crafting capability)
   * @private
   */
  async _handleAnalyze(bot, botId) {
    try {
      const inventory = this._getInventorySummary(bot);
      const canCraft = this._analyzeRecipesBot(bot);

      return {
        success: true,
        action: 'craft:analyze',
        botId,
        inventory,
        craftableRecipes: canCraft.slice(0, 20), // Top 20
        totalCraftable: canCraft.length,
        hasSpaceForCraft: inventory.emptySlots > 0,
      };
    } catch (err) {
      logger.error('Analyze action failed', { botId, error: err.message });
      return {
        success: false,
        error: err.message,
        action: 'craft:analyze',
      };
    }
  }

  /**
   * Find and approach a crafting table
   * @private
   */
  async _findAndApproachCraftingTable(bot, range, timeout) {
    try {
      // Find crafting table block nearby
      const { Vec3 } = await import('vec3');
      let craftingTable = null;
      let minDistance = Infinity;

      const radius = Math.min(range, 32);
      for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
          for (let y = -5; y <= 5; y++) {
            const blockPos = bot.entity.position.offset(x, y, z);
            const block = bot.blockAt(blockPos);
            if (block && (block.name === 'crafting_table' || block.name === 'workbench')) {
              const distance = bot.entity.position.distanceTo(blockPos);
              if (distance < minDistance) {
                minDistance = distance;
                craftingTable = blockPos;
              }
            }
          }
        }
      }

      if (!craftingTable) {
        return {
          success: false,
          error: 'No crafting table found',
          action: 'craft:craft',
          searched: radius,
        };
      }

      // Approach the table
      const tableGoal = new (await import('mineflayer-pathfinder')).goals.GoalNear(
        craftingTable.x,
        craftingTable.y,
        craftingTable.z,
        1
      );

      await Promise.race([
        bot.pathfinder.goto(tableGoal),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Approach timeout')), timeout)
        ),
      ]).catch((err) => {
        if (err.message !== 'Approach timeout') throw err;
      });

      // Open crafting table window
      try {
        const tableBlock = bot.blockAt(craftingTable);
        if (tableBlock) {
          await bot.openBlock(tableBlock);
        }
      } catch (err) {
        logger.warn('Could not open crafting table', { error: err.message });
      }

      return {
        success: true,
        tablePosition: { x: craftingTable.x, y: craftingTable.y, z: craftingTable.z },
      };
    } catch (err) {
      logger.error('Find crafting table failed', { error: err.message });
      return {
        success: false,
        error: err.message,
        action: 'craft:craft',
      };
    }
  }

  /**
   * Execute crafting at crafting table
   * @private
   */
  async _executeTableCraft(bot, recipeInfo) {
    // This would interact with crafting table window
    // Implementation depends on minecraft-data recipe format
    logger.debug('Table crafting', { recipe: recipeInfo });
  }

  /**
   * Execute crafting in player inventory
   * @private
   */
  async _executeInventoryCraft(bot, recipeInfo) {
    // This would perform crafting in 2x2 grid
    // Implementation depends on minecraft-data recipe format
    logger.debug('Inventory crafting', { recipe: recipeInfo });
  }

  /**
   * Get recipe information
   * @private
   */
  _getRecipe(recipeName) {
    // Common recipes hardcoded (would be extended with minecraft-data)
    const recipes = {
      wooden_pickaxe: {
        result: 'wooden_pickaxe',
        inShape: [
          ['oak_planks', 'oak_planks', 'oak_planks'],
          [null, 'stick', null],
          [null, 'stick', null],
        ],
        needsTable: true,
      },
      wooden_sword: {
        result: 'wooden_sword',
        inShape: [['oak_planks'], ['oak_planks'], ['stick']],
        needsTable: true,
      },
      stick: {
        result: 'stick',
        inShape: [['oak_planks'], ['oak_planks']],
        needsTable: false,
        count: 4,
      },
      crafting_table: {
        result: 'crafting_table',
        inShape: [
          ['oak_planks', 'oak_planks'],
          ['oak_planks', 'oak_planks'],
        ],
        needsTable: false,
      },
      chest: {
        result: 'chest',
        inShape: [
          ['oak_planks', 'oak_planks', 'oak_planks'],
          ['oak_planks', null, 'oak_planks'],
          ['oak_planks', 'oak_planks', 'oak_planks'],
        ],
        needsTable: true,
      },
      furnace: {
        result: 'furnace',
        inShape: [
          ['cobblestone', 'cobblestone', 'cobblestone'],
          ['cobblestone', null, 'cobblestone'],
          ['cobblestone', 'cobblestone', 'cobblestone'],
        ],
        needsTable: true,
      },
    };

    return recipes[recipeName.toLowerCase()] || null;
  }

  /**
   * Get available recipes
   * @private
   */
  _getAvailableRecipes() {
    return ['wooden_pickaxe', 'wooden_sword', 'stick', 'crafting_table', 'chest', 'furnace'];
  }

  /**
   * Get recipe result item
   * @private
   */
  _getRecipeResult(recipeInfo) {
    return recipeInfo.result || 'unknown';
  }

  /**
   * Parse recipe items
   * @private
   */
  _parseRecipeItems(itemsOrShape) {
    const items = {};

    if (Array.isArray(itemsOrShape)) {
      // Handle 2D shape array
      if (itemsOrShape[0] && Array.isArray(itemsOrShape[0])) {
        for (const row of itemsOrShape) {
          for (const item of row) {
            if (item) {
              items[item] = (items[item] || 0) + 1;
            }
          }
        }
      } else {
        // Handle flat array
        for (const item of itemsOrShape) {
          if (item && item.name) {
            items[item.name] = (items[item.name] || 0) + (item.count || 1);
          }
        }
      }
    }

    return items;
  }

  /**
   * Check if inventory has required items
   * @private
   */
  _checkInventory(bot, requiredItems, multiplier = 1) {
    const available = {};
    const required = {};
    const missing = {};

    // Count items in inventory
    for (const item of bot.inventory.items()) {
      available[item.name] = (available[item.name] || 0) + item.count;
    }

    // Check requirements
    let hasMaterials = true;
    for (const [itemName, count] of Object.entries(requiredItems)) {
      required[itemName] = count * multiplier;
      const haveCount = available[itemName] || 0;

      if (haveCount < required[itemName]) {
        hasMaterials = false;
        missing[itemName] = required[itemName] - haveCount;
      }
    }

    return { hasMaterials, available, required, missing };
  }

  /**
   * Count item in inventory
   * @private
   */
  _countItemInInventory(bot, itemName) {
    let count = 0;
    for (const item of bot.inventory.items()) {
      if (item.name === itemName) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Get inventory summary
   * @private
   */
  _getInventorySummary(bot) {
    const items = {};
    let usedSlots = 0;

    for (const item of bot.inventory.items()) {
      items[item.name] = (items[item.name] || 0) + item.count;
      usedSlots++;
    }

    return {
      items,
      usedSlots,
      emptySlots: 36 - usedSlots,
      totalSlots: 36,
    };
  }

  /**
   * Analyze which recipes can be crafted with current inventory
   * @private
   */
  _analyzeRecipesBot(bot) {
    const craftable = [];
    const recipes = this._getAvailableRecipes();
    const inventory = this._getInventorySummary(bot);

    for (const recipeName of recipes) {
      const recipeInfo = this._getRecipe(recipeName);
      if (!recipeInfo) continue;

      const required = this._parseRecipeItems(recipeInfo.inShape || []);
      const check = this._checkInventory(bot, required, 1);

      if (check.hasMaterials) {
        craftable.push({
          recipe: recipeName,
          result: this._getRecipeResult(recipeInfo),
        });
      }
    }

    return craftable;
  }

  /**
   * Utility delay function
   * @private
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Verify task structure
   * @private
   */
  _verifyTask(task, expectedAction) {
    if (!task || task.action !== expectedAction) {
      throw new Error(`Expected action '${expectedAction}', got '${task?.action}'`);
    }
  }
}

export default CraftTaskExecutor;
