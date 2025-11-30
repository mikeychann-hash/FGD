# FGD Codebase - Quick File Location Map

## File Navigation Guide

### ENTRY POINTS
```
/home/user/FGD/server.js                    # Main Express/Socket.io server
/home/user/FGD/package.json                 # Dependencies and scripts
/home/user/FGD/.env.example                 # Environment variables template
```

### CORE INFRASTRUCTURE (/src/)
```
/home/user/FGD/src/config/constants.js      # Global constants and paths
/home/user/FGD/src/config/server.js         # Express/Socket.io factory
/home/user/FGD/src/config/server.js         # Express/Socket.io factory

/home/user/FGD/src/database/connection.js   # PostgreSQL pool
/home/user/FGD/src/database/schema.js       # Database initialization
/home/user/FGD/src/database/redis.js        # Redis cache and pub/sub

/home/user/FGD/src/database/repositories/npc_repository.js      # NPC persistence
/home/user/FGD/src/database/repositories/learning_repository.js  # Learning data

/home/user/FGD/src/middleware/errorHandlers.js # Global error handling
/home/user/FGD/src/middleware/auth.js          # JWT + API key auth [also in /middleware]

/home/user/FGD/src/services/npc_initializer.js  # NPCSystem orchestrator
/home/user/FGD/src/services/state.js            # SystemStateManager
/home/user/FGD/src/services/data.js             # File system operations
/home/user/FGD/src/services/telemetry.js        # Metrics and telemetry

/home/user/FGD/src/utils/circuit_breaker.js    # Circuit breaker pattern
/home/user/FGD/src/utils/batch_processor.js    # Batch processing queues
/home/user/FGD/src/utils/worker_pool.js        # Worker thread pool

/home/user/FGD/src/websocket/handlers.js       # Socket.io event handlers
/home/user/FGD/src/websocket/plugin.js         # Plugin interface abstraction

/home/user/FGD/src/workers/task_worker.js      # Background task worker
```

### REST API ROUTES (/src/api/ and /routes/)
```
/home/user/FGD/src/api/cluster.js          # Cluster status and metrics
/home/user/FGD/src/api/npcs.js             # NPC CRUD operations
/home/user/FGD/src/api/progression.js      # Phase progression endpoints
/home/user/FGD/src/api/health.js           # Health and metrics endpoints

/home/user/FGD/routes/bot.js                # Bot spawning/despawning
/home/user/FGD/routes/llm.js                # LLM command interface

/home/user/FGD/middleware/auth.js           # Auth middleware (also in /src/middleware)
```

### CORE AI ENGINES
```
/home/user/FGD/npc_engine.js                # Main AI task manager (1104 lines)
/home/user/FGD/npc_engine/autonomy.js      # Autonomous task generation
/home/user/FGD/npc_engine/queue.js         # Priority task queue
/home/user/FGD/npc_engine/dispatch.js      # Task execution lifecycle
/home/user/FGD/npc_engine/bridge.js        # Communication interface
/home/user/FGD/npc_engine/utils.js         # Shared utilities

/home/user/FGD/task_broker.js               # Task queue management (740 lines)
/home/user/FGD/task_schema.js               # Task validation schema
```

### LOCAL BOT RUNTIME (/core/)
```
/home/user/FGD/core/npc_microcore.js        # Per-bot event loop (457 lines)
/home/user/FGD/core/progression_engine.js   # Six-phase progression system (499 lines)
```

### NPC LIFECYCLE & LEARNING
```
/home/user/FGD/npc_spawner.js               # High-level NPC spawning (448 lines)
/home/user/FGD/npc_registry.js              # NPC identity registry (393 lines)
/home/user/FGD/npc_finalizer.js             # NPC cleanup and archival (395 lines)
/home/user/FGD/npc_identity.js              # Personality bundle construction (182 lines)

/home/user/FGD/learning_engine.js           # Skill progression system (421 lines)
/home/user/FGD/traits.js                    # NPC personality traits (198 lines)
```

### MINECRAFT INTEGRATION
```
/home/user/FGD/minecraft_bridge.js          # RCON + WebSocket bridge (514 lines)
/home/user/FGD/minecraft-bridge-config.js   # Bridge configuration (127 lines)
```

