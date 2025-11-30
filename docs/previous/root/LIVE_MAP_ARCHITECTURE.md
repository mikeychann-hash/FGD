# Live World Map Architecture - FGD Realtime Mineflayer Viewer

**Version:** 1.0
**Date:** 2025-11-18
**Status:** Architecture Design

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Recommendations](#technology-recommendations)
4. [Data Flow Architecture](#data-flow-architecture)
5. [WebSocket Event Catalog](#websocket-event-catalog)
6. [Frontend Component Design](#frontend-component-design)
7. [Backend Integration Points](#backend-integration-points)
8. [POI System Design](#poi-system-design)
9. [Implementation Plan](#implementation-plan)
10. [Code Examples](#code-examples)
11. [Performance Considerations](#performance-considerations)
12. [Security & Validation](#security--validation)

---

## Executive Summary

This document outlines the complete architecture for a **realtime world map viewer** that visualizes Mineflayer bot positions, entities, blocks, and points of interest (POIs) in the FGD admin panel.

### Key Features
- **Realtime bot position tracking** with smooth updates
- **Entity visualization** (players, mobs, items)
- **Block discovery tracking** (ores, structures, valuable resources)
- **POI management** (villages, biomes, waypoints)
- **Interactive controls** (zoom, pan, layer toggles)
- **Efficient WebSocket updates** (throttled, optimized)
- **Integration with existing FGD dashboard**

### Technology Stack
- **Rendering:** HTML5 Canvas 2D API (recommended)
- **WebSocket:** Socket.IO (already configured)
- **Frontend:** Vanilla JavaScript (consistent with FGD)
- **Backend:** Node.js + Mineflayer Bridge

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     FGD LIVE MAP ARCHITECTURE                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│  Minecraft Server    │         │   Mineflayer Bots    │
│  (1.21.8)           │◄────────┤   (Multiple)         │
└──────────────────────┘         └──────────┬───────────┘
                                            │
                                            │ Position/Entity
                                            │ Block/Health Data
                                            ▼
                         ┌──────────────────────────────┐
                         │  Mineflayer Bridge           │
                         │  - Bot State Manager         │
                         │  - World Observer            │
                         │  - Event Aggregator          │
                         └──────────┬───────────────────┘
                                    │
                                    │ Aggregated Events
                                    ▼
                         ┌──────────────────────────────┐
                         │  WebSocket Layer (Socket.IO) │
                         │  - Event Broadcasting        │
                         │  - Throttling (200ms)        │
                         │  - Room Management           │
                         └──────────┬───────────────────┘
                                    │
                                    │ Real-time Stream
                                    ▼
┌────────────────────────────────────────────────────────────────┐
│                    DASHBOARD (Browser)                         │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Map Renderer (Canvas 2D)                                │ │
│  │  - Viewport Manager (zoom, pan)                          │ │
│  │  - Layer Manager (bots, entities, blocks, POIs)          │ │
│  │  - Icon Renderer (sprites, colors, labels)               │ │
│  │  - Coordinate System (Minecraft → Canvas)                │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  UI Controls                                             │ │
│  │  - Zoom/Pan Controls  - Layer Toggles                    │ │
│  │  - Bot Selector       - Coordinate Display               │ │
│  │  - POI Manager        - Minimap                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Data Management                                         │ │
│  │  - Position Cache     - Entity Registry                  │ │
│  │  - POI Storage        - Path History                     │ │
│  │  - Update Queue       - Interpolation Engine             │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## Technology Recommendations

### Rendering Technology: Canvas 2D (Recommended)

| Technology | Pros | Cons | Verdict |
|------------|------|------|---------|
| **Canvas 2D** | ✅ High performance for realtime updates<br>✅ Efficient redraw/clear cycles<br>✅ Low memory footprint<br>✅ Smooth animations<br>✅ Direct pixel control | ❌ Manual event handling needed<br>❌ No built-in zoom/pan | **RECOMMENDED** |
| **SVG** | ✅ DOM-based (easy events)<br>✅ Scalable graphics<br>✅ Declarative | ❌ Poor performance with many elements<br>❌ High memory usage<br>❌ Slow redraws | ❌ Not suitable |
| **Leaflet** | ✅ Full-featured map library<br>✅ Tile support<br>✅ Plugin ecosystem | ❌ Heavyweight (100KB+)<br>❌ Designed for geo maps<br>❌ Overkill for Minecraft | ❌ Not suitable |
| **Custom 2D Engine** | ✅ Full control<br>✅ Optimized for use case | ❌ Development time<br>❌ Maintenance burden | ⚠️ Consider for v2 |

### Recommendation: **HTML5 Canvas 2D API**

**Rationale:**
1. **Performance:** Can handle 60 FPS updates with 100+ entities
2. **Simplicity:** Integrates well with vanilla JavaScript
3. **Control:** Full control over rendering pipeline
4. **Compatibility:** Works with existing FGD tech stack
5. **Lightweight:** No external dependencies needed

---

## Data Flow Architecture

### Update Frequency Strategy

```javascript
// Bot Position Updates: 200ms (5 FPS) - smooth enough for movement
// Entity Updates: 500ms - less critical
// Block Discovery: Event-driven (immediate)
// POI Updates: Event-driven (immediate)
```

### Data Flow Pipeline

```
Mineflayer Bot
    │
    ├─► Position Change (every move)
    │       │
    │       ├─► Throttle (200ms)
    │       │       │
    │       │       └─► WebSocket: "map:bot_position"
    │       │
    │       └─► Position Cache (local)
    │
    ├─► Entity Detected (scan)
    │       │
    │       ├─► Deduplicate
    │       │       │
    │       │       └─► WebSocket: "map:entity_update"
    │
    ├─► Block Discovered (ore/structure)
    │       │
    │       └─► WebSocket: "map:block_discovered" (immediate)
    │
    └─► Health/Food Change
            │
            └─► WebSocket: "map:bot_status"

Dashboard Browser
    │
    ├─► Receive WebSocket Events
    │       │
    │       ├─► Update Local State
    │       │       │
    │       │       └─► Position Interpolation
    │       │
    │       └─► Request Animation Frame
    │               │
    │               └─► Render Canvas (60 FPS)
    │
    └─► User Interaction
            │
            ├─► Pan/Zoom → Update Viewport
            ├─► Toggle Layer → Show/Hide
            └─► Click Entity → Show Details
```

---

## WebSocket Event Catalog

### Event Schema Design

All events follow this base structure:

```javascript
{
  "event": "map:event_name",
  "timestamp": 1700000000000,  // Unix timestamp
  "data": { /* event-specific payload */ }
}
```

### 1. Bot Position Update

**Event:** `map:bot_position`
**Frequency:** 200ms (throttled)
**Direction:** Server → Client

```json
{
  "event": "map:bot_position",
  "timestamp": 1700000000000,
  "data": {
    "botId": "bot_1",
    "username": "MinerBot",
    "position": {
      "x": 128.5,
      "y": 64.0,
      "z": -256.3
    },
    "rotation": {
      "yaw": 1.57,
      "pitch": 0.0
    },
    "dimension": "minecraft:overworld",
    "velocity": {
      "x": 0.1,
      "y": 0.0,
      "z": 0.2
    },
    "isMoving": true
  }
}
```

### 2. Bot Status Update

**Event:** `map:bot_status`
**Frequency:** 500ms or on change
**Direction:** Server → Client

```json
{
  "event": "map:bot_status",
  "timestamp": 1700000000000,
  "data": {
    "botId": "bot_1",
    "username": "MinerBot",
    "health": 18.0,
    "maxHealth": 20.0,
    "food": 17,
    "saturation": 5.0,
    "gameMode": "survival",
    "effects": [
      {
        "name": "minecraft:speed",
        "level": 1,
        "duration": 120
      }
    ],
    "isAlive": true,
    "isDead": false
  }
}
```

### 3. Entity Update

**Event:** `map:entity_update`
**Frequency:** 500ms (throttled)
**Direction:** Server → Client

```json
{
  "event": "map:entity_update",
  "timestamp": 1700000000000,
  "data": {
    "botId": "bot_1",
    "entities": [
      {
        "id": 12345,
        "type": "minecraft:zombie",
        "name": "Zombie",
        "position": {
          "x": 130.0,
          "y": 64.0,
          "z": -250.0
        },
        "health": 20.0,
        "distance": 8.5,
        "isHostile": true
      },
      {
        "id": 12346,
        "type": "minecraft:player",
        "name": "PlayerName",
        "position": {
          "x": 125.0,
          "y": 65.0,
          "z": -260.0
        },
        "distance": 12.3,
        "isHostile": false
      }
    ],
    "nearbyCount": 2,
    "hostileCount": 1
  }
}
```

### 4. Block Discovered

**Event:** `map:block_discovered`
**Frequency:** Event-driven (immediate)
**Direction:** Server → Client

```json
{
  "event": "map:block_discovered",
  "timestamp": 1700000000000,
  "data": {
    "botId": "bot_1",
    "block": {
      "type": "minecraft:diamond_ore",
      "position": {
        "x": 128,
        "y": 12,
        "z": -256
      },
      "metadata": {
        "veinSize": 3,
        "exposedFaces": 2
      }
    },
    "category": "ore",
    "rarity": "rare",
    "priority": "high"
  }
}
```

### 5. POI Created/Updated

**Event:** `map:poi_update`
**Frequency:** Event-driven
**Direction:** Bidirectional

```json
{
  "event": "map:poi_update",
  "timestamp": 1700000000000,
  "data": {
    "poiId": "poi_village_001",
    "type": "village",
    "name": "Village Alpha",
    "position": {
      "x": 200,
      "y": 70,
      "z": -300
    },
    "metadata": {
      "discoveredBy": "bot_1",
      "discoveredAt": 1700000000000,
      "buildings": 12,
      "villagers": 8
    },
    "tags": ["village", "trading", "safe"],
    "icon": "village",
    "color": "#34d399"
  }
}
```

### 6. Chunk Visit Tracking

**Event:** `map:chunk_visited`
**Frequency:** On chunk change
**Direction:** Server → Client

```json
{
  "event": "map:chunk_visited",
  "timestamp": 1700000000000,
  "data": {
    "botId": "bot_1",
    "chunk": {
      "x": 8,
      "z": -16
    },
    "position": {
      "x": 128,
      "y": 64,
      "z": -256
    },
    "firstVisit": false,
    "visitCount": 5,
    "lastVisited": 1699999999000
  }
}
```

### 7. Path History Update

**Event:** `map:path_segment`
**Frequency:** 1000ms (1 FPS)
**Direction:** Server → Client

```json
{
  "event": "map:path_segment",
  "timestamp": 1700000000000,
  "data": {
    "botId": "bot_1",
    "segments": [
      {
        "from": { "x": 128.0, "y": 64.0, "z": -256.0 },
        "to": { "x": 128.5, "y": 64.0, "z": -256.5 },
        "timestamp": 1700000000000
      }
    ],
    "pathId": "path_session_001",
    "color": "#60a5fa"
  }
}
```

### 8. Map Subscription

**Event:** `map:subscribe`
**Frequency:** On connect
**Direction:** Client → Server

```json
{
  "event": "map:subscribe",
  "timestamp": 1700000000000,
  "data": {
    "layers": ["bots", "entities", "blocks", "pois"],
    "botIds": ["bot_1", "bot_2"],
    "updateFrequency": "normal"  // "low" | "normal" | "high"
  }
}
```

### 9. Map Configuration

**Event:** `map:config`
**Frequency:** On connect or request
**Direction:** Server → Client

```json
{
  "event": "map:config",
  "timestamp": 1700000000000,
  "data": {
    "worldSpawn": {
      "x": 0,
      "y": 64,
      "z": 0
    },
    "worldBorder": {
      "centerX": 0,
      "centerZ": 0,
      "size": 29999984
    },
    "dimensions": [
      "minecraft:overworld",
      "minecraft:the_nether",
      "minecraft:the_end"
    ],
    "defaultDimension": "minecraft:overworld"
  }
}
```

---

## Frontend Component Design

### File Structure

```
/home/user/FGD/
├── map.html               # New: Live map page
├── map.js                 # New: Map visualization logic
├── map-renderer.js        # New: Canvas rendering engine
├── map-controls.js        # New: UI controls and interactions
├── map-data.js            # New: Data management and caching
├── map-websocket.js       # New: WebSocket event handlers
└── style.css              # Extended: Map-specific styles
```

### Component Architecture

```
┌──────────────────────────────────────────────────────┐
│              LiveMapViewer (map.js)                  │
│  - Initialization                                    │
│  - Component coordination                            │
│  - Lifecycle management                              │
└──┬───────────────────────────────────────────────────┘
   │
   ├──► MapRenderer (map-renderer.js)
   │    │
   │    ├── ViewportManager
   │    │   - Zoom level (1x - 32x)
   │    │   - Pan offset (x, y)
   │    │   - World → Screen transform
   │    │
   │    ├── LayerRenderer
   │    │   - Background grid
   │    │   - Chunk boundaries
   │    │   - Bot icons
   │    │   - Entity markers
   │    │   - Block highlights
   │    │   - POI icons
   │    │   - Path trails
   │    │
   │    └── IconManager
   │        - Sprite caching
   │        - Color schemes
   │        - Label rendering
   │
   ├──► MapControls (map-controls.js)
   │    │
   │    ├── ZoomPanController
   │    │   - Mouse wheel zoom
   │    │   - Click-drag pan
   │    │   - Touch gestures
   │    │
   │    ├── LayerToggleManager
   │    │   - Show/hide layers
   │    │   - Layer opacity
   │    │
   │    └── InteractionHandler
   │        - Click on entities
   │        - Hover tooltips
   │        - Context menus
   │
   ├──► MapDataManager (map-data.js)
   │    │
   │    ├── PositionCache
   │    │   - Bot positions (LRU cache)
   │    │   - Entity positions
   │    │   - Interpolation data
   │    │
   │    ├── POIRegistry
   │    │   - POI storage
   │    │   - Spatial indexing
   │    │   - Search/filter
   │    │
   │    └── PathTracker
   │        - Path segments
   │        - Trail rendering
   │        - History pruning
   │
   └──► MapWebSocketClient (map-websocket.js)
        │
        ├── EventSubscriber
        │   - Subscribe to layers
        │   - Handle reconnection
        │
        ├── EventRouter
        │   - Route events to handlers
        │   - Event queuing
        │
        └── UpdateThrottler
            - Batch updates
            - Rate limiting
```

### State Management

```javascript
// Global map state (map.js)
const MapState = {
  viewport: {
    zoom: 4,           // 4x zoom
    offsetX: 0,        // Center on world spawn
    offsetZ: 0,
    width: 800,        // Canvas width
    height: 600        // Canvas height
  },

  layers: {
    grid: true,
    chunks: false,
    bots: true,
    entities: true,
    blocks: true,
    pois: true,
    paths: true
  },

  bots: new Map(),     // botId → BotData
  entities: new Map(), // entityId → EntityData
  blocks: new Map(),   // blockKey → BlockData
  pois: new Map(),     // poiId → POIData
  paths: new Map(),    // botId → PathSegments[]

  selectedBotId: null,
  hoveredEntityId: null,

  config: {
    updateFrequency: 'normal',
    showLabels: true,
    showPaths: true,
    pathMaxLength: 100,
    entityMaxDistance: 100,
    renderFPS: 60
  }
};
```

---

## Backend Integration Points

### 1. Mineflayer Bridge Extension

**File:** `/home/user/FGD/adapters/mineflayer/world_observer.js` (New)

```javascript
/**
 * World Observer - Tracks world state for map visualization
 */
export class WorldObserver {
  constructor(bot, botId, io) {
    this.bot = bot;
    this.botId = botId;
    this.io = io;
    this.lastPosition = null;
    this.lastChunk = null;
    this.discoveredBlocks = new Set();
    this.trackedEntities = new Map();
  }

  start() {
    this._setupPositionTracking();
    this._setupEntityTracking();
    this._setupBlockDiscovery();
    this._setupChunkTracking();
  }

  _setupPositionTracking() {
    // Throttled position updates (200ms)
    const positionInterval = setInterval(() => {
      if (!this.bot.entity) return;

      const position = this.bot.entity.position;
      if (this._hasPositionChanged(position)) {
        this.io.emit('map:bot_position', {
          timestamp: Date.now(),
          data: {
            botId: this.botId,
            username: this.bot.username,
            position: {
              x: position.x,
              y: position.y,
              z: position.z
            },
            rotation: {
              yaw: this.bot.entity.yaw,
              pitch: this.bot.entity.pitch
            },
            dimension: this.bot.game?.dimension || 'minecraft:overworld',
            velocity: this.bot.entity.velocity,
            isMoving: this.bot.pathfinder?.isMoving() || false
          }
        });

        this.lastPosition = position.clone();
      }
    }, 200);
  }

  _hasPositionChanged(position) {
    if (!this.lastPosition) return true;
    const distance = position.distanceTo(this.lastPosition);
    return distance > 0.1; // Moved more than 0.1 blocks
  }
}
```

### 2. Map API Routes

**File:** `/home/user/FGD/routes/map.js` (New)

```javascript
import express from 'express';
import { authenticate } from '../middleware/auth.js';

export function initMapRoutes(npcSystem, io) {
  const router = express.Router();

  // Get all bot positions
  router.get('/positions', authenticate, (req, res) => {
    const positions = [];

    if (npcSystem.mineflayerBridge) {
      const allBots = npcSystem.mineflayerBridge.getAllBotsState();

      for (const [botId, state] of allBots.entries()) {
        positions.push({
          botId,
          username: state.username || botId,
          position: state.position,
          health: state.health,
          isAlive: state.isAlive
        });
      }
    }

    res.json({
      success: true,
      timestamp: Date.now(),
      positions
    });
  });

  // Get POIs
  router.get('/pois', authenticate, (req, res) => {
    const { dimension = 'minecraft:overworld' } = req.query;

    // Load POIs from storage (could be Redis, database, or JSON file)
    const pois = loadPOIs(dimension);

    res.json({
      success: true,
      dimension,
      pois
    });
  });

  // Create POI
  router.post('/pois', authenticate, async (req, res) => {
    const { type, name, position, metadata, tags } = req.body;

    const poi = {
      poiId: `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      name,
      position,
      metadata: {
        ...metadata,
        createdAt: Date.now()
      },
      tags: tags || []
    };

    // Save POI
    await savePOI(poi);

    // Broadcast to all clients
    io.emit('map:poi_update', {
      timestamp: Date.now(),
      data: poi
    });

    res.json({
      success: true,
      poi
    });
  });

  // Get discovered blocks
  router.get('/blocks', authenticate, (req, res) => {
    const { type, dimension } = req.query;

    const blocks = loadDiscoveredBlocks({ type, dimension });

    res.json({
      success: true,
      blocks
    });
  });

  return router;
}
```

### 3. WebSocket Handler Integration

**File:** `/home/user/FGD/src/websocket/handlers.js` (Extend existing)

```javascript
// Add to initializeWebSocketHandlers function:

export function initializeWebSocketHandlers(io, stateManager, npcSystem) {
  // ... existing code ...

  io.on('connection', (socket) => {
    // ... existing handlers ...

    // Map subscription
    socket.on('map:subscribe', (data) => {
      const { layers = [], botIds = [], updateFrequency = 'normal' } = data;

      // Join map room
      socket.join('map_viewers');

      // Store subscription preferences
      socket.mapSubscription = {
        layers,
        botIds,
        updateFrequency
      };

      console.log(`Client ${socket.id} subscribed to map with layers:`, layers);

      // Send initial state
      sendMapInitialState(socket, npcSystem);
    });

    // Map unsubscribe
    socket.on('map:unsubscribe', () => {
      socket.leave('map_viewers');
      socket.mapSubscription = null;
    });
  });

  // Map update broadcaster (runs periodically)
  startMapUpdateBroadcaster(io, npcSystem);
}

function sendMapInitialState(socket, npcSystem) {
  // Send current bot positions
  if (npcSystem.mineflayerBridge) {
    const allBots = npcSystem.mineflayerBridge.getAllBotsState();

    for (const [botId, state] of allBots.entries()) {
      socket.emit('map:bot_position', {
        timestamp: Date.now(),
        data: {
          botId,
          username: state.username || botId,
          position: state.position,
          rotation: { yaw: state.yaw, pitch: state.pitch },
          dimension: state.dimension,
          isMoving: state.isMoving
        }
      });

      socket.emit('map:bot_status', {
        timestamp: Date.now(),
        data: {
          botId,
          username: state.username || botId,
          health: state.health,
          food: state.food,
          isAlive: state.isAlive
        }
      });
    }
  }

  // Send map configuration
  socket.emit('map:config', {
    timestamp: Date.now(),
    data: {
      worldSpawn: { x: 0, y: 64, z: 0 },
      worldBorder: {
        centerX: 0,
        centerZ: 0,
        size: 29999984
      },
      dimensions: [
        'minecraft:overworld',
        'minecraft:the_nether',
        'minecraft:the_end'
      ],
      defaultDimension: 'minecraft:overworld'
    }
  });
}

function startMapUpdateBroadcaster(io, npcSystem) {
  // Broadcast bot positions every 200ms to map viewers
  setInterval(() => {
    if (!npcSystem.mineflayerBridge) return;

    const allBots = npcSystem.mineflayerBridge.getAllBotsState();

    for (const [botId, state] of allBots.entries()) {
      io.to('map_viewers').emit('map:bot_position', {
        timestamp: Date.now(),
        data: {
          botId,
          username: state.username || botId,
          position: state.position,
          rotation: { yaw: state.yaw, pitch: state.pitch },
          dimension: state.dimension || 'minecraft:overworld',
          velocity: { x: 0, y: 0, z: 0 }, // TODO: Calculate from position delta
          isMoving: state.isMoving || false
        }
      });
    }
  }, 200);
}
```

---

## POI System Design

### POI Categories

```javascript
const POI_TYPES = {
  // Structures
  VILLAGE: {
    icon: '🏘️',
    color: '#34d399',
    priority: 'high',
    persistent: true
  },
  PILLAGER_OUTPOST: {
    icon: '⚔️',
    color: '#ef4444',
    priority: 'high',
    persistent: true
  },
  OCEAN_MONUMENT: {
    icon: '🌊',
    color: '#3b82f6',
    priority: 'high',
    persistent: true
  },
  STRONGHOLD: {
    icon: '🏰',
    color: '#8b5cf6',
    priority: 'critical',
    persistent: true
  },
  DUNGEON: {
    icon: '💀',
    color: '#6b7280',
    priority: 'medium',
    persistent: true
  },

  // Resources
  ORE_VEIN: {
    icon: '💎',
    color: '#06b6d4',
    priority: 'medium',
    persistent: false
  },
  ANCIENT_DEBRIS: {
    icon: '🔥',
    color: '#f97316',
    priority: 'high',
    persistent: true
  },

  // Biomes
  BIOME_MARKER: {
    icon: '🌿',
    color: '#22c55e',
    priority: 'low',
    persistent: true
  },

  // User-defined
  WAYPOINT: {
    icon: '📍',
    color: '#f59e0b',
    priority: 'medium',
    persistent: true
  },
  HOME_BASE: {
    icon: '🏠',
    color: '#84cc16',
    priority: 'high',
    persistent: true
  },
  DANGER_ZONE: {
    icon: '⚠️',
    color: '#dc2626',
    priority: 'high',
    persistent: true
  }
};
```

### POI Storage Schema

```javascript
// POI data structure
{
  "poiId": "poi_village_001",
  "type": "VILLAGE",
  "name": "Village Alpha",
  "position": {
    "x": 200,
    "y": 70,
    "z": -300
  },
  "dimension": "minecraft:overworld",
  "metadata": {
    "discoveredBy": "bot_1",
    "discoveredAt": 1700000000000,
    "lastVisited": 1700000010000,
    "visitCount": 5,
    "buildings": 12,
    "villagers": 8,
    "notes": "Good trading spot"
  },
  "tags": ["village", "trading", "safe"],
  "persistent": true,
  "priority": "high"
}
```

### POI Auto-Discovery

Bots can automatically discover POIs using these strategies:

1. **Structure Detection:** Detect villages, outposts using block patterns
2. **Ore Veins:** Track valuable ore clusters (diamond, ancient debris)
3. **Biome Markers:** Mark biome transitions
4. **Manual Markers:** Players/admins create custom POIs via UI

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal:** Set up basic map rendering and WebSocket infrastructure

#### Tasks:
1. **Create HTML page** (`map.html`)
   - Add canvas element
   - Add basic UI controls
   - Link to existing dashboard navigation

2. **Initialize Canvas renderer** (`map-renderer.js`)
   - Set up canvas 2D context
   - Implement coordinate transformation (Minecraft → Canvas)
   - Create basic grid rendering

3. **WebSocket event handlers** (`map-websocket.js`)
   - Subscribe to map events on connection
   - Handle `map:bot_position` events
   - Store positions in local cache

4. **Backend WebSocket emitters**
   - Extend `MineflayerBridge` to emit position events
   - Implement 200ms throttling
   - Add to WebSocket handlers in `handlers.js`

**Deliverable:** Basic map showing bot positions in realtime

---

### Phase 2: Interactivity (Week 2)

**Goal:** Add zoom, pan, and layer controls

#### Tasks:
1. **Zoom/Pan controls** (`map-controls.js`)
   - Mouse wheel zoom (1x - 32x)
   - Click-drag pan
   - Zoom to bot button

2. **Layer toggles**
   - Add checkboxes for each layer
   - Show/hide bots, entities, blocks, POIs
   - Layer opacity sliders

3. **Bot selection**
   - Click on bot to select
   - Show bot details panel
   - Center map on selected bot

4. **Coordinate display**
   - Show mouse world coordinates
   - Show current zoom level
   - Show viewport bounds

**Deliverable:** Interactive map with full navigation controls

---

### Phase 3: Entity & Block Tracking (Week 3)

**Goal:** Visualize entities and discovered blocks

#### Tasks:
1. **Entity tracking backend**
   - Scan nearby entities every 500ms
   - Emit `map:entity_update` events
   - Filter by distance (100 blocks)

2. **Entity rendering frontend**
   - Different icons for players, mobs, items
   - Color-code by type (hostile, neutral, passive)
   - Entity labels on hover

3. **Block discovery system**
   - Detect valuable blocks (ores, structures)
   - Emit `map:block_discovered` events
   - Store in local registry

4. **Block rendering**
   - Icon for each block type
   - Color by rarity
   - Click to show block details

**Deliverable:** Map showing entities and discovered blocks

---

### Phase 4: POI System (Week 4)

**Goal:** Implement POI management and visualization

#### Tasks:
1. **POI storage backend**
   - POI database schema
   - REST API for CRUD operations
   - Persistence to JSON/Redis

2. **POI UI**
   - POI creation dialog
   - POI list panel
   - POI search/filter

3. **POI rendering**
   - Icons for each POI type
   - Labels with names
   - Click to edit/delete

4. **Auto-discovery**
   - Village detection algorithm
   - Ore vein clustering
   - Biome transition markers

**Deliverable:** Full POI system with manual and auto-discovery

---

### Phase 5: Advanced Features (Week 5)

**Goal:** Path history, minimap, performance optimization

#### Tasks:
1. **Path history tracking**
   - Record bot movement segments
   - Emit `map:path_segment` events
   - Render trails on map

2. **Minimap component**
   - Small overview map
   - Show entire explored area
   - Click to jump to location

3. **Performance optimization**
   - Viewport culling (only render visible)
   - Entity LOD (level of detail)
   - Canvas offscreen rendering

4. **Polish**
   - Smooth animations
   - Tooltip improvements
   - Mobile responsiveness

**Deliverable:** Production-ready map viewer

---

## Code Examples

### 1. Map Renderer (Canvas)

**File:** `/home/user/FGD/map-renderer.js`

```javascript
/**
 * MapRenderer - Canvas-based realtime map visualization
 */
export class MapRenderer {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Viewport configuration
    this.viewport = {
      zoom: options.zoom || 4,
      offsetX: options.offsetX || 0,
      offsetZ: options.offsetZ || 0,
      width: this.canvas.width,
      height: this.canvas.height
    };

    // Layers
    this.layers = {
      grid: true,
      chunks: false,
      bots: true,
      entities: true,
      blocks: true,
      pois: true,
      paths: true
    };

    // Data
    this.bots = new Map();
    this.entities = new Map();
    this.blocks = new Map();
    this.pois = new Map();
    this.paths = new Map();

    // Animation
    this.animationFrameId = null;
    this.lastRenderTime = 0;
  }

  /**
   * Start rendering loop (60 FPS)
   */
  start() {
    const render = (timestamp) => {
      const delta = timestamp - this.lastRenderTime;

      // Limit to 60 FPS
      if (delta > 16.67) {
        this.render();
        this.lastRenderTime = timestamp;
      }

      this.animationFrameId = requestAnimationFrame(render);
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  /**
   * Stop rendering loop
   */
  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main render function
   */
  render() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);

    // Save context state
    this.ctx.save();

    // Apply viewport transformation
    this.ctx.translate(this.viewport.width / 2, this.viewport.height / 2);
    this.ctx.scale(this.viewport.zoom, this.viewport.zoom);
    this.ctx.translate(-this.viewport.offsetX, -this.viewport.offsetZ);

    // Render layers (back to front)
    if (this.layers.grid) this.renderGrid();
    if (this.layers.chunks) this.renderChunks();
    if (this.layers.paths) this.renderPaths();
    if (this.layers.blocks) this.renderBlocks();
    if (this.layers.pois) this.renderPOIs();
    if (this.layers.entities) this.renderEntities();
    if (this.layers.bots) this.renderBots();

    // Restore context
    this.ctx.restore();

    // Render UI overlays (not affected by viewport transform)
    this.renderOverlays();
  }

  /**
   * Render background grid
   */
  renderGrid() {
    const gridSize = 16; // Chunk size
    const ctx = this.ctx;

    // Calculate visible bounds
    const bounds = this.getVisibleBounds();

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    ctx.lineWidth = 1 / this.viewport.zoom;

    // Vertical lines
    for (let x = Math.floor(bounds.minX / gridSize) * gridSize; x <= bounds.maxX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, bounds.minZ);
      ctx.lineTo(x, bounds.maxZ);
      ctx.stroke();
    }

    // Horizontal lines
    for (let z = Math.floor(bounds.minZ / gridSize) * gridSize; z <= bounds.maxZ; z += gridSize) {
      ctx.beginPath();
      ctx.moveTo(bounds.minX, z);
      ctx.lineTo(bounds.maxX, z);
      ctx.stroke();
    }

    // Draw origin marker
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 2 / this.viewport.zoom;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 10);
    ctx.stroke();
  }

  /**
   * Render bots
   */
  renderBots() {
    const ctx = this.ctx;
    const iconSize = 8 / this.viewport.zoom;

    for (const [botId, bot] of this.bots.entries()) {
      const { position, health, maxHealth, username, isAlive } = bot;

      if (!isAlive) continue;

      // Draw bot icon (circle)
      ctx.fillStyle = this.getBotColor(health, maxHealth);
      ctx.beginPath();
      ctx.arc(position.x, position.z, iconSize, 0, Math.PI * 2);
      ctx.fill();

      // Draw direction indicator
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / this.viewport.zoom;
      ctx.beginPath();
      ctx.moveTo(position.x, position.z);
      ctx.lineTo(
        position.x + Math.cos(bot.rotation.yaw) * iconSize * 1.5,
        position.z + Math.sin(bot.rotation.yaw) * iconSize * 1.5
      );
      ctx.stroke();

      // Draw username label
      this.renderLabel(username, position.x, position.z - iconSize - 5);

      // Draw health bar
      this.renderHealthBar(position.x, position.z + iconSize + 3, health, maxHealth);
    }
  }

  /**
   * Render entities
   */
  renderEntities() {
    const ctx = this.ctx;
    const iconSize = 6 / this.viewport.zoom;

    for (const [entityId, entity] of this.entities.entries()) {
      const { position, type, name, isHostile } = entity;

      // Color code by type
      ctx.fillStyle = isHostile ? '#ef4444' : '#22c55e';

      // Draw entity marker (square for mobs, diamond for players)
      if (type === 'minecraft:player') {
        // Diamond shape
        ctx.beginPath();
        ctx.moveTo(position.x, position.z - iconSize);
        ctx.lineTo(position.x + iconSize, position.z);
        ctx.lineTo(position.x, position.z + iconSize);
        ctx.lineTo(position.x - iconSize, position.z);
        ctx.closePath();
        ctx.fill();
      } else {
        // Square
        ctx.fillRect(
          position.x - iconSize / 2,
          position.z - iconSize / 2,
          iconSize,
          iconSize
        );
      }

      // Draw name on hover (handled by interaction layer)
    }
  }

  /**
   * Render discovered blocks
   */
  renderBlocks() {
    const ctx = this.ctx;
    const iconSize = 4 / this.viewport.zoom;

    for (const [blockKey, block] of this.blocks.entries()) {
      const { position, type, rarity } = block;

      // Color by rarity
      ctx.fillStyle = this.getBlockColor(type, rarity);
      ctx.fillRect(
        position.x - iconSize / 2,
        position.z - iconSize / 2,
        iconSize,
        iconSize
      );
    }
  }

  /**
   * Render POIs
   */
  renderPOIs() {
    const ctx = this.ctx;
    const iconSize = 10 / this.viewport.zoom;

    for (const [poiId, poi] of this.pois.entries()) {
      const { position, type, name, color } = poi;

      // Draw POI icon
      ctx.fillStyle = color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1 / this.viewport.zoom;

      ctx.beginPath();
      ctx.arc(position.x, position.z, iconSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw name
      this.renderLabel(name, position.x, position.z - iconSize - 5, color);
    }
  }

  /**
   * Render path trails
   */
  renderPaths() {
    const ctx = this.ctx;

    for (const [botId, segments] of this.paths.entries()) {
      if (segments.length < 2) continue;

      ctx.strokeStyle = segments[0].color || '#60a5fa';
      ctx.lineWidth = 2 / this.viewport.zoom;
      ctx.globalAlpha = 0.5;

      ctx.beginPath();
      ctx.moveTo(segments[0].from.x, segments[0].from.z);

      for (const segment of segments) {
        ctx.lineTo(segment.to.x, segment.to.z);
      }

      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  }

  /**
   * Render UI overlays (not affected by viewport transform)
   */
  renderOverlays() {
    const ctx = this.ctx;

    // Coordinate display
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10, 10, 200, 60);

    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`Zoom: ${this.viewport.zoom.toFixed(1)}x`, 20, 30);
    ctx.fillText(`Center: ${this.viewport.offsetX.toFixed(0)}, ${this.viewport.offsetZ.toFixed(0)}`, 20, 50);
  }

  /**
   * Render text label
   */
  renderLabel(text, x, z, color = '#fff') {
    const ctx = this.ctx;
    const fontSize = 10 / this.viewport.zoom;

    ctx.save();
    ctx.scale(1 / this.viewport.zoom, 1 / this.viewport.zoom);
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x * this.viewport.zoom, z * this.viewport.zoom);
    ctx.restore();
  }

  /**
   * Render health bar
   */
  renderHealthBar(x, z, health, maxHealth) {
    const ctx = this.ctx;
    const width = 20 / this.viewport.zoom;
    const height = 3 / this.viewport.zoom;
    const percentage = health / maxHealth;

    // Background
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(x - width / 2, z, width, height);

    // Health
    ctx.fillStyle = percentage > 0.5 ? '#22c55e' : percentage > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(x - width / 2, z, width * percentage, height);
  }

  /**
   * Get visible bounds in world coordinates
   */
  getVisibleBounds() {
    const halfWidth = (this.viewport.width / 2) / this.viewport.zoom;
    const halfHeight = (this.viewport.height / 2) / this.viewport.zoom;

    return {
      minX: this.viewport.offsetX - halfWidth,
      maxX: this.viewport.offsetX + halfWidth,
      minZ: this.viewport.offsetZ - halfHeight,
      maxZ: this.viewport.offsetZ + halfHeight
    };
  }

  /**
   * Get bot color based on health
   */
  getBotColor(health, maxHealth) {
    const percentage = health / maxHealth;
    if (percentage > 0.75) return '#22c55e'; // Green
    if (percentage > 0.5) return '#84cc16';  // Yellow-green
    if (percentage > 0.25) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  }

  /**
   * Get block color based on type and rarity
   */
  getBlockColor(type, rarity) {
    if (type.includes('diamond')) return '#06b6d4';
    if (type.includes('emerald')) return '#10b981';
    if (type.includes('gold')) return '#f59e0b';
    if (type.includes('iron')) return '#94a3b8';
    if (type.includes('ancient_debris')) return '#f97316';
    if (rarity === 'rare') return '#a855f7';
    return '#64748b';
  }

  /**
   * Update bot position
   */
  updateBot(botId, botData) {
    this.bots.set(botId, botData);
  }

  /**
   * Update entities
   */
  updateEntities(entities) {
    this.entities.clear();
    for (const entity of entities) {
      this.entities.set(entity.id, entity);
    }
  }

  /**
   * Add discovered block
   */
  addBlock(blockData) {
    const key = `${blockData.position.x}_${blockData.position.y}_${blockData.position.z}`;
    this.blocks.set(key, blockData);
  }

  /**
   * Update POI
   */
  updatePOI(poiData) {
    this.pois.set(poiData.poiId, poiData);
  }

  /**
   * Toggle layer visibility
   */
  toggleLayer(layerName, visible) {
    if (this.layers.hasOwnProperty(layerName)) {
      this.layers[layerName] = visible;
    }
  }

  /**
   * Set zoom level
   */
  setZoom(zoom) {
    this.viewport.zoom = Math.max(1, Math.min(32, zoom));
  }

  /**
   * Pan viewport
   */
  pan(deltaX, deltaZ) {
    this.viewport.offsetX += deltaX / this.viewport.zoom;
    this.viewport.offsetZ += deltaZ / this.viewport.zoom;
  }

  /**
   * Center on position
   */
  centerOn(x, z) {
    this.viewport.offsetX = x;
    this.viewport.offsetZ = z;
  }
}
```

### 2. Map Controls

**File:** `/home/user/FGD/map-controls.js`

```javascript
/**
 * MapControls - Handle user interactions (zoom, pan, click)
 */
export class MapControls {
  constructor(canvas, renderer) {
    this.canvas = canvas;
    this.renderer = renderer;

    // State
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this._setupEventListeners();
  }

  _setupEventListeners() {
    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      const delta = e.deltaY > 0 ? -0.5 : 0.5;
      const newZoom = this.renderer.viewport.zoom + delta;
      this.renderer.setZoom(newZoom);
    });

    // Mouse drag pan
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      if (this.isDragging) {
        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;

        this.renderer.pan(-deltaX, -deltaY);

        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
      }

      // Update cursor coordinates
      this.updateCursorCoordinates(e);
    });

    this.canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
    });

    // Click to select
    this.canvas.addEventListener('click', (e) => {
      const worldPos = this.screenToWorld(e.clientX, e.clientY);
      this.handleClick(worldPos.x, worldPos.z);
    });
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    const worldX = this.renderer.viewport.offsetX + (canvasX - centerX) / this.renderer.viewport.zoom;
    const worldZ = this.renderer.viewport.offsetZ + (canvasY - centerY) / this.renderer.viewport.zoom;

    return { x: worldX, z: worldZ };
  }

  /**
   * Update cursor coordinates display
   */
  updateCursorCoordinates(e) {
    const worldPos = this.screenToWorld(e.clientX, e.clientY);

    const coordEl = document.getElementById('cursor-coords');
    if (coordEl) {
      coordEl.textContent = `X: ${Math.floor(worldPos.x)}, Z: ${Math.floor(worldPos.z)}`;
    }
  }

  /**
   * Handle click on map
   */
  handleClick(worldX, worldZ) {
    // Check if clicked on bot
    const clickRadius = 10 / this.renderer.viewport.zoom;

    for (const [botId, bot] of this.renderer.bots.entries()) {
      const distance = Math.sqrt(
        Math.pow(bot.position.x - worldX, 2) +
        Math.pow(bot.position.z - worldZ, 2)
      );

      if (distance < clickRadius) {
        this.onBotClick(botId, bot);
        return;
      }
    }

    // Check if clicked on POI
    for (const [poiId, poi] of this.renderer.pois.entries()) {
      const distance = Math.sqrt(
        Math.pow(poi.position.x - worldX, 2) +
        Math.pow(poi.position.z - worldZ, 2)
      );

      if (distance < clickRadius) {
        this.onPOIClick(poiId, poi);
        return;
      }
    }
  }

  /**
   * Bot click handler
   */
  onBotClick(botId, bot) {
    console.log('Bot clicked:', botId, bot);

    // Show bot details panel
    const panel = document.getElementById('bot-details-panel');
    if (panel) {
      panel.innerHTML = `
        <h3>${bot.username}</h3>
        <p>Position: ${bot.position.x.toFixed(1)}, ${bot.position.y.toFixed(1)}, ${bot.position.z.toFixed(1)}</p>
        <p>Health: ${bot.health}/${bot.maxHealth}</p>
        <p>Food: ${bot.food}/20</p>
        <button onclick="centerOnBot('${botId}')">Center on Bot</button>
      `;
      panel.style.display = 'block';
    }
  }

  /**
   * POI click handler
   */
  onPOIClick(poiId, poi) {
    console.log('POI clicked:', poiId, poi);

    // Show POI details panel
    const panel = document.getElementById('poi-details-panel');
    if (panel) {
      panel.innerHTML = `
        <h3>${poi.name}</h3>
        <p>Type: ${poi.type}</p>
        <p>Position: ${poi.position.x}, ${poi.position.y}, ${poi.position.z}</p>
        <button onclick="centerOnPOI('${poiId}')">Center on POI</button>
        <button onclick="deletePOI('${poiId}')">Delete</button>
      `;
      panel.style.display = 'block';
    }
  }
}
```

### 3. WebSocket Client

**File:** `/home/user/FGD/map-websocket.js`

```javascript
/**
 * MapWebSocketClient - Handle WebSocket events for map
 */
