// npc_engine/dispatch.js
// Task dispatch and execution lifecycle management

import { planTask } from "../tasks/index.js";
import { TASK_TIMEOUT, SIMULATED_TASK_DURATION, normalizePriority, cloneTask, getPreferredNpcTypes } from "./utils.js";
import { logger } from "../logger.js";

/**
 * Manages task dispatch, execution, and completion
 */
export class DispatchManager {
  constructor(engine) {
    this.engine = engine;
    this.log = logger.child({ component: 'DispatchManager' });

    // Task retry tracking
    this.taskRetries = new Map(); // npcId -> { task, retryCount, lastError }
    this.maxRetries = engine.maxTaskRetries ?? 2;
    this.retryDelay = engine.taskRetryDelay ?? 2000; // ms
  }

  /**
   * Assigns a task to an NPC and starts execution
   * @param {object} npc - NPC to assign task to
   * @param {object} task - Task to assign
   * @returns {object} The NPC object
   */
  assignTask(npc, task) {
    const normalizedTask = cloneTask(task);
    normalizedTask.priority = normalizePriority(normalizedTask.priority);
    normalizedTask.preferredNpcTypes = getPreferredNpcTypes(normalizedTask);
    npc.task = normalizedTask;
    npc.state = "working";
    npc.progress = 0;
    npc.lastUpdate = Date.now();
    npc.awaitingFeedback = Boolean(
      this.engine.requireFeedback &&
        this.engine.bridge &&
        this.engine.bridge.options?.enableUpdateServer !== false
    );
    const preferenceNote =
      normalizedTask.preferredNpcTypes && normalizedTask.preferredNpcTypes.length > 0
        ? ` [preferred: ${normalizedTask.preferredNpcTypes.join(", ")}]`
        : "";

    this.log.info('NPC executing task', {
      npcId: npc.id,
      action: normalizedTask.action,
      details: normalizedTask.details,
      preferredTypes: normalizedTask.preferredNpcTypes
    });

    this.engine.emit("task_assigned", { npcId: npc.id, task: cloneTask(normalizedTask) });

    if (this.engine.taskTimeouts.has(npc.id)) {
      clearTimeout(this.engine.taskTimeouts.get(npc.id));
    }

    const safetyTimeout = setTimeout(() => {
      this.log.warn('Task timeout, attempting recovery', { npcId: npc.id, task: normalizedTask.action });
      this._handleTaskTimeout(npc.id, normalizedTask);
    }, TASK_TIMEOUT);

    this.engine.taskTimeouts.set(npc.id, safetyTimeout);

    this.dispatchTask(npc, normalizedTask);

    return npc;
  }

  /**
   * Dispatches a task to the bridge or simulates execution
   * @param {object} npc - NPC executing the task
   * @param {object} task - Task to dispatch
   */
  dispatchTask(npc, task) {
    const plan = planTask(task, { npc });

    if (!this.engine.bridge) {
      this.engine.emit("task_dispatched", {
        npcId: npc.id,
        task: cloneTask(task),
        transport: "simulation",
        plan
      });

      if (plan) {
        this.engine.emit("task_plan_generated", { npcId: npc.id, task: cloneTask(task), plan });
        this.simulateTaskExecution(npc, task, plan);
      } else {
        setTimeout(() => {
          this.completeTask(npc.id, true);
        }, SIMULATED_TASK_DURATION);
      }
      return;
    }

    if (
      typeof this.engine.bridge.isConnected === "function" &&
      !this.engine.bridge.isConnected()
    ) {
      this.log.warn('Bridge not connected, requeuing task', { npcId: npc.id, task: task.action });
      if (this.engine.taskTimeouts.has(npc.id)) {
        clearTimeout(this.engine.taskTimeouts.get(npc.id));
        this.engine.taskTimeouts.delete(npc.id);
      }
      npc.state = "idle";
      npc.awaitingFeedback = false;
      const requeueTask = cloneTask(task);
      npc.task = null;
      this.engine.queueManager.enqueueTask(requeueTask);
      this.engine.emit("task_requeued", {
        task: cloneTask(requeueTask),
        npcId: npc.id,
        reason: "bridge_disconnected"
      });
      return;
    }

    if (plan) {
      this.engine.emit("task_plan_generated", { npcId: npc.id, task: cloneTask(task), plan });
    }

    (async () => {
      try {
        const response = await this.engine.bridge.dispatchTask({ ...task, npcId: npc.id });
        if (response) {
          this.log.debug('Bridge response received', { npcId: npc.id, response });
        }
        this.engine.emit("task_dispatched", {
          npcId: npc.id,
          task: cloneTask(task),
          transport: "bridge",
          response,
          plan
        });

        // Clear retry tracking on success
        if (this.taskRetries.has(npc.id)) {
          this.taskRetries.delete(npc.id);
        }

        if (npc.awaitingFeedback) {
          return;
        }
        this.completeTask(npc.id, true);
      } catch (err) {
        this.log.warn('Task dispatch failed', { npcId: npc.id, error: err.message });
        this.engine.emit("task_dispatch_failed", {
          npcId: npc.id,
          task: cloneTask(task),
          error: err
        });

        // Attempt retry
        await this._handleTaskFailure(npc.id, task, err);
      }
    })();
  }