### GAME LOGIC - TASK PLANNING (/tasks/)
```
/home/user/FGD/tasks/index.js               # Task registry and dispatcher
/home/user/FGD/tasks/helpers.js             # Shared task utilities

BEHAVIORAL PLANNERS (22 files):
/home/user/FGD/tasks/plan_explore.js        # World exploration (4357 lines) ⭐
/home/user/FGD/tasks/plan_build.js          # Building/placement (3725 lines)
/home/user/FGD/tasks/plan_gather.js         # Resource gathering (2835 lines)
/home/user/FGD/tasks/plan_combat.js         # Combat tactics (2562 lines)
/home/user/FGD/tasks/plan_interact.js       # NPC interaction (1120 lines)
/home/user/FGD/tasks/plan_redstone.js       # Redstone logic (919 lines)
/home/user/FGD/tasks/plan_eat.js            # Food consumption (905 lines)
/home/user/FGD/tasks/plan_trade.js          # Trading mechanics (879 lines)
/home/user/FGD/tasks/plan_door.js           # Door/gate operation (848 lines)
/home/user/FGD/tasks/plan_minecart.js       # Minecart navigation (757 lines)
/home/user/FGD/tasks/plan_climb.js          # Climbing mechanics (722 lines)
/home/user/FGD/tasks/plan_craft.js          # Basic crafting (704 lines)
/home/user/FGD/tasks/plan_throw.js          # Projectile throwing (693 lines)
/home/user/FGD/tasks/plan_display.js        # Item frames/displays (677 lines)
/home/user/FGD/tasks/plan_sleep.js          # Sleep mechanics (666 lines)
/home/user/FGD/tasks/plan_ranged.js         # Ranged combat (601 lines)
/home/user/FGD/tasks/plan_composter.js      # Composter operation (546 lines)
/home/user/FGD/tasks/plan_scaffolding.js    # Scaffolding placement (491 lines)
/home/user/FGD/tasks/plan_mine.js           # Mining operations (262 lines)
/home/user/FGD/tasks/plan_guard.js          # Guard duty (258 lines)
/home/user/FGD/tasks/plan_spawn.js
/home/user/FGD/tasks/combat_utils.js        # Combat helpers (690 lines)

CRAFTING SUBSYSTEM (11 files):
/home/user/FGD/tasks/craft_recipe_database.js       # Recipe management (585 lines)
/home/user/FGD/tasks/craft_enchantment_system.js    # Enchantments (570 lines)
/home/user/FGD/tasks/craft_durability_manager.js    # Durability tracking (511 lines)
/home/user/FGD/tasks/craft_substitution_system.js   # Item substitution (509 lines)
/home/user/FGD/tasks/craft_workspace_manager.js     # Station management (499 lines)
/home/user/FGD/tasks/craft_chain_analyzer.js        # Recipe chains (497 lines)
/home/user/FGD/tasks/craft_automation_system.js     # Automation (383 lines)
/home/user/FGD/tasks/craft_batch_optimizer.js       # Batch optimization (438 lines)
/home/user/FGD/tasks/craft_analytics.js             # Statistics (303 lines)
/home/user/FGD/tasks/craft_failure_recovery.js      # Error recovery (274 lines)
/home/user/FGD/tasks/craft_smart_inventory.js       # Inventory mgmt (219 lines)
/home/user/FGD/tasks/craft_multi_station.js         # Multi-station (184 lines)
/home/user/FGD/tasks/craft_recipe_discovery.js      # Discovery (134 lines)
```

### GOVERNANCE & AUTONOMIC SYSTEMS
```
/home/user/FGD/autonomic_core.js            # Self-monitoring and healing (567 lines)
/home/user/FGD/policy_engine.js             # Policy management (504 lines)
```

### KNOWLEDGE & LEARNING SYSTEMS
```
/home/user/FGD/knowledge_store.js           # Outcome persistence (438 lines)
/home/user/FGD/fusion_core.js               # Knowledge fusion (529 lines)
/home/user/FGD/fusion.js                    # Fusion UI backend (245 lines)
/home/user/FGD/cognitive_link.js            # Multi-bot sync (388 lines)
```

