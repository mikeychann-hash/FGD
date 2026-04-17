// minecraft_bridge.js
// FGD Hybrid Bridge: RCON + WebSocket plugin communication
// Provides unified control surface for embodied bots (movement, actions, scanning)

import EventEmitter from "events";
import { Rcon } from "rcon-client";
import minecraftBridgeConfig from "./minecraft-bridge-config.js";
import { updateHeartbeatAge } from "./src/services/metrics.js";

const COMMAND_SANITIZER = /^(?:[a-zA-Z0-9:_\-\s\.\{\}\[\]\"]+|)$/;

/**
 * MinecraftBridge - Hybrid control interface for Minecraft bots
 *
 * Plugin Interface Contract:
 * If a pluginInterface is provided via setPluginInterface(), it should implement:
 *
 * - moveBot({ botId, position: {x, y, z} })
 * - scanArea({ botId, radius, center: {x, y, z} })
 * - dig({ botId, blockPosition: {x, y, z} })
 * - place({ botId, blockPosition: {x, y, z}, blockType: string })
 * - attack({ botId, target })
 * - useItem({ botId, itemName: string, target? })
 * - inventory({ botId })
 * - chat({ botId, message: string })
 * - jump({ botId })
 *
 * All methods fall back to RCON commands if plugin methods are unavailable.
 *
 * Events emitted:
 * - connected, disconnected, error
 * - botMoved, scanResult, blockDug, blockPlaced, attackPerformed
 * - itemUsed, inventoryQueried, chatSent, jumpPerformed
 */
export class MinecraftBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = { ...minecraftBridgeConfig, ...options };
    this.rcon = null;
    this.connected = false;
    this.pluginInterface = null;
    this.telemetryChannel = null;
    this.botPositions = new Map();
    this.currentPhase = 1; // Track current progression phase
    this.lastHeartbeatAt = null;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15000;
    this.pluginStatus = "unknown";
    this.blockSpawnsOnPluginError = options.blockSpawnsOnPluginError ?? true;
    this.pluginHeartbeatThreshold = options.pluginHeartbeatThreshold ?? 30;
    this.pendingSpawns = new Map();
    this.pendingActions = new Map();
  }

  #sanitizeCommand(command) {
    if (typeof command !== "string" || command.trim().length === 0) {
      throw new Error("Command must be a non-empty string");
    }
    const trimmed = command.trim();
    if (!COMMAND_SANITIZER.test(trimmed) || trimmed.includes(";;") || trimmed.includes("&&") || trimmed.includes("||")) {
      throw new Error("Unsafe characters detected in RCON command");
    }
    return trimmed;
  }

  async connect() {
    try {
      if (this.connected && this.rcon) return;

      this.rcon = await Rcon.connect({
        host: this.options.host,
        port: this.options.port,
        password: this.options.password,
      });

      this.connected = true;
      console.log("🟢 Bridge connected to Minecraft server");
      this.emit("connected");

      this.rcon.on("end", () => {
        this.connected = false;
        console.log("🔴 RCON connection closed");
        this.emit("disconnected");
      });

      this.rcon.on("error", (err) => {
        console.error("🔴 Bridge error:", err.message);
        this.connected = false;
        this.emit("error", err);
      });
    } catch (err) {
      console.error("❌ Minecraft bridge failed to connect:", err.message);
      this.connected = false;
      this.emit("error", err);
      throw err;
    }
  }

  isConnected() {
    return this.connected && Boolean(this.rcon);
  }

  async ensureConnected() {
    if (!this.isConnected()) {
      await this.connect();
    }
    return this.isConnected();
  }

  async sendCommand(command) {
    if (!this.connected || !this.rcon) await this.connect();
    try {
      const sanitized = this.#sanitizeCommand(command);
      const result = await this.rcon.send(sanitized);
      this.emit("commandSent", { command, result });
      return result;
    } catch (err) {
      console.error("🔴 RCON command failed:", err.message);
      this.emit("error", err);
      throw err;
    }
  }

  async dispatchTask(task) {
    try {
      if (typeof task === "string") return await this.sendCommand(task);
      if (task?.command) return await this.sendCommand(task.command);
      console.warn("⚠️ dispatchTask called with invalid task:", task);
      return null;
    } catch (err) {
      console.error("❌ dispatchTask failed:", err.message);
      throw err;
    }
  }

  /**
   * Explicit spawnBot contract for plugin or RCON fallback
   * @param {Object} payload
   * @param {string} payload.botId
   * @param {Object} payload.position
   * @param {string} payload.skin
   * @param {Object} payload.metadata
   */
  async spawnBot({ botId, position = null, skin = null, metadata = {} }) {
    const age = this.getHeartbeatAgeSeconds();
    if (this.blockSpawnsOnPluginError && this.pluginStatus === "error") {
      throw new Error("Plugin unhealthy: refusing new spawns");
    }

    // Prefer plugin interface
    if (this.pluginInterface?.spawnBot) {
      return this._spawnViaPlugin({ botId, position, skin, metadata });
    }

    // RCON fallback (legacy)
    try {
      const createCmd = `npc create ${botId} --type player`;
      await this.sendCommand(createCmd);
      const tpCmd = position
        ? `npc tp ${botId} ${position.x} ${position.y} ${position.z}`
        : `npc tp ${botId} <player>`;
      await this.sendCommand(tpCmd);
      console.log(`🤖 Spawned NPC '${botId}' via RCON`);
      this.emit("bot_spawned", { botId, position: position || null, transport: "rcon" });
      this.botPositions.set(botId, position || null);
      return { success: true, botId, position: position || null };
    } catch (err) {
      console.error("❌ Failed to spawn NPC:", err.message);
      this.emit("error", err);
      throw err;
    }
  }

  async _spawnViaPlugin({ botId, position, skin, metadata }) {
    const pending = new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingSpawns.delete(botId);
        resolve({ success: true, botId, position, pendingConfirmation: true });
      }, 8000);
      this.pendingSpawns.set(botId, { resolve, timer });
    });

    await this.pluginInterface.spawnBot({
      botId,
      position,
      skin,
      metadata,
    });

    return pending;
  }

  async despawnEntity({ npcId }) {
    try {
      const command = `npc remove ${npcId}`;
      const result = await this.sendCommand(command);
      console.log(`🗑️ Removed NPC: ${npcId}`);
      this.emit("npcRemoved", { npcId, result });
      this.botPositions.delete(npcId);
      return result;
    } catch (err) {
      console.error("❌ Failed to despawn NPC:", err.message);
      this.emit("error", err);
      throw err;
    }
  }

  setPluginInterface(pluginInterface) {
    this.pluginInterface = pluginInterface || null;
    if (this.pluginInterface) {
    this.on("plugin_bot_spawned", (msg) => this._onPluginBotSpawned(msg));
    this.on("plugin_action_complete", (msg) => this._onPluginActionComplete(msg));
    this.on("plugin_action_failed", (msg) => this._onPluginActionFailed(msg));
    this.on("plugin_inventory_snapshot", (msg) => this._onPluginInventorySnapshot(msg));
    this.on("plugin_chest_snapshot", (msg) => this._onPluginChestSnapshot(msg));
  }
  }

  setTelemetryChannel(channel) {
    this.telemetryChannel = channel || null;
  }

  _onPluginBotSpawned(msg = {}) {
    const botId = msg.botId;
    const position = msg.position || null;
    const uuid = msg.uuid || null;
    if (botId) {
      this.botPositions.set(botId, position);
    }
    const pending = this.pendingSpawns.get(botId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingSpawns.delete(botId);
      pending.resolve({ success: true, botId, position, uuid, confirmed: true });
    }
    const payload = { botId, position, uuid, transport: "plugin" };
    this.emit("bot_spawned", payload);
    this._broadcastTelemetry("bot:spawned", payload);
  }

  _broadcastTelemetry(event, payload) {
    if (!this.telemetryChannel) return;
    if (typeof this.telemetryChannel === "function") {
      this.telemetryChannel(event, payload);
    } else if (typeof this.telemetryChannel.emit === "function") {
      this.telemetryChannel.emit(event, payload);
    }
  }

  async dispatchAction(plan) {
    const { action, botId } = plan || {};
    if (this.blockSpawnsOnPluginError && this.pluginStatus === "error") {
      throw new Error("Plugin unhealthy: refusing actions");
    }

    const payload = {
      type: "action",
      action,
      botId,
      target: plan.target || plan.item || plan.block || null,
      pos: plan.position || plan.pos || null,
      metadata: plan,
      food: plan.food || null,
      chestPos: plan.chestPos || plan.position || null,
      items: plan.items || null,
      fromSlot: plan.fromSlot,
      toSlot: plan.toSlot,
      count: plan.count,
    };

    const pending = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingActions.delete(`${botId}:${action}`);
        reject(new Error("Action confirmation timeout"));
      }, 12000);
      this.pendingActions.set(`${botId}:${action}`, { resolve, reject, timer });
    });

    if (this.pluginInterface?.dispatchAction) {
      await this.pluginInterface.dispatchAction(payload);
    } else if (this.pluginInterface?.socket) {
      this.pluginInterface.socket.emit("plugin_action", payload);
    } else {
      this.emit("bot_action_dispatched", payload);
    }

    return pending;
  }

  /**
   * Navigate bot toward a position (plugin-based smooth nav)
   * @param {string} botId
   * @param {{x:number,y:number,z:number}} position
   * @param {number} tolerance
   */
  async navigateTo(botId, position, tolerance = 2) {
    if (!botId || !position) throw new Error("navigateTo requires botId and position");
    if (this.pluginInterface?.socket) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("navigate timeout")), 8000);
        this.pluginInterface.socket.once(`navigate_response_${botId}`, (resp) => {
          clearTimeout(timer);
          if (resp?.success) resolve(true);
          else reject(new Error(resp?.error || "navigate failed"));
        });
        this.pluginInterface.socket.emit("navigateTo", { botId, position, tolerance });
      });
    }
    // Fallback: direct move
    await this.moveBot(botId, 0, 0, 0, { nextPosition: position });
    return true;
  }

  _onPluginActionComplete(msg = {}) {
    const botId = msg.botId;
    const action = msg.action || msg.type;
    const key = `${botId}:${action}`;
    const pending = this.pendingActions.get(key);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingActions.delete(key);
      pending.resolve({ success: true, botId, action, hunger: msg.hunger, snapshot: msg.snapshot });
    }
    const payload = { botId, action, hunger: msg.hunger, timestamp: Date.now(), snapshot: msg.snapshot };
    this.emit("bot_action_complete", payload);
    this._broadcastTelemetry("bot:actionComplete", payload);
    if (typeof msg.hunger === "number") {
      this._broadcastTelemetry("bot:hunger-update", { botId, hunger: msg.hunger, timestamp: payload.timestamp });
    }
    if (msg.snapshot) {
      this._onPluginInventorySnapshot(msg.snapshot);
    }
  }

  _onPluginActionFailed(msg = {}) {
    const botId = msg.botId;
    const action = msg.action || msg.type;
    const key = `${botId}:${action}`;
    const pending = this.pendingActions.get(key);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingActions.delete(key);
      pending.reject(new Error(msg.error || "Action failed"));
    }
    const payload = { botId, action, error: msg.error || "Action failed", hunger: msg.hunger, timestamp: Date.now() };
    this.emit("bot_action_failed", payload);
    this._broadcastTelemetry("bot:actionFailed", payload);
  }

  _onPluginInventorySnapshot(msg = {}) {
    const botId = msg.botId;
    const slots = msg.slots || [];
    if (!botId) return;
    const payload = { botId, slots, timestamp: Date.now() };
    this.emit("inventory_snapshot", payload);
    this._broadcastTelemetry("bot:inventory-update", payload);
  }

  _onPluginChestSnapshot(msg = {}) {
    const botId = msg.botId;
    if (!botId) return;
    const payload = {
      botId,
      chestPos: msg.chestPos || msg.position || null,
      slots: msg.slots || [],
      timestamp: Date.now(),
    };
    this.emit("chest_snapshot", payload);
    this._broadcastTelemetry("bot:chest-update", payload);
  }

  recordHeartbeat(source = "plugin") {
    this.lastHeartbeatAt = Date.now();
    const ageSeconds = 0;
    updateHeartbeatAge(ageSeconds);
    this.pluginStatus = "ok";
    this.emit("heartbeat", { source, timestamp: this.lastHeartbeatAt });
  }

  getHeartbeatAgeSeconds() {
    if (!this.lastHeartbeatAt) {
      return null;
    }
    const age = Math.max(0, (Date.now() - this.lastHeartbeatAt) / 1000);
    updateHeartbeatAge(age);
    if (age > this.pluginHeartbeatThreshold) {
      if (this.pluginStatus !== "error") {
        this.pluginStatus = "error";
        this.emit("plugin_unhealthy", { ageSeconds: age });
        this._broadcastTelemetry("system:warning", {
          source: "minecraft_bridge",
          message: "Plugin heartbeat stale",
          ageSeconds: age,
        });
        this._broadcastTelemetry("system:log", {
          level: "warn",
          source: "minecraft_bridge",
          message: "Plugin heartbeat stale",
          ageSeconds: age,
          timestamp: Date.now(),
        });
      }
    } else {
      this.pluginStatus = "ok";
    }
    return age;
  }

  /**
   * Lightweight connection summary for health checks
   */
  checkConnection() {
    const heartbeatAgeSeconds = this.getHeartbeatAgeSeconds();
    return {
      rconConnected: this.isConnected(),
      pluginConnected: heartbeatAgeSeconds !== null && heartbeatAgeSeconds < 30,
      pluginHeartbeatAgeSeconds: heartbeatAgeSeconds,
      pluginStatus: heartbeatAgeSeconds !== null && heartbeatAgeSeconds < 30 ? "ok" : "error",
      lastHeartbeatAt: this.lastHeartbeatAt || null,
    };
  }

  async moveBot(bot, dx = 0, dy = 0, dz = 0, options = {}) {
    const botId = typeof bot === "string" ? bot : bot?.id;
    if (!botId) {
      throw new Error("moveBot requires a bot id or bot object with id");
    }

    const current = options.currentPosition ||
      (typeof bot === "object" && bot?.runtime?.position) ||
      this.botPositions.get(botId) || { x: 0, y: 0, z: 0 };

    const nextPosition = options.nextPosition || {
      x: current.x + dx,
      y: current.y + dy,
      z: current.z + dz
    };

    try {
      if (this.pluginInterface?.moveBot) {
        await this.pluginInterface.moveBot({ botId, position: nextPosition });
      } else {
        await this.ensureConnected();
        const { x, y, z } = nextPosition;
        const command = `tp ${botId} ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`;
        await this.sendCommand(command);
      }

      this.botPositions.set(botId, { ...nextPosition });
      const payload = { botId, position: { ...nextPosition }, timestamp: Date.now() };
      this.emit("botMoved", payload);
      this.#emitTelemetry("botMoved", payload);
      return nextPosition;
    } catch (err) {
      console.error(`❌ Failed to move bot ${botId}:`, err.message);
      this.emit("error", err);
      throw err;
    }
  }

  async scanArea(bot, radius = 5) {
    const botId = typeof bot === "string" ? bot : bot?.id;
    if (!botId) {
      throw new Error("scanArea requires a bot id or bot object with id");
    }

    const center =
      (typeof bot === "object" && bot?.runtime?.position) ||
      this.botPositions.get(botId) ||
      { x: 0, y: 0, z: 0 };

    try {
      let result = null;
      if (this.pluginInterface?.scanArea) {
        result = await this.pluginInterface.scanArea({ botId, radius, center });
      } else {
        result = {
          center,
          radius,
          blocks: [],
          entities: [],
          note: "Proxy plugin not connected"
        };
      }

      const payload = {
        botId,
        radius,
        center,
        result,
        timestamp: Date.now()
      };

      this.emit("scanResult", payload);
      this.#emitTelemetry("scanResult", payload);
      return result;
    } catch (err) {
      console.error(`❌ scanArea failed for ${botId}:`, err.message);
      this.emit("error", err);
      throw err;
    }
  }

  async dig(bot, blockPosition) {
    const botId = typeof bot === "string" ? bot : bot?.id;
    if (!botId) {
      throw new Error("dig requires a bot id or bot object with id");
    }
    if (!blockPosition || typeof blockPosition.x !== "number") {
      throw new Error("dig requires a valid blockPosition {x, y, z}");
    }

    try {
      if (this.pluginInterface?.dig) {
        const result = await this.pluginInterface.dig({ botId, blockPosition });
        const payload = { botId, blockPosition, result, timestamp: Date.now() };
        this.emit("blockDug", payload);
        this.#emitTelemetry("blockDug", payload);
        return result;
      } else {
        await this.ensureConnected();
        const { x, y, z } = blockPosition;
        const command = `setblock ${x} ${y} ${z} air`;
        const result = await this.sendCommand(command);
        const payload = { botId, blockPosition, result, timestamp: Date.now() };
        this.emit("blockDug", payload);
        this.#emitTelemetry("blockDug", payload);
        return { success: true, fallback: "rcon", result };
      }
    } catch (err) {
      console.error(`❌ dig failed for ${botId}:`, err.message);
      this.emit("error", err);
      throw err;
    }
  }

  async place(bot, blockPosition, blockType = "stone") {
    const botId = typeof bot === "string" ? bot : bot?.id;
    if (!botId) {
      throw new Error("place requires a bot id or bot object with id");
    }
    if (!blockPosition || typeof blockPosition.x !== "number") {
      throw new Error("place requires a valid blockPosition {x, y, z}");
    }

    try {
      if (this.pluginInterface?.place) {
        const result = await this.pluginInterface.place({ botId, blockPosition, blockType });
        const payload = { botId, blockPosition, blockType, result, timestamp: Date.now() };
        this.emit("blockPlaced", payload);
        this.#emitTelemetry("blockPlaced", payload);
        return result;
      } else {
        await this.ensureConnected();
        const { x, y, z } = blockPosition;
        const command = `setblock ${x} ${y} ${z} ${blockType}`;
        const result = await this.sendCommand(command);
        const payload = { botId, blockPosition, blockType, result, timestamp: Date.now() };
        this.emit("blockPlaced", payload);
        this.#emitTelemetry("blockPlaced", payload);
        return { success: true, fallback: "rcon", result };
      }
    } catch (err) {
      console.error(`❌ place failed for ${botId}:`, err.message);
      this.emit("error", err);
      throw err;
    }
  }

  async attack(bot, target) {
    const botId = typeof bot === "string" ? bot : bot?.id;
    if (!botId) {
      throw new Error("attack requires a bot id or bot object with id");
    }
    if (!target) {
      throw new Error("attack requires a target (entity id or position)");
    }

    try {
      if (this.pluginInterface?.attack) {
        const result = await this.pluginInterface.attack({ botId, target });
        const payload = { botId, target, result, timestamp: Date.now() };
        this.emit("attackPerformed", payload);
        this.#emitTelemetry("attackPerformed", payload);
        return result;
      } else {
        await this.ensureConnected();
        const targetId = typeof target === "string" ? target : target?.id || target?.name;
        const command = `execute as ${botId} run damage ${targetId} 1`;
        const result = await this.sendCommand(command);
        const payload = { botId, target, result, timestamp: Date.now() };
        this.emit("attackPerformed", payload);
        this.#emitTelemetry("attackPerformed", payload);
        return { success: true, fallback: "rcon", result };
      }
    } catch (err) {
      console.error(`❌ attack failed for ${botId}:`, err.message);
      this.emit("error", err);
      throw err;
    }
  }

  async useItem(bot, itemName, target = null) {
    const botId = typeof bot === "string" ? bot : bot?.id;
    if (!botId) {
      throw new Error("useItem requires a bot id or bot object with id");
    }
    if (!itemName) {
      throw new Error("useItem requires an itemName");
    }

    try {
      if (this.pluginInterface?.useItem) {
        const result = await this.pluginInterface.useItem({ botId, itemName, target });
        const payload = { botId, itemName, target, result, timestamp: Date.now() };
        this.emit("itemUsed", payload);
        this.#emitTelemetry("itemUsed", payload);
        return result;
      } else {
        await this.ensureConnected();
        const command = target
          ? `execute as ${botId} run item replace entity @s weapon.mainhand with ${itemName}`
          : `give ${botId} ${itemName} 1`;
        const result = await this.sendCommand(command);
        const payload = { botId, itemName, target, result, timestamp: Date.now() };
        this.emit("itemUsed", payload);
        this.#emitTelemetry("itemUsed", payload);
        return { success: true, fallback: "rcon", result };
      }
    } catch (err) {
      console.error(`❌ useItem failed for ${botId}:`, err.message);
      this.emit("error", err);
      throw err;
    }
  }

  async inventory(bot) {
    const botId = typeof bot === "string" ? bot : bot?.id;
    if (!botId) {
      throw new Error("inventory requires a bot id or bot object with id");
    }

    try {
      if (this.pluginInterface?.inventory) {
        const result = await this.pluginInterface.inventory({ botId });
        const payload = { botId, result, timestamp: Date.now() };
        this.emit("inventoryQueried", payload);
        this.#emitTelemetry("inventoryQueried", payload);
        return result;
      } else {
        await this.ensureConnected();
        const command = `data get entity ${botId} Inventory`;
        const result = await this.sendCommand(command);
        const payload = { botId, result, timestamp: Date.now() };
        this.emit("inventoryQueried", payload);
        this.#emitTelemetry("inventoryQueried", payload);
        return {
          success: true,
          fallback: "rcon",
          items: [],
          note: "Inventory data requires plugin for full parsing",
          rawResult: result
        };
      }
    } catch (err) {
      console.error(`❌ inventory failed for ${botId}:`, err.message);
      this.emit("error", err);
      throw err;
    }
  }

  async chat(bot, message) {
    const botId = typeof bot === "string" ? bot : bot?.id;
    if (!botId) {
      throw new Error("chat requires a bot id or bot object with id");
    }
    if (!message) {
      throw new Error("chat requires a message string");
    }

    try {
      if (this.pluginInterface?.chat) {
        const result = await this.pluginInterface.chat({ botId, message });
        const payload = { botId, message, result, timestamp: Date.now() };
        this.emit("chatSent", payload);
        this.#emitTelemetry("chatSent", payload);
        return result;
      } else {
        await this.ensureConnected();
        const sanitized = message.replace(/"/g, '\\"');
        const command = `tellraw @a {"text":"<${botId}> ${sanitized}"}`;
        const result = await this.sendCommand(command);
        const payload = { botId, message, result, timestamp: Date.now() };
        this.emit("chatSent", payload);
        this.#emitTelemetry("chatSent", payload);
        return { success: true, fallback: "rcon", result };
      }
    } catch (err) {
      console.error(`❌ chat failed for ${botId}:`, err.message);
      this.emit("error", err);
      throw err;
    }
  }

  async jump(bot) {
    const botId = typeof bot === "string" ? bot : bot?.id;
    if (!botId) {
      throw new Error("jump requires a bot id or bot object with id");
    }

    try {
      if (this.pluginInterface?.jump) {
        const result = await this.pluginInterface.jump({ botId });
        const payload = { botId, result, timestamp: Date.now() };
        this.emit("jumpPerformed", payload);
        this.#emitTelemetry("jumpPerformed", payload);
        return result;
      } else {
        await this.ensureConnected();
        const current =
          (typeof bot === "object" && bot?.runtime?.position) ||
          this.botPositions.get(botId) ||
          { x: 0, y: 0, z: 0 };
        const jumpHeight = 1.2;
        const command = `tp ${botId} ${current.x} ${current.y + jumpHeight} ${current.z}`;
        const result = await this.sendCommand(command);
        const payload = { botId, result, timestamp: Date.now() };
        this.emit("jumpPerformed", payload);
        this.#emitTelemetry("jumpPerformed", payload);
        return { success: true, fallback: "rcon", result };
      }
    } catch (err) {
      console.error(`❌ jump failed for ${botId}:`, err.message);
      this.emit("error", err);
      throw err;
    }
  }

  #emitTelemetry(event, payload) {
    if (!this.telemetryChannel) return;
    if (typeof this.telemetryChannel === "function") {
      this.telemetryChannel(event, payload);
      return;
    }
    if (typeof this.telemetryChannel.emit === "function") {
      this.telemetryChannel.emit(event, payload);
    }
  }

  /**
   * Update current progression phase for context-aware operations
   * @param {number} phase - Current phase number (1-6)
   */
  setPhase(phase) {
    if (typeof phase === "number" && phase >= 1 && phase <= 6) {
      this.currentPhase = phase;
      console.log(`🎮 [MinecraftBridge] Phase updated to ${phase}`);
      this.#emitTelemetry("phaseUpdate", { phase, timestamp: Date.now() });
    }
  }

  /**
   * Get current progression phase
   * @returns {number} Current phase number
   */
  getPhase() {
    return this.currentPhase;
  }

  /**
   * Emit progression-related telemetry
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  emitProgressionEvent(event, data) {
    this.#emitTelemetry(`progression:${event}`, {
      ...data,
      phase: this.currentPhase,
      timestamp: Date.now()
    });
  }
}

export default MinecraftBridge;
