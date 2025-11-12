/**
 * Bot Registry - Multi-Bot Coordination
 *
 * Manages:
 * - Bot registration with metadata
 * - Capability tracking (what each bot can do)
 * - Location-based awareness
 * - Role assignment
 * - Work claiming and balancing
 */

import { logger } from '../../logger.js';

export const BOT_ROLES = {
  MINER: 'miner',           // Optimized for mining
  BUILDER: 'builder',       // Optimized for building
  EXPLORER: 'explorer',     // Optimized for navigation
  GUARD: 'guard',           // Combat/defense
  COURIER: 'courier',       // Item transport
  GENERALIST: 'generalist'  // Multi-purpose
};

export const BOT_STATUS = {
  OFFLINE: 'offline',
  IDLE: 'idle',
  BUSY: 'busy',
  MINING: 'mining',
  BUILDING: 'building',
  MOVING: 'moving',
  BLOCKED: 'blocked',
  ERROR: 'error'
};

export class BotRegistry {
  constructor() {
    this.bots = new Map();          // botId → BotMetadata
    this.regions = new Map();       // regionId → [botIds]
    this.workClaims = new Map();    // workId → {botId, claimedAt}
    this.capabilities = new Map();  // botId → [capabilities]
    this.logger = logger;
  }

  /**
   * Register a new bot
   *
   * @param {Object} botInfo - Bot configuration
   * @returns {Object} Registration result
   */
  registerBot(botInfo) {
    const {
      botId,
      role = BOT_ROLES.GENERALIST,
      capabilities = [],
      position = { x: 0, y: 64, z: 0 },
      owner = 'system',
      maxHealth = 20,
      inventory = []
    } = botInfo;

    if (!botId) {
      return { success: false, error: 'botId is required' };
    }

    if (this.bots.has(botId)) {
      return { success: false, error: `Bot ${botId} already registered` };
    }

    const bot = {
      botId,
      role,
      capabilities,
      position,
      owner,
      maxHealth,
      currentHealth: maxHealth,
      inventory,
      status: BOT_STATUS.IDLE,
      registeredAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        milesTraveled: 0,
        blocksPlaced: 0,
        blocksMined: 0
      }
    };

    this.bots.set(botId, bot);
    this.capabilities.set(botId, capabilities);

    this.logger.info('Bot registered', { botId, role, owner });