### NETWORKING & SYNCHRONIZATION
```
/home/user/FGD/peer_link.js                 # Node-to-node comms (418 lines)
/home/user/FGD/node_sync_manager.js         # Cluster sync (582 lines)
/home/user/FGD/node_sync_only.js            # Observer mode (432 lines)
```

### LLM INTEGRATION
```
/home/user/FGD/llm_bridge.js                # LLM provider abstraction (235 lines)
/home/user/FGD/interpreter.js               # Command interpretation (355 lines)
/home/user/FGD/model_director.js            # Prompt orchestration (219 lines)
```

### WEB DASHBOARDS & UI
```
/home/user/FGD/admin.js                     # Admin panel backend (243 lines)
/home/user/FGD/admin.html                   # Admin UI (HTML)

/home/user/FGD/dashboard.js                 # Cluster dashboard (588 lines)
/home/user/FGD/dashboard.html               # Dashboard UI (HTML)

/home/user/FGD/fusion.js                    # Fusion inspector backend
/home/user/FGD/fusion.html                  # Fusion UI

/home/user/FGD/style.css                    # Styling
/home/user/FGD/theme.js                     # Theme utilities
```

### UTILITIES & INFRASTRUCTURE
```
/home/user/FGD/logger.js                    # Logging system (176 lines)
/home/user/FGD/validator.js                 # Data validation (390 lines)

/home/user/FGD/npc_cli.js                   # CLI interface (410 lines)
/home/user/FGD/npc_demo.js                  # Demo harness (219 lines)
```

### TESTING
```
/home/user/FGD/test/npc_system.test.js      # System tests (366 lines)
/home/user/FGD/test/npc_microcore.test.js   # Unit tests (26 lines)
/home/user/FGD/test_spawning.js             # Integration tests (159 lines)
```

### MINECRAFT SERVER PLUGIN (/plugins/FGDProxyPlayer/)
```
/home/user/FGD/plugins/FGDProxyPlayer/src/main/java/io/github/fgd/proxyplayer/
  ├── FGDProxyPlayerPlugin.java              # Main plugin class
  ├── FGDWebSocketClient.java                # WebSocket communication
  ├── BotManager.java                        # Entity management
  ├── ActionManager.java                     # Action execution
  └── ScanManager.java                       # World scanning
```

### CONFIGURATION FILES
```
/home/user/FGD/package.json                 # Dependencies
/home/user/FGD/governance_config.json       # Autonomic policies
/home/user/FGD/cluster_config.json          # Cluster topology
/home/user/FGD/node_manifest.json           # Node manifest
/home/user/FGD/.env.example                 # Env template
```

### SCHEMAS & VALIDATION
```
/home/user/FGD/schemas/task.schema.json        # Task validation
/home/user/FGD/schemas/bot-config.schema.json  # Bot config validation
/home/user/FGD/npc_profile.schema.json         # NPC profile schema
/home/user/FGD/node_manifest.schema.json       # Node manifest schema
```

### PERSISTENT DATA (/data/)
```
/home/user/FGD/data/npc_registry.json       # Active NPCs
/home/user/FGD/data/npc_profiles.json       # NPC skills/traits
/home/user/FGD/data/fused_knowledge.json    # Collective learning
/home/user/FGD/data/cluster_status.json     # Cluster metrics
/home/user/FGD/data/system_logs.json        # Event logs
/home/user/FGD/data/system_stats.json       # Performance stats
/home/user/FGD/data/metrics.json            # Runtime metrics
```

### DOCUMENTATION
```
/home/user/FGD/README.md                         # Main documentation
/home/user/FGD/CODEBASE_STRUCTURE.md             # Comprehensive overview (NEW)
/home/user/FGD/BUG_REVIEW_CHECKLIST.md           # Bug review guide (NEW)
/home/user/FGD/README_HYBRID_BOTS.md             # Bot architecture
/home/user/FGD/HYBRID_BOTS_SETUP.md              # Setup guide
/home/user/FGD/NPC_SYSTEM_README.md              # NPC lifecycle
/home/user/FGD/PHASE_INTEGRATION_SUMMARY.md      # Phase system
/home/user/FGD/ADMIN_PANEL_INTEGRATION.md        # Admin UI
/home/user/FGD/Minecraft_Sustainable_Progression_README.md  # Progression
/home/user/FGD/README_AUTONOMOUS_PROGRESSION.md  # Autonomous expansion
/home/user/FGD/PAPER_GEYSER_SETUP.md             # Server setup
```

