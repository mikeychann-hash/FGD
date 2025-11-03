# 🧠 AICraft Federation Governance Dashboard (FGD)

AICraft Federation Governance Dashboard (FGD) is a full-stack control plane for managing Minecraft-based NPC swarms with **hybrid bot architecture** combining Mineflayer-style embodiment with centralized AI governance. The repository combines a persistent Express/Socket.IO backend, a web-based admin console, live operations dashboards, and an extensible NPC/LLM integration layer that bridges into Paper/Geyser Minecraft servers through **real-time WebSocket communication** and a custom Paper plugin.

## ✨ Key Features

- 🤖 **Hybrid Bot Framework** – Bots combine Mineflayer-style embodied awareness (physics, movement, world scanning) with FGD's centralized intelligence (LLM integration, learning, governance)
- 🎮 **Real Minecraft Integration** – Bots exist as visible entities in Minecraft via the FGDProxyPlayer plugin (no simulation)
- 🧠 **Microcore Architecture** – Each bot runs a local "micro-brain" tick loop for reactive behavior while the federation manages strategic planning
- 📡 **WebSocket Bridge** – Bidirectional real-time communication between FGD backend and Minecraft server
- 🔬 **Environmental Awareness** – Bots scan actual Minecraft world data (blocks, entities, players) within configurable radius
- 📊 **Adaptive Learning** – Persistent NPC profiles with skill progression, trait evolution, and outcome knowledge
- 🎯 **LLM Command Surface** – Natural language instructions translated to bot actions via multiple LLM providers
- 🏛️ **Autonomic Governance** – Policy-driven resource management and adaptive behavior control
- 🌍 **Phase Progression System** – Six-phase sustainable progression from survival to post-dragon with automatic phase advancement, policy adaptation, and phase-aware NPC behaviors

## 📚 Documentation

- **[README_HYBRID_BOTS.md](README_HYBRID_BOTS.md)** – Architecture comparison: Mineflayer vs FGD vs Hybrid approach
- **[HYBRID_BOTS_SETUP.md](HYBRID_BOTS_SETUP.md)** – Complete setup guide for real Minecraft integration with FGDProxyPlayer plugin
- **[PAPER_GEYSER_SETUP.md](PAPER_GEYSER_SETUP.md)** – Minecraft server setup instructions for Paper + Geyser
- **[ADMIN_PANEL_INTEGRATION.md](ADMIN_PANEL_INTEGRATION.md)** – Admin UI integration guide
- **[NPC_SYSTEM_README.md](NPC_SYSTEM_README.md)** – NPC lifecycle and engine documentation
- **[PHASE_INTEGRATION_SUMMARY.md](PHASE_INTEGRATION_SUMMARY.md)** – Six-phase progression system integration and API documentation
- **[Minecraft_Sustainable_Progression_README.md](Minecraft_Sustainable_Progression_README.md)** – Phase definitions and progression milestones
- **[README_AUTONOMOUS_PROGRESSION.md](README_AUTONOMOUS_PROGRESSION.md)** – Autonomous progression expansion design

