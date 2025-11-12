// ai/npc_spawner.js
// High-level NPC spawning system that creates bots with personalities

import { NPCRegistry } from "./npc_registry.js";
import { LearningEngine } from "./learning_engine.js";
import {
  applyPersonalityMetadata,
  buildPersonalityBundle,
  cloneValue,
  mergeLearningIntoProfile
} from "./npc_identity.js";
import { logger } from "./logger.js";
import { startLoop, stopLoop } from "./core/npc_microcore.js";
import { MAX_BOTS, WORLD_BOUNDS } from "./constants.js";

/**
 * Coordinates NPC profile creation, engine registration and in-world spawning.
 */
export class NPCSpawner {
  constructor(options = {}) {
    this.engine = options.engine || null;
    this.bridge = options.bridge || this.engine?.mineflayerBridge || this.engine?.bridge || null;
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

    this.log = logger.child({ component: "NPCSpawner" });
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
    return allBots.filter(bot => bot.status === "active").length;
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

  _validatePosition(position) {
    if (!position) {
      return;
    }
    const { y } = position;
    if (typeof y === "number" && (y < WORLD_BOUNDS.MIN_Y || y > WORLD_BOUNDS.MAX_Y)) {
      throw new Error(`Spawn position y=${y} is outside world bounds (${WORLD_BOUNDS.MIN_Y} to ${WORLD_BOUNDS.MAX_Y})`);
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
    this._validatePosition(desiredPosition);

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

    const hasSpawnBridge =
      this.engine?.mineflayerBridge ||
      this.engine?.bridge ||
      this.bridge;

    const shouldSpawn = (options.autoSpawn ?? this.autoSpawn) && hasSpawnBridge;
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
          results.failures.push({ npcId: entry.profile.id, error: "Spawn returned null" });
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
    const toSpawn = npcs.filter(npc => npc.status !== "active");

    // Check if spawning all would exceed limit
    if (toSpawn.length > 0) {
      this._checkSpawnLimit(toSpawn.length);
    }

    const results = [];
    for (const profile of toSpawn) {
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

        // Initialize microcore for embodied bot behavior
        if (context.shouldSpawn && !npcState.runtime?.microcore) {
          try {
            const bridge =
              this.engine?.mineflayerBridge ||
              this.engine?.bridge ||
              this.bridge;
            const microcore = startLoop(npcState, {
              bridge,
              tickRateMs: 200,
              scanIntervalMs: 1500,
              scanRadius: 5
            });

            if (typeof this.engine.attachMicrocore === "function") {
              this.engine.attachMicrocore(profile.id, microcore, npcState.runtime);
            }

            this.log.info("Microcore initialized for bot", { npcId: profile.id });
          } catch (error) {
            this.log.warn("Failed to initialize microcore", {
              npcId: profile.id,
              error: error.message
            });
          }
        }
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
