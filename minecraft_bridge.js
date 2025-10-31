// bridges/minecraft_bridge.js
// Provides a transport layer between the NPCEngine and a Minecraft server via RCON

import EventEmitter from "events";
import { promises as fs } from "fs";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { Rcon } from "rcon-client";

/**
 * MinecraftBridge - Manages RCON connection to Minecraft server with combat tracking
 * @class
 * @extends EventEmitter
 */
export class MinecraftBridge extends EventEmitter {
  // Constants
  static DEDUP_WINDOW_MS = 2000;
  static DEFAULT_COMMAND_TIMEOUT_MS = 10000;
  static MIN_HEARTBEAT_INTERVAL_MS = 5000;
  static MIN_SNAPSHOT_INTERVAL_MS = 1000;
  static MIN_CLEANUP_INTERVAL_MS = 1000;
  static MIN_PERSISTENCE_INTERVAL_MS = 5000;
  static MAX_RECONNECT_ATTEMPTS = 10;
  static WEBSOCKET_READY_STATE_OPEN = 1;

  // Combat event parsing patterns
  static COMBAT_PATTERNS = [
    {
      name: "critical_hit",
      regex: /([A-Za-z0-9_:-]+)\s+landed\s+a\s+critical\s+hit\s+on\s+([A-Za-z0-9_:-]+)\s+for\s+([0-9.]+)\s+damage/i,
      handler: match => ({
        type: "attack",
        source: match[1],
        target: match[2],
        damage: Number.parseFloat(match[3]),
        critical: true
      })
    },
    {
      name: "attack_with_health",
      regex: /([A-Za-z0-9_:-]+)\s+(?:hit|struck|shot)\s+([A-Za-z0-9_:-]+)\s+for\s+([0-9.]+)\s+damage(?:.*?health\s*(?:is\s*now|:)?\s*([0-9.]+)(?:\/([0-9.]+))?)?/i,
      handler: match => ({
        type: "attack",
        source: match[1],
        target: match[2],
        damage: Number.parseFloat(match[3]),
        health: match[4] ? Number.parseFloat(match[4]) : null,
        maxHealth: match[5] ? Number.parseFloat(match[5]) : null
      })
    },
    {
      name: "dodge",
      regex: /([A-Za-z0-9_:-]+)\s+dodged\s+([A-Za-z0-9_:-]+)'s\s+attack/i,
      handler: match => ({
        type: "dodge",
        target: match[1],
        source: match[2]
      })
    },
    {
      name: "block",
      regex: /([A-Za-z0-9_:-]+)\s+blocked\s+([A-Za-z0-9_:-]+)'s\s+attack/i,
      handler: match => ({
        type: "block",
        target: match[1],
        source: match[2]
      })
    },
    {
      name: "parry",
      regex: /([A-Za-z0-9_:-]+)\s+parried\s+([A-Za-z0-9_:-]+)'s\s+attack/i,
      handler: match => ({
        type: "parry",
        target: match[1],
        source: match[2]
      })
    },
    {
      name: "damage_taken",
      regex: /([A-Za-z0-9_:-]+)\s+took\s+([0-9.]+)\s+damage(?:.*?health\s*(?:is\s*now|:)?\s*([0-9.]+)(?:\/([0-9.]+))?)?/i,
      handler: match => ({
        type: "damage",
        target: match[1],
        damage: Number.parseFloat(match[2]),
        health: match[3] ? Number.parseFloat(match[3]) : null,
        maxHealth: match[4] ? Number.parseFloat(match[4]) : null
      })
    },
    {
      name: "health_status",
      regex: /([A-Za-z0-9_:-]+)\s+(?:hp|health)\s*(?:is|:|now)\s*([0-9.]+)(?:\/([0-9.]+))?/i,
      handler: match => ({
        type: "health",
        target: match[1],
        health: Number.parseFloat(match[2]),
        maxHealth: match[3] ? Number.parseFloat(match[3]) : null
      })
    },
    {
      name: "defeated_by",
      regex: /([A-Za-z0-9_:-]+)\s+defeated\s+([A-Za-z0-9_:-]+)/i,
      handler: match => ({
        type: "defeated",
        source: match[1],
        target: match[2]
      })
    },
    {
      name: "was_defeated",
      regex: /([A-Za-z0-9_:-]+)\s+was\s+(?:slain|killed|defeated)(?:\s+by\s+([A-Za-z0-9_:-]+))?/i,
      handler: match => ({
        type: "defeated",
        target: match[1],
        source: match[2] || null
      })
    },
    {
      name: "heal",
      regex: /([A-Za-z0-9_:-]+)\s+recovered\s+([0-9.]+)\s+health/i,
      handler: match => ({
        type: "heal",
        target: match[1],
        amount: Number.parseFloat(match[2])
      })
    },
    {
      name: "durability",
      regex: /([A-Za-z0-9_:-]+)'s\s+([A-Za-z0-9_:-]+)\s+durability\s+(?:is\s+)?(?:now\s*)?(\d+)(?:\/(\d+))?/i,
      handler: match => ({
        type: "durability",
        entity: match[1],
        item: match[2],
        current: match[3] ? Number.parseInt(match[3], 10) : null,
        max: match[4] ? Number.parseInt(match[4], 10) : null
      })
    }
  ];

const EQUIPMENT_SLOT_ALIASES = Object.freeze({
  head: "armor.head",
  helmet: "armor.head",
  hat: "armor.head",
  chest: "armor.chest",
  chestplate: "armor.chest",
  torso: "armor.chest",
  legs: "armor.legs",
  leggings: "armor.legs",
  pants: "armor.legs",
  feet: "armor.feet",
  boots: "armor.feet",
  shoes: "armor.feet",
  mainhand: "weapon.mainhand",
  hand: "weapon.mainhand",
  weapon: "weapon.mainhand",
  offhand: "weapon.offhand",
  shield: "weapon.offhand"
});

