# AICraft Federation Governance Dashboard (FGD) - Comprehensive Codebase Overview

## Executive Summary
**FGD** is a full-stack Node.js control plane for managing Minecraft-based NPC swarms using a **hybrid bot architecture**. It combines:
- Centralized AI governance with LLM integration
- Embodied bot awareness (physics, movement, world scanning)
- Real-time WebSocket communication with Minecraft servers
- Persistent learning and progression systems
- Policy-driven autonomic governance
- Database-backed NPC profiles and learning repositories

**Key Technologies:**
- Runtime: Node.js (ES modules)
- Web Framework: Express.js
- Real-time Communication: Socket.io, WebSocket
- Authentication: JWT
- Databases: PostgreSQL, Redis
- Minecraft Integration: RCON, Custom Paper plugin (Java)
- LLM Integration: Multiple provider support

**Project Scale:** ~450+ files, 20,000+ lines of JavaScript, complex multi-module architecture

---

## 1. PROJECT STRUCTURE & DIRECTORY PURPOSES

### Root Directory
```
/home/user/FGD/
├── server.js                      # Main Express/Socket.io entry point (194 lines)
├── package.json                   # Node.js project configuration
├── .env.example                   # Environment variable template
├── .gitignore                     # Git ignore rules
├── node_manifest.json             # Node cluster manifest
├── governance_config.json         # Autonomic governance policies
├── cluster_config.json            # Cluster configuration
└── [Various HTML/CSS/Config Files]
    ├── admin.html / admin.js       # Admin panel UI
    ├── dashboard.html / dashboard.js # Cluster dashboard
    ├── fusion.html / fusion.js     # Fusion memory inspector
    └── style.css, theme.js         # Styling
```

### /src Directory - Modular Backend Architecture
```
/src/
├── api/                          # REST API route handlers
│   ├── cluster.js               # Cluster status, metrics, node management (155 lines)
│   ├── npcs.js                  # NPC CRUD operations (218 lines)
│   ├── progression.js           # Phase progression system (156 lines)
│   ├── health.js                # System health and telemetry (80 lines)
│   └── bot.js [in /routes]      # Bot spawning and control (728 lines)
│
├── config/                       # Configuration management
│   ├── constants.js             # Global constants, paths, defaults (44 lines)
│   ├── server.js                # Express/Socket.io setup (27 lines)
│   └── minecraft-bridge-config.js # RCON/plugin bridge config (127 lines)
│
├── database/                    # Data persistence layer
│   ├── connection.js            # PostgreSQL pool management (108 lines)
│   ├── schema.js                # Database schema initialization (123 lines)
│   ├── redis.js                 # Redis cache and pub/sub (244 lines)
│   └── repositories/
│       ├── npc_repository.js    # NPC data persistence (255 lines)
│       └── learning_repository.js # Learning data persistence (201 lines)
│
├── middleware/                  # Express middleware
│   ├── errorHandlers.js         # Global error handling (30 lines)
│   ├── auth.js [/middleware]    # JWT authentication (311 lines)
│
├── services/                    # Core business logic services
│   ├── npc_initializer.js       # NPC system initialization (221 lines)
│   ├── state.js                 # System state manager (100 lines)
│   ├── data.js                  # File system data management (106 lines)
│   ├── telemetry.js             # Metrics and telemetry pipeline (212 lines)
│
├── utils/                       # Utility classes
│   ├── circuit_breaker.js       # Circuit breaker pattern (309 lines)
│   ├── batch_processor.js       # Batch processing queues (243 lines)
│   ├── worker_pool.js           # Worker thread pool (237 lines)
│
├── websocket/                   # Real-time communication
│   ├── handlers.js              # Socket.io event handlers (35 lines)
│   ├── plugin.js                # Plugin interface abstraction (242 lines)
│
└── workers/                     # Background workers
    └── task_worker.js           # Task processing worker (182 lines)
```

### /core Directory - Local Bot Brain Systems
```
/core/
├── npc_microcore.js           # Per-bot tick loop/event handler (457 lines)
│   - 200ms tick rate for each bot
│   - Movement, pathing, awareness scanning
│   - Local state management (position, velocity, memory)
│
└── progression_engine.js      # Six-phase progression system (499 lines)
    - Phase definitions and transitions
    - Phase-aware NPC behavior adaptation
    - Automatic phase advancement logic
```

### /npc_engine Directory - NPC AI & Task Management
```
/npc_engine/
├── autonomy.js                # AI-driven autonomous task generation (134 lines)
├── queue.js                   # Priority queue and back-pressure (155 lines)
├── dispatch.js                # Task execution lifecycle (363 lines)
├── bridge.js                  # External communication interface (155 lines)
└── utils.js                   # Shared utility functions (156 lines)
```