  /**
   * Simulates task execution with step-by-step progress
   * @param {object} npc - NPC executing the task
   * @param {object} task - Task being executed
   * @param {object} plan - Execution plan (optional)
   */
  simulateTaskExecution(npc, task, plan = null) {
    const executionPlan = plan || planTask(task, { npc });

    if (!executionPlan || !executionPlan.steps || executionPlan.steps.length === 0) {
      setTimeout(() => {
        this.completeTask(npc.id, true);
      }, SIMULATED_TASK_DURATION);
      return;
    }

    const totalSteps = executionPlan.steps.length;
    const totalDuration = Math.max(
      executionPlan.estimatedDuration || SIMULATED_TASK_DURATION,
      totalSteps * 750
    );
    const stepDuration = Math.max(500, Math.round(totalDuration / totalSteps));

    executionPlan.steps.forEach((step, index) => {
      setTimeout(() => {
        npc.progress = Math.min(100, Math.round(((index + 1) / totalSteps) * 100));
        npc.lastUpdate = Date.now();

        this.engine.emit("task_progress", {
          npcId: npc.id,
          task: cloneTask(task),
          stepIndex: index,
          step,
          progress: npc.progress
        });

        if (index === totalSteps - 1) {
          this.completeTask(npc.id, true, { plan: executionPlan });
        }
      }, stepDuration * (index + 1));
    });
  }

  /**
   * Completes a task and returns NPC to idle state
   * @param {string} npcId - ID of the NPC
   * @param {boolean} success - Whether the task succeeded
   * @param {object} metadata - Additional completion metadata
   */
  completeTask(npcId, success = true, metadata = null) {
    const npc = this.engine.npcs.get(npcId);
    if (!npc) return;

    if (!npc.task) {
      // Nothing to complete; ignore duplicate completions
      return;
    }

    if (this.engine.taskTimeouts.has(npcId)) {
      clearTimeout(this.engine.taskTimeouts.get(npcId));
      this.engine.taskTimeouts.delete(npcId);
    }

    const completedTask = npc.task;
    npc.state = "idle";
    npc.task = null;
    npc.progress = 0;
    npc.lastUpdate = Date.now();
    npc.awaitingFeedback = false;

    if (success) {
      this.log.info('NPC completed task', { npcId, action: completedTask?.action });
      // Clear retry tracking on success
      if (this.taskRetries.has(npcId)) {
        this.taskRetries.delete(npcId);
      }
    } else {
      this.log.warn('NPC failed task', { npcId, action: completedTask?.action });
    }

    if (metadata) {
      this.log.debug('Task completion metadata', { npcId, metadata });
    }

    this.engine.emit("task_completed", {
      npcId,
      success,
      task: cloneTask(completedTask),
      metadata
    });

    this.engine.queueManager.processQueue();
  }

  /**
   * Handle task timeout with recovery attempt
   */
  async _handleTaskTimeout(npcId, task) {
    const npc = this.engine.npcs.get(npcId);
    if (!npc) return;

    const retryInfo = this.taskRetries.get(npcId) || { task, retryCount: 0 };

    if (retryInfo.retryCount < this.maxRetries) {
      this.log.info('Retrying timed-out task', {
        npcId,
        action: task.action,
        retryCount: retryInfo.retryCount + 1,
        maxRetries: this.maxRetries
      });

      // Update retry tracking
      this.taskRetries.set(npcId, {
        task: cloneTask(task),
        retryCount: retryInfo.retryCount + 1,
        lastError: 'timeout'
      });

      // Reset NPC state and retry
      npc.state = "idle";
      npc.task = null;
      npc.progress = 0;
      npc.awaitingFeedback = false;

      // Wait before retry
      await this._sleep(this.retryDelay);

      // Reassign the task
      this.assignTask(npc, task);
    } else {
      this.log.error('Task timeout after max retries', {
        npcId,
        action: task.action,
        retries: retryInfo.retryCount
      });

      // Give up and complete as failed
      this.completeTask(npcId, false);
    }
  }

  /**
   * Handle task failure with retry logic
   */
  async _handleTaskFailure(npcId, task, error) {
    const npc = this.engine.npcs.get(npcId);
    if (!npc) {
      return;
    }

    const retryInfo = this.taskRetries.get(npcId) || { task, retryCount: 0 };

    if (retryInfo.retryCount < this.maxRetries) {
      this.log.info('Retrying failed task', {
        npcId,
        action: task.action,
        retryCount: retryInfo.retryCount + 1,
        maxRetries: this.maxRetries,
        error: error.message
      });

      // Update retry tracking
      this.taskRetries.set(npcId, {
        task: cloneTask(task),
        retryCount: retryInfo.retryCount + 1,
        lastError: error.message
      });

      // Wait before retry
      await this._sleep(this.retryDelay * (retryInfo.retryCount + 1)); // Exponential backoff

      // Reassign the task
      this.assignTask(npc, task);
    } else {
      this.log.error('Task failed after max retries', {
        npcId,
        action: task.action,
        retries: retryInfo.retryCount,
        error: error.message
      });

      // Clear retry tracking
      this.taskRetries.delete(npcId);

      // Complete as failed
      this.completeTask(npcId, false);
    }
  }

  /**
   * Sleep utility for retry delays
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
