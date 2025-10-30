// npc_engine.js
// Core AI task manager for AICraft NPCs
//
// This file has been refactored into focused modules for better maintainability:
// - npc_engine/utils.js - Shared utilities and helper functions
// - npc_engine/autonomy.js - AI-driven autonomous task generation
// - npc_engine/queue.js - Priority queue and back-pressure management
// - npc_engine/dispatch.js - Task execution lifecycle management
// - npc_engine/bridge.js - External communication and bridge integration

import EventEmitter from "events";

import { interpretCommand } from "./interpreter.js";
import { validateTask } from "./task_schema.js";
import { normalizeControlRatio, normalizePriority, cloneTask, getPreferredNpcTypes } from "./npc_engine/utils.js";
import { AutonomyManager } from "./npc_engine/autonomy.js";
import { QueueManager } from "./npc_engine/queue.js";
import { DispatchManager } from "./npc_engine/dispatch.js";
import { BridgeManager } from "./npc_engine/bridge.js";

export class NPCEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.npcs = new Map(); // npcId -> state
    this.taskQueue = []; // [{ task, enqueuedAt }]
    this.taskTimeouts = new Map(); // npcId -> timeoutId
    this.bridge = options.bridge || null;
    this.autoSpawn = options.autoSpawn ?? false;
    this.defaultSpawnPosition = options.defaultSpawnPosition || { x: 0, y: 64, z: 0 };
    this.requireFeedback = options.requireFeedback ?? true;
    this.modelControlRatio = normalizeControlRatio(options.modelControlRatio);
    this.interpreterOptions = { ...(options.interpreterOptions || {}) };
    this.maxQueueSize = options.maxQueueSize ?? 100;

    // Initialize manager modules
    this.autonomyManager = new AutonomyManager(this);
    this.queueManager = new QueueManager(this);
    this.dispatchManager = new DispatchManager(this);
    this.bridgeManager = new BridgeManager(this);

    if (this.bridge) {
      this.bridgeManager.attachBridgeListeners(this.bridge);
    }
  }

  // ============================================================================
  // Bridge Management
  // ============================================================================

  setBridge(bridge) {
    this.bridgeManager.setBridge(bridge);
  }

  async spawnNPC(id) {
    return this.bridgeManager.spawnNPC(id);
  }

  // ============================================================================
  // NPC Registration
  // ============================================================================

  registerNPC(id, type = "builder", options = {}) {
    const spawnPosition = options.position || this.defaultSpawnPosition;
    this.npcs.set(id, {
      id,
      type,
      task: null,
      state: "idle",
      position: { ...spawnPosition },
      progress: 0,
      lastUpdate: null,
      awaitingFeedback: false
    });
    console.log(`🤖 Registered NPC ${id} (${type})`);
    this.emit("npc_registered", { id, type, position: { ...spawnPosition } });

    if (this.autoSpawn && this.bridge) {
      this.spawnNPC(id).catch(err => {
        console.error(`❌ Failed to spawn NPC ${id}:`, err.message);
      });
    }

    this.queueManager.processQueue();
  }

  unregisterNPC(id) {
    if (!this.npcs.has(id)) {
      return;
    }

    const npc = this.npcs.get(id);

    if (npc?.task) {
      const taskClone = cloneTask(npc.task);
      this.queueManager.enqueueTask(taskClone);
      this.emit("task_requeued", {
        task: cloneTask(taskClone),
        npcId: id,
        reason: "npc_unregistered"
      });
    }

    if (this.taskTimeouts.has(id)) {
      clearTimeout(this.taskTimeouts.get(id));
      this.taskTimeouts.delete(id);
    }
    this.npcs.delete(id);
    console.log(`👋 Unregistered NPC ${id}`);
    this.emit("npc_unregistered", { id });

    this.queueManager.processQueue();
  }

  // ============================================================================
  // Autonomy Management
  // ============================================================================

  enableModelAutonomy(options = {}) {
    this.autonomyManager.enableModelAutonomy(options);
  }

  disableModelAutonomy() {
    this.autonomyManager.disableModelAutonomy();
  }

  // ============================================================================
  // Task Handling
  // ============================================================================

  async handleCommand(inputText, sender = "system") {
    const interpreterOptions = { ...this.interpreterOptions };
    if (typeof this.modelControlRatio === "number") {
      interpreterOptions.controlRatio = this.modelControlRatio;
    }

    const task = await interpretCommand(inputText, interpreterOptions);

    if (!task || task.action === "none") {
      console.warn("⚠️  No interpretable task found.");
      return null;
    }

    const validation = validateTask(task);
    if (!validation.valid) {
      console.warn(`⚠️  Task validation failed: ${validation.errors.join("; ")}`);
      return null;
    }

    const normalizedTask = this.normalizeTask(task, sender);
    const available = this.findIdleNPC(normalizedTask);

    if (!available) {
      const position = this.queueManager.enqueueTask(normalizedTask);
      const idleNPCs = this.getIdleNPCs();
      if (idleNPCs.length > 0 && normalizedTask.preferredNpcTypes.length > 0) {
        console.warn(
          `⏸️  No compatible NPC types available. Waiting for ${normalizedTask.preferredNpcTypes.join(", ")}.` +
            ` Task queued at position ${position} (priority: ${normalizedTask.priority})`
        );
      } else {
        console.warn(
          `⏸️  No idle NPCs available. Task queued at position ${position} (priority: ${normalizedTask.priority})`
        );
      }
      return null;
    }

    return this.dispatchManager.assignTask(available, normalizedTask);
  }

  normalizeTask(task, sender = "system") {
    const normalizedPriority = normalizePriority(task.priority);
    const createdAt = typeof task.createdAt === "number" ? task.createdAt : Date.now();
    const origin = task.sender || sender || "system";
    const preferredNpcTypes = getPreferredNpcTypes(task);
    return {
      ...cloneTask(task),
      priority: normalizedPriority,
      sender: origin,
      createdAt,
      preferredNpcTypes
    };
  }

  assignTask(npc, task) {
    return this.dispatchManager.assignTask(npc, task);
  }

  // ============================================================================
  // NPC Queries
  // ============================================================================

  findIdleNPC(task = null) {
    const idleNPCs = this.getIdleNPCs();
    if (idleNPCs.length === 0) return null;

    if (!task) {
      return idleNPCs[0];
    }

    const preferredTypes = getPreferredNpcTypes(task);
    if (preferredTypes.length === 0) {
      return idleNPCs[0];
    }

    const preferredMatch = idleNPCs.find(npc => preferredTypes.includes(npc.type));
    return preferredMatch || null;
  }

  getIdleNPCs() {
    return [...this.npcs.values()].filter(n => n.state === "idle");
  }

  getStatus() {
    const status = {
      total: this.npcs.size,
      idle: 0,
      working: 0,
      queueLength: this.taskQueue.length,
      maxQueueSize: this.maxQueueSize,
      queueUtilization: this.maxQueueSize > 0
        ? Math.round((this.taskQueue.length / this.maxQueueSize) * 100)
        : 0,
      queueByPriority: { high: 0, normal: 0, low: 0 },
      npcs: [],
      bridgeConnected: Boolean(this.bridge?.isConnected?.())
    };

    for (const npc of this.npcs.values()) {
      if (npc.state === "idle") status.idle++;
      if (npc.state === "working") status.working++;
      status.npcs.push({
        id: npc.id,
        type: npc.type,
        state: npc.state,
        task: npc.task?.action || null,
        preferredNpcTypes: npc.task?.preferredNpcTypes || [],
        progress: npc.progress,
        lastUpdate: npc.lastUpdate
      });
    }

    for (const entry of this.taskQueue) {
      const priority = entry.task.priority || "normal";
      if (status.queueByPriority[priority] != null) {
        status.queueByPriority[priority]++;
      }
    }

    return status;
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  setModelControlRatio(ratio) {
    this.modelControlRatio = normalizeControlRatio(ratio);
  }
}

// ============================================================================
// CLI Example
// ============================================================================

if (process.argv[1].includes("npc_engine.js")) {
  const engine = new NPCEngine();
  engine.registerNPC("npc_1", "miner");
  engine.registerNPC("npc_2", "builder");

  (async () => {
    await engine.handleCommand("build a small tower near spawn");
    await engine.handleCommand("mine some iron ore");

    setTimeout(() => {
      console.log("\n📊 Engine Status:", engine.getStatus());
    }, 1000);
  })();
}