### /routes Directory - API Route Handlers
```
/routes/
├── bot.js                     # Bot spawning, despawning, listing (728 lines)
└── llm.js                     # LLM-powered command interface (461 lines)
```

### /middleware Directory - Auth Layer
```
/middleware/
└── auth.js                    # JWT-based authentication (311 lines)
    - Default users: admin, llm, viewer
    - API key validation
    - Role-based authorization
```

### /tasks Directory - Minecraft Task Planning
```
/tasks/
├── index.js                   # Task registry and planning dispatcher (114 lines)
├── helpers.js                 # Shared task utilities (215 lines)
├── plan_*.js                  # 22 task planners for different actions
│   - plan_explore.js          # World exploration (4357 lines - LARGEST)
│   - plan_build.js            # Building/placement (3725 lines)
│   - plan_gather.js           # Resource gathering (2835 lines)
│   - plan_combat.js           # Combat tactics (2562 lines)
│   - [and 18 others for mining, crafting, interacting, etc.]
│
└── craft_*.js                 # Crafting system modules
    - craft_recipe_database.js # Recipe management (585 lines)
    - craft_automation_system.js # Automated crafting (383 lines)
    - craft_enchantment_system.js # Enchantment logic (570 lines)
    - craft_durability_manager.js # Item durability tracking (511 lines)
    - [and others for substitution, optimization, recovery, etc.]
```

### /security Directory
```
/security/
└── secrets.js                 # Secret management and validation (100 lines)
```

### /test Directory
```
/test/
├── npc_system.test.js         # NPC system tests (366 lines)
└── npc_microcore.test.js      # Microcore unit tests (26 lines)
```

### /plugins Directory - Minecraft Server Plugin
```
/plugins/FGDProxyPlayer/       # Paper/Spigot plugin (Java)
└── src/main/java/io/github/fgd/proxyplayer/
    ├── FGDProxyPlayerPlugin.java     # Main plugin class
    ├── FGDWebSocketClient.java       # WebSocket communication
    ├── BotManager.java               # Bot entity management
    ├── ActionManager.java            # Action execution
    └── ScanManager.java              # World scanning
```

### /data Directory - Persistent Data Files
```
/data/
├── npc_registry.json          # Active NPC definitions
├── npc_profiles.json          # NPC skills, traits, experience
├── fused_knowledge.json       # Collective learning outcomes
├── cluster_status.json        # Cluster metrics snapshot
├── system_logs.json           # System event logs
├── system_stats.json          # Performance statistics
└── metrics.json               # Runtime metrics
```

### /schemas Directory - JSON Schema Definitions
```
/schemas/
├── task.schema.json           # Task structure validation
└── bot-config.schema.json     # Bot configuration schema
```

### /docs Directory
```
/docs/                         # Documentation and guides
```

### Configuration Files
```
├── README.md                  # Main documentation (30KB)
├── README_HYBRID_BOTS.md      # Bot architecture guide
├── HYBRID_BOTS_SETUP.md       # Setup instructions
├── NPC_SYSTEM_README.md       # NPC lifecycle docs
├── PHASE_INTEGRATION_SUMMARY.md # Phase system docs
├── ADMIN_PANEL_INTEGRATION.md # Admin UI docs
└── [Other documentation]
```

---

## 2. ALL SOURCE CODE FILES (COMPREHENSIVE LISTING)

### ROOT LEVEL JAVASCRIPT FILES (Main Modules)

#### AI & Learning Systems
1. **learning_engine.js** (421 lines)
   - Persistent NPC profile management
   - Skill progression and XP system
   - Profile serialization/deserialization

2. **traits.js** (198 lines)
   - NPC personality trait definitions
   - Trait-based behavior modifiers

3. **npc_identity.js** (182 lines)
   - Personality bundle construction
   - Identity metadata management

4. **npc_registry.js** (393 lines)
   - Centralized NPC registry
   - Profile loading/saving
   - NPC lifecycle tracking

5. **npc_spawner.js** (448 lines)
   - High-level NPC spawning
   - Profile to engine registration
   - In-world entity spawning

6. **npc_cli.js** (410 lines)
   - Command-line interface for NPC management
   - CLI commands and argument parsing

7. **npc_demo.js** (219 lines)
   - Demo/example NPC behaviors
   - Testing harness

8. **npc_finalizer.js** (395 lines)
   - NPC cleanup and despawning
   - Profile archival

#### Task & Execution Systems
9. **task_broker.js** (740 lines)
   - Task queue management
   - Priority and scheduling
   - Back-pressure handling

10. **task_schema.js** (148 lines)
    - Task structure validation
    - Schema definitions

#### Core Engine & Governance
11. **npc_engine.js** (1104 lines)
    - Main AI task manager
    - Orchestrates autonomy, queue, dispatch managers
    - Event-driven architecture

12. **autonomic_core.js** (567 lines)
    - Self-monitoring and self-healing
    - System metrics collection
    - Policy enforcement

