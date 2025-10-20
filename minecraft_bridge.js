// bridges/minecraft_bridge.js
// Provides a transport layer between the NPCEngine and a Minecraft server via RCON

import EventEmitter from "events";
import { Rcon } from "rcon-client";

import { MindcraftCEAdapter } from "./mindcraft_ce_adapter.js";

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
      useMindcraftCE: options.useMindcraftCE !== false
    };

    this.client = null;
    this.connected = false;
    this.commandBuilder = options.commandBuilder || null;
    this.runtime = options.runtime || options.mindcraftCE?.runtime || null;

    if (!this.commandBuilder && this.options.useMindcraftCE) {
      this.commandBuilder = new MindcraftCEAdapter(options.mindcraftCE || {});
    }

    if (this.runtime) {
      this.attachRuntime(this.runtime);
    }

    if (this.options.connectOnCreate) {
      this.connect().catch(err => {
        console.error("❌ Minecraft bridge failed to connect:", err.message);
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

  attachRuntime(runtime) {
    if (!runtime) return;

    this.runtime = runtime;

    if (typeof runtime.on === "function") {
      runtime.on("event", event => this.emit("runtime_event", event));
      runtime.on("plan", plan => this.emit("runtime_plan", plan));
    }
  }

  buildCommand(taskPayload, envelope = null) {
    if (this.commandBuilder?.buildCommand) {
      if (envelope && this.commandBuilder.buildCommandFromEnvelope) {
        return this.commandBuilder.buildCommandFromEnvelope(envelope);
      }
      return this.commandBuilder.buildCommand(taskPayload);
    }

    const serialized = JSON.stringify(taskPayload);
    return `${this.options.commandPrefix} ${serialized}`;
  }

  async dispatchTask(taskPayload) {
    let envelope = null;

    if (this.commandBuilder?.buildEnvelope) {
      envelope = this.commandBuilder.buildEnvelope(taskPayload);
    }

    let command = this.buildCommand(taskPayload, envelope);
    let runtimeResult = null;

    if (this.runtime?.execute && envelope) {
      try {
        runtimeResult = await this.runtime.execute(envelope);
        if (runtimeResult?.commandOverride) {
          command = runtimeResult.commandOverride;
        }
      } catch (err) {
        console.error("❌ Mindcraft CE runtime error:", err.message);
      }
    }

    let response = null;
    if (command && !runtimeResult?.simulateOnly) {
      response = await this.sendCommand(command);
      this.processServerResponse(response, envelope);
    }

    const payload = { task: taskPayload, command, response, envelope, runtime: runtimeResult };
    this.emit("task_dispatched", payload);
    return payload;
  }

  processServerResponse(response, envelope) {
    if (!response || typeof response !== "string") {
      return;
    }

    const trimmed = response.trim();
    if (!trimmed) {
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed?.events)) {
        parsed.events.forEach(event => {
          this.emit("runtime_event", {
            ...event,
            npcId: event?.npcId || envelope?.npc || null
          });
        });
      }
    } catch (err) {
      // Not JSON, ignore.
    }
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
  }
}