## Table of Contents
- [Project Purpose](#project-purpose)
- [System Architecture](#system-architecture)
  - [Hybrid Bot Framework](#hybrid-bot-framework)
  - [Runtime Entry Points](#runtime-entry-points)
  - [Web Dashboards](#web-dashboards)
  - [NPC Lifecycle and Learning Stack](#npc-lifecycle-and-learning-stack)
  - [Minecraft Bridge and Game Integration](#minecraft-bridge-and-game-integration)
  - [Autonomic Governance and Policy Enforcement](#autonomic-governance-and-policy-enforcement)
  - [Phase Progression System](#phase-progression-system)
  - [LLM Command Surface](#llm-command-surface)
  - [Task Planning and Knowledge Persistence](#task-planning-and-knowledge-persistence)
- [Key Modules Reference](#key-modules-reference)
- [Installation and Setup](#installation-and-setup)
  - [Backend Services](#backend-services)
  - [Minecraft Server Preparation](#minecraft-server-preparation)
  - [FGDProxyPlayer Plugin Installation](#fgdproxyplayer-plugin-installation)
  - [Admin and Dashboard Clients](#admin-and-dashboard-clients)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Config Files and Data Stores](#config-files-and-data-stores)
- [Usage Examples](#usage-examples)
  - [REST API](#rest-api)
  - [LLM-powered Commands](#llm-powered-commands)
- [Developer Notes](#developer-notes)
- [Versioning and Updates](#versioning-and-updates)
- [Known Issues and Limitations](#known-issues-and-limitations)

## Project Purpose
FGD orchestrates the Minecraft Federation of agents by:
- Operating an authenticated REST + WebSocket backend for NPC creation, lifecycle management, and telemetry streaming.
- **Running hybrid bots** with Mineflayer-style embodiment (movement, physics, awareness) and centralized AI governance (LLM, learning, policy).
- Providing dashboards for cluster metrics, fusion memory inspection, and governance policy controls.
- Persisting NPC identity, traits, learning progress, and outcome knowledge to drive adaptive behaviors.
- Bridging natural-language instructions through multiple LLM providers to in-game actions and NPC tasking.
- **Spawning real entities** in Minecraft via the FGDProxyPlayer Paper plugin with bidirectional WebSocket communication.

## System Architecture

### Hybrid Bot Framework

FGD implements a **hybrid architecture** combining the best of both Mineflayer and traditional NPC systems:

```
┌─────────────────────────────────────────────────────────────┐
│                 🧠 Federation Layer (FGD Core)               │
│  - LLM Command Surface (llm_bridge.js)                      │
│  - Governance Core (autonomic_core.js / policy_engine.js)   │
│  - Knowledge + Learning Persistence                         │
└──────────────▲──────────────────────────────────────────────┘
               │ Goals / Policies
               ▼
┌─────────────────────────────────────────────────────────────┐
│           🤖 Local Behavior Core ("Micro-Brain")             │
│  - Per-bot event loop (core/npc_microcore.js)               │
│  - Movement, pathing, task execution (200ms tick)           │
│  - Local state awareness (position, velocity, memory)       │
└──────────────▲──────────────────────────────────────────────┘
               │ Commands / Updates
               ▼
┌─────────────────────────────────────────────────────────────┐
│       ⚙️ Minecraft Integration Layer (Bridge + Plugin)       │
│  - Central RCON / WebSocket bridge (minecraft_bridge.js)    │
│  - FGDProxyPlayer Paper plugin (Java)                       │
│  - Real bot movement & scanning (WebSocket communication)   │
└─────────────────────────────────────────────────────────────┘
```

**Key Components:**

- **`core/npc_microcore.js`** – Local tick loop (5 updates/sec) handling physics-lite movement, area scanning, and reactive behavior for each bot
- **`minecraft_bridge.js`** – Centralized RCON bridge extended with `moveBot()` and `scanArea()` methods that communicate with the plugin
- **`plugins/FGDProxyPlayer/`** – Paper/Spigot plugin (Java) that spawns real entities, executes movement commands, and scans Minecraft world data
- **`server.js`** – WebSocket server with `pluginInterface` object for bidirectional communication between FGD and Minecraft

**What Bots Can Do:**

- ✅ **Move** with step-based physics (interpolated movement, velocity tracking)
- ✅ **Scan** environment every 1.5 seconds (blocks, entities, players within 5-block radius)
- ✅ **Exist** as visible entities in Minecraft (ArmorStand proxies with nametags)
- ✅ **React** to world changes via microcore event loop
- ✅ **Learn** from experiences via learning_engine persistence
- ✅ **Coordinate** through centralized federation governance

See **[README_HYBRID_BOTS.md](README_HYBRID_BOTS.md)** for detailed architecture comparison and **[HYBRID_BOTS_SETUP.md](HYBRID_BOTS_SETUP.md)** for setup instructions.

### Runtime Entry Point
- **`server.js`** – Unified entry used by the helper scripts and `npm` commands. It layers authentication, cached fusion data access, bot/LLM routers, NPC archival, metrics simulation, and health endpoints to deliver the full governance stack in a single process.【F:server.js†L1-L640】

The server also serves static assets from the repository root so that `admin.html`, `dashboard.html`, and `fusion.html` load without additional build steps.【F:server.js†L118-L400】

### Web Dashboards
- **Admin console (`admin.html` + `admin.js`)** auto-logins with an API key, lists bots, and exposes spawn/despawn workflows backed by REST endpoints and Socket.IO events from the unified server.【F:admin.js†L1-L109】【F:server.js†L360-L520】
- **Operations dashboard (`dashboard.html` + `dashboard.js`)** polls or streams cluster state, renders CPU/memory charts, summarizes fusion memory, and lets operators tweak policy parameters live.【F:dashboard.js†L1-L199】【F:server.js†L290-L345】

### NPC Lifecycle and Learning Stack
The NPC subsystem is composed of:
- **`npc_registry.js`** – Persistent identity database with role indices, validation, and serialization support.
- **`npc_spawner.js`** – Coordinates registry, learning engine, NPC engine, and Minecraft bridge to create fully realized bots. **Now auto-initializes microcore** for each spawned bot.
- **`core/npc_microcore.js`** – **NEW:** Local tick loop system that gives each bot embodied behavior (movement physics, environmental scanning, reactive events).
- **`npc_finalizer.js`** – Archives, despawns, and cleans up NPCs while retaining lifecycle statistics. **Now properly detaches microcore** on cleanup.
- **`learning_engine.js`** – Maintains NPC profiles, traits, skill progression, and debounced persistence to disk.
- **`npc_engine/`** – Queueing, dispatch, autonomy, and bridge helpers that coordinate bot behaviors with the Minecraft bridge. **Now integrates with microcore** for task synchronization.

`server.js` wires these components together, ensures registries and archives are loaded, and surfaces management endpoints (`/api/npcs`, dead-letter queues, archives) for full lifecycle control.

### Minecraft Bridge and Game Integration
- **`minecraft_bridge.js`** – Wraps RCON and **WebSocket plugin communication**, emits connection status, and provides spawn/despawn, **movement (`moveBot`)**, and **scanning (`scanArea`)** methods.
- **`plugins/FGDProxyPlayer/`** – **NEW:** Paper/Spigot plugin (Java) that connects to FGD via WebSocket, spawns real bot entities, executes movement commands, and scans Minecraft world data (blocks, entities, players).
  - **Build:** `cd plugins/FGDProxyPlayer && mvn clean package`
  - **Install:** Copy `target/FGDProxyPlayer-1.0.0.jar` to your Paper server's `plugins/` folder
  - **Configure:** Edit `plugins/FGDProxyPlayer/config.yml` with FGD WebSocket URL
- **`server.js`** – Initializes `pluginInterface` object for bidirectional WebSocket communication, auto-wires to `minecraft_bridge` on plugin connection, and sets up telemetry channel.
- **`minecraft-bridge-config.js`** – Centralizes host, port, security, heartbeat, and spawn templates for Paper/Geyser servers.
- Environment-aware initialization in `server.js` skips bridge startup unless credentials are provided, making game connectivity optional in development.

**Integration Flow:**
```
Bot Movement: npc_microcore → minecraft_bridge.moveBot()
              → pluginInterface (WebSocket) → FGDProxyPlayer
              → entity.teleport() in Minecraft

Bot Scanning:  npc_microcore → minecraft_bridge.scanArea()
              → pluginInterface (WebSocket) → FGDProxyPlayer
              → getNearbyEntities() + getBlockAt()
              → real world data returned to bot
```

### Autonomic Governance and Policy Enforcement
- **`autonomic_core.js`** – Periodically gathers system metrics, enforces thresholds, coordinates with the policy engine, and **integrates with the progression system** for phase-based governance.【F:autonomic_core.js†L1-L120】
- **`policy_engine.js`** – Evaluates CPU/memory load, produces prioritized remediation actions, **applies phase-specific policies** (bot limits, permission gates), and persists policy adjustments for auditability.【F:policy_engine.js†L1-L335】
- Policy adjustments feed into the dashboard's sliders and configuration endpoints exposed by `server.js` for live tuning.【F:server.js†L320-L335】

### Phase Progression System

FGD implements a **six-phase sustainable progression system** that manages the federation's journey from basic survival to post-dragon civilization:

```
Phase 1: Survival & Basics (0-5h)
  └─→ Phase 2: Resource Expansion (5-12h)
       └─→ Phase 3: Infrastructure (12-20h)
            └─→ Phase 4: Nether Expansion (20-30h)
                 └─→ Phase 5: End Prep (30-40h)
                      └─→ Phase 6: Post-Dragon (40-50h+)
```

**Key Components:**

- **`core/progression_engine.js`** – Central controller managing phase state, metrics tracking (food, shelters, tools, automations, etc.), completion criteria, and automatic phase advancement. Emits events (`phaseChanged`, `progressUpdate`, `metricUpdate`) for system-wide coordination.

- **`llm_prompts/federation_progression_prompt.js`** – Strategic advisor prompts for LLM integration with context-aware guidance based on current phase, objectives, and bottlenecks.

- **Phase-Aware Components:**
  - `policy_engine.js` – Applies phase-specific resource limits (5→30 bots) and permission gates (combat, trading, Nether, End access)
  - `npc_microcore.js` – Phase-aware autonomous behaviors (miners prioritize different ores per phase, builders adapt construction focus)
  - `npc_engine.js` – Phase propagation to all NPCs with batch task scheduling
  - `minecraft_bridge.js` – Phase telemetry broadcasting via WebSocket

**Automatic Phase Advancement:**
- Phases advance automatically when completion metrics are met (e.g., Phase 1→2 when food ≥50, shelters ≥1, iron tools ≥1)
- Policy changes trigger automatically on phase transitions
- NPCs receive phase updates and adapt behaviors accordingly
- Tasks are filtered by phase appropriateness

**REST API Endpoints:**
- `GET /api/progression` – Complete status with metrics, completion %, history
- `PUT /api/progression/phase` – Manual phase control (admin)
- `POST /api/progression/metrics` – Bulk metrics update with auto-advancement check
- `POST /api/progression/metric/:name` – Single metric update
- `GET /api/progression/tasks` – Phase-appropriate task recommendations
- `POST /api/progression/reset` – Reset to Phase 1

**WebSocket Events:**
- `progression:phaseChanged` – Real-time phase transition broadcasts
- `progression:progressUpdate` – Metric updates and progress tracking
- `progression:metricUpdate` – Individual metric changes

See **[PHASE_INTEGRATION_SUMMARY.md](PHASE_INTEGRATION_SUMMARY.md)** for complete integration details, architecture diagrams, and usage examples.

### LLM Command Surface
- **`routes/llm.js`** interprets natural-language commands, uses pattern matching for common intents (spawn, list, teleport, etc.), and falls back to NPC engine interpretation when needed.【F:routes/llm.js†L1-L160】
- **`llm_bridge.js`** abstracts OpenAI, Grok (xAI), and future-compatible providers with automatic payload shaping, retry logic, and mock responses when API keys are absent.【F:llm_bridge.js†L1-L195】
- Auth middleware enforces JWT/API-key permissions for LLM-triggered actions, ensuring only approved roles can spawn or command bots.【F:middleware/auth.js†L1-L178】

### Task Planning and Knowledge Persistence
- **`tasks/` planners** convert high-level intents (build, mine, guard, trade, etc.) into executable steps used by the NPC engine.【F:tasks/index.js†L1-L79】
- **`knowledge_store.js`** records outcomes, yields, and hazard telemetry to inform future decisions and report success metrics.【F:knowledge_store.js†L1-L72】
- Sample fusion data and metrics in `data/` bootstrap the dashboard for demos, while watchers and cache invalidation in `server.js` keep responses fresh as the knowledge base evolves.【F:server.js†L23-L116】【F:server.js†L268-L288】

## Key Modules Reference

### Core Hybrid Bot Framework
| Path | Role |
| --- | --- |
| **`core/npc_microcore.js`** | ⭐ Local tick loop (200ms) for each bot with movement physics, scanning, reactive events, and **phase-aware autonomous behaviors** |
| **`plugins/FGDProxyPlayer/`** | ⭐ Paper/Spigot plugin (Java) for real Minecraft integration via WebSocket |
| `minecraft_bridge.js` | RCON + WebSocket plugin abstraction with `moveBot()`, `scanArea()`, spawn/despawn helpers, and **phase telemetry** |
| `npc_spawner.js` | Spawn orchestration with **microcore auto-initialization** |
| `npc_engine.js` | Task dispatch, queueing, **microcore task synchronization**, and **phase propagation** |

### Phase Progression System
| Path | Role |
| --- | --- |
| **`core/progression_engine.js`** | ⭐ Central phase controller with metrics tracking, auto-advancement, and event emission |
| **`llm_prompts/federation_progression_prompt.js`** | ⭐ Strategic advisor prompts for LLM integration |
| `policy_engine.js` | Phase-based policies with bot limits, permission gates, and resource priorities |
| `autonomic_core.js` | Event-based synchronization, task scheduling on phase changes |

### Backend Services
| Path | Role |
| --- | --- |
| `server.js` | Unified governance server with authentication, **plugin WebSocket interface**, NPC lifecycle endpoints, and telemetry |
| `routes/bot.js` | Authenticated CRUD API for NPCs with spawn limits, learning integration, and **runtime data** (position, velocity, tick, scan results) |
| `routes/llm.js` | Natural language interpreter translating operator prompts into NPC engine operations |
| `llm_bridge.js` | Multi-provider LLM adapter with retries and mock fallback for development |

### NPC Lifecycle & Learning
| Path | Role |
| --- | --- |
| `npc_registry.js` | Persistent identity database with role indices, validation, and serialization support |
| `npc_finalizer.js` | Archives, despawns, and cleans up NPCs while **detaching microcore** |
| `learning_engine.js` | Maintains NPC profiles, traits, skill progression, and debounced persistence to disk |
| `tasks/` | Library of task planners and helpers for NPC action decomposition |

### Governance & Dashboards
| Path | Role |
| --- | --- |
| `autonomic_core.js` / `policy_engine.js` | Governance loop for health monitoring, adaptive policy adjustments, and **progression system integration** |
| `dashboard.html` / `dashboard.js` | Cluster monitoring UI with charts, fusion memory overview, and policy controls |
| `admin.html` / `admin.js` | Admin portal with login, spawn/despawn forms, and realtime console feed |

## Installation and Setup

### Backend Services
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Start the unified server**
   - Development or quick admin stack: `npm start` (runs `server.js`).【F:package.json†L5-L11】
   - Live governance stack: `node server.js` (requires Node 18+ for ES modules and async/await).
3. **Configure environment variables** as described below before launching in production.

### Minecraft Server Preparation
1. **Install Paper Server** (1.20+ recommended) - See [PAPER_GEYSER_SETUP.md](PAPER_GEYSER_SETUP.md) for detailed instructions
2. **Enable RCON** in `server.properties`:
   ```properties
   enable-rcon=true
   rcon.port=25575
   rcon.password=your_secure_password
   ```
3. **Set environment variables** in FGD `.env`:
   ```bash
   MINECRAFT_RCON_HOST=127.0.0.1
   MINECRAFT_RCON_PORT=25575
   MINECRAFT_RCON_PASSWORD=your_secure_password
   ```
4. Expose required ports (Minecraft, RCON, dashboard) or limit them to localhost for security.

### FGDProxyPlayer Plugin Installation

**For real bot integration (visible entities, movement, scanning):**

1. **Build the plugin:**
   ```bash
   cd plugins/FGDProxyPlayer
   mvn clean package
   ```

2. **Install to Minecraft server:**
   ```bash
   cp target/FGDProxyPlayer-1.0.0.jar /path/to/minecraft/plugins/
   ```

3. **Configure plugin:**
   Edit `plugins/FGDProxyPlayer/config.yml`:
   ```yaml
   fgd:
     server-url: "ws://localhost:3000"  # Your FGD server
     auto-connect: true
     auto-reconnect: true
   ```

4. **Restart Minecraft server** and verify connection:
   ```
   /fgd status
   ```

   You should see:
   ```
   Server URL: ws://localhost:3000
   Connected: ✓ Yes
   Active Bots: 0
   ```

**See [HYBRID_BOTS_SETUP.md](HYBRID_BOTS_SETUP.md) for complete setup guide and troubleshooting.**

### Admin and Dashboard Clients
- Visit `http://localhost:3000/` for the admin panel and supply the API key configured in `ADMIN_API_KEY`. The UI now prompts for credentials instead of auto-signing in with a placeholder.【F:server.js†L360-L520】【F:admin.js†L1-L80】
- Visit `http://localhost:3000/dashboard.html` or `http://localhost:3000/fusion.html` for operations dashboards once the server is running.

## Configuration

### Environment Variables
| Variable | Default | Description |
| --- | --- | --- |
| `ADMIN_API_KEY` | `admin-key-change-me` | API key accepted by the admin role through the authentication middleware. Production boots will fail if this remains the placeholder.【F:middleware/auth.js†L18-L125】【F:security/secrets.js†L1-L104】 |
| `LLM_API_KEY` | `llm-key-change-me` | API key accepted by the LLM integration role for `/api/llm` access. Must be overridden for production deployments.【F:middleware/auth.js†L18-L125】【F:security/secrets.js†L1-L104】 |
| `PORT` | `3000` | HTTP port for `server.js` (falls back to default if unset).【F:server.js†L23-L24】【F:server.js†L818-L858】 |
| `MINECRAFT_RCON_HOST` | `127.0.0.1` | Overrides Paper server host for bridge connections.【F:server.js†L150-L168】 |
| `MINECRAFT_RCON_PORT` | `25575` | Overrides RCON port.【F:server.js†L150-L168】 |
| `MINECRAFT_RCON_PASSWORD` | _empty_ | Enables bridge initialization when provided.【F:server.js†L150-L188】 |
| `OPENAI_API_KEY` / `OPENAI_API_URL` | _none_ | Credentials and optional endpoint override for OpenAI requests.【F:llm_bridge.js†L10-L121】 |
| `GROK_API_KEY` / `GROK_API_URL` | _none_ | Credentials for Grok/xAI support.【F:llm_bridge.js†L10-L121】 |
| `LLM_PROVIDER` | `openai` | Selects which provider configuration to use in the LLM bridge.【F:llm_bridge.js†L28-L36】 |
| `JWT_SECRET` | Random | JWT signing secret for `server.js` authentication middleware.【F:middleware/auth.js†L1-L125】 |
| `JWT_EXPIRES_IN` | `24h` | Token lifetime.【F:middleware/auth.js†L7-L56】 |
| `ADMIN_API_KEY` / `LLM_API_KEY` | Hard-coded defaults | Alternative API key auth for admin vs LLM clients (development only defaults).【F:middleware/auth.js†L18-L156】【F:security/secrets.js†L1-L104】 |
| `LOG_LEVEL` | `info` | Controls minimum log level for the shared logger instance.【F:logger.js†L150-L176】 |

Additional experimental flags exist throughout the repository (e.g., `DEBUG`, `LLM_CONTROL_RATIO`) and can be toggled when running CLI tooling or interpreters.【F:npc_cli.js†L395-L400】【F:interpreter.js†L29-L279】

### Config Files and Data Stores
- `minecraft-bridge-config.js` – Default bridge options; override via imports or environment variables before instantiating `MinecraftBridge`.【F:minecraft-bridge-config.js†L1-L117】
- `data/` – Sample telemetry, fusion knowledge, NPC registry, profiles, archive, and policy state used by the dashboards and NPC system.【F:server.js†L23-L288】
- `governance_config.json` / `policy_state.json` – Seeds for autonomic core and policy engine adjustments; the autonomic core will create defaults if missing.【F:autonomic_core.js†L1-L120】【F:policy_engine.js†L1-L72】

## Usage Examples

### REST API
```bash
# List bots (admin API key)
curl -H "X-API-Key: $ADMIN_API_KEY" http://localhost:3000/api/bots

# Create a miner bot
curl -X POST -H "Content-Type: application/json" \
     -H "X-API-Key: $ADMIN_API_KEY" \
     -d '{"name":"miner_01","role":"miner"}' \
     http://localhost:3000/api/bots

# Despawn a bot
curl -X DELETE -H "X-API-Key: $ADMIN_API_KEY" \
     http://localhost:3000/api/bots/miner_01
```
These routes are validated and broadcast over Socket.IO so that admin consoles stay in sync.【F:server.js†L360-L520】【F:routes/bot.js†L73-L200】

`server.js` also exposes a richer `/api/npcs` namespace for archive queries, dead-letter retries, and lifecycle management if you need advanced controls.【F:server.js†L400-L760】

### Phase Progression API
The progression system provides comprehensive REST endpoints for managing and monitoring the federation's advancement:

```bash
# Get complete progression status
curl http://localhost:3000/api/progression

# Get current phase information
curl http://localhost:3000/api/progression/phase

# Update metrics (triggers auto-advancement check)
curl -X POST -H "Content-Type: application/json" \
     -d '{"food": 60, "shelters": 2, "ironTools": 3}' \
     http://localhost:3000/api/progression/metrics

# Manually advance to a specific phase (admin)
curl -X PUT -H "Content-Type: application/json" \
     -d '{"phase": 3}' \
     http://localhost:3000/api/progression/phase

# Increment a specific metric
curl -X POST -H "Content-Type: application/json" \
     -d '{"increment": 5}' \
     http://localhost:3000/api/progression/metric/food

# Get phase-appropriate task recommendations
curl http://localhost:3000/api/progression/tasks

# Reset progression to Phase 1
curl -X POST http://localhost:3000/api/progression/reset

# Get autonomic core status (includes progression state)
curl http://localhost:3000/api/autonomic
```

**Phase Metrics by Phase:**
- **Phase 1**: food, shelters, ironTools
- **Phase 2**: automations, ironArmor, storage
- **Phase 3**: villagers, diamondTools, netherPortal
- **Phase 4**: netherAccess, blazeRods, enderPearls, potions
- **Phase 5**: portalReady, maxEnchantedGear
- **Phase 6**: dragonDefeated, elytra, shulkerBoxes, advancedFarms

Real-time updates are broadcast via WebSocket on `progression:phaseChanged`, `progression:progressUpdate`, and `progression:metricUpdate` events.

### LLM-powered Commands
Send a natural language instruction through the LLM router (requires JWT or API key configured for the `llm` role):
```bash
curl -X POST -H "Content-Type: application/json" \
     -H "X-API-Key: llm-key-change-me" \
     -d '{"command":"spawn bot atlas as builder"}' \
     http://localhost:3000/api/llm/command
```
Commands are parsed against pattern handlers (`spawn`, `list`, `teleport`, etc.) and ultimately executed through the NPC engine and bridge.【F:routes/llm.js†L16-L160】【F:minecraft_bridge.js†L1-L72】

## Developer Notes
- Socket.IO events surface bot and system activity; listen to `bot:created`, `bot:spawned`, `bot:despawned`, and `system:log` for real-time automation hooks.【F:server.js†L360-L520】
- The autonomic core can be extended with new policy actions or telemetry taps; see `autonomic_core.js` for lifecycle hooks and `policy_engine.js` for thresholds and clamps.【F:autonomic_core.js†L41-L120】【F:policy_engine.js†L83-L156】
- Task planners live in `tasks/` and can be expanded with additional Minecraft verbs; register new planners in `tasks/index.js` to make them available to interpreters.【F:tasks/index.js†L1-L79】
- Knowledge persistence can be adapted by subclassing `KnowledgeStore` or changing the persistence path; it already emits events for analytics integrations.【F:knowledge_store.js†L1-L72】
- For CLI or automation experiments, review `npc_cli.js`, `interpreter.js`, and the scripts in `examples/` for sample orchestrations and debugging toggles.【F:npc_cli.js†L395-L400】【F:interpreter.js†L29-L279】

## Versioning and Updates
- Current package version: **2.1.0**, published under the GPL-3.0 license.【F:package.json†L2-L8】
- The server uses ES modules; keep your runtime on modern Node.js (v18+) to leverage top-level `await` and native `fetch`.
- The repository includes Windows (`*.bat`) and Unix (`*.sh`) helper scripts for spinning up the full stack; adjust them to reference `server.js` if you migrate from the legacy runtime.

## Known Issues and Limitations
- Legacy registry/spawner shims have been removed; extend the live `NPCRegistry` and `NPCSpawner` exports when building new features.【F:npc_registry.js†L1-L200】【F:npc_spawner.js†L1-L200】
- Development defaults exist for API keys and the RCON password, but the server now emits warnings and blocks production boots when placeholders are detected. Override `ADMIN_API_KEY`, `LLM_API_KEY`, and `MINECRAFT_RCON_PASSWORD` before going live.【F:middleware/auth.js†L1-L125】【F:minecraft-bridge-config.js†L1-L48】【F:server.js†L120-L210】
- Metrics are sourced from real telemetry feeds and host statistics; ensure your deployment updates the JSON payloads in `data/` (or supplies live emitters) instead of relying on random sampling.【F:server.js†L240-L420】
- LLM providers return mock responses when API keys are absent; ensure credentials are configured to avoid silent fallbacks during testing.【F:llm_bridge.js†L108-L195】
