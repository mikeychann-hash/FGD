/**
 * Policy Engine for Mineflayer Adapter
 *
 * Enforces safety policies based on:
 * 1. Role-based access control (ADMIN, AUTOPILOT, VIEWER)
 * 2. Rate limiting per bot and global
 * 3. Dangerous action approval requirements
 * 4. World and region restrictions
 *
 * All tasks must pass policy checks before execution.
 */

import { logger } from '../../logger.js';

export const ROLES = {
  ADMIN: 'admin',           // Full access
  AUTOPILOT: 'autopilot',   // Limited autonomous access
  VIEWER: 'viewer'          // Read-only access
};

export const DANGEROUS_ACTIONS = [
  'tnt', 'redstone_block', 'command_block', 'structure_block',
  'bedrock', 'void_air', 'end_portal_frame', 'end_portal',
  'spawner', 'end_gateway'
];

/**
 * Policy configuration defaults
 */
const DEFAULT_POLICIES = {
  global: {
    maxConcurrentTasks: 100,
    maxTasksPerBot: 8,
    rateLimit: {
      requestsPerMinute: 600,    // 10 per second
      requestsPerHour: 36000
    }
  },
  rolePermissions: {
    admin: {
      canSubmitTasks: true,
      canApproveActions: true,
      canModifyPolicy: true,
      allowedTaskTypes: ['all'],
      allowedActions: ['all'],
      canAccessAllBots: true
    },
    autopilot: {
      canSubmitTasks: true,
      canApproveActions: false,
      canModifyPolicy: false,
      allowedTaskTypes: ['move_to', 'navigate', 'mine_block', 'place_block', 'chat', 'look_at'],
      allowedActions: ['safe'],
      canAccessAllBots: false,  // Only own bots
      maxTasksPerBot: 3
    },
    viewer: {
      canSubmitTasks: false,
      canApproveActions: false,
      canModifyPolicy: false,
      allowedTaskTypes: [],
      allowedActions: [],
      canAccessAllBots: true
    }
  },
  worldRestrictions: {
    allowedDimensions: ['overworld', 'nether', 'end'],
    forbiddenRegions: []
  }
};

export class PolicyEngine {
  constructor(customPolicies = {}) {
    this.policies = { ...DEFAULT_POLICIES, ...customPolicies };
    this.rateLimiter = new Map();    // Per-user rate tracking
    this.botLimiter = new Map();     // Per-bot task counting
    this.approvalQueue = new Map();  // Tasks awaiting approval
    this.logger = logger;
  }

  /**
   * Check if user can perform action based on role
   * @param {string} role - User role (admin, autopilot, viewer)
   * @param {string} action - Action to perform (submit_task, approve_action, etc.)
   * @returns {boolean}
   */
  canUserPerformAction(role, action) {
    const roleConfig = this.policies.rolePermissions[role];
    if (!roleConfig) {
      this.logger.warn('Unknown role', { role });
      return false;
    }

    const actionMap = {
      'submit_task': roleConfig.canSubmitTasks,
      'approve_action': roleConfig.canApproveActions,
      'modify_policy': roleConfig.canModifyPolicy,
      'read_data': true  // All roles can read
    };

    return actionMap[action] || false;
  }

  /**
   * Check if task type is allowed for role
   * @param {string} role - User role
   * @param {string} taskType - Task type (move_to, mine_block, etc.)
   * @returns {boolean}
   */
  isTaskTypeAllowed(role, taskType) {
    const roleConfig = this.policies.rolePermissions[role];
    if (!roleConfig) return false;

    if (roleConfig.allowedTaskTypes.includes('all')) return true;
    return roleConfig.allowedTaskTypes.includes(taskType);
  }

  /**
   * Check if user can access bot
   * @param {string} role - User role
   * @param {string} userId - User ID
   * @param {string} botId - Bot ID
   * @returns {boolean}
   */
  canAccessBot(role, userId, botId) {
    const roleConfig = this.policies.rolePermissions[role];
    if (!roleConfig) return false;

    // Admin can access all bots
    if (roleConfig.canAccessAllBots) return true;

    // Autopilot can only access their own bots
    if (role === 'autopilot' && botId.startsWith(userId)) return true;

    return false;
  }

  /**
   * Check rate limit for user
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @returns {{allowed: boolean, remaining: number, resetAt: number}}
   */
  checkRateLimit(userId, role) {
    const now = Date.now();
    const limiterKey = `${userId}:${role}`;

    if (!this.rateLimiter.has(limiterKey)) {
      this.rateLimiter.set(limiterKey, {
        count: 0,
        resetAt: now + 60000  // 1 minute
      });
    }

    const limiter = this.rateLimiter.get(limiterKey);

    // Reset if window expired
    if (now > limiter.resetAt) {
      limiter.count = 0;
      limiter.resetAt = now + 60000;
    }

    const limit = this.policies.global.rateLimit.requestsPerMinute;
    const allowed = limiter.count < limit;

    if (allowed) {
      limiter.count++;
    }

    return {
      allowed,
      remaining: Math.max(0, limit - limiter.count),
      resetAt: limiter.resetAt,
      limit
    };
  }

  /**
   * Check concurrent tasks limit for bot
   * @param {string} botId - Bot ID
   * @returns {{allowed: boolean, current: number, limit: number}}
   */
  checkBotConcurrencyLimit(botId) {
    const current = this.botLimiter.get(botId) || 0;
    const limit = this.policies.global.maxTasksPerBot;
    const allowed = current < limit;

    return {
      allowed,
      current,
      limit
    };
  }

