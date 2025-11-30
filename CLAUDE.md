# FGD (Federation Governance Dashboard) - Claude Agent Guide

> **Project**: AICraft Federation Governance Dashboard  
> **Version**: 2.1.0  
> **License**: GPL-3.0  
> **Last Updated**: 2025

## Overview

FGD is a sophisticated **Minecraft NPC swarm management system** that provides autonomous bot orchestration, task planning, and real-time coordination. It serves as the control plane for spawning, governing, and coordinating AI-powered NPCs in Minecraft environments.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FGD ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────────┐ │
│  │   Desktop    │    │  REST API    │    │    WebSocket/         │ │
│  │   (Electron) │────│  (Express)   │────│    Socket.IO          │ │
│  └──────────────┘    └──────────────┘    └───────────────────────┘ │
│          │                  │                       │               │
│          └──────────────────┼───────────────────────┘               │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    NPC ENGINE (Core)                          │  │
│  │  ┌────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │  │
│  │  │ NPC        │ │ Task Queue   │ │ Autonomy Manager        │ │  │
│  │  │ Registry   │ │ Manager      │ │ (AI-driven tasks)       │ │  │
│  │  └────────────┘ └──────────────┘ └─────────────────────────┘ │  │
│  │  ┌────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │  │
│  │  │ Dispatch   │ │ Learning     │ │ NPCSpawner              │ │  │
│  │  │ Manager    │ │ Engine       │ │ (spawn pipeline)        │ │  │
│  │  └────────────┘ └──────────────┘ └─────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                             │                                       │
│          ┌──────────────────┼──────────────────┐                   │
│          ▼                  ▼                  ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Minecraft    │  │ Mineflayer   │  │ NPC Microcore            │ │
│  │ Bridge       │  │ Bridge       │  │ (per-bot runtime)        │ │
│  │ (RCON+Plugin)│  │ (Native Bots)│  └──────────────────────────┘ │
│  └──────────────┘  └──────────────┘                               │
│          │                  │                                       │
│          └────────┬─────────┘                                       │
│                   ▼                                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    MINECRAFT SERVER                           │  │
│  │                  (Paper 1.21.8 + Geyser + FGDProxyPlayer)    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend (Node.js ESM)
| Component | Technology | Purpose |
|-----------|------------|---------|
| **Runtime** | Node.js 20+ | ES Modules, native async/await |
| **HTTP Server** | Express 4.19 | REST API, static files |
| **Real-time** | Socket.IO 4.6 | WebSocket events, live updates |
| **Minecraft Bridge** | RCON + WebSocket Plugin | Server commands, bot control |
| **Native Bots** | Mineflayer 4.x | Direct bot connections |
| **Database** | PostgreSQL + Redis | Persistence, state caching |
| **Auth** | JWT + bcrypt | Token-based authentication |
| **Validation** | Zod 4.x | Schema validation |

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| **Desktop App** | Electron 33.x | Native Windows 11 shell |
| **Renderer** | Vanilla JS/HTML/CSS | Lightweight UI |

### Minecraft Integration
| Component | Technology | Purpose |
|-----------|------------|---------|
| **Server** | Paper 1.21.8 | Optimized Minecraft server |
| **Cross-play** | Geyser + ViaVersion | Bedrock + multi-version support |
| **Plugin** | FGDProxyPlayer (Java) | Bot spawning, action dispatch |

---

## Directory Structure

