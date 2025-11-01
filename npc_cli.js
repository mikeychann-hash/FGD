#!/usr/bin/env node
// npc_cli.js
// Command-line interface for managing NPCs

import { NPCEngine } from "./npc_engine.js";
import { MinecraftBridge } from "./minecraft_bridge.js";

const commands = {
  list: "List all NPCs",
  create: "Create a new NPC (usage: create <role> [name])",
  spawn: "Spawn an NPC in Minecraft (usage: spawn <npc-id>)",
  "spawn-all": "Spawn all registered NPCs",
  info: "Show detailed info about an NPC (usage: info <npc-id>)",
  status: "Show engine status",
  learning: "Show learning profiles",
  remove: "Remove an NPC from registry (usage: remove <npc-id>)",
  help: "Show this help message"
};

const rolePresets = {
  miner: {
    personality: {
      curiosity: 0.6,
      patience: 0.8,
      motivation: 0.9,
      empathy: 0.4,
      aggression: 0.3,
      creativity: 0.3,
      loyalty: 0.8
    },
    appearance: { skin: "default", outfit: "overalls" },
    description: "Dedicated miner focused on resource extraction"
  },
  builder: {
    personality: {
      curiosity: 0.7,
      patience: 0.9,
      motivation: 0.85,
      empathy: 0.6,
      aggression: 0.2,
      creativity: 0.95,
      loyalty: 0.7
    },
    appearance: { skin: "default", outfit: "architect" },
    description: "Skilled builder for construction projects"
  },
  scout: {
    personality: {
      curiosity: 0.95,
      patience: 0.5,
      motivation: 0.8,
      empathy: 0.6,
      aggression: 0.4,
      creativity: 0.7,
      loyalty: 0.65
    },
    appearance: { skin: "leather_armor", outfit: "traveler" },
    description: "Explorer focused on discovery and reconnaissance"
  },
  guard: {
    personality: {
      curiosity: 0.3,
      patience: 0.7,
      motivation: 0.85,
      empathy: 0.5,
      aggression: 0.9,
      creativity: 0.2,
      loyalty: 0.95
    },
    appearance: { skin: "iron_armor", outfit: "sentinel" },
    description: "Vigilant protector and defender"
  },
  gatherer: {
    personality: {
      curiosity: 0.7,
      patience: 0.85,
      motivation: 0.8,
      empathy: 0.7,
      aggression: 0.2,
      creativity: 0.5,
      loyalty: 0.75
    },
    appearance: { skin: "default", outfit: "farmer" },
    description: "Resource gatherer and forager"
  }
};

/**
 * Initialize the NPC engine
 */
async function initEngine(options = {}) {
  const engine = new NPCEngine({
    autoSpawn: false,
    defaultSpawnPosition: { x: 0, y: 64, z: 0 },
    autoRegisterFromRegistry: true,
    ...options
  });

  await engine.registryReady;
  await engine.learningReady;
  return engine;
}

/**
 * List all NPCs
 */
async function listNPCs(engine) {
  const npcs = engine.registry.listActive();
  if (npcs.length === 0) {
    console.log("📭 No active NPCs found.");
    return;
  }

  console.log(`\n📋 Active NPCs (${npcs.length}):\n`);
  for (const npc of npcs) {
    console.log(`🤖 ${npc.id}`);
    console.log(`   Role: ${npc.role}`);
    console.log(`   Type: ${npc.npcType}`);
    console.log(`   Personality: ${npc.personalitySummary}`);
    if (npc.description) {
      console.log(`   Description: ${npc.description}`);
    }
    console.log(`   Status: ${npc.status}`);
    console.log(`   Spawn Count: ${npc.spawnCount}`);
    if (npc.lastSpawnedAt) {
      console.log(`   Last Spawned: ${new Date(npc.lastSpawnedAt).toLocaleString()}`);
    }
    console.log();
  }
}

/**
 * Create a new NPC
 */
