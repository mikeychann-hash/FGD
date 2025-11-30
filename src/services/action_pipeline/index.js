// Unified Action Framework pipeline
import { validateRequest, validatePosition } from './validators.js';
import planMine from './planners/mine.js';
import planDig from './planners/dig.js';
import planEat from './planners/eat.js';
import planOpenInventory from './planners/openInventory.js';
import planInventory from './planners/inventory.js';
import planChest from './planners/chest.js';
import planDoors from './planners/doors.js';
import planBeds from './planners/beds.js';
import planWeapons from './planners/weapons.js';
import planPotions from './planners/potions.js';
import planEnchant from './planners/enchanting.js';
import { dispatchAction } from './dispatchers.js';
import { incrementActionFailure } from '../metrics.js';
import { validateBlockBreakable } from './validators.js';
import { SpawnError } from '../spawn_pipeline.js';

const planners = {
  mine: planMine,
  dig: planDig,
  eat: planEat,
  openInventory: planOpenInventory,
  inventory: planInventory,
  chest: planChest,
  'chest.interact': planChest,
  doors: planDoors,
  sleep: planBeds,
  weapon: planWeapons,
  potion: planPotions,
  enchant: planEnchant,
};

export function createActionPipeline(npcSystem, io) {
  const deadLetters = [];
  return {
    /**
     * Run an action through validation, planning, dispatch, confirmation.
     * @param {string} botId
     * @param {object} request
     */
    async run(botId, request) {
      const { type, position } = request || {};
      const bot = validateRequest(npcSystem, { botId, type, payload: request });
      validatePosition(position);

      const planner = planners[type];
      if (!planner) {
        throw new Error(`Unsupported action type: ${type}`);
      }

      if (type === 'mine' || type === 'dig') {
        validateBlockBreakable(request.block);
      }
      if (type === 'eat') {
        // Attach hunger state if available
        request.hunger = npcSystem?.npcEngine?.getHungerLevel(botId) ?? null;
      }

      let plan;
      try {
        plan = planner({
          botId,
          inventory: bot.inventory || bot.metadata?.inventory || [],
          currentPosition: bot.lastKnownPosition || bot.spawnPosition || bot.position || position || null,
          npcSystem,
          ...request,
        });
      } catch (err) {
        const status = err instanceof SpawnError ? err.status || 400 : 400;
        const e = new SpawnError(err.message || 'Action planning failed', status);
        throw e;
      }
      plan.botId = botId;

      try {
        const result = await dispatchAction(npcSystem, io, plan);
        const registry = npcSystem?.npcEngine?.registry;
        if (registry?.upsert) {
          await registry.upsert({
            ...bot,
            lastKnownPosition: plan.position || bot.lastKnownPosition || bot.spawnPosition,
            metadata: {
              ...(bot.metadata || {}),
              lastAction: plan.action,
              lastActionAt: new Date().toISOString(),
              actionState: 'dispatched',
            },
          });
        }
        return { success: true, plan, result };
      } catch (err) {
        incrementActionFailure(type, botId);
        deadLetters.push({
          botId,
          action: type,
          plan,
          error: err.message || 'Action failed',
          timestamp: new Date().toISOString(),
        });
        throw err;
      }
    },
    getDeadLetters() {
      return [...deadLetters];
    },
    async retryDeadLetters() {
      const queue = deadLetters.splice(0, deadLetters.length);
      const successes = [];
      const failures = [];
      for (const entry of queue) {
        try {
          const result = await this.run(entry.botId, entry.plan || { type: entry.action });
          successes.push({ botId: entry.botId, action: entry.action, result });
        } catch (err) {
          failures.push({ botId: entry.botId, action: entry.action, error: err.message });
          deadLetters.push(entry); // requeue
        }
      }
      return { successes, failures, remaining: deadLetters.length };
    },
  };
}

export default createActionPipeline;