export class MapWebSocketClient {
  constructor(renderer) {
    this.renderer = renderer;
    this.socket = null;
    this.subscribed = false;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('🔌 Connected to map WebSocket');
      this.subscribe();
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from map WebSocket');
      this.subscribed = false;
    });

    // Map event handlers
    this.socket.on('map:bot_position', (event) => this.handleBotPosition(event));
    this.socket.on('map:bot_status', (event) => this.handleBotStatus(event));
    this.socket.on('map:entity_update', (event) => this.handleEntityUpdate(event));
    this.socket.on('map:block_discovered', (event) => this.handleBlockDiscovered(event));
    this.socket.on('map:poi_update', (event) => this.handlePOIUpdate(event));
    this.socket.on('map:path_segment', (event) => this.handlePathSegment(event));
    this.socket.on('map:config', (event) => this.handleMapConfig(event));
  }

  /**
   * Subscribe to map events
   */
  subscribe() {
    this.socket.emit('map:subscribe', {
      layers: ['bots', 'entities', 'blocks', 'pois', 'paths'],
      botIds: [], // Empty = all bots
      updateFrequency: 'normal'
    });

    this.subscribed = true;
    console.log('📡 Subscribed to map updates');
  }

  /**
   * Handle bot position update
   */
  handleBotPosition(event) {
    const { botId, username, position, rotation, dimension, isMoving } = event.data;

    this.renderer.updateBot(botId, {
      username,
      position,
      rotation,
      dimension,
      isMoving,
      // Preserve existing health/food data
      ...this.renderer.bots.get(botId)
    });
  }

  /**
   * Handle bot status update
   */
  handleBotStatus(event) {
    const { botId, username, health, food, isAlive } = event.data;

    const existingBot = this.renderer.bots.get(botId) || {};

    this.renderer.updateBot(botId, {
      ...existingBot,
      username,
      health,
      maxHealth: 20,
      food,
      isAlive
    });
  }

  /**
   * Handle entity update
   */
  handleEntityUpdate(event) {
    const { entities } = event.data;

    this.renderer.updateEntities(entities);
  }

  /**
   * Handle block discovered
   */
  handleBlockDiscovered(event) {
    const { block, category, rarity } = event.data;

    this.renderer.addBlock({
      ...block,
      category,
      rarity
    });
  }

  /**
   * Handle POI update
   */
  handlePOIUpdate(event) {
    const poi = event.data;

    this.renderer.updatePOI(poi);
  }

  /**
   * Handle path segment
   */
  handlePathSegment(event) {
    const { botId, segments } = event.data;

    const existingPath = this.renderer.paths.get(botId) || [];
    this.renderer.paths.set(botId, [...existingPath, ...segments]);

    // Prune old segments (keep last 100)
    const path = this.renderer.paths.get(botId);
    if (path.length > 100) {
      this.renderer.paths.set(botId, path.slice(-100));
    }
  }

  /**
   * Handle map configuration
   */
  handleMapConfig(event) {
    const { worldSpawn } = event.data;

    // Center on world spawn initially
    this.renderer.centerOn(worldSpawn.x, worldSpawn.z);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.socket) {
      this.socket.emit('map:unsubscribe');
      this.socket.disconnect();
    }
  }
}
```

### 4. Main Map Page

**File:** `/home/user/FGD/map.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live World Map - AICraft</title>
  <link rel="stylesheet" href="style.css">
  <style>
    .map-container {
      display: grid;
      grid-template-columns: 1fr 300px;
      grid-template-rows: auto 1fr;
      gap: 1rem;
      height: calc(100vh - 200px);
    }

    .map-canvas-wrapper {
      grid-column: 1;
      grid-row: 1 / 3;
      position: relative;
      background: #0f172a;
      border-radius: 8px;
      overflow: hidden;
    }

    #map-canvas {
      width: 100%;
      height: 100%;
      cursor: grab;
    }

    #map-canvas:active {
      cursor: grabbing;
    }

    .map-controls {
      grid-column: 2;
      grid-row: 1;
      background: #1e293b;
      padding: 1rem;
      border-radius: 8px;
    }

    .map-sidebar {
      grid-column: 2;
      grid-row: 2;
      background: #1e293b;
      padding: 1rem;
      border-radius: 8px;
      overflow-y: auto;
    }

    .control-group {
      margin-bottom: 1rem;
    }

    .control-group label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      color: #cbd5e1;
    }

    .zoom-controls {
      display: flex;
      gap: 0.5rem;
    }

    .zoom-controls button {
      flex: 1;
      padding: 0.5rem;
      background: #334155;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .zoom-controls button:hover {
      background: #475569;
    }

    .details-panel {
      display: none;
      padding: 1rem;
      background: #334155;
      border-radius: 4px;
      margin-bottom: 1rem;
    }

    .details-panel h3 {
      margin-top: 0;
      color: #60a5fa;
    }

    .details-panel p {
      margin: 0.5rem 0;
      color: #cbd5e1;
    }
  </style>