async function createNPC(engine, role, customName) {
  if (!role) {
    console.error("❌ Role is required. Available roles: miner, builder, scout, guard, gatherer");
    return;
  }

  const preset = rolePresets[role.toLowerCase()];
  if (!preset) {
    console.error(`❌ Unknown role: ${role}`);
    console.log("Available roles:", Object.keys(rolePresets).join(", "));
    return;
  }

  console.log(`\n🔨 Creating ${role} NPC...`);
  const options = {
    baseName: customName || role,
    role: role,
    npcType: role,
    ...preset,
    autoSpawn: false
  };

  const npc = await engine.createNPC(options);
  console.log(`\n✅ Created NPC: ${npc.id}`);
  console.log(`   Personality: ${npc.personalitySummary}`);
  console.log(`   Traits: ${npc.personalityTraits?.join(", ") || "None"}`);
  console.log(`   Saved to registry: ${engine.registry.registryPath}`);
  console.log(`\n💡 Use "spawn ${npc.id}" to spawn this NPC in Minecraft`);
}

/**
 * Show detailed info about an NPC
 */
async function showNPCInfo(engine, npcId) {
  if (!npcId) {
    console.error("❌ NPC ID is required");
    return;
  }

  const npc = engine.registry.get(npcId);
  if (!npc) {
    console.error(`❌ NPC not found: ${npcId}`);
    return;
  }

  console.log(`\n🤖 NPC Details: ${npc.id}\n`);
  console.log(`Type: ${npc.npcType}`);
  console.log(`Role: ${npc.role}`);
  console.log(`Status: ${npc.status}`);
  console.log(`Description: ${npc.description || "None"}`);
  console.log(`\n📊 Spawn History:`);
  console.log(`  Spawn Count: ${npc.spawnCount}`);
  console.log(`  Last Spawned: ${npc.lastSpawnedAt ? new Date(npc.lastSpawnedAt).toLocaleString() : "Never"}`);
  console.log(`  Last Despawned: ${npc.lastDespawnedAt ? new Date(npc.lastDespawnedAt).toLocaleString() : "Never"}`);

  console.log(`\n📍 Position:`);
  if (npc.spawnPosition) {
    console.log(`  Spawn: (${npc.spawnPosition.x}, ${npc.spawnPosition.y}, ${npc.spawnPosition.z})`);
  }
  if (npc.lastKnownPosition) {
    console.log(`  Last Known: (${npc.lastKnownPosition.x}, ${npc.lastKnownPosition.y}, ${npc.lastKnownPosition.z})`);
  }

  console.log(`\n🧠 Personality:`);
  console.log(`  Summary: ${npc.personalitySummary}`);
  console.log(`  Traits:`);
  if (npc.personalityTraits) {
    for (const trait of npc.personalityTraits) {
      console.log(`    • ${trait}`);
    }
  }
  if (npc.personality) {
    console.log(`  Values:`);
    for (const [key, value] of Object.entries(npc.personality)) {
      const bar = "█".repeat(Math.round(value * 10)) + "░".repeat(10 - Math.round(value * 10));
      console.log(`    ${key.padEnd(12)}: ${bar} ${(value * 100).toFixed(0)}%`);
    }
  }

  if (npc.metadata?.learning) {
    const learning = npc.metadata.learning;
    console.log(`\n📚 Learning Stats:`);
    console.log(`  XP: ${learning.xp} (Level ${Math.floor(learning.xp / 10)})`);
    console.log(`  Tasks Completed: ${learning.tasksCompleted}`);
    console.log(`  Tasks Failed: ${learning.tasksFailed}`);
    const successRate = learning.tasksCompleted / (learning.tasksCompleted + learning.tasksFailed) * 100;
    console.log(`  Success Rate: ${successRate.toFixed(1)}%`);

    if (learning.skills) {
      console.log(`  Skills:`);
      for (const [skill, level] of Object.entries(learning.skills)) {
        const bar = "█".repeat(Math.round(level)) + "░".repeat(10 - Math.round(level));
        console.log(`    ${skill.padEnd(12)}: ${bar} ${level}/10`);
      }
    }
  }

  console.log();
}

/**
 * Show engine status
 */
