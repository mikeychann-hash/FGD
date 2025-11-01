// Minecraft Bridge Configuration for Paper + Geyser
// This file contains the configuration for connecting the FGD dashboard to your Paper/Geyser server

export const minecraftBridgeConfig = {
  // RCON Connection Settings
  // These must match the values in your Paper server's server.properties file
  host: "127.0.0.1",           // Server IP (use "127.0.0.1" for local, or your server IP)
  port: 25575,                  // RCON port (default: 25575)
  password: "fgd_rcon_password_change_me",  // RCON password (CHANGE THIS!)

  // Connection Options
  timeout: 10000,               // Connection timeout in milliseconds
  connectOnCreate: true,        // Automatically connect when bridge is created

  // Command Settings
  commandPrefix: "aicraft",     // Prefix for NPC commands
  maxCommandsPerSecond: 5,      // Rate limit for commands
  commandTimeout: 10000,        // Command execution timeout

  // Heartbeat (Keep-Alive)
  enableHeartbeat: true,        // Send periodic heartbeats to keep connection alive
  heartbeatInterval: 30000,     // Heartbeat interval in ms (30 seconds)
  heartbeatCommand: "/list",    // Command to use for heartbeat

  // Combat Tracking
  enableSnapshots: true,        // Enable periodic combat state snapshots
  snapshotInterval: 5000,       // Snapshot emission interval in ms (5 seconds)
  damageWindowMs: 10000,        // Time window for DPS calculations (10 seconds)
  combatantTtl: 300000,         // How long to keep inactive combatants (5 minutes)

  // Update Server (HTTP + WebSocket)
  enableUpdateServer: true,     // Enable HTTP server for NPC updates
  updatePort: 3210,             // Port for HTTP update server
  enableWebsocket: true,        // Enable WebSocket for real-time updates
  websocketPath: "/bridge",     // WebSocket endpoint path
  websocketCompression: true,   // Enable WebSocket compression

  // Security
  updateServerAuthToken: null,  // Optional: Set a token for authentication
  allowedOrigins: null,         // Optional: CORS allowed origins (null = allow all)

  // Persistence
  snapshotPersistencePath: "./data/combat_snapshot.json",  // Path to save combat state
  snapshotPersistenceInterval: 60000,  // How often to save state (60 seconds)

  // Data Retention
  maxEventHistory: 500,         // Maximum number of combat events to keep in memory
  eventHistoryTtl: 600000,      // Event history retention time (10 minutes)
  cleanupInterval: 60000,       // Cleanup interval for stale data (60 seconds)

  // Reconnection
  reconnectBaseDelay: 1000,     // Base delay for reconnection attempts (1 second)
  maxReconnectDelay: 30000,     // Maximum reconnection delay (30 seconds)

  // Entity Spawning
  spawnEntityMapping: {
    default: "minecraft:villager",
    guard: "minecraft:iron_golem",
    miner: "minecraft:villager",
    builder: "minecraft:villager",
    fighter: "minecraft:iron_golem",
    merchant: "minecraft:villager",
    farmer: "minecraft:villager",
    // Add more NPC types as needed
  },

  // NPC Appearance
  appearanceCommandDelay: 200,  // Delay before applying appearance commands (ms)

  // Friendly Fire Detection
  friendlyIds: [],              // List of friendly entity IDs (NPCs automatically detected)

  // Command Templates
  // You can add custom command templates here
  commandTemplates: {
    // Example: teleport: (params) => `/tp ${params.npcId} ${params.x} ${params.y} ${params.z}`
  }
};

// Paper/Geyser Specific Notes:
//
// 1. RCON Configuration:
//    Make sure your Paper server's server.properties has:
//    enable-rcon=true
//    rcon.port=25575
//    rcon.password=your_password_here
//
// 2. Geyser Players:
//    Bedrock players connecting via Geyser will appear in the server
//    just like Java players. The bridge will track their combat stats
//    and NPC interactions automatically.
//
// 3. Cross-Platform Compatibility:
//    - Java Edition players use the server IP and port 25565
//    - Bedrock Edition players use the server IP and port 19132 (UDP)
//    - Both player types can interact with NPCs spawned by this system
//
// 4. Firewall Configuration:
//    If hosting publicly, ensure these ports are open:
//    - 25565 TCP (Java Edition)
//    - 19132 UDP (Bedrock Edition via Geyser)
//    - 25575 TCP (RCON - restrict to localhost for security!)
//    - 3000 TCP (FGD Dashboard)
//    - 3210 TCP (NPC Update Server - optional, for advanced integrations)
//
// 5. Performance Tips:
//    - Adjust maxCommandsPerSecond based on your server's capacity
//    - Increase snapshotInterval if you have many NPCs
//    - Set combatantTtl lower if you have limited memory
//
// 6. Security Recommendations:
//    - ALWAYS change the default RCON password
//    - Consider setting updateServerAuthToken for production
//    - Restrict RCON port (25575) to localhost only in your firewall
//    - Use allowedOrigins to restrict CORS if serving publicly

export default minecraftBridgeConfig;
