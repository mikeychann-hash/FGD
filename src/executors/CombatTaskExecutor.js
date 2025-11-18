/**
 * Combat Task Executor
 *
 * Handles bot combat operations including entity targeting, attacking, and evasion.
 * Uses mineflayer-pvp plugin for advanced combat mechanics.
 */

import { BaseTaskExecutor } from './BaseTaskExecutor.js';
import { logger } from '../../logger.js';

export class CombatTaskExecutor extends BaseTaskExecutor {
  /**
   * Execute combat task
   * @param {string} botId - Bot identifier
   * @param {Object} task - Task object
   * @param {string} task.action - Always 'combat'
   * @param {Object} task.params - Combat parameters
   * @param {string} task.params.subAction - 'attack', 'target', 'evade', 'defend'
   * @param {string} task.params.entityType - Type of entity to target (zombie, creeper, etc.)
   * @param {number} task.params.range - Search radius (default 16)
   * @param {number} task.params.timeout - Operation timeout (default 30000)
   * @param {boolean} task.params.autoWeapon - Auto-select best weapon (default true)
   * @param {number} task.params.maxDamage - Stop when health below this (default 5)
   * @returns {Promise<Object>} Combat result
   */
  async execute(botId, task) {
    try {
      this._verifyTask(task, 'combat');

      const {
        subAction = 'attack',
        entityType,
        range = 16,
        timeout = 30000,
        autoWeapon = true,
        maxDamage = 5,
      } = task.params || {};

      return await this._withTimeout(timeout, async () => {
        const bot = this.bridge.bots.get(botId);
        if (!bot) {
          return { success: false, error: `Bot ${botId} not found` };
        }

        const botState = this.bridge.getBotState(botId);
        if (!botState) {
          return { success: false, error: 'Bot state unavailable' };
        }

        // Check bot health
        if (botState.health <= maxDamage) {
          return {
            success: false,
            error: 'Bot health too low for combat',
            health: botState.health,
            maxDamage,
          };
        }

        // Execute sub-action
        switch (subAction.toLowerCase()) {
          case 'attack':
            return await this._handleAttack(bot, botId, entityType, range, autoWeapon, timeout);
          case 'target':
            return await this._handleTarget(bot, botId, entityType, range);
          case 'evade':
            return await this._handleEvade(bot, botId, range, timeout);
          case 'defend':
            return await this._handleDefend(bot, botId, timeout);
          default:
            return { success: false, error: `Unknown combat subAction: ${subAction}` };
        }
      });
    } catch (err) {
      logger.error('Combat task execution failed', { botId, error: err.message });
      return {
        success: false,
        error: err.message,
        action: 'combat',
      };
    }
  }

  /**
   * Handle attack action
   * @private
   */
  async _handleAttack(bot, botId, entityType, range, autoWeapon, timeout) {
    try {
      // Find target entity
      const target = this._findTargetEntity(bot, entityType, range);
      if (!target) {
        return {
          success: false,
          error: `No ${entityType || 'enemy'} found within ${range} blocks`,
          entityType,
          range,
        };
      }

      // Auto-select weapon if enabled
      if (autoWeapon) {
        const weapon = this._selectBestWeapon(bot);
        if (weapon) {
          await bot.equip(weapon, 'hand');
        }
      }

      // Attack the target
      let attackCount = 0;
      const attackStart = Date.now();
      const targetPosition = target.position.copy();

      while (target.health > 0 && Date.now() - attackStart < timeout) {
        // Check if target still exists and is alive
        const currentTarget = bot.nearestEntity((entity) => entity.id === target.id);
        if (!currentTarget || currentTarget.health <= 0) {
          break;
        }

        // Move closer if needed (2 block approach distance)
        const distance = bot.entity.position.distanceTo(currentTarget.position);
        if (distance > 3) {
          await bot.pathfinder.goto(
            new (await import('mineflayer-pathfinder')).goals.GoalNear(
              currentTarget.position.x,
              currentTarget.position.y,
              currentTarget.position.z,
              2
            )
          );
        }

        // Attack
        await bot.attack(currentTarget);
        attackCount++;

        // Small delay between attacks
        await this._delay(100);
      }

      // Check result
      const finalTarget = bot.nearestEntity((entity) => entity.id === target.id);
      const targetDead = !finalTarget || finalTarget.health <= 0;

      return {
        success: targetDead,
        action: 'combat:attack',
        entityType: target.name,
        attacks: attackCount,
        targetDead,
        targetHealth: finalTarget?.health || 0,
        botHealth: bot.health,
        botFood: bot.food,
      };
    } catch (err) {
      logger.error('Attack failed', { botId, error: err.message });
      return {
        success: false,
        error: err.message,
        action: 'combat:attack',
      };
    }
  }

  /**
   * Handle target action (locate and track entity)
   * @private
   */
  async _handleTarget(bot, botId, entityType, range) {
    try {
      const target = this._findTargetEntity(bot, entityType, range);
      if (!target) {
        return {
          success: false,
          error: `No ${entityType || 'entity'} found within ${range} blocks`,
          entityType,
          range,
        };
      }

      const distance = bot.entity.position.distanceTo(target.position);

      return {
        success: true,
        action: 'combat:target',
        entity: {
          id: target.id,
          name: target.name,
          type: target.type,
          health: target.health,
          position: {
            x: target.position.x,
            y: target.position.y,
            z: target.position.z,
          },
          distance: Math.round(distance * 100) / 100,
        },
        botPosition: {
          x: bot.entity.position.x,
          y: bot.entity.position.y,
          z: bot.entity.position.z,
        },
      };
    } catch (err) {
      logger.error('Target action failed', { botId, error: err.message });
      return {
        success: false,
        error: err.message,
        action: 'combat:target',
      };
    }
  }

