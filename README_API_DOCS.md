FGD Internal API Docs
=====================

Where to view
-------------
- Swagger UI: `http://localhost:3000/docs/api` (or `/api/docs`)
- Swagger UI (swagger-ui-express): `http://localhost:3000/api-docs` (uses local swagger.json)
- Raw OpenAPI JSON: `http://localhost:3000/docs/openapi/swagger.json`
- Raw OpenAPI YAML: `http://localhost:3000/docs/openapi/swagger.yaml`

Covered endpoints
-----------------
- `/api/health` – subsystem health
- `/api/minecraft/status` – plugin heartbeat age/status
- `/api/bots` and lifecycle routes (spawn, despawn, spawn-all)
- `/api/bots/:id/action` – Unified Action Framework entry point
- `/api/bots/dead-letter` + `/api/bots/dead-letter/retry`
- `/api/progression` and `/api/progression/phase`

Security
--------
- Uses `X-API-Key` header (ApiKeyAuth). Supply your admin key via the authorize button in Swagger UI.

Usage tips
----------
- Spawn flows exercise the same Golden Path used by the UI/CLI.
- Dead-letter retry will emit `bot:spawned` / `system:log` events; keep the WebSocket console open to observe confirmations.
- If you override host/port, pass `?url=` to Swagger UI, e.g. `http://localhost:3000/docs/api?url=http://myhost:4000/docs/openapi/swagger.json`.
