/**
 * Enhanced Mineflayer Router with Policy Integration
 *
 * Wraps the standard MineflayerRouter to add policy enforcement,
 * rate limiting, and role-based access control.
 *
 * This layer sits between API routes and the core router.executeTask()
 */

import { PolicyEngine } from './policy_engine.js';
import { logger } from '../../logger.js';

export class EnhancedMineflayerRouter {
  constructor(coreRouter, customPolicies = {}) {
    if (!coreRouter) {
      throw new Error('EnhancedMineflayerRouter requires a core router instance');
    }

    this.coreRouter = coreRouter;
    this.policyEngine = new PolicyEngine(customPolicies);
    this.logger = logger;
  }

  /**
   * Execute task with policy enforcement
   *
   * @param {Object} task - Task to execute
   * @param {Object} context - Context {userId, role, botId}
   * @returns {Promise<{success: boolean, result?: any, error?: string, warnings?: Array}>}
   */
  async executeTaskWithPolicy(task, context = {}) {
    const { userId = 'anonymous', role = 'viewer', botId } = context;

    // Step 1: Validate policy
    const policyCheck = this.policyEngine.validateTaskPolicy(task, { userId, role, botId });

    if (!policyCheck.valid) {
      this.logger.warn('Task rejected by policy', {
        taskId: task.botId + ':' + task.type,
        userId,
        role,
        errors: policyCheck.errors
      });

      return {
        success: false,
        error: `Policy violation: ${policyCheck.errors.join('; ')}`,
        policyDetails: policyCheck
      };
    }

    // Step 2: Increment concurrency counter
    this.policyEngine.incrementBotTaskCount(botId);

    try {
      // Step 3: Execute task through core router
      const result = await this.coreRouter.routeTask(task);

      // Step 4: Log execution
      this.logger.info('Task executed', {
        taskId: task.botId + ':' + task.type,
        userId,
        role,
        success: result.success,
        warnings: policyCheck.warnings
      });

      return {
        ...result,
        warnings: policyCheck.warnings.length > 0 ? policyCheck.warnings : undefined
      };

    } catch (err) {
      this.logger.error('Task execution error', {
        taskId: task.botId + ':' + task.type,
        userId,
        role,
        error: err.message
      });

      throw err;

    } finally {
      // Step 5: Decrement concurrency counter
      this.policyEngine.decrementBotTaskCount(botId);
    }
  }

  /**
   * Execute dangerous task (requires approval)
   *
   * @param {Object} task - Task to execute
   * @param {Object} context - Context {userId, role, botId}
   * @returns {Promise<{approved: boolean, token?: string}>}
   */
  async executeDangerousTask(task, context = {}) {
    const { userId = 'anonymous', role = 'viewer' } = context;

    // Only admins can auto-approve dangerous tasks
    if (role !== 'admin') {
      const token = this.policyEngine.queueForApproval(task, userId);
      return {
        approved: false,
        token,
        message: 'Dangerous task queued for admin approval'
      };
    }

    // Admin bypass
    return this.executeTaskWithPolicy(task, context);
  }

  /**
   * Approve a pending dangerous task
   *
   * @param {string} token - Approval token
   * @param {string} approverId - Admin ID
   * @returns {Promise<{success: boolean, task?: Object}>}
   */
  async approveDangerousTask(token, approverId) {
    const approval = this.policyEngine.approveTask(token, approverId);

    if (!approval.success) {
      return approval;
    }

    // Execute the approved task
    try {
      const result = await this.executeTaskWithPolicy(approval.approval.task, {
        userId: approval.approval.userId,
        role: 'autopilot',  // Treat as autopilot after approval
        botId: approval.approval.task.botId
      });

      return {
        success: true,
        approvalToken: token,
        executionResult: result
      };

    } catch (err) {
      this.logger.error('Failed to execute approved task', {
        token,
        error: err.message
      });

      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Reject a pending dangerous task
   *
   * @param {string} token - Approval token
   * @param {string} adminId - Admin ID rejecting
   * @param {string} reason - Rejection reason
   * @returns {{success: boolean}}
   */
  rejectDangerousTask(token, adminId, reason = '') {
    return this.policyEngine.rejectTask(token, adminId, reason);
  }

  /**
   * Get policy enforcement status
   *
   * @returns {Object}
   */
  getPolicyStatus() {
    return this.policyEngine.getPolicySummary();
  }

  /**
   * Get approval queue
   *
   * @returns {Array}
   */
  getPendingApprovals() {
    return Array.from(this.policyEngine.approvalQueue.values())
      .filter(a => a.status === 'pending')
      .map(a => ({
        token: Array.from(this.policyEngine.approvalQueue.entries())
          .find(([k, v]) => v === a)[0],
        task: a.task,
        requestedBy: a.userId,
        requestedAt: a.requestedAt
      }));
  }

  /**
   * Forward routing table and stats from core router
   */
  getRoutingTable() {
    return this.coreRouter.getRoutingTable();
  }

  getStats() {
    return this.coreRouter.getStats();
  }

  resetStats() {
    return this.coreRouter.resetStats();
  }
}

export default EnhancedMineflayerRouter;
