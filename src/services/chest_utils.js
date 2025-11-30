/**
 * Chest utility functions for pathfinding and chest interactions
 */

/**
 * Pathfind to a chest location
 * @param {Object} npcSystem - The NPC system instance
 * @param {string} botId - The bot ID
 * @param {Object} chestPos - The chest position {x, y, z}
 */
export function pathfindToChest(npcSystem, botId, chestPos) {
  if (!npcSystem) {
    console.warn('pathfindToChest: npcSystem not provided');
    return;
  }

  if (!botId) {
    console.warn('pathfindToChest: botId not provided');
    return;
  }

  if (!chestPos || typeof chestPos.x !== 'number' || typeof chestPos.y !== 'number' || typeof chestPos.z !== 'number') {
    console.warn('pathfindToChest: invalid chest position', chestPos);
    return;
  }

  try {
    const bot = npcSystem.npcs.get(botId);
    if (!bot || !bot.mineflayer) {
      console.warn(`pathfindToChest: bot ${botId} not found or has no mineflayer instance`);
      return;
    }

    const { x, y, z } = chestPos;
    const goal = new bot.mineflayer.pathfinder.goals.GoalBlock(x, y, z);
    
    bot.mineflayer.pathfinder.setGoal(goal);
    console.log(`Bot ${botId} pathfinding to chest at (${x}, ${y}, ${z})`);
  } catch (error) {
    console.error(`pathfindToChest error for bot ${botId}:`, error.message);
  }
}

/**
 * Find nearby chests around a bot
 * @param {Object} bot - The mineflayer bot instance
 * @param {number} range - Search range (default: 16)
 * @returns {Array} Array of chest blocks
 */
export function findNearbyChests(bot, range = 16) {
  if (!bot || !bot.findBlocks) {
    console.warn('findNearbyChests: invalid bot instance');
    return [];
  }

  try {
    const chestIds = [
      bot.registry?.blocksByName?.chest?.id,
      bot.registry?.blocksByName?.trapped_chest?.id,
      bot.registry?.blocksByName?.ender_chest?.id,
    ].filter(id => id !== undefined);

    if (chestIds.length === 0) {
      console.warn('findNearbyChests: no chest block IDs found in registry');
      return [];
    }

    const chestBlocks = bot.findBlocks({
      matching: chestIds,
      maxDistance: range,
      count: 100
    });

    return chestBlocks.map(pos => bot.blockAt(pos)).filter(Boolean);
  } catch (error) {
    console.error('findNearbyChests error:', error.message);
    return [];
  }
}

/**
 * Get chest contents
 * @param {Object} bot - The mineflayer bot instance
 * @param {Object} chestPos - The chest position {x, y, z}
 * @returns {Promise<Array>} Array of items in chest
 */
export async function getChestContents(bot, chestPos) {
  if (!bot || !chestPos) {
    throw new Error('getChestContents: bot and chestPos are required');
  }

  try {
    const chestBlock = bot.blockAt(bot.vec3(chestPos.x, chestPos.y, chestPos.z));
    if (!chestBlock) {
      throw new Error(`No block found at position (${chestPos.x}, ${chestPos.y}, ${chestPos.z})`);
    }

    const chest = await bot.openContainer(chestBlock);
    const items = chest.containerItems();
    await chest.close();
    
    return items;
  } catch (error) {
    console.error('getChestContents error:', error.message);
    throw error;
  }
}

/**
 * Deposit items into a chest
 * @param {Object} bot - The mineflayer bot instance
 * @param {Object} chestPos - The chest position {x, y, z}
 * @param {Array} items - Array of item names to deposit
 * @returns {Promise<boolean>} Success status
 */
export async function depositToChest(bot, chestPos, items = []) {
  if (!bot || !chestPos) {
    throw new Error('depositToChest: bot and chestPos are required');
  }

  try {
    const chestBlock = bot.blockAt(bot.vec3(chestPos.x, chestPos.y, chestPos.z));
    if (!chestBlock) {
      throw new Error(`No block found at position (${chestPos.x}, ${chestPos.y}, ${chestPos.z})`);
    }

    const chest = await bot.openContainer(chestBlock);
    
    for (const itemName of items) {
      const item = bot.inventory.items().find(i => i.name === itemName);
      if (item) {
        await chest.deposit(item.type, null, item.count);
        console.log(`Deposited ${item.count}x ${itemName} to chest`);
      }
    }

    await chest.close();
    return true;
  } catch (error) {
    console.error('depositToChest error:', error.message);
    throw error;
  }
}

/**
 * Withdraw items from a chest
 * @param {Object} bot - The mineflayer bot instance
 * @param {Object} chestPos - The chest position {x, y, z}
 * @param {Array} items - Array of item names to withdraw
 * @returns {Promise<boolean>} Success status
 */
export async function withdrawFromChest(bot, chestPos, items = []) {
  if (!bot || !chestPos) {
    throw new Error('withdrawFromChest: bot and chestPos are required');
  }

  try {
    const chestBlock = bot.blockAt(bot.vec3(chestPos.x, chestPos.y, chestPos.z));
    if (!chestBlock) {
      throw new Error(`No block found at position (${chestPos.x}, ${chestPos.y}, ${chestPos.z})`);
    }

    const chest = await bot.openContainer(chestBlock);
    
    for (const itemName of items) {
      const item = chest.containerItems().find(i => i.name === itemName);
      if (item) {
        await chest.withdraw(item.type, null, item.count);
        console.log(`Withdrew ${item.count}x ${itemName} from chest`);
      }
    }

    await chest.close();
    return true;
  } catch (error) {
    console.error('withdrawFromChest error:', error.message);
    throw error;
  }
}

/**
 * Check if a position contains a chest block
 * @param {Object} bot - The mineflayer bot instance
 * @param {Object} pos - Position to check {x, y, z}
 * @returns {boolean} True if position has a chest
 */
export function isChestAt(bot, pos) {
  if (!bot || !pos) return false;

  try {
    const block = bot.blockAt(bot.vec3(pos.x, pos.y, pos.z));
    if (!block) return false;

    const chestNames = ['chest', 'trapped_chest', 'ender_chest'];
    return chestNames.includes(block.name);
  } catch (error) {
    console.error('isChestAt error:', error.message);
    return false;
  }
}

export default {
  pathfindToChest,
  findNearbyChests,
  getChestContents,
  depositToChest,
  withdrawFromChest,
  isChestAt
};
