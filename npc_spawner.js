// ai/npc_spawner.js
// High-level NPC spawning system that creates bots with personalities

import EventEmitter from "events";
import { NPCRegistry } from "./npc_registry.js";
import { LearningEngine } from "./learning_engine.js";
import {
  applyPersonalityMetadata,
  buildPersonalityBundle,
  cloneValue,
  mergeLearningIntoProfile
} from "./npc_identity.js";
import { logger } from "./logger.js";

// Maximum number of bots that can be spawned at once
const MAX_BOTS = 8;

/**
 * NPC Spawner - Creates and spawns NPCs with integrated personalities
 * Coordinates between NPCRegistry, LearningEngine, NPCEngine, and MinecraftBridge
 * NOTE: This is an older implementation - currently disabled
 */
class NPCSpawnerOld extends EventEmitter {
  /**
   * Creates a new NPCSpawner instance
   * @param {Object} options - Configuration options
   * @param {NPCRegistry} options.registry - The NPC registry
   * @param {LearningEngine} options.learningEngine - The learning engine for personalities
   * @param {NPCEngine} options.npcEngine - The NPC engine for task management
   * @param {MinecraftBridge} options.bridge - The Minecraft bridge for spawning
   */
  constructor(options = {}) {
    super();
    this.registry = options.registry || null;
    this.learningEngine = options.learningEngine || null;
    this.npcEngine = options.npcEngine || null;
    this.bridge = options.bridge || null;
    this.defaultSpawnPosition = options.defaultSpawnPosition || { x: 0, y: 64, z: 0 };
    this.autoRegisterWithEngine = options.autoRegisterWithEngine !== false;

    if (!this.registry) {
      throw new Error("NPCSpawner requires a registry");
    }

    if (this.learningEngine && this.registry) {
      this.registry.learningEngine = this.learningEngine;
    }
  }

  /**
   * Creates and spawns a new NPC with a personality
   * @param {Object} options - Spawn options
   * @param {string} options.name - NPC name (optional, will be auto-generated if not provided)
   * @param {string} options.role - NPC role (required)
   * @param {Object} options.position - Spawn position {x, y, z} (optional)
   * @param {Object} options.appearance - Appearance customization (optional)
   * @param {boolean} options.spawnInWorld - Whether to spawn in Minecraft world (default: true)
   * @param {boolean} options.registerWithEngine - Whether to register with NPCEngine (default: true)
   * @returns {Promise<Object>} The spawned NPC with full details
   */
  async spawn(options = {}) {
    const {
      name,
      role,
      position = this.defaultSpawnPosition,
      appearance = {},
      spawnInWorld = true,
      registerWithEngine = this.autoRegisterWithEngine
    } = options;

    // Validate role
    if (!role || typeof role !== "string") {
      throw new TypeError("Role is required and must be a string");
    }

    // Generate name if not provided
    const npcName = name || this.registry.generateName(role);

    console.log(`🤖 Spawning new ${role}: ${npcName}`);

    // Step 1: Create NPC in registry (this also creates personality in learning engine)
    const npc = await this.registry.createNPC({
      name: npcName,
      role,
      appearance,
      position,
      metadata: {
        spawnedBy: "npc_spawner",
        spawnedVia: spawnInWorld ? "minecraft" : "virtual"
      }
    });

    this.emit("npc_created", npc);

    // Step 2: Register with NPC Engine for task management
    if (registerWithEngine && this.npcEngine) {
      try {
        this.npcEngine.registerNPC(npc.id, npc.role, { position });
        console.log(`📋 Registered ${npcName} with NPC Engine`);
        this.emit("npc_registered", { npc, engineId: npc.id });
      } catch (err) {
        console.error(`❌ Failed to register ${npcName} with NPC Engine:`, err.message);
      }
    }

    // Step 3: Spawn in Minecraft world
    if (spawnInWorld && this.bridge) {
      try {
        await this.bridge.ensureConnected();

        const spawnResult = await this.bridge.spawnEntity({
          npcId: npc.id,
          npcType: npc.role,
          position
        });

        await this.registry.markSpawned(npc.id, { position, spawnResult });

        console.log(
          `🌱 Spawned ${npcName} in world at (${position.x}, ${position.y}, ${position.z})`
        );

        this.emit("npc_spawned", { npc, position, spawnResult });
      } catch (err) {
        console.error(`❌ Failed to spawn ${npcName} in world:`, err.message);
        this.emit("spawn_failed", { npc, error: err });
        throw err;
      }
    }

    // Step 4: Return complete NPC data with personality
    const profile = this.learningEngine?.getProfile(npcName);
    const result = {
      ...npc,
      profile: profile || null,
      spawned: spawnInWorld,
      registeredWithEngine: registerWithEngine
    };

    console.log(
      `✨ Successfully spawned ${npcName} (${role}):\n` +
      `   ID: ${npc.id}\n` +
      `   Personality: curiosity=${profile?.personality?.curiosity?.toFixed(2)}, ` +
      `motivation=${profile?.personality?.motivation?.toFixed(2)}, ` +
      `patience=${profile?.personality?.patience?.toFixed(2)}\n` +
      `   Position: (${position.x}, ${position.y}, ${position.z})`
    );

    return result;
  }

