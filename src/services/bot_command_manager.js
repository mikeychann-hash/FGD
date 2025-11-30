// src/services/bot_command_manager.js

/**
 * BotCommandManager – high level actions for Mineflayer bots.
 * Uses existing plugins (collectblock, auto-eat, pvp, pathfinder) to implement
 * game‑level commands such as mining, crafting, attacking, exploring, and building.
 */

import { logger } from '../../logger.js';
import { botControlManager } from './bot_control_manager.js';
import pathfinder from 'mineflayer-pathfinder';
const { Movements, goals } = pathfinder;

class BotCommandManager {
    /** Retrieve the Mineflayer bot instance for a given botId */
    _getBot(botId) {
        const bot = botControlManager.getBotInstance?.(botId) || botControlManager.bots?.get(botId);
        if (!bot) throw new Error(`Bot ${botId} not found`);
        return bot;
    }

    /** Mine a specific block type a number of times */
    async mine(botId, blockType, count = 1) {
        const bot = this._getBot(botId);
        // Ensure collectBlock plugin is loaded (it is loaded in MineflayerBridge)
        await bot.collectBlock.collect(blockType, count);
        logger.info('Mine command executed', { botId, blockType, count });
        return { success: true };
    }

    /** Craft an item using a recipe name */
    async craft(botId, recipe, count = 1) {
        const bot = this._getBot(botId);
        await bot.craft.recipe(recipe, count);
        logger.info('Craft command executed', { botId, recipe, count });
        return { success: true };
    }

    /** Attack a target entity */
    async attack(botId, targetId) {
        const bot = this._getBot(botId);
        const target = bot.entities[targetId];
        if (!target) throw new Error(`Target ${targetId} not found`);
        bot.attack(target);
        logger.info('Attack command executed', { botId, targetId });
        return { success: true };
    }

    /** Explore an area – simple implementation moves to a random nearby position */
    async explore(botId, radius = 20) {
        const bot = this._getBot(botId);
        const movements = new Movements(bot);
        bot.pathfinder.setMovements(movements);
        const x = bot.entity.position.x + (Math.random() - 0.5) * radius;
        const y = bot.entity.position.y;
        const z = bot.entity.position.z + (Math.random() - 0.5) * radius;
        const goal = new goals.GoalNear(x, y, z, 1);
        await bot.pathfinder.goto(goal);
        logger.info('Explore command executed', { botId, destination: { x, y, z } });
        return { success: true };
    }

    /** Build a simple structure from a blueprint (array of block placements) */
    async build(botId, blueprint) {
        const bot = this._getBot(botId);
        // Blueprint format: [{x, y, z, blockName}, ...]
        for (const step of blueprint) {
            const { x, y, z, blockName } = step;
            await bot.placeBlock(bot.blockAt(new bot.vec3(x, y, z)), bot.blockAt(blockName));
        }
        logger.info('Build command executed', { botId, steps: blueprint.length });
        return { success: true };
    }
}

export const botCommandManager = new BotCommandManager();
