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
import { validateTask } from "./task_schema.js";
import { normalizeControlRatio, normalizePriority, cloneTask, getPreferredNpcTypes } from "./npc_engine/utils.js";
import { AutonomyManager } from "./npc_engine/autonomy.js";
import { QueueManager } from "./npc_engine/queue.js";
import { DispatchManager } from "./npc_engine/dispatch.js";
import { BridgeManager } from "./npc_engine/bridge.js";
import { NPCRegistry } from "./npc_registry.js";
import { NPCSpawner } from "./npc_spawner.js";
import { LearningEngine } from "./learning_engine.js";
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
    this.autoSpawn = options.autoSpawn ?? false;
    this.defaultSpawnPosition = options.defaultSpawnPosition || { x: 0, y: 64, z: 0 };
    this.requireFeedback = options.requireFeedback ?? true;
    this.modelControlRatio = normalizeControlRatio(options.modelControlRatio);
    this.interpreterOptions = { ...(options.interpreterOptions || {}) };
    this.maxQueueSize = options.maxQueueSize ?? 100;
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
    this.bridgeManager.setBridge(bridge);
  }

  async spawnNPC(id, options = {}) {
    return this.bridgeManager.spawnNPC(id, options);
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

    this.npcs.set(id, {
      id,
      type,
      role,
      task: existing?.task || null,
      state: existing?.state || "idle",
      position: { ...spawnPosition },
      progress: existing?.progress || 0,
      lastUpdate: existing?.lastUpdate || null,
      awaitingFeedback: existing?.awaitingFeedback || false,
      personality,
      appearance,
      metadata: metadataWithPersonality,
      profile: normalizedProfile,
      personalitySummary,
      personalityTraits
    });
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
    return {
      ...cloneTask(task),
      priority: normalizedPriority,
      sender: origin,
      createdAt,
      preferredNpcTypes
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
    if (preferredTypes.length === 0) {
      return idleNPCs[0];
    }

    const preferredMatch = idleNPCs.find(npc => preferredTypes.includes(npc.type));
    return preferredMatch || null;
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
      bridgeConnected: Boolean(this.bridge?.isConnected?.())
    };

    for (const npc of this.npcs.values()) {
      if (npc.state === "idle") status.idle++;
      if (npc.state === "working") status.working++;
      status.npcs.push({
        id: npc.id,
        type: npc.type,
        role: npc.role,
        state: npc.state,
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
        lastKnownPosition: npc.profile?.lastKnownPosition || npc.position || null
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
