# FGD Codebase Review

> **Project**: Federation Governance Dashboard (FGD)
> **Version**: 2.1.0
> **Review Date**: 2026-04-17
> **Branch**: `claude/review-everything-yDkxi`
> **Scope**: Full repository — what the app does, its architecture, and a consolidated review (security, code quality, API/config).

---

## Part 1 — What FGD Does

FGD is a **Minecraft NPC swarm management system**. It is the control plane for spawning, governing, and orchestrating AI-powered bots ("NPCs") on a Paper 1.21.8 Minecraft server.

### Capabilities

- **Bot fleet management**: spawn, despawn, monitor up to 8 concurrent bots through two parallel bridges:
  - **RCON + FGDProxyPlayer plugin** (Java) for server-side bot control
  - **Mineflayer** for native JS bot clients (pathfinding, combat, auto-eat, block collection)
- **Autonomous task planning**: an AI-driven autonomy manager generates tasks (mine, craft, combat, build, explore) and dispatches them through a priority queue with policy approval.
- **Per-bot runtime ("microcore")**: tick loop, area scanning, memory context, and phase-aware behavior per NPC.
- **Game progression phases**: 6 phases (Survival → Resource Expansion → Infrastructure → Nether Expansion → End Prep → Post-Dragon) that change priorities and behavior.
- **Learning engine**: tracks per-bot profiles to improve future task execution.
- **Dead-letter queue**: failed spawns/actions are retried.
- **LLM integration**: OpenAI / Anthropic / Grok endpoints route natural-language commands into the NPC engine.

### How operators interact with it

- **REST API** (`/api/bots`, `/api/mineflayer/*`, `/api/action`, `/api/progression`)
- **Socket.IO** for live updates (`bot:spawned`, `bot:moved`, `bot:inventory-update`, `metrics:update`)
- **Electron desktop app** (Windows 11) as the operator UI
- **CLI** for direct admin operations

---

## Part 2 — Architecture

### Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (ESM) |
| HTTP | Express 4.19 |
| Realtime | Socket.IO 4.6 |
| Native bots | Mineflayer 4.x (+ pathfinder, auto-eat, pvp, collectblock) |
| Server bridge | RCON + FGDProxyPlayer plugin (WebSocket) |
| Persistence | PostgreSQL + Redis |
| Auth | JWT + bcrypt + API keys |
| Validation | Zod 4.x |
| Metrics | Prometheus |
| Desktop | Electron 33.x (vanilla JS renderer) |
| Minecraft | Paper 1.21.8 + Geyser + ViaVersion |