```
FGD-main/
├── server.js                    # Main entry point (production)
├── index.js                     # Alternative entry (legacy)
├── core_runtime.js              # Unified runtime setup
├── package.json                 # Dependencies & scripts
│
├── adapters/                    # External system adapters
│   └── mineflayer/              # Mineflayer bot control
│       ├── index.js             # MineflayerAdapter (main)
│       ├── router.js            # Task routing table
│       ├── movement.js          # Movement actions
│       ├── interaction.js       # Block/entity interactions
│       ├── inventory.js         # Inventory management
│       ├── validation.js        # Input validation
│       ├── policy_engine.js     # Action approval policies
│       └── autonomy_*.js        # Autonomous behaviors
│
├── core/                        # Core bot runtime
│   ├── npc_microcore.js         # Per-bot tick loop
│   └── progression_engine.js    # Game progression phases
│
├── npc_engine/                  # NPC management modules
│   ├── autonomy.js              # AI-driven task generation
│   ├── queue.js                 # Priority queue management
│   ├── dispatch.js              # Task execution lifecycle
│   ├── bridge.js                # Bridge communication
│   └── utils.js                 # Shared utilities
│
├── routes/                      # API route handlers
│   ├── bot.js                   # /api/bots endpoints
│   ├── action.js                # /api/action endpoints
│   ├── mineflayer.js            # /api/mineflayer v1
│   ├── mineflayer_v2.js         # /api/mineflayer v2 (policy)
│   ├── llm.js                   # /api/llm endpoints
│   └── minecraft_status.js      # Bridge health status
│
├── src/
│   ├── api/                     # Additional API modules
│   │   ├── cluster.js           # Cluster management
│   │   ├── health.js            # Health checks
│   │   ├── npcs.js              # NPC CRUD
│   │   └── progression.js       # Phase management
│   │
│   ├── config/                  # Configuration
│   │   ├── constants.js         # Server constants
│   │   ├── server.js            # Express/Socket setup
│   │   └── mineflayer.js        # Mineflayer config
│   │
│   ├── database/                # Database layer
│   │   ├── connection.js        # PostgreSQL pool
│   │   ├── redis.js             # Redis client
│   │   └── schema.js            # Table definitions
│   │
│   ├── executors/               # Task executors
│   │   ├── BaseTaskExecutor.js  # Abstract base
│   │   ├── MineTaskExecutor.js  # Mining tasks
│   │   ├── CraftTaskExecutor.js # Crafting tasks
│   │   ├── CombatTaskExecutor.js # Combat tasks
│   │   ├── MovementTaskExecutor.js # Movement
│   │   └── InventoryTaskExecutor.js # Inventory
│   │
│   ├── middleware/              # Express middleware
│   │   ├── errorHandlers.js     # Error handling
│   │   ├── rateLimiter.js       # Rate limiting
│   │   └── validate.js          # Request validation
│   │
│   ├── services/                # Core services
│   │   ├── spawn_pipeline.js    # Golden Path spawning
│   │   ├── action_pipeline/     # UAF action system
│   │   ├── mineflayer_*.js      # Mineflayer services
│   │   ├── metrics.js           # Prometheus metrics
│   │   ├── telemetry.js         # Event telemetry
│   │   └── state.js             # System state manager
│   │
│   ├── validators/              # Zod schemas
│   │   ├── bot.schemas.js       # Bot validation
│   │   ├── npc.schemas.js       # NPC validation
│   │   └── policy.schemas.js    # Policy validation
│   │
│   ├── websocket/               # WebSocket handlers
│   │   ├── handlers.js          # Event handlers
│   │   └── plugin.js            # Plugin interface
│   │
│   └── workers/                 # Background workers
│       └── task_worker.js       # Task processing
│
├── desktop/                     # Electron desktop app
│   ├── main.cjs                 # Main process
│   ├── preload.cjs              # Preload script
│   └── renderer/                # UI files
│
├── middleware/                  # Auth middleware
│   └── auth.js                  # JWT/API key auth
│
├── security/                    # Security modules
│   ├── secrets.js               # Secret management
│   ├── env-validation.js        # Env var validation
│   └── governance_validator.js  # Policy validation
│
├── tasks/                       # Task planning system
│   ├── planner_core.js          # Main planner
│   ├── planner_ai.js            # AI planning
│   ├── plan_*.js                # Domain planners
│   └── craft_*.js               # Crafting subsystem
│
├── plugins/                     # Minecraft plugins
│   └── FGDProxyPlayer/          # Java plugin source
│
├── minecraft-servers/           # Server files
│   ├── paper-1.21.8-60.jar      # Paper server
│   └── plugins/                 # Server plugins
│
├── data/                        # Runtime data
│   ├── npc_registry.json        # NPC definitions
│   ├── npc_profiles.json        # Learning profiles
│   └── state.json               # System state
│
├── docs/                        # Documentation
│   └── openapi/                 # API documentation
│       └── swagger.yaml         # OpenAPI spec
│
├── test/                        # Test suites
└── tests/                       # Additional tests
```

---

## Core Components

### 1. NPC Engine (`npc_engine.js`)

The **heart of the system** - manages all NPCs, tasks, and coordination.

```javascript
// Key capabilities:
- NPC registration and lifecycle
- Task queue management (priority-based)
- Autonomy system (AI-driven task generation)
- Bridge integration (RCON + Mineflayer)
- Microcore attachment (per-bot runtime)
- Hunger/inventory monitoring
- Learning engine integration
```

**Key APIs:**
```javascript
engine.registerNPC(id, type, options)
engine.createNPC(options)
engine.assignTask(npc, task)
engine.spawnNPC(id, options)
engine.handleCommand(inputText, sender)
engine.enableModelAutonomy(options)
```

