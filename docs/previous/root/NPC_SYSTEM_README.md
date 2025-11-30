# NPC Spawning & Identity Management System

A comprehensive system for creating, managing, and spawning AI-driven NPCs in Minecraft with persistent identities, personalities, and learning capabilities.

## 🎯 Features

- **Automatic Identity Generation** - Unique IDs like `miner_01`, `builder_02` automatically created
- **Personality System** - 7 personality traits with human-readable summaries
- **Persistent Storage** - Registry and learning profiles saved to disk
- **Skill Progression** - NPCs learn and improve: mining, building, gathering, exploring, guard
- **Minecraft Integration** - Spawn NPCs via RCON commands
- **Position Tracking** - Tracks spawn history and last known positions
- **Task Management** - Autonomous task assignment and execution
- **RESTful API** - Full HTTP API for external integrations

## 📁 Core Components

### System Files

| File | Purpose |
|------|---------|
| `npc_engine.js` | Core task manager and orchestrator |
| `npc_spawner.js` | Handles NPC profile creation and spawning |
| `npc_registry.js` | Persistent identity storage |
| `npc_identity.js` | Personality management utilities |
| `learning_engine.js` | Skill progression and XP tracking |
| `minecraft_bridge.js` | RCON integration for in-world spawning |

### Data Files

| File | Contents |
|------|----------|
| `data/npc_registry.json` | NPC profiles, personalities, positions |
| `data/npc_profiles.json` | Learning profiles with XP and skills |

## 🚀 Quick Start

### 1. Using the Demo Script

Run the comprehensive demo to see the system in action:

```bash
node npc_demo.js
```

This will:
- Initialize the NPC engine
- Load existing NPCs from registry
- Create new NPCs with different personalities
- Display detailed status and learning profiles
- Show how to spawn NPCs in Minecraft

### 2. Using the CLI

Create and manage NPCs from the command line:

```bash
# List all NPCs
node npc_cli.js list

# Create a new miner
node npc_cli.js create miner

# Create a builder with custom name
node npc_cli.js create builder "Master_Builder"

# Show detailed info
node npc_cli.js info miner_01

# Show engine status
node npc_cli.js status

# Show learning profiles
node npc_cli.js learning

# Remove an NPC
node npc_cli.js remove builder_01
```

### 3. Using the API

Start the server with NPC management enabled:

```bash
npm start
```

#### API Endpoints

**List all NPCs**
```bash
curl http://localhost:3000/api/npcs
```

**Get NPC details**
```bash
curl http://localhost:3000/api/npcs/miner_01
```

**Create a new NPC**
```bash
curl -X POST http://localhost:3000/api/npcs \
  -H "Content-Type: application/json" \
  -d '{
    "role": "miner",
    "name": "elite_miner",
    "description": "Expert tunnel excavator",
    "personality": {
      "curiosity": 0.6,
      "patience": 0.8,
      "motivation": 0.9,
      "empathy": 0.4,
      "aggression": 0.3,
      "creativity": 0.3,
      "loyalty": 0.8
    }
  }'
```

**Spawn an NPC in Minecraft** (requires RCON)
```bash
curl -X POST http://localhost:3000/api/npcs/miner_01/spawn
```

**Get engine status**
```bash
curl http://localhost:3000/api/npcs/status
```

**Get learning profiles**
```bash
curl http://localhost:3000/api/npcs/learning
```

**Remove an NPC**
```bash
curl -X DELETE http://localhost:3000/api/npcs/builder_01
```

### 4. Programmatic Usage

```javascript
import { NPCEngine } from "./npc_engine.js";
import { MinecraftBridge } from "./minecraft_bridge.js";

// Initialize engine
const engine = new NPCEngine({
  autoSpawn: false,
  defaultSpawnPosition: { x: 0, y: 64, z: 0 }
});

await engine.registryReady;
await engine.learningReady;

// Create an NPC
const npc = await engine.createNPC({
  baseName: "miner",
  role: "miner",
  npcType: "miner",
  personality: {
    curiosity: 0.7,
    patience: 0.8,
    motivation: 0.9,
    empathy: 0.5,
    aggression: 0.3,
    creativity: 0.4,
    loyalty: 0.8
  },
  description: "Expert mineral extractor",
  position: { x: 100, y: 65, z: 200 }
});

console.log(`Created: ${npc.id}`);
console.log(`Personality: ${npc.personalitySummary}`);

// Configure Minecraft bridge (optional)
const bridge = new MinecraftBridge({
  host: 'localhost',
  port: 25575,
  password: 'your-rcon-password'
});

engine.setBridge(bridge);

// Spawn in Minecraft
await engine.spawnNPC(npc.id);

// Or spawn all registered NPCs
await engine.spawnAllKnownNPCs();
```

## 🧠 Personality System

### Personality Traits

Each NPC has 7 personality traits (0.0 - 1.0 scale):

| Trait | Description |
|-------|-------------|
| **Curiosity** | Loves exploring and discovering new things |
| **Patience** | Rarely gives up on difficult tasks |
| **Motivation** | Eager to work and improve |
| **Empathy** | Works well with others |
| **Aggression** | Quick to defend and protect |
| **Creativity** | Thinks outside the box |
| **Loyalty** | Extremely loyal and dependable |

### Personality Summaries

The system generates human-readable personality summaries:
- `"neutral"` - balanced personality
- `"motivated and steady"` - high motivation and patience
- `"aggressive"` - high aggression
- `"impulsive"` - low patience
- `"balanced"` - well-rounded traits

