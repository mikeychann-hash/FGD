// npc_engine/queue.js
// Task queue management with priority handling and back-pressure logic

import { PRIORITY_WEIGHT, normalizePriority, cloneTask, getPreferredNpcTypes } from "./utils.js";

/**
 * Manages task queue operations including enqueue, dequeue, and back-pressure
 */
export class QueueManager {
  constructor(engine) {
    this.engine = engine;
  }

  /**
   * Enqueues a task with priority-based insertion and back-pressure handling
   * @param {object} task - Task to enqueue
   * @returns {number} Position in queue (1-indexed), or -1 if rejected
   */
  enqueueTask(task) {
    const queue = this.engine.taskQueue;
    const maxQueueSize = this.engine.maxQueueSize;

    // Back-pressure: check if queue is at capacity
    if (queue.length >= maxQueueSize) {
      const incomingPriority = PRIORITY_WEIGHT[task.priority] ?? PRIORITY_WEIGHT.normal;

      // Find the lowest priority task in the queue
      let lowestPriorityIndex = -1;
      let lowestPriorityValue = Infinity;

      for (let i = queue.length - 1; i >= 0; i--) {
        const queuedPriority = PRIORITY_WEIGHT[queue[i].task.priority] ?? PRIORITY_WEIGHT.normal;
        if (queuedPriority < lowestPriorityValue) {
          lowestPriorityValue = queuedPriority;
          lowestPriorityIndex = i;
        }
      }

      // If incoming task has higher priority than lowest in queue, drop the lowest
      if (incomingPriority > lowestPriorityValue) {
        const dropped = queue.splice(lowestPriorityIndex, 1)[0];
        console.warn(
          `⚠️  Queue at capacity (${maxQueueSize}). Dropped lower priority task: ${dropped.task.action}`
        );
        this.engine.emit("task_dropped", {
          task: cloneTask(dropped.task),
          reason: "back_pressure",
          droppedFor: cloneTask(task)
        });
      } else {
        // Incoming task is lower or equal priority, reject it
        console.warn(
          `⚠️  Queue at capacity (${maxQueueSize}). Rejecting task: ${task.action} (priority: ${task.priority})`
        );
        this.engine.emit("task_rejected", {
          task: cloneTask(task),
          reason: "back_pressure"
        });
        return -1; // Indicate rejection
      }
    }

    const entry = {
      task: cloneTask(task),
      enqueuedAt: Date.now()
    };

    entry.task.priority = normalizePriority(entry.task.priority);
    entry.task.preferredNpcTypes = getPreferredNpcTypes(entry.task);

    const priorityValue = PRIORITY_WEIGHT[task.priority] ?? PRIORITY_WEIGHT.normal;
    let insertIndex = queue.findIndex(existing => {
      const existingValue = PRIORITY_WEIGHT[existing.task.priority] ?? PRIORITY_WEIGHT.normal;
      return priorityValue > existingValue;
    });

    if (insertIndex === -1) {
      queue.push(entry);
      insertIndex = queue.length - 1;
    } else {
      queue.splice(insertIndex, 0, entry);
    }

    this.engine.emit("task_queued", {
      task: cloneTask(task),
      position: insertIndex + 1
    });

    return insertIndex + 1;
  }

  /**
   * Processes queued tasks by assigning them to idle NPCs
   */
  processQueue() {
    const queue = this.engine.taskQueue;
    if (queue.length === 0) return;

    const idleNPCs = this.engine.getIdleNPCs();
    if (idleNPCs.length === 0) return;

    for (const npc of idleNPCs) {
      const queueIndex = this.findQueueIndexForNpc(npc);
      if (queueIndex === -1) {
        continue;
      }
      const [nextEntry] = queue.splice(queueIndex, 1);
      const nextTask = nextEntry.task;
      console.log(
        `📋 Processing queued task (${queue.length} remaining, priority: ${nextTask.priority})`
      );
      this.engine.emit("task_dequeued", {
        task: cloneTask(nextTask),
        remaining: queue.length
      });
      this.engine.assignTask(npc, nextTask);
      if (queue.length === 0) {
        break;
      }
    }
  }

  /**
   * Finds the best queue index for a specific NPC based on type preferences
   * @param {object} npc - NPC object
   * @returns {number} Queue index, or -1 if no suitable task found
   */
  findQueueIndexForNpc(npc) {
    const queue = this.engine.taskQueue;
    if (queue.length === 0) return -1;

    let fallbackIndex = -1;
    let sawPreferredEntry = false;

    for (let index = 0; index < queue.length; index += 1) {
      const entry = queue[index];
      if (fallbackIndex === -1) {
        fallbackIndex = index;
      }

      const preferredTypes = getPreferredNpcTypes(entry.task);
      if (preferredTypes.length === 0) {
        return index;
      }

      sawPreferredEntry = true;

      if (preferredTypes.includes(npc.type)) {
        return index;
      }
    }

    return sawPreferredEntry ? -1 : fallbackIndex;
  }
}