### 2. Minecraft Bridge (`minecraft_bridge.js`)

Hybrid RCON + WebSocket plugin communication.

```javascript
// Capabilities:
- RCON command execution
- Plugin heartbeat monitoring
- Bot spawning/despawning
- Action dispatch (move, dig, place, attack)
- Inventory queries
- Telemetry events
```

**Key Events:**
```javascript
bridge.emit('bot_spawned', { botId, position, uuid })
bridge.emit('bot_action_complete', { botId, action })
bridge.emit('inventory_snapshot', { botId, slots })
bridge.emit('heartbeat', { timestamp })
```

### 3. Mineflayer Bridge (`minecraft_bridge_mineflayer.js`)

Native Mineflayer bot control for direct Minecraft connections.

```javascript
// Features:
- Direct bot spawning via mineflayer
- Pathfinding (mineflayer-pathfinder)
- Auto-eat (mineflayer-auto-eat)
- PvP combat (mineflayer-pvp)
- Block collection (mineflayer-collectblock)
```

### 4. NPC Microcore (`core/npc_microcore.js`)

Per-bot tick-based runtime loop.

```javascript
// Responsibilities:
- Physics-lite movement (interpolation)
- Area scanning at intervals
- Event processing from macro systems
- Memory context management
- Phase-aware autonomous behaviors
```

### 5. Spawn Pipeline (`src/services/spawn_pipeline.js`)

**Golden Path** for all bot spawning operations.

```javascript
// Entry point for ALL spawns:
spawnBot(npcSystem, io, { botId, position, user, source })
spawnAllBots(npcSystem, io, { user, source })
retryDeadLetters(npcSystem, io, options)
```

---

## API Reference

### Authentication

All protected routes require either:
- **JWT Token**: `Authorization: Bearer <token>`
- **API Key**: `X-API-Key: <key>`

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/minecraft/status` | Bridge status |
| `GET` | `/api/bots` | List all bots |
| `POST` | `/api/bots` | Create new bot |
| `GET` | `/api/bots/:id` | Get bot details |
| `PUT` | `/api/bots/:id` | Update bot |
| `DELETE` | `/api/bots/:id` | Deactivate bot |
| `POST` | `/api/bots/:id/spawn` | Spawn bot |
| `POST` | `/api/bots/:id/despawn` | Despawn bot |
| `POST` | `/api/bots/:id/action` | Execute action |
| `POST` | `/api/bots/:id/task` | Assign task |
| `POST` | `/api/bots/spawn-all` | Spawn all bots |
| `GET` | `/api/progression` | Get phase status |
| `PUT` | `/api/progression/phase` | Set phase |

### Mineflayer Endpoints (v1 & v2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/mineflayer` | List connected bots |
| `POST` | `/api/mineflayer/spawn` | Spawn via Mineflayer |
| `GET` | `/api/mineflayer/:botId` | Bot state |
| `POST` | `/api/mineflayer/:botId/move` | Move to position |
| `POST` | `/api/mineflayer/:botId/mine` | Mine blocks |
| `GET` | `/api/mineflayer/:botId/inventory` | Get inventory |
| `POST` | `/api/mineflayer/:botId/combat` | Combat actions |
| `POST` | `/api/mineflayer/:botId/craft` | Crafting |

### WebSocket Events

```javascript
// Client → Server
'plugin_register'    // Plugin registration
'plugin_heartbeat'   // Heartbeat ping

// Server → Client
'init'               // Initial state dump
'bot:spawned'        // Bot spawn confirmed
'bot:moved'          // Position update
'bot:status'         // Status change
'bot:task_complete'  // Task finished
'bot:inventory-update' // Inventory change
'system:status'      // System health
'cluster:update'     // Cluster state
'metrics:update'     // Performance metrics
```

---

## Configuration

### Environment Variables

```bash
# Server
PORT=3000

# Database (REQUIRED)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fgd_aicraft
DB_USER=postgres
DB_PASSWORD=<secure_password>  # REQUIRED - no default

# Authentication (REQUIRED)
ADMIN_API_KEY=<secure_key>     # REQUIRED - no default
LLM_API_KEY=<secure_key>       # REQUIRED - no default
JWT_SECRET=<secure_secret>     # Auto-generated if not set
ADMIN_PASSWORD=<password>      # Default: AdminPass123

# Minecraft
MINECRAFT_HOST=localhost
MINECRAFT_PORT=25575
RCON_PASSWORD=<password>

# LLM (optional)
OPENAI_API_KEY=<key>
ANTHROPIC_API_KEY=<key>
GROK_API_KEY=<key>
```

### Constants (`constants.js`)