</head>
<body>
  <header>
    <div class="title-row">
      <h1><span aria-hidden="true">🗺️</span> Live World Map</h1>
      <nav class="nav-bar">
        <a href="dashboard.html" class="nav-link">
          <span aria-hidden="true">🧭</span> Dashboard
        </a>
        <a href="fusion.html" class="nav-link">
          <span aria-hidden="true">🧠</span> Fusion Memory
        </a>
        <a href="map.html" class="nav-link active">
          <span aria-hidden="true">🗺️</span> World Map
        </a>
        <a href="admin.html" class="nav-link">
          <span aria-hidden="true">⚡</span> Admin Panel
        </a>
        <button id="theme-toggle" aria-label="Toggle theme">
          <span aria-hidden="true">☀️</span> Light Mode
        </button>
      </nav>
    </div>
    <p>Realtime visualization of bot positions, entities, discovered blocks, and points of interest across the Minecraft world.</p>
  </header>

  <div class="map-container">
    <div class="map-canvas-wrapper">
      <canvas id="map-canvas" width="1200" height="800"></canvas>
    </div>

    <div class="map-controls">
      <div class="control-group">
        <h3>Zoom & Pan</h3>
        <div class="zoom-controls">
          <button id="zoom-in">Zoom In (+)</button>
          <button id="zoom-out">Zoom Out (-)</button>
        </div>
        <button id="reset-view" style="width: 100%; margin-top: 0.5rem;">Reset View</button>
      </div>

      <div class="control-group">
        <h3>Layers</h3>
        <label>
          <input type="checkbox" id="layer-grid" checked> Grid
        </label>
        <label>
          <input type="checkbox" id="layer-chunks"> Chunks
        </label>
        <label>
          <input type="checkbox" id="layer-bots" checked> Bots
        </label>
        <label>
          <input type="checkbox" id="layer-entities" checked> Entities
        </label>
        <label>
          <input type="checkbox" id="layer-blocks" checked> Blocks
        </label>
        <label>
          <input type="checkbox" id="layer-pois" checked> POIs
        </label>
        <label>
          <input type="checkbox" id="layer-paths" checked> Paths
        </label>
      </div>

      <div class="control-group">
        <h3>Info</h3>
        <p style="color: #cbd5e1; font-size: 0.875rem;">
          Cursor: <span id="cursor-coords">--, --</span><br>
          Zoom: <span id="zoom-level">4.0x</span><br>
          Bots: <span id="bot-count">0</span>
        </p>
      </div>
    </div>

    <div class="map-sidebar">
      <div id="bot-details-panel" class="details-panel"></div>
      <div id="poi-details-panel" class="details-panel"></div>

      <div class="control-group">
        <h3>Active Bots</h3>
        <div id="bot-list"></div>
      </div>

      <div class="control-group">
        <h3>Points of Interest</h3>
        <button id="create-poi" style="width: 100%; margin-bottom: 0.5rem;">Create POI</button>
        <div id="poi-list"></div>
      </div>
    </div>
  </div>

  <footer>
    &copy; <span id="year"></span> AICraft Cluster Intelligence Network
  </footer>

  <script src="/socket.io/socket.io.js"></script>
  <script type="module">
    import { MapRenderer } from './map-renderer.js';
    import { MapControls } from './map-controls.js';
    import { MapWebSocketClient } from './map-websocket.js';

    // Initialize map
    const renderer = new MapRenderer('map-canvas', {
      zoom: 4,
      offsetX: 0,
      offsetZ: 0
    });

    const controls = new MapControls(
      document.getElementById('map-canvas'),
      renderer
    );

    const wsClient = new MapWebSocketClient(renderer);

    // Start rendering
    renderer.start();

    // Connect to WebSocket
    wsClient.connect();

    // UI Controls
    document.getElementById('zoom-in').addEventListener('click', () => {
      renderer.setZoom(renderer.viewport.zoom + 1);
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
      renderer.setZoom(renderer.viewport.zoom - 1);
    });

    document.getElementById('reset-view').addEventListener('click', () => {
      renderer.centerOn(0, 0);
      renderer.setZoom(4);
    });

    // Layer toggles
    const layerCheckboxes = [
      'grid', 'chunks', 'bots', 'entities', 'blocks', 'pois', 'paths'
    ];

    layerCheckboxes.forEach(layer => {
      const checkbox = document.getElementById(`layer-${layer}`);
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          renderer.toggleLayer(layer, e.target.checked);
        });
      }
    });

    // Update info display
    setInterval(() => {
      document.getElementById('zoom-level').textContent =
        `${renderer.viewport.zoom.toFixed(1)}x`;
      document.getElementById('bot-count').textContent =
        renderer.bots.size;
    }, 100);

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      renderer.stop();
      wsClient.disconnect();
    });

    // Year
    document.getElementById('year').textContent = new Date().getFullYear();
  </script>
  <script src="theme.js"></script>