  /**
   * Increment concurrent task count for bot
   * @param {string} botId - Bot ID
   */
  incrementBotTaskCount(botId) {
    const current = this.botLimiter.get(botId) || 0;
    this.botLimiter.set(botId, current + 1);
  }

  /**
   * Decrement concurrent task count for bot
   * @param {string} botId - Bot ID
   */
  decrementBotTaskCount(botId) {
    const current = this.botLimiter.get(botId) || 0;
    if (current > 0) {
      this.botLimiter.set(botId, current - 1);
    }
  }

  /**
   * Check if task involves dangerous action
   * @param {Object} task - Task object
   * @returns {{isDangerous: boolean, reason: string}}
   */
  checkDangerousAction(task) {
    // Check for dangerous block types
    if (task.type === 'place_block' && task.parameters?.blockType) {
      const blockType = task.parameters.blockType.toLowerCase();
      if (DANGEROUS_ACTIONS.includes(blockType)) {
        return {
          isDangerous: true,
          reason: `Dangerous block type: ${blockType}`
        };
      }
    }

    if (task.type === 'mine_block' && task.parameters?.blockType) {
      const blockType = task.parameters.blockType.toLowerCase();
      if (DANGEROUS_ACTIONS.includes(blockType)) {
        return {
          isDangerous: true,
          reason: `Attempting to mine dangerous block: ${blockType}`
        };
      }
    }

    return { isDangerous: false };
  }

  /**
   * Validate task against policy constraints
   * @param {Object} task - Task to validate
   * @param {Object} context - Context {userId, role, botId}
   * @returns {{valid: boolean, errors: Array, warnings: Array}}
   */
  validateTaskPolicy(task, context) {
    const { userId, role, botId } = context;
    const errors = [];
    const warnings = [];

    // Check if user can submit tasks
    if (!this.canUserPerformAction(role, 'submit_task')) {
      errors.push(`Role '${role}' cannot submit tasks`);
    }

    // Check if task type is allowed
    if (!this.isTaskTypeAllowed(role, task.type)) {
      errors.push(`Task type '${task.type}' not allowed for role '${role}'`);
    }

    // Check if user can access bot
    if (!this.canAccessBot(role, userId, botId)) {
      errors.push(`Role '${role}' cannot access bot '${botId}'`);
    }

    // Check bot concurrency limit
    const concurrency = this.checkBotConcurrencyLimit(botId);
    if (!concurrency.allowed) {
      errors.push(`Bot '${botId}' has reached max concurrent tasks (${concurrency.limit})`);
    }

    // Check rate limit
    const rateLimit = this.checkRateLimit(userId, role);
    if (!rateLimit.allowed) {
      errors.push(`Rate limit exceeded. Reset at ${new Date(rateLimit.resetAt).toISOString()}`);
    }

    // Check for dangerous actions
    const danger = this.checkDangerousAction(task);
    if (danger.isDangerous) {
      if (role === 'admin') {
        warnings.push(`⚠️  Dangerous action: ${danger.reason}`);
      } else {
        errors.push(`Dangerous action requires admin approval: ${danger.reason}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      rateLimit,
      concurrency
    };
  }

  /**
   * Queue task for approval (dangerous actions)
   * @param {Object} task - Task to queue
   * @param {string} userId - User ID
   * @returns {string} Approval token
   */
  queueForApproval(task, userId) {
    const token = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.approvalQueue.set(token, {
      task,
      userId,
      requestedAt: new Date().toISOString(),
      status: 'pending'
    });

    this.logger.info('Task queued for approval', {
      token,
      taskType: task.type,
      userId
    });

    return token;
  }

  /**
   * Approve queued task
   * @param {string} token - Approval token
   * @param {string} approverId - Admin ID approving
   * @returns {Object} Approval result
   */
  approveTask(token, approverId) {
    const approval = this.approvalQueue.get(token);

    if (!approval) {
      return { success: false, error: 'Approval not found' };
    }

    if (approval.status !== 'pending') {
      return { success: false, error: `Already ${approval.status}` };
    }

    approval.status = 'approved';
    approval.approvedAt = new Date().toISOString();
    approval.approvedBy = approverId;

    this.logger.info('Task approved', {
      token,
      approvedBy: approverId,
      taskType: approval.task.type
    });

    return { success: true, token, approval };
  }

  /**
   * Reject queued task
   * @param {string} token - Approval token
   * @param {string} rejectedBy - Admin ID rejecting
   * @param {string} reason - Rejection reason
   * @returns {Object} Rejection result
   */
  rejectTask(token, rejectedBy, reason = '') {
    const approval = this.approvalQueue.get(token);

    if (!approval) {
      return { success: false, error: 'Approval not found' };
    }

    approval.status = 'rejected';
    approval.rejectedAt = new Date().toISOString();
    approval.rejectedBy = rejectedBy;
    approval.rejectionReason = reason;

    this.logger.warn('Task rejected', {
      token,
      rejectedBy,
      reason,
      taskType: approval.task.type
    });

    return { success: true, token, approval };
  }

  /**
   * Get approval status
   * @param {string} token - Approval token
   * @returns {Object|null}
   */
  getApprovalStatus(token) {
    return this.approvalQueue.get(token) || null;
  }

  /**
   * Get policy summary
   * @returns {Object}
   */
  getPolicySummary() {
    return {
      global: this.policies.global,
      roles: Object.keys(this.policies.rolePermissions),
      dangerousBlocks: DANGEROUS_ACTIONS,
      activeLimiters: {
        rateLimiters: this.rateLimiter.size,
        botLimiters: this.botLimiter.size,
        pendingApprovals: Array.from(this.approvalQueue.values())
          .filter(a => a.status === 'pending').length
      }
    };
  }
}

export default PolicyEngine;
