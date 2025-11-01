#!/usr/bin/env node
// npc_demo.js
// Comprehensive demonstration of the NPC spawning and identity management system

import { NPCEngine } from "./npc_engine.js";
import { MinecraftBridge } from "./minecraft_bridge.js";

/**
 * Demonstrates the complete NPC spawning workflow
 */
async function demonstrateNPCSystem() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║  AICraft NPC Spawning & Identity Management Demo         ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  // ============================================================================
  // 1. Initialize the NPC Engine with all components
  // ============================================================================
  console.log("📦 Step 1: Initializing NPC Engine...");
  const engine = new NPCEngine({
    autoSpawn: false, // We'll control spawning manually for demo
    defaultSpawnPosition: { x: 100, y: 65, z: 200 },
    autoRegisterFromRegistry: true // Load existing NPCs from registry
  });

  // Wait for initialization
  await engine.registryReady;
  await engine.learningReady;
  console.log("✅ Engine initialized with registry and learning system\n");

  // ============================================================================
  // 2. Check existing NPCs from registry
  // ============================================================================
  console.log("📋 Step 2: Loading existing NPCs from registry...");
  const existingNPCs = engine.registry.listActive();
  console.log(`Found ${existingNPCs.length} active NPC(s):`);
  for (const npc of existingNPCs) {
    console.log(`  • ${npc.id} (${npc.role})`);
    console.log(`    Personality: ${npc.personalitySummary}`);
    console.log(`    Traits: ${npc.personalityTraits?.join(", ") || "None"}`);
    if (npc.metadata?.learning) {
      const learning = npc.metadata.learning;
      console.log(`    XP: ${learning.xp} | Tasks: ${learning.tasksCompleted}`);
      console.log(`    Skills: ${Object.entries(learning.skills || {}).map(([k, v]) => `${k}:${v}`).join(", ")}`);
    }
  }
  console.log();

  // ============================================================================
  // 3. Create new NPCs with different profiles
  // ============================================================================
  console.log("🤖 Step 3: Creating new NPCs with different profiles...\n");

  // Create a builder NPC with specific personality
  console.log("Creating Builder NPC...");
  const builder = await engine.createNPC({
    baseName: "builder",
    role: "builder",
    npcType: "builder",
    position: { x: 150, y: 65, z: 150 },
    personality: {
      curiosity: 0.8,
      patience: 0.9,
      motivation: 0.85,
      empathy: 0.6,
      aggression: 0.2,
      creativity: 0.95,
      loyalty: 0.7
    },
    appearance: {
      skin: "default",
      outfit: "architect"
    },
    description: "Master architect specializing in complex structures",
    autoSpawn: false // Don't spawn in Minecraft yet
  });
  console.log(`✅ Created: ${builder.id}`);
  console.log(`   Summary: ${builder.personalitySummary}`);
  console.log(`   Traits: ${builder.personalityTraits?.join(", ") || "None"}\n`);

  // Create a scout NPC with random personality
  console.log("Creating Scout NPC (random personality)...");
  const scout = await engine.createNPC({
    baseName: "scout",
    role: "explorer",
    npcType: "explorer",
    position: { x: 200, y: 70, z: 250 },
    // No personality specified - will be randomly generated
    appearance: {
      skin: "leather_armor",
      outfit: "traveler"
    },
    description: "Explores uncharted territories and maps new regions",
    autoSpawn: false
  });
  console.log(`✅ Created: ${scout.id}`);
  console.log(`   Summary: ${scout.personalitySummary}`);
  console.log(`   Traits: ${scout.personalityTraits?.join(", ") || "None"}\n`);

  // Create a guard NPC
  console.log("Creating Guard NPC...");
  const guard = await engine.createNPC({
    baseName: "guard",
    role: "guard",
    npcType: "guard",
    position: { x: 100, y: 65, z: 100 },
    personality: {
      curiosity: 0.3,
      patience: 0.7,
      motivation: 0.8,
      empathy: 0.5,
      aggression: 0.9,
      creativity: 0.2,
      loyalty: 0.95
    },
    appearance: {
      skin: "iron_armor",
      outfit: "sentinel"
    },
    description: "Vigilant protector of the settlement",
    autoSpawn: false
  });
  console.log(`✅ Created: ${guard.id}`);
  console.log(`   Summary: ${guard.personalitySummary}`);
  console.log(`   Traits: ${guard.personalityTraits?.join(", ") || "None"}\n`);

  // ============================================================================
  // 4. Display engine status
  // ============================================================================
  console.log("📊 Step 4: Engine Status...");
  const status = engine.getStatus();
  console.log(`Total NPCs registered: ${status.total}`);
  console.log(`Idle: ${status.idle} | Working: ${status.working}`);
  console.log(`Bridge connected: ${status.bridgeConnected}`);
  console.log("\nNPC Details:");
  for (const npc of status.npcs) {
    console.log(`  • ${npc.id} (${npc.type}/${npc.role}) - ${npc.state}`);
    console.log(`    Position: (${npc.lastKnownPosition?.x}, ${npc.lastKnownPosition?.y}, ${npc.lastKnownPosition?.z})`);
    if (npc.description) {
      console.log(`    Description: ${npc.description}`);
    }
  }
  console.log();

  // ============================================================================
  // 5. Demonstrate learning system
  // ============================================================================
  console.log("📚 Step 5: Checking Learning Profiles...");
  if (engine.learningEngine) {
    const allProfiles = Object.values(engine.learningEngine.getAllProfiles());
    console.log(`Total learning profiles: ${allProfiles.length}`);
    for (const profile of allProfiles) {
      console.log(`  • ${profile.id}`);
      console.log(`    XP: ${profile.xp} | Level: ${Math.floor(profile.xp / 10)}`);
      console.log(`    Success Rate: ${(profile.tasksCompleted / (profile.tasksCompleted + profile.tasksFailed) * 100).toFixed(1)}%`);
      const topSkills = Object.entries(profile.skills || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([skill, level]) => `${skill}:${level}`)
        .join(", ");
      console.log(`    Top Skills: ${topSkills || "None yet"}`);
    }
  }
  console.log();

  // ============================================================================
  // 6. Show how to spawn NPCs in Minecraft
  // ============================================================================
  console.log("🎮 Step 6: How to spawn NPCs in Minecraft...");
  console.log("\nTo spawn NPCs in Minecraft, you need to:");
  console.log("1. Set up a MinecraftBridge with RCON credentials:");
  console.log("   ```javascript");
  console.log("   const bridge = new MinecraftBridge({");
  console.log("     host: 'localhost',");
  console.log("     port: 25575,");
  console.log("     password: 'your-rcon-password'");
  console.log("   });");
  console.log("   engine.setBridge(bridge);");
  console.log("   ```");
  console.log("\n2. Then spawn individual NPCs:");
  console.log("   ```javascript");
  console.log("   await engine.spawnNPC('builder_01');");
  console.log("   ```");
  console.log("\n3. Or spawn all known NPCs:");
  console.log("   ```javascript");
  console.log("   await engine.spawnAllKnownNPCs();");
  console.log("   ```");
  console.log();

  // ============================================================================
  // 7. Summary
  // ============================================================================
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║  Summary                                                  ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("\n✅ The NPC Spawning & Identity System provides:");
  console.log("  • Automatic ID generation (miner_01, builder_02, etc.)");
  console.log("  • Personality system with 7 traits");
  console.log("  • Human-readable personality summaries");
  console.log("  • Persistent storage (registry + learning engine)");
  console.log("  • Skill progression (mining, building, gathering, etc.)");
  console.log("  • Minecraft integration via RCON");
  console.log("  • Position tracking and spawn history");
  console.log("  • Task assignment and autonomy");
  console.log("\n📁 Files created/used:");
  console.log(`  • Registry: ${engine.registry.registryPath}`);
  console.log(`  • Learning: ${engine.learningEngine.path}`);
  console.log("\n🎉 Demo complete! All NPCs are registered and ready to spawn.\n");
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateNPCSystem().catch(err => {
    console.error("❌ Demo failed:", err);
    process.exit(1);
  });
}

export { demonstrateNPCSystem };
