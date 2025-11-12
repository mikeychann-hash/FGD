/**
 * Autonomy Orchestrator - Central manager for all autonomous bot systems
 *
 * This module integrates all Phase 4-5 components:
 * - Mineflayer Bridge (real bot connections)
 * - World State Observer (observation)
 * - Task Planner (decision making)
 * - Autonomy Loop (ODVA execution)
 * - Coordination Engine (multi-bot management)
 * - Policy Engine (safety enforcement)
 *
 * Single entry point for autonomous bot control across the swarm.
 */

import { logger } from '../../logger.js';
import MineflayerBridge from './mineflayer_bridge.js';
import { WorldStateObserver } from './world_observer.js';
import { TaskPlanner } from './task_planner.js';
import { AutonomyLoop } from './autonomy_loop.js';

export class AutonomyOrchestrator {
  /**
   * Initialize the orchestrator
   * @param {MineflayerAdapter} adapter - Task execution adapter
   * @param {CoordinationEngine} coordinationEngine - Multi-bot coordinator
   * @param {PolicyEngine} policyEngine - Safety enforcer
   * @param {Object} mineflayerModules - {mineflayer, pathfinder}
   * @param {Object} options - Configuration
   */
  constructor(adapter, coordinationEngine, policyEngine, mineflayerModules, options = {}) {
    if (!adapter || !coordinationEngine || !policyEngine || !mineflayerModules) {
      throw new Error('AutonomyOrchestrator requires adapter, coordinationEngine, policyEngine, and mineflayerModules');
    }

    this.adapter = adapter;
    this.coordinationEngine = coordinationEngine;
    this.policyEngine = policyEngine;
    this.mineflayerModules = mineflayerModules;

    this.options = {
      autoStart: options.autoStart !== false,
      swarmMode: options.swarmMode !== false,
      ...options
    };

    // Initialize subsystems
    this.bridge = new MineflayerBridge(
      mineflayerModules.mineflayer,
      mineflayerModules.pathfinder,
      options.bridgeOptions || {}
    );

    this.observer = new WorldStateObserver(this.bridge, options.observerOptions || {});

    this.planner = new TaskPlanner(this.observer, coordinationEngine.registry, options.plannerOptions || {});

    this.autonomyLoop = new AutonomyLoop(
      adapter,
      this.observer,
      this.planner,
      coordinationEngine.registry,
      policyEngine,
      options.loopOptions || {}
    );

    this.botSessions = new Map(); // botId -> {credentials, goals, status}
    this.swarmGoals = []; // Global goals for all bots

    logger.info('AutonomyOrchestrator initialized', {
      swarmMode: this.options.swarmMode,
      autoStart: this.options.autoStart
    });
  }

