# 🧠 AICraft Federation Governance Dashboard (FGD)

AICraft Federation Governance Dashboard (FGD) is a full-stack control plane for managing Minecraft-based NPC swarms, monitoring cluster health, and coordinating LLM-assisted automation. The repository combines a persistent Express/Socket.IO backend, a web-based admin console, a live operations dashboard, and an extensible NPC/LLM integration layer that bridges into Paper/Geyser Minecraft servers.

## Table of Contents
- [Project Purpose](#project-purpose)
- [System Architecture](#system-architecture)
  - [Runtime Entry Points](#runtime-entry-points)
  - [Web Dashboards](#web-dashboards)
  - [NPC Lifecycle and Learning Stack](#npc-lifecycle-and-learning-stack)
  - [Minecraft Bridge and Game Integration](#minecraft-bridge-and-game-integration)
  - [Autonomic Governance and Policy Enforcement](#autonomic-governance-and-policy-enforcement)
  - [LLM Command Surface](#llm-command-surface)
  - [Task Planning and Knowledge Persistence](#task-planning-and-knowledge-persistence)
- [Key Modules Reference](#key-modules-reference)
- [Installation and Setup](#installation-and-setup)
  - [Backend Services](#backend-services)
  - [Minecraft Server Preparation](#minecraft-server-preparation)
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
- Providing dashboards for cluster metrics, fusion memory inspection, and governance policy controls.【F:dashboard.js†L1-L199】
- Persisting NPC identity, traits, learning progress, and outcome knowledge to drive adaptive behaviors.【F:npc_registry.js†L1-L160】【F:learning_engine.js†L1-L149】【F:knowledge_store.js†L1-L72】
- Bridging natural-language instructions through multiple LLM providers to in-game actions and NPC tasking.【F:routes/llm.js†L1-L160】【F:llm_bridge.js†L1-L195】

## System Architecture

### Runtime Entry Point
- **`server.js`** – Unified entry used by the helper scripts and `npm` commands. It layers authentication, cached fusion data access, bot/LLM routers, NPC archival, metrics simulation, and health endpoints to deliver the full governance stack in a single process.【F:server.js†L1-L640】

The server also serves static assets from the repository root so that `admin.html`, `dashboard.html`, and `fusion.html` load without additional build steps.【F:server.js†L118-L400】

### Web Dashboards
- **Admin console (`admin.html` + `admin.js`)** auto-logins with an API key, lists bots, and exposes spawn/despawn workflows backed by REST endpoints and Socket.IO events from the unified server.【F:admin.js†L1-L109】【F:server.js†L360-L520】
- **Operations dashboard (`dashboard.html` + `dashboard.js`)** polls or streams cluster state, renders CPU/memory charts, summarizes fusion memory, and lets operators tweak policy parameters live.【F:dashboard.js†L1-L199】【F:server.js†L290-L345】

### NPC Lifecycle and Learning Stack
The NPC subsystem is composed of:
- **`npc_registry.js`** – Persistent identity database with role indices, validation, and serialization support.【F:npc_registry.js†L1-L160】
- **`npc_spawner.js`** – Coordinates registry, learning engine, NPC engine, and Minecraft bridge to create fully realized bots (noting legacy/disabled sections for compatibility).【F:npc_spawner.js†L1-L150】
- **`npc_finalizer.js`** – Archives, despawns, and cleans up NPCs while retaining lifecycle statistics.【F:npc_finalizer.js†L1-L138】
- **`learning_engine.js`** – Maintains NPC profiles, traits, skill progression, and debounced persistence to disk.【F:learning_engine.js†L1-L149】
- **`npc_engine/`** – Queueing, dispatch, autonomy, and bridge helpers that coordinate bot behaviors with the Minecraft bridge.【F:npc_engine/dispatch.js†L1-L200】

`server.js` wires these components together, ensures registries and archives are loaded, and surfaces management endpoints (`/api/npcs`, dead-letter queues, archives) for full lifecycle control.【F:server.js†L190-L400】

### Minecraft Bridge and Game Integration
- **`minecraft_bridge.js`** – Wraps RCON, emits connection status, and provides spawn/despawn helpers used by REST and LLM flows.【F:minecraft_bridge.js†L1-L72】
- **`minecraft-bridge-config.js`** – Centralizes host, port, security, heartbeat, and spawn templates for Paper/Geyser servers.【F:minecraft-bridge-config.js†L1-L117】
- Environment-aware initialization in `server.js` skips bridge startup unless credentials are provided, making game connectivity optional in development.【F:server.js†L150-L188】

### Autonomic Governance and Policy Enforcement
- **`autonomic_core.js`** – Periodically gathers system metrics, enforces thresholds, and coordinates with the policy engine; it runs automatically when the runtime boots.【F:autonomic_core.js†L1-L120】
- **`policy_engine.js`** – Evaluates CPU/memory load, produces prioritized remediation actions, and persists policy adjustments for auditability.【F:policy_engine.js†L1-L156】
- Policy adjustments feed into the dashboard’s sliders and configuration endpoints exposed by `server.js` for live tuning.【F:server.js†L320-L335】

### LLM Command Surface
- **`routes/llm.js`** interprets natural-language commands, uses pattern matching for common intents (spawn, list, teleport, etc.), and falls back to NPC engine interpretation when needed.【F:routes/llm.js†L1-L160】
- **`llm_bridge.js`** abstracts OpenAI, Grok (xAI), and future-compatible providers with automatic payload shaping, retry logic, and mock responses when API keys are absent.【F:llm_bridge.js†L1-L195】
- Auth middleware enforces JWT/API-key permissions for LLM-triggered actions, ensuring only approved roles can spawn or command bots.【F:middleware/auth.js†L1-L178】

### Task Planning and Knowledge Persistence
- **`tasks/` planners** convert high-level intents (build, mine, guard, trade, etc.) into executable steps used by the NPC engine.【F:tasks/index.js†L1-L79】
- **`knowledge_store.js`** records outcomes, yields, and hazard telemetry to inform future decisions and report success metrics.【F:knowledge_store.js†L1-L72】
- Sample fusion data and metrics in `data/` bootstrap the dashboard for demos, while watchers and cache invalidation in `server.js` keep responses fresh as the knowledge base evolves.【F:server.js†L23-L116】【F:server.js†L268-L288】

## Key Modules Reference
| Path | Role |
| --- | --- |
| `server.js` | Unified governance server with authentication, fusion data caching, NPC lifecycle endpoints, and simulated telemetry.【F:server.js†L1-L640】 |
| `routes/bot.js` | Authenticated CRUD API for NPCs with spawn limits, learning integration, and Socket.IO notifications.【F:routes/bot.js†L1-L200】 |
| `routes/llm.js` | Natural language interpreter translating operator prompts into NPC engine operations.【F:routes/llm.js†L1-L160】 |
| `minecraft_bridge.js` | RCON abstraction with spawn/despawn helpers and event emitters for connection state.【F:minecraft_bridge.js†L1-L72】 |
| `autonomic_core.js` / `policy_engine.js` | Governance loop for health monitoring and adaptive policy adjustments.【F:autonomic_core.js†L1-L120】【F:policy_engine.js†L1-L156】 |
| `npc_registry.js`, `npc_spawner.js`, `npc_finalizer.js`, `learning_engine.js` | Identity persistence, spawn orchestration, archival, and skill tracking for NPCs.【F:npc_registry.js†L1-L160】【F:npc_spawner.js†L1-L150】【F:npc_finalizer.js†L1-L138】【F:learning_engine.js†L1-L149】 |
| `tasks/` | Library of task planners and helpers for NPC action decomposition.【F:tasks/index.js†L1-L79】 |
| `dashboard.html` / `dashboard.js` | Cluster monitoring UI with charts, fusion memory overview, and policy controls.【F:dashboard.js†L1-L199】 |
| `admin.html` / `admin.js` | Admin portal with login, spawn/despawn forms, and realtime console feed.【F:admin.js†L1-L109】 |
| `llm_bridge.js` | Multi-provider LLM adapter with retries and mock fallback for development.【F:llm_bridge.js†L1-L195】 |

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
1. Enable RCON on your Paper server and ensure the credentials in `minecraft-bridge-config.js` or environment variables match.【F:minecraft-bridge-config.js†L5-L44】
2. Expose required ports (Minecraft, RCON, dashboard, update server) or limit them to localhost per the security recommendations in the config file.【F:minecraft-bridge-config.js†L80-L117】
3. When using `server.js`, set `MINECRAFT_RCON_PASSWORD` to trigger bridge initialization; otherwise the bridge remains disabled for offline development.【F:server.js†L150-L188】

### Admin and Dashboard Clients
- Visit `http://localhost:3000/` for the admin panel (default API key `admin123`).【F:server.js†L360-L520】【F:admin.js†L4-L26】
- Visit `http://localhost:3000/dashboard.html` or `http://localhost:3000/fusion.html` for operations dashboards once the server is running.

## Configuration

### Environment Variables
| Variable | Default | Description |
| --- | --- | --- |
| `ADMIN_API_KEY` | `admin-key-change-me` | API key accepted by the admin role through the authentication middleware.【F:middleware/auth.js†L18-L125】 |
| `LLM_API_KEY` | `llm-key-change-me` | API key accepted by the LLM integration role for `/api/llm` access.【F:middleware/auth.js†L18-L125】 |
| `PORT` | `3000` | HTTP port for `server.js` (falls back to default if unset).【F:server.js†L23-L24】【F:server.js†L818-L858】 |
| `MINECRAFT_RCON_HOST` | `127.0.0.1` | Overrides Paper server host for bridge connections.【F:server.js†L150-L168】 |
| `MINECRAFT_RCON_PORT` | `25575` | Overrides RCON port.【F:server.js†L150-L168】 |
| `MINECRAFT_RCON_PASSWORD` | _empty_ | Enables bridge initialization when provided.【F:server.js†L150-L188】 |
| `OPENAI_API_KEY` / `OPENAI_API_URL` | _none_ | Credentials and optional endpoint override for OpenAI requests.【F:llm_bridge.js†L10-L121】 |
| `GROK_API_KEY` / `GROK_API_URL` | _none_ | Credentials for Grok/xAI support.【F:llm_bridge.js†L10-L121】 |
| `LLM_PROVIDER` | `openai` | Selects which provider configuration to use in the LLM bridge.【F:llm_bridge.js†L28-L36】 |
| `JWT_SECRET` | Random | JWT signing secret for `server.js` authentication middleware.【F:middleware/auth.js†L1-L125】 |
| `JWT_EXPIRES_IN` | `24h` | Token lifetime.【F:middleware/auth.js†L7-L56】 |
| `ADMIN_API_KEY` / `LLM_API_KEY` | Hard-coded defaults | Alternative API key auth for admin vs LLM clients.【F:middleware/auth.js†L18-L156】 |
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
curl -H "X-API-Key: admin123" http://localhost:3000/api/bots

# Create a miner bot
curl -X POST -H "Content-Type: application/json" \
     -H "X-API-Key: admin123" \
     -d '{"name":"miner_01","role":"miner"}' \
     http://localhost:3000/api/bots

# Despawn a bot
curl -X DELETE -H "X-API-Key: admin123" \
     http://localhost:3000/api/bots/miner_01
```
These routes are validated and broadcast over Socket.IO so that admin consoles stay in sync.【F:server.js†L360-L520】【F:routes/bot.js†L73-L200】

`server.js` also exposes a richer `/api/npcs` namespace for archive queries, dead-letter retries, and lifecycle management if you need advanced controls.【F:server.js†L400-L760】

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
- Some legacy classes (`NPCRegistryOld`, `NPCSpawnerOld`) remain in the codebase for compatibility but are marked as disabled; prefer the active implementations wired through `server.js` and `npc_engine/` when extending the system.【F:npc_registry.js†L1-L52】【F:npc_spawner.js†L18-L24】
- Default secrets (`admin123`, `admin-key-change-me`, `llm-key-change-me`, `fgd_rcon_password_change_me`) are placeholders and must be overridden before production use.【F:server.js†L360-L520】【F:middleware/auth.js†L18-L156】【F:minecraft-bridge-config.js†L5-L117】
- The dashboard simulates metrics unless real telemetry is provided; integrate with actual cluster data sources to avoid relying on random sampling.【F:server.js†L290-L345】
- LLM providers return mock responses when API keys are absent; ensure credentials are configured to avoid silent fallbacks during testing.【F:llm_bridge.js†L108-L195】
