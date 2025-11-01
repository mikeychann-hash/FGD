// examples/spawn_npcs_demo.js
// Comprehensive demo of the NPC spawning system with personalities

import { NPCRegistry } from "../npc_registry.js";
import { NPCSpawner } from "../npc_spawner.js";
import { LearningEngine } from "../learning_engine.js";
import { NPCEngine } from "../npc_engine.js";
import { MinecraftBridge } from "../bridges/minecraft_bridge.js";

/**
 * Demo: Spawn individual NPCs with personalities
 */
async function demoIndividualSpawning() {
  console.log("\n=== Demo 1: Individual NPC Spawning ===\n");

  // Initialize components
  const learningEngine = new LearningEngine("./data/npc_profiles.json");
  await learningEngine.initialize();

  const registry = new NPCRegistry({
    registryPath: "./data/npc_registry.json",
    learningEngine
  });
  await registry.initialize();

  const npcEngine = new NPCEngine();

  const bridge = new MinecraftBridge({
    host: "127.0.0.1",
    port: 25575,
    password: "your_rcon_password",
    connectOnCreate: false // Don't connect for demo
  });

  const spawner = new NPCSpawner({
    registry,
    learningEngine,
    npcEngine,
    bridge,
    defaultSpawnPosition: { x: 100, y: 65, z: 200 }
  });

  // Spawn a single miner with auto-generated name
  const miner = await spawner.spawn({
    role: "miner",
    position: { x: 100, y: 65, z: 200 },
    spawnInWorld: false // Set to true to spawn in Minecraft
  });

  console.log("\nSpawned Miner:");
  console.log(`  Name: ${miner.name}`);
  console.log(`  ID: ${miner.id}`);
  console.log(`  Personality:`, miner.personality);

  // Spawn a builder with custom name
  const builder = await spawner.spawn({
    name: "Architect_Alpha",
    role: "builder",
    position: { x: 102, y: 65, z: 200 },
    spawnInWorld: false
  });

  console.log("\nSpawned Builder:");
  console.log(`  Name: ${builder.name}`);
  console.log(`  ID: ${builder.id}`);
  console.log(`  Personality:`, builder.personality);

  // Get summary
  console.log("\nSpawner Summary:", spawner.getSummary());

  await learningEngine.destroy();
  await registry.destroy();
}

/**
 * Demo: Spawn teams of NPCs
 */
async function demoTeamSpawning() {
  console.log("\n=== Demo 2: Team Spawning ===\n");

  const learningEngine = new LearningEngine("./data/npc_profiles.json");
  await learningEngine.initialize();

  const registry = new NPCRegistry({
    registryPath: "./data/npc_registry.json",
    learningEngine
  });
  await registry.initialize();

  const npcEngine = new NPCEngine();

  const spawner = new NPCSpawner({
    registry,
    learningEngine,
    npcEngine,
    bridge: null, // No bridge for demo
    defaultSpawnPosition: { x: 0, y: 64, z: 0 }
  });

  // Spawn a mining team
  const miningTeam = await spawner.spawnTeam("mining", {
    position: { x: 100, y: 65, z: 200 },
    namePrefix: "Alpha"
  });

  console.log("\nMining Team:");
  miningTeam.results.forEach(npc => {
    console.log(`  - ${npc.name} (${npc.role}) - Motivation: ${npc.personality.motivation.toFixed(2)}`);
  });

  // Spawn an exploration team
  const explorationTeam = await spawner.spawnTeam("exploration", {
    position: { x: 200, y: 65, z: 100 },
    namePrefix: "Beta"
  });

  console.log("\nExploration Team:");
  explorationTeam.results.forEach(npc => {
    console.log(`  - ${npc.name} (${npc.role}) - Curiosity: ${npc.personality.curiosity.toFixed(2)}`);
  });

  console.log("\nRegistry Summary:", registry.getSummary());

  await learningEngine.destroy();
  await registry.destroy();
}

/**
 * Demo: Batch spawning with custom configurations
 */
