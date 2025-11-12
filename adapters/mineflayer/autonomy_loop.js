/**
 * Autonomy Loop - Full ODVA (Observe-Decide-Validate-Act) cycle
 *
 * This is the core autonomous decision engine. It implements:
 *
 * 1. OBSERVE: Get current world and bot state via WorldStateObserver
 * 2. DECIDE: Generate task plans via TaskPlanner
 * 3. VALIDATE: Check plans against policies and constraints
 * 4. ACT: Execute tasks via MineflayerAdapter
 *
 * The loop runs continuously, adapting to changing conditions.
 * All decisions are logged and can be audited.
 *
 * This is Phase 5 core: full autonomous control.
 */

import { logger } from '../../logger.js';

export class AutonomyLoop {
  /**
   * Initialize the autonomy loop
   * @param {MineflayerAdapter} adapter - Task execution adapter
   * @param {WorldStateObserver} observer - World state watcher
   * @param {TaskPlanner} planner - Goal-to-task converter
   * @param {BotRegistry} registry - Bot metadata
   * @param {PolicyEngine} policyEngine - Safety enforcement
   * @param {Object} options - Configuration
   */
  constructor(adapter, observer, planner, registry, policyEngine, options = {}) {
    if (!adapter || !observer || !planner || !registry || !policyEngine) {
      throw new Error('AutonomyLoop requires adapter, observer, planner, registry, and policyEngine');
    }

    this.adapter = adapter;
    this.observer = observer;
    this.planner = planner;
    this.registry = registry;
    this.policyEngine = policyEngine;

    this.options = {
      loopInterval: options.loopInterval || 5000, // Run loop every 5 seconds
      maxConcurrentGoals: options.maxConcurrentGoals || 3,
      planFailureThreshold: options.planFailureThreshold || 3,
      autoRetry: options.autoRetry !== false,
      retryDelay: options.retryDelay || 5000,
      ...options
    };

    this.loops = new Map(); // botId -> {active, interval, currentGoal, failures}
    this.history = new Map(); // botId -> [{action, result, timestamp}]
    this.goals = new Map(); // botId -> [goal_queue]

    logger.info('AutonomyLoop initialized', {
      loopInterval: this.options.loopInterval,
      maxConcurrentGoals: this.options.maxConcurrentGoals
    });
  }