</body>
</html>
```

---

## Performance Considerations

### 1. Update Throttling

| Event Type | Frequency | Reasoning |
|------------|-----------|-----------|
| Bot Position | 200ms (5 FPS) | Smooth movement tracking |
| Entity Update | 500ms (2 FPS) | Less critical, reduce bandwidth |
| Bot Status | 500ms or on change | Only when health/food changes |
| Block Discovery | Immediate | Rare events, important |
| POI Updates | Immediate | Rare events, important |
| Path Segments | 1000ms (1 FPS) | Low priority |

### 2. Viewport Culling

Only render entities within the visible viewport:

```javascript
renderBots() {
  const bounds = this.getVisibleBounds();

  for (const [botId, bot] of this.bots.entries()) {
    const { position } = bot;

    // Skip if outside viewport
    if (position.x < bounds.minX || position.x > bounds.maxX ||
        position.z < bounds.minZ || position.z > bounds.maxZ) {
      continue;
    }

    // Render bot...
  }
}
```

### 3. Position Interpolation

Smooth movement between position updates:

```javascript
class BotInterpolator {
  constructor() {
    this.positions = new Map(); // botId → {from, to, startTime, duration}
  }

  updatePosition(botId, newPosition) {
    const existing = this.positions.get(botId);

    this.positions.set(botId, {
      from: existing?.to || newPosition,
      to: newPosition,
      startTime: Date.now(),
      duration: 200 // Match update frequency
    });
  }

