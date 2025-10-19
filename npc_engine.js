// ai/npc_engine.js
// Core AI task manager for AICraft NPCs

import { interpretCommand } from "./interpreter.js";

const TASK_TIMEOUT = 30000; // 30 seconds max per task
const SIMULATED_TASK_DURATION = 3000;

export class NPCEngine {
  constructor() {
    this.npcs = new Map(); // npcId -> state
    this.taskQueue = [];
    this.taskTimeouts = new Map(); // npcId -> timeoutId
  }

  registerNPC(id, type = "builder") {
    this.npcs.set(id, {
      id,
      type,
      task: null,
      state: "idle",
      position: { x: 0, y: 0, z: 0 }
    });
    console.log(`🤖 Registered NPC ${id} (${type})`);
  }

  unregisterNPC(id) {
    if (this.taskTimeouts.has(id)) {
      clearTimeout(this.taskTimeouts.get(id));
      this.taskTimeouts.delete(id);
    }
    this.npcs.delete(id);
    console.log(`👋 Unregistered NPC ${id}`);
  }

  async handleCommand(inputText, sender = "system") {
    const task = await interpretCommand(inputText);
    
    if (!task || task.action === "none") {
      console.warn("⚠️  No interpretable task found.");
      return null;
    }

    const available = this.findIdleNPC();
    
    if (!available) {
      this.taskQueue.push(task);
      console.warn(`⏸️  No idle NPCs available. Task queued (${this.taskQueue.length} in queue)`);
      return null;
    }

    return this.assignTask(available, task);
  }

  findIdleNPC() {
    return [...this.npcs.values()].find(n => n.state === "idle");
  }

  assignTask(npc, task) {
    npc.task = task;
    npc.state = "working";
    console.log(`🪓 NPC ${npc.id} executing task: ${task.action} (${task.details})`);

    // Clear any existing timeout for this NPC
    if (this.taskTimeouts.has(npc.id)) {
      clearTimeout(this.taskTimeouts.get(npc.id));
    }

    // Set a safety timeout in case task never completes
    const safetyTimeout = setTimeout(() => {
      console.warn(`⚠️  Task timeout for NPC ${npc.id}, forcing idle state`);
      this.completeTask(npc.id, false);
    }, TASK_TIMEOUT);

    this.taskTimeouts.set(npc.id, safetyTimeout);

    // Simulated task completion
    setTimeout(() => {
      this.completeTask(npc.id, true);
    }, SIMULATED_TASK_DURATION);

    return npc;
  }

  completeTask(npcId, success = true) {
    const npc = this.npcs.get(npcId);
    if (!npc) return;

    // Clear the timeout
    if (this.taskTimeouts.has(npcId)) {
      clearTimeout(this.taskTimeouts.get(npcId));
      this.taskTimeouts.delete(npcId);
    }

    const completedTask = npc.task;
    npc.state = "idle";
    npc.task = null;

    if (success) {
      console.log(`✅ NPC ${npcId} completed task: ${completedTask?.action}`);
    } else {
      console.log(`❌ NPC ${npcId} failed task: ${completedTask?.action}`);
    }

    // Process next task in queue
    this.processQueue();
  }

  processQueue() {
    if (this.taskQueue.length === 0) return;

    const available = this.findIdleNPC();
    if (!available) return;

    const nextTask = this.taskQueue.shift();
    console.log(`📋 Processing queued task (${this.taskQueue.length} remaining)`);
    this.assignTask(available, nextTask);
  }

  getStatus() {
    const status = {
      total: this.npcs.size,
      idle: 0,
      working: 0,
      queueLength: this.taskQueue.length,
      npcs: []
    };

    for (const npc of this.npcs.values()) {
      if (npc.state === "idle") status.idle++;
      if (npc.state === "working") status.working++;
      status.npcs.push({
        id: npc.id,
        type: npc.type,
        state: npc.state,
        task: npc.task?.action || null
      });
    }

    return status;
  }
}

// Example usage
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