  /**
   * Start autonomy loop for a bot
   * @param {string} botId - Bot ID
   * @param {Array} goalQueue - Initial goals to pursue
   * @returns {Promise<{success: boolean}>}
   */
  async startLoop(botId, goalQueue = []) {
    try {
      if (this.loops.has(botId) && this.loops.get(botId).active) {
        return {
          success: false,
          error: `Loop already active for bot ${botId}`
        };
      }

      logger.info('Starting autonomy loop', { botId, initialGoals: goalQueue.length });

      // Initialize bot state
      this.observer.startObserving(botId);
      this.goals.set(botId, goalQueue);
      this.history.set(botId, []);

      // Set up loop
      const loopState = {
        active: true,
        botId,
        currentGoal: null,
        failures: 0,
        startTime: Date.now()
      };

      // Main autonomy loop
      const loopInterval = setInterval(async () => {
        if (!loopState.active) {
          clearInterval(loopInterval);
          return;
        }

        try {
          await this._runODVACycle(botId, loopState);
        } catch (error) {
          logger.error('ODVA cycle error', { botId, error: error.message });
        }
      }, this.options.loopInterval);

      loopState.interval = loopInterval;
      this.loops.set(botId, loopState);

      // Run initial cycle immediately
      await this._runODVACycle(botId, loopState);

      return { success: true, botId, loopInterval: this.options.loopInterval };

    } catch (error) {
      logger.error('Failed to start autonomy loop', {
        botId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop autonomy loop for a bot
   * @param {string} botId - Bot ID
   * @returns {Promise<{success: boolean}>}
   */
  async stopLoop(botId) {
    try {
      const loopState = this.loops.get(botId);
      if (!loopState) {
        return { success: false, error: `No loop active for bot ${botId}` };
      }

      logger.info('Stopping autonomy loop', { botId });

      loopState.active = false;
      clearInterval(loopState.interval);
      this.observer.stopObserving(botId);
      this.loops.delete(botId);

      return { success: true, botId };

    } catch (error) {
      logger.error('Error stopping loop', { botId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Queue a new goal for the bot
   * @param {string} botId - Bot ID
   * @param {string} goal - Goal name
   * @param {Object} context - Goal context
   * @returns {boolean}
   */
  queueGoal(botId, goal, context = {}) {
    const goals = this.goals.get(botId);
    if (!goals) {
      logger.warn('Bot not in autonomy loop', { botId });
      return false;
    }

    if (goals.length >= this.options.maxConcurrentGoals) {
      logger.warn('Goal queue full', { botId, maxGoals: this.options.maxConcurrentGoals });
      return false;
    }

    goals.push({ name: goal, context, queuedAt: Date.now() });
    logger.debug('Goal queued', { botId, goal, queueLength: goals.length });
    return true;
  }

  /**
   * Get loop status for a bot
   * @param {string} botId - Bot ID
   * @returns {Object|null}
   */
  getLoopStatus(botId) {
    const loopState = this.loops.get(botId);
    if (!loopState) return null;

    const history = this.history.get(botId) || [];
    const worldState = this.observer.getWorldState(botId);

    return {
      botId,
      active: loopState.active,
      uptime: Date.now() - loopState.startTime,
      currentGoal: loopState.currentGoal,
      failures: loopState.failures,
      goalQueueLength: this.goals.get(botId)?.length || 0,
      lastAction: history[history.length - 1] || null,
      worldState,
      historyLength: history.length
    };
  }

  /**
   * Get action history
   * @param {string} botId - Bot ID
   * @param {number} limit - Max actions to return
   * @returns {Array}
   */
  getHistory(botId, limit = 50) {
    const history = this.history.get(botId) || [];
    return history.slice(-limit);
  }

  /**
   * Run one complete ODVA cycle
   * @private
   */
  async _runODVACycle(botId, loopState) {
    try {
      // PHASE 1: OBSERVE
      const worldState = this._observePhase(botId);
      if (!worldState) {
        logger.warn('Observation failed', { botId });
        return;
      }

      // PHASE 2: DECIDE
      const plan = await this._decidePhase(botId, loopState, worldState);
      if (!plan || plan.length === 0) {
        logger.debug('No plan generated', { botId });
        return;
      }

      // PHASE 3: VALIDATE
      const validation = this._validatePhase(botId, plan, worldState);
      if (!validation.valid) {
        logger.warn('Plan validation failed', {
          botId,
          warnings: validation.warnings
        });
        // Don't return - continue with warnings
      }

      // PHASE 4: ACT
      await this._actPhase(botId, plan, loopState);

      loopState.failures = 0;

    } catch (error) {
      logger.error('ODVA cycle exception', { botId, error: error.message });
      loopState.failures += 1;

      if (loopState.failures >= this.options.planFailureThreshold) {
        logger.warn('Failure threshold reached, disabling autonomy', { botId });
        loopState.active = false;
      }
    }
  }

  /**
   * OBSERVE phase: Gather current state
   * @private
   */
  _observePhase(botId) {
    try {
      const worldState = this.observer.getWorldState(botId);
      const botInfo = this.registry.getBot(botId);

      if (!worldState || !botInfo) {
        logger.warn('Cannot observe - missing state', { botId });
        return null;
      }

      logger.debug('Observation complete', {
        botId,
        position: worldState.botState.position,
        health: worldState.botState.health,
        entities: worldState.entities.length,
        blocks: worldState.blocks.length
      });

      this._recordAction(botId, 'observe', { success: true, stateSize: Object.keys(worldState).length });

      return worldState;

    } catch (error) {
      logger.error('Observation phase error', { botId, error: error.message });
      this._recordAction(botId, 'observe', { success: false, error: error.message });
      return null;
    }
  }

  /**
   * DECIDE phase: Generate plan from goal
   * @private
   */
  async _decidePhase(botId, loopState, worldState) {
    try {
      const goalQueue = this.goals.get(botId) || [];

      // If no current goal, get next from queue
      if (!loopState.currentGoal && goalQueue.length > 0) {
        const nextGoal = goalQueue.shift();
        loopState.currentGoal = nextGoal;
        logger.debug('Switched to new goal', { botId, goal: nextGoal.name });
      }

      // If still no goal, return idle plan
      if (!loopState.currentGoal) {
        const idlePlan = this.planner.goalTemplates['idle']?.planner(worldState, this.registry, {});
        this._recordAction(botId, 'decide', {
          success: true,
          goal: 'idle',
          taskCount: idlePlan?.length || 0
        });
        return idlePlan || [];
      }

      // Generate plan for current goal
      const planResult = await this.planner.generatePlan(
        botId,
        loopState.currentGoal.name,
        loopState.currentGoal.context
      );

      if (!planResult.success) {
        logger.warn('Plan generation failed', { botId, error: planResult.error });
        this._recordAction(botId, 'decide', {
          success: false,
          goal: loopState.currentGoal.name,
          error: planResult.error
        });

        // Try fallback goal
        if (this.options.autoRetry) {
          loopState.currentGoal = null;
          return this.planner.goalTemplates['idle']?.planner(worldState, this.registry, {}) || [];
        }

        return [];
      }

      this._recordAction(botId, 'decide', {
        success: true,
        goal: loopState.currentGoal.name,
        taskCount: planResult.plan.length
      });

      return planResult.plan;

    } catch (error) {
      logger.error('Decision phase error', { botId, error: error.message });
      this._recordAction(botId, 'decide', { success: false, error: error.message });
      return [];
    }
  }

  /**
   * VALIDATE phase: Check plan safety and feasibility
   * @private
   */
  _validatePhase(botId, plan, worldState) {
    try {
      const evaluation = this.planner.evaluatePlan(botId, plan);

      // Check policies for each task
      const policyErrors = [];
      for (const task of plan) {
        const policyCheck = this.policyEngine.validateTaskPolicy(task, {
          botId,
          role: 'AUTOPILOT'
        });

        if (!policyCheck.valid) {
          policyErrors.push(...policyCheck.errors);
        }
      }

      const result = {
        valid: evaluation.feasible && policyErrors.length === 0,
        warnings: [...evaluation.warnings, ...policyErrors],
        suggestions: evaluation.suggestions,
        taskCount: plan.length
      };

      this._recordAction(botId, 'validate', result);

      return result;

    } catch (error) {
      logger.error('Validation phase error', { botId, error: error.message });
      this._recordAction(botId, 'validate', { success: false, error: error.message });
      return { valid: false, warnings: [error.message], suggestions: [] };
    }
  }

  /**
   * ACT phase: Execute the plan
   * @private
   */
  async _actPhase(botId, plan, loopState) {
    try {
      const results = [];

      for (let i = 0; i < plan.length; i++) {
        const task = plan[i];

        // Prepare task for execution
        const execTask = {
          ...task,
          id: `${botId}_${Date.now()}_${i}`,
          botId,
          caller: 'AUTONOMY_LOOP',
          role: 'AUTOPILOT',
          timestamp: new Date().toISOString()
        };

        logger.debug('Executing task', {
          botId,
          taskIndex: i + 1,
          taskCount: plan.length,
          taskType: task.type
        });

        // Execute task
        const taskResult = await this.adapter.executeTask(execTask);

        results.push({
          taskIndex: i,
          taskType: task.type,
          success: taskResult.success,
          error: taskResult.error
        });

        if (!taskResult.success) {
          logger.warn('Task execution failed', {
            botId,
            taskIndex: i,
            error: taskResult.error
          });

          // Option to continue on error or stop
          if (!this.options.continueOnTaskError) {
            break;
          }
        }

        // Brief delay between tasks
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      this._recordAction(botId, 'act', {
        success: results.every((r) => r.success),
        tasksExecuted: results.length,
        tasksFailed: results.filter((r) => !r.success).length,
        results
      });

      // Check if goal is complete
      if (results.every((r) => r.success)) {
        loopState.currentGoal = null;
        logger.info('Goal completed successfully', { botId });
      }

    } catch (error) {
      logger.error('Act phase error', { botId, error: error.message });
      this._recordAction(botId, 'act', { success: false, error: error.message });
    }
  }

  /**
   * Record an action in history
   * @private
   */
  _recordAction(botId, phase, result) {
    if (!this.history.has(botId)) {
      this.history.set(botId, []);
    }

    const action = {
      phase,
      result,
      timestamp: new Date().toISOString()
    };

    const history = this.history.get(botId);
    history.push(action);

    // Keep history bounded
    if (history.length > 200) {
      history.shift();
    }
  }
}

export default AutonomyLoop;