  /**
   * Creates a new MinecraftBridge instance
   * @param {Object} options - Configuration options
   * @param {string} [options.host='127.0.0.1'] - RCON server host
   * @param {number} [options.port=25575] - RCON server port
   * @param {string} [options.password=''] - RCON password
   * @param {number} [options.timeout=10000] - Connection timeout in ms
   * @param {string} [options.commandPrefix='aicraft'] - Command prefix for tasks
   * @param {boolean} [options.connectOnCreate=true] - Auto-connect on instantiation
   * @param {number} [options.updatePort=3210] - HTTP update server port
   * @param {boolean} [options.enableUpdateServer=true] - Enable HTTP update server
   * @param {number} [options.maxCommandsPerSecond=5] - Command rate limit
   * @param {number} [options.commandTimeout=10000] - Command timeout in ms
   * @param {number} [options.heartbeatInterval=30000] - Heartbeat interval in ms
   * @param {string} [options.heartbeatCommand='/list'] - Command to use for heartbeat
   * @param {boolean} [options.enableHeartbeat=true] - Enable heartbeat
   * @param {number} [options.snapshotInterval=5000] - Combat snapshot interval in ms
   * @param {boolean} [options.enableSnapshots=true] - Enable combat snapshots
   * @param {number} [options.damageWindowMs=10000] - Damage tracking window in ms
   * @param {number} [options.combatantTtl=300000] - Combatant TTL (5 min)
   * @param {number} [options.cleanupInterval=60000] - Cleanup interval in ms
   * @param {number} [options.reconnectBaseDelay=1000] - Base reconnect delay in ms
   * @param {number} [options.maxReconnectDelay=30000] - Max reconnect delay in ms
   * @param {number} [options.maxEventHistory=500] - Max events to keep in history
   * @param {number} [options.eventHistoryTtl=600000] - Event history TTL (10 min)
   * @param {string} [options.snapshotPersistencePath=null] - Path to persist snapshots
   * @param {number} [options.snapshotPersistenceInterval=60000] - Persistence interval
   * @param {string} [options.updateServerAuthToken=null] - Auth token for update server
   * @param {Object} [options.updateServerRateLimit] - Rate limit config
   * @param {Array<string>} [options.allowedOrigins=null] - CORS allowed origins
   * @param {string} [options.websocketPath='/bridge'] - WebSocket path
   * @param {boolean} [options.websocketCompression=true] - Enable WS compression
   * @param {boolean} [options.enableWebsocket=true] - Enable WebSocket server
   * @param {Object} [options.commandTemplates={}] - Command template functions
   * @param {Object} [options.spawnEntityMapping={}] - Entity type to Minecraft ID mapping
   * @param {Function} [options.spawnCommandFormatter=null] - Custom spawn command formatter
   * @param {Function} [options.appearanceFormatter=null] - Custom appearance command formatter
   * @param {number} [options.appearanceCommandDelay=200] - Delay (ms) before applying appearance commands
   * @param {Array<string>} [options.friendlyIds=[]] - List of friendly entity IDs
   * @param {Function} [options.isFriendly=null] - Custom friendly check function
   */
  constructor(options = {}) {
    super();

    this._initializeOptions(options);
    this._initializeState();
    this._initializeTemplates();
    this._initializeFriendlyCheck(options);
    this._autoStart();
  }

