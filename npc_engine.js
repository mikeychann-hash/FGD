// ai/npc_engine.js
// Core AI task manager for AICraft NPCs

import { interpretCommand } from "./interpreter.js";
import { validateTask } from "./task_schema.js";
import { SUPPORT_LEVELS, SUPPLY_ACTIONS, TASK_PRIORITIES } from "./mindcraft_ce_constants.js";

const TASK_TIMEOUT = 30000; // 30 seconds max per task
const SIMULATED_TASK_DURATION = 3000;

export class NPCEngine {
  constructor(options = {}) {
    this.npcs = new Map(); // npcId -> state
    this.taskQueue = [];
    this.taskTimeouts = new Map(); // npcId -> timeoutId
    this.bridge = null;
    this.bridgeListeners = [];

    if (options.bridge) {
      this.setBridge(options.bridge);
    }
  }

  setBridge(bridge) {
    if (this.bridge === bridge) {
      return;
    }

    if (this.bridge) {
      this.detachBridgeListeners();
    }

    this.bridge = bridge;

    if (this.bridge) {
      this.attachBridgeListeners();
    }
  }

  attachBridgeListeners() {
    if (!this.bridge?.on) return;

    const runtimeEventHandler = event => this.handleRuntimeEvent(event);
    const runtimePlanHandler = plan => this.handleRuntimePlan(plan);

    this.bridge.on("runtime_event", runtimeEventHandler);
    this.bridge.on("runtime_plan", runtimePlanHandler);

    this.bridgeListeners = [
      { event: "runtime_event", handler: runtimeEventHandler },
      { event: "runtime_plan", handler: runtimePlanHandler }
    ];
  }

  detachBridgeListeners() {
    if (!this.bridge) return;

    this.bridgeListeners.forEach(({ event, handler }) => {
      if (typeof this.bridge.off === "function") {
        this.bridge.off(event, handler);
      } else if (typeof this.bridge.removeListener === "function") {
        this.bridge.removeListener(event, handler);
      }
    });

    this.bridgeListeners = [];
  }