  /**
   * Spawns multiple NPCs at once
   * @param {Array<Object>} npcList - Array of spawn options
   * @returns {Promise<Array<Object>>} Array of spawned NPCs
   */
  async spawnBatch(npcList) {
    if (!Array.isArray(npcList) || npcList.length === 0) {
      throw new TypeError("npcList must be a non-empty array");
    }

    // Check spawn limit
    const currentCount = this.registry.getAll().filter(bot => bot.status === 'active').length;
    if (currentCount + npcList.length > MAX_BOTS) {
      throw new Error(
        `Cannot spawn ${npcList.length} bot(s): would exceed maximum of ${MAX_BOTS} bots. ` +
        `Currently ${currentCount} bot(s) active. Please despawn some bots first.`
      );
    }

    console.log(`🚀 Spawning batch of ${npcList.length} NPCs...`);
    const results = [];
    const errors = [];

    for (const options of npcList) {
      try {
        const npc = await this.spawn(options);
        results.push(npc);
      } catch (err) {
        errors.push({ options, error: err.message });
        console.error(`❌ Failed to spawn NPC:`, err.message);
      }
    }

    console.log(
      `✅ Batch spawn complete: ${results.length} succeeded, ${errors.length} failed`
    );

    return { results, errors };
  }

  /**
   * Spawns a preset team of NPCs
   * @param {string} teamType - The team preset (mining, building, exploration, combat)
   * @param {Object} options - Additional options
   * @returns {Promise<Array<Object>>} Array of spawned NPCs
   */
  async spawnTeam(teamType, options = {}) {
    const { position = this.defaultSpawnPosition, namePrefix = null } = options;

    const teams = {
      mining: [
        { role: "miner", name: namePrefix ? `${namePrefix}_Miner_01` : null },
        { role: "miner", name: namePrefix ? `${namePrefix}_Miner_02` : null },
        { role: "worker", name: namePrefix ? `${namePrefix}_Worker_01` : null }
      ],
      building: [
        { role: "builder", name: namePrefix ? `${namePrefix}_Builder_01` : null },
        { role: "builder", name: namePrefix ? `${namePrefix}_Builder_02` : null },
        { role: "crafter", name: namePrefix ? `${namePrefix}_Crafter_01` : null }
      ],
      exploration: [
        { role: "scout", name: namePrefix ? `${namePrefix}_Scout_01` : null },
        { role: "explorer", name: namePrefix ? `${namePrefix}_Explorer_01` : null },
        { role: "gatherer", name: namePrefix ? `${namePrefix}_Gatherer_01` : null }
      ],
      combat: [
        { role: "fighter", name: namePrefix ? `${namePrefix}_Fighter_01` : null },
        { role: "fighter", name: namePrefix ? `${namePrefix}_Fighter_02` : null },
        { role: "guard", name: namePrefix ? `${namePrefix}_Guard_01` : null }
      ],
      farming: [
        { role: "farmer", name: namePrefix ? `${namePrefix}_Farmer_01` : null },
        { role: "farmer", name: namePrefix ? `${namePrefix}_Farmer_02` : null },
        { role: "gatherer", name: namePrefix ? `${namePrefix}_Gatherer_01` : null }
      ],
      balanced: [
        { role: "miner", name: namePrefix ? `${namePrefix}_Miner` : null },
        { role: "builder", name: namePrefix ? `${namePrefix}_Builder` : null },
        { role: "scout", name: namePrefix ? `${namePrefix}_Scout` : null },
        { role: "guard", name: namePrefix ? `${namePrefix}_Guard` : null }
      ]
    };

    const teamConfig = teams[teamType];
    if (!teamConfig) {
      throw new Error(
        `Unknown team type: ${teamType}. Valid types: ${Object.keys(teams).join(", ")}`
      );
    }

    // Check spawn limit
    const currentCount = this.registry.getAll().filter(bot => bot.status === 'active').length;
    if (currentCount + teamConfig.length > MAX_BOTS) {
      throw new Error(
        `Cannot spawn ${teamType} team (${teamConfig.length} bots): would exceed maximum of ${MAX_BOTS} bots. ` +
        `Currently ${currentCount} bot(s) active. Please despawn some bots first.`
      );
    }

    console.log(`👥 Spawning ${teamType} team...`);

    // Add position to each NPC
    const npcList = teamConfig.map((npc, index) => ({
      ...npc,
      position: {
        x: position.x + index * 2,
        y: position.y,
        z: position.z
      }
    }));

    return this.spawnBatch(npcList);
  }

