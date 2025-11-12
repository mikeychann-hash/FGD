/**
 * Mineflayer Policy Service
 *
 * Initializes and manages the Mineflayer adapter with policy enforcement.
 * This service is responsible for:
 * 1. Creating the MineflayerRouter
 * 2. Wrapping it with EnhancedMineflayerRouter for policy enforcement
 * 3. Providing access to policy status and approval queue
 * 4. Managing the lifecycle of the router
 */

import { MineflayerAdapter } from '../../adapters/mineflayer/index.js';
import { MineflayerRouter } from '../../adapters/mineflayer/router.js';
import { EnhancedMineflayerRouter } from '../../adapters/mineflayer/router_with_policy.js';
import { logger } from '../../logger.js';

export class MineflayerPolicyService {
  constructor(npcSystem, options = {}) {
    this.npcSystem = npcSystem;
    this.options = {
      enablePolicyEnforcement: true,
      maxConcurrentTasks: 100,
      maxTasksPerBot: 8,
      rateLimit: {
        requestsPerMinute: 600,  // 10 per second
        requestsPerHour: 36000
      },
      ...options
    };

    this.adapter = null;
    this.coreRouter = null;
    this.enhancedRouter = null;
    this.initialized = false;
  }

  /**
   * Initialize the Mineflayer policy service
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      // Create the base adapter
      this.adapter = new MineflayerAdapter();

      // Create the core router
      this.coreRouter = new MineflayerRouter(this.adapter, {
        logAllTasks: true,
        requireApprovalForDangerous: true
      });

      // Wrap with policy enforcement
      if (this.options.enablePolicyEnforcement) {
        this.enhancedRouter = new EnhancedMineflayerRouter(
          this.coreRouter,
          {
            global: {
              maxConcurrentTasks: this.options.maxConcurrentTasks,
              maxTasksPerBot: this.options.maxTasksPerBot,
              rateLimit: this.options.rateLimit
            }
          }
        );
      } else {
        this.enhancedRouter = this.coreRouter;
      }

      this.initialized = true;

      logger.info('Mineflayer policy service initialized', {
        policyEnforcement: this.options.enablePolicyEnforcement,
        maxConcurrentTasks: this.options.maxConcurrentTasks,
        maxTasksPerBot: this.options.maxTasksPerBot
      });

      return true;

    } catch (err) {
      logger.error('Failed to initialize Mineflayer policy service', {
        error: err.message
      });

      return false;
    }
  }

  /**
   * Execute task with policy enforcement
   *
   * @param {Object} task - Task to execute
   * @param {Object} context - Context {userId, role, botId}
   * @returns {Promise<Object>}
   */
  async executeTask(task, context = {}) {
    if (!this.initialized) {
      return {
        success: false,
        error: 'Mineflayer policy service not initialized'
      };
    }

    // Use enhanced router if available
    if (this.enhancedRouter !== this.coreRouter) {
      return this.enhancedRouter.executeTaskWithPolicy(task, context);
    }

    // Fall back to core router
    return this.coreRouter.routeTask(task);
  }

  /**
   * Handle dangerous task execution
   *
   * @param {Object} task - Dangerous task
   * @param {Object} context - Context {userId, role, botId}
   * @returns {Promise<Object>}
   */
  async executeDangerousTask(task, context = {}) {
    if (!this.initialized || !this.enhancedRouter || this.enhancedRouter === this.coreRouter) {
      return {
        success: false,
        error: 'Policy enforcement not available'
      };
    }

    return this.enhancedRouter.executeDangerousTask(task, context);
  }

  /**
   * Approve dangerous task
   *
   * @param {string} token - Approval token
   * @param {string} approverId - Admin ID
   * @returns {Promise<Object>}
   */
  async approveDangerousTask(token, approverId) {
    if (!this.initialized || !this.enhancedRouter || this.enhancedRouter === this.coreRouter) {
      return {
        success: false,
        error: 'Policy enforcement not available'
      };
    }

    return this.enhancedRouter.approveDangerousTask(token, approverId);
  }

  /**
   * Reject dangerous task
   *
   * @param {string} token - Approval token
   * @param {string} adminId - Admin ID
   * @param {string} reason - Rejection reason
   * @returns {Object}
   */
  rejectDangerousTask(token, adminId, reason = '') {
    if (!this.initialized || !this.enhancedRouter || this.enhancedRouter === this.coreRouter) {
      return {
        success: false,
        error: 'Policy enforcement not available'
      };
    }

    return this.enhancedRouter.rejectDangerousTask(token, adminId, reason);
  }

  /**
   * Get pending approvals
   *
   * @returns {Array}
   */
  getPendingApprovals() {
    if (!this.initialized || !this.enhancedRouter || this.enhancedRouter === this.coreRouter) {
      return [];
    }

    return this.enhancedRouter.getPendingApprovals();
  }

  /**
   * Get policy status
   *
   * @returns {Object}
   */
  getPolicyStatus() {
    if (!this.initialized || !this.enhancedRouter || this.enhancedRouter === this.coreRouter) {
      return {
        initialized: false,
        error: 'Policy enforcement not available'
      };
    }

    return this.enhancedRouter.getPolicyStatus();
  }

  /**
   * Get router stats
   *
   * @returns {Object}
   */
  getStats() {
    if (!this.initialized || !this.coreRouter) {
      return {};
    }

    return this.coreRouter.getStats();
  }

  /**
   * Reset router stats
   */
  resetStats() {
    if (!this.initialized || !this.coreRouter) {
      return false;
    }

    this.coreRouter.resetStats();
    return true;
  }

  /**
   * Get routing table
   *
   * @returns {Object}
   */
  getRoutingTable() {
    if (!this.initialized || !this.coreRouter) {
      return {};
    }

    return this.coreRouter.getRoutingTable();
  }

  /**
   * Health check
   *
   * @returns {Object}
   */
  health() {
    return {
      initialized: this.initialized,
      adapterHealth: this.adapter?.health() || { healthy: false },
      routerStats: this.getStats(),
      policyStatus: this.getPolicyStatus()
    };
  }
}

export default MineflayerPolicyService;
