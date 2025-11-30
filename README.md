# AICraft Federation Governance Dashboard (FGD)

FGD is the control plane for spawning and governing Minecraft NPC swarms. It unifies REST, Socket.IO, the Minecraft bridge/plugin, and the admin/CLI surfaces behind one Golden Path.

## Quick Links (current)

- Spawn flow (REST/UI/CLI): `README_SPAWN_FLOW.md`
- Bridge ↔ plugin contract: `README_MINECRAFT_BRIDGE.md`
- API docs (Swagger/OpenAPI): `README_API_DOCS.md`
- Telemetry/Prometheus: `README_TELEMETRY.md`
- Terminal/CLI usage: `TERMINAL_GUIDE.md`
- Database setup: `DB_SETUP.md`
- Unified Action Framework: `README_UNIFIED_ACTION_FRAMEWORK.md`

## Windows desktop app (replaces the web UI)

- The browser-based dashboard (`/` and `/admin`) has been removed. Use the Windows 11 desktop shell under `desktop/`.
- Run `npm install` then `npm run desktop` to start the backend and open the native app window.
- Build your UI in `desktop/renderer/` (HTML/CSS/JS or your framework of choice). The backend API base URL is available via `window.fgdDesktop.getConfig()`.
- The backend still listens on `http://localhost:3000` (or `PORT` env) for REST/WebSocket traffic used by the desktop app.

## New React/Electron UI (desktop-app)

- Location: `desktop-app/` (Vite + React + TS + Tailwind + shadcn/ui + Zustand).
- Dev (web): `cd desktop-app && npm run dev -- --host --port 5173`
- Dev (Electron): `cd desktop-app && npm run electron:dev` (free port 5173 if in use)
- Build: `cd desktop-app && npm run build` (Node >= 20.19 recommended to silence Vite engine warning)
- Current features: dashboard/admin/fusion pages, bot/metrics/fusion stores, WS listeners (bots/cluster/metrics/system), DLQ retry + command API hooks, loading skeletons, manual chunking for bundle size.
- Pending to finish: align store mappings with your live API payloads (cluster status, metrics fields, fusion stats/records); subscribe to any additional WebSocket events you emit (e.g., metrics or DLQ payload shapes); add toasts/error banners for API failures; upgrade Node to >= 20.19.

## Golden Path summary

- All spawns go through REST: `POST /api/bots/:id/spawn` and `/api/bots/spawn-all`.
- Backend pipeline: `routes/bot.js` → `src/services/spawn_pipeline.js` → `npc_spawner` → `minecraft_bridge.spawnBot` → plugin confirmation → `bot:spawned` Socket.IO.
- UI/CLI both use the same REST endpoints; the bridge enforces heartbeat health before spawning.

## Health & observability

- Health: `/api/health` and `/api/minecraft/status`
- Metrics: `/metrics` (Prometheus format) with per-bot spawn counters and plugin heartbeat gauges.

## Legacy docs

All historical reports, audits, and previous guides have been moved to `docs/previous/` (including the prior README as `docs/previous/root/README_legacy.md`).
