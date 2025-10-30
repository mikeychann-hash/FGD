// npc_engine/bridge.js
// Bridge integration and external communication management

/**
 * Manages bridge connections and event handling
 */
export class BridgeManager {
  constructor(engine) {
    this.engine = engine;
    this.bridgeHandlers = {
      npc_update: payload => this.handleBridgeUpdate(payload),
      task_feedback: payload => this.handleBridgeFeedback(payload),
      npc_spawned: payload => this.handleBridgeSpawn(payload)
    };
  }

  /**
   * Sets a new bridge and updates event listeners
   * @param {object} bridge - Bridge instance
   */
  setBridge(bridge) {
    if (this.engine.bridge) {
      this.detachBridgeListeners(this.engine.bridge);
    }
    this.engine.bridge = bridge;
    if (this.engine.bridge) {
      this.attachBridgeListeners(this.engine.bridge);
    }
  }

  /**
   * Attaches event listeners to the bridge
   * @param {object} bridge - Bridge instance
   */
  attachBridgeListeners(bridge) {
    bridge.on("npc_update", this.bridgeHandlers.npc_update);
    bridge.on("task_feedback", this.bridgeHandlers.task_feedback);
    bridge.on("npc_spawned", this.bridgeHandlers.npc_spawned);
  }

  /**
   * Detaches event listeners from the bridge
   * @param {object} bridge - Bridge instance
   */
  detachBridgeListeners(bridge) {
    bridge.off("npc_update", this.bridgeHandlers.npc_update);
    bridge.off("task_feedback", this.bridgeHandlers.task_feedback);
    bridge.off("npc_spawned", this.bridgeHandlers.npc_spawned);
  }

  /**
   * Handles NPC spawn events from the bridge
   * @param {object} payload - Spawn event payload
   */
  handleBridgeSpawn(payload) {
    console.log(`🌱 Spawned NPC ${payload.npcId} using command: ${payload.command}`);
    this.engine.emit("npc_spawned", payload);
  }

  /**
   * Handles task feedback from the bridge
   * @param {object} feedback - Feedback object
   */
  handleBridgeFeedback(feedback) {
    if (!feedback || typeof feedback !== "object") return;
    const { npcId, success, progress, message } = feedback;
    if (!npcId || !this.engine.npcs.has(npcId)) return;
    const npc = this.engine.npcs.get(npcId);

    if (typeof progress === "number") {
      npc.progress = Math.max(0, Math.min(100, progress));
      npc.lastUpdate = Date.now();
    }

    if (typeof success === "boolean") {
      npc.awaitingFeedback = false;
      this.engine.dispatchManager.completeTask(npcId, success, feedback);
      return;
    }

    if (message) {
      console.log(`📨 Update from ${npcId}: ${message}`);
    }

    this.engine.emit("bridge_feedback", feedback);
  }

  /**
   * Handles status updates from the bridge
   * @param {object} update - Update object
   */
  handleBridgeUpdate(update) {
    if (!update || typeof update !== "object") return;
    const { npcId, status, progress, success } = update;
    if (!npcId || !this.engine.npcs.has(npcId)) return;

    const npc = this.engine.npcs.get(npcId);
    if (typeof progress === "number") {
      npc.progress = Math.max(0, Math.min(100, progress));
      npc.lastUpdate = Date.now();
    }

    if (status) {
      console.log(`📡 ${npcId} status: ${status}`);
    }

    if (typeof success === "boolean") {
      npc.awaitingFeedback = false;
      this.engine.dispatchManager.completeTask(npcId, success, update);
    }

    this.engine.emit("npc_status", update);
  }

  /**
   * Spawns an NPC via the bridge
   * @param {string} id - NPC ID
   * @returns {Promise<any>} Bridge response
   */
  async spawnNPC(id) {
    if (!this.engine.bridge) {
      console.warn(`⚠️  Cannot spawn NPC ${id} without an active bridge connection.`);
      return null;
    }

    const npc = this.engine.npcs.get(id);
    if (!npc) {
      console.warn(`⚠️  Attempted to spawn unknown NPC ${id}`);
      return null;
    }

    const position = npc.position || this.engine.defaultSpawnPosition;
    return this.engine.bridge.spawnEntity({ npcId: id, npcType: npc.type, position });
  }
}