  /**
   * Despawns an NPC from the world
   * @param {string} npcIdOrName - The NPC ID or name
   * @returns {Promise<Object>} The despawned NPC
   */
  async despawn(npcIdOrName) {
    const npc = this.registry.getNPC(npcIdOrName);
    if (!npc) {
      throw new Error(`NPC not found: ${npcIdOrName}`);
    }

    console.log(`👋 Despawning ${npc.name}...`);

    // Unregister from NPC Engine
    if (this.npcEngine && this.npcEngine.npcs.has(npc.id)) {
      this.npcEngine.unregisterNPC(npc.id);
      console.log(`📋 Unregistered ${npc.name} from NPC Engine`);
    }

    // Mark as despawned in registry
    await this.registry.markDespawned(npc.id);

    this.emit("npc_despawned", npc);
    console.log(`✅ ${npc.name} despawned`);

    return npc;
  }

  /**
   * Respawns an existing NPC
   * @param {string} npcIdOrName - The NPC ID or name
   * @param {Object} options - Respawn options
   * @returns {Promise<Object>} The respawned NPC
   */
  async respawn(npcIdOrName, options = {}) {
    const npc = this.registry.getNPC(npcIdOrName);
    if (!npc) {
      throw new Error(`NPC not found: ${npcIdOrName}`);
    }

    console.log(`🔄 Respawning ${npc.name}...`);

    // Despawn if currently spawned
    if (npc.spawned) {
      await this.despawn(npc.id);
    }

    // Spawn again
    return this.spawn({
      name: npc.name,
      role: npc.role,
      position: options.position || npc.position || this.defaultSpawnPosition,
      appearance: npc.appearance,
      spawnInWorld: options.spawnInWorld !== false,
      registerWithEngine: options.registerWithEngine !== false
    });
  }

  /**
   * Gets all spawned NPCs
   * @returns {Array<Object>} Array of spawned NPCs
   */
  getSpawnedNPCs() {
    return this.registry.getNPCs({ spawned: true });
  }

