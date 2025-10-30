// npc_engine/dispatch.js
// Task dispatch and execution lifecycle management

import { planTask } from "../tasks/index.js";
import { TASK_TIMEOUT, SIMULATED_TASK_DURATION, normalizePriority, cloneTask, getPreferredNpcTypes } from "./utils.js";

/**
 * Manages task dispatch, execution, and completion
 */
export class DispatchManager {
  constructor(engine) {
    this.engine = engine;
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
    console.log(
      `🪓 NPC ${npc.id} executing task: ${normalizedTask.action} (${normalizedTask.details})${preferenceNote}`
    );
    this.engine.emit("task_assigned", { npcId: npc.id, task: cloneTask(normalizedTask) });

    if (this.engine.taskTimeouts.has(npc.id)) {
      clearTimeout(this.engine.taskTimeouts.get(npc.id));
    }

    const safetyTimeout = setTimeout(() => {
      console.warn(`⚠️  Task timeout for NPC ${npc.id}, forcing idle state`);
      this.completeTask(npc.id, false);
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

    if (plan) {
      this.engine.emit("task_plan_generated", { npcId: npc.id, task: cloneTask(task), plan });
    }

    this.engine.bridge
      .dispatchTask({ ...task, npcId: npc.id })
      .then(response => {
        if (response) {
          console.log(`🧭 Bridge response for ${npc.id}:`, response);
        }
        this.engine.emit("task_dispatched", {
          npcId: npc.id,
          task: cloneTask(task),
          transport: "bridge",
          response,
          plan
        });
        if (npc.awaitingFeedback) {
          return;
        }
        this.completeTask(npc.id, true);
      })
      .catch(err => {
        console.error(`❌ Bridge dispatch failed for ${npc.id}:`, err.message);
        this.engine.emit("task_dispatch_failed", {
          npcId: npc.id,
          task: cloneTask(task),
          error: err
        });
        this.completeTask(npc.id, false);
      });
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
      console.log(`✅ NPC ${npcId} completed task: ${completedTask?.action}`);
    } else {
      console.log(`❌ NPC ${npcId} failed task: ${completedTask?.action}`);
    }

    if (metadata) {
      console.log(`ℹ️  Completion metadata for ${npcId}:`, metadata);
    }

    this.engine.emit("task_completed", {
      npcId,
      success,
      task: cloneTask(completedTask),
      metadata
    });

    this.engine.queueManager.processQueue();
  }
}
