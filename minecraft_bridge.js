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
      return result;
    } catch (err) {
      console.error("❌ Failed to despawn NPC:", err.message);
      this.emit("error", err);
      throw err;
    }
  }
}

export default MinecraftBridge;