  /**
   * Gets spawn summary
   * @returns {Object} Spawn statistics
   */
  getSummary() {
    const registrySummary = this.registry.getSummary();
    const engineStatus = this.npcEngine?.getStatus() || null;

    return {
      registry: registrySummary,
      engine: engineStatus,
      bridgeConnected: this.bridge?.isConnected() || false
    };
  }

  /**
   * Sets the default spawn position
   * @param {Object} position - Position {x, y, z}
   */
  setDefaultSpawnPosition(position) {
    if (!position || typeof position.x !== "number" || typeof position.y !== "number" || typeof position.z !== "number") {
      throw new TypeError("Position must have numeric x, y, z properties");
    }
    this.defaultSpawnPosition = position;
    console.log(`📍 Default spawn position set to (${position.x}, ${position.y}, ${position.z})`);
  }
}

/**
 * Coordinates NPC profile creation, engine registration and in-world spawning.
 */
export class NPCSpawner {
  constructor(options = {}) {
    this.engine = options.engine || null;
    this.bridge = options.bridge || this.engine?.bridge || null;
    if (options.registry instanceof NPCRegistry) {
      this.registry = options.registry;
    } else if (options.registry === null || options.registry === false) {
      this.registry = null;
    } else {
      this.registry = new NPCRegistry(options.registryOptions);
    }
    this.autoSpawn = options.autoSpawn ?? this.engine?.autoSpawn ?? true;
    this.defaultPosition = options.defaultPosition || this.engine?.defaultSpawnPosition || { x: 0, y: 64, z: 0 };
    this.registryReady = null;
    this.learningEngine = options.learningEngine instanceof LearningEngine
      ? options.learningEngine
      : this.engine?.learningEngine instanceof LearningEngine
        ? this.engine.learningEngine
        : null;
    this.learningReady = this.engine?.learningReady || null;

    // Error recovery configuration
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000; // ms
    this.deadLetterQueue = [];
    this.failureCount = new Map(); // Track failures per NPC

    this.log = logger.child({ component: 'NPCSpawner' });
  }

  /**
   * Count currently spawned bots
   * @returns {number} Number of bots with status "active"
   */
  _countSpawnedBots() {
    if (!this.registry) {
      return 0;
    }
    const allBots = this.registry.getAll();
    return allBots.filter(bot => bot.status === 'active').length;
  }

  /**
   * Check if spawning additional bots would exceed the limit
   * @param {number} count - Number of bots to spawn
   * @throws {Error} If spawning would exceed MAX_BOTS limit
   */
  _checkSpawnLimit(count = 1) {
    const currentCount = this._countSpawnedBots();
    if (currentCount + count > MAX_BOTS) {
      throw new Error(
        `Cannot spawn ${count} bot(s): would exceed maximum of ${MAX_BOTS} bots. ` +
        `Currently ${currentCount} bot(s) active. Please despawn some bots first.`
      );
    }
  }

  async initialize() {
    if (!this.registryReady && this.registry) {
      this.registryReady = this.registry.load().catch(err => {
        this.log.error("Failed to load NPC registry", { error: err.message });
        throw err;
      });
    }
    if (!this.learningReady && this.learningEngine) {
      this.learningReady = this.learningEngine.initialize().catch(err => {
        this.log.error("Failed to initialize learning engine", { error: err.message });
        throw err;
      });
    }

    const readiness = [this.registryReady, this.learningReady].filter(Boolean);
    if (readiness.length === 0) {
      return Promise.resolve();
    }
    return Promise.all(readiness);
  }