13. **policy_engine.js** (504 lines)
    - Governance policy management
    - Resource allocation policies
    - Behavior constraint enforcement

#### AI & Knowledge Systems
14. **knowledge_store.js** (438 lines)
    - Persistent knowledge/outcome storage
    - Learning outcome tracking

15. **learning_engine.js** (421 lines)
    - Skill progression system
    - Experience and motivation tracking

16. **interpreter.js** (355 lines)
    - Natural language command interpretation
    - Task parameter extraction

17. **model_director.js** (219 lines)
    - LLM prompt orchestration
    - Model selection and routing

#### Minecraft Integration
18. **minecraft_bridge.js** (514 lines)
    - Unified RCON + WebSocket interface
    - Bot control (movement, actions, scanning)
    - Fallback to RCON if plugin unavailable

19. **minecraft-bridge-config.js** (127 lines)
    - Bridge configuration and defaults

#### Learning & Fusion
20. **fusion_core.js** (529 lines)
    - Knowledge fusion/merging logic
    - Distributed learning synchronization

21. **fusion.js** (245 lines)
    - Fusion UI backend

22. **cognitive_link.js** (388 lines)
    - Multi-bot cognitive state synchronization
    - Shared memory/knowledge linking

#### Networking & Synchronization
23. **peer_link.js** (418 lines)
    - Node-to-node peer communication
    - Federation synchronization

24. **node_sync_manager.js** (582 lines)
    - Cluster state synchronization
    - Distributed NPC awareness

25. **node_sync_only.js** (432 lines)
    - Sync-only mode for observer nodes

#### LLM Integration
26. **llm_bridge.js** (235 lines)
    - LLM provider abstraction
    - API integration and fallback handling

#### Web Interface & Dashboards
27. **admin.js** (243 lines)
    - Admin panel backend
    - User management, bot controls

28. **dashboard.js** (588 lines)
    - Cluster metrics dashboard
    - System statistics and visualization

#### Utilities & Infrastructure
29. **logger.js** (176 lines)
    - Logging system
    - Log level management and formatting

30. **validator.js** (390 lines)
    - Data validation utilities
    - Schema validation helpers

#### Configuration & Entry Points
31. **server.js** (194 lines)
    - Main Express/Socket.io server entry point
    - Route initialization
    - Middleware setup

32. **server_old.js** (1582 lines)
    - Legacy server implementation (deprecation candidate)

33. **test_spawning.js** (159 lines)
    - NPC spawning integration tests

---

### /src/api/ - REST API Routes (5 files)

1. **cluster.js** (155 lines)
   - GET /api/cluster/status - Cluster metrics
   - GET /api/cluster/nodes - Node listings
   - POST /api/cluster/command - System commands
   - WebSocket cluster telemetry

2. **npcs.js** (218 lines)
   - GET/POST /api/npcs - List and create NPCs
   - GET/DELETE /api/npcs/:id - Individual NPC ops
   - NPC profile management

3. **progression.js** (156 lines)
   - GET /api/progression/status - Phase status
   - GET /api/progression/timeline - Phase history
   - PUT /api/progression/phase - Phase advancement

4. **health.js** (80 lines)
   - GET /api/health - System health status
   - GET /api/metrics - Performance metrics

5. **bot.js** (728 lines) [located in /routes]
   - POST /api/bots/spawn - Spawn new bot
   - DELETE /api/bots/:id - Despawn bot
   - GET /api/bots - List bots
   - Maximum bot spawn limit enforcement

---

### /src/config/ - Configuration (3 files)

1. **constants.js** (44 lines)
   - ROOT_DIR, DATA_DIR, DATA_PATH
   - DEFAULT_FUSION_DATA structure
   - DEFAULT_SYSTEM_STATE

2. **server.js** (27 lines)
   - Express app factory
   - Socket.io initialization

3. **minecraft-bridge-config.js** (127 lines)
   - RCON host/port defaults
   - Plugin interface contract definitions

---

### /src/database/ - Data Persistence (5 files)

1. **connection.js** (108 lines)
   - PostgreSQL pool management
   - Query execution
   - Transaction handling

2. **schema.js** (123 lines)
   - Database schema creation
   - Table initialization

3. **redis.js** (244 lines)
   - Redis connection management
   - CacheManager class for caching
   - MessageQueue class for pub/sub

4. **repositories/npc_repository.js** (255 lines)
   - NPC data CRUD operations
   - SQL query builders
   - Profile persistence

5. **repositories/learning_repository.js** (201 lines)
   - Learning/skill data persistence
   - Outcome tracking
   - Experience management

---

### /src/middleware/ - HTTP Middleware (2 files)

1. **errorHandlers.js** (30 lines)
   - 404 not found handler
   - Global error handler

