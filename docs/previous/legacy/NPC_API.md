# NPC System API Documentation

## Table of Contents
- [Overview](#overview)
- [Health & Metrics](#health--metrics)
- [NPC Management](#npc-management)
- [Error Handling](#error-handling)

## Overview

The NPC API provides RESTful endpoints for managing autonomous NPCs in the AICraft system. All endpoints return JSON and follow standard HTTP status code conventions.

**Base URL**: `http://localhost:3000/api`

## Health & Metrics

### Health Check
Check the health status of the system and all NPC components.

```http
GET /api/health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345,
  "components": {
    "npcRegistry": "healthy",
    "npcSpawner": "healthy",
    "npcFinalizer": "healthy",
    "learningEngine": "healthy"
  },
  "memory": {
    "used": 150,
    "total": 512,
    "unit": "MB"
  }
}
```

**Status Codes**:
- `200` - All components healthy
- `503` - One or more components unhealthy

### System Metrics
Get comprehensive system metrics including NPC statistics.

```http
GET /api/metrics/system
```

**Response**:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "npc": {
    "total": 15,
    "active": 12,
    "archived": 50,
    "deadLetterQueue": 0
  },
  "learning": {
    "profiles": 15
  },
  "system": {
    "cpu": 45,
    "memory": 60
  }
}
```

## NPC Management

### List NPCs
Retrieve a paginated list of all NPCs.

```http
GET /api/npcs?status=active&limit=100&offset=0
```

**Query Parameters**:
- `status` (optional) - Filter by status: `active`, `inactive`, `retired`, `archived`
- `limit` (optional, default: 100) - Maximum number of NPCs to return
- `offset` (optional, default: 0) - Pagination offset

**Response**:
```json
{
  "npcs": [
    {
      "id": "miner_01",
      "npcType": "miner",
      "role": "miner",
      "status": "active",
      "personality": { "curiosity": 0.7, ... },
      "personalitySummary": "highly curious and motivated",
      "spawnCount": 5,
      "lastSpawnedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 15,
  "limit": 100,
  "offset": 0
}
```

### Get NPC
Retrieve detailed information about a specific NPC.

```http
GET /api/npcs/:id
```

**Response**:
```json
{
  "id": "miner_01",
  "npcType": "miner",
  "role": "miner",
  "status": "active",
  "personality": { ... },
  "appearance": { "skin": "default", "outfit": "overalls" },
  "spawnPosition": { "x": 100, "y": 65, "z": 200 },
  "learning": {
    "xp": 150,
    "tasksCompleted": 25,
    "tasksFailed": 3,
    "skills": {
      "mining": 12,
      "building": 5
    }
  }
}
```

**Status Codes**:
- `200` - Success
- `404` - NPC not found
- `503` - NPC system not initialized

### Create NPC
Create and optionally spawn a new NPC.

```http
POST /api/npcs
Content-Type: application/json

{
  "id": "builder_05",
  "role": "builder",
  "npcType": "builder",
  "appearance": {
    "skin": "default",
    "outfit": "construction"
  },
  "personality": {
    "curiosity": 0.6,
    "patience": 0.8,
    "motivation": 0.7,
    "empathy": 0.5,
    "aggression": 0.2,
    "creativity": 0.9,
    "loyalty": 0.7
  },
  "position": { "x": 0, "y": 64, "z": 0 },
  "autoSpawn": false
}
```

**Request Body**:
- `id` (optional) - Custom NPC ID (auto-generated if not provided)
- `role` OR `npcType` (required) - NPC role/type
- `appearance` (optional) - Visual appearance configuration
- `personality` (optional) - Personality traits (auto-generated if not provided)
- `position` (optional) - Spawn position
- `autoSpawn` (optional, default: false) - Whether to spawn in-world immediately

**Response**: Same as Get NPC

**Status Codes**:
- `201` - NPC created successfully
- `400` - Invalid request (missing required fields)
- `500` - Server error
- `503` - NPC system not initialized

### Update NPC
Update an existing NPC's properties.

```http
PUT /api/npcs/:id
Content-Type: application/json

{
  "role": "builder",
  "appearance": { "skin": "updated" },
  "personality": { "curiosity": 0.8 },
  "metadata": { "level": 5 },
  "description": "Experienced builder"
}
```

**Request Body** (all fields optional):
- `role` - Update NPC role
- `appearance` - Update appearance
- `personality` - Update personality (merged with existing)
- `metadata` - Update metadata
- `description` - Update description

**Response**: Updated NPC object

**Status Codes**:
- `200` - Success
- `404` - NPC not found
- `500` - Server error

### Delete/Finalize NPC
Properly finalize an NPC, archive statistics, and optionally remove from world.

```http
DELETE /api/npcs/:id?preserve=false&removeFromWorld=true
```

**Query Parameters**:
- `preserve` (optional, default: false) - Keep NPC in registry with 'retired' status
- `removeFromWorld` (optional, default: true) - Remove NPC from Minecraft world

**Response**:
```json
{
  "npcId": "miner_01",
  "reason": "api_request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "stats": {
    "registry": { ... },
    "learning": { ... },
    "computed": {
      "totalTasks": 28,
      "successRate": 89.3,
      "dominantSkill": { "skill": "mining", "level": 12 },
      "totalXP": 150,
      "totalLifetime": 86400000
    }
  },
  "archived": true,
  "removedFromWorld": true,
  "preservedInRegistry": false
}
```

**Status Codes**:
- `200` - Success
- `404` - NPC not found
- `500` - Server error

### Get NPC Archive
Retrieve archived NPCs with full statistics.

```http
GET /api/npcs/archive/all
```

**Response**:
```json
{
  "archive": [
    {
      "npcId": "miner_01",
      "reason": "retirement",
      "finalizedAt": "2024-01-01T00:00:00.000Z",
      "stats": { ... }
    }
  ],
  "total": 50
}
```

### Get Dead Letter Queue
Retrieve NPCs that failed to spawn after all retries.

```http
GET /api/npcs/deadletter/queue
```

**Response**:
```json
{
  "queue": [
    {
      "profile": { "id": "failed_npc", ... },
      "position": { "x": 0, "y": 64, "z": 0 },
      "error": "Connection timeout",
      "failCount": 4,
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 1
}
```

### Retry Dead Letter Queue
Attempt to re-spawn all NPCs in the dead letter queue.

```http
POST /api/npcs/deadletter/retry
```

**Response**:
```json
{
  "successes": [
    { "npcId": "recovered_npc", "response": { ... } }
  ],
  "failures": [
    { "npcId": "still_failing", "error": "Connection refused" }
  ]
}
```

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

### Common Status Codes

- `200` - Success
- `201` - Resource created
- `400` - Bad request (invalid input)
- `404` - Resource not found
- `500` - Internal server error
- `503` - Service unavailable (system not initialized)

### Error Recovery

The NPC system includes built-in error recovery:
- **Automatic Retries**: Failed operations retry up to 3 times with exponential backoff
- **Dead Letter Queue**: Persistently failed spawns are queued for manual retry
- **Graceful Degradation**: System continues operating even if some components fail

## Rate Limiting

Currently, no rate limiting is enforced on NPC endpoints. This may be added in future versions.

## Webhook/Events

The system emits WebSocket events for real-time updates (via Socket.IO):
- `task_assigned` - When NPC receives a task
- `task_completed` - When NPC completes a task
- `npc_spawned` - When NPC spawns in world
- `npc_despawned` - When NPC is removed

## Examples

### Create and Monitor NPC Lifecycle

```bash
# 1. Create NPC
curl -X POST http://localhost:3000/api/npcs \
  -H "Content-Type: application/json" \
  -d '{
    "role": "miner",
    "position": {"x": 100, "y": 64, "z": 200},
    "autoSpawn": true
  }'

# 2. Check NPC status
curl http://localhost:3000/api/npcs/miner_01

# 3. Update NPC
curl -X PUT http://localhost:3000/api/npcs/miner_01 \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"level": 5}}'

# 4. Finalize NPC
curl -X DELETE http://localhost:3000/api/npcs/miner_01?preserve=true

# 5. View archive
curl http://localhost:3000/api/npcs/archive/all
```

### Monitor System Health

```bash
# Health check
curl http://localhost:3000/api/health

# System metrics
curl http://localhost:3000/api/metrics/system
```