    return { success: true, bot };
  }

  /**
   * Unregister a bot
   *
   * @param {string} botId - Bot to remove
   * @returns {Object} Result
   */
  unregisterBot(botId) {
    if (!this.bots.has(botId)) {
      return { success: false, error: `Bot ${botId} not found` };
    }

    // Release any work claims
    for (const [workId, claim] of this.workClaims.entries()) {
      if (claim.botId === botId) {
        this.workClaims.delete(workId);
      }
    }

    // Remove from regions
    for (const regionBots of this.regions.values()) {
      const idx = regionBots.indexOf(botId);
      if (idx >= 0) regionBots.splice(idx, 1);
    }

    this.bots.delete(botId);
    this.capabilities.delete(botId);

    this.logger.info('Bot unregistered', { botId });

    return { success: true };
  }

  /**
   * Update bot position
   *
   * @param {string} botId - Bot to update
   * @param {Object} position - New position {x, y, z}
   * @returns {Object} Result
   */
  updateBotPosition(botId, position) {
    if (!this.bots.has(botId)) {
      return { success: false, error: `Bot ${botId} not found` };
    }

    const bot = this.bots.get(botId);
    bot.position = position;
    bot.lastUpdate = new Date().toISOString();

    return { success: true, bot };
  }

  /**
   * Update bot status
   *
   * @param {string} botId - Bot to update
   * @param {string} status - New status
   * @returns {Object} Result
   */
  updateBotStatus(botId, status) {
    if (!this.bots.has(botId)) {
      return { success: false, error: `Bot ${botId} not found` };
    }

    if (!Object.values(BOT_STATUS).includes(status)) {
      return { success: false, error: `Invalid status: ${status}` };
    }

    const bot = this.bots.get(botId);
    bot.status = status;
    bot.lastUpdate = new Date().toISOString();

    return { success: true, bot };
  }

  /**
   * Get bot by ID
   *
   * @param {string} botId - Bot to retrieve
   * @returns {Object|null}
   */
  getBot(botId) {
    return this.bots.get(botId) || null;
  }

  /**
   * List all bots
   *
   * @param {Object} filter - Optional {role, status, owner}
   * @returns {Array}
   */
  listBots(filter = {}) {
    let bots = Array.from(this.bots.values());

    if (filter.role) {
      bots = bots.filter(b => b.role === filter.role);
    }

    if (filter.status) {
      bots = bots.filter(b => b.status === filter.status);
    }

    if (filter.owner) {
      bots = bots.filter(b => b.owner === filter.owner);
    }

    return bots;
  }

  /**
   * Find bots by capability
   *
   * @param {string} capability - Capability to search for
   * @returns {Array} Bot IDs
   */
  findBotsByCapability(capability) {
    const matching = [];

    for (const [botId, capabilities] of this.capabilities.entries()) {
      if (capabilities.includes(capability)) {
        matching.push(botId);
      }
    }

    return matching;
  }

  /**
   * Find nearest bot to position
   *
   * @param {Object} position - Reference position {x, y, z}
   * @param {Object} filter - Optional {role, status, capability}
   * @returns {Object|null} Nearest bot or null
   */
  findNearestBot(position, filter = {}) {
    let candidates = this.listBots(filter);

    if (candidates.length === 0) return null;

    let nearest = null;
    let minDistance = Infinity;

    for (const bot of candidates) {
      const distance = this._distance(bot.position, position);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = bot;
      }
    }

    return nearest;
  }

  /**
   * Claim work for a bot
   *
   * @param {string} workId - Unique work identifier
   * @param {string} botId - Bot claiming work
   * @param {Object} details - Work details
   * @returns {Object} Claim result
   */
  claimWork(workId, botId, details = {}) {
    if (!this.bots.has(botId)) {
      return { success: false, error: `Bot ${botId} not found` };
    }

    if (this.workClaims.has(workId)) {
      const existing = this.workClaims.get(workId);
      return {
        success: false,
        error: `Work ${workId} already claimed by ${existing.botId}`,
        claimedBy: existing.botId
      };
    }

    const claim = {
      workId,
      botId,
      claimedAt: new Date().toISOString(),
      details
    };

    this.workClaims.set(workId, claim);

    this.logger.info('Work claimed', { workId, botId });

    return { success: true, claim };
  }

  /**
   * Release work claim
   *
   * @param {string} workId - Work to release
   * @returns {Object} Result
   */
  releaseWork(workId) {
    if (!this.workClaims.has(workId)) {
      return { success: false, error: `Work ${workId} not claimed` };
    }

    const claim = this.workClaims.get(workId);
    this.workClaims.delete(workId);

    this.logger.info('Work released', { workId, botId: claim.botId });

    return { success: true, claim };
  }

  /**
   * Get bot's claimed work
   *
   * @param {string} botId - Bot to check
   * @returns {Array} List of work claims
   */
  getBotWork(botId) {
    const work = [];

    for (const claim of this.workClaims.values()) {
      if (claim.botId === botId) {
        work.push(claim);
      }
    }

    return work;
  }

  /**
   * Register region and assign bots
   *
   * @param {string} regionId - Region identifier
   * @param {Array} botIds - Bots to assign
   * @returns {Object} Result
   */
  registerRegion(regionId, botIds = []) {
    const validBots = [];

    for (const botId of botIds) {
      if (this.bots.has(botId)) {
        validBots.push(botId);
      }
    }

    this.regions.set(regionId, validBots);

    this.logger.info('Region registered', { regionId, botCount: validBots.length });

    return { success: true, regionId, botIds: validBots };
  }

  /**
   * Get bots in region
   *
   * @param {string} regionId - Region to check
   * @returns {Array} Bot IDs in region
   */
  getRegionBots(regionId) {
    return this.regions.get(regionId) || [];
  }

  /**
   * Assign bot to region
   *
   * @param {string} botId - Bot to assign
   * @param {string} regionId - Target region
   * @returns {Object} Result
   */
  assignBotToRegion(botId, regionId) {
    if (!this.bots.has(botId)) {
      return { success: false, error: `Bot ${botId} not found` };
    }

    if (!this.regions.has(regionId)) {
      this.regions.set(regionId, []);
    }

    const regionBots = this.regions.get(regionId);

    if (!regionBots.includes(botId)) {
      regionBots.push(botId);
    }

    return { success: true, regionId, botId };
  }

  /**
   * Check collision risk between two bots
   *
   * @param {string} botId1 - First bot
   * @param {string} botId2 - Second bot
   * @param {number} threshold - Distance threshold (default 5)
   * @returns {boolean} True if collision risk
   */
  checkCollision(botId1, botId2, threshold = 5) {
    const bot1 = this.bots.get(botId1);
    const bot2 = this.bots.get(botId2);

    if (!bot1 || !bot2) return false;

    const distance = this._distance(bot1.position, bot2.position);
    return distance < threshold;
  }

  /**
   * Find all collisions in region
   *
   * @param {string} regionId - Region to check
   * @param {number} threshold - Distance threshold
   * @returns {Array} List of collision pairs
   */
  findCollisions(regionId, threshold = 5) {
    const regionBots = this.getRegionBots(regionId);
    const collisions = [];

    for (let i = 0; i < regionBots.length; i++) {
      for (let j = i + 1; j < regionBots.length; j++) {
        if (this.checkCollision(regionBots[i], regionBots[j], threshold)) {
          collisions.push({
            bot1: regionBots[i],
            bot2: regionBots[j],
            distance: this._distance(
              this.bots.get(regionBots[i]).position,
              this.bots.get(regionBots[j]).position
            )
          });
        }
      }
    }

    return collisions;
  }

  /**
   * Calculate workload balance for region
   *
   * @param {string} regionId - Region to analyze
   * @returns {Object} Balance metrics
   */
  getRegionBalance(regionId) {
    const regionBots = this.getRegionBots(regionId);
    const tasks = {};
    let totalTasks = 0;

    for (const botId of regionBots) {
      const work = this.getBotWork(botId);
      tasks[botId] = work.length;
      totalTasks += work.length;
    }

    const avgLoad = regionBots.length > 0 ? totalTasks / regionBots.length : 0;
    const imbalance = this._calculateImbalance(Object.values(tasks));

    return {
      regionId,
      botCount: regionBots.length,
      totalTasks,
      avgLoad,
      imbalance,
      botLoads: tasks
    };
  }

  /**
   * Suggest next bot for work in region
   *
   * @param {string} regionId - Region to check
   * @returns {string|null} Suggested bot ID or null
   */
  suggestNextBot(regionId) {
    const regionBots = this.getRegionBots(regionId);

    if (regionBots.length === 0) return null;

    // Find bot with least work
    let leastBusy = regionBots[0];
    let minWork = this.getBotWork(leastBusy).length;

    for (const botId of regionBots) {
      const work = this.getBotWork(botId).length;
      if (work < minWork) {
        leastBusy = botId;
        minWork = work;
      }
    }

    return leastBusy;
  }

  /**
   * Get full registry status
   *
   * @returns {Object} Status snapshot
   */
  getStatus() {
    const statuses = {};

    for (const [status, bots] of Object.entries(
      this._groupBy(Array.from(this.bots.values()), 'status')
    )) {
      statuses[status] = bots.length;
    }

    return {
      totalBots: this.bots.size,
      statuses,
      regions: this.regions.size,
      claimedWork: this.workClaims.size,
      timestamp: new Date().toISOString()
    };
  }

  // Private helpers

  _distance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  _calculateImbalance(values) {
    if (values.length <= 1) return 0;

    const avg = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;

    return Math.sqrt(variance);
  }

  _groupBy(items, key) {
    return items.reduce((acc, item) => {
      const group = item[key];
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
    }, {});
  }
}

export default BotRegistry;