2. **auth.js** (311 lines) [in /middleware]
   - JWT token generation/validation
   - API key authentication
   - Role-based access control (ADMIN, LLM, VIEWER)

---

### /src/services/ - Business Logic (4 files)

1. **npc_initializer.js** (221 lines)
   - NPCSystem class - orchestrates all NPC subsystems
   - Initializes registry, spawner, engine, bridge
   - Coordinates learning and autonomic systems

2. **state.js** (100 lines)
   - SystemStateManager class
   - Manages global system state
   - Socket.io state broadcasting

3. **data.js** (106 lines)
   - File system operations
   - Data directory management
   - File watcher setup

4. **telemetry.js** (212 lines)
   - Telemetry pipeline initialization
   - Metrics collection and streaming
   - Performance monitoring

---

### /src/utils/ - Utility Classes (3 files)

1. **circuit_breaker.js** (309 lines)
   - CircuitBreaker class - fault tolerance pattern
   - CircuitBreakerManager - manages multiple breakers
   - State tracking: CLOSED, OPEN, HALF_OPEN

2. **batch_processor.js** (243 lines)
   - BatchProcessor base class
   - PositionBatchProcessor - batches position updates
   - MetricsBatchProcessor - batches metric reports
   - Queue with size limits and flush intervals

3. **worker_pool.js** (237 lines)
   - WorkerPool class - manages background workers
   - Task queuing and distribution
   - Worker health monitoring

---

### /src/websocket/ - Real-time Communication (2 files)

1. **handlers.js** (35 lines)
   - Socket.io event handler initialization
   - Client connection/disconnection logic

2. **plugin.js** (242 lines)
   - PluginInterface class - WebSocket plugin abstraction
   - Method stubs for: moveBot, scanArea, dig, place, attack, etc.
   - Event emission for plugin actions

---

### /src/workers/ - Background Workers (1 file)

1. **task_worker.js** (182 lines)
   - Background task processing
   - Worker thread management
   - Task execution lifecycle

---

### /core/ - Local Bot Runtime (2 files)

1. **npc_microcore.js** (457 lines)
   - Per-bot local event loop (200ms ticks)
   - Movement simulation and physics
   - Area scanning and awareness
   - Memory management
   - **Key exports:** `startLoop()`, `stopLoop()`

2. **progression_engine.js** (499 lines)
   - Six-phase progression system
   - Phase: Survival → Wood → Stone → Iron → Diamond → Post-Dragon
   - Automatic phase detection and advancement
   - Phase-aware NPC behavior
   - Shared progression state management

---

### /npc_engine/ - NPC AI Subsystem (5 files)

1. **autonomy.js** (134 lines)
   - AutonomyManager class
   - AI-driven autonomous task generation
   - LLM-based decision making

2. **queue.js** (155 lines)
   - QueueManager class
   - Priority-based task queue
   - Back-pressure and flood prevention
   - Duplicate task suppression

3. **dispatch.js** (363 lines)
   - DispatchManager class
   - Task lifecycle management
   - Execution tracking and fallback

4. **bridge.js** (155 lines)
   - BridgeManager class
   - External communication abstraction
   - Telemetry integration

5. **utils.js** (156 lines)
   - Shared utility functions
   - Task normalization
   - Helper functions for queue/dispatch

---

### /routes/ - API Routes (2 files)

1. **bot.js** (728 lines)
   - POST /api/bots/spawn - Spawn new bot
   - DELETE /api/bots/:id - Despawn bot
   - GET /api/bots - List all bots
   - GET /api/bots/:id - Get bot details
   - Spawn limit enforcement (MAX_BOTS = 8)
   - Socket.io bot event broadcasting

2. **llm.js** (461 lines)
   - POST /api/llm/command - Execute LLM command
   - GET /api/llm/status - LLM service status
   - LLM prompt orchestration
   - Natural language to task translation

---

### /middleware/ - Auth Middleware (1 file)

1. **auth.js** (311 lines)
   - JWT token generation/validation
   - API key checking
   - User role verification
   - Default users: admin (API key: folks123), llm, viewer

---

### /security/ - Security Utilities (1 file)

1. **secrets.js** (100 lines)
   - Secret management and validation
   - Environment variable resolution
   - Default secret fallback handling
   - Non-default secret enforcement

---

### /tasks/ - Minecraft Task Planning (36 files)

#### Core Task System
1. **index.js** (114 lines)
   - TASK_PLANNERS registry - maps task types to planners
   - Task dispatcher and execution flow
   - Re-exports helper utilities

2. **helpers.js** (215 lines)
   - createPlan(), createStep() - task structure builders
   - normalizeItemName() - item name standardization
   - extractInventory(), hasInventoryItem() - inventory helpers
   - formatRequirementList() - requirement formatting

