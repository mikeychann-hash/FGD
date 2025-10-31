# AICraft Cluster Dashboard

A beautiful, real-time monitoring dashboard for AICraft cluster management with WebSocket support, admin panel, autonomous NPC system, and theme switching.

## Features

- 🎨 Beautiful UI with smooth animations
- 🔄 Real-time updates via WebSocket
- 🌓 Dark/Light theme toggle
- 📊 Interactive charts with Chart.js
- ⚡ Complete admin control panel
- 🖥️ Node detail modals
- 🤖 **Autonomous NPC System** with learning and lifecycle management
- ♿ Accessible (WCAG compliant)

## Quick Start

```bash
npm install
npm start
```

Visit: `http://localhost:3000`

## API Endpoints

### System Endpoints
- `GET /api/health` - Health check
- `GET /api/cluster` - Cluster nodes
- `GET /api/metrics` - System metrics
- `GET /api/metrics/system` - Comprehensive system metrics
- `GET /api/fusion` - Fusion knowledge
- `GET /api/stats` - Statistics
- `GET /api/logs` - System logs
- `GET /api/nodes/:id` - Node details
- `POST /api/config` - Update config
- `POST /api/policy` - Update policy

### NPC Management Endpoints
- `GET /api/npcs` - List all NPCs (supports filtering & pagination)
- `GET /api/npcs/:id` - Get NPC details
- `POST /api/npcs` - Create new NPC
- `PUT /api/npcs/:id` - Update NPC
- `DELETE /api/npcs/:id` - Finalize/delete NPC
- `GET /api/npcs/archive/all` - Get archived NPCs
- `GET /api/npcs/deadletter/queue` - Get failed spawns
- `POST /api/npcs/deadletter/retry` - Retry failed spawns

## NPC System

The NPC system provides autonomous agent management with personality, learning, and complete lifecycle tracking.

### Quick NPC Examples

#### Create an NPC
```bash
curl -X POST http://localhost:3000/api/npcs \
  -H "Content-Type: application/json" \
  -d '{
    "role": "miner",
    "appearance": {"skin": "default", "outfit": "overalls"},
    "position": {"x": 100, "y": 64, "z": 200},
    "autoSpawn": true
  }'
```

#### Get NPC Status
```bash
curl http://localhost:3000/api/npcs/miner_01
```

#### List Active NPCs
```bash
curl "http://localhost:3000/api/npcs?status=active&limit=10"
```

#### Finalize NPC (with archive)
```bash
curl -X DELETE "http://localhost:3000/api/npcs/miner_01?preserve=false"
```

### Programmatic Usage

```javascript
import { NPCSpawner } from './npc_spawner.js';
import { NPCRegistry } from './npc_registry.js';
import { LearningEngine } from './learning_engine.js';

// Initialize components
const registry = new NPCRegistry();
await registry.load();

const learning = new LearningEngine();
await learning.initialize();

const spawner = new NPCSpawner({ registry, learningEngine: learning });

// Spawn an NPC
const npc = await spawner.spawn({
  role: 'builder',
  position: { x: 0, y: 64, z: 0 }
});

console.log(`NPC ${npc.id} spawned with personality:`, npc.personalitySummary);

// Record task completion
learning.recordTask(npc.id, 'building', true);

// Finalize when done
const finalizer = new NPCFinalizer({ registry, learningEngine: learning });
const report = await finalizer.finalizeNPC(npc.id, { reason: 'completed_work' });

console.log(`NPC completed ${report.stats.computed.totalTasks} tasks`);
console.log(`Success rate: ${report.stats.computed.successRate}%`);
```

### NPC Features

- **Personality System**: 7-trait personality (curiosity, patience, motivation, empathy, aggression, creativity, loyalty)
- **Learning Engine**: Skill progression, XP tracking, task history
- **Error Recovery**: Automatic retries with exponential backoff, dead letter queue
- **Lifecycle Management**: Complete spawn-to-archive lifecycle with statistics
- **Persistence**: All data saved to JSON files with transaction safety

### Documentation

- [NPC API Reference](docs/NPC_API.md) - Complete API documentation
- [NPC Architecture](docs/NPC_ARCHITECTURE.md) - System architecture and design

### Running Tests

```bash
node test/npc_system.test.js
```