  async spawn(options = {}) {
    await this.initialize();

    // Check spawn limit before proceeding
    this._checkSpawnLimit(1);

    const desiredPosition = options.position || options.spawnPosition || this.defaultPosition;

    let profile = await this._resolveProfile(options, desiredPosition);

    if (this.learningEngine) {
      try {
        await (this.learningReady || Promise.resolve());
        const learningProfile = this.learningEngine.getProfile(profile.id);
        if (learningProfile) {
          const enriched = mergeLearningIntoProfile(
            profile,
            learningProfile,
            this.learningEngine.traits
          );
          if (this.registry) {
            profile = await this.registry.upsert(enriched);
          } else {
            profile = enriched;
          }
        }
      } catch (error) {
        this.log.warn("Failed to merge learning profile", { npcId: profile.id, error: error.message });
      }
    }

    const position = desiredPosition || profile.spawnPosition || this.defaultPosition;

    this._registerWithEngine(profile, position, options);

    const shouldSpawn = (options.autoSpawn ?? this.autoSpawn) && (this.engine?.bridge || this.bridge);
    let spawnResponse = null;

    if (shouldSpawn) {
      spawnResponse = await this._spawnWithRetry(profile, position, options);
    }

    return this._finalizeSpawn(profile, position, {
      spawnResponse,
      shouldSpawn
    });
  }

  /**
   * Spawn NPC with retry logic
   */
  async _spawnWithRetry(profile, position, options) {
    const retries = options.maxRetries ?? this.maxRetries;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this.log.info("Retrying NPC spawn", { npcId: profile.id, attempt, delay });
          await this._sleep(delay);
        }

        const response = await (this.engine?.spawnNPC?.(profile.id, {
          npcType: profile.npcType,
          position,
          appearance: profile.appearance,
          metadata: profile.metadata,
          profile
        }) || this.bridge?.spawnEntity({
          npcId: profile.id,
          npcType: profile.npcType,
          position,
          appearance: profile.appearance,
          metadata: profile.metadata,
          profile
        }));

        // Success - clear failure count
        if (this.failureCount.has(profile.id)) {
          this.failureCount.delete(profile.id);
        }