### SCRIPTS & STARTUP
```
/home/user/FGD/quick-start.sh                # Quick start script (Linux)
/home/user/FGD/quick-start.bat               # Quick start script (Windows)
/home/user/FGD/start-server.sh               # Server startup (Linux)
/home/user/FGD/start-server.bat              # Server startup (Windows)
/home/user/FGD/start-all.sh                  # Full stack startup (Linux)
/home/user/FGD/start-all.bat                 # Full stack startup (Windows)
```

---

## DEPENDENCY GRAPH (Simplified)

```
server.js (Entry Point)
├── Express App Setup
├── NPCSystem (npc_initializer.js)
│   ├── NPCRegistry (npc_registry.js)
│   ├── NPCSpawner (npc_spawner.js)
│   ├── NPCFinalizer (npc_finalizer.js)
│   ├── LearningEngine (learning_engine.js)
│   ├── NPCEngine (npc_engine.js)
│   │   ├── AutonomyManager (npc_engine/autonomy.js)
│   │   ├── QueueManager (npc_engine/queue.js)
│   │   ├── DispatchManager (npc_engine/dispatch.js)
│   │   └── BridgeManager (npc_engine/bridge.js)
│   ├── MinecraftBridge (minecraft_bridge.js)
│   └── AutonomicCore (autonomic_core.js)
├── Database Layer
│   ├── PostgreSQL (src/database/connection.js)
│   ├── Redis (src/database/redis.js)
│   └── Repositories (npc_repository.js, learning_repository.js)
├── API Routes
│   ├── /api/cluster/* (src/api/cluster.js)
│   ├── /api/npcs/* (src/api/npcs.js)
│   ├── /api/bots/* (routes/bot.js)
│   ├── /api/progression/* (src/api/progression.js)
│   ├── /api/health (src/api/health.js)
│   └── /api/llm/* (routes/llm.js)
└── WebSocket
    ├── Socket.io (src/config/server.js)
    └── Handlers (src/websocket/handlers.js)
```

---

## QUICK FILE LOOKUP BY FEATURE

### Feature: Bot Spawning
- Start: `/home/user/FGD/routes/bot.js`
- Then: `/home/user/FGD/npc_spawner.js`
- Then: `/home/user/FGD/npc_registry.js`
- Then: `/home/user/FGD/npc_engine.js`

### Feature: Task Execution
- Start: `/home/user/FGD/npc_engine.js`
- Then: `/home/user/FGD/npc_engine/dispatch.js`
- Then: `/home/user/FGD/task_broker.js`
- Then: `/home/user/FGD/tasks/[specific_task].js`

### Feature: Minecraft Integration
- Start: `/home/user/FGD/minecraft_bridge.js`
- Then: `/home/user/FGD/src/websocket/plugin.js`
- Then: `/home/user/FGD/plugins/FGDProxyPlayer/` (Java)

### Feature: Learning & Progression
- Start: `/home/user/FGD/learning_engine.js`
- Then: `/home/user/FGD/core/progression_engine.js`
- Then: `/home/user/FGD/npc_registry.js`

### Feature: Governance & Monitoring
- Start: `/home/user/FGD/autonomic_core.js`
- Then: `/home/user/FGD/policy_engine.js`

### Feature: Real-time Communication
- Start: `/home/user/FGD/src/websocket/handlers.js`
- Then: `/home/user/FGD/src/services/state.js`

---

## FILE MODIFICATION CHECKLIST

When modifying files, remember to update:
- [ ] Related test files in `/test/`
- [ ] Related documentation files
- [ ] Package.json if dependencies change
- [ ] Schema files if data structures change
- [ ] Database schema if tables change
- [ ] Configuration examples if defaults change

