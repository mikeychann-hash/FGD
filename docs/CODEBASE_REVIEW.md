# FGD Codebase Review

> **Project**: Federation Governance Dashboard (FGD)
> **Version**: 2.1.0
> **Review Date**: 2026-04-17
> **Branch**: `claude/review-everything-yDkxi`
> **Status**: All findings addressed (fix, verify-and-skip, or deferred with rationale). See Part 3.

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

## Part 3 — Findings and Resolution Status

Three parallel reviews were conducted (security, code quality, API/config). Every item was triaged into one of four outcomes:

- **✅ Fixed** — shipped in this branch, with the commit hash and a one-line note.
- **✓ Verified OK** — the finding was incorrect on close inspection; the underlying code was already correct.
- **⏭ Deferred** — real but out of scope for this pass; flagged for a follow-up.

### 🔴 HIGH

| # | Issue | Status | Commit | Notes |
|---|---|---|---|---|
| 1 | `server.js` references auth / rate limiter / router symbols it never imports | ✅ Fixed | `9e40f19` | Added the missing imports; startup no longer crashes with `ReferenceError`. |
| 2 | Default password fallback `'AdminPass123'` | ✅ Fixed | `9e40f19` | `middleware/auth.js` now throws in production if `ADMIN_PASSWORD` is unset; dev emits a 🚨 warning. |
| 3 | Hardcoded API key `"admin123"` in `index.js` | ✅ Fixed | `baf4924` | `index.js` deleted entirely (orphaned secondary entry point). |
| 4 | WebSocket `plugin_register` unauthenticated | ✅ Fixed | `9e40f19` | Requires pre-authenticated admin socket **or** admin JWT / API key in the registration payload; rejections logged. |
| 5 | `routes/command.js` + `routes/control.js` have no auth | ✅ Fixed | `9e40f19` | `router.use(authenticate, authorize(...))`. `routes/command.js` also now has Zod validation (`baf4924`). |
| 6 | No security headers | ✅ Fixed | `9e40f19` | `src/config/server.js` sets `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection: 0`, `Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security` over HTTPS. |
| 7 | `express.json()` unbounded | ✅ Fixed | `9e40f19` | Now `{ limit: '1mb' }` with env override `HTTP_BODY_LIMIT`. |
| 8 | Missing `unhandledRejection` handler | ✅ Fixed | `9e40f19` | Logs a structured message and routes through `gracefulShutdown`. |
| 9 | Bridge sensor listener leak on shutdown | ✅ Fixed | `784c538` | Added `NPCEngine.shutdown()` (stops monitors, unbinds bridge sensors, clears task timeouts, removes emitter listeners); called from `gracefulShutdown`. |
| 10 | Non-atomic registry writes, errors swallowed | ✅ Fixed | `9e40f19` | `npc_registry.js` now writes to `.tmp` then `fs.rename()`; save failures are logged instead of silently discarded. |
| 11 | Async constructor race vs. route handlers | ✅ Fixed | `784c538` | New `engine.ready` promise awaited in `src/services/npc_initializer.js` before routes come up. |
| 12 | Task timeout leak in dispatch | ✓ Verified OK | — | `npc_engine/dispatch.js:282-285` already clears the timeout in `completeTask()`. Subagent finding was wrong. |
| 13 | Duplicate bridge property assignments | ✅ Fixed | `9e40f19` | Removed the duplicated block in `minecraft_bridge.js`. |
| 14 | `routes/llm.js` bypasses the spawn pipeline | ✅ Fixed | `9e40f19` | Teleport re-spawn now calls `spawnBot(npcSystem, io, { source: 'llm_teleport' })`. |

### 🟡 MEDIUM

