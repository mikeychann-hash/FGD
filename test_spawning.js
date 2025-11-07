// test_spawning.js
// Quick test of NPC spawning system without Minecraft connection

import { promises as fs } from "fs";
import path from "path";

import { NPCRegistry } from "./npc_registry.js";
import { NPCSpawner } from "./npc_spawner.js";
import { LearningEngine } from "./learning_engine.js";
import { NPCEngine } from "./npc_engine.js";

const DATA_DIR = path.resolve("./data");
const TEST_REGISTRY_PATH = path.join(DATA_DIR, "npc_registry_test.json");
const TEST_PROFILES_PATH = path.join(DATA_DIR, "npc_profiles_test.json");

async function resetTestFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(TEST_REGISTRY_PATH, JSON.stringify({ version: 1, npcs: [] }, null, 2));
  await fs.writeFile(TEST_PROFILES_PATH, JSON.stringify({}, null, 2));
}

async function testSpawning() {
  console.log("🧪 Testing NPC Spawning System\n");

  try {
    await resetTestFiles();

    // Initialize components
    console.log("1️⃣  Initializing Learning Engine...");
    const learningEngine = new LearningEngine(TEST_PROFILES_PATH);
    await learningEngine.initialize();
    console.log("✅ Learning Engine initialized\n");

    console.log("2️⃣  Initializing NPC Registry...");
    const registry = new NPCRegistry({
      registryPath: TEST_REGISTRY_PATH,
      traitsGenerator: learningEngine.traits
    });
    await registry.load();
    console.log("✅ NPC Registry initialized\n");

    console.log("3️⃣  Initializing NPC Engine...");
    const npcEngine = new NPCEngine({
      registry,
      learningEngine,
      autoSpawn: false
    });
    console.log("✅ NPC Engine initialized\n");

    console.log("4️⃣  Initializing NPC Spawner...");
    const spawner = new NPCSpawner({
      registry,
      learningEngine,
      engine: npcEngine,
      autoSpawn: false,
      defaultPosition: { x: 0, y: 64, z: 0 }
    });
    console.log("✅ NPC Spawner initialized\n");

    // Test 1: Spawn individual NPC
    console.log("5️⃣  Test: Spawn individual NPC");
    const miner = await spawner.spawn({
      baseName: "TestMiner",
      role: "miner",
      position: { x: 100, y: 65, z: 200 },
      autoSpawn: false
    });
    console.log(`✅ Spawned ${miner.id}`);
    console.log(
      `   Personality: curiosity=${miner.personality.curiosity.toFixed(2)}, motivation=${miner.personality.motivation.toFixed(2)}`
    );
    console.log(`   Registered with engine: ${npcEngine.npcs.has(miner.id)}\n`);

    // Test 2: Spawn with custom role via base name
    console.log("6️⃣  Test: Spawn with custom base name");
    const builder = await spawner.spawn({
      baseName: "ArchitectAlpha",
      role: "builder",
      position: { x: 102, y: 65, z: 200 },
      autoSpawn: false
    });
    console.log(`✅ Spawned ${builder.id}`);
    console.log(`   Role: ${builder.role}\n`);

    // Test 3: Spawn multiple NPCs sequentially
    console.log("7️⃣  Test: Spawn multiple NPCs");
    const extras = [];
    const extraConfigs = [
      { baseName: "ScoutOne", role: "scout", position: { x: 0, y: 64, z: 0 } },
      { baseName: "GuardOne", role: "guard", position: { x: 2, y: 64, z: 0 } },
      { baseName: "FarmerOne", role: "farmer", position: { x: 4, y: 64, z: 0 } }
    ];
    for (const config of extraConfigs) {
      const result = await spawner.spawn({ ...config, autoSpawn: false });
      extras.push(result);
    }
    console.log(`✅ Additional spawns: ${extras.length} created\n`);

    // Test 4: Get registry summary
    console.log("8️⃣  Test: Get registry summary");
    const summary = registry.getSummary();
    console.log("✅ Registry Summary:");
    console.log(`   Total NPCs: ${summary.total}`);
    console.log(`   Active: ${summary.active}`);
    console.log("   By Role:", summary.byRole);
    console.log();

    // Test 5: Get NPC by id
    console.log("9️⃣  Test: Get NPC by id");
    const retrieved = registry.get(builder.id);
    console.log(`✅ Retrieved: ${retrieved.id}`);
    console.log(`   Role: ${retrieved.role}`);
    console.log(`   Status: ${retrieved.status}\n`);

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
    await learningEngine.recordTask(miner.id, "mining", true);
    const learningProfile = learningEngine.getProfile(miner.id);
    await registry.mergeLearningProfile(miner.id, {
      ...learningProfile,
      personality: learningProfile.personality,
      metadata: learningProfile.metadata
    });
    const updated = registry.get(miner.id);
    console.log(`✅ Task recorded for ${miner.id}`);
    console.log(`   Tasks Completed: ${learningProfile.tasksCompleted}`);
    console.log(`   XP: ${learningProfile.xp}`);
    console.log(`   Motivation: ${updated.personality.motivation.toFixed(2)}\n`);

    // Cleanup
    console.log("🧹 Cleaning up...");
    await learningEngine.destroy();
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