```javascript
MAX_BOTS = 8                    // Max concurrent bots
DEFAULT_TICK_RATE_MS = 200      // Microcore tick rate
DEFAULT_SCAN_INTERVAL_MS = 1500 // Area scan interval
DEFAULT_SCAN_RADIUS = 5         // Scan radius (blocks)
MAX_SPAWN_RETRIES = 3           // Spawn retry attempts
MAX_QUEUE_SIZE = 100            // Task queue limit
WORLD_BOUNDS = { MIN_Y: -64, MAX_Y: 320 }
```

---

## Game Progression Phases

FGD supports a 6-phase progression system:

| Phase | Name | Focus |
|-------|------|-------|
| 1 | **Survival & Basics** | Resource gathering, shelter |
| 2 | **Resource Expansion** | Mining, early automation |
| 3 | **Infrastructure** | Mega base foundations |
| 4 | **Nether Expansion** | Nether exploration |
| 5 | **End Prep** | End portal, final prep |
| 6 | **Post-Dragon** | Expansion, automation |

Phase affects autonomous bot behavior and task priorities.

---

## Development

### Scripts

```bash
npm start              # Production server
npm run dev            # Development (watch mode)
npm run desktop        # Electron desktop app
npm test               # Run all tests
npm run test:unit      # Unit tests only
npm run test:coverage  # Coverage report
npm run lint           # ESLint
npm run lint:fix       # Auto-fix lint issues
npm run format         # Prettier formatting
```

### Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E spawn tests
npm run test:spawn-e2e

# Coverage
npm run test:coverage
```

---

## Key Design Patterns

### 1. Golden Path Spawning
All bot spawns flow through `spawn_pipeline.js`:
```
REST/CLI/UI → spawn_pipeline → npc_spawner → bridge.spawnBot → plugin confirmation → Socket.IO event
```

### 2. Event-Driven Architecture
- All state changes emit events
- WebSocket broadcasts for real-time updates
- Telemetry pipeline for metrics

### 3. Modular Task Executors
Each domain has dedicated executors:
- `MineTaskExecutor` - Mining operations
- `CombatTaskExecutor` - Combat/PvP
- `CraftTaskExecutor` - Crafting
- `MovementTaskExecutor` - Navigation
- `InventoryTaskExecutor` - Inventory management

### 4. Policy-Based Action Approval (v2)
v2 routes use `MineflayerPolicyService` for action approval before execution.

### 5. Dead Letter Queue
Failed spawns/actions go to DLQ for retry:
```javascript
npcSpawner.getDeadLetterQueue()
npcSpawner.retryDeadLetterQueue()
```

---

## Security Notes

1. **API Keys Required**: `ADMIN_API_KEY` and `LLM_API_KEY` must be set
2. **DB Password Required**: `DB_PASSWORD` must be set
3. **Rate Limiting**: All API routes are rate-limited
4. **Input Validation**: Zod schemas validate all inputs
5. **RCON Sanitization**: Commands are sanitized before execution

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "ADMIN_API_KEY not set" | Set environment variable |
| "Bot spawn limit exceeded" | Despawn some bots first (max 8) |
| "Bridge not connected" | Check RCON password, server running |
| "Plugin heartbeat stale" | Restart FGDProxyPlayer plugin |
| "Mineflayer connection failed" | Check server port (25565) |

### Health Checks

```bash
# API health
curl http://localhost:3000/api/health

# Bridge status
curl http://localhost:3000/api/minecraft/status

# Metrics
curl http://localhost:3000/metrics
```

---

## Contributing

1. Follow ESM module patterns
2. Use Zod for validation schemas
3. Emit events for state changes
4. Write tests for new features
5. Document API changes in swagger.yaml

---

## Quick Reference

### Spawn a Bot
```javascript
// Via API
POST /api/bots
{ "name": "miner_01", "role": "miner" }

POST /api/bots/miner_01/spawn
{ "position": { "x": 100, "y": 64, "z": 100 } }

// Via code
await npcEngine.createNPC({ baseName: "miner", role: "miner" });
```

### Execute an Action
```javascript
// Via API
POST /api/bots/miner_01/action
{ "type": "mine", "block": "iron_ore", "count": 5 }

// Via code
await actionPipeline.run("miner_01", { type: "mine", block: "iron_ore" });
```

### Listen for Events
```javascript
// Socket.IO client
socket.on('bot:spawned', (data) => console.log(data));
socket.on('bot:task_complete', (data) => console.log(data));
```

---

*This document is intended for AI agents (Claude, GPT, etc.) working with the FGD codebase.*