async function demoBatchSpawning() {
  console.log("\n=== Demo 3: Batch Spawning ===\n");

  const learningEngine = new LearningEngine("./data/npc_profiles.json");
  await learningEngine.initialize();

  const registry = new NPCRegistry({
    registryPath: "./data/npc_registry.json",
    learningEngine
  });
  await registry.initialize();

  const spawner = new NPCSpawner({
    registry,
    learningEngine,
    npcEngine: new NPCEngine(),
    bridge: null
  });

  // Spawn multiple NPCs with custom configurations
  const batch = await spawner.spawnBatch([
    { name: "Foreman_Steel", role: "builder", position: { x: 0, y: 64, z: 0 } },
    { name: "Miner_Rocky", role: "miner", position: { x: 2, y: 64, z: 0 } },
    { name: "Scout_Swift", role: "scout", position: { x: 4, y: 64, z: 0 } },
    { name: "Guard_Iron", role: "guard", position: { x: 6, y: 64, z: 0 } }
  ]);

  console.log(`\nBatch Spawn Results: ${batch.results.length} succeeded, ${batch.errors.length} failed\n`);

  batch.results.forEach(npc => {
    console.log(`✅ ${npc.name} (${npc.role})`);
    console.log(`   Personality: curiosity=${npc.personality.curiosity.toFixed(2)}, ` +
                `motivation=${npc.personality.motivation.toFixed(2)}, ` +
                `patience=${npc.personality.patience.toFixed(2)}`);
  });

  await learningEngine.destroy();
  await registry.destroy();
}

/**
 * Demo: Working with NPC lifecycle (spawn, despawn, respawn)
 */
async function demoNPCLifecycle() {
  console.log("\n=== Demo 4: NPC Lifecycle Management ===\n");

  const learningEngine = new LearningEngine("./data/npc_profiles.json");
  await learningEngine.initialize();

  const registry = new NPCRegistry({
    registryPath: "./data/npc_registry.json",
    learningEngine
  });
  await registry.initialize();

  const spawner = new NPCSpawner({
    registry,
    learningEngine,
    npcEngine: new NPCEngine(),
    bridge: null
  });

  // Spawn an NPC
  const npc = await spawner.spawn({
    name: "Test_Worker",
    role: "worker",
    spawnInWorld: false
  });

  console.log(`Spawned: ${npc.name} (spawned=${npc.spawned})`);

  // Despawn the NPC
  await spawner.despawn(npc.id);
  const despawned = registry.getNPC(npc.id);
  console.log(`Despawned: ${despawned.name} (spawned=${despawned.spawned})`);

  // Respawn the NPC
  const respawned = await spawner.respawn(npc.id, {
    position: { x: 50, y: 70, z: 50 }
  });
  console.log(`Respawned: ${respawned.name} at new position (${respawned.position.x}, ${respawned.position.y}, ${respawned.position.z})`);

  await learningEngine.destroy();
  await registry.destroy();
}

/**
 * Demo: Integration with task system
 */
async function demoTaskIntegration() {
  console.log("\n=== Demo 5: Task Integration ===\n");

  const learningEngine = new LearningEngine("./data/npc_profiles.json");
  await learningEngine.initialize();

  const registry = new NPCRegistry({
    registryPath: "./data/npc_registry.json",
    learningEngine
  });
  await registry.initialize();

  const npcEngine = new NPCEngine();

  const spawner = new NPCSpawner({
    registry,
    learningEngine,
    npcEngine,
    bridge: null
  });

  // Spawn a miner
  const miner = await spawner.spawn({
    name: "TaskMiner_01",
    role: "miner",
    spawnInWorld: false,
    registerWithEngine: true
  });

  console.log(`Spawned ${miner.name} and registered with NPCEngine`);

  // Assign a task
  await npcEngine.handleCommand("mine some iron ore");

  // Check engine status
  const status = npcEngine.getStatus();
  console.log("\nNPC Engine Status:");
  console.log(`  Total NPCs: ${status.total}`);
  console.log(`  Working: ${status.working}`);
  console.log(`  Idle: ${status.idle}`);

  // Record task completion in learning engine
  await learningEngine.recordTask(miner.name, "mine", true);

  // Sync stats back to registry
  await registry.syncStats(miner.id);

  const updatedNPC = registry.getNPC(miner.id);
  console.log(`\n${updatedNPC.name} Stats after task:`);
  console.log(`  Tasks Completed: ${updatedNPC.stats.tasksCompleted}`);
  console.log(`  XP: ${updatedNPC.stats.xp}`);
  console.log(`  Motivation: ${updatedNPC.personality.motivation.toFixed(2)}`);

  await learningEngine.destroy();
  await registry.destroy();
}

/**
 * Run all demos
 */
async function runAllDemos() {
  try {
    await demoIndividualSpawning();
    await demoTeamSpawning();
    await demoBatchSpawning();
    await demoNPCLifecycle();
    await demoTaskIntegration();

    console.log("\n✅ All demos completed successfully!\n");
  } catch (err) {
    console.error("\n❌ Demo failed:", err.message);
    console.error(err.stack);
  }
}

// Run demos if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllDemos();
}

export {
  demoIndividualSpawning,
  demoTeamSpawning,
  demoBatchSpawning,
  demoNPCLifecycle,
  demoTaskIntegration
};
