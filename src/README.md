# Source Code Structure

This directory contains the modularized server code, organized by responsibility.

## Directory Structure

```
/src
  /api         # REST endpoint handlers
  /websocket   # Socket.IO event handlers
  /services    # Business logic & system initialization
  /middleware  # Express middleware (auth, error handling)
  /config      # Application configuration
  /utils       # Utility functions (future)
```

## Modules

### `/config`
- **constants.js** - Application constants and default values
- **server.js** - Express, HTTP server, and Socket.IO configuration

### `/services`
- **data.js** - Data loading, caching, and file watching
- **telemetry.js** - Telemetry pipeline and metrics collection
- **npc_initializer.js** - NPC system initialization (NPCSystem class)
- **state.js** - System state management (SystemStateManager class)

### `/api`
- **cluster.js** - Dashboard and cluster management routes
- **npcs.js** - NPC CRUD operations
- **progression.js** - Progression system routes
- **health.js** - Health checks and system metrics

### `/websocket`
- **handlers.js** - WebSocket connection and event handlers
- **plugin.js** - FGDProxyPlayer plugin interface

### `/middleware`
- **errorHandlers.js** - 404 and global error handling

## Key Benefits

1. **Separation of Concerns** - Each module handles a specific domain
2. **Testability** - Modules can be tested in isolation
3. **Maintainability** - Easier to locate and modify functionality
4. **Scalability** - Simple to add new routes or services
5. **Reduced Coupling** - Clear boundaries between components

## Main Entry Point

The main `server.js` (at project root) orchestrates all modules and handles:
- Server initialization
- Module composition
- Graceful shutdown
- Error handling

## Migration Notes

The original monolithic `server.js` (1583 lines) has been refactored into:
- **server.js** - 180 lines (orchestration only)
- **14+ focused modules** - Average ~150 lines each

This represents a **~90% reduction** in main file complexity while maintaining all functionality.