  /**
   * Handle evade action (run away from nearest threat)
   * @private
   */
  async _handleEvade(bot, botId, range, timeout) {
    try {
      // Find nearest hostile entity
      const threats = bot.nearestEntity((entity) => {
        return entity.type === 'mob' && entity.metadata[16] !== undefined; // Check if hostile
      });

      if (!threats) {
        return {
          success: true,
          action: 'combat:evade',
          message: 'No threats detected',
        };
      }

      // Move away from threat (find safe position)
      const threatPos = threats.position;
      const botPos = bot.entity.position;

      // Calculate opposite direction
      const direction = botPos.clone().subtract(threatPos).normalize();
      const safeX = botPos.x + direction.x * 20;
      const safeY = botPos.y;
      const safeZ = botPos.z + direction.z * 20;

      const evadeStart = Date.now();
      const evadeGoal = new (await import('mineflayer-pathfinder')).goals.GoalXZ(safeX, safeZ, 1);

      // Attempt to reach safe position
      await Promise.race([
        bot.pathfinder.goto(evadeGoal),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Evade timeout')), timeout)),
      ]).catch((err) => {
        if (err.message !== 'Evade timeout') throw err;
      });

      const evadeTime = Date.now() - evadeStart;
      const finalDistance = bot.entity.position.distanceTo(threats.position);

      return {
        success: finalDistance > 15,
        action: 'combat:evade',
        threatType: threats.name,
        finalDistance: Math.round(finalDistance * 100) / 100,
        evadeTime,
        botHealth: bot.health,
        escaped: finalDistance > 15,
      };
    } catch (err) {
      logger.error('Evade action failed', { botId, error: err.message });
      return {
        success: false,
        error: err.message,
        action: 'combat:evade',
      };
    }
  }

  /**
   * Handle defend action (prepare for incoming threats)
   * @private
   */
  async _handleDefend(bot, botId, timeout) {
    try {
      // Equip best weapon and armor
      const weapon = this._selectBestWeapon(bot);
      if (weapon) {
        await bot.equip(weapon, 'hand');
      }

      // Equip best armor pieces
      const armor = this._selectBestArmor(bot);
      for (const [slot, item] of Object.entries(armor)) {
        if (item) {
          await bot.equip(item, slot);
        }
      }

      // Scan for threats
      const threats = [];
      for (const entity of Object.values(bot.entities)) {
        if (entity.type === 'mob' && entity.metadata[16] !== undefined) {
          threats.push({
            name: entity.name,
            distance: bot.entity.position.distanceTo(entity.position),
            health: entity.health,
          });
        }
      }

      return {
        success: true,
        action: 'combat:defend',
        prepared: {
          weaponEquipped: !!weapon,
          armorEquipped: Object.values(armor).some((a) => a !== null),
          threatCount: threats.length,
          threats: threats.slice(0, 5), // Top 5 nearest threats
        },
        botHealth: bot.health,
        botFood: bot.food,
      };
    } catch (err) {
      logger.error('Defend action failed', { botId, error: err.message });
      return {
        success: false,
        error: err.message,
        action: 'combat:defend',
      };
    }
  }

  /**
   * Find target entity
   * @private
   */
  _findTargetEntity(bot, entityType, range) {
    let target = null;
    let closestDistance = Infinity;

    for (const entity of Object.values(bot.entities)) {
      if (entity.id === bot.entity.id) continue; // Skip self
      if (entity.type !== 'mob' && entity.type !== 'player') continue;

      const distance = bot.entity.position.distanceTo(entity.position);
      if (distance > range) continue;

      // Filter by entity type if specified
      if (entityType && !entity.name.toLowerCase().includes(entityType.toLowerCase())) {
        continue;
      }

      if (distance < closestDistance) {
        closestDistance = distance;
        target = entity;
      }
    }

    return target;
  }

  /**
   * Select best weapon from inventory
   * @private
   */
  _selectBestWeapon(bot) {
    const weapons = {
      diamond_sword: 7,
      iron_sword: 6,
      stone_sword: 5,
      golden_sword: 4,
      wooden_sword: 3,
      diamond_axe: 7,
      iron_axe: 6,
      diamond_pickaxe: 5,
      diamond_shovel: 4,
    };

    let bestWeapon = null;
    let bestRating = 0;

    for (const item of bot.inventory.items()) {
      const rating = weapons[item.name] || 0;
      if (rating > bestRating) {
        bestRating = rating;
        bestWeapon = item;
      }
    }

    return bestWeapon;
  }

  /**
   * Select best armor pieces from inventory
   * @private
   */
  _selectBestArmor(bot) {
    const armorSlots = ['head', 'chest', 'legs', 'feet'];
    const armorRatings = {
      diamond_helmet: 5,
      iron_helmet: 4,
      golden_helmet: 3,
      leather_helmet: 1,
      diamond_chestplate: 5,
      iron_chestplate: 4,
      diamond_leggings: 5,
      iron_leggings: 4,
      diamond_boots: 5,
      iron_boots: 4,
    };

    const selected = {
      head: null,
      chest: null,
      legs: null,
      feet: null,
    };

    const items = bot.inventory.items();
    for (const item of items) {
      for (const [slot, current] of Object.entries(selected)) {
        if (item.name.includes(slot.toLowerCase() === 'chest' ? 'chestplate' : slot)) {
          const rating = armorRatings[item.name] || 0;
          const currentRating = current ? armorRatings[current.name] || 0 : 0;
          if (rating > currentRating) {
            selected[slot] = item;
          }
        }
      }
    }

    return selected;
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

export default CombatTaskExecutor;
