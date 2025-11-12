/**
 * Mineflayer Configuration
 *
 * Default configuration for Mineflayer bridge initialization.
 * Can be overridden via environment variables.
 */

export const mineflayerConfig = {
  // Server connection
  host: process.env.MINECRAFT_HOST || 'localhost',
  port: parseInt(process.env.MINECRAFT_PORT || '25565'),
  version: process.env.MINECRAFT_VERSION || '1.20.1',
  auth: process.env.MINECRAFT_AUTH || 'offline',

  // Bot behavior
  botDefaults: {
    username: 'FGDBot',
    auth: 'offline'
  },

  // Pathfinding
  pathfinding: {
    timeout: 30000, // 30 seconds
    range: 1, // Stop within 1 block of target
    maxDistance: 128 // Don't search more than 128 blocks away
  },

  // Mining
  mining: {
    timeout: 30000, // 30 seconds per block
    equipTool: true, // Auto-select best tool
    maxDistance: 32 // Search radius for blocks
  },

  // Movement
  movement: {
    timeout: 60000, // 60 seconds
    range: 1 // Stop within 1 block
  },

  // Inventory
  inventory: {
    maxSlots: 36,
    timeout: 5000
  },

  // Timeouts and limits
  limits: {
    maxBots: 50, // Maximum concurrent bots
    connectionTimeout: 30000, // 30 seconds to connect
    reconnectDelay: 5000, // 5 seconds between reconnects
    maxReconnectAttempts: 3
  },

  // Events and logging
  events: {
    emitMovement: true,
    emitHealth: true,
    emitEntities: true,
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // Feature flags
  features: {
    pathfinding: true,
    combat: false, // Disabled by default in Phase 1
    crafting: false, // Disabled by default in Phase 1
    plugins: true // Enable plugin system
  }
};

export default mineflayerConfig;