  /**
   * Initialize configuration options with defaults
   * @private
   */
  _initializeOptions(options) {
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
      commandTimeout: options.commandTimeout || MinecraftBridge.DEFAULT_COMMAND_TIMEOUT_MS,
      heartbeatInterval: options.heartbeatInterval || 30000,
      heartbeatCommand: options.heartbeatCommand || "/list",
      enableHeartbeat: options.enableHeartbeat !== false,
      snapshotInterval: options.snapshotInterval || 5000,
      enableSnapshots: options.enableSnapshots !== false,
      damageWindowMs: options.damageWindowMs || 10000,
      combatantTtl: options.combatantTtl || 5 * 60 * 1000,
      cleanupInterval: options.cleanupInterval || 60 * 1000,
      reconnectBaseDelay: options.reconnectBaseDelay || 1000,
      maxReconnectDelay: options.maxReconnectDelay || 30 * 1000,
      maxEventHistory: options.maxEventHistory || 500,
      eventHistoryTtl: options.eventHistoryTtl || 10 * 60 * 1000,
      snapshotPersistencePath: options.snapshotPersistencePath || null,
      snapshotPersistenceInterval: options.snapshotPersistenceInterval || 60 * 1000,
      updateServerAuthToken: options.updateServerAuthToken || null,
      updateServerRateLimit: options.updateServerRateLimit || { windowMs: 60 * 1000, max: 300 },
      allowedOrigins: options.allowedOrigins ?? null,
      websocketPath: options.websocketPath || "/bridge",
      websocketCompression: options.websocketCompression !== false,
      enableWebsocket: options.enableWebsocket !== false,
      commandTemplates: options.commandTemplates || {},
      spawnEntityMapping: {
        default: "minecraft:villager",
        guard: "minecraft:iron_golem",
        miner: "minecraft:villager",
        builder: "minecraft:villager",
        fighter: "minecraft:iron_golem",
        ...options.spawnEntityMapping
      },
      spawnCommandFormatter: options.spawnCommandFormatter || null,
      appearanceFormatter: options.appearanceFormatter || null,
      appearanceCommandDelay: typeof options.appearanceCommandDelay === "number" && options.appearanceCommandDelay >= 0
        ? options.appearanceCommandDelay
        : 200
    };
  }

  /**
   * Initialize instance state
   * @private
   */
  _initializeState() {
    // Connection state
    this.client = null;
    this.connected = false;
    this.manualDisconnect = false;
    this.connectPromise = null;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.lastHeartbeat = 0;

    // Server instances
    this.updateServer = null;
    this.websocketServer = null;

    // Combat state tracking
    this.combatState = new Map();
    this.combatStateMeta = new Map();
    this.damageHistory = { dealt: new Map(), taken: new Map() };

    // Event tracking
    this.eventHistory = [];
    this.eventDedup = new Map();

    // Command queue management
    this.commandQueue = [];
    this.commandInFlight = false;
    this.lastCommandAt = 0;
    this.commandSpacing = 1000 / Math.max(1, this.options.maxCommandsPerSecond || 5);
    this.queueTimer = null;

    // Interval handles
    this.heartbeatIntervalHandle = null;
    this.snapshotIntervalHandle = null;
    this.cleanupIntervalHandle = null;
    this.snapshotPersistenceHandle = null;

    // Template and subscription registries
    this.templateRegistry = new Map();
    this.subscriptionRegistry = new Map();
    this.subscriptionSeq = 0;

    // Metrics
    this.metrics = {
      commandsSent: 0,
      commandsFailed: 0,
      commandsTimedOut: 0,
      queueMax: 0,
      reconnectAttempts: 0,
      lastReconnectDelay: 0,
      lastReconnectAt: null
    };

    // Friendly IDs set
    this.friendlyIds = new Set(
      Array.isArray(this.options.friendlyIds)
        ? this.options.friendlyIds.map(id => this._sanitizeEntityId(id))
        : []
    );
  }

  /**
   * Initialize command templates from options
   * @private
   */
  _initializeTemplates() {
    Object.entries(this.options.commandTemplates || {}).forEach(([name, template]) => {
      if (typeof template === "function") {
        this.templateRegistry.set(name, template);
      }
    });
  }

  /**
   * Initialize friendly entity check function
   * @private
   */
  _initializeFriendlyCheck(options) {
    this.isFriendly = typeof options.isFriendly === "function"
      ? options.isFriendly
      : id => {
          if (!id || typeof id !== "string") {
            return false;
          }
          const normalized = this._sanitizeEntityId(id);
          return this.friendlyIds.has(normalized) ||
                 normalized.startsWith("npc") ||
                 normalized.startsWith("ally");
        };
  }

  /**
   * Auto-start connection, update server, and load persisted data
   * @private
   */
  _autoStart() {
    if (this.options.connectOnCreate) {
      this.connect().catch(err =>
        console.error("❌ Minecraft bridge failed to connect:", err.message)
      );
    }

    if (this.options.enableUpdateServer) {
      this.startUpdateServer(this.options.updatePort).catch(err =>
        console.error("❌ Failed to start update server:", err.message)
      );
    }

    if (this.options.snapshotPersistencePath) {
      this.loadCombatSnapshot().catch(err =>
        console.warn("⚠️ Failed to load combat snapshot:", err.message)
      );
    }

    this.startCleanupLoop();
  }

  /**
   * Sanitize entity ID to prevent injection attacks
   * @private
   * @param {string} id - Entity ID to sanitize
   * @returns {string} Sanitized entity ID
   */
  _sanitizeEntityId(id) {
    if (typeof id !== "string") {
      return String(id).toLowerCase();
    }
    // Remove potentially dangerous characters, allow alphanumeric, underscore, colon, dash
    return id.toLowerCase().replace(/[^a-z0-9_:-]/g, "");
  }

  /**
   * Connect to the Minecraft RCON server
   * @returns {Promise<Rcon>} RCON client instance
   */
  async connect() {
    if (this.connected && this.client) {
      return this.client;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    const attempt = this.reconnectAttempt + 1;
    this.reconnectAttempt = attempt;

    const connectPromise = Rcon.connect({
      host: this.options.host,
      port: this.options.port,
      password: this.options.password,
      timeout: this.options.timeout
    })
      .then(client => {
        this.client = client;
        this.connected = true;
        this.reconnectAttempt = 0;

        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        this.metrics.lastReconnectAt = Date.now();

        // Set up event handlers
        this.client.on("end", () => this.handleDisconnect());
        this.client.on("error", err => this.handleError(err));

        this.emit("connected");
        console.log(`🎮 Connected to Minecraft server at ${this.options.host}:${this.options.port}`);

        // Start periodic tasks
        if (this.options.enableHeartbeat !== false) {
          this.startHeartbeat();
        }
        if (this.options.enableSnapshots !== false) {
          this.startSnapshotLoop();
        }
        if (this.options.snapshotPersistencePath) {
          this.startSnapshotPersistence();
        }

        this.startCleanupLoop();

        return client;
      })
      .catch(err => {
        this.connected = false;
        this.client = null;
        this.scheduleReconnect();
        throw err;
      })
      .finally(() => {
        this.connectPromise = null;
      });

    this.connectPromise = connectPromise;
    return connectPromise;
  }

  /**
   * Handle disconnection from RCON server
   * @private
   */
  handleDisconnect() {
    this.connected = false;
    this.emit("disconnected");

    this.stopHeartbeat();
    this.stopSnapshotLoop();
    this.stopSnapshotPersistence();
    this.stopCleanupLoop();
    this.clearCommandQueue(new Error("Minecraft bridge disconnected"));

    if (this.manualDisconnect) {
      this.manualDisconnect = false;
    } else {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle RCON errors
   * @private
   * @param {Error} err - Error object
   */
  handleError(err) {
    console.error("❌ Minecraft bridge error:", err.message);
    this.emit("error", err);

    if (!this.connected) {
      this.scheduleReconnect();
    }
  }

  /**
   * Check if currently connected to RCON server
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Ensure connection is established, connect if needed
   * @returns {Promise<void>}
   */
  async ensureConnected() {
    if (!this.connected || !this.client) {
      await this.connect();
    }
  }

  /**
   * Send a command to the Minecraft server
   * @param {string} command - Command to send
   * @returns {Promise<string>} Server response
   */
  async sendCommand(command) {
    return this.enqueueCommand(command);
  }

  /**
   * Send a raw Minecraft command (alias for sendCommand)
   * @param {string} command - Raw command to send
   * @returns {Promise<string>} Server response
   */
  async sendRawCommand(command) {
    return this.enqueueCommand(command);
  }

  /**
   * Add command to the queue for processing
   * @private
   * @param {string} command - Command to enqueue
   * @returns {Promise<string>} Promise that resolves with command response
   */
  enqueueCommand(command) {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, resolve, reject });
      this.metrics.queueMax = Math.max(this.metrics.queueMax, this.commandQueue.length);
      this.processCommandQueue();
    });
  }

  /**
   * Process the command queue with rate limiting
   * @private
   */
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
    const timeoutMs = Math.max(1000, this.options.commandTimeout || MinecraftBridge.DEFAULT_COMMAND_TIMEOUT_MS);
    let timeoutHandle = null;

    this.ensureConnected()
      .then(() => {
        const sendPromise = this.client.send(entry.command);
        const timeoutPromise = new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => {
            this.metrics.commandsTimedOut += 1;
            reject(new Error(`Command timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });
        return Promise.race([sendPromise, timeoutPromise]);
      })
      .then(response => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        this.lastCommandAt = Date.now();
        this.lastHeartbeat = this.lastCommandAt;
        this.processRconFeedback(response);

        const validationError = this.validateCommandResult(response);
        if (validationError) {
          throw validationError;
        }

        this.metrics.commandsSent += 1;
        entry.resolve(response);
      })
      .catch(err => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        this.metrics.commandsFailed += 1;
        entry.reject(err);
        this.handleError(err);
      })
      .finally(() => {
        this.commandInFlight = false;
        // Use setTimeout with 0 delay instead of setImmediate for better performance
        setTimeout(() => this.processCommandQueue(), 0);
      });
  }

  /**
   * Start heartbeat interval to keep connection alive
   * @private
   */
  startHeartbeat() {
    if (this.heartbeatIntervalHandle) {
      return;
    }

    const interval = Math.max(
      MinecraftBridge.MIN_HEARTBEAT_INTERVAL_MS,
      this.options.heartbeatInterval || 30000
    );

    this.heartbeatIntervalHandle = setInterval(() => this.sendHeartbeat(), interval);

    // Send initial heartbeat to confirm connection health
    this.sendHeartbeat().catch(() => {
      // Error handled in sendHeartbeat
    });
  }

  /**
   * Send a heartbeat command to check connection health
   * @private
   */
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
      this.scheduleReconnect();

      if (this.options.connectOnCreate !== false) {
        this.connect().catch(reconnectErr => {
          console.error("❌ Reconnect attempt failed:", reconnectErr.message);
        });
      }
    }
  }

  /**
   * Stop heartbeat interval
   * @private
   */
  stopHeartbeat() {
    if (this.heartbeatIntervalHandle) {
      clearInterval(this.heartbeatIntervalHandle);
      this.heartbeatIntervalHandle = null;
    }
  }

  /**
   * Start periodic combat snapshot emissions
   * @private
   */
  startSnapshotLoop() {
    if (this.snapshotIntervalHandle) {
      return;
    }

    const interval = Math.max(
      MinecraftBridge.MIN_SNAPSHOT_INTERVAL_MS,
      this.options.snapshotInterval || 5000
    );

    this.snapshotIntervalHandle = setInterval(() => this.emitCombatSnapshot(), interval);
  }

  /**
   * Stop snapshot loop
   * @private
   */
  stopSnapshotLoop() {
    if (this.snapshotIntervalHandle) {
      clearInterval(this.snapshotIntervalHandle);
      this.snapshotIntervalHandle = null;
    }
  }

  /**
   * Start periodic snapshot persistence to disk
   * @private
   */
  startSnapshotPersistence() {
    if (!this.options.snapshotPersistencePath || this.snapshotPersistenceHandle) {
      return;
    }

    const interval = Math.max(
      MinecraftBridge.MIN_PERSISTENCE_INTERVAL_MS,
      this.options.snapshotPersistenceInterval || 60000
    );

    this.snapshotPersistenceHandle = setInterval(() => {
      this.saveCombatSnapshot().catch(err => {
        console.warn("⚠️ Failed to persist combat snapshot:", err.message);
      });
    }, interval);
  }

  /**
   * Stop snapshot persistence
   * @private
   */
  stopSnapshotPersistence() {
    if (this.snapshotPersistenceHandle) {
      clearInterval(this.snapshotPersistenceHandle);
      this.snapshotPersistenceHandle = null;
    }
  }

  /**
   * Save combat snapshot to file
   * @param {string} [filePath] - Path to save snapshot (defaults to configured path)
   * @returns {Promise<void>}
   */
  async saveCombatSnapshot(filePath = this.options.snapshotPersistencePath) {
    if (!filePath) {
      return;
    }

    const snapshot = this.getCombatSnapshot();
    const payload = {
      savedAt: new Date().toISOString(),
      snapshot
    };

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
  }

  /**
   * Load combat snapshot from file
   * @param {string} [filePath] - Path to load snapshot from (defaults to configured path)
   * @returns {Promise<Object|null>} Loaded snapshot or null
   */
  async loadCombatSnapshot(filePath = this.options.snapshotPersistencePath) {
    if (!filePath) {
      return null;
    }

    try {
      const contents = await fs.readFile(filePath, "utf-8");
      const payload = JSON.parse(contents);

      if (payload && payload.snapshot && typeof payload.snapshot === "object") {
        Object.entries(payload.snapshot).forEach(([entityId, state]) => {
          const sanitizedId = this._sanitizeEntityId(entityId);
          this.combatState.set(sanitizedId, state);
          this.combatStateMeta.set(sanitizedId, {
            lastUpdated: state.lastUpdated || Date.now()
          });
        });
        return payload.snapshot;
      }

      return null;
    } catch (err) {
      if (err.code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  /**
   * Emit current combat snapshot to listeners
   * @private
   */
  emitCombatSnapshot() {
    if (this.options.enableSnapshots === false) {
      return;
    }

    const snapshot = this.getCombatSnapshot();
    if (!snapshot || Object.keys(snapshot).length === 0) {
      return;
    }

    const payload = { at: Date.now(), state: snapshot };
    this.emit("combat_snapshot", payload);
    this.broadcastWebsocket({ type: "combat_snapshot", ...payload });
  }

  /**
   * Clear all queued commands
   * @private
   * @param {Error|null} error - Error to reject queued commands with
   */
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

  /**
   * Record damage metric for DPS calculation
   * @private
   * @param {Map} map - Damage history map (dealt or taken)
   * @param {string} entityId - Entity ID
   * @param {number} amount - Damage amount
   * @param {number} timestamp - Timestamp of damage event
   * @returns {Object|null} Calculated metrics or null
   */
  recordDamageMetric(map, entityId, amount, timestamp) {
    if (!entityId || !Number.isFinite(amount)) {
      return null;
    }

    const sanitizedId = this._sanitizeEntityId(entityId);
    const windowMs = this.options.damageWindowMs || 10000;
    const history = map.get(sanitizedId) || [];

    history.push({ amount, at: timestamp });

    const cutoff = timestamp - windowMs;
    const filtered = history.filter(entry => entry.at >= cutoff);

    if (filtered.length === 0) {
      map.delete(sanitizedId);
      return null;
    }

    map.set(sanitizedId, filtered);

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

  /**
   * Build a task command from payload
   * @param {Object} taskPayload - Task payload to serialize
   * @returns {string} Formatted command string
   */
  buildCommand(taskPayload) {
    const serialized = JSON.stringify(taskPayload);
    return `${this.options.commandPrefix} ${serialized}`;
  }

  /**
   * Dispatch a task to the Minecraft server
   * @param {Object} taskPayload - Task payload
   * @returns {Promise<string>} Server response
   */
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

  /**
   * Spawn an entity in the Minecraft world
   * @param {Object} params - Spawn parameters
   * @param {string} params.npcId - NPC identifier
   * @param {string} params.npcType - NPC type
   * @param {Object} params.position - Position {x, y, z}
   * @param {Object} [params.appearance] - Appearance configuration to apply post-spawn
   * @param {Object} [params.metadata] - Additional metadata about the NPC
   * @param {Object} [params.profile] - Profile context for the NPC
   * @returns {Promise<string>} Server response
   */
  async spawnEntity({ npcId, npcType, position, appearance, metadata, profile }) {
    await this.ensureConnected();

    const entityId = this.options.spawnEntityMapping?.[npcType] ||
                     this.options.spawnEntityMapping?.default ||
                     "minecraft:villager";

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

    let appearanceResponses = null;
    if (appearance && typeof appearance === "object" && Object.keys(appearance).length > 0) {
      appearanceResponses = await this.applyNpcAppearance({
        npcId,
        npcType,
        appearance,
        metadata,
        profile
      });
    }

    this.emit("npc_spawned", {
      npcId,
      npcType,
      position,
      command,
      response,
      appearance,
      metadata,
      profile,
      appearanceResponses
    });

    return response;
  }

  /**
   * Applies post-spawn appearance customizations for an NPC
   * @param {Object} params - Appearance parameters
   * @param {string} params.npcId - NPC identifier
   * @param {string} params.npcType - NPC type
   * @param {Object} params.appearance - Appearance definition
   * @param {Object} [params.metadata] - Additional NPC metadata
   * @param {Object} [params.profile] - Registry profile for additional context
   * @returns {Promise<Array<string>|null>} Responses from executed commands, if any
   */
  async applyNpcAppearance({ npcId, npcType, appearance, metadata, profile }) {
    if (!npcId || !appearance || typeof appearance !== "object") {
      return null;
    }

    const commands = [];

    if (typeof this.options.appearanceFormatter === "function") {
      try {
        const formatted = await this.options.appearanceFormatter({
          npcId,
          npcType,
          appearance,
          metadata,
          profile,
          bridge: this
        });

        if (Array.isArray(formatted)) {
          for (const command of formatted) {
            if (typeof command === "string" && command.trim().length > 0) {
              commands.push(command.trim());
            }
          }
        } else if (typeof formatted === "string" && formatted.trim().length > 0) {
          commands.push(formatted.trim());
        } else if (formatted && typeof formatted === "object" && Array.isArray(formatted.commands)) {
          for (const command of formatted.commands) {
            if (typeof command === "string" && command.trim().length > 0) {
              commands.push(command.trim());
            }
          }
        }
      } catch (error) {
        console.error(`❌ appearanceFormatter failed for ${npcId}:`, error.message);
      }
    }

    const fallbackCommands = this._buildAppearanceCommands({ npcId, appearance, metadata, profile });
    if (fallbackCommands.length > 0) {
      commands.push(...fallbackCommands);
    }

    if (commands.length === 0) {
      return null;
    }

    if (this.options.appearanceCommandDelay > 0) {
      await this._delay(this.options.appearanceCommandDelay);
    }

    const responses = [];
    for (const command of commands) {
      try {
        const response = await this.sendCommand(command);
        responses.push(response);
      } catch (error) {
        console.error(`❌ Failed to apply appearance command for ${npcId}:`, error.message);
      }
    }

    return responses;
  }

  _buildAppearanceCommands({ npcId, appearance }) {
    if (!appearance || typeof appearance !== "object") {
      return [];
    }

    const commandList = [];

    const manualCommands = Array.isArray(appearance.commands)
      ? appearance.commands
      : typeof appearance.command === "string"
        ? [appearance.command]
        : [];

    for (const command of manualCommands) {
      if (typeof command === "string" && command.trim().length > 0) {
        commandList.push(command.trim());
      }
    }

    if (appearance.equipment) {
      const equipment = appearance.equipment;

      if (Array.isArray(equipment)) {
        for (const entry of equipment) {
          if (Array.isArray(entry) && entry.length >= 2) {
            const [slotKey, itemDef] = entry;
            const command = this._formatEquipmentCommand(npcId, slotKey, itemDef);
            if (command) {
              commandList.push(command);
            }
            continue;
          }

          if (entry && typeof entry === "object") {
            const slotKey = entry.slot || entry.position || entry.type;
            const command = this._formatEquipmentCommand(npcId, slotKey, entry.item ?? entry.id ?? entry.name ?? entry);
            if (command) {
              commandList.push(command);
            }
          }
        }
      } else if (typeof equipment === "object") {
        for (const [slotKey, itemDef] of Object.entries(equipment)) {
          const command = this._formatEquipmentCommand(npcId, slotKey, itemDef);
          if (command) {
            commandList.push(command);
          }
        }
      }
    }

    if (Array.isArray(appearance.effects)) {
      for (const effect of appearance.effects) {
        if (!effect || typeof effect !== "object") {
          continue;
        }
        const effectId = effect.id || effect.effect || effect.type;
        if (!effectId) {
          continue;
        }

        const duration = Number.isFinite(effect.duration)
          ? Math.max(1, Math.floor(effect.duration))
          : 120;
        const amplifier = Number.isFinite(effect.amplifier)
          ? Math.max(0, Math.floor(effect.amplifier))
          : 0;
        const hideParticles = effect.showParticles === false;

        let command = `effect give ${npcId} ${this._normalizeNamespacedId(effectId, "minecraft")}`;
        command += ` ${duration}`;
        command += ` ${amplifier}`;
        if (hideParticles) {
          command += " true";
        }
        commandList.push(command);
      }
    }

    return commandList;
  }

  _formatEquipmentCommand(npcId, slotKey, itemDef) {
    if (!slotKey) {
      return null;
    }

    const normalizedSlotKey = typeof slotKey === "string" ? slotKey.toLowerCase() : "";
    const slot = EQUIPMENT_SLOT_ALIASES[normalizedSlotKey] || slotKey;
    if (typeof slot !== "string" || slot.length === 0) {
      return null;
    }

    let itemId = null;
    let count = 1;
    let nbt = null;

    if (typeof itemDef === "string") {
      itemId = itemDef;
    } else if (itemDef && typeof itemDef === "object") {
      itemId = itemDef.id || itemDef.item || itemDef.name || null;
      if (Number.isFinite(itemDef.count)) {
        count = Math.max(1, Math.min(64, Math.floor(itemDef.count)));
      }
      if (typeof itemDef.nbt === "string" && itemDef.nbt.trim().length > 0) {
        nbt = itemDef.nbt.trim();
      }
    } else {
      return null;
    }

    const namespacedId = this._normalizeNamespacedId(itemId, "minecraft");
    if (!namespacedId) {
      return null;
    }

    let command = `item replace entity ${npcId} ${slot} with ${namespacedId}`;
    if (Number.isFinite(count) && count > 1) {
      command += ` ${count}`;
    }
    if (nbt) {
      const formattedNbt = nbt.startsWith("{") ? nbt : `{${nbt}}`;
      command += ` ${formattedNbt}`;
    }
    return command;
  }

  _normalizeNamespacedId(id, namespace = "minecraft") {
    if (!id || typeof id !== "string") {
      return null;
    }
    const trimmed = id.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (trimmed.includes(":")) {
      return trimmed;
    }
    return `${namespace}:${trimmed}`;
  }

  async _delay(ms) {
    if (!Number.isFinite(ms) || ms <= 0) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Process RCON feedback for combat events
   * @param {string|Array|Object} feedback - Feedback from RCON
   */
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

    const uniqueEvents = events.filter(event => this.shouldProcessEvent(event));
    if (uniqueEvents.length === 0) {
      return;
    }

    uniqueEvents.forEach(event => this.handleCombatEvent(event));
    this.emit("combat_events", uniqueEvents);
    this.broadcastWebsocket({ type: "combat_events", events: uniqueEvents });
  }

  /**
   * Parse combat feedback text into structured events
   * @param {string} text - Feedback text to parse
   * @returns {Array<Object>} Array of parsed combat events
   */
  parseCombatFeedback(text) {
    if (typeof text !== "string") {
      return [];
    }

    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const events = [];

    lines.forEach(line => {
      for (const pattern of MinecraftBridge.COMBAT_PATTERNS) {
        try {
          const match = line.match(pattern.regex);
          if (match) {
            const event = pattern.handler(match);
            event.raw = line;
            events.push(event);
            return; // Stop checking patterns for this line
          }
        } catch (err) {
          console.warn(`⚠️ Failed to parse combat feedback line (${pattern.name}):`, line, err.message);
        }
      }
    });

    return events;
  }

  /**
   * Check if event should be processed (deduplication)
   * @private
   * @param {Object} event - Combat event to check
   * @returns {boolean} True if event should be processed
   */
  shouldProcessEvent(event) {
    if (!event) {
      return false;
    }

    const key = `${event.type}|${event.source || ""}|${event.target || ""}|${event.raw || ""}`;
    const now = Date.now();
    const lastSeen = this.eventDedup.get(key) || 0;

    this.eventDedup.set(key, now);

    if (lastSeen && now - lastSeen < MinecraftBridge.DEDUP_WINDOW_MS) {
      return false;
    }

    this.eventHistory.push({ at: now, event });

    if (this.eventHistory.length > this.options.maxEventHistory) {
      this.eventHistory.splice(0, this.eventHistory.length - this.options.maxEventHistory);
    }

    this.pruneEventHistory(now);
    this.notifySubscribers(event);

    return true;
  }

  /**
   * Prune old events from history
   * @private
   * @param {number} [now] - Current timestamp
   */
  pruneEventHistory(now = Date.now()) {
    const cutoff = now - this.options.eventHistoryTtl;

    while (this.eventHistory.length > 0 && this.eventHistory[0].at < cutoff) {
      this.eventHistory.shift();
    }

    // Collect keys to delete first, then delete to avoid modifying Map during iteration
    const keysToDelete = [];
    this.eventDedup.forEach((value, key) => {
      if (now - value > this.options.eventHistoryTtl) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.eventDedup.delete(key));
  }

  /**
   * Get event history, optionally filtered by timestamp
   * @param {Object} [options] - Filter options
   * @param {number} [options.since] - Only return events after this timestamp
   * @returns {Array<Object>} Array of events
   */
  getEventHistory({ since } = {}) {
    if (!since) {
      return this.eventHistory.map(entry => entry.event);
    }
    return this.eventHistory.filter(entry => entry.at >= since).map(entry => entry.event);
  }

  /**
   * Handle a combat event and update state
   * @private
   * @param {Object} event - Combat event to handle
   */
  handleCombatEvent(event) {
    if (!event) {
      return;
    }

    const now = Date.now();

    // Handle durability events
    if (event.type === "durability") {
      this._handleDurabilityEvent(event, now);
      return;
    }

    // Update target combatant
    if (event.target) {
      this._updateTargetCombatant(event, now);
    }

    // Update source combatant
    if (event.source) {
      this._updateSourceCombatant(event, now);
    }

    // Detect friendly fire
    if (
      event.source &&
      event.target &&
      event.source !== event.target &&
      this.isFriendly(event.source) &&
      this.isFriendly(event.target)
    ) {
      this.emit("friendly_fire", { source: event.source, target: event.target, event, at: now });
    }

    this.emit("combat_event", event);
  }

  /**
   * Handle durability event
   * @private
   */
  _handleDurabilityEvent(event, now) {
    if (event.entity && event.item) {
      const entityId = this._sanitizeEntityId(event.entity);
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
  }

  /**
   * Update target combatant state
   * @private
   */
  _updateTargetCombatant(event, now) {
    const { target, source, health, maxHealth, damage } = event;
    const targetUpdates = {};

    if (Number.isFinite(health)) {
      targetUpdates.health = health;
    } else if (Number.isFinite(damage)) {
      const previous = this.combatState.get(this._sanitizeEntityId(target));
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
      const sanitizedTarget = this._sanitizeEntityId(target);
      const previous = this.combatState.get(sanitizedTarget);
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

  /**
   * Update source combatant state
   * @private
   */
  _updateSourceCombatant(event, now) {
    const { source, target, damage } = event;
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

  /**
   * Update combatant state
   * @param {string} entityId - Entity ID to update
   * @param {Object} updates - State updates to apply
   */
  updateCombatant(entityId, updates = {}) {
    if (!entityId || !updates || typeof updates !== "object") {
      return;
    }

    const sanitizedId = this._sanitizeEntityId(entityId);
    const sanitizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);

    if (sanitizedEntries.length === 0) {
      return;
    }

    const sanitizedUpdates = Object.fromEntries(sanitizedEntries);
    const previous = this.combatState.get(sanitizedId) || {};
    const next = {
      ...previous,
      ...sanitizedUpdates,
      lastUpdated: Date.now()
    };

    this.combatState.set(sanitizedId, next);
    this.combatStateMeta.set(sanitizedId, { lastUpdated: next.lastUpdated });

    this.emit("combat_update", { entityId: sanitizedId, state: next, updates: sanitizedUpdates });
    this.broadcastWebsocket({ type: "combat_update", entityId: sanitizedId, state: next });
  }

  /**
   * Get combat state for a specific entity
   * @param {string} entityId - Entity ID
   * @returns {Object|null} Combat state or null
   */
  getCombatState(entityId) {
    return entityId ? this.combatState.get(this._sanitizeEntityId(entityId)) || null : null;
  }

  /**
   * Get full combat snapshot
   * @returns {Object} Combat state snapshot
   */
  getCombatSnapshot() {
    return Object.fromEntries(this.combatState.entries());
  }

  /**
   * Start periodic cleanup of stale data
   * @private
   */
  startCleanupLoop() {
    if (this.cleanupIntervalHandle) {
      return;
    }

    const interval = Math.max(
      MinecraftBridge.MIN_CLEANUP_INTERVAL_MS,
      this.options.cleanupInterval || 60000
    );

    this.cleanupIntervalHandle = setInterval(() => {
      try {
        this.pruneCombatState();
        this.pruneEventHistory();
      } catch (err) {
        console.warn("⚠️ Cleanup loop error:", err.message);
      }
    }, interval);
  }

  /**
   * Stop cleanup loop
   * @private
   */
  stopCleanupLoop() {
    if (this.cleanupIntervalHandle) {
      clearInterval(this.cleanupIntervalHandle);
      this.cleanupIntervalHandle = null;
    }
  }

  /**
   * Prune stale combatants from state
   * @private
   * @param {number} [now] - Current timestamp
   */
  pruneCombatState(now = Date.now()) {
    const ttl = this.options.combatantTtl;
    const staleIds = [];

    this.combatStateMeta.forEach((meta, entityId) => {
      if (!meta || !meta.lastUpdated) {
        staleIds.push(entityId);
        return;
      }
      if (now - meta.lastUpdated > ttl) {
        staleIds.push(entityId);
      }
    });

    staleIds.forEach(id => {
      this.combatState.delete(id);
      this.combatStateMeta.delete(id);
      this.damageHistory.dealt.delete(id);
      this.damageHistory.taken.delete(id);
    });
  }

  /**
   * Start HTTP update server for receiving NPC updates
   * @param {number} [port] - Port to listen on
   * @returns {Promise<Server>} HTTP server instance
   */
  async startUpdateServer(port = this.options.updatePort) {
    if (this.updateServer) {
      return this.updateServer;
    }

    const app = express();
    app.use(express.json());

    if (this.options.allowedOrigins) {
      app.use(cors({ origin: this.options.allowedOrigins }));
    }

    // Authentication middleware
    app.use((req, res, next) => {
      const { updateServerAuthToken } = this.options;
      if (!updateServerAuthToken) {
        next();
        return;
      }

      const token = req.headers["x-auth-token"] || req.query.token;
      if (token !== updateServerAuthToken) {
        res.status(401).json({ status: "error", message: "Unauthorized" });
        return;
      }
      next();
    });

    // Rate limiting middleware
    const rateWindow = this.options.updateServerRateLimit?.windowMs || 60000;
    const rateMax = this.options.updateServerRateLimit?.max || 300;
    const requestBuckets = new Map();

    const rateLimiter = (req, res, next) => {
      if (!rateMax) {
        next();
        return;
      }

      const now = Date.now();
      const key = req.ip || "unknown";
      const bucket = requestBuckets.get(key) || { count: 0, reset: now + rateWindow };

      if (now > bucket.reset) {
        bucket.count = 0;
        bucket.reset = now + rateWindow;
      }

      bucket.count += 1;
      requestBuckets.set(key, bucket);

      if (bucket.count > rateMax) {
        res.status(429).json({ status: "error", message: "Too many requests" });
        return;
      }
      next();
    };

    // NPC update endpoint
    app.post("/npc/update", rateLimiter, (req, res) => {
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

          if (this.options.enableWebsocket !== false) {
            this.startWebsocketServer(server);
          }

          resolve(server);
        })
        .on("error", err => {
          reject(err);
        });
    });
  }

  /**
   * Stop HTTP update server
   * @returns {Promise<void>}
   */
  async stopUpdateServer() {
    if (!this.updateServer) {
      return;
    }

    await new Promise(resolve => this.updateServer.close(resolve));
    this.updateServer = null;
    this.stopWebsocketServer();
  }

  /**
   * Start WebSocket server for real-time updates
   * @private
   * @param {Server} server - HTTP server to attach to
   */
  startWebsocketServer(server) {
    if (this.websocketServer) {
      return;
    }

    this.websocketServer = new WebSocketServer({
      server,
      path: this.options.websocketPath || "/bridge",
      perMessageDeflate: this.options.websocketCompression !== false
    });

    this.websocketServer.on("connection", socket => {
      socket.send(JSON.stringify({ type: "hello", at: Date.now() }));

      socket.on("message", raw => {
        try {
          const message = JSON.parse(raw.toString());

          if (message?.type === "subscribe" && Array.isArray(message.events)) {
            // Validate event types
            const validEventTypes = message.events.filter(
              event => typeof event === "string" && event.length > 0 && event.length < 100
            );
            socket.subscriptions = new Set(validEventTypes);
            socket.send(JSON.stringify({
              type: "subscribed",
              events: Array.from(socket.subscriptions)
            }));
          }

          if (message?.type === "ping") {
            socket.send(JSON.stringify({ type: "pong", at: Date.now() }));
          }
        } catch (err) {
          socket.send(JSON.stringify({ type: "error", message: err.message }));
        }
      });
    });
  }

  /**
   * Stop WebSocket server
   * @private
   */
  stopWebsocketServer() {
    if (!this.websocketServer) {
      return;
    }

    this.websocketServer.clients.forEach(client => client.close());
    this.websocketServer.close();
    this.websocketServer = null;
  }

  /**
   * Broadcast message to all WebSocket clients
   * @private
   * @param {Object} payload - Message payload
   */
  broadcastWebsocket(payload) {
    if (!this.websocketServer || !payload) {
      return;
    }

    const message = JSON.stringify(payload);
    this.websocketServer.clients.forEach(client => {
      if (client.readyState !== MinecraftBridge.WEBSOCKET_READY_STATE_OPEN) {
        return;
      }

      if (client.subscriptions && client.subscriptions.size > 0) {
        if (!payload.type || !client.subscriptions.has(payload.type)) {
          return;
        }
      }

      client.send(message);
    });
  }

  /**
   * Disconnect from RCON server
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.client) {
      return;
    }

    try {
      this.manualDisconnect = true;
      await this.client.end();
    } finally {
      this.client = null;
      this.connected = false;

      this.stopHeartbeat();
      this.stopSnapshotLoop();
      this.stopSnapshotPersistence();
      this.stopCleanupLoop();
      this.clearCommandQueue(new Error("Minecraft bridge disconnected"));

      this.emit("disconnected");
      this.manualDisconnect = false;
    }

    if (this.updateServer) {
      await this.stopUpdateServer();
    }
  }

  /**
   * Gracefully shutdown the bridge
   * @param {Object} [options] - Shutdown options
   * @param {boolean} [options.graceful=true] - Wait for pending commands
   * @param {number} [options.timeout=5000] - Max time to wait for commands (ms)
   * @returns {Promise<void>}
   */
  async shutdown({ graceful = true, timeout = 5000 } = {}) {
    if (graceful && this.commandQueue.length > 0) {
      console.log(`⏳ Waiting for ${this.commandQueue.length} pending commands...`);

      await Promise.race([
        new Promise(resolve => {
          const checkQueue = () => {
            if (this.commandQueue.length === 0 && !this.commandInFlight) {
              resolve();
            } else {
              setTimeout(checkQueue, 100);
            }
          };
          checkQueue();
        }),
        new Promise(resolve => setTimeout(resolve, timeout))
      ]);
    }

    await this.disconnect();
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   * @private
   */
  scheduleReconnect() {
    if (this.options.connectOnCreate === false) {
      return;
    }

    if (this.reconnectTimer || this.connected) {
      return;
    }

    const delay = Math.min(
      this.options.maxReconnectDelay,
      this.options.reconnectBaseDelay * Math.pow(2, Math.min(this.reconnectAttempt, MinecraftBridge.MAX_RECONNECT_ATTEMPTS))
    );

    this.metrics.reconnectAttempts += 1;
    this.metrics.lastReconnectDelay = delay;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(err => {
        console.error("❌ Reconnect attempt failed:", err.message);
      });
    }, delay);

    this.emit("reconnect_scheduled", { attempt: this.reconnectAttempt, delay });
  }

  /**
   * Validate command result for errors
   * @private
   * @param {string} response - Server response
   * @returns {Error|null} Error if validation fails, null otherwise
   */
  validateCommandResult(response) {
    if (typeof response !== "string") {
      return null;
    }

    const normalized = response.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const errorIndicators = [
      "unknown command",
      "no such player",
      "error",
      "failed"
    ];

    if (errorIndicators.some(indicator => normalized.includes(indicator))) {
      return new Error(`Command failed: ${response}`);
    }

    return null;
  }

  /**
   * Register a command template
   * @param {string} name - Template name
   * @param {Function} builder - Template builder function
   */
  registerCommandTemplate(name, builder) {
    if (!name || typeof builder !== "function") {
      throw new Error("Command template requires a name and builder function");
    }
    this.templateRegistry.set(name, builder);
  }

  /**
   * Execute a registered command template
   * @param {string} name - Template name
   * @param {Object} [params={}] - Template parameters
   * @returns {Promise<string>} Command response
   */
  executeCommandTemplate(name, params = {}) {
    const builder = this.templateRegistry.get(name);
    if (!builder) {
      throw new Error(`Unknown command template: ${name}`);
    }

    const command = builder(params, this.options);
    if (typeof command !== "string") {
      throw new Error(`Template '${name}' did not return a command string`);
    }

    return this.sendCommand(command);
  }

  /**
   * Subscribe to combat events
   * @param {Object} options - Subscription options
   * @param {Array<string>} [options.types] - Event types to subscribe to
   * @param {Function} options.handler - Event handler function
   * @param {boolean} [options.once=false] - Unsubscribe after first event
   * @returns {Function} Unsubscribe function
   */
  subscribeToEvents({ types, handler, once = false }) {
    if (typeof handler !== "function") {
      throw new Error("Event subscription requires a handler function");
    }

    const subscriptionId = ++this.subscriptionSeq;
    const normalizedTypes = Array.isArray(types) && types.length > 0 ? new Set(types) : null;

    this.subscriptionRegistry.set(subscriptionId, { handler, types: normalizedTypes, once });

    return () => {
      this.subscriptionRegistry.delete(subscriptionId);
    };
  }

  /**
   * Notify event subscribers
   * @private
   * @param {Object} event - Event to notify about
   */
  notifySubscribers(event) {
    if (!event) {
      return;
    }

    const removals = [];
    this.subscriptionRegistry.forEach((subscription, id) => {
      if (subscription.types && !subscription.types.has(event.type)) {
        return;
      }

      try {
        subscription.handler(event);
      } catch (err) {
        console.warn("⚠️ Event subscription handler failed:", err.message);
      }

      if (subscription.once) {
        removals.push(id);
      }
    });

    removals.forEach(id => this.subscriptionRegistry.delete(id));
  }

  /**
   * Send multiple commands in batch
   * @param {Array<string>} commands - Commands to send
   * @param {Object} [options] - Batch options
   * @param {boolean} [options.parallel=false] - Send commands in parallel
   * @param {number} [options.delay=0] - Delay between sequential commands (ms)
   * @returns {Promise<Array<string>>} Array of responses
   */
  async sendBatch(commands, { parallel = false, delay = 0 } = {}) {
    if (!Array.isArray(commands) || commands.length === 0) {
      return [];
    }

    const executeSequential = async () => {
      const results = [];
      for (const command of commands) {
        const result = await this.sendCommand(command);
        results.push(result);
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      return results;
    };

    if (!parallel) {
      return executeSequential();
    }

    return Promise.all(commands.map(command => this.sendCommand(command)));
  }

  /**
   * Get current metrics
   * @returns {Object} Current metrics snapshot
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueLength: this.commandQueue.length,
      connected: this.connected,
      lastHeartbeat: this.lastHeartbeat,
      lastCommandAt: this.lastCommandAt
    };
  }

  /**
   * Replay combat events from history
   * @param {Object} [options] - Replay options
   * @param {number} [options.since] - Only replay events after this timestamp
   * @returns {number} Number of events replayed
   */
  replayCombatEvents({ since } = {}) {
    const events = this.getEventHistory({ since });
    events.forEach(event => this.handleCombatEvent(event));
    return events.length;
  }
}
