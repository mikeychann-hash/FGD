// bridges/minecraft_bridge.js
// Provides a transport layer between the NPCEngine and a Minecraft server via RCON

import EventEmitter from "events";
import express from "express";
import { Rcon } from "rcon-client";

export class MinecraftBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      host: options.host || "127.0.0.1",
      port: options.port || 25575,
      password: options.password || "",
      timeout: options.timeout || 10000,
      commandPrefix: options.commandPrefix || "aicraft",
      connectOnCreate: options.connectOnCreate !== false,
      updatePort: options.updatePort || 3210,
      enableUpdateServer: options.enableUpdateServer !== false,
      maxCommandsPerSecond: options.maxCommandsPerSecond || 5,
      heartbeatInterval: options.heartbeatInterval || 30000,
      heartbeatCommand: options.heartbeatCommand || "/list",
      enableHeartbeat: options.enableHeartbeat !== false,
      snapshotInterval: options.snapshotInterval || 5000,
      enableSnapshots: options.enableSnapshots !== false,
      damageWindowMs: options.damageWindowMs || 10000,
      spawnEntityMapping: {
        default: "minecraft:villager",
        guard: "minecraft:iron_golem",
        miner: "minecraft:villager",
        builder: "minecraft:villager",
        fighter: "minecraft:iron_golem",
        ...options.spawnEntityMapping
      },
      spawnCommandFormatter: options.spawnCommandFormatter || null
    };

    this.client = null;
    this.connected = false;
    this.updateServer = null;
    this.combatState = new Map();
    this.commandQueue = [];
    this.commandInFlight = false;
    this.lastCommandAt = 0;
    this.commandSpacing = 1000 / Math.max(1, this.options.maxCommandsPerSecond || 5);
    this.queueTimer = null;
    this.heartbeatIntervalHandle = null;
    this.snapshotIntervalHandle = null;
    this.lastHeartbeat = 0;
    this.damageHistory = { dealt: new Map(), taken: new Map() };
    this.friendlyIds = new Set(
      Array.isArray(options.friendlyIds)
        ? options.friendlyIds.map(id => (typeof id === "string" ? id.toLowerCase() : id))
        : []
    );
    this.isFriendly = typeof options.isFriendly === "function"
      ? options.isFriendly
      : id => {
          if (!id || typeof id !== "string") {
            return false;
          }
          const normalized = id.toLowerCase();
          return this.friendlyIds.has(normalized) || normalized.startsWith("npc") || normalized.startsWith("ally");
        };

    if (this.options.connectOnCreate) {
      this.connect().catch(err => {
        console.error("❌ Minecraft bridge failed to connect:", err.message);
      });
    }

    if (this.options.enableUpdateServer) {
      this.startUpdateServer(this.options.updatePort).catch(err => {
        console.error("❌ Failed to start update server:", err.message);
      });
    }
  }

  async connect() {
    if (this.connected && this.client) return this.client;

    this.client = await Rcon.connect({
      host: this.options.host,
      port: this.options.port,
      password: this.options.password,
      timeout: this.options.timeout
    });

    this.connected = true;
    this.client.on("end", () => this.handleDisconnect());
    this.client.on("error", err => this.handleError(err));
    this.emit("connected");
    console.log(`🎮 Connected to Minecraft server at ${this.options.host}:${this.options.port}`);
    if (this.options.enableHeartbeat !== false) {
      this.startHeartbeat();
    }
    if (this.options.enableSnapshots !== false) {
      this.startSnapshotLoop();
    }
    return this.client;
  }

  handleDisconnect() {
    this.connected = false;
    this.emit("disconnected");
    this.stopHeartbeat();
    this.stopSnapshotLoop();
    this.clearCommandQueue(new Error("Minecraft bridge disconnected"));
  }

  handleError(err) {
    console.error("❌ Minecraft bridge error:", err.message);
    this.emit("error", err);
  }

  isConnected() {
    return this.connected;
  }

  async ensureConnected() {
    if (!this.connected || !this.client) {
      await this.connect();
    }
  }

  async sendCommand(command) {
    return this.enqueueCommand(command);
  }

  async sendRawCommand(command) {
    return this.enqueueCommand(command);
  }

  enqueueCommand(command) {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, resolve, reject });
      this.processCommandQueue();
    });
  }

  processCommandQueue() {
    if (this.commandInFlight || this.commandQueue.length === 0) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastCommandAt;
    const wait = Math.max(0, this.commandSpacing - elapsed);

    if (wait > 0) {
      if (this.queueTimer) {
        clearTimeout(this.queueTimer);
      }
      this.queueTimer = setTimeout(() => this.processCommandQueue(), wait);
      return;
    }

    const entry = this.commandQueue.shift();
    if (!entry) {
      return;
    }

    this.commandInFlight = true;
    this.ensureConnected()
      .then(() => this.client.send(entry.command))
      .then(response => {
        this.lastCommandAt = Date.now();
        this.lastHeartbeat = this.lastCommandAt;
        this.processRconFeedback(response);
        entry.resolve(response);
      })
      .catch(err => {
        entry.reject(err);
        this.handleError(err);
      })
      .finally(() => {
        this.commandInFlight = false;
        setImmediate(() => this.processCommandQueue());
      });
  }

  startHeartbeat() {
    if (this.heartbeatIntervalHandle) {
      return;
    }
    const interval = Math.max(5000, this.options.heartbeatInterval || 30000);
    this.heartbeatIntervalHandle = setInterval(() => this.sendHeartbeat(), interval);
    // Kick off initial heartbeat to confirm connection health.
    this.sendHeartbeat().catch(() => {
      /* handled in sendHeartbeat */
    });
  }

  async sendHeartbeat() {
    if (!this.connected) {
      return;
    }
    try {
      await this.enqueueCommand(this.options.heartbeatCommand || "/list");
      this.lastHeartbeat = Date.now();
    } catch (err) {
      console.warn("⚠️ Heartbeat failed, attempting reconnect:", err.message);
      this.connected = false;
      if (this.options.connectOnCreate !== false) {
        this.connect().catch(reconnectErr => {
          console.error("❌ Reconnect attempt failed:", reconnectErr.message);
        });
      }
    }
  }

  stopHeartbeat() {
    if (this.heartbeatIntervalHandle) {
      clearInterval(this.heartbeatIntervalHandle);
      this.heartbeatIntervalHandle = null;
    }
  }

  startSnapshotLoop() {
    if (this.snapshotIntervalHandle) {
      return;
    }
    const interval = Math.max(1000, this.options.snapshotInterval || 5000);
    this.snapshotIntervalHandle = setInterval(() => this.emitCombatSnapshot(), interval);
  }

  stopSnapshotLoop() {
    if (this.snapshotIntervalHandle) {
      clearInterval(this.snapshotIntervalHandle);
      this.snapshotIntervalHandle = null;
    }
  }

  emitCombatSnapshot() {
    if (this.options.enableSnapshots === false) {
      return;
    }
    const snapshot = this.getCombatSnapshot();
    if (!snapshot || Object.keys(snapshot).length === 0) {
      return;
    }
    this.emit("combat_snapshot", { at: Date.now(), state: snapshot });
  }

  clearCommandQueue(error = null) {
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
      this.queueTimer = null;
    }
    if (this.commandQueue.length === 0) {
      return;
    }
    while (this.commandQueue.length > 0) {
      const entry = this.commandQueue.shift();
      if (!entry) continue;
      if (error) {
        entry.reject(error);
      } else {
        entry.resolve(null);
      }
    }
    this.commandInFlight = false;
  }

  recordDamageMetric(map, entityId, amount, timestamp) {
    if (!entityId || !Number.isFinite(amount)) {
      return null;
    }
    const windowMs = this.options.damageWindowMs || 10000;
    const history = map.get(entityId) || [];
    history.push({ amount, at: timestamp });
    const cutoff = timestamp - windowMs;
    const filtered = history.filter(entry => entry.at >= cutoff);
    map.set(entityId, filtered);
    if (filtered.length === 0) {
      return null;
    }
    const totalDamage = filtered.reduce((sum, entry) => sum + entry.amount, 0);
    const duration = Math.max(1, timestamp - filtered[0].at);
    const dps = totalDamage / (duration / 1000);
    const average = totalDamage / filtered.length;
    return {
      dps: Number(dps.toFixed(2)),
      average: Number(average.toFixed(2)),
      samples: filtered.length
    };
  }

  buildCommand(taskPayload) {
    const serialized = JSON.stringify(taskPayload);
    return `${this.options.commandPrefix} ${serialized}`;
  }

  async dispatchTask(taskPayload) {
    const command = this.buildCommand(taskPayload);
    const response = await this.sendCommand(command);
    let parsedResponse = null;

    if (typeof response === "string") {
      try {
        parsedResponse = JSON.parse(response);
      } catch (err) {
        parsedResponse = null;
      }
    }

    const payload = { task: taskPayload, command, response, parsedResponse };
    this.emit("task_dispatched", payload);

    if (parsedResponse && typeof parsedResponse === "object") {
      this.emit("task_feedback", parsedResponse);
      const feedbackCandidate =
        parsedResponse.feedback ||
        parsedResponse.message ||
        parsedResponse.log ||
        parsedResponse.output;
      this.processRconFeedback(feedbackCandidate);
    }

    return response;
  }

  async spawnEntity({ npcId, npcType, position }) {
    await this.ensureConnected();
    const entityId = this.options.spawnEntityMapping?.[npcType] || this.options.spawnEntityMapping?.default || "minecraft:villager";

    let command;
    if (typeof this.options.spawnCommandFormatter === "function") {
      command = this.options.spawnCommandFormatter({ npcId, npcType, entityId, position });
    } else {
      const { x, y, z } = position || {};
      const px = Number.isFinite(x) ? x : 0;
      const py = Number.isFinite(y) ? y : 64;
      const pz = Number.isFinite(z) ? z : 0;
      command = `summon ${entityId} ${px} ${py} ${pz} {CustomName:'"${npcId}"',Tags:["AICRAFT_NPC"]}`;
    }

    const response = await this.sendRawCommand(command);
    this.emit("npc_spawned", { npcId, npcType, command, response });
    return response;
  }

  processRconFeedback(feedback) {
    if (!feedback) {
      return;
    }

    let text = "";
    if (Array.isArray(feedback)) {
      text = feedback.join("\n");
    } else if (typeof feedback === "string") {
      text = feedback;
    } else if (typeof feedback === "object") {
      const nested = feedback.feedback || feedback.message || feedback.log || feedback.output;
      if (typeof nested === "string") {
        text = nested;
      }
    }

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return;
    }

    const events = this.parseCombatFeedback(text);
    if (events.length === 0) {
      return;
    }

    events.forEach(event => this.handleCombatEvent(event));
    this.emit("combat_events", events);
  }

  parseCombatFeedback(text) {
    if (typeof text !== "string") {
      return [];
    }

    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const events = [];

    lines.forEach(line => {
      let match;

      match = line.match(/([A-Za-z0-9_:-]+)\s+landed\s+a\s+critical\s+hit\s+on\s+([A-Za-z0-9_:-]+)\s+for\s+([0-9.]+)\s+damage/i);
      if (match) {
        events.push({
          type: "attack",
          source: match[1],
          target: match[2],
          damage: Number.parseFloat(match[3]),
          critical: true,
          raw: line
        });
        return;
      }

      match = line.match(/([A-Za-z0-9_:-]+)\s+(?:hit|struck|shot)\s+([A-Za-z0-9_:-]+)\s+for\s+([0-9.]+)\s+damage(?:.*?health\s*(?:is\s*now|:)?\s*([0-9.]+)(?:\/([0-9.]+))?)?/i);
      if (match) {
        events.push({
          type: "attack",
          source: match[1],
          target: match[2],
          damage: Number.parseFloat(match[3]),
          health: match[4] ? Number.parseFloat(match[4]) : null,
          maxHealth: match[5] ? Number.parseFloat(match[5]) : null,
          raw: line
        });
        return;
      }

      match = line.match(/([A-Za-z0-9_:-]+)\s+dodged\s+([A-Za-z0-9_:-]+)'s\s+attack/i);
      if (match) {
        events.push({
          type: "dodge",
          target: match[1],
          source: match[2],
          raw: line
        });
        return;
      }

      match = line.match(/([A-Za-z0-9_:-]+)\s+blocked\s+([A-Za-z0-9_:-]+)'s\s+attack/i);
      if (match) {
        events.push({
          type: "block",
          target: match[1],
          source: match[2],
          raw: line
        });
        return;
      }

      match = line.match(/([A-Za-z0-9_:-]+)\s+parried\s+([A-Za-z0-9_:-]+)'s\s+attack/i);
      if (match) {
        events.push({
          type: "parry",
          target: match[1],
          source: match[2],
          raw: line
        });
        return;
      }

      match = line.match(/([A-Za-z0-9_:-]+)\s+took\s+([0-9.]+)\s+damage(?:.*?health\s*(?:is\s*now|:)?\s*([0-9.]+)(?:\/([0-9.]+))?)?/i);
      if (match) {
        events.push({
          type: "damage",
          target: match[1],
          damage: Number.parseFloat(match[2]),
          health: match[3] ? Number.parseFloat(match[3]) : null,
          maxHealth: match[4] ? Number.parseFloat(match[4]) : null,
          raw: line
        });
        return;
      }

      match = line.match(/([A-Za-z0-9_:-]+)\s+(?:hp|health)\s*(?:is|:|now)\s*([0-9.]+)(?:\/([0-9.]+))?/i);
      if (match) {
        events.push({
          type: "health",
          target: match[1],
          health: Number.parseFloat(match[2]),
          maxHealth: match[3] ? Number.parseFloat(match[3]) : null,
          raw: line
        });
        return;
      }

      match = line.match(/([A-Za-z0-9_:-]+)\s+defeated\s+([A-Za-z0-9_:-]+)/i);
      if (match) {
        events.push({
          type: "defeated",
          source: match[1],
          target: match[2],
          raw: line
        });
        return;
      }

      match = line.match(/([A-Za-z0-9_:-]+)\s+was\s+(?:slain|killed|defeated)(?:\s+by\s+([A-Za-z0-9_:-]+))?/i);
      if (match) {
        events.push({
          type: "defeated",
          target: match[1],
          source: match[2] || null,
          raw: line
        });
        return;
      }

      match = line.match(/([A-Za-z0-9_:-]+)\s+recovered\s+([0-9.]+)\s+health/i);
      if (match) {
        events.push({
          type: "heal",
          target: match[1],
          amount: Number.parseFloat(match[2]),
          raw: line
        });
        return;
      }

      match = line.match(/([A-Za-z0-9_:-]+)'s\s+([A-Za-z0-9_:-]+)\s+durability\s+(?:is\s+)?(?:now\s*)?(\d+)(?:\/(\d+))?/i);
      if (match) {
        events.push({
          type: "durability",
          entity: match[1],
          item: match[2],
          current: match[3] ? Number.parseInt(match[3], 10) : null,
          max: match[4] ? Number.parseInt(match[4], 10) : null,
          raw: line
        });
      }
    });

    return events;
  }

  handleCombatEvent(event) {
    if (!event) {
      return;
    }

    const now = Date.now();
    const { source, target, health, maxHealth, damage } = event;

    if (event.type === "durability") {
      if (event.entity && event.item) {
        const entityId = event.entity;
        const existing = this.combatState.get(entityId)?.equipmentDurability || {};
        const updatedDurability = {
          ...existing,
          [event.item]: {
            current: event.current,
            max: event.max,
            updatedAt: now
          }
        };
        this.updateCombatant(entityId, { equipmentDurability: updatedDurability });
      }
      this.emit("durability_event", event);
      return;
    }

    if (target) {
      const targetUpdates = {};
      if (Number.isFinite(health)) {
        targetUpdates.health = health;
      } else if (Number.isFinite(damage)) {
        const previous = this.combatState.get(target);
        if (previous && Number.isFinite(previous.health)) {
          targetUpdates.health = Math.max(previous.health - damage, 0);
        }
      }
      if (Number.isFinite(maxHealth)) {
        targetUpdates.maxHealth = maxHealth;
      }
      if (event.type === "defeated") {
        targetUpdates.status = "defeated";
        targetUpdates.health = 0;
      }
      if (event.type === "heal") {
        const previous = this.combatState.get(target);
        const currentHealth = previous && Number.isFinite(previous.health) ? previous.health : 0;
        const max = previous && Number.isFinite(previous.maxHealth) ? previous.maxHealth : undefined;
        const healed = currentHealth + (event.amount || 0);
        targetUpdates.health = Number.isFinite(max) ? Math.min(healed, max) : healed;
      }
      if (!targetUpdates.status) {
        targetUpdates.status = targetUpdates.health === 0 ? "down" : "active";
      }
      if (Number.isFinite(damage)) {
        targetUpdates.lastDamage = { amount: damage, source, at: now };
        const takenMetrics = this.recordDamageMetric(this.damageHistory.taken, target, damage, now);
        if (takenMetrics) {
          targetUpdates.damageTakenPerSecond = takenMetrics.dps;
          targetUpdates.averageDamageTaken = takenMetrics.average;
          targetUpdates.damageSamples = takenMetrics.samples;
        }
      }
      if (event.type === "block") {
        targetUpdates.lastBlock = { source, at: now };
      }
      if (event.type === "parry") {
        targetUpdates.lastParry = { source, at: now };
      }
      if (event.type === "dodge") {
        targetUpdates.lastDodge = { source, at: now };
      }
      targetUpdates.lastEvent = { type: event.type, raw: event.raw, source, at: now };
      this.updateCombatant(target, targetUpdates);
    }

    if (source) {
      const sourceUpdates = {
        lastAction: { type: event.type, target, at: now },
        status: event.type === "defeated" && target === source ? "defeated" : undefined
      };
      if (event.type === "attack" && Number.isFinite(damage)) {
        const dealtMetrics = this.recordDamageMetric(this.damageHistory.dealt, source, damage, now);
        if (dealtMetrics) {
          sourceUpdates.damagePerSecond = dealtMetrics.dps;
          sourceUpdates.averageDamage = dealtMetrics.average;
          sourceUpdates.damageSamples = dealtMetrics.samples;
        }
        if (event.critical) {
          sourceUpdates.lastCritical = { target, amount: damage, at: now };
        }
      }
      if (event.type === "block" || event.type === "parry" || event.type === "dodge") {
        sourceUpdates.lastCounteredBy = target;
      }
      this.updateCombatant(source, sourceUpdates);
    }

    if (
      source &&
      target &&
      source !== target &&
      this.isFriendly(source) &&
      this.isFriendly(target)
    ) {
      this.emit("friendly_fire", { source, target, event, at: now });
    }

    this.emit("combat_event", event);
  }

  updateCombatant(entityId, updates = {}) {
    if (!entityId || !updates || typeof updates !== "object") {
      return;
    }

    const sanitizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (sanitizedEntries.length === 0) {
      return;
    }

    const sanitizedUpdates = Object.fromEntries(sanitizedEntries);
    const previous = this.combatState.get(entityId) || {};
    const next = {
      ...previous,
      ...sanitizedUpdates,
      lastUpdated: Date.now()
    };
    this.combatState.set(entityId, next);
    this.emit("combat_update", { entityId, state: next, updates: sanitizedUpdates });
  }

  getCombatState(entityId) {
    return entityId ? this.combatState.get(entityId) || null : null;
  }

  getCombatSnapshot() {
    return Object.fromEntries(this.combatState.entries());
  }

  async startUpdateServer(port = this.options.updatePort) {
    if (this.updateServer) return this.updateServer;

    const app = express();
    app.use(express.json());

    app.post("/npc/update", (req, res) => {
      const payload = req.body;
      if (!payload || typeof payload !== "object") {
        res.status(400).json({ status: "error", message: "Invalid payload" });
        return;
      }
      this.emit("npc_update", payload);
      if (payload.rconFeedback || payload.combatLog) {
        this.processRconFeedback(payload.rconFeedback || payload.combatLog);
      }
      res.json({ status: "ok" });
    });

    return new Promise((resolve, reject) => {
      const server = app
        .listen(port, () => {
          this.updateServer = server;
          console.log(`🌐 NPC update server listening on port ${port}`);
          resolve(server);
        })
        .on("error", err => {
          reject(err);
        });
    });
  }

  async stopUpdateServer() {
    if (!this.updateServer) return;

    await new Promise(resolve => this.updateServer.close(resolve));
    this.updateServer = null;
  }

  async disconnect() {
    if (!this.client) return;
    try {
      await this.client.end();
    } finally {
      this.client = null;
      this.connected = false;
      this.stopHeartbeat();
      this.stopSnapshotLoop();
      this.clearCommandQueue(new Error("Minecraft bridge disconnected"));
      this.emit("disconnected");
    }

    if (this.updateServer) {
      await this.stopUpdateServer();
    }
  }
}