#### Behavioral Task Planners (22 files)
3. **plan_explore.js** (4357 lines) ⭐ LARGEST
   - Complex exploration logic
   - Biome detection and preferences
   - Point-of-interest discovery
   - Path planning optimization

4. **plan_build.js** (3725 lines)
   - Building/structure placement
   - Blueprint interpretation
   - Material requirement calculation
   - Multi-step construction

5. **plan_gather.js** (2835 lines)
   - Resource gathering operations
   - Drop collection and management
   - Inventory optimization

6. **plan_combat.js** (2562 lines)
   - Combat tactics and strategy
   - Enemy detection and targeting
   - Weapon selection logic

7. **plan_interact.js** (1120 lines)
   - NPC/entity interaction
   - Object use and activation

8. **plan_redstone.js** (919 lines)
   - Redstone mechanism operation
   - Circuit logic execution

9. **plan_eat.js** (905 lines)
   - Food consumption
   - Hunger management

10. **plan_trade.js** (879 lines)
    - Merchant trading
    - Item exchange logic

11. **plan_door.js** (848 lines)
    - Door and gate operation
    - Access control

12. **plan_minecart.js** (757 lines)
    - Minecart navigation
    - Rail riding

13. **plan_climb.js** (722 lines)
    - Climbing and vertical movement
    - Ladder/vine handling

14. **plan_craft.js** (704 lines)
    - Basic crafting execution
    - Crafting table operations

15. **plan_throw.js** (693 lines)
    - Projectile throwing mechanics
    - Target throwing

16. **plan_display.js** (677 lines) [item frames/displays]
    - Display item management

17. **plan_sleep.js** (666 lines)
    - Sleep mechanics
    - Rest cycle management

18. **plan_ranged.js** (601 lines)
    - Ranged combat (bow, crossbow)
    - Arrow mechanics

19. **plan_composter.js** (546 lines)
    - Composter operation
    - Bone meal generation

20. **plan_scaffolding.js** (491 lines)
    - Scaffolding placement and climbing

21. **plan_mine.js** (262 lines)
    - Basic mining operations

22. **plan_guard.js** (258 lines)
    - Guard duty behavior
    - Area patrol and monitoring

#### Crafting Subsystem (11 files)
23. **craft_recipe_database.js** (585 lines)
    - Recipe definitions and lookups
    - Ingredient matching

24. **craft_automation_system.js** (383 lines)
    - Automated crafting sequences
    - Multi-step recipe execution

25. **craft_enchantment_system.js** (570 lines)
    - Enchantment mechanics
    - Enchanting table operations

26. **craft_durability_manager.js** (511 lines)
    - Tool and armor durability tracking
    - Repair logic

27. **craft_substitution_system.js** (509 lines)
    - Item substitution and equivalency
    - Alternative crafting paths

28. **craft_workspace_manager.js** (499 lines)
    - Crafting station management
    - Workspace setup and organization

29. **craft_chain_analyzer.js** (497 lines)
    - Multi-step recipe chain analysis
    - Dependency resolution

30. **craft_batch_optimizer.js** (438 lines)
    - Batch crafting optimization
    - Efficiency calculations

31. **craft_analytics.js** (303 lines)
    - Crafting statistics and tracking
    - Performance metrics

32. **craft_failure_recovery.js** (274 lines)
    - Error handling for failed crafts
    - Recovery logic and fallbacks

33. **craft_smart_inventory.js** (219 lines)
    - Intelligent inventory management
    - Slot optimization

34. **craft_multi_station.js** (184 lines)
    - Multi-station crafting workflows
    - Station routing

35. **craft_recipe_discovery.js** (134 lines)
    - Recipe learning and discovery
    - New recipe detection

#### Utilities
36. **combat_utils.js** (690 lines)
    - Combat-related helper functions
    - Weapon calculations, damage math

---

### /test/ - Test Files (2 files)

1. **npc_system.test.js** (366 lines)
   - NPC system integration tests
   - Lifecycle testing
   - API testing

2. **npc_microcore.test.js** (26 lines)
   - Microcore unit tests
   - Tick loop verification

---

### /plugins/FGDProxyPlayer/ - Minecraft Server Plugin (Java)

Located at: `/home/user/FGD/plugins/FGDProxyPlayer/src/main/java/io/github/fgd/proxyplayer/`

1. **FGDProxyPlayerPlugin.java**
   - Main plugin class
   - Spigot/Paper server plugin entrypoint
   - Event registration and listener setup

2. **FGDWebSocketClient.java**
   - WebSocket client for FGD backend communication
   - Bidirectional message handling
   - Connection management

3. **BotManager.java**
   - NPC entity spawning and despawning
   - Entity lifecycle management
   - Position tracking

4. **ActionManager.java**
   - Action execution (movement, attacking, placing blocks)
   - Command processing from FGD

5. **ScanManager.java**
   - Minecraft world data scanning
   - Block and entity detection
   - Environmental awareness