function showStatus(engine) {
  const status = engine.getStatus();
  console.log(`\n📊 Engine Status:\n`);
  console.log(`Total NPCs: ${status.total}`);
  console.log(`Idle: ${status.idle}`);
  console.log(`Working: ${status.working}`);
  console.log(`Queue Length: ${status.queueLength}/${status.maxQueueSize}`);
  console.log(`Bridge Connected: ${status.bridgeConnected ? "✅" : "❌"}`);
  console.log();
}

/**
 * Show learning profiles
 */
function showLearning(engine) {
  if (!engine.learningEngine) {
    console.log("❌ Learning engine not initialized");
    return;
  }

  const profiles = engine.learningEngine.getAllProfiles();
  if (profiles.length === 0) {
    console.log("📭 No learning profiles found.");
    return;
  }

  console.log(`\n📚 Learning Profiles (${profiles.length}):\n`);
  for (const profile of profiles) {
    console.log(`🧠 ${profile.id}`);
    console.log(`   XP: ${profile.xp} (Level ${Math.floor(profile.xp / 10)})`);
    console.log(`   Tasks: ${profile.tasksCompleted} completed, ${profile.tasksFailed} failed`);
    const successRate = profile.tasksCompleted / (profile.tasksCompleted + profile.tasksFailed) * 100;
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);

    if (profile.skills) {
      const topSkills = Object.entries(profile.skills)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([skill, level]) => `${skill}:${level}`)
        .join(", ");
      console.log(`   Top Skills: ${topSkills}`);
    }
    console.log();
  }
}

/**
 * Remove an NPC
 */
async function removeNPC(engine, npcId) {
  if (!npcId) {
    console.error("❌ NPC ID is required");
    return;
  }

  const npc = engine.registry.get(npcId);
  if (!npc) {
    console.error(`❌ NPC not found: ${npcId}`);
    return;
  }

  await engine.registry.markInactive(npcId);
  console.log(`✅ Marked ${npcId} as inactive`);
}

/**
 * Show help
 */
function showHelp() {
  console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
  console.log(`║  NPC Management CLI                                       ║`);
  console.log(`╚═══════════════════════════════════════════════════════════╝\n`);
  console.log("Available commands:\n");
  for (const [cmd, desc] of Object.entries(commands)) {
    console.log(`  ${cmd.padEnd(15)} - ${desc}`);
  }
  console.log("\nAvailable roles:");
  console.log(`  ${Object.keys(rolePresets).join(", ")}`);
  console.log("\nExamples:");
  console.log(`  node npc_cli.js list`);
  console.log(`  node npc_cli.js create miner`);
  console.log(`  node npc_cli.js create builder "Master_Builder"`);
  console.log(`  node npc_cli.js info miner_01`);
  console.log(`  node npc_cli.js spawn miner_01`);
  console.log(`  node npc_cli.js spawn-all`);
  console.log();
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    showHelp();
    return;
  }

  try {
    const engine = await initEngine();
    console.log("✅ Engine initialized");

    switch (command) {
      case "list":
        await listNPCs(engine);
        break;

      case "create":
        await createNPC(engine, args[1], args[2]);
        break;

      case "spawn":
        if (!engine.bridge) {
          console.error("❌ Minecraft bridge not configured");
          console.log("💡 To enable spawning, configure RCON connection in the code");
        } else {
          console.log(`🎮 Spawning ${args[1]} in Minecraft...`);
          await engine.spawnNPC(args[1]);
          console.log("✅ Spawn command sent");
        }
        break;

      case "spawn-all":
        if (!engine.bridge) {
          console.error("❌ Minecraft bridge not configured");
          console.log("💡 To enable spawning, configure RCON connection in the code");
        } else {
          console.log("🎮 Spawning all NPCs in Minecraft...");
          await engine.spawnAllKnownNPCs();
          console.log("✅ Spawn commands sent");
        }
        break;

      case "info":
        await showNPCInfo(engine, args[1]);
        break;

      case "status":
        showStatus(engine);
        break;

      case "learning":
        showLearning(engine);
        break;

      case "remove":
        await removeNPC(engine, args[1]);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log("Run 'node npc_cli.js help' for usage information");
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  });
}

export { main as runCLI };
