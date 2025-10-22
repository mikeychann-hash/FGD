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
    return this.client;
  }

  handleDisconnect() {
    this.connected = false;
    this.emit("disconnected");
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
    await this.ensureConnected();
    const response = await this.client.send(command);
    this.processRconFeedback(response);
    return response;
  }

  async sendRawCommand(command) {
    return this.sendCommand(command);
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
      let match = line.match(/([A-Za-z0-9_:-]+)\s+(?:hit|struck|shot)\s+([A-Za-z0-9_:-]+)\s+for\s+([0-9.]+)\s+damage(?:.*?health\s*(?:is\s*now|:)?\s*([0-9.]+)(?:\/([0-9.]+))?)?/i);
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
    });

    return events;
  }

  handleCombatEvent(event) {
    if (!event) {
      return;
    }

    const now = Date.now();
    const { source, target, health, maxHealth, damage } = event;

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
      }
      targetUpdates.lastEvent = { type: event.type, raw: event.raw, source, at: now };
      this.updateCombatant(target, targetUpdates);
    }

    if (source) {
      this.updateCombatant(source, {
        lastAction: { type: event.type, target, at: now },
        status: event.type === "defeated" && target === source ? "defeated" : undefined
      });
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
      this.emit("disconnected");
    }

    if (this.updateServer) {
      await this.stopUpdateServer();
    }
  }
}
