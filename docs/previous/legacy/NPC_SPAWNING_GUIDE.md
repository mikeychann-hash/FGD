# NPC Spawning & Identity System Guide

## Overview

The FGD (Fusion Game Director) now includes a complete **bot spawning system with personalities**. This system allows you to create NPCs with unique identities, personalities, and persistent data that integrates seamlessly with the existing learning engine and task management.

## Architecture

### Components

1. **`npc_registry.js`** - Centralized registry for NPC identities
   - Tracks all NPCs with unique IDs, names, and roles
   - Manages spawn state and persistent metadata
   - Provides lookup by ID or name
   - Syncs with learning engine profiles

2. **`npc_spawner.js`** - High-level spawning coordinator
   - Creates NPCs with personalities
   - Spawns NPCs in Minecraft via bridge
   - Registers NPCs with task engine
   - Manages lifecycle (spawn, despawn, respawn)

3. **`learning_engine.js`** - Personality and skill management (existing)
   - Generates unique personality traits
   - Tracks skills and XP
   - Records task completion

4. **`npc_engine.js`** - Task assignment and execution (existing)
   - Manages NPC work queue
   - Assigns tasks to NPCs
   - Tracks task progress

5. **`minecraft_bridge.js`** - Minecraft world integration (existing)
   - Spawns entities via RCON
   - Sends commands to server
   - Handles feedback

## The Missing Link: Identity + Personality

**Before:** NPCs had "minds" (personality traits) but no "bodies" (persistent identities)

**Now:** Every spawned NPC gets:
- ✅ Unique ID and name
- ✅ Personality traits (curiosity, motivation, patience, aggression)
- ✅ Role-based specialization
- ✅ Persistent profile that survives restarts
- ✅ Link between Minecraft entity and AI brain

## Quick Start

### 1. Basic Setup

```javascript
import { NPCRegistry } from "./npc_registry.js";
import { NPCSpawner } from "./npc_spawner.js";
import { LearningEngine } from "./learning_engine.js";
import { NPCEngine } from "./npc_engine.js";
import { MinecraftBridge } from "./bridges/minecraft_bridge.js";

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
  password: "your_rcon_password"
});

const spawner = new NPCSpawner({
  registry,
  learningEngine,
  npcEngine,
  bridge,
  defaultSpawnPosition: { x: 0, y: 64, z: 0 }
});
```

### 2. Spawn Individual NPCs

```javascript
// Spawn with auto-generated name
const miner = await spawner.spawn({
  role: "miner",
  position: { x: 100, y: 65, z: 200 }
});

// Spawn with custom name
const builder = await spawner.spawn({
  name: "Architect_Alpha",
  role: "builder",
  position: { x: 102, y: 65, z: 200 }
});

console.log(`${miner.name} personality:`, miner.personality);
// Output: Digger_01 personality: { curiosity: 0.75, motivation: 0.85, patience: 0.65, aggression: 0.3 }
```

### 3. Spawn Teams

```javascript
// Spawn a mining team
const miningTeam = await spawner.spawnTeam("mining", {
  position: { x: 100, y: 65, z: 200 },
  namePrefix: "Alpha"
});

// Available team types:
// - mining: 2 miners + 1 worker
// - building: 2 builders + 1 crafter
// - exploration: 1 scout + 1 explorer + 1 gatherer
// - combat: 2 fighters + 1 guard
// - farming: 2 farmers + 1 gatherer
// - balanced: 1 of each core role
```

### 4. Spawn Batch

```javascript
const batch = await spawner.spawnBatch([
  { name: "Foreman_Steel", role: "builder", position: { x: 0, y: 64, z: 0 } },
  { name: "Miner_Rocky", role: "miner", position: { x: 2, y: 64, z: 0 } },
  { name: "Scout_Swift", role: "scout", position: { x: 4, y: 64, z: 0 } }
]);

console.log(`Spawned ${batch.results.length} NPCs`);
```

### 5. Manage Lifecycle

```javascript
// Despawn
await spawner.despawn("Miner_Rocky");

// Respawn at new location
await spawner.respawn("Miner_Rocky", {
  position: { x: 50, y: 70, z: 50 }
});

// Get all spawned NPCs
const spawned = spawner.getSpawnedNPCs();
```

## Valid NPC Roles

- **miner** - Specializes in mining tasks
- **builder** - Specializes in building/construction
- **scout** - Fast exploration and reconnaissance
- **explorer** - Long-range exploration
- **farmer** - Farming and crop management
- **gatherer** - Resource gathering
- **guard** - Defense and patrol
- **fighter** - Combat specialist
- **crafter** - Crafting and item creation
- **support** - Support and assistance
- **worker** - General labor

## Personality Traits

Each NPC gets unique personality traits (0.0 to 1.0):

- **curiosity** - How likely to explore and try new things
- **motivation** - Work ethic and task completion drive
- **patience** - Ability to persist through difficult tasks
- **aggression** - Combat tendencies and assertiveness

These traits affect task assignment preferences and learning rates.

## Data Persistence

### NPC Registry (`data/npc_registry.json`)