  /**
   * Connect and initialize a bot with full autonomy
   * @param {string} botId - Unique bot identifier
   * @param {Object} credentials - {username, password?, auth?}
   * @param {Array} goals - Initial goal queue
   * @returns {Promise<{success: boolean, botId?: string, error?: string}>}
   */
  async connectBotWithAutonomy(botId, credentials, goals = ['idle']) {
    try {
      logger.info('Connecting bot with autonomy', { botId, goalCount: goals.length });

      // Connect bot to Minecraft server
      const connectResult = await this.bridge.connectBot(botId, credentials);
      if (!connectResult.success) {
        return { success: false, error: connectResult.error };
      }

      // Register bot in coordination engine
      this.coordinationEngine.registry.registerBot({
        botId,
        role: 'autonomous',
        capabilities: ['movement', 'mining', 'building', 'combat'],
        owner: 'system'
      });

      // Store session
      this.botSessions.set(botId, {
        credentials,
        goals,
        status: 'initializing',
        connectedAt: Date.now()
      });

      // Start observation
      this.observer.startObserving(botId);

      // Start autonomy loop
      const loopResult = await this.autonomyLoop.startLoop(botId, [...goals, ...this.swarmGoals]);
      if (!loopResult.success) {
        return {
          success: false,
          error: `Failed to start autonomy loop: ${loopResult.error}`
        };
      }

      // Update session status
      const session = this.botSessions.get(botId);
      session.status = 'autonomous';
      session.loopInterval = loopResult.loopInterval;

      logger.info('Bot connected with autonomous control', {
        botId,
        loopInterval: loopResult.loopInterval
      });

      return { success: true, botId };

    } catch (error) {
      logger.error('Failed to connect bot with autonomy', {
        botId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect a bot and stop its autonomy
   * @param {string} botId - Bot ID
   * @param {string} reason - Disconnection reason
   * @returns {Promise<{success: boolean}>}
   */
  async disconnectBot(botId, reason = 'Manual disconnect') {
    try {
      logger.info('Disconnecting bot', { botId, reason });

      // Stop autonomy loop
      await this.autonomyLoop.stopLoop(botId);

      // Disconnect from server
      const disconnectResult = await this.bridge.disconnectBot(botId, reason);

      // Remove session
      this.botSessions.delete(botId);

      return disconnectResult;

    } catch (error) {
      logger.error('Error disconnecting bot', { botId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Queue goal for a specific bot
   * @param {string} botId - Bot ID
   * @param {string} goal - Goal name
   * @param {Object} context - Goal context
   * @returns {boolean}
   */
  queueBotGoal(botId, goal, context = {}) {
    return this.autonomyLoop.queueGoal(botId, goal, context);
  }

  /**
   * Queue goal for entire swarm
   * @param {string} goal - Goal name
   * @param {Object} context - Goal context
   */
  queueSwarmGoal(goal, context = {}) {
    this.swarmGoals.push({ name: goal, context });

    // Add goal to all active bots
    for (const botId of this.botSessions.keys()) {
      this.autonomyLoop.queueGoal(botId, goal, context);
    }

    logger.info('Swarm goal queued', { goal, botsAffected: this.botSessions.size });
  }

  /**
   * Get status of all autonomous bots
   * @returns {Map<string, Object>}
   */
  getSwarmStatus() {
    const status = new Map();

    for (const botId of this.botSessions.keys()) {
      const loopStatus = this.autonomyLoop.getLoopStatus(botId);
      const botState = this.bridge.getBotState(botId);
      const sessionInfo = this.botSessions.get(botId);

      status.set(botId, {
        botId,
        session: sessionInfo,
        loop: loopStatus,
        state: botState,
        health: this.bridge.isBotAlive(botId)
      });
    }

    return status;
  }

  /**
   * Get detailed status for a single bot
   * @param {string} botId - Bot ID
   * @returns {Object|null}
   */
  getBotStatus(botId) {
    const status = this.getSwarmStatus();
    return status.get(botId) || null;
  }

  /**
   * Coordinate multi-bot task (e.g., simultaneous mining)
   * @param {Array} botIds - Bot IDs to coordinate
   * @param {string} task - Shared task type
   * @param {Object} params - Task parameters
   * @returns {Promise<{success: boolean, results?: {}}>}
   */
  async coordinateTask(botIds, task, params = {}) {
    try {
      logger.info('Coordinating multi-bot task', {
        taskType: task,
        botCount: botIds.length
      });

      // Use coordination engine to assign work
      const assignments = [];

      for (const botId of botIds) {
        const assignment = this.coordinationEngine.assignWork(
          `task_${Date.now()}_${botId}`,
          {
            type: task,
            parameters: params,
            requiredCapability: task.split('_')[0] // e.g., "mine" from "mine_block"
          }
        );

        if (assignment.success) {
          assignments.push(assignment.claim);
        }
      }

      // Execute tasks concurrently
      const results = {};
      const promises = assignments.map(async (claim) => {
        const taskDef = {
          id: claim.workId,
          botId: claim.botId,
          type: task,
          parameters: params,
          caller: 'ORCHESTRATOR',
          role: 'AUTOPILOT'
        };

        const result = await this.adapter.executeTask(taskDef);
        results[claim.botId] = result;
      });

      await Promise.all(promises);

      const allSuccess = Object.values(results).every((r) => r.success);

      logger.info('Coordinated task completed', {
        taskType: task,
        success: allSuccess,
        results: Object.keys(results).length
      });

      return { success: allSuccess, results };

    } catch (error) {
      logger.error('Coordination error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Global health check for entire swarm
   * @returns {Object}
   */
  getSwarmHealth() {
    const bridgeHealth = this.bridge.healthCheckAll();
    const swarmStatus = this.getSwarmStatus();

    const summary = {
      timestamp: new Date().toISOString(),
      totalBots: swarmStatus.size,
      aliveBots: 0,
      failedBots: [],
      activeGoals: 0,
      totalHistory: 0
    };

    for (const [botId, status] of swarmStatus.entries()) {
      if (status.health) {
        summary.aliveBots += 1;
      } else {
        summary.failedBots.push(botId);
      }

      if (status.loop?.goalQueueLength) {
        summary.activeGoals += status.loop.goalQueueLength;
      }

      const history = this.autonomyLoop.getHistory(botId, 1000);
      summary.totalHistory += history.length;
    }

    return {
      summary,
      bridgeHealth,
      bots: Object.fromEntries(swarmStatus)
    };
  }

  /**
   * Export full autonomy state for analysis
   * @returns {Object}
   */
  exportState() {
    return {
      timestamp: new Date().toISOString(),
      swarmSize: this.botSessions.size,
      swarmGoals: this.swarmGoals,
      bots: Object.fromEntries(
        Array.from(this.botSessions.entries()).map(([botId, session]) => [
          botId,
          {
            session,
            status: this.autonomyLoop.getLoopStatus(botId),
            history: this.autonomyLoop.getHistory(botId, 20),
            worldState: this.observer.getWorldState(botId)
          }
        ])
      ),
      coordinationState: this.coordinationEngine.exportState()
    };
  }

  /**
   * Reset autonomy systems (emergency reset)
   * @returns {Promise<{success: boolean}>}
   */
  async emergencyReset() {
    try {
      logger.warn('Emergency reset initiated');

      // Stop all loops
      const botIds = Array.from(this.botSessions.keys());
      for (const botId of botIds) {
        await this.autonomyLoop.stopLoop(botId);
        await this.bridge.disconnectBot(botId, 'Emergency reset');
      }

      // Clear queues
      this.swarmGoals = [];
      this.botSessions.clear();
      this.observer.clearCache?.();
      this.planner.clearCache();

      logger.info('Emergency reset completed');
      return { success: true };

    } catch (error) {
      logger.error('Emergency reset failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

export default AutonomyOrchestrator;