  registerNPC(id, type = "builder") {
    this.npcs.set(id, {
      id,
      type,
      task: null,
      state: "idle",
      position: { x: 0, y: 0, z: 0 },
      inventoryState: null,
      lastItemUsed: null,
      loadout: null
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

    const validation = validateTask(task);
    if (!validation.valid) {
      console.warn(`⚠️  Task validation failed: ${validation.errors.join("; ")}`);
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

  findIdleNPC(excludeNpcId = null) {
    return [...this.npcs.values()].find(
      n => n.state === "idle" && (!excludeNpcId || n.id !== excludeNpcId)
    );
  }

  assignTask(npc, task) {
    npc.task = task;
    npc.state = "working";
    console.log(`🪓 NPC ${npc.id} executing task: ${task.action} (${task.details})`);

    if (this.taskTimeouts.has(npc.id)) {
      clearTimeout(this.taskTimeouts.get(npc.id));
    }

    const safetyTimeout = setTimeout(() => {
      console.warn(`⚠️  Task timeout for NPC ${npc.id}, forcing idle state`);
      this.completeTask(npc.id, false);
    }, TASK_TIMEOUT);

    this.taskTimeouts.set(npc.id, safetyTimeout);

    this.dispatchTask(npc, task);

    return npc;
  }

  dispatchTask(npc, task) {
    if (!this.bridge) {
      setTimeout(() => {
        this.completeTask(npc.id, true);
      }, SIMULATED_TASK_DURATION);
      return;
    }

    this.bridge
      .dispatchTask({ ...task, npcId: npc.id })
      .then(result => {
        if (result?.response) {
          console.log(`🧭 Bridge response for ${npc.id}:`, result.response);
        }

        if (result?.runtime?.deferCompletion) {
          console.log(`⌛ Awaiting runtime completion for NPC ${npc.id}`);
          return;
        }

        this.completeTask(npc.id, true);
      })
      .catch(err => {
        console.error(`❌ Bridge dispatch failed for ${npc.id}:`, err.message);
        this.completeTask(npc.id, false);
      });
  }

  handleRuntimePlan(plan) {
    if (!plan?.npcId) return;
    const npc = this.npcs.get(plan.npcId);
    if (!npc) return;

    npc.activePlan = plan.plan || null;
    if (plan.plan?.summary) {
      console.log(`🗺️ Plan for ${plan.npcId}: ${plan.plan.summary}`);
    }
  }

  handleRuntimeEvent(event) {
    if (!event?.npcId) return;
    const npc = this.npcs.get(event.npcId);
    if (!npc) return;

    switch (event.type) {
      case "hazard_detected":
        this.handleHazardEvent(npc, event);
        break;
      case "status":
        this.handleStatusEvent(npc, event);
        break;
      case "support_request":
        this.handleSupportRequest(npc, event);
        break;
      case "request_tools":
        this.handleToolRequest(npc, event);
        break;
      case "item_used":
        this.handleItemUsed(npc, event);
        break;
      case "inventory_update":
        this.handleInventoryUpdate(npc, event);
        break;
      case "loadout_update":
        this.handleLoadoutUpdate(npc, event);
        break;
      case "task_complete":
        this.completeTask(npc.id, event.success !== false);
        break;
      case "task_cancelled":
        console.warn(`🛑 Task cancelled for ${npc.id}`);
        this.completeTask(npc.id, false);
        break;
      default:
        break;
    }
  }

  handleHazardEvent(npc, event) {
    npc.lastHazard = event;
    const action = event.directive?.action;

    if (action === "pause" || action === "reroute") {
      this.pauseTask(npc.id, event);
    }

    if (action === "request_support") {
      this.handleSupportRequest(npc, event);
    }

    if (action === "request_tools") {
      this.handleToolRequest(npc, {
        ...event,
        request: event.directive?.request || event.request
      });
    }
  }

  handleStatusEvent(npc, event) {
    const status = event.status;

    if (status === "resume") {
      this.resumeTask(npc.id, event);
    } else if (status === "pause") {
      this.pauseTask(npc.id, event);
    } else if (status === "reroute") {
      this.requestReroute(npc, event);
    }
  }

  handleSupportRequest(npc, event) {
    npc.pendingSupport = event;
    console.log(`🆘 NPC ${npc.id} requested support: ${event.reason || "unspecified"}`);

    const task = this.buildSupportTask(npc, event);
    if (task) {
      this.enqueueFollowupTask(task, { excludeNpcId: npc.id, urgent: true });
    }
  }

  handleToolRequest(npc, event) {
    npc.pendingToolRequest = event;
    const items = event.request?.items?.map(item => `${item.item}x${item.count}`).join(", ") || "unknown";
    console.log(`🧰 NPC ${npc.id} requested tools: ${items}`);

    const deliveryTask = this.buildDeliveryTask(npc, event);
    if (deliveryTask) {
      this.enqueueFollowupTask(deliveryTask, { excludeNpcId: npc.id, urgent: true });
    }
  }

  handleItemUsed(npc, event) {
    npc.lastItemUsed = event;
    const itemName = event.item?.item || event.item || "unknown item";
    console.log(`🍎 NPC ${npc.id} used ${itemName} for ${event.purpose || "utility"}`);
  }

  handleInventoryUpdate(npc, event) {
    npc.inventoryState = event.state || event;
    if (event.summary) {
      console.log(`📦 Inventory update for ${npc.id}: ${event.summary}`);
    }
  }

  handleLoadoutUpdate(npc, event) {
    npc.loadout = event.loadout || event;
    if (event.status) {
      console.log(`🛡️ Loadout update for ${npc.id}: ${event.status}`);
    }
  }

  enqueueFollowupTask(task, options = {}) {
    const validation = validateTask(task);
    if (!validation.valid) {
      console.warn(`⚠️  Follow-up task validation failed: ${validation.errors.join(", ")}`);
      return;
    }

    const exclude = options.excludeNpcId || null;
    const idle = this.findIdleNPC(exclude);

    if (idle) {
      console.log(`⚡ Assigning follow-up task ${task.action} to ${idle.id}`);
      this.assignTask(idle, task);
      return;
    }

    if (options.urgent) {
      this.taskQueue.unshift(task);
    } else {
      this.taskQueue.push(task);
    }

    console.log(
      `📨 Queued follow-up task (${task.action}); queue length ${this.taskQueue.length}`
    );
  }

  buildSupportTask(npc, event) {
    const hazard = event.hazard || event.reason || npc.lastHazard?.hazard || null;
    const target = this.resolveTargetLocation(npc, event);
    const assistance = this.normalizeStringList(
      event.assistance || event.directive?.assistance || event.directive?.actions || "combat_support"
    );
    const actions = this.normalizeStringList(event.actions || event.directive?.actions);
    const objectives = this.normalizeStringList(event.objectives);
    const requestItems = event.directive?.request?.items || event.request?.items || null;
    const level =
      this.normalizeSupportLevel(event.directive?.level || event.level || this.deriveSupportLevel(event)) ||
      undefined;
    const priority = this.normalizeTaskPriority(event.priority || "high");

    const metadata = {
      targetNpc: npc.id,
      hazard: hazard || undefined,
      assistance: assistance.length ? assistance : undefined,
      actions: actions.length ? actions : undefined,
      objectives: objectives.length ? objectives : undefined,
      level,
      priority,
      notes: event.reason || undefined
    };

    if (requestItems && requestItems.length) {
      metadata.requests = { items: requestItems };
    }

    return {
      action: "support",
      details: hazard ? `Support ${npc.id} near ${hazard}` : `Support ${npc.id}`,
      target,
      metadata
    };
  }

  buildDeliveryTask(npc, event) {
    const requestedItems = event.request?.items || event.directive?.request?.items || [];
    if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
      return null;
    }

    const actions = this.normalizeSupplyActionList(event.actions || event.directive?.actions);
    if (!actions.length) {
      actions.push("deliver");
    }

    const priority = this.normalizeTaskPriority(event.priority || "high");
    const destination = this.resolveTargetLocation(npc, event);

    return {
      action: "deliver_items",
      details: `Deliver supplies to ${npc.id}`,
      target: destination,
      metadata: {
        targetNpc: npc.id,
        items: requestedItems,
        actions,
        priority,
        notes: event.reason || undefined
      }
    };
  }

  resolveTargetLocation(npc, event) {
    if (event.target) return event.target;
    if (event.location) return event.location;
    if (event.position) return event.position;
    if (npc.task?.target) return npc.task.target;
    return { ...npc.position };
  }

  normalizeStringList(value) {
    if (value === undefined || value === null) {
      return [];
    }

    const list = Array.isArray(value) ? value : [value];
    return list
      .map(entry => (typeof entry === "string" ? entry.trim() : null))
      .filter(Boolean);
  }

  normalizeSupportLevel(level) {
    if (!level) return undefined;
    const normalized = level.toString().toLowerCase();
    if (SUPPORT_LEVELS.includes(normalized)) {
      return normalized;
    }
    if (normalized === "urgent") return "high";
    return undefined;
  }

  deriveSupportLevel(event) {
    const severity = (event?.severity || event?.directive?.severity || "").toString().toLowerCase();
    if (severity === "critical") return "emergency";
    if (severity === "high") return "high";
    if (severity === "moderate") return "normal";
    return undefined;
  }

  normalizeSupplyActionList(actions) {
    const list = this.normalizeStringList(actions).map(entry => entry.toLowerCase());
    if (!list.length) return [];

    return list
      .map(entry => {
        if (SUPPLY_ACTIONS.includes(entry)) {
          return entry;
        }
        if (entry.includes("deliver")) return "deliver";
        if (entry.includes("restock")) return "restock";
        if (entry.includes("swap")) return "swap";
        if (entry.includes("repair")) return "repair";
        return null;
      })
      .filter(Boolean);
  }

  normalizeTaskPriority(priority) {
    if (!priority) return "normal";
    const normalized = priority.toString().toLowerCase();
    if (TASK_PRIORITIES.includes(normalized)) {
      return normalized;
    }
    if (normalized === "urgent") return "high";
    if (normalized === "emergency") return "critical";
    return "normal";
  }

  pauseTask(npcId, reasonEvent) {
    const npc = this.npcs.get(npcId);
    if (!npc || npc.state === "paused") return;

    npc.state = "paused";
    npc.pauseReason = reasonEvent;
    console.warn(`⏸️ NPC ${npcId} paused due to hazard or directive.`);
  }

  resumeTask(npcId, event) {
    const npc = this.npcs.get(npcId);
    if (!npc || npc.state !== "paused") return;

    npc.state = "working";
    npc.pauseReason = null;
    console.log(`▶️ NPC ${npcId} resumed task: ${npc.task?.action}`);
  }

  requestReroute(npc, event) {
    npc.reroute = event;
    console.log(`🔁 NPC ${npc.id} rerouting due to ${event.reason || "directive"}`);
  }

  completeTask(npcId, success = true) {
    const npc = this.npcs.get(npcId);
    if (!npc) return;

    if (this.taskTimeouts.has(npcId)) {
      clearTimeout(this.taskTimeouts.get(npcId));
      this.taskTimeouts.delete(npcId);
    }

    const completedTask = npc.task;
    npc.state = "idle";
    npc.task = null;
    npc.pauseReason = null;
    npc.lastHazard = null;
    npc.pendingSupport = null;
    npc.pendingToolRequest = null;
    npc.activePlan = null;
    npc.reroute = null;
    npc.lastItemUsed = null;
    npc.inventoryState = null;
    npc.loadout = null;

    if (success) {
      console.log(`✅ NPC ${npcId} completed task: ${completedTask?.action}`);
    } else {
      console.log(`❌ NPC ${npcId} failed task: ${completedTask?.action}`);
    }

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
        task: npc.task?.action || null
      });
    }

    return status;
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