### High-Level Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Desktop (Electron) ─┬─ REST API (Express) ─┬─ Socket.IO    │
│                      └──────────────────────┘                │
│                                ▼                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    NPC ENGINE                         │   │
│  │  Registry │ Task Queue │ Autonomy │ Dispatch │       │   │
│  │  Learning Engine │ NPC Spawner (Golden Path)         │   │
│  └──────────────────────────────────────────────────────┘   │
│           ▼                ▼                ▼                │
│  Minecraft Bridge   Mineflayer Bridge   NPC Microcore        │
│  (RCON + Plugin)    (Native bots)       (per-bot runtime)    │
│           └──────────┬─────────┘                             │
│                      ▼                                       │
│              Minecraft Server (Paper 1.21.8)                 │
└──────────────────────────────────────────────────────────────┘
```

### Key Modules

| Module | Responsibility |
|---|---|
| `npc_engine.js` / `npc_engine/` | NPC registration, task queue, autonomy, bridge integration |
| `minecraft_bridge.js` | Hybrid RCON + plugin WebSocket transport |
| `minecraft_bridge_mineflayer.js` | Direct Mineflayer bot lifecycle |
| `core/npc_microcore.js` | Per-bot tick loop |
| `src/services/spawn_pipeline.js` | "Golden Path" — single entry point for all spawns |
| `src/executors/*.js` | Domain task executors (Mine, Craft, Combat, Movement, Inventory) |
| `routes/`, `src/api/` | REST endpoints |
| `src/websocket/` | Socket.IO handlers + plugin protocol |
| `tasks/` | Task planning system (planner_core, planner_ai, domain planners) |
| `plugins/FGDProxyPlayer/` | Java plugin source (server-side bot dispatch) |

### Design Patterns

1. **Golden Path spawning** — every spawn is supposed to flow through `spawn_pipeline.js` (REST/CLI/UI → spawn_pipeline → npc_spawner → bridge.spawnBot → plugin confirmation → Socket.IO event).
2. **Event-driven** — every state change emits, WebSocket broadcasts, telemetry pipeline records.
3. **Modular task executors** — one executor per domain.
4. **Policy-based action approval (v2)** — Mineflayer v2 routes use `MineflayerPolicyService` to gate actions.
5. **Dead-letter queue** — failed spawns/actions land in `npcSpawner.getDeadLetterQueue()` for retry.

---

## Part 3 — Review Findings

Three parallel reviews were conducted (security, code quality, API/config). Findings are consolidated below by severity. Each finding has a file path, line number, and a concrete fix suggestion.

### 🔴 HIGH — Fix Immediately

| # | Issue | Location | Fix |
|---|---|---|---|
| 1 | Missing auth imports in `server.js` — references `authenticate`, `handleLogin`, `authLimiter`, `getCurrentUser`, `refreshAccessToken`, `logout` but never imports them. Authentication is broken or crashing at runtime. | `server.js:48-85` | Add `import { authenticate, handleLogin, getCurrentUser, refreshAccessToken, logout } from './middleware/auth.js'` and `import { authLimiter } from './src/middleware/rateLimiter.js'`. |
| 2 | Default password fallback `'AdminPass123'` if `ADMIN_PASSWORD` unset. | `middleware/auth.js:75` | Throw in production if not set. |
| 3 | Hardcoded API key default `"admin123"` in legacy entry point. | `index.js:27` | Fail-fast on missing/weak `FGD_API_KEY`. |
| 4 | WebSocket `plugin_register` is unauthenticated — anyone can impersonate FGDProxyPlayer. | `src/websocket/handlers.js:73-81` | Add `io.use()` socket auth middleware; reject if `socket.user` not set. |
| 5 | Command + control routes have **no auth** (mine, craft, attack, explore, build, session/start, session/stop). | `routes/command.js:6-63`, `routes/control.js:6-42` | `router.use(authenticate, authorize('command'))`. |
| 6 | No security headers (no helmet) — missing CSP, HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection. | `src/config/server.js:1-80` | `app.use(helmet())`. |
| 7 | `express.json()` has no size limit — large-payload DoS. | `src/config/server.js:64` | `express.json({ limit: '10mb' })`. |
| 8 | No `unhandledRejection` handler — promise failures swallowed. | `server.js:417-424` | `process.on('unhandledRejection', (reason) => gracefulShutdown('UNHANDLED_REJECTION'))`. |
| 9 | EventEmitter listener leak — `_unbindBridgeSensors()` never called on NPC unregister or shutdown. | `npc_engine.js:575-584` | Call in destructor / graceful shutdown; track per-bot listener counts. |
| 10 | Non-atomic registry writes — concurrent saves can corrupt JSON; errors silently swallowed (`.catch(() => {})`). | `npc_registry.js:382-395` | Write to `.tmp` then `fs.rename()`; throw on error; add retry. |
| 11 | Async work in constructor not awaited — registry races with route handlers calling `getIdleNPCs()`. | `npc_engine.js:98-122` | Expose `engine.ready` promise; await in `startServer()` before mounting routes. |
| 12 | Task timeout leak — `setTimeout` not cleared on completion. | `npc_engine/dispatch.js:53-62` | Clear timeout in `completeTask()`. |
| 13 | Duplicate property assignments in bridge constructor (`pluginStatus`, `pendingSpawns`, etc. defined twice). | `minecraft_bridge.js:50-54` | Remove duplicates. |
| 14 | `routes/llm.js` calls `engine.spawnNPC()` directly, bypassing the Golden Path spawn pipeline (skips budget, validation, dead-letter). | `routes/llm.js:268-270` | Use `spawnBot(npcSystem, io, { ... source: 'teleport' })`. |

### 🟡 MEDIUM

- ~~**Mineflayer v1/v2 overlap**~~ — **RESOLVED** (commit on this branch): v1 now emits `Deprecation: true` / `Sunset: 2026-07-01` / `Link: </api/v2/mineflayer>; rel="successor-version"` headers, logs a warning on first use per (method, path, client), and is no longer silently substituted for v2 on `/api/mineflayer`. If v2's policy service fails, `/api/mineflayer` returns 503 instead of falling back to the direct-control surface.
- **Mineflayer bot listener leak** — `disconnectBot()` doesn't `bot.off()` the 6 attached listeners (move, health, end, error, entitySpawn, entityMoved). After ~10 disconnects, ~60 orphaned listeners accumulate. (`minecraft_bridge_mineflayer.js:836-909`, `minecraft_bridge_mineflayer.js:135-150`)
- **Inconsistent API response envelopes** — `routes/mineflayer.js` returns `{success, bot/task, result}`, `routes/bot.js` returns `{success, count, bots}`, `src/api/npcs.js` returns raw `{npcs, total, limit, offset}` with no `success` field. Standardize on `{success, error?, data, pagination?}`.
- **Missing input validation (no Zod)** on `routes/command.js` mine/craft/attack/build endpoints. Apply a `validate()` middleware.
- **OpenAPI spec severely out of sync** — `docs/openapi/swagger.yaml` documents only ~6 paths; implementation has 50+. Missing all `/api/mineflayer/*`, `/api/action/*`, `/api/llm/*`, `/api/auth/*`, `/api/server/*`, policy endpoints. Regenerate from JSDoc.
- **`DB_PASSWORD` not enforced** — marked `required: false` in env validation; missing password only errors when `initDatabase()` runs. (`security/env-validation.js:87-96`, `src/database/connection.js:28-34`) Require it in production.
- **In-memory JWT blacklist lost on restart** — uses a `Set` with `setTimeout` cleanup. Move to Redis. (`middleware/auth.js:14-15`, `middleware/auth.js:170-179`)
- **Spawn rate limiters defined but not applied** — `botSpawnLimiter` / `botSpawnAllLimiter` exist in `src/middleware/rateLimiter.js` but aren't used on `routes/bot.js` spawn endpoints.
- **Sensitive values in logs** — `src/database/connection.js:90` logs full SQL on query failure (passwords in query strings get logged); `src/middleware/errorHandlers.js:15` dumps full `err` object. Redact and log only `{message, code}`.
- **Inconsistent FK delete behavior** — `metrics`, `system_events` use `ON DELETE SET NULL`; `learning_profiles`, `task_queue` use `ON DELETE CASCADE`. Pick one. Missing indexes on `task_queue.npc_id`, `metrics.npc_id`, `learning_profiles.created_at`. (`src/database/schema.js`)
- **`core_runtime.js` is dead code with hardcoded RCON password** `"mikelind"` and host `127.0.0.1:25575`. Never imported by `server.js`. Delete it. (`core_runtime.js:1-90`)
- **Critical modules untested** — no tests for `src/services/spawn_pipeline.js`, `minecraft_bridge_mineflayer.js`, `src/services/action_pipeline/index.js`, `npc_spawner.js`. Only `test/npc_system.test.js` exists.
- **State recompute not serialized** — `src/services/state.js:6-99` reads `npcEngine.npcs` and emits in separate steps; concurrent calls can interleave. Serialize with a queue or flag.
- **Auth-disabled mode silently bypasses** — when `ADMIN_API_KEY` is unset, `authenticateApiKey` assigns admin role with only a console warning. Log loudly at startup. (`middleware/auth.js:266-274`)
- **Hardcoded API key placeholders in `.env.example`** — `folks123`, `llm-key-change-me`. Add a startup check that rejects these specific values.
- **Control routes missing `success` envelope** — some return `{success, message}`, others return raw `state`. (`routes/control.js`)

### 🟢 LOW

- `setInterval` timers (`startHungerMonitor`, `startChestMonitor`) not stopped in graceful shutdown. (`server.js:260-291`, `npc_engine.js:632-681`)
- Magic numbers scattered: pathfinder timeout `30000ms`, mining timeout `30000ms`, JWT TTL `'1h'`, salt rounds `12`, rate limit window `15*60*1000`. Centralize in `src/config/` with env overrides.

---

## Part 4 — Suggested Remediation Order

1. **Restore authentication** — fix `server.js` missing imports (#1), apply auth to `routes/command.js` and `routes/control.js` (#5), authenticate Socket.IO `plugin_register` (#4).
2. **Remove default credentials** — fail-fast on `ADMIN_PASSWORD` (#2), `FGD_API_KEY` (#3), and `.env.example` placeholders. Delete `core_runtime.js`.
3. **HTTP hardening** — add helmet (#6) and a body size limit (#7).
4. **Process resilience** — add `unhandledRejection` handler (#8); stop monitor intervals on shutdown (LOW).
5. **Resource lifecycle** — atomic registry writes (#10), task timeout cleanup (#12), bridge sensor unbind (#9), Mineflayer listener cleanup (MEDIUM).
6. **Architectural cleanup** — collapse `engine.ready` race (#11), remove duplicate bridge state (#13), force all spawns through Golden Path (#14, MEDIUM).
7. **API consistency** — standardize response envelopes, regenerate OpenAPI spec, deprecate Mineflayer v1.
8. **Test coverage** — add tests for `spawn_pipeline`, `minecraft_bridge_mineflayer`, `action_pipeline`, `npc_spawner`.

---

## Summary

| Severity | Count |
|---|---|
| HIGH | 14 |
| MEDIUM | 16 |
| LOW | 2 |

The codebase is feature-rich and architecturally ambitious, but multiple HIGH-severity issues currently leave authentication broken or bypassable in default configurations. Address the auth/config issues (#1–#7) before any deployment. Resource and lifecycle issues (#8–#14) are the next blockers for production stability.