---

## 3. MAIN TECHNOLOGIES USED

### Backend Runtime
- **Node.js** with ES modules (ES6+ imports/exports)
- JavaScript async/await, EventEmitter, Promises

### Web Framework
- **Express.js** (^4.19.0) - HTTP server and routing
- **CORS** (^2.8.5) - Cross-origin resource sharing
- Static file serving (HTML, CSS, JS)

### Real-time Communication
- **Socket.io** (^4.6.1) - Bidirectional WebSocket with fallbacks
- **ws** (^8.17.0) - Native WebSocket support
- **FGDWebSocketClient** (Java) - Custom Minecraft plugin WebSocket client

### Authentication & Security
- **jsonwebtoken** (^9.0.2) - JWT token generation/validation
- **crypto** - Built-in Node crypto for secret generation
- Role-based access control (ADMIN, LLM, VIEWER)
- API key authentication

### Databases
- **PostgreSQL** via **pg** (^8.11.3)
  - NPC profiles, learning data, metrics
  - Connection pooling
- **Redis** (^4.6.10)
  - Caching layer
  - Pub/Sub messaging
  - Message queues

### Minecraft Server Integration
- **RCON Client** (^4.2.5) - Remote console access to Minecraft
- Custom **FGDProxyPlayer** Java plugin for Paper/Spigot
- WebSocket bridge for real-time bot control
- Fallback to RCON if plugin unavailable

### Game Logic
- Complex task planning system with 36+ task modules
- Crafting system with recipes, durability, enchantments
- NPC personality traits and progression
- Physics-lite movement simulation
- Combat mechanics and tactics

### Data Serialization
- JSON for configuration and data persistence
- JSON Schema validation (task.schema.json, bot-config.schema.json)

### Development
- ESM module system
- Watch mode support (`--watch`)
- Git version control

---

## 4. KEY ENTRY POINTS & IMPORTANT MODULES

### Primary Entry Point
**`/home/user/FGD/server.js`** (194 lines)

```javascript
// Initialization flow:
1. Import logger and configuration
2. Create Express app + HTTP server + Socket.io (src/config/server.js)
3. Initialize NPCSystem (services/npc_initializer.js)
4. Initialize SystemStateManager (services/state.js)
5. Setup telemetry pipeline (services/telemetry.js)
6. Initialize database connections (src/database/)
7. Register API routes:
   - Auth: /api/auth/login, /api/auth/me
   - Cluster: /api/cluster/*
   - NPCs: /api/npcs/*
   - Progression: /api/progression/*
   - Health: /api/health
   - Bots: /api/bots/*
   - LLM: /api/llm/*
8. Setup WebSocket handlers (src/websocket/handlers.js)
9. Start HTTP server on port 3000
```

### Core System Components

#### 1. NPCSystem (Master Orchestrator)
**File:** `src/services/npc_initializer.js`
- Coordinates all NPC subsystems
- **Sub-components:**
  - NPCRegistry - stores and persists NPC definitions
  - NPCSpawner - creates and initializes bots
  - NPCFinalizer - cleanup and archival
  - LearningEngine - skill and progression tracking
  - NPCEngine - AI task manager
  - MinecraftBridge - Minecraft integration
  - AutonomicCore - governance and monitoring

#### 2. NPCEngine (AI Task Manager)
**File:** `npc_engine.js` (1104 lines)
- Main AI brain for all NPCs
- **Sub-managers:**
  - AutonomyManager - LLM-driven task generation
  - QueueManager - priority task queue
  - DispatchManager - task execution
  - BridgeManager - communication interface
- Emits events: taskQueued, taskStarted, taskCompleted, etc.

#### 3. MinecraftBridge (Game Integration)
**File:** `minecraft_bridge.js` (514 lines)
- Unified control interface for bots
- **Methods:**
  - moveBot(botId, position) - teleport/move bot
  - scanArea(botId, radius, center) - environment awareness
  - dig(botId, blockPosition) - block breaking
  - place(botId, blockPosition, blockType) - placement
  - attack(botId, target) - combat
  - useItem(botId, itemName, target) - item usage
  - inventory(botId) - inventory querying
  - chat(botId, message) - in-game chat
  - jump(botId) - jumping
- Falls back to RCON commands if plugin interface unavailable

#### 4. NPC Microcore (Local Bot Brain)
**File:** `core/npc_microcore.js` (457 lines)
- Per-bot event loop (200ms ticks, 5 updates/sec)
- **Functionality:**
  - Movement tick processing
  - Physics-lite simulation
  - Area scanning and awareness
  - Memory management (circular buffer, 10 events)
  - Local state: position, velocity, facing direction
  - Task input processing
- **Key exports:**
  - `startLoop(botId, options)` - start per-bot loop
  - `stopLoop(botId)` - stop per-bot loop

