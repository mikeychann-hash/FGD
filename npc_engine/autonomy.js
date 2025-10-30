// npc_engine/autonomy.js
// AI-driven autonomous task generation and management

import { generateModelTasks, DEFAULT_AUTONOMY_PROMPT_TEXT } from "../model_director.js";
import { validateTask } from "../task_schema.js";
import { cloneTask } from "./utils.js";

/**
 * Manages AI-driven autonomous task generation
 */
export class AutonomyManager {
  constructor(engine) {
    this.engine = engine;
    this.config = null;
    this.timer = null;
    this.running = false;
  }

  /**
   * Enables autonomous task generation with AI
   * @param {object} options - Autonomy configuration options
   */
  enableModelAutonomy(options = {}) {
    this.disableModelAutonomy();

    const {
      instructions = DEFAULT_AUTONOMY_PROMPT_TEXT,
      intervalMs = 10000,
      maxTasks = 3,
      allowWhenBusy = false,
      mockResponse = null,
      temperature = 0.3,
      sender = "model_autonomy"
    } = options;

    this.config = {
      instructions,
      intervalMs: Math.max(1000, intervalMs),
      maxTasks,
      allowWhenBusy,
      mockResponse,
      temperature,
      sender
    };

    this.timer = setInterval(() => {
      this.runAutonomyCycle().catch(err => {
        console.error("❌ Autonomy cycle failed:", err.message);
      });
    }, this.config.intervalMs);

    // Kick off an immediate cycle so it feels responsive
    this.runAutonomyCycle({ force: true }).catch(err => {
      console.error("❌ Initial autonomy cycle failed:", err.message);
    });

    console.log(
      `🧠 Model autonomy enabled (interval ${this.config.intervalMs}ms, max ${this.config.maxTasks} tasks).`
    );
  }

  /**
   * Disables autonomous task generation
   */
  disableModelAutonomy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.config = null;
    this.running = false;
  }

  /**
   * Runs a single autonomy cycle to generate and enqueue tasks
   * @param {object} options - Cycle options
   * @param {boolean} options.force - Force execution even if busy
   */
  async runAutonomyCycle({ force = false } = {}) {
    if (!this.config || this.running) {
      return;
    }

    const busyNPC = [...this.engine.npcs.values()].some(npc => npc.state === "working");
    const queueNotEmpty = this.engine.taskQueue.length > 0;

    if (!force && !this.config.allowWhenBusy && (busyNPC || queueNotEmpty)) {
      return;
    }

    this.running = true;
    try {
      const statusSnapshot = this.engine.getStatus();
      const { tasks, rationale } = await generateModelTasks({
        statusSnapshot,
        instructions: this.config.instructions,
        maxTasks: this.config.maxTasks,
        mockResponse: this.config.mockResponse,
        temperature: this.config.temperature
      });

      if (rationale) {
        console.log(`🧠 Autonomy rationale: ${rationale}`);
      }

      if (!tasks || tasks.length === 0) {
        return;
      }

      for (const task of tasks) {
        const validation = validateTask(task);
        if (!validation.valid) {
          console.warn(`⚠️  Autonomy task rejected: ${validation.errors.join("; ")}`);
          continue;
        }

        const normalizedTask = this.engine.normalizeTask(task, this.config.sender);
        const available = this.engine.findIdleNPC(normalizedTask);

        if (!available) {
          const position = this.engine.queueManager.enqueueTask(normalizedTask);
          console.log(
            `📥 Autonomy queued task (${normalizedTask.action}) at position ${position}`
          );
          continue;
        }

        this.engine.dispatchManager.assignTask(available, normalizedTask);
      }
    } finally {
      this.running = false;
    }
  }
}