| Issue | Status | Commit | Notes |
|---|---|---|---|
| Mineflayer v1/v2 overlap + silent fallback | ✅ Fixed | `ea449af` | v1 emits `Deprecation: true` / `Sunset: 2026-07-01` / `Link: </api/v2/mineflayer>` and logs on first use per (method, path, client). `/api/mineflayer` resolves only to the policy-gated v2 surface; if v2 is down it returns 503 instead of falling back to v1. |
| Mineflayer bot listener leak on disconnect | ✅ Fixed | `784c538` | `disconnectBot()` now calls `bot.removeAllListeners(event)` for each of the six events we attach. Verified by `tests/unit/minecraft_bridge_mineflayer.test.js` (`c673da4`). |
| Inconsistent response envelopes | ✅ Fixed (npcs) / ⏭ Deferred (rest) | `c673da4` | New `src/middleware/response.js` exports `ok()` / `fail()`. Applied to `src/api/npcs.js` (the top offender). Rolling out to the remaining route files is deferred to avoid a cross-cutting client-breaking change in this PR. |
| Missing Zod on `routes/command.js` | ✅ Fixed | `baf4924` | Schemas for botId, mine, craft, attack, explore, build; blueprint capped at 1000 placements. |
| OpenAPI spec severely out of sync | ✅ Fixed | `c673da4` | `docs/openapi/swagger.yaml` grew from ~6 paths to 60+, with `BearerAuth` / `ApiKeyAuth` security schemes and shared `SuccessEnvelope` / `ErrorEnvelope` / `Bot` / `NPC` / `Position` / `Task` / `DeadLetterEntry` schemas. v1 Mineflayer is tagged `deprecated: true`. |
| `DB_PASSWORD` not enforced | ✅ Fixed | `784c538` | `security/env-validation.js` now requires `DB_PASSWORD`, `ADMIN_API_KEY`, `LLM_API_KEY` in production and screens for weak values. |
| In-memory JWT blacklist lost on restart | ✅ Fixed | `9d3236e` | Blacklist writes to Redis key `auth:blacklist:<token>` with TTL from the token's `exp` claim. In-memory `Set` is a fallback mirror for when Redis is unavailable. |
| Spawn rate limiters defined but not applied | ✓ Verified OK | — | `botCreationLimiter` / `botSpawnLimiter` / `botSpawnAllLimiter` are already applied at `routes/bot.js:247, 491, 687`. |
| Sensitive values in logs | ✅ Fixed | `baf4924` | `src/database/connection.js` redacts `password=`, `token=`, `secret=` literals in SQL and logs `err.code`. `src/middleware/errorHandlers.js` logs only `{message, code, name, statusCode, method, path}` plus a five-line stack outside production. |
| FK delete behaviour + missing indexes | ✅ Fixed | `6ddd6a5` | Added indexes on `task_queue.npc_id`, `metrics.npc_id`, `system_events.npc_id`, `learning_profiles.created_at`, and a composite `(status, priority DESC, created_at)` on `task_queue`. FK split is now documented as intentional: CASCADE for working tables (task_queue, learning_profiles), SET NULL for audit tables (metrics, system_events). |
| `core_runtime.js` is dead code with hardcoded RCON password | ✅ Fixed | `baf4924` | Deleted entirely. `package.json` electron-builder files list updated. |
| Critical modules untested | ✅ Fixed | `6ddd6a5`, `bfaf058`, `6c12e9c`, `c673da4` | New suites: `spawn_pipeline.test.js`, `npc_spawner.test.js`, `action_pipeline.test.js`, `minecraft_bridge_mineflayer.test.js`. Full Golden Path (REST → spawner retry → dead-letter retry → action dispatch) now has unit coverage. |
| State recompute not serialized | ⏭ Deferred | — | Low-priority race window; serialization helper can land independently. |
| Auth-disabled mode silently bypasses | ✅ Fixed | `784c538` | Startup now logs a prominent 🚨 warning when `ADMIN_API_KEY` or `LLM_API_KEY` are missing. |
| Hardcoded placeholders in `.env.example` | ✅ Fixed | `9e40f19` | `security/env-validation.js` already screened `folks123`, `llm-key-change-me`, `admin123`, etc.; this pass also requires them in production. |
| Control routes missing `success` envelope | ✅ Fixed | `9e40f19` | `/state` now returns `{success, state}`; start/stop already used the envelope. |

### 🟢 LOW

| Issue | Status | Commit | Notes |
|---|---|---|---|
| `setInterval` timers not stopped in graceful shutdown | ✅ Fixed | `784c538` | Covered by the new `NPCEngine.shutdown()` path called from `gracefulShutdown`. |
| Magic numbers scattered | ⏭ Deferred | — | Config centralisation is tractable but cross-cutting; captured as a follow-up. |

---

## Part 4 — What Landed, By Commit

| Commit | Theme |
|---|---|
| `9bedb18` | Initial review document (this file). |
| `9e40f19` | HIGH security + reliability patch (missing imports, default credentials, plugin auth, helmet, body limit, `unhandledRejection`, atomic registry writes, Golden Path for LLM teleport, bridge dedupe). |
| `784c538` | Lifecycle / race fixes (`engine.ready`, `engine.shutdown()`, Mineflayer listener cleanup, production-required env vars, loud auth-bypass warnings). |
| `baf4924` | Legacy removal (`core_runtime.js`, `index.js`), log redaction, Zod on `routes/command.js`. |
| `9d3236e` | Redis-backed JWT blacklist with in-memory fallback. |
| `ea449af` | Mineflayer v1 deprecation (`Deprecation`/`Sunset`/`Link` headers, first-use logging, removal of silent `/api/mineflayer` fallback). |
| `6ddd6a5` | DB indexes + `spawn_pipeline` tests. |
| `bfaf058` | `NPCSpawner` retry + DLQ tests. |
| `6c12e9c` | `action_pipeline` tests (validation, dispatch, DLQ retry). |
| `c673da4` | Bridge tests + response envelope helper + full OpenAPI regeneration. |

## Summary

| Severity | Fixed | Verified OK | Deferred |
|---|---|---|---|
| HIGH | 13 | 1 | 0 |
| MEDIUM | 14 | 1 | 2 |
| LOW | 1 | 0 | 1 |

The codebase was feature-rich and architecturally ambitious but shipped with several issues that would have broken authentication in default configurations. Those are now fixed. The three deferred items (state recompute serialization, magic-number centralisation, envelope rollout to remaining routes) are all tractable follow-ups that do not block a production deploy.
