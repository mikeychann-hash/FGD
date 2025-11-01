// test_spawning.js
// Quick test of NPC spawning system without Minecraft connection

import { NPCRegistry } from "./npc_registry.js";
import { NPCSpawner } from "./npc_spawner.js";
import { LearningEngine } from "./learning_engine.js";
import { NPCEngine } from "./npc_engine.js";

async function testSpawning() {
  console.log("🧪 Testing NPC Spawning System\n");

  try {
    // Initialize components
    console.log("1️⃣  Initializing Learning Engine...");
    const learningEngine = new LearningEngine("./data/npc_profiles_test.json");
    await learningEngine.initialize();
    console.log("✅ Learning Engine initialized\n");

    console.log("2️⃣  Initializing NPC Registry...");
    const registry = new NPCRegistry({
      registryPath: "./data/npc_registry_test.json",
      learningEngine
    });
    await registry.initialize();
    console.log("✅ NPC Registry initialized\n");

    console.log("3️⃣  Initializing NPC Engine...");
    const npcEngine = new NPCEngine();
    console.log("✅ NPC Engine initialized\n");

    console.log("4️⃣  Initializing NPC Spawner...");
    const spawner = new NPCSpawner({
      registry,
      learningEngine,
      npcEngine,
      bridge: null, // No Minecraft connection for testing
      defaultSpawnPosition: { x: 0, y: 64, z: 0 }
    });
    console.log("✅ NPC Spawner initialized\n");

    // Test 1: Spawn individual NPC
    console.log("5️⃣  Test: Spawn individual NPC");
    const miner = await spawner.spawn({
      role: "miner",
      position: { x: 100, y: 65, z: 200 },
      spawnInWorld: false,
      registerWithEngine: true
    });
    console.log(`✅ Spawned ${miner.name} (${miner.id})`);
    console.log(`   Personality: curiosity=${miner.personality.curiosity.toFixed(2)}, motivation=${miner.personality.motivation.toFixed(2)}`);
    console.log(`   Registered with engine: ${miner.registeredWithEngine}\n`);

    // Test 2: Spawn with custom name
    console.log("6️⃣  Test: Spawn with custom name");
    const builder = await spawner.spawn({
      name: "Architect_Alpha",
      role: "builder",
      position: { x: 102, y: 65, z: 200 },
      spawnInWorld: false
    });
    console.log(`✅ Spawned ${builder.name} (${builder.id})`);
    console.log(`   Role: ${builder.role}\n`);

    // Test 3: Spawn batch
    console.log("7️⃣  Test: Spawn batch of NPCs");
    const batch = await spawner.spawnBatch([
      { role: "scout", position: { x: 0, y: 64, z: 0 }, spawnInWorld: false },
      { role: "guard", position: { x: 2, y: 64, z: 0 }, spawnInWorld: false },
      { role: "farmer", position: { x: 4, y: 64, z: 0 }, spawnInWorld: false }
    ]);
    console.log(`✅ Batch spawn: ${batch.results.length} succeeded, ${batch.errors.length} failed\n`);

    // Test 4: Get registry summary
    console.log("8️⃣  Test: Get registry summary");
    const summary = registry.getSummary();
    console.log(`✅ Registry Summary:`);
    console.log(`   Total NPCs: ${summary.total}`);
    console.log(`   Spawned: ${summary.spawned}`);
    console.log(`   By Role:`, summary.byRole);
    console.log();

    // Test 5: Get NPC by name
    console.log("9️⃣  Test: Get NPC by name");
    const retrieved = registry.getNPC("Architect_Alpha");
    console.log(`✅ Retrieved: ${retrieved.name} (${retrieved.id})`);
    console.log(`   Role: ${retrieved.role}`);
    console.log(`   Spawned: ${retrieved.spawned}\n`);

    // Test 6: Task assignment
    console.log("🔟 Test: Assign task to NPC");
    const engineStatus = npcEngine.getStatus();
    console.log(`   NPCs registered in engine: ${engineStatus.total}`);
    console.log(`   Idle NPCs: ${engineStatus.idle}`);

    if (engineStatus.idle > 0) {
      await npcEngine.handleCommand("mine some iron ore");
      const afterTask = npcEngine.getStatus();
      console.log(`✅ Task assigned. Working NPCs: ${afterTask.working}\n`);
    }

    // Test 7: Learning engine integration
    console.log("1️⃣1️⃣  Test: Record task and sync stats");
    await learningEngine.recordTask(miner.name, "mining", true);
    await registry.syncStats(miner.id);
    const updated = registry.getNPC(miner.id);
    console.log(`✅ Task recorded for ${miner.name}`);
    console.log(`   Tasks Completed: ${updated.stats.tasksCompleted}`);
    console.log(`   XP: ${updated.stats.xp}`);
    console.log(`   Motivation: ${updated.personality.motivation.toFixed(2)}\n`);

    // Cleanup
    console.log("🧹 Cleaning up...");
    await learningEngine.destroy();
    await registry.destroy();
    console.log("✅ Cleanup complete\n");

    console.log("🎉 All tests passed!\n");
    return true;

  } catch (err) {
    console.error("\n❌ Test failed:", err.message);
    console.error(err.stack);
    return false;
  }
}

// Run tests
testSpawning().then(success => {
  process.exit(success ? 0 : 1);
});