        this.log.info("NPC spawned successfully", { npcId: profile.id, attempt });
        return response;

      } catch (error) {
        lastError = error;
        this.log.warn("Spawn attempt failed", {
          npcId: profile.id,
          attempt: attempt + 1,
          maxRetries: retries + 1,
          error: error.message
        });
      }
    }

    // All retries exhausted - add to dead letter queue
    this._addToDeadLetterQueue(profile, position, lastError);
    this.log.error("Failed to spawn NPC after all retries", {
      npcId: profile.id,
      retries: retries + 1,
      error: lastError.message
    });

    return null;
  }

  /**
   * Add failed spawn to dead letter queue
   */
  _addToDeadLetterQueue(profile, position, error) {
    const failCount = (this.failureCount.get(profile.id) || 0) + 1;
    this.failureCount.set(profile.id, failCount);

    this.deadLetterQueue.push({
      profile,
      position,
      error: error.message,
      failCount,
      timestamp: new Date().toISOString()
    });

    this.log.warn("NPC added to dead letter queue", {
      npcId: profile.id,
      failCount,
      queueSize: this.deadLetterQueue.length
    });
  }

  /**
   * Retry spawns from dead letter queue
   */
  async retryDeadLetterQueue(options = {}) {
    const { maxRetries = 1 } = options;
    const results = { successes: [], failures: [] };

    this.log.info("Retrying dead letter queue", { queueSize: this.deadLetterQueue.length });

    const queue = [...this.deadLetterQueue];
    this.deadLetterQueue = [];

    for (const entry of queue) {
      try {
        const response = await this._spawnWithRetry(entry.profile, entry.position, { maxRetries });
        if (response) {
          results.successes.push({ npcId: entry.profile.id, response });
        } else {
          results.failures.push({ npcId: entry.profile.id, error: 'Spawn returned null' });
        }
      } catch (error) {
        results.failures.push({ npcId: entry.profile.id, error: error.message });
      }
    }

    this.log.info("Dead letter queue retry complete", {
      successes: results.successes.length,
      failures: results.failures.length,
      remainingQueue: this.deadLetterQueue.length
    });

    return results;
  }

  /**
   * Get dead letter queue entries
   */
  getDeadLetterQueue() {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue() {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    this.failureCount.clear();
    this.log.info("Dead letter queue cleared", { count });
    return count;
  }

  /**
   * Sleep utility for retry delays
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async spawnAllKnown(options = {}) {
    await this.initialize();
    const npcs = this.registry
      ? this.registry.listActive()
      : [];

    // Count how many NPCs need to be spawned (those not already active)
    const currentlySpawned = this._countSpawnedBots();
    const toSpawn = npcs.filter(npc => npc.status !== 'active');

    // Check if spawning all would exceed limit
    if (toSpawn.length > 0) {
      this._checkSpawnLimit(toSpawn.length);
    }

    const results = [];
    for (const profile of npcs) {
      const merged = {
        ...profile,
        ...options.overrides,
        position: options.overrides?.position || profile.spawnPosition || this.defaultPosition,
        autoSpawn: options.autoSpawn
      };
      const result = await this.spawn(merged);
      results.push(result);
    }
    return results;
  }

  async _resolveProfile(options, desiredPosition) {
    if (this.registry) {
      return this.registry.ensureProfile({
        id: options.id,
        baseName: options.baseName,
        role: options.role,
        npcType: options.npcType || options.type,
        appearance: options.appearance,
        personality: options.personality,
        spawnPosition: desiredPosition,
        metadata: options.metadata,
        description: options.description
      });
    }

    const id = options.id || options.baseName || `npc_${Date.now()}`;
    const npcType = options.npcType || options.type || "builder";
    const role = options.role || npcType;
    const bundle = buildPersonalityBundle(options.personality, this.learningEngine?.traits);

    return {
      id,
      npcType,
      role,
      appearance: cloneValue(options.appearance) || {},
      spawnPosition: desiredPosition,
      personality: bundle.personality,
      personalitySummary: bundle.summary,
      personalityTraits: bundle.traits,
      metadata: applyPersonalityMetadata(cloneValue(options.metadata) || {}, bundle),
      description: options.description || null
    };
  }

  _registerWithEngine(profile, position, options) {
    if (!this.engine) {
      return;
    }

    this.engine.registerNPC(profile.id, profile.npcType, {
      position,
      role: profile.role,
      personality: profile.personality,
      appearance: profile.appearance,
      metadata: {
        ...profile.metadata,
        description: profile.description,
        personalitySummary: profile.personalitySummary,
        personalityTraits: Array.isArray(profile.personalityTraits)
          ? [...profile.personalityTraits]
          : profile.personalityTraits
      },
      profile,
      personalitySummary: profile.personalitySummary,
      personalityTraits: Array.isArray(profile.personalityTraits)
        ? [...profile.personalityTraits]
        : profile.personalityTraits,
      autoSpawn: options.autoSpawn,
      persist: options.persist
    });
  }

  async _finalizeSpawn(profile, position, context) {
    if (!this.registry) {
      return {
        ...profile,
        lastSpawnResponse: context.spawnResponse
      };
    }

    try {
      const updatedProfile = await this.registry.recordSpawn(profile.id, position, {
        increment: context.shouldSpawn,
        status: "active"
      });

      if (this.engine?.npcs.has(profile.id)) {
        const npcState = this.engine.npcs.get(profile.id);
        npcState.profile = updatedProfile;
        npcState.position = { ...position };
        npcState.personalitySummary = updatedProfile.personalitySummary;
        npcState.personalityTraits = Array.isArray(updatedProfile.personalityTraits)
          ? [...updatedProfile.personalityTraits]
          : updatedProfile.personalityTraits;
        npcState.metadata = {
          ...npcState.metadata,
          description: updatedProfile.description ?? npcState.metadata?.description,
          personalitySummary: updatedProfile.personalitySummary,
          personalityTraits: Array.isArray(updatedProfile.personalityTraits)
            ? [...updatedProfile.personalityTraits]
            : updatedProfile.personalityTraits
        };
      }

      return {
        ...updatedProfile,
        lastSpawnResponse: context.spawnResponse
      };
    } catch (error) {
      this.log.error("Failed to update registry", { npcId: profile.id, error: error.message });
    }

    return {
      ...profile,
      lastSpawnResponse: context.spawnResponse
    };
  }
}
