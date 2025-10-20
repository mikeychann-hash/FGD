// integrations/mindcraft_ce_client.js
// Connects to a Mindcraft CE server event stream or falls back to the local runtime simulator

import EventEmitter from "events";

import { MindcraftCERuntime } from "./mindcraft_ce_runtime.js";

const DEFAULT_RECONNECT_DELAY = 5000;

let WebSocketModule = null;

async function loadWebSocket() {
  if (WebSocketModule) {
    return WebSocketModule;
  }

  try {
    const mod = await import("ws");
    WebSocketModule = mod.default || mod.WebSocket || mod;
    return WebSocketModule;
  } catch (err) {
    throw new Error("WebSocket module 'ws' is not available");
  }
}

export class MindcraftCEClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.url = options.url || process.env.MINDCRAFT_CE_EVENTS_URL || null;
    this.headers = options.headers || {};
    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectDelay = options.reconnectDelay || DEFAULT_RECONNECT_DELAY;
    this.socket = null;
    this.connected = false;
    this.shouldReconnect = false;
    this.observedEnvelopes = new Map();
    this.runtime = null;
    this.runtimeListeners = [];

    if (options.runtimeFallback) {
      this.useRuntime(options.runtimeFallback);
    }

    if (this.url && options.autoConnect !== false) {
      this.connect().catch(err => {
        console.error("❌ Mindcraft CE client failed to connect:", err.message);
      });
    }
  }

  useRuntime(runtime) {
    if (!runtime) return;
    if (this.runtime === runtime) return;

    this.detachRuntime();
    this.runtime = runtime;

    if (typeof runtime.on === "function") {
      const eventHandler = event => this.emit("event", this.enrichEvent(event));
      const planHandler = plan => this.emit("plan", this.decoratePlan(plan));

      runtime.on("event", eventHandler);
      runtime.on("plan", planHandler);

      this.runtimeListeners = [
        { event: "event", handler: eventHandler },
        { event: "plan", handler: planHandler }
      ];
    }
  }

  detachRuntime() {
    if (!this.runtime) return;

    this.runtimeListeners.forEach(({ event, handler }) => {
      if (typeof this.runtime.off === "function") {
        this.runtime.off(event, handler);
      } else if (typeof this.runtime.removeListener === "function") {
        this.runtime.removeListener(event, handler);
      }
    });

    this.runtimeListeners = [];
  }

  getRuntime() {
    return this.runtime;
  }

  canSimulate() {
    return Boolean(this.runtime?.execute);
  }

  async simulateEnvelope(envelope) {
    if (!this.canSimulate()) {
      return null;
    }

    return this.runtime.execute(envelope);
  }

  observeEnvelope(envelope) {
    if (!envelope) return null;
    const id = envelope.id || `${envelope.npc || "npc"}:${envelope.issuedAt || Date.now()}`;
    this.observedEnvelopes.set(id, {
      npcId: envelope.npc || envelope.npcId || null,
      envelope
    });
    return id;
  }

  async connect() {
    if (!this.url) {
      return null;
    }

    if (this.socket && this.connected) {
      return this.socket;
    }

    let WebSocket;
    try {
      WebSocket = await loadWebSocket();
    } catch (err) {
      console.warn("⚠️ Mindcraft CE client cannot establish an event stream without the 'ws' module.");
      return null;
    }

    this.shouldReconnect = this.autoReconnect;

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url, { headers: this.headers });
      this.socket = socket;

      const cleanup = () => {
        if (typeof socket.off === "function") {
          socket.off("open", handleOpen);
          socket.off("message", handleMessage);
          socket.off("close", handleClose);
          socket.off("error", handleError);
        } else if (typeof socket.removeListener === "function") {
          socket.removeListener("open", handleOpen);
          socket.removeListener("message", handleMessage);
          socket.removeListener("close", handleClose);
          socket.removeListener("error", handleError);
        }
      };

      const handleOpen = () => {
        this.connected = true;
        this.emit("connected");
        resolve(socket);
      };

      const handleMessage = message => {
        this.processMessage(message?.data ?? message);
      };

      const handleClose = () => {
        cleanup();
        this.connected = false;
        this.emit("disconnected");
        if (this.shouldReconnect && this.url) {
          setTimeout(() => this.connect().catch(() => {}), this.reconnectDelay);
        }
      };

      const handleError = err => {
        this.emit("error", err);
        cleanup();
        if (!this.connected) {
          reject(err);
        }
      };

      socket.on("open", handleOpen);
      socket.on("message", handleMessage);
      socket.on("close", handleClose);
      socket.on("error", handleError);
    });
  }

  close() {
    this.shouldReconnect = false;
    if (this.socket) {
      try {
        this.socket.close();
      } catch (err) {
        // Ignore close errors.
      }
      this.socket = null;
    }
    this.connected = false;
    this.detachRuntime();
  }

  processMessage(raw) {
    if (!raw) return;

    const chunks = this.extractChunks(raw);
    chunks.forEach(chunk => {
      try {
        const parsed = JSON.parse(chunk);
        this.dispatchParsedMessage(parsed);
      } catch (err) {
        // Ignore malformed chunks
      }
    });
  }

  extractChunks(raw) {
    if (typeof raw === "string") {
      return raw.split(/\r?\n/).map(entry => entry.trim()).filter(Boolean);
    }

    if (raw instanceof Buffer) {
      return this.extractChunks(raw.toString("utf8"));
    }

    if (Array.isArray(raw)) {
      return raw.flatMap(entry => this.extractChunks(entry));
    }

    return [];
  }

  dispatchParsedMessage(parsed) {
    if (!parsed || typeof parsed !== "object") {
      return;
    }

    if (Array.isArray(parsed.events)) {
      parsed.events.forEach(event => this.emit("event", this.enrichEvent(event)));
    }

    if (parsed.event) {
      this.emit("event", this.enrichEvent(parsed.event));
    }

    if (parsed.plan) {
      this.emit("plan", this.decoratePlan(parsed.plan));
    }

    if (parsed.type === "event" && !parsed.event) {
      this.emit("event", this.enrichEvent(parsed));
    }

    if (parsed.type === "plan" && !parsed.plan) {
      this.emit("plan", this.decoratePlan(parsed));
    }
  }

  decoratePlan(plan = {}) {
    if (!plan) return plan;
    const envelopeId = plan.envelopeId || plan.id;
    const observed = envelopeId ? this.observedEnvelopes.get(envelopeId) : null;
    if (observed && !plan.npcId) {
      plan = { ...plan, npcId: observed.npcId };
    }
    return plan;
  }

  enrichEvent(event = {}) {
    if (!event) return event;
    const envelopeId = event.envelopeId || event.taskId || event.id;
    const observed = envelopeId ? this.observedEnvelopes.get(envelopeId) : null;
    let enriched = { ...event };

    if (observed) {
      if (!enriched.npcId && observed.npcId) {
        enriched.npcId = observed.npcId;
      }
      enriched.envelopeId = envelopeId;
    }

    if (!enriched.npcId && enriched.npc) {
      enriched.npcId = enriched.npc;
    }

    if (enriched.type === "task_complete" || enriched.type === "task_cancelled") {
      if (envelopeId) {
        this.observedEnvelopes.delete(envelopeId);
      }
    }

    return enriched;
  }
}

export function createMindcraftCEClient(options = {}) {
  const { runtimeFallback, url } = options;

  if (!url && !runtimeFallback) {
    return new MindcraftCEClient({ runtimeFallback: new MindcraftCERuntime() });
  }

  return new MindcraftCEClient(options);
}
