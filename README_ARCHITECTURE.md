# FGD Architecture

FGD pairs an Express API with Minecraft bridges and a per-bot microcore to coordinate autonomous and operator-driven NPCs. The stack is designed so orchestration, policy, and telemetry can be composed without coupling clients to a single control path.

## Major components

- **API server (`server.js`)** – Hosts REST and WebSocket endpoints for bot lifecycle, action dispatch, manual control sessions, governance approvals, and server administration. Swagger docs are served from `/docs/api`.
- **NPC engine (`npc_engine/`)** – Runs the per-bot tick loop, task queue, and autonomy behaviors. The engine emits events that drive progression, metrics, and UI updates.
- **Spawn and control services (`src/services/`)** – Home to the spawn pipeline, bot control manager, action pipeline, mineflayer initializer, and policy service used by the v2 mineflayer routes.
- **Minecraft bridges (`minecraft_bridge.js`, `minecraft_bridge_mineflayer.js`)** – Provide two ingress paths: a plugin/RCON bridge for server-side authority and a mineflayer-native bridge for direct bot connections.
- **Desktop/CLI clients (`desktop-app/`, `cli/`)** – Talk to the API and WebSocket endpoints to present dashboards, send actions, and stream control inputs.
- **Metrics and health (`src/services/metrics.js`, `/routes/minecraft_status.js`)** – Export Prometheus metrics, expose subsystem health, and report bridge readiness to gating clients.

## Data and control flow

1. **Requests arrive at the API server** via REST or WebSocket (Socket.IO). Authentication and governance checks are applied before routing actions to the engine or bridges.
2. **The NPC engine coordinates actions** by queuing tasks, running per-bot updates, and emitting events (`bot:spawned`, `progression:phaseChanged`, etc.) consumed by clients and metrics exporters.
3. **Bridges forward commands into Minecraft**. The plugin/RCON path issues commands against the live server, while the mineflayer bridge mirrors actions through native bot connections and enforces policy via the governance service when enabled.
4. **Telemetry and health signals** from the engine and bridges feed Prometheus metrics and `/api/health`/`/api/minecraft/status` so dashboards can react to degraded subsystems.

## Configuration and deployment

- **Environment**: Critical secrets (API keys, auth tokens, DB credentials) are validated at startup (`security/env-validation.js`).
- **Cluster orchestration**: `src/services/init_cluster.js` wires multi-node state and routes; `cluster_config.jsonc` contains defaults.
- **Database**: Initialization flows live in `src/database/connection.js` with migrations under `migrations/` for persistent state.
- **Runtime scripts**: `start-all.sh`, `start-mineflayer.bat`, and `start-server.sh` coordinate launching the API, bridge processes, and supporting services on different platforms.
