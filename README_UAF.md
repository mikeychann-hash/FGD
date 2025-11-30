# Unified Action Framework (UAF)

This document mirrors `README_UNIFIED_ACTION_FRAMEWORK.md` and summarizes the live Action pipeline.

## Flow
`REST/CLI/UI -> actionPipeline -> minecraft_bridge.dispatchAction -> plugin -> actionComplete/actionFailed -> registry/runtime -> Socket.IO -> UI`

### Endpoint
- `POST /api/bots/:id/action` body: `{ type, block?, position? }`

### Socket events
- `bot:actionDispatched`
- `bot:actionComplete`
- `bot:actionFailed`

### Metrics
- `fgd_action_total{action,bot}`
- `fgd_action_failures_total{action,bot}`

### Mermaid
```mermaid
flowchart LR
  A[REST /api/bots/:id/action] --> B[actionPipeline.run]
  B --> C[Bridge dispatchAction]
  C --> D[Plugin executor]
  D --> E[actionComplete / actionFailed]
  E --> F[Bridge]
  F --> G[Registry/runtime update]
  G --> H[Socket.IO -> UI/CLI]
```
