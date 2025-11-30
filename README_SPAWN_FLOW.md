# Unified Spawn Flow (Web UI + Terminal CLI)

All spawn actions (UI and terminal) must route through the REST Golden Path:
- POST `/api/bots/:id/spawn`
- POST `/api/bots/spawn-all`
- GET `/api/health`
- GET `/api/minecraft/status`

## CLI (scripts/fgdctl.js)
Environment:
- `FGD_API_BASE` (default `http://localhost:3000`)
- `FGD_API_KEY` (X-API-Key header)

Commands:
- `fgdctl status` — GET `/api/health`
- `fgdctl bots` — GET `/api/bots`
- `fgdctl spawn <botId>` — POST `/api/bots/:id/spawn` (fails fast if health/plugin unhealthy)
- `fgdctl spawn-all` — POST `/api/bots/spawn-all`

Wrappers:
- Bash: `scripts/fgdctl.sh`
- PowerShell: `scripts/fgdctl.ps1`

Examples:
```bash
# Linux/macOS
export FGD_API_BASE=http://localhost:3000
export FGD_API_KEY=dev-key-123
./scripts/fgdctl.sh status
./scripts/fgdctl.sh bots
./scripts/fgdctl.sh spawn miner_01
./scripts/fgdctl.sh spawn-all
```

```powershell
# Windows / PowerShell
$env:FGD_API_BASE="http://localhost:3000"
$env:FGD_API_KEY="dev-key-123"
.\scripts\fgdctl.ps1 status
.\scripts\fgdctl.ps1 bots
.\scripts\fgdctl.ps1 spawn miner_01
.\scripts\fgdctl.ps1 spawn-all
```

## Mermaid: Unified Spawn Stack
```mermaid
flowchart LR
  T[Terminal CLI (fgdctl)] -->|REST| API[/routes/bot.js/]
  UI[Web UI] -->|REST| API
  API --> Spawner[npc_spawner.js]
  Spawner --> Engine[npc_engine.js]
  Engine --> Bridge[minecraft_bridge.js]
  Bridge --> Plugin[Paper FGDProxyPlayer]
  API --> SocketIO[(Socket.IO bot:spawned)]
  SocketIO --> UI
```
