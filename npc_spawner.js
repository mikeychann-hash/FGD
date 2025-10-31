import { NPCRegistry } from "./npc_registry.js";
import { LearningEngine } from "./learning_engine.js";
import {
  applyPersonalityMetadata,
  buildPersonalityBundle,
  cloneValue,
  mergeLearningIntoProfile
} from "./npc_identity.js";

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
  }

  async initialize() {
    if (!this.registryReady && this.registry) {
      this.registryReady = this.registry.load().catch(err => {
        console.error("❌ Failed to load NPC registry:", err.message);
        throw err;
      });
    }
    if (!this.learningReady && this.learningEngine) {
      this.learningReady = this.learningEngine.initialize().catch(err => {
        console.error("❌ Failed to initialize learning engine:", err.message);
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
        console.error(`⚠️  Failed to merge learning profile for NPC ${profile.id}:`, error.message);
      }
    }

    const position = desiredPosition || profile.spawnPosition || this.defaultPosition;

    this._registerWithEngine(profile, position, options);

    const shouldSpawn = (options.autoSpawn ?? this.autoSpawn) && (this.engine?.bridge || this.bridge);
    let spawnResponse = null;
    let spawnSuccess = false;

    if (shouldSpawn) {
      try {
        spawnResponse = await (this.engine?.spawnNPC?.(profile.id, {
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
        spawnSuccess = this._wasSpawnSuccessful(spawnResponse);
        if (!spawnSuccess) {
          console.error(`[SPAWN FAIL] ${profile.id}:`, spawnResponse);
        }
      } catch (error) {
        console.error(`❌ Failed to spawn NPC ${profile.id}:`, error.message);
        spawnSuccess = false;
      }
    }

    return this._finalizeSpawn(profile, position, {
      spawnResponse,
      shouldSpawn,
      spawnSuccess
    });
  }

  async spawnAllKnown(options = {}) {
    await this.initialize();
    const npcs = this.registry
      ? this.registry.listActive()
      : [];
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

    if (context.shouldSpawn && !context.spawnSuccess) {
      return {
        ...profile,
        lastSpawnResponse: context.spawnResponse,
        spawnFailed: true
      };
    }

    try {
      const updatedProfile = await this.registry.recordSpawn(profile.id, position, {
        increment: context.spawnSuccess,
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
      console.error(`❌ Failed to update registry for NPC ${profile.id}:`, error.message);
    }

    return {
      ...profile,
      lastSpawnResponse: context.spawnResponse
    };
  }

  _wasSpawnSuccessful(response) {
    if (response == null) {
      return false;
    }

    const flattened = this._stringifySpawnResponse(response).toLowerCase();
    return flattened.includes("summoned") || flattened.includes("created");
  }

  _stringifySpawnResponse(response) {
    if (typeof response === "string") {
      return response;
    }

    if (Array.isArray(response)) {
      return response.map(entry => this._stringifySpawnResponse(entry)).join(" ");
    }

    if (typeof response === "object") {
      if (typeof response.response === "string") {
        return response.response;
      }
      if (typeof response.message === "string") {
        return response.message;
      }
      if (typeof response.result === "string") {
        return response.result;
      }
      return JSON.stringify(response);
    }

    return String(response ?? "");
  }
}
