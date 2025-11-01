// examples/fusion_with_spawner.js
// Example integration of NPC spawning system with the Fusion framework

import { NPCRegistry } from "../npc_registry.js";
import { NPCSpawner } from "../npc_spawner.js";
import { LearningEngine } from "../learning_engine.js";
import { NPCEngine } from "../npc_engine.js";
import { MinecraftBridge } from "../bridges/minecraft_bridge.js";

/**
 * Extended Fusion class with integrated NPC spawning
 */
export class FusionWithSpawner {
  constructor(options = {}) {
    this.config = {
      rconHost: options.rconHost || "127.0.0.1",
      rconPort: options.rconPort || 25575,
      rconPassword: options.rconPassword || "",
      registryPath: options.registryPath || "./data/npc_registry.json",
      profilesPath: options.profilesPath || "./data/npc_profiles.json",
      defaultSpawnPosition: options.defaultSpawnPosition || { x: 0, y: 64, z: 0 },
      enableUpdateServer: options.enableUpdateServer !== false,
      updatePort: options.updatePort || 3210,
      autoSpawn: options.autoSpawn ?? false
    };

    // Initialize existing components
    this.learningEngine = null;
    this.npcEngine = null;
    this.bridge = null;
    this.registry = null;
    this.spawner = null;
    this.initialized = false;
  }

  /**
   * Initialize all components
   */
  async initialize() {
    if (this.initialized) {
      console.warn("⚠️  Fusion already initialized");
      return;
    }

    console.log("🚀 Initializing Fusion with NPC Spawning...");

    // 1. Initialize Learning Engine (personalities and skills)
    console.log("📚 Initializing Learning Engine...");
    this.learningEngine = new LearningEngine(this.config.profilesPath);
    await this.learningEngine.initialize();

    // 2. Initialize NPC Registry (identities and metadata)
    console.log("📋 Initializing NPC Registry...");
    this.registry = new NPCRegistry({
      registryPath: this.config.registryPath,
      learningEngine: this.learningEngine
    });
    await this.registry.initialize();

    // 3. Initialize NPC Engine (task management)
    console.log("⚙️  Initializing NPC Engine...");
    this.npcEngine = new NPCEngine({
      autoSpawn: this.config.autoSpawn,
      defaultSpawnPosition: this.config.defaultSpawnPosition
    });

    // 4. Initialize Minecraft Bridge (RCON connection)
    console.log("🎮 Initializing Minecraft Bridge...");
    this.bridge = new MinecraftBridge({
      host: this.config.rconHost,
      port: this.config.rconPort,
      password: this.config.rconPassword,
      connectOnCreate: true,
      enableUpdateServer: this.config.enableUpdateServer,
      updatePort: this.config.updatePort
    });

    // Set bridge in NPC engine
    this.npcEngine.setBridge(this.bridge);

    // 5. Initialize NPC Spawner (coordinates everything)
    console.log("✨ Initializing NPC Spawner...");
    this.spawner = new NPCSpawner({
      registry: this.registry,
      learningEngine: this.learningEngine,
      npcEngine: this.npcEngine,
      bridge: this.bridge,
      defaultSpawnPosition: this.config.defaultSpawnPosition
    });

    // Set up event listeners
    this.setupEventListeners();

    this.initialized = true;
    console.log("✅ Fusion initialization complete!\n");

    return this;
  }

  /**
   * Set up event listeners for monitoring
   */
  setupEventListeners() {
    // Spawner events
    this.spawner.on("npc_created", (npc) => {
      console.log(`✨ NPC Created: ${npc.name} (${npc.role})`);
    });

    this.spawner.on("npc_spawned", ({ npc, position }) => {
      console.log(`🌱 NPC Spawned: ${npc.name} at (${position.x}, ${position.y}, ${position.z})`);
    });

    this.spawner.on("spawn_failed", ({ npc, error }) => {
      console.error(`❌ Spawn Failed: ${npc.name} - ${error.message}`);
    });

    // NPC Engine events
    this.npcEngine.on("task_assigned", ({ npcId, task }) => {
      console.log(`📋 Task Assigned: ${npcId} -> ${task.action} (${task.details})`);
    });

    this.npcEngine.on("task_completed", ({ npcId, success, task }) => {
      const status = success ? "✅" : "❌";
      console.log(`${status} Task Completed: ${npcId} -> ${task.action}`);

      // Record in learning engine
      if (this.learningEngine && task.action) {
        const npc = this.registry.getNPC(npcId);
        if (npc) {
          this.learningEngine.recordTask(npc.name, task.action, success)
            .then(() => this.registry.syncStats(npc.id))
            .catch(err => console.error("Failed to record task:", err.message));
        }
      }
    });

    // Bridge events
    this.bridge.on("connected", () => {
      console.log("🎮 Minecraft Bridge Connected");
    });

    this.bridge.on("disconnected", () => {
      console.log("🔌 Minecraft Bridge Disconnected");
    });
  }

