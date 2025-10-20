// bridges/minecraft_bridge.js
// Provides a transport layer between the NPCEngine and a Minecraft server via RCON.
// Behaviors such as jumping, swimming, or hazard avoidance must be implemented on this automation side.
// Supporting richer navigation context would require extending this bridge protocol to transmit additional environmental data.

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
    return this.client.send(command);
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