#### 5. Learning Engine
**File:** `learning_engine.js` (421 lines)
- Persistent NPC skill progression
- **Features:**
  - Skill tracking (mining, building, gathering, exploring, guard)
  - Experience and motivation
  - Profile serialization
  - Trait integration

#### 6. Progression Engine
**File:** `core/progression_engine.js` (499 lines)
- Six-phase progression system
- **Phases:**
  1. Survival - Basic tools, first shelter
  2. Wood - Wood processing, wooden tools
  3. Stone - Stone mining, furnace
  4. Iron - Iron mining, smelting
  5. Diamond - Diamond mining, enchanting
  6. Post-Dragon - End-game progression
- **Features:**
  - Automatic phase detection
  - Phase-aware NPC behavior
  - Policy adaptation per phase

#### 7. Autonomic Core (Governance)
**File:** `autonomic_core.js` (567 lines)
- Self-monitoring and healing
- **Monitors:**
  - CPU usage (threshold: 85%)
  - Memory usage (threshold: 85%)
  - Disk usage (threshold: 90%)
- **Actions:**
  - Policy enforcement
  - Auto-scaling decisions
  - Failure recovery

#### 8. Policy Engine
**File:** `policy_engine.js` (504 lines)
- Resource allocation policies
- Behavioral constraints
- Governance rule management

#### 9. Task Planning System
**Directory:** `/tasks/`
- 22 behavioral task planners
- 11 crafting subsystem modules
- 1 helpers module
- **Largest modules:**
  - plan_explore.js (4357 lines)
  - plan_build.js (3725 lines)
  - plan_gather.js (2835 lines)
- Converts high-level goals into step-by-step Minecraft actions

#### 10. LLM Integration Layer
**File:** `llm_bridge.js` (235 lines)
- LLM provider abstraction
- Multi-provider support
- **File:** `interpreter.js` (355 lines) - command interpretation
- **File:** `model_director.js` (219 lines) - prompt orchestration
- **Route:** `/routes/llm.js` (461 lines) - LLM API endpoint

#### 11. Knowledge & Fusion System
**File:** `knowledge_store.js` (438 lines)
- Persistent learning outcomes
- **File:** `fusion_core.js` (529 lines) - knowledge merging
- **File:** `cognitive_link.js` (388 lines) - multi-bot synchronization

#### 12. Federation Networking
**File:** `peer_link.js` (418 lines)
- Node-to-node communication
- **File:** `node_sync_manager.js` (582 lines) - cluster sync
- **File:** `node_sync_only.js` (432 lines) - observer mode

#### 13. Database Layer
**Directory:** `src/database/`
- PostgreSQL: NPC profiles, learning data
- Redis: Caching, pub/sub, message queues
- Repositories: NPCRepository, LearningRepository

#### 14. WebSocket Plugin System
**File:** `src/websocket/plugin.js` (242 lines)
- Abstract interface for game integration
- Bridges FGD backend to Minecraft via Java plugin
- **Contract methods:**
  - moveBot, scanArea, dig, place, attack, useItem, etc.

#### 15. Authentication & Authorization
**File:** `middleware/auth.js` (311 lines)
- JWT token management
- API key validation
- Role-based access control
- **Roles:** ADMIN, LLM, VIEWER
- **Default users:**
  - admin (API key: folks123)
  - llm (API key: llm-key-change-me)
  - viewer (read-only)

#### 16. Admin Dashboards
**Files:**
- `admin.js` (243 lines) - Admin panel backend
- `admin.html` (10KB) - Admin UI
- `dashboard.js` (588 lines) - Cluster metrics dashboard
- `dashboard.html` (4.5KB) - Dashboard UI
- `fusion.js` (245 lines) - Fusion memory inspector
- `fusion.html` (2.5KB) - Fusion UI

### Configuration Files
1. **`governance_config.json`** - Autonomic policies
2. **`cluster_config.json`** - Cluster topology
3. **`.env.example`** - Environment variables template

### Schema Definitions
1. **`schemas/task.schema.json`** - Task validation schema
2. **`schemas/bot-config.schema.json`** - Bot config schema
3. **`npc_profile.schema.json`** - NPC profile schema
4. **`node_manifest.schema.json`** - Node manifest schema

---

## 5. EXECUTION FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                    server.js (Entry Point)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    Database         Express App      Socket.io
  (PostgreSQL,      + Routing       + Real-time
     Redis)         + Middleware     Communication
        │                │                │
        └────────────────┼────────────────┘
                         │
        ┌────────────────▼────────────────┐
        │      NPCSystem (Orchestrator)    │
        └────────────────┬────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
NPCRegistry         NPCSpawner           NPCEngine
(Profiles)          (Creation)           (AI Brain)
    │                    │                    │
    │                    ▼                    │
    │              Minecraft Bridge◄──────────┤
    │              (RCON + Plugin)            │
    │                    │                    │
    ▼                    ▼                    ▼