  /**
   * Spawn a single NPC
   */
  async spawnNPC(options) {
    if (!this.initialized) {
      throw new Error("Fusion not initialized. Call initialize() first.");
    }
    return this.spawner.spawn(options);
  }

  /**
   * Spawn a team of NPCs
   */
  async spawnTeam(teamType, options = {}) {
    if (!this.initialized) {
      throw new Error("Fusion not initialized. Call initialize() first.");
    }
    return this.spawner.spawnTeam(teamType, options);
  }

  /**
   * Assign a task via natural language command
   */
  async assignTask(command, sender = "user") {
    if (!this.initialized) {
      throw new Error("Fusion not initialized. Call initialize() first.");
    }
    return this.npcEngine.handleCommand(command, sender);
  }

  /**
   * Get system status
   */
  getStatus() {
    if (!this.initialized) {
      return { initialized: false };
    }

    return {
      initialized: true,
      spawner: this.spawner.getSummary(),
      npcEngine: this.npcEngine.getStatus(),
      bridge: {
        connected: this.bridge.isConnected(),
        metrics: this.bridge.getMetrics()
      },
      registry: this.registry.getSummary()
    };
  }

  /**
   * Get leaderboard of NPCs by XP or skill
   */
  getLeaderboard(skillType = null) {
    if (!this.initialized) {
      throw new Error("Fusion not initialized. Call initialize() first.");
    }
    return this.learningEngine.getLeaderboard(skillType);
  }

  /**
   * Get all spawned NPCs
   */
  getSpawnedNPCs() {
    if (!this.initialized) {
      return [];
    }
    return this.spawner.getSpawnedNPCs();
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    if (!this.initialized) {
      return;
    }

    console.log("\n🛑 Shutting down Fusion...");

    if (this.registry) {
      await this.registry.destroy();
    }

    if (this.learningEngine) {
      await this.learningEngine.destroy();
    }

    if (this.bridge) {
      await this.bridge.disconnect();
    }

    this.initialized = false;
    console.log("✅ Fusion shutdown complete");
  }
}

/**
 * Example usage
 */
async function example() {
  // Create and initialize Fusion with spawner
  const fusion = new FusionWithSpawner({
    rconHost: "127.0.0.1",
    rconPort: 25575,
    rconPassword: "your_password",
    defaultSpawnPosition: { x: 0, y: 64, z: 0 }
  });

  await fusion.initialize();

  // Spawn individual NPC
  console.log("\n=== Spawning Individual NPC ===");
  const miner = await fusion.spawnNPC({
    name: "Digger_Prime",
    role: "miner",
    position: { x: 100, y: 65, z: 200 }
  });
  console.log(`Spawned: ${miner.name} with curiosity ${miner.personality.curiosity.toFixed(2)}`);

  // Spawn a mining team
  console.log("\n=== Spawning Mining Team ===");
  const team = await fusion.spawnTeam("mining", {
    position: { x: 150, y: 65, z: 250 },
    namePrefix: "Alpha"
  });
  console.log(`Spawned ${team.results.length} team members`);

  // Assign task
  console.log("\n=== Assigning Task ===");
  await fusion.assignTask("mine some iron ore");

  // Check status
  console.log("\n=== System Status ===");
  const status = fusion.getStatus();
  console.log(JSON.stringify(status, null, 2));

  // Get leaderboard
  console.log("\n=== Mining Leaderboard ===");
  const leaderboard = fusion.getLeaderboard("mining");
  leaderboard.forEach((npc, index) => {
    console.log(`${index + 1}. ${npc.name} - Skill: ${npc.skill.toFixed(2)}, XP: ${npc.xp}`);
  });

  // Shutdown
  await fusion.shutdown();
}

// Run example if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  example().catch(err => {
    console.error("❌ Example failed:", err.message);
    process.exit(1);
  });
}

export default FusionWithSpawner;
