/**
 * Swarm Coordination Engine - Phase 3
 *
 * Manages bot coordination, work distribution, and swarm behaviors:
 * - Work assignment and load balancing
 * - Collision avoidance
 * - Regional coordination
 * - Capability matching
 * - Failure handling and recovery
 */

import { logger } from '../../logger.js';
import { BotRegistry, BOT_STATUS } from './bot_registry.js';

export class CoordinationEngine {
  constructor() {
    this.registry = new BotRegistry();
    this.taskQueue = [];
    this.logger = logger;
  }

  /**
   * Register multiple bots for coordination
   *
   * @param {Array} botConfigs - Array of bot configurations
   * @returns {Object} Registration results
   */
  registerSwarm(botConfigs) {
    const results = {
      success: [],
      failed: []
    };

    for (const config of botConfigs) {
      const result = this.registry.registerBot(config);

      if (result.success) {
        results.success.push(result.bot.botId);
      } else {
        results.failed.push({ botId: config.botId, error: result.error });
      }
    }

    this.logger.info('Swarm registered', {
      success: results.success.length,
      failed: results.failed.length
    });

    return results;
  }

  /**
   * Assign work to best-suited bot
   *
   * @param {string} workId - Work identifier
   * @param {Object} work - Work details {type, priority, region, requiredCapability?}
   * @returns {Object} Assignment result
   */
  assignWork(workId, work) {
    const { region, requiredCapability, priority = 'normal' } = work;

    let candidate = null;

    // If specific capability required, find bots with it
    if (requiredCapability) {
      const capable = this.registry.findBotsByCapability(requiredCapability);

      if (capable.length > 0) {
        // Pick the least busy capable bot
        candidate = capable.reduce((best, botId) => {
          const bestWork = this.registry.getBotWork(best).length;
          const botWork = this.registry.getBotWork(botId).length;
          return botWork < bestWork ? botId : best;
        });
      }
    }

    // If no capability requirement or no capable bots, pick least busy in region
    if (!candidate && region) {
      candidate = this.registry.suggestNextBot(region);
    }

    // If still no candidate, pick global least busy
    if (!candidate) {
      const allBots = this.registry.listBots({ status: BOT_STATUS.IDLE });

      if (allBots.length === 0) {
        return {
          success: false,
          error: 'No available bots for work assignment'
        };
      }

      candidate = allBots.reduce((best, bot) => {
        const bestWork = this.registry.getBotWork(best.botId).length;
        const botWork = this.registry.getBotWork(bot.botId).length;
        return botWork < bestWork ? bot.botId : best.botId;
      });
    }

    // Claim work for selected bot
    const claim = this.registry.claimWork(workId, candidate, work);

    if (claim.success) {
      this.logger.info('Work assigned', {
        workId,
        botId: candidate,
        priority,
        region
      });
    }

    return claim;
  }

  /**
   * Check and resolve collisions in region
   *
   * @param {string} regionId - Region to check
   * @returns {Object} Collision report
   */
  checkAndResolveCollisions(regionId) {
    const collisions = this.registry.findCollisions(regionId, 5);

    const report = {
      regionId,
      detectedCollisions: collisions.length,
      collisions: collisions.map(c => ({
        bot1: c.bot1,
        bot2: c.bot2,
        distance: c.distance.toFixed(2)
      })),
      resolutions: []
    };

    // For each collision, suggest avoidance
    for (const collision of collisions) {
      const bot1 = this.registry.getBot(collision.bot1);
      const bot2 = this.registry.getBot(collision.bot2);

      // Simple resolution: assign one bot to different task
      if (bot1 && bot2) {
        const bot1Work = this.registry.getBotWork(collision.bot1).length;
        const bot2Work = this.registry.getBotWork(collision.bot2).length;

        const busier = bot1Work > bot2Work ? collision.bot1 : collision.bot2;

        report.resolutions.push({
          collision: `${collision.bot1} <-> ${collision.bot2}`,
          suggestion: `Reassign work from ${busier}`,
          action: 'suggest_reassignment'
        });
      }
    }

    return report;
  }

  /**
   * Get swarm status with balance metrics
   *
   * @param {string} regionId - Optional region filter
   * @returns {Object} Status report
   */
  getSwarmStatus(regionId = null) {
    if (regionId) {
      return this.registry.getRegionBalance(regionId);
    }

    const status = this.registry.getStatus();

    return {
      ...status,
      regionBalances: Array.from(
        new Map(
          Array.from({ length: this.registry.regions.size }).map((_, i) => [
            `region_${i}`,
            this.registry.getRegionBalance(`region_${i}`)
          ])
        ).values()
      ).filter(b => b.regionId)
    };
  }

  /**
   * Get suggested next task for bot
   *
   * @param {string} botId - Bot to get task for
   * @returns {Object} Task suggestion
   */
  suggestNextTask(botId) {
    const bot = this.registry.getBot(botId);

    if (!bot) {
      return { success: false, error: 'Bot not found' };
    }

    const currentWork = this.registry.getBotWork(botId);

    return {
      success: true,
      botId,
      currentTasks: currentWork.length,
      capability: bot.role,
      status: bot.status,
      suggestion: currentWork.length < 3 ? 'ready_for_work' : 'busy',
      recommendation: currentWork.length > 0 ? 'complete_current' : 'available'
    };
  }

  /**
   * Simulate swarm behavior for given duration
   *
   * @param {number} ticks - Number of simulation ticks
   * @returns {Object} Simulation results
   */
  simulateSwarm(ticks = 10) {
    const results = {
      ticks,
      timeline: []
    };

    for (let tick = 0; tick < ticks; tick++) {
      const snapshot = {
        tick,
        status: this.registry.getStatus(),
        timestamp: new Date().toISOString()
      };

      results.timeline.push(snapshot);
    }

    return results;
  }

  /**
   * Export registry for analysis
   *
   * @returns {Object} Complete registry state
   */
  exportState() {
    return {
      bots: Array.from(this.registry.bots.values()),
      regions: Object.fromEntries(this.registry.regions),
      workClaims: Object.fromEntries(this.registry.workClaims),
      capabilities: Object.fromEntries(this.registry.capabilities),
      status: this.registry.getStatus()
    };
  }
}

export default CoordinationEngine;
