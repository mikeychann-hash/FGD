// bridges/minecraft_bridge.js
// Provides a transport layer between the NPCEngine and a Minecraft server via RCON

import EventEmitter from "events";
import { Rcon } from "rcon-client";

import { MindcraftCEAdapter } from "./mindcraft_ce_adapter.js";
import { MindcraftCEClient } from "./mindcraft_ce_client.js";

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
    this.runtimeHandlers = [];
    this.eventClientHandlers = [];
    this.runtime = options.runtime || options.mindcraftCE?.runtime || null;
    this.eventClient = options.eventClient || options.mindcraftCE?.eventClient || null;

    if (!this.commandBuilder && this.options.useMindcraftCE) {
      this.commandBuilder = new MindcraftCEAdapter(options.mindcraftCE || {});
    }

    if (!this.eventClient && this.options.useMindcraftCE) {
      const eventOptions = options.mindcraftCE?.events;
      if (eventOptions || this.runtime) {
        this.eventClient = new MindcraftCEClient({
          ...(eventOptions || {}),
          runtimeFallback: eventOptions?.runtimeFallback || this.runtime || null
        });
      }
    }

    if (this.eventClient && this.runtime && !this.eventClient.getRuntime?.()) {
      this.eventClient.useRuntime(this.runtime);
    }

    if (this.eventClient) {
      this.attachEventClient(this.eventClient);
      this.runtime = this.eventClient.getRuntime?.() || this.runtime;
    } else if (this.runtime) {
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

    if (this.runtime && this.runtimeHandlers.length) {
      this.detachRuntime();
    }

    this.runtime = runtime;

    if (typeof runtime.on === "function") {
      const eventHandler = event => this.emit("runtime_event", event);
      const planHandler = plan => this.emit("runtime_plan", plan);
      runtime.on("event", eventHandler);
      runtime.on("plan", planHandler);
      this.runtimeHandlers = [
        { event: "event", handler: eventHandler },
        { event: "plan", handler: planHandler }
      ];
    }
  }

  detachRuntime() {
    if (!this.runtime) return;

    this.runtimeHandlers.forEach(({ event, handler }) => {
      if (typeof this.runtime.off === "function") {
        this.runtime.off(event, handler);
      } else if (typeof this.runtime.removeListener === "function") {
        this.runtime.removeListener(event, handler);
      }
    });

    this.runtimeHandlers = [];
  }

  attachEventClient(client) {
    if (!client) return;

    if (this.eventClient && this.eventClientHandlers.length) {
      this.detachEventClient();
    }

    this.eventClient = client;

    if (typeof client.on === "function") {
      const eventHandler = event => this.emit("runtime_event", event);
      const planHandler = plan => this.emit("runtime_plan", plan);
      client.on("event", eventHandler);
      client.on("plan", planHandler);
      this.eventClientHandlers = [
        { event: "event", handler: eventHandler },
        { event: "plan", handler: planHandler }
      ];
    }
  }

  detachEventClient() {
    if (!this.eventClient) return;

    this.eventClientHandlers.forEach(({ event, handler }) => {
      if (typeof this.eventClient.off === "function") {
        this.eventClient.off(event, handler);
      } else if (typeof this.eventClient.removeListener === "function") {
        this.eventClient.removeListener(event, handler);
      }
    });

    this.eventClientHandlers = [];
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

    if (envelope && this.eventClient?.observeEnvelope) {
      this.eventClient.observeEnvelope(envelope);
    }

    if (envelope) {
      try {
        if (this.eventClient?.simulateEnvelope) {
          runtimeResult = await this.eventClient.simulateEnvelope(envelope);
        } else if (this.runtime?.execute) {
          runtimeResult = await this.runtime.execute(envelope);
        }
      } catch (err) {
        console.error("❌ Mindcraft CE runtime error:", err.message);
      }

      if (runtimeResult?.commandOverride) {
        command = runtimeResult.commandOverride;
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