Learning          Microcore              Policy
Engine            (Per-bot)              Engine
(Skills)          Event Loop        (Governance)
                       │                    │
                       ▼                    ▼
                 Game Actions         Autonomic
                 (Movement,           Core
                 Mining, etc)         (Monitoring)
                       │
                       ▼
          ┌─────────────────────────┐
          │   Minecraft Server      │
          │  (Paper + Plugin)       │
          │  - Entity Spawning      │
          │  - Block Operations     │
          │  - World State          │
          └─────────────────────────┘
```

---

## 6. COMMON PATTERNS & ARCHITECTURAL INSIGHTS

### Event-Driven Architecture
- Components emit events (EventEmitter)
- Loosely coupled subsystems
- Telemetry pipeline captures all events

### Circuit Breaker Pattern
- `src/utils/circuit_breaker.js`
- Protects against cascading failures
- States: CLOSED, OPEN, HALF_OPEN

### Batch Processing
- `src/utils/batch_processor.js`
- Positions, metrics batched for efficiency
- Reduces API overhead

### Worker Pool
- `src/utils/worker_pool.js`
- Background task distribution
- Load balancing across workers

### Database Transactions
- SQL connection pooling
- Multi-step operations with rollback

### Redis Pub/Sub
- Inter-node communication
- Distributed state synchronization

### Microcore Pattern
- Per-bot local event loop (200ms ticks)
- Centralized coordination via NPCEngine
- Balances autonomy with governance

### Task Planning
- Goal-based decomposition
- Step-by-step Minecraft action generation
- Crafting requires multi-module collaboration

---

## FILE STATISTICS

### Total Code Size
- Root JS files: ~13,600 lines
- /src directory: ~2,500 lines
- /core directory: ~950 lines
- /npc_engine directory: ~800 lines
- /routes directory: ~1,200 lines
- /middleware directory: ~340 lines
- /tasks directory: ~30,000+ lines
- **Total: ~50,000+ lines of JavaScript**

### Largest Modules (by line count)
1. plan_explore.js - 4357 lines
2. plan_build.js - 3725 lines
3. plan_gather.js - 2835 lines
4. plan_combat.js - 2562 lines
5. server_old.js - 1582 lines (legacy)
6. npc_engine.js - 1104 lines

### Most Complex Modules (dependencies, features)
1. **NPCEngine** - orchestrates 4 sub-managers + learning
2. **Progression Engine** - phase detection, NPC behavior adaptation
3. **Task Planning System** - 36 interdependent modules
4. **Minecraft Bridge** - hybrid RCON + plugin communication
5. **Autonomic Core** - system monitoring and policy enforcement

---

## KEY BUGS & AREAS FOR REVIEW

When systematically reviewing for bugs, focus on:

1. **Async/Await Handling**
   - Promise rejection chains
   - Missing error handlers
   - Race conditions in concurrent operations

2. **State Management**
   - NPC registry synchronization
   - Database transaction consistency
   - Redis cache invalidation

3. **Event Loop Safety**
   - Microcore tick processing
   - Task queue back-pressure
   - Memory leaks in event listeners

4. **Minecraft Integration**
   - RCON command formatting
   - Plugin WebSocket message ordering
   - Fallback logic edge cases

5. **Authentication**
   - JWT token expiration handling
   - API key validation edge cases
   - Role enforcement consistency

6. **Database Operations**
   - Connection pool exhaustion
   - Transaction deadlocks
   - Query result handling

7. **Learning System**
   - Profile serialization consistency
   - Skill progression edge cases
   - Trait calculation accuracy

8. **Phase Progression**
   - Auto-phase detection logic
   - Policy adaptation triggers
   - NPC behavior alignment

---

## DEPLOYMENT & RUN MODES

### Standard Mode
```bash
npm start
# Runs server.js with full NPC system
```

### Development Mode
```bash
npm run dev
# Runs with --watch for auto-reload
```

### Minecraft Integration
- Optional RCON connection (configurable via env)
- Plugin interface via WebSocket
- Falls back to RCON if plugin unavailable

### Cluster Mode
- Node-to-node synchronization via peer_link
- Distributed NPC awareness
- Redis pub/sub for inter-node messaging

---

## CONCLUSION

FGD is a sophisticated, multi-layered system combining:
- **Backend infrastructure** (Express, Socket.io, databases)
- **AI coordination** (NPC engine with LLM integration)
- **Game integration** (Minecraft bridge with hybrid plugin)
- **Learning system** (persistent profiles, skill progression)
- **Governance** (policy enforcement, autonomic monitoring)
- **Task planning** (36+ specialized behavioral modules)

The architecture prioritizes **modularity**, **extensibility**, and **real-time responsiveness** through event-driven patterns, batch processing, and distributed state management.

