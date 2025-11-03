// minecraft_bridge.js
// Citizens NPC Integration - Spawns at player and supports legacy dispatchTask

import EventEmitter from "events";
import { Rcon } from "rcon-client";
import minecraftBridgeConfig from "./minecraft-bridge-config.js";

export class MinecraftBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = { ...minecraftBridgeConfig, ...options };
    this.rcon = null;
    this.connected = false;
    this.pluginInterface = null;
    this.telemetryChannel = null;
    this.botPositions = new Map();
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
      const result = await this.rcon.send(command);
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

  async spawnEntity({ npcId }) {
    try {
      const createCmd = `npc create ${npcId} --type player`;
      await this.sendCommand(createCmd);
      const tpCmd = `npc tp ${npcId} <player>`;
      await this.sendCommand(tpCmd);
      console.log(`🤖 Spawned NPC '${npcId}' at player location`);
      this.emit("npcSpawned", { npcId });
      this.botPositions.set(npcId, null);
      return { success: true, npcId };
    } catch (err) {
      console.error("❌ Failed to spawn NPC:", err.message);
      this.emit("error", err);
      throw err;
    }
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
  }

  setTelemetryChannel(channel) {
    this.telemetryChannel = channel || null;
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
}

export default MinecraftBridge;