  getInterpolatedPosition(botId, currentTime) {
    const data = this.positions.get(botId);
    if (!data) return null;

    const elapsed = currentTime - data.startTime;
    const progress = Math.min(1, elapsed / data.duration);

    // Linear interpolation
    return {
      x: data.from.x + (data.to.x - data.from.x) * progress,
      y: data.from.y + (data.to.y - data.from.y) * progress,
      z: data.from.z + (data.to.z - data.from.z) * progress
    };
  }
}
```

### 4. Canvas Optimization

```javascript
// Use offscreen canvas for complex layers
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');

// Render static layers (grid, chunks) to offscreen canvas
// Only re-render when zoom/pan changes
```

### 5. WebSocket Optimization

```javascript
// Server-side event batching
class MapEventBatcher {
  constructor(io) {
    this.io = io;
    this.batchQueue = {
      positions: [],
      entities: [],
      blocks: []
    };

    // Flush every 200ms
    setInterval(() => this.flush(), 200);
  }

  addPositionUpdate(botId, position) {
    this.batchQueue.positions.push({ botId, position });
  }

  flush() {
    if (this.batchQueue.positions.length > 0) {
      this.io.to('map_viewers').emit('map:batch_positions', {
        timestamp: Date.now(),
        updates: this.batchQueue.positions
      });
      this.batchQueue.positions = [];
    }
  }
}
```

### 6. Memory Management

```javascript
// LRU cache for entity data
class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  set(key, value) {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  get(key) {
    const value = this.cache.get(key);