Stores NPC identities and metadata:
```json
{
  "id": "miner_a1b2c3d4",
  "name": "Digger_01",
  "role": "miner",
  "personality": { "curiosity": 0.75, "motivation": 0.85, ... },
  "spawned": true,
  "position": { "x": 100, "y": 65, "z": 200 },
  "stats": { "tasksCompleted": 5, "xp": 15 }
}
```

### NPC Profiles (`data/npc_profiles.json`)

Learning engine stores detailed skills and history:
```json
{
  "Digger_01": {
    "skills": { "mining": 5.5, "building": 1.0, ... },
    "personality": { ... },
    "xp": 15,
    "tasksCompleted": 5,
    "tasksFailed": 1
  }
}
```

## Integration with Existing Systems

### Task Assignment

```javascript
// Spawn and register with NPC engine
const npc = await spawner.spawn({
  name: "TaskWorker_01",
  role: "miner",
  registerWithEngine: true
});

// NPC is now available for tasks
await npcEngine.handleCommand("mine some iron ore");

// Task is automatically assigned to available miner
```

### Learning and XP

```javascript
// Record task completion
await learningEngine.recordTask(npc.name, "mine", true);

// Sync stats back to registry
await registry.syncStats(npc.id);

// Check updated stats
const updated = registry.getNPC(npc.id);
console.log(`XP: ${updated.stats.xp}, Motivation: ${updated.personality.motivation}`);
```

### Minecraft Integration

```javascript
// Spawns as villager with custom name tag
const npc = await spawner.spawn({
  role: "miner",
  position: { x: 100, y: 65, z: 200 },
  spawnInWorld: true  // Actually spawns in Minecraft
});

// Spawned entity command:
// /summon minecraft:villager 100 65 200 {CustomName:'"miner_a1b2c3d4"',Tags:["AICRAFT_NPC"]}
```

## Advanced Usage

### Custom Appearance

```javascript
const npc = await spawner.spawn({
  name: "Elite_Guard",
  role: "guard",
  appearance: {
    model: "minecraft:iron_golem",
    skin: "elite_guard"
  }
});
```

### Event Handling

```javascript
spawner.on("npc_created", (npc) => {
  console.log(`Created: ${npc.name}`);
});

spawner.on("npc_spawned", ({ npc, position }) => {
  console.log(`Spawned ${npc.name} at ${position.x}, ${position.y}, ${position.z}`);
});

spawner.on("spawn_failed", ({ npc, error }) => {
  console.error(`Failed to spawn ${npc.name}: ${error.message}`);
});
```

### Query Registry

```javascript
// Get all miners
const miners = registry.getNPCsByRole("miner");

// Get all spawned NPCs
const spawned = registry.getNPCs({ spawned: true });

// Get specific NPC by name or ID
const npc = registry.getNPC("Digger_01");

// Get summary
const summary = registry.getSummary();
// { total: 10, spawned: 7, byRole: { miner: 3, builder: 4, scout: 3 } }
```

## Examples

See `examples/spawn_npcs_demo.js` for complete working examples:
- Individual spawning
- Team spawning
- Batch spawning
- Lifecycle management
- Task integration

Run demos:
```bash
node examples/spawn_npcs_demo.js
```

## API Reference

### NPCSpawner

- `spawn(options)` - Spawn single NPC
- `spawnBatch(npcList)` - Spawn multiple NPCs
- `spawnTeam(teamType, options)` - Spawn preset team
- `despawn(npcIdOrName)` - Despawn NPC
- `respawn(npcIdOrName, options)` - Respawn NPC
- `getSpawnedNPCs()` - Get all spawned NPCs
- `getSummary()` - Get spawn statistics

### NPCRegistry

- `createNPC(options)` - Create new NPC identity
- `getNPC(npcIdOrName)` - Get NPC by ID or name
- `getNPCs(filters)` - Get NPCs with filters
- `getNPCsByRole(role)` - Get NPCs by role
- `updateNPC(npcId, updates)` - Update NPC data
- `deleteNPC(npcId)` - Delete NPC
- `markSpawned(npcId, info)` - Mark as spawned
- `markDespawned(npcId)` - Mark as despawned
- `syncStats(npcId)` - Sync with learning engine
- `getSummary()` - Get registry statistics

## Troubleshooting

### NPCs not spawning in Minecraft

1. Check RCON connection: `bridge.isConnected()`
2. Verify RCON credentials in bridge config
3. Check spawn position is valid (not in void/blocks)
4. Set `spawnInWorld: false` to test without Minecraft

### Personality not persisting

1. Ensure `learningEngine` is passed to registry
2. Call `await learningEngine.initialize()` before spawning
3. Check that `data/npc_profiles.json` has write permissions

### Tasks not being assigned

1. Verify `registerWithEngine: true` when spawning
2. Check NPC role matches task type
3. Use `npcEngine.getStatus()` to see registered NPCs

## Next Steps

- ✅ NPCs have identities and personalities
- ✅ NPCs can be spawned in Minecraft
- ✅ NPCs integrate with task system
- ✅ NPCs learn and gain XP

**Future enhancements:**
- Custom personality generation algorithms
- Role-based skill modifiers
- NPC relationships and teams
- Advanced behavior trees based on personality
- Voice/chat personality expressions

---

**Happy spawning!** 🤖✨
