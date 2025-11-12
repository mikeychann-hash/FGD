// npc_engine.js
// Core AI task manager for AICraft NPCs
//
// This file has been refactored into focused modules for better maintainability:
// - npc_engine/utils.js - Shared utilities and helper functions
// - npc_engine/autonomy.js - AI-driven autonomous task generation
// - npc_engine/queue.js - Priority queue and back-pressure management
// - npc_engine/dispatch.js - Task execution lifecycle management
// - npc_engine/bridge.js - External communication and bridge integration

import EventEmitter from "events";

import { interpretCommand } from "./interpreter.js";
import { generateModelTasks, DEFAULT_AUTONOMY_PROMPT } from "./model_director.js";
import { validateTask } from "./task_schema.js";
import {
  normalizeControlRatio,
  normalizePriority,
  cloneTask,
  getPreferredNpcTypes,
  getTaskTargetPosition
} from "./npc_engine/utils.js";
import { AutonomyManager } from "./npc_engine/autonomy.js";
import { QueueManager } from "./npc_engine/queue.js";
import { DispatchManager } from "./npc_engine/dispatch.js";
import { BridgeManager } from "./npc_engine/bridge.js";
import { NPCRegistry } from "./npc_registry.js";
import { NPCSpawner } from "./npc_spawner.js";
import { LearningEngine } from "./learning_engine.js";
import { startLoop, stopLoop } from "./core/npc_microcore.js";
import {
  applyPersonalityMetadata,
  buildPersonalityBundle,
  cloneValue,
  deriveLearningEnrichment,
  ensureTraitsHelper
} from "./npc_identity.js";