    // Move to end (most recently used)
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }

    return value;
  }
}
```

---

## Security & Validation

### 1. Input Validation

```javascript
// Validate POI creation
const poiSchema = {
  type: { type: 'string', required: true, enum: Object.keys(POI_TYPES) },
  name: { type: 'string', required: true, maxLength: 50 },
  position: {
    type: 'object',
    required: true,
    properties: {
      x: { type: 'number', min: -30000000, max: 30000000 },
      y: { type: 'number', min: -64, max: 320 },
      z: { type: 'number', min: -30000000, max: 30000000 }
    }
  },
  tags: { type: 'array', maxLength: 10, items: { type: 'string', maxLength: 20 } }
};
```

### 2. Rate Limiting

```javascript
// Limit map subscriptions per IP
const mapSubscriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 subscriptions per 15 minutes
  message: 'Too many map subscriptions from this IP'
});

app.get('/api/map/subscribe', mapSubscriptionLimiter, (req, res) => {
  // Handle subscription
});
```

### 3. Authentication

```javascript
// Require authentication for map access
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  // Verify JWT token
  const user = verifyToken(token);
  if (!user) {
    return next(new Error('Invalid token'));
  }

  socket.user = user;
  next();
});
```

---

## Conclusion

This architecture provides a **production-ready, scalable, and performant** realtime world map viewer for the FGD admin panel.

### Key Benefits:
- **High Performance:** Canvas 2D rendering at 60 FPS
- **Low Bandwidth:** Throttled updates (200ms for positions)
- **Scalable:** Supports 100+ bots and 1000+ entities
- **Extensible:** Easy to add new layers and features
- **Integrated:** Works seamlessly with existing FGD infrastructure

### Next Steps:
1. **Phase 1:** Implement foundation (basic rendering + WebSocket)
2. **Phase 2:** Add interactivity (zoom, pan, controls)
3. **Phase 3:** Entity and block tracking
4. **Phase 4:** POI system
5. **Phase 5:** Advanced features (path history, minimap)

### Estimated Timeline:
- **Phase 1-2:** 1 week
- **Phase 3-4:** 1 week
- **Phase 5:** 1 week
- **Total:** 3 weeks to production-ready map viewer

---

**Document Version:** 1.0
**Last Updated:** 2025-11-18
**Author:** FGD Architecture Team