### Personality Traits Examples

NPCs get 0-3 descriptive traits like:
- "Loves exploring and discovering new things"
- "Rarely gives up on difficult tasks"
- "⚠️ May rush through tasks"
- "Quick to defend and protect"

## 📊 Learning System

### Skills

NPCs develop 5 core skills (1-100 scale):
- **Mining** - Resource extraction
- **Building** - Construction projects
- **Gathering** - Resource collection
- **Exploring** - Discovery and reconnaissance
- **Guard** - Protection and defense

### Progression

- Earn **1 XP** per completed task
- Skills improve with practice
- Track success rate (completed vs failed tasks)
- Personality evolves based on experience

## 🎮 Minecraft Integration

### RCON Configuration

Configure RCON in your `server.properties`:
```properties
enable-rcon=true
rcon.port=25575
rcon.password=your-password
```

### Entity Mapping

NPCs spawn as different Minecraft entities:

| NPC Role | Minecraft Entity |
|----------|-----------------|
| miner | villager |
| builder | villager |
| explorer | villager |
| guard | iron_golem |
| fighter | iron_golem |

### Custom Spawn Commands

You can customize spawn behavior:

```javascript
const bridge = new MinecraftBridge({
  host: 'localhost',
  port: 25575,
  password: 'password',
  spawnCommandFormatter: (npcId, entityId, position) => {
    return `summon ${entityId} ${position.x} ${position.y} ${position.z} {CustomName:'"${npcId}"',Tags:["AICRAFT_NPC","CUSTOM"]}`;
  }
});
```

## 📋 Available NPC Roles

Pre-configured role templates with balanced personalities:

| Role | Personality Focus | Description |
|------|------------------|-------------|
| **miner** | Patience, Motivation | Dedicated resource extraction |
| **builder** | Creativity, Patience | Construction specialist |
| **scout** | Curiosity | Explorer and reconnaissance |
| **guard** | Aggression, Loyalty | Protector and defender |
| **gatherer** | Patience, Empathy | Resource collection |

## 🔧 Configuration

### Engine Options

```javascript
const engine = new NPCEngine({
  autoSpawn: false,              // Auto-spawn NPCs in Minecraft
  defaultSpawnPosition: { x: 0, y: 64, z: 0 },
  autoRegisterFromRegistry: true, // Load NPCs from registry on init
  maxQueueSize: 100,             // Max task queue size
  modelControlRatio: 0.5,        // AI autonomy level (0-1)
  requireFeedback: true          // Require task feedback
});
```

### Registry Options

```javascript
const registry = new NPCRegistry({
  registryPath: "./data/npc_registry.json"
});
```

### Learning Engine Options

```javascript
const learningEngine = new LearningEngine("./data/npc_profiles.json");
```

## 📈 Status and Monitoring

### Engine Status

```javascript
const status = engine.getStatus();
console.log(`Total NPCs: ${status.total}`);
console.log(`Idle: ${status.idle}`);
console.log(`Working: ${status.working}`);
console.log(`Queue: ${status.queueLength}/${status.maxQueueSize}`);
```

### Learning Profiles

```javascript
const profiles = engine.learningEngine.getAllProfiles();
for (const [id, profile] of Object.entries(profiles)) {
  console.log(`${id}: Level ${Math.floor(profile.xp / 10)}`);
  console.log(`  Success Rate: ${profile.tasksCompleted / (profile.tasksCompleted + profile.tasksFailed) * 100}%`);
}
```

## 🗄️ Data Persistence

All NPC data is automatically saved to JSON files:

- **Registry** saves after each NPC modification
- **Learning profiles** save after task completion
- **Debounced writes** prevent excessive I/O
- **Atomic saves** prevent data corruption

## 🔄 Task Management

### Assigning Tasks

```javascript
// Manual task assignment
await engine.handleCommand("mine some iron ore");

// Direct task dispatch
const task = {
  action: "mine",
  target: "iron_ore",
  quantity: 10
};
engine.assignTask(npc, task);
```

### Autonomous Mode

Enable AI-driven task generation:

```javascript
engine.enableModelAutonomy({
  interval: 30000,        // 30 seconds
  maxConcurrentTasks: 3,
  temperature: 0.7
});
```

## 🐛 Troubleshooting

### NPCs not spawning in Minecraft

1. Check RCON configuration in `server.properties`
2. Verify RCON password matches
3. Ensure server is running and accepting RCON connections
4. Check bridge connection: `engine.getStatus().bridgeConnected`

### Registry not persisting

1. Verify write permissions for `data/` directory
2. Check disk space
3. Look for error messages in console

### Learning profiles not updating

1. Ensure `learningEngine.initialized === true`
2. Check for task completion events
3. Verify profile exists: `engine.learningEngine.getProfile(npcId)`

## 📝 Examples

See the complete examples in:
- `npc_demo.js` - Comprehensive demonstration
- `npc_cli.js` - Command-line interface
- `server.js` - REST API implementation

## 🎉 Summary

The NPC Spawning & Identity Management System provides a complete solution for:

✅ Creating persistent NPC identities
✅ Managing personality and appearance
✅ Tracking learning and skill progression
✅ Spawning entities in Minecraft
✅ Task assignment and autonomy
✅ RESTful API integration
✅ Command-line management

All with zero manual ID management - the system handles everything automatically!
