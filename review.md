# Review: Web UI removed → Windows desktop app shell

- Converted serving model: Express no longer serves `dashboard.html`/`admin.html`; desktop app uses Electron (`npm run desktop`) to boot the backend and render a Windows 11 shell under `desktop/renderer`.
- Desktop scaffolding added: `desktop/main.cjs` (launches backend + window), `desktop/preload.cjs` (safe IPC), `desktop/renderer/*` (placeholder UI with health check). `package.json` now has a `desktop` script and Electron dev dependency.
- Known blocker: Electron launch fails because `src/services/action_pipeline/planners/chest.js` imports missing `src/services/chest_utils.js` (check casing/path vs existing `src/chest_utils.js`).

## Frontend plan (desktop UI parity with legacy website)
- Shell: Keep `desktop/renderer` as the entry; build a Windows 11-style layout with nav + main content. Use `window.fgdDesktop.getConfig()` to read `apiBaseUrl`.
- Bots list: Fetch `/api/bots` equivalent (check actual backend route in `routes/bot.js`); show table with status, role, position, and actions.
- Spawn bots: Form for bot id/role/persona → POST spawn endpoint; show progress + errors.
- Bot detail + map: Real-time telemetry via Socket.IO; render positions on a map (Leaflet or MapLibre) with player location overlay and click-to-focus.
- Teleporter: Action to teleport a bot to the player (add backend endpoint/event if missing); UI button per bot with target player input.
- Server/bridge controls: Buttons for start/stop server and plugins (backend endpoints required—see below).
- Health/metrics: Surface `/api/health`, `/metrics` summaries; include log tail panel.

## Backend plan (API and desktop orchestration)
- Fix chest utils import: align `planners/chest.js` to the existing helper file (likely `src/chest_utils.js` or move it under `services` and update import paths).
- Bot operations: Ensure REST routes exist for list/spawn/despawn/teleport; if teleport not present, add a route in `routes/bot.js` that calls minecraft bridge/adapter to move a bot to a player.
- Server/bridge lifecycle: Add endpoints to start/stop Minecraft server, load/unload plugins, and report status. Wire to existing scripts or bridge controls if available.
- Telemetry: Confirm Socket.IO events for bot status/position; standardize payloads for map rendering (id, x/y/z, dimension).
- Config for desktop: Keep backend port configurable via `PORT`; allow `FGD_DESKTOP_PORT` override; ensure CORS allows the Electron file origin (currently OK since requests originate from the app process).
- Packaging: Add build scripts later (e.g., `electron-builder`) after core UI/API parity is done.

## Next steps
- Fix the chest utils path and rerun `npm run desktop` to verify the app boots.
- Implement bots list/spawn/detail views using existing REST + Socket.IO.
- Add teleport + server/plugin control endpoints and wire UI actions.
- Integrate Leaflet/MapLibre for live bot positioning.
