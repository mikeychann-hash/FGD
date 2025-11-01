// ai/npc_spawner.js
// High-level NPC spawning system that creates bots with personalities

import EventEmitter from "events";

/**
 * NPC Spawner - Creates and spawns NPCs with integrated personalities
 * Coordinates between NPCRegistry, LearningEngine, NPCEngine, and MinecraftBridge
 */
export class NPCSpawner extends EventEmitter {
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
