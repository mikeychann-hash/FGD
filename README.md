# FGD

FGD is a Minecraft NPC swarm management stack that exposes REST and WebSocket controls for orchestrating bots from the desktop app, CLI, or external services. The project wraps mineflayer and a lightweight server plugin bridge so bots can be steered autonomously or driven directly by operators.

## Quick start

1. **Install dependencies**: `npm install`
2. **Configure secrets**: set the API key and database values in your environment (see `security/env-validation.js` for required variables).
3. **Launch the stack**: run `./start-all.sh` (or `./quick-start.sh`) to start the Express API, Minecraft bridge, and supporting services.
4. **Open the API docs**: visit `http://localhost:3000/docs/api` once the server is up to explore and exercise the routes.
5. **Spawn bots**: use the desktop app, CLI, or `/api/bots/spawn` to bring NPCs online through the unified spawn pipeline.

## Project layout

- `server.js` – Express entrypoint that mounts API routes, WebSocket events, and Swagger docs.
- `npc_engine/` – Core bot lifecycle, task scheduling, and per-bot microcore loop.
- `routes/` – REST route handlers for bots, control sessions, governance, progression, and server administration.
- `src/services/` – Shared services such as the spawn pipeline, policy enforcement, metrics, and mineflayer initialization.
- `minecraft_bridge*.js` – Bridges for RCON/plugin and mineflayer-native control paths into Minecraft.

## Contributing

- Keep modules as ES modules (import with `.js` extensions).
- Emit events for observable state changes and log with the shared `logger`.
- Run lint/tests for behavioral changes; documentation-only edits generally do not require a test run.
