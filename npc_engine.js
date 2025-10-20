// ai/npc_engine.js
// Core AI task manager for AICraft NPCs

import EventEmitter from "events";

import { interpretCommand } from "./interpreter.js";
import { validateTask } from "./task_schema.js";

const TASK_TIMEOUT = 30000; // 30 seconds max per task
const SIMULATED_TASK_DURATION = 3000;
const PRIORITY_WEIGHT = {
  high: 2,
  normal: 1,
  low: 0
};

function normalizePriority(priority) {
  if (["low", "normal", "high"].includes(priority)) {
    return priority;
  }
  return "normal";
}

function cloneTask(task) {
  return {
    ...task,
    target:
      task.target && typeof task.target === "object"
        ? { ...task.target }
        : task.target ?? null,
    metadata: task.metadata ? { ...task.metadata } : {}
  };
}

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
    this.bridgeHandlers = {
      npc_update: payload => this.handleBridgeUpdate(payload),
      task_feedback: payload => this.handleBridgeFeedback(payload),
      npc_spawned: payload => this.handleBridgeSpawn(payload)
    };

    if (this.bridge) {
      this.attachBridgeListeners(this.bridge);
    }
  }

  setBridge(bridge) {
    if (this.bridge) {
      this.detachBridgeListeners(this.bridge);
    }
    this.bridge = bridge;
    if (this.bridge) {
      this.attachBridgeListeners(this.bridge);
    }
  }

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
  }

  unregisterNPC(id) {
    if (this.taskTimeouts.has(id)) {
      clearTimeout(this.taskTimeouts.get(id));
      this.taskTimeouts.delete(id);
    }
    this.npcs.delete(id);
    console.log(`👋 Unregistered NPC ${id}`);
    this.emit("npc_unregistered", { id });
  }

  async handleCommand(inputText, sender = "system") {
    const task = await interpretCommand(inputText);

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
    const available = this.findIdleNPC();

    if (!available) {
      const position = this.enqueueTask(normalizedTask);
      console.warn(
        `⏸️  No idle NPCs available. Task queued at position ${position} (priority: ${normalizedTask.priority})`
      );
      return null;
    }

    return this.assignTask(available, normalizedTask);
  }

  findIdleNPC() {
    return [...this.npcs.values()].find(n => n.state === "idle");
  }

  normalizeTask(task, sender = "system") {
    const normalizedPriority = normalizePriority(task.priority);
    const createdAt = typeof task.createdAt === "number" ? task.createdAt : Date.now();
    const origin = task.sender || sender || "system";
    return {
      ...cloneTask(task),
      priority: normalizedPriority,
      sender: origin,
      createdAt
    };
  }

  enqueueTask(task) {
    const entry = {
      task: cloneTask(task),
      enqueuedAt: Date.now()
    };

    const priorityValue = PRIORITY_WEIGHT[task.priority] ?? PRIORITY_WEIGHT.normal;
    let insertIndex = this.taskQueue.findIndex(existing => {
      const existingValue = PRIORITY_WEIGHT[existing.task.priority] ?? PRIORITY_WEIGHT.normal;
      return priorityValue > existingValue;
    });

    if (insertIndex === -1) {
      this.taskQueue.push(entry);
      insertIndex = this.taskQueue.length - 1;
    } else {
      this.taskQueue.splice(insertIndex, 0, entry);
    }

    this.emit("task_queued", {
      task: cloneTask(task),
      position: insertIndex + 1
    });

    return insertIndex + 1;
  }

  assignTask(npc, task) {
    const normalizedTask = this.normalizeTask(task, task.sender);
    npc.task = normalizedTask;
    npc.state = "working";
    npc.progress = 0;
    npc.lastUpdate = Date.now();
    npc.awaitingFeedback = Boolean(
      this.requireFeedback &&
        this.bridge &&
        this.bridge.options?.enableUpdateServer !== false
    );
    console.log(`🪓 NPC ${npc.id} executing task: ${normalizedTask.action} (${normalizedTask.details})`);
    this.emit("task_assigned", { npcId: npc.id, task: cloneTask(normalizedTask) });

    if (this.taskTimeouts.has(npc.id)) {
      clearTimeout(this.taskTimeouts.get(npc.id));
    }

    const safetyTimeout = setTimeout(() => {
      console.warn(`⚠️  Task timeout for NPC ${npc.id}, forcing idle state`);
      this.completeTask(npc.id, false);
    }, TASK_TIMEOUT);

    this.taskTimeouts.set(npc.id, safetyTimeout);

    this.dispatchTask(npc, normalizedTask);

    return npc;
  }

  dispatchTask(npc, task) {
    if (!this.bridge) {
      setTimeout(() => {
        this.completeTask(npc.id, true);
      }, SIMULATED_TASK_DURATION);
      this.emit("task_dispatched", {
        npcId: npc.id,
        task: cloneTask(task),
        transport: "simulation"
      });
      return;
    }

    this.bridge
      .dispatchTask({ ...task, npcId: npc.id })
      .then(response => {
        if (response) {
          console.log(`🧭 Bridge response for ${npc.id}:`, response);
        }
        this.emit("task_dispatched", {
          npcId: npc.id,
          task: cloneTask(task),
          transport: "bridge",
          response
        });
        if (npc.awaitingFeedback) {
          return;
        }
        this.completeTask(npc.id, true);
      })
      .catch(err => {
        console.error(`❌ Bridge dispatch failed for ${npc.id}:`, err.message);
        this.emit("task_dispatch_failed", {
          npcId: npc.id,
          task: cloneTask(task),
          error: err
        });
        this.completeTask(npc.id, false);
      });
  }

  completeTask(npcId, success = true, metadata = null) {
    const npc = this.npcs.get(npcId);
    if (!npc) return;

    if (!npc.task) {
      // Nothing to complete; ignore duplicate completions
      return;
    }

    if (this.taskTimeouts.has(npcId)) {
      clearTimeout(this.taskTimeouts.get(npcId));
      this.taskTimeouts.delete(npcId);
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

    this.emit("task_completed", {
      npcId,
      success,
      task: cloneTask(completedTask),
      metadata
    });

    this.processQueue();
  }

  processQueue() {
    if (this.taskQueue.length === 0) return;

    const available = this.findIdleNPC();
    if (!available) return;

    const nextEntry = this.taskQueue.shift();
    const nextTask = nextEntry.task;
    console.log(
      `📋 Processing queued task (${this.taskQueue.length} remaining, priority: ${nextTask.priority})`
    );
    this.emit("task_dequeued", {
      task: cloneTask(nextTask),
      remaining: this.taskQueue.length
    });
    this.assignTask(available, nextTask);
  }

  getStatus() {
    const status = {
      total: this.npcs.size,
      idle: 0,
      working: 0,
      queueLength: this.taskQueue.length,
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

  attachBridgeListeners(bridge) {
    bridge.on("npc_update", this.bridgeHandlers.npc_update);
    bridge.on("task_feedback", this.bridgeHandlers.task_feedback);
    bridge.on("npc_spawned", this.bridgeHandlers.npc_spawned);
  }

  detachBridgeListeners(bridge) {
    bridge.off("npc_update", this.bridgeHandlers.npc_update);
    bridge.off("task_feedback", this.bridgeHandlers.task_feedback);
    bridge.off("npc_spawned", this.bridgeHandlers.npc_spawned);
  }

  handleBridgeSpawn(payload) {
    console.log(`🌱 Spawned NPC ${payload.npcId} using command: ${payload.command}`);
    this.emit("npc_spawned", payload);
  }

  handleBridgeFeedback(feedback) {
    if (!feedback || typeof feedback !== "object") return;
    const { npcId, success, progress, message } = feedback;
    if (!npcId || !this.npcs.has(npcId)) return;
    const npc = this.npcs.get(npcId);

    if (typeof progress === "number") {
      npc.progress = Math.max(0, Math.min(100, progress));
      npc.lastUpdate = Date.now();
    }

    if (typeof success === "boolean") {
      npc.awaitingFeedback = false;
      this.completeTask(npcId, success, feedback);
      return;
    }

    if (message) {
      console.log(`📨 Update from ${npcId}: ${message}`);
    }

    this.emit("bridge_feedback", feedback);
  }

  handleBridgeUpdate(update) {
    if (!update || typeof update !== "object") return;
    const { npcId, status, progress, success } = update;
    if (!npcId || !this.npcs.has(npcId)) return;

    const npc = this.npcs.get(npcId);
    if (typeof progress === "number") {
      npc.progress = Math.max(0, Math.min(100, progress));
      npc.lastUpdate = Date.now();
    }

    if (status) {
      console.log(`📡 ${npcId} status: ${status}`);
    }

    if (typeof success === "boolean") {
      npc.awaitingFeedback = false;
      this.completeTask(npcId, success, update);
    }

    this.emit("npc_status", update);
  }

  async spawnNPC(id) {
    if (!this.bridge) {
      console.warn(`⚠️  Cannot spawn NPC ${id} without an active bridge connection.`);
      return null;
    }

    const npc = this.npcs.get(id);
    if (!npc) {
      console.warn(`⚠️  Attempted to spawn unknown NPC ${id}`);
      return null;
    }

    const position = npc.position || this.defaultSpawnPosition;
    return this.bridge.spawnEntity({ npcId: id, npcType: npc.type, position });
  }
}

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
