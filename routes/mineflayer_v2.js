/**
 * Mineflayer Bot Routes v2 - With Policy Enforcement
 *
 * REST API endpoints for Mineflayer bot control with built-in:
 * - Role-based access control (ADMIN, AUTOPILOT, VIEWER)
 * - Rate limiting
 * - Dangerous action approval workflow
 * - Task routing through policy engine
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../logger.js';

/**
 * Initialize enhanced Mineflayer bot routes with policy enforcement
 *
 * @param {NPCSystem} npcSystem - NPC system instance
 * @param {MineflayerPolicyService} policyService - Policy service instance
 * @param {Object} io - Socket.IO instance
 * @returns {express.Router}
 */
export function initMineflayerRoutesV2(npcSystem, policyService, io) {
  const router = express.Router();

  if (!policyService || !policyService.initialized) {
    logger.warn('Mineflayer routes v2 initialized without policy service');
    return router;
  }

  // ============================================================================
  // Policy & Governance Endpoints
  // ============================================================================

  /**
   * GET /api/mineflayer/policy/status
   * Get current policy enforcement status
   */
  router.get('/policy/status', authenticate, (req, res) => {
    try {
      const status = policyService.getPolicyStatus();
      res.json({
        success: true,
        policy: status
      });
    } catch (err) {
      logger.error('Failed to get policy status', { error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * GET /api/mineflayer/policy/approvals
   * Get pending dangerous task approvals
   */
  router.get('/policy/approvals', authenticate, authorize('admin'), (req, res) => {
    try {
      const approvals = policyService.getPendingApprovals();
      res.json({
        success: true,
        count: approvals.length,
        approvals
      });
    } catch (err) {
      logger.error('Failed to get approvals', { error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * POST /api/mineflayer/policy/approve
   * Approve a pending dangerous task
   */
  router.post('/policy/approve/:token', authenticate, authorize('admin'), async (req, res) => {
    try {
      const { token } = req.params;
      const { user } = req;

      const result = await policyService.approveDangerousTask(token, user.id);

      if (result.success) {
        res.json({
          success: true,
          message: 'Task approved and executed',
          result
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'Approval failed'
        });
      }
    } catch (err) {
      logger.error('Failed to approve task', { error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * POST /api/mineflayer/policy/reject
   * Reject a pending dangerous task
   */
  router.post('/policy/reject/:token', authenticate, authorize('admin'), (req, res) => {
    try {
      const { token } = req.params;
      const { user } = req;
      const { reason = '' } = req.body;

      const result = policyService.rejectDangerousTask(token, user.id, reason);

      if (result.success) {
        res.json({
          success: true,
          message: 'Task rejected',
          result
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'Rejection failed'
        });
      }
    } catch (err) {
      logger.error('Failed to reject task', { error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ============================================================================
  // Bot Task Execution Endpoints (With Policy)
  // ============================================================================

  /**
   * POST /api/mineflayer/:botId/task
   * Execute a task on a bot (with policy enforcement)
   */
  router.post('/:botId/task', authenticate, authorize('write'), async (req, res) => {
    try {
      const { botId } = req.params;
      const task = req.body;
      const { user } = req;

      if (!task || !task.type) {
        return res.status(400).json({
          success: false,
          error: 'Task with type field is required'
        });
      }

      // Inject botId if not present
      const fullTask = { ...task, botId };

      // Get user role from auth middleware
      const role = user.role || 'viewer';

      logger.info('Task execution requested', {
        botId,
        taskType: task.type,
        userId: user.id,
        role
      });

      // Execute with policy enforcement
      const result = await policyService.executeTask(fullTask, {
        userId: user.id,
        role,
        botId
      });

      if (result.success) {
        res.json({
          success: true,
          taskType: task.type,
          botId,
          result,
          warnings: result.warnings
        });
      } else {
        // Check if approval is needed
        if (result.policyDetails?.errors?.some(e => e.includes('Dangerous'))) {
          return res.status(403).json({
            success: false,
            code: 'APPROVAL_REQUIRED',
            error: result.error,
            approvalToken: result.policyDetails?.approvalToken
          });
        }

        res.status(400).json({
          success: false,
          error: result.error,
          policyDetails: result.policyDetails
        });
      }
    } catch (err) {
      logger.error('Failed to execute task', {
        botId: req.params.botId,
        error: err.message
      });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * POST /api/mineflayer/:botId/move
   * Move bot to position
   */
  router.post('/:botId/move', authenticate, authorize('write'), async (req, res) => {
    try {
      const { botId } = req.params;
      const { x, y, z, range = 1 } = req.body;
      const { user } = req;

      if (x === undefined || y === undefined || z === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Position (x, y, z) is required'
        });
      }

      const task = {
        botId,
        type: 'move_to',
        parameters: {
          target: { x, y, z },
          range
        }
      };

      const result = await policyService.executeTask(task, {
        userId: user.id,
        role: user.role || 'viewer',
        botId
      });

      res.json({
        success: result.success,
        task: 'move_to',
        position: { x, y, z },
        result
      });
    } catch (err) {
      logger.error('Failed to move bot', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * POST /api/mineflayer/:botId/chat
   * Send chat message
   */
  router.post('/:botId/chat', authenticate, authorize('write'), async (req, res) => {
    try {
      const { botId } = req.params;
      const { message } = req.body;
      const { user } = req;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'message is required'
        });
      }

      const task = {
        botId,
        type: 'chat',
        parameters: { message }
      };

      const result = await policyService.executeTask(task, {
        userId: user.id,
        role: user.role || 'viewer',
        botId
      });

      res.json({
        success: result.success,
        task: 'chat',
        message,
        result
      });
    } catch (err) {
      logger.error('Failed to send chat', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * POST /api/mineflayer/:botId/mine
   * Mine blocks (with policy enforcement)
   */
  router.post('/:botId/mine', authenticate, authorize('write'), async (req, res) => {
    try {
      const { botId } = req.params;
      const { blockType, count = 1, range = 32 } = req.body;
      const { user } = req;

      if (!blockType) {
        return res.status(400).json({
          success: false,
          error: 'blockType is required'
        });
      }

      const task = {
        botId,
        type: 'mine_block',
        parameters: {
          target: { x: 0, y: 0, z: 0 },  // Will be determined by bot
          blockType,
          count,
          range
        }
      };

      const result = await policyService.executeTask(task, {
        userId: user.id,
        role: user.role || 'viewer',
        botId
      });

      res.json({
        success: result.success,
        task: 'mine_block',
        blockType,
        result
      });
    } catch (err) {
      logger.error('Failed to mine', { botId: req.params.botId, error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * GET /api/mineflayer/health
   * Health check with policy status
   */
  router.get('/health', authenticate, (req, res) => {
    try {
      const health = policyService.health();
      res.json({
        success: true,
        health
      });
    } catch (err) {
      logger.error('Failed to get health', { error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * GET /api/mineflayer/stats
   * Get router statistics
   */
  router.get('/stats', authenticate, authorize('read'), (req, res) => {
    try {
      const stats = policyService.getStats();
      res.json({
        success: true,
        stats
      });
    } catch (err) {
      logger.error('Failed to get stats', { error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * POST /api/mineflayer/stats/reset
   * Reset router statistics (admin only)
   */
  router.post('/stats/reset', authenticate, authorize('admin'), (req, res) => {
    try {
      policyService.resetStats();
      res.json({
        success: true,
        message: 'Statistics reset'
      });
    } catch (err) {
      logger.error('Failed to reset stats', { error: err.message });
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  return router;
}

export default initMineflayerRoutesV2;