export class NPCEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.npcs = new Map(); // npcId -> state
    this.taskQueue = []; // [{ task, enqueuedAt }]
    this.taskTimeouts = new Map(); // npcId -> timeoutId
    this.bridge = options.bridge || null;
    this.bridgeSensors = null;
    this.autoSpawn = options.autoSpawn ?? false;
    this.defaultSpawnPosition = options.defaultSpawnPosition || { x: 0, y: 64, z: 0 };
    this.requireFeedback = options.requireFeedback ?? true;
    this.modelControlRatio = normalizeControlRatio(options.modelControlRatio);
    this.interpreterOptions = { ...(options.interpreterOptions || {}) };
    this.maxQueueSize = options.maxQueueSize ?? 100;
    this.currentPhase = 1; // Track current progression phase
    this.registry = options.registry instanceof NPCRegistry ? options.registry : (options.registry === false ? null : new NPCRegistry(options.registryOptions || {}));
    this.learningEngine = options.learningEngine instanceof LearningEngine
      ? options.learningEngine
      : options.learningEngine === false
        ? null
        : new LearningEngine(options.learningEnginePath || "./data/npc_profiles.json");
    this.traitsHelper = ensureTraitsHelper(this.registry?.traits);
    this.autoRegisterFromRegistry = options.autoRegisterFromRegistry ?? true;
    this.spawner = options.spawner instanceof NPCSpawner
      ? options.spawner
      : new NPCSpawner({
          engine: this,
          registry: this.registry,
          learningEngine: this.learningEngine,
          autoSpawn: this.autoSpawn
        });
    this.registryReady = this.registry ? this.registry.load().catch(err => {
      console.error("❌ Failed to load NPC registry:", err.message);
      return [];
    }) : Promise.resolve([]);
    this.learningReady = this.learningEngine
      ? this.learningEngine.initialize().catch(err => {
          console.error("❌ Failed to initialize learning engine:", err.message);
          return null;
        })
      : Promise.resolve(null);

    // Initialize manager modules
    this.autonomyManager = new AutonomyManager(this);
    this.queueManager = new QueueManager(this);
    this.dispatchManager = new DispatchManager(this);
    this.bridgeManager = new BridgeManager(this);

    if (this.bridge) {
      this.bridgeManager.attachBridgeListeners(this.bridge);
      this._bindBridgeSensors(this.bridge);
    }

    if (this.registry && this.autoRegisterFromRegistry) {
      Promise.all([this.registryReady, this.learningReady])
        .then(() => {
          const entries = this.registry.getAll().filter(entry => entry.status !== "inactive");
          for (const entry of entries) {
            this.registerNPC(entry.id, entry.npcType, {
              position: entry.spawnPosition || this.defaultSpawnPosition,
              role: entry.role,
              personality: entry.personality,
              appearance: entry.appearance,
              metadata: {
                ...entry.metadata,
                description: entry.description,
                personalitySummary: entry.personalitySummary,
                personalityTraits: entry.personalityTraits
              },
              profile: entry,
              personalitySummary: entry.personalitySummary,
              personalityTraits: entry.personalityTraits,
              persist: false
            });
          }
        })
        .catch(err => {
          console.error("❌ Failed to initialize NPC registry entries:", err.message);
        });
    }
  }

  // ============================================================================
  // Bridge Management
  // ============================================================================

  setBridge(bridge) {
    if (this.bridge === bridge) {
      return;
    }
    this._unbindBridgeSensors();
    this.bridge = bridge || null;
    this.bridgeManager.setBridge(bridge);
    if (bridge) {
      this.bridgeManager.attachBridgeListeners(bridge);
      this._bindBridgeSensors(bridge);
    }
  }

  async spawnNPC(id, options = {}) {
    if (this.mineflayerBridge && typeof this.mineflayerBridge.createBot === "function") {
      const spawnOptions = {
        username: options.username || id,
        version: options.version || this.mineflayerBridge.options?.version
      };
      return this.mineflayerBridge.createBot(id, spawnOptions);
    }
    return this.bridgeManager.spawnNPC(id, options);
  }

  attachMicrocore(npcId, microcore, runtimeState = null) {
    if (!npcId || !microcore) {
      return;
    }

    const npc = this.npcs.get(npcId);
    if (!npc) {
      return;
    }

    if (npc.runtime?.microcore && npc.runtime.microcore !== microcore) {
      this.detachMicrocore(npcId, { stop: false });
    }

    const runtime = {
      ...(npc.runtime || {}),
      ...(runtimeState || {}),
      microcore,
      status: runtimeState?.status || npc.runtime?.status || npc.state,
      position: runtimeState?.position || npc.runtime?.position || npc.position,
      velocity: runtimeState?.velocity || npc.runtime?.velocity || { x: 0, y: 0, z: 0 },
      memory: runtimeState?.memory || npc.runtime?.memory || { context: [] }
    };

    const listeners = {
      move: payload => this._handleMicrocoreMove(npcId, payload),
      taskComplete: payload => this._handleMicrocoreTask(npcId, payload),
      statusUpdate: payload => this._handleMicrocoreStatus(npcId, payload),
      error: payload => this.emit("npc_error", { npcId, payload })
    };

    microcore.on("move", listeners.move);
    microcore.on("taskComplete", listeners.taskComplete);
    microcore.on("statusUpdate", listeners.statusUpdate);
    microcore.on("error", listeners.error);

    runtime.microcoreListeners = listeners;
    npc.runtime = runtime;
    npc.position = runtime.position || npc.position;
    this.npcs.set(npcId, npc);

    this.emit("npc_microcore_attached", { npcId });
  }

  detachMicrocore(npcId, options = {}) {
    const npc = this.npcs.get(npcId);
    if (!npc?.runtime?.microcore) {
      return;
    }

    const { microcore, microcoreListeners } = npc.runtime;
    if (microcoreListeners) {
      const remove = (event, handler) => {
        if (!handler) return;
        if (typeof microcore.off === "function") {
          microcore.off(event, handler);
        } else if (typeof microcore.removeListener === "function") {
          microcore.removeListener(event, handler);
        }
      };
      remove("move", microcoreListeners.move);
      remove("taskComplete", microcoreListeners.taskComplete);
      remove("statusUpdate", microcoreListeners.statusUpdate);
      remove("error", microcoreListeners.error);
    }

    if (options.stop !== false) {
      microcore.stop?.();
      stopLoop(npcId);
    }

    npc.runtime.microcore = null;
    npc.runtime.microcoreListeners = null;
    this.npcs.set(npcId, npc);
    this.emit("npc_microcore_detached", { npcId });
  }

  handleMicrocoreEvent(npcId, eventName, payload) {
    switch (eventName) {
      case "microcore_move":
        this._handleMicrocoreMove(npcId, payload);
        break;
      case "microcore_taskComplete":
        this._handleMicrocoreTask(npcId, payload);
        break;
      case "microcore_status":
        this._handleMicrocoreStatus(npcId, payload);
        break;
      case "microcore_error":
        this.emit("npc_error", { npcId, payload });
        break;
      default:
        break;
    }
  }

  _handleMicrocoreMove(npcId, payload = {}) {
    const npc = this.npcs.get(npcId);
    if (!npc) return;

    const runtime = { ...(npc.runtime || {}) };
    if (payload.position) {
      runtime.position = { ...payload.position };
      npc.position = { ...payload.position };
    }
    if (payload.velocity) {
      runtime.velocity = { ...payload.velocity };
    }
    runtime.lastTickAt = payload.timestamp
      ? new Date(payload.timestamp).toISOString()
      : new Date().toISOString();
    runtime.status = payload.status || runtime.status || npc.state;
    runtime.tickCount = typeof payload.tick === "number" ? payload.tick : runtime.tickCount;

    npc.runtime = runtime;
    npc.lastUpdate = runtime.lastTickAt;
    npc.state = runtime.status || npc.state;
    this.npcs.set(npcId, npc);

    this.emit("npc_moved", { npcId, ...payload });
  }

  _handleMicrocoreTask(npcId, payload = {}) {
    const npc = this.npcs.get(npcId);
    if (!npc) return;

    npc.task = null;
    npc.state = "idle";
    npc.runtime = {
      ...(npc.runtime || {}),
      status: "idle",
      lastTickAt: new Date().toISOString()
    };
    this.npcs.set(npcId, npc);
    this.emit("npc_task_completed", { npcId, ...payload });
  }

  _handleMicrocoreStatus(npcId, payload = {}) {
    const npc = this.npcs.get(npcId);
    if (!npc) return;

    const runtime = { ...(npc.runtime || {}) };
    if (payload.position) {
      runtime.position = { ...payload.position };
      npc.position = { ...payload.position };
    }
    if (payload.velocity) {
      runtime.velocity = { ...payload.velocity };
    }
    if (payload.lastTickAt) {
      runtime.lastTickAt = payload.lastTickAt;
    }
    if (typeof payload.tick === "number") {
      runtime.tickCount = payload.tick;
    }
    if (payload.memory) {
      runtime.memory = { context: [...payload.memory] };
    }
    if (payload.lastScan) {
      runtime.lastScan = payload.lastScan;
    }
    runtime.status = payload.status || runtime.status || npc.state;

    npc.runtime = runtime;
    npc.state = runtime.status || npc.state;
    npc.lastUpdate = runtime.lastTickAt || npc.lastUpdate;
    this.npcs.set(npcId, npc);

    this.emit("npc_status", { npcId, ...payload });
  }

  getMicrocore(npcOrId) {
    const npc = typeof npcOrId === "string" ? this.npcs.get(npcOrId) : npcOrId;
    return npc?.runtime?.microcore || null;
  }

  syncMicrocoreTask(npcOrId, task, options = {}) {
    const npc = typeof npcOrId === "string" ? this.npcs.get(npcOrId) : npcOrId;
    if (!npc) {
      return;
    }

    const microcore = npc.runtime?.microcore;
    if (!microcore) {
      return;
    }

    const clonedTask = task ? cloneTask(task) : null;

    if (typeof microcore.setTask === "function") {
      microcore.setTask(clonedTask);
    } else if (typeof microcore.handleEvent === "function") {
      microcore.handleEvent({ type: "task", task: clonedTask });
    }

    if (!clonedTask) {
      return;
    }

    const fallbackPosition = options.fallbackPosition
      || npc.runtime?.position
      || npc.position
      || null;
    const targetPosition = getTaskTargetPosition(clonedTask, fallbackPosition);

    if (!targetPosition) {
      return;
    }

    if (typeof microcore.setMovementTarget === "function") {
      microcore.setMovementTarget(targetPosition);
    } else if (typeof microcore.handleEvent === "function") {
      microcore.handleEvent({ type: "moveTo", position: targetPosition });
    }
  }

  clearMicrocoreTask(npcOrId, options = {}) {
    const npc = typeof npcOrId === "string" ? this.npcs.get(npcOrId) : npcOrId;
    if (!npc) {
      return;
    }

    const microcore = npc.runtime?.microcore;
    if (!microcore) {
      return;
    }

    const { resetTarget = true } = options;

    if (typeof microcore.setTask === "function") {
      microcore.setTask(null);
    } else if (typeof microcore.handleEvent === "function") {
      microcore.handleEvent({ type: "task", task: null });
    }

    if (!resetTarget) {
      return;
    }

    const currentPosition = npc.runtime?.position || npc.position || null;
    if (!currentPosition) {
      return;
    }

    if (typeof microcore.setMovementTarget === "function") {
      microcore.setMovementTarget(currentPosition);
    } else if (typeof microcore.handleEvent === "function") {
      microcore.handleEvent({ type: "moveTo", position: currentPosition });
    }
  }

  sendMicrocoreEvent(npcOrId, event) {
    if (!event) {
      return;
    }

    const npc = typeof npcOrId === "string" ? this.npcs.get(npcOrId) : npcOrId;
    if (!npc) {
      return;
    }

    const microcore = npc.runtime?.microcore;
    if (!microcore) {
      return;
    }

    if (typeof microcore.handleEvent === "function") {
      microcore.handleEvent(event);
    }
  }

  _bindBridgeSensors(bridge) {
    if (!bridge) return;

    const onScan = payload => {
      if (!payload?.botId) return;
      const npc = this.npcs.get(payload.botId);
      if (!npc) return;
      const runtime = { ...(npc.runtime || {}) };
      runtime.lastScan = payload;
      npc.runtime = runtime;
      this.npcs.set(payload.botId, npc);
      this.emit("npc_scan", payload);
    };

    const onMove = payload => {
      if (!payload?.botId) return;
      const npc = this.npcs.get(payload.botId);
      if (!npc) return;
      const runtime = { ...(npc.runtime || {}) };
      if (payload.position) {
        runtime.position = { ...payload.position };
        npc.position = { ...payload.position };
      }
      runtime.lastTickAt = new Date(payload.timestamp || Date.now()).toISOString();
      npc.runtime = runtime;
      this.npcs.set(payload.botId, npc);
      this.emit("npc_bridge_move", payload);
    };

    bridge.on("scanResult", onScan);
    bridge.on("botMoved", onMove);

    this.bridgeSensors = { bridge, onScan, onMove };
  }

  _unbindBridgeSensors() {
    if (!this.bridgeSensors?.bridge) {
      return;
    }

    const { bridge, onScan, onMove } = this.bridgeSensors;
    this._removeBridgeListener(bridge, "scanResult", onScan);
    this._removeBridgeListener(bridge, "botMoved", onMove);
    this.bridgeSensors = null;
  }

  _removeBridgeListener(bridge, event, handler) {
    if (!bridge || !handler) return;
    if (typeof bridge.off === "function") {
      bridge.off(event, handler);
    } else if (typeof bridge.removeListener === "function") {
      bridge.removeListener(event, handler);
    }
  }


  async createNPC(options = {}) {
    if (!this.spawner) {
      throw new Error("NPC spawner is not configured for this engine instance");
    }
    return this.spawner.spawn(options);
  }

  async spawnAllKnownNPCs(options = {}) {
    if (!this.spawner) {
      throw new Error("NPC spawner is not configured for this engine instance");
    }
    return this.spawner.spawnAllKnown(options);
  }

  // ============================================================================
  // NPC Registration
  // ============================================================================

  registerNPC(id, type = "builder", options = {}) {
    if (!id || typeof id !== "string") {
      throw new Error("NPC id must be a non-empty string");
    }

    const existing = this.npcs.get(id);
    const spawnPosition = options.position || existing?.position || this.defaultSpawnPosition;
    const role = options.role || existing?.role || type;
    const appearance = cloneValue(options.appearance) || cloneValue(existing?.appearance) || {};
    const metadata = cloneValue(options.metadata) || cloneValue(existing?.metadata) || {};
    const profile = options.profile || existing?.profile || null;
    const bundle = buildPersonalityBundle(
      options.personality || profile?.personality || existing?.personality,
      this.traitsHelper
    );
    let personality = bundle.personality;
    let personalitySummary = options.personalitySummary
      ?? bundle.summary
      ?? profile?.personalitySummary
      ?? existing?.personalitySummary
      ?? metadata.personalitySummary
      ?? null;
    let personalityTraits = Array.isArray(options.personalityTraits)
      ? [...options.personalityTraits]
      : Array.isArray(bundle.traits) && bundle.traits.length > 0
        ? [...bundle.traits]
        : Array.isArray(profile?.personalityTraits)
          ? [...profile.personalityTraits]
          : Array.isArray(existing?.profile?.personalityTraits)
            ? [...existing.profile.personalityTraits]
            : Array.isArray(existing?.personalityTraits)
              ? [...existing.personalityTraits]
              : undefined;

    const learningProfile = this._getLearningProfileSync(id);
    if (learningProfile) {
      const enriched = deriveLearningEnrichment(learningProfile, this.traitsHelper);
      if (enriched.personality) {
        personality = enriched.personality;
      }
      if (enriched.personalitySummary) {
        personalitySummary = enriched.personalitySummary;
      }
      if (enriched.personalityTraits) {
        personalityTraits = Array.isArray(enriched.personalityTraits)
          ? [...enriched.personalityTraits]
          : enriched.personalityTraits;
      }
      if (enriched.learningMetadata) {
        metadata.learning = enriched.learningMetadata;
      }
    } else if (this.learningReady) {
      this.learningReady
        .then(() => {
          const profileAfterInit = this._getLearningProfileSync(id);
          if (profileAfterInit) {
            this._applyLearningProfile(id, profileAfterInit);
          }
        })
        .catch(err => {
          console.error(`⚠️  Failed to hydrate learning profile for ${id}:`, err.message);
        });
    }

    if (profile?.description && !metadata.description) {
      metadata.description = profile.description;
    }

    const metadataWithPersonality = applyPersonalityMetadata(metadata, {
      summary: personalitySummary,
      traits: personalityTraits
    });

    const normalizedProfile = profile
      ? {
          ...profile,
          personality,
          personalitySummary,
          personalityTraits: personalityTraits ?? profile.personalityTraits,
          metadata: {
            ...metadataWithPersonality,
            learning:
              metadataWithPersonality.learning != null
                ? metadataWithPersonality.learning
                : profile.metadata?.learning
          }
        }
      : null;

    const runtime = {
      ...(existing?.runtime || {}),
      position: existing?.runtime?.position
        ? { ...existing.runtime.position }
        : { ...spawnPosition },
      velocity: existing?.runtime?.velocity
        ? { ...existing.runtime.velocity }
        : { x: 0, y: 0, z: 0 },
      status: existing?.runtime?.status || existing?.state || "idle",
      memory: existing?.runtime?.memory || { context: [] },
      lastTickAt: existing?.runtime?.lastTickAt || null,
      lastScan: existing?.runtime?.lastScan || null,
      tickCount: existing?.runtime?.tickCount || 0,
      microcore: existing?.runtime?.microcore || null,
      microcoreListeners: existing?.runtime?.microcoreListeners || null
    };

    this.npcs.set(id, {
      id,
      type,
      role,
      task: existing?.task || null,
      state: runtime.status || existing?.state || "idle",
      position: { ...runtime.position },
      progress: existing?.progress || 0,
      lastUpdate: existing?.lastUpdate || null,
      awaitingFeedback: existing?.awaitingFeedback || false,
      personality,
      appearance,
      metadata: metadataWithPersonality,
      profile: normalizedProfile,
      personalitySummary,
      personalityTraits,
      runtime
    });

    // Initialize microcore for embodied bot behavior
    const enableMicrocore = options.microcore !== false && options.enableMicrocore !== false;
    if (enableMicrocore && !runtime.microcore) {
      try {
        const npcState = this.npcs.get(id);
        const microcore = startLoop(npcState, {
          bridge: this.bridge,
          tickRateMs: options.microcoreTickRate || 200,
          scanIntervalMs: options.microcoreScanInterval || 1500,
          scanRadius: options.microcoreScanRadius || 5
        });

        this.attachMicrocore(id, microcore, runtime);
        console.log(`🧠 Microcore initialized for ${id}`);
      } catch (error) {
        console.error(`⚠️  Failed to initialize microcore for ${id}:`, error.message);
      }
    }

    console.log(`🤖 Registered NPC ${id} (${type}${role && role !== type ? `/${role}` : ""})`);
    this.emit("npc_registered", {
      id,
      type,
      role,
      position: { ...spawnPosition },
      profile
    });

    if (this.registry && options.persist !== false) {
      this.registry
        .upsert({
          id,
          npcType: type,
          role,
          appearance,
          spawnPosition,
          personality,
          metadata: metadataWithPersonality,
          description: metadataWithPersonality?.description,
          status: "active",
          personalitySummary,
          personalityTraits,
          spawnCount: normalizedProfile?.spawnCount,
          lastSpawnedAt: normalizedProfile?.lastSpawnedAt,
          lastDespawnedAt: normalizedProfile?.lastDespawnedAt,
          lastKnownPosition: normalizedProfile?.lastKnownPosition
        })
        .catch(err => {
          console.error(`❌ Failed to persist NPC ${id}:`, err.message);
        });
    }

    if (this.autoSpawn && this.bridge && options.autoSpawn !== false) {
      this.spawnNPC(id, {
        npcType: type,
        position: spawnPosition,
        appearance,
        metadata: metadataWithPersonality,
        profile,
        personalitySummary
      }).catch(err => {
        console.error(`❌ Failed to spawn NPC ${id}:`, err.message);
      });
    }

    this.queueManager.processQueue();
  }

  unregisterNPC(id) {
    if (!this.npcs.has(id)) {
      return;
    }

    const npc = this.npcs.get(id);

    if (npc?.runtime?.microcore) {
      this.detachMicrocore(id, { stop: true });
    }

    if (npc?.task) {
      const taskClone = cloneTask(npc.task);
      this.queueManager.enqueueTask(taskClone);
      this.emit("task_requeued", {
        task: cloneTask(taskClone),
        npcId: id,
        reason: "npc_unregistered"
      });
    }

    if (this.taskTimeouts.has(id)) {
      clearTimeout(this.taskTimeouts.get(id));
      this.taskTimeouts.delete(id);
    }
    if (this.mineflayerBridge?.disconnectBot) {
      Promise.resolve(this.mineflayerBridge.disconnectBot(id)).catch(error => {
        console.error(`⚠️  Failed to disconnect Mineflayer bot ${id}:`, error.message);
      });
    } else if (this.bridge?.despawnEntity) {
      Promise.resolve(this.bridge.despawnEntity({ npcId: id })).catch(error => {
        console.error(`⚠️  Failed to despawn NPC ${id}:`, error.message);
      });
    }

    this.npcs.delete(id);
    console.log(`👋 Unregistered NPC ${id}`);
    this.emit("npc_unregistered", { id });

    if (this.registry) {
      this.registry.recordDespawn(id, { position: npc?.position }).catch(err => {
        console.error(`❌ Failed to mark NPC ${id} inactive:`, err.message);
      });
    }

    this.queueManager.processQueue();
  }

  // ============================================================================
  // Autonomy Management
  // ============================================================================

  enableModelAutonomy(options = {}) {
    this.autonomyManager.enableModelAutonomy(options);
  }

  disableModelAutonomy() {
    this.autonomyManager.disableModelAutonomy();
  }

  // ============================================================================
  // Task Handling
  // ============================================================================

  async handleCommand(inputText, sender = "system") {
    const interpreterOptions = { ...this.interpreterOptions };
    if (typeof this.modelControlRatio === "number") {
      interpreterOptions.controlRatio = this.modelControlRatio;
    }

    const task = await interpretCommand(inputText, interpreterOptions);

    if (!task || task.action === "none") {
      console.warn("⚠️  No interpretable task found.");
      return null;
    }

    const validation = validateTask(task);
    if (!validation.valid) {
      console.warn(`⚠️  Task validation failed: ${validation.errors.join("; ")}`);
      return null;
    }

    const normalizedTask = this.normalizeTask(task, sender);
    const available = this.findIdleNPC(normalizedTask);

    if (!available) {
      const position = this.queueManager.enqueueTask(normalizedTask);
      const idleNPCs = this.getIdleNPCs();
      if (idleNPCs.length > 0 && normalizedTask.preferredNpcTypes.length > 0) {
        console.warn(
          `⏸️  No compatible NPC types available. Waiting for ${normalizedTask.preferredNpcTypes.join(", ")}.` +
            ` Task queued at position ${position} (priority: ${normalizedTask.priority})`
        );
      } else {
        console.warn(
          `⏸️  No idle NPCs available. Task queued at position ${position} (priority: ${normalizedTask.priority})`
        );
      }
      return null;
    }

    return this.dispatchManager.assignTask(available, normalizedTask);
  }

  normalizeTask(task, sender = "system") {
    const normalizedPriority = normalizePriority(task.priority);
    const createdAt = typeof task.createdAt === "number" ? task.createdAt : Date.now();
    const origin = task.sender || sender || "system";
    const preferredNpcTypes = getPreferredNpcTypes(task);
    const personalityBias = Array.isArray(task?.metadata?.preferredTraits)
      ? task.metadata.preferredTraits.map(trait => String(trait).toLowerCase())
      : [];
    return {
      ...cloneTask(task),
      priority: normalizedPriority,
      sender: origin,
      createdAt,
      preferredNpcTypes,
      personalityBias
    };
  }

  assignTask(npc, task) {
    return this.dispatchManager.assignTask(npc, task);
  }

  // ============================================================================
  // NPC Queries
  // ============================================================================

  findIdleNPC(task = null) {
    const idleNPCs = this.getIdleNPCs();
    if (idleNPCs.length === 0) return null;

    if (!task) {
      return idleNPCs[0];
    }

    const preferredTypes = getPreferredNpcTypes(task);
    const biasTraits = Array.isArray(task.personalityBias) ? task.personalityBias : [];

    if (preferredTypes.length === 0 && biasTraits.length === 0) {
      return idleNPCs[0];
    }

    const scored = idleNPCs.map(npc => {
      let score = 0;
      if (preferredTypes.includes(npc.type)) {
        score += 10;
      }
      if (biasTraits.length > 0) {
        const traits = (npc.personalityTraits || npc.metadata?.personalityTraits || [])
          .map(trait => String(trait).toLowerCase());
        const matches = biasTraits.filter(trait => traits.includes(trait)).length;
        score += matches * 2;
      }
      return { npc, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored.find(entry => entry.score > 0) || scored[0];
    return best ? best.npc : null;
  }

  getIdleNPCs() {
    return [...this.npcs.values()].filter(n => n.state === "idle");
  }

  getStatus() {
    const status = {
      total: this.npcs.size,
      idle: 0,
      working: 0,
      queueLength: this.taskQueue.length,
      maxQueueSize: this.maxQueueSize,
      queueUtilization: this.maxQueueSize > 0
        ? Math.round((this.taskQueue.length / this.maxQueueSize) * 100)
        : 0,
      queueByPriority: { high: 0, normal: 0, low: 0 },
      npcs: [],
      bridgeConnected: Boolean(this.bridge?.isConnected?.()),
      currentPhase: this.currentPhase
    };

    for (const npc of this.npcs.values()) {
      const runtimeState = npc.runtime?.status || npc.state;
      if (runtimeState === "idle") status.idle++;
      if (runtimeState === "working") status.working++;
      status.npcs.push({
        id: npc.id,
        type: npc.type,
        role: npc.role,
        state: runtimeState,
        task: npc.task?.action || null,
        preferredNpcTypes: npc.task?.preferredNpcTypes || [],
        progress: npc.progress,
        lastUpdate: npc.lastUpdate,
        personality: npc.personality || null,
        personalitySummary: npc.personalitySummary || null,
        metadata: npc.metadata || {},
        description: npc.metadata?.description || npc.profile?.description || null,
        personalityTraits: Array.isArray(npc.personalityTraits)
          ? [...npc.personalityTraits]
          : Array.isArray(npc.profile?.personalityTraits)
            ? [...npc.profile.personalityTraits]
            : undefined,
        spawnCount: typeof npc.profile?.spawnCount === "number" ? npc.profile.spawnCount : null,
        lastSpawnedAt: npc.profile?.lastSpawnedAt || null,
        lastKnownPosition: npc.profile?.lastKnownPosition || npc.position || null,
        position: npc.runtime?.position || npc.position || null,
        velocity: npc.runtime?.velocity || { x: 0, y: 0, z: 0 },
        runtime: npc.runtime
      });
    }

    for (const entry of this.taskQueue) {
      const priority = entry.task.priority || "normal";
      if (status.queueByPriority[priority] != null) {
        status.queueByPriority[priority]++;
      }
    }

    return status;
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  setModelControlRatio(ratio) {
    this.modelControlRatio = normalizeControlRatio(ratio);
  }

  _getLearningProfileSync(id) {
    if (!this.learningEngine || !id) {
      return null;
    }
    if (!this.learningEngine.initialized) {
      return null;
    }
    try {
      return this.learningEngine.getProfile(id);
    } catch (error) {
      console.error(`⚠️  Failed to read learning profile for ${id}:`, error.message);
      return null;
    }
  }

  _applyLearningProfile(id, learningProfile) {
    const npc = this.npcs.get(id);
    if (!npc || !learningProfile) {
      return;
    }

    const enrichment = deriveLearningEnrichment(learningProfile, this.traitsHelper);

    if (enrichment.personality) {
      npc.personality = enrichment.personality;
    }
    if (enrichment.personalitySummary) {
      npc.personalitySummary = enrichment.personalitySummary;
    } else if (!npc.personalitySummary && npc.profile?.personalitySummary) {
      npc.personalitySummary = npc.profile.personalitySummary;
    }
    if (enrichment.personalityTraits) {
      npc.personalityTraits = Array.isArray(enrichment.personalityTraits)
        ? [...enrichment.personalityTraits]
        : enrichment.personalityTraits;
    } else if (!npc.personalityTraits && npc.profile?.personalityTraits) {
      npc.personalityTraits = Array.isArray(npc.profile.personalityTraits)
        ? [...npc.profile.personalityTraits]
        : npc.profile.personalityTraits;
    }

    const npcMetadataBase = {
      ...(npc.metadata || {}),
      learning: enrichment.learningMetadata || npc.metadata?.learning
    };
    npc.metadata = applyPersonalityMetadata(npcMetadataBase, {
      summary: npc.personalitySummary,
      traits: npc.personalityTraits
    });

    if (enrichment.learningMetadata) {
      npc.metadata.learning = enrichment.learningMetadata;
    }

    if (npc.profile) {
      const profileMetadataBase = {
        ...(npc.profile.metadata || {}),
        learning: enrichment.learningMetadata || npc.profile.metadata?.learning
      };
      npc.profile = {
        ...npc.profile,
        personality: npc.personality,
        personalitySummary: npc.personalitySummary,
        personalityTraits: npc.personalityTraits,
        metadata: applyPersonalityMetadata(profileMetadataBase, {
          summary: npc.personalitySummary,
          traits: npc.personalityTraits
        })
      };
    }

    if (this.registry && npc.profile?.id) {
      this.registry.upsert({
        id: npc.profile.id,
        personality: npc.profile.personality,
        personalitySummary: npc.profile.personalitySummary,
        personalityTraits: npc.profile.personalityTraits,
        metadata: npc.profile.metadata
      }).catch(err => {
        console.error(`⚠️  Failed to sync registry after learning enrichment for ${id}:`, err.message);
      });
    }
  }

  /**
   * Update current progression phase and notify all NPC microcores
   * @param {number} phase - New phase number (1-6)
   */
  setPhase(phase) {
    if (typeof phase !== "number" || phase < 1 || phase > 6) {
      console.warn(`⚠️  Invalid phase: ${phase}. Must be between 1 and 6`);
      return;
    }

    this.currentPhase = phase;
    console.log(`🎯 [NPCEngine] Phase updated to ${phase}`);

    // Update bridge phase
    if (this.bridge && typeof this.bridge.setPhase === "function") {
      this.bridge.setPhase(phase);
    }

    // Notify all NPC microcores about phase change
    for (const npc of this.npcs.values()) {
      const microcore = npc.runtime?.microcore;
      if (microcore) {
        if (typeof microcore.setPhase === "function") {
          microcore.setPhase(phase);
        } else if (typeof microcore.handleEvent === "function") {
          microcore.handleEvent({ type: "phaseUpdate", phase });
        }
      }
    }

    // Emit phase change event
    this.emit("phaseChanged", { phase, timestamp: Date.now() });
  }

  /**
   * Get current progression phase
   * @returns {number} Current phase number
   */
  getPhase() {
    return this.currentPhase;
  }

  /**
   * Schedule multiple tasks as a batch (used by autonomic_core)
   * @param {Array<string>} taskNames - Array of task names to schedule
   */
  async scheduleBatch(taskNames) {
    if (!Array.isArray(taskNames)) {
      console.warn("⚠️  scheduleBatch requires an array of task names");
      return;
    }

    console.log(`📋 [NPCEngine] Scheduling batch of ${taskNames.length} tasks`);
    const results = [];

    for (const taskName of taskNames) {
      try {
        const result = await this.handleCommand(taskName, "progression_system");
        results.push({ taskName, success: true, result });
      } catch (err) {
        console.error(`❌ Failed to schedule task ${taskName}:`, err.message);
        results.push({ taskName, success: false, error: err.message });
      }
    }

    return results;
  }
}

// ============================================================================
// CLI Example
// ============================================================================

if (process.argv[1] && process.argv[1].includes("npc_engine.js")) {
  const engine = new NPCEngine();
  engine.registerNPC("npc_1", "miner");
  engine.registerNPC("npc_2", "builder");

  (async () => {
    await engine.handleCommand("build a small tower near spawn");
    await engine.handleCommand("mine some iron ore");

    setTimeout(() => {
      console.log("\n📊 Engine Status:", engine.getStatus());
    }, 1000);
  })();
}
