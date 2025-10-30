import WebSocket from "ws";
import fs from "fs";
import { PeerLink } from "./peer_link.js";

/**
 * Manages WebSocket connections and synchronization for a distributed node cluster.
 * Handles both server-side (accepting connections) and client-side (connecting to peers).
 *
 * @example
 * const manager = new NodeSyncManager('./config.jsonc');
 * await manager.initialize();
 *
 * // Broadcast to all peers
 * manager.broadcastClusterEvent('update', { key: 'value' });
 *
 * // Graceful shutdown
 * await manager.shutdown();
 */
export class NodeSyncManager {
  /**
   * Creates a new NodeSyncManager instance.
   * Note: Constructor does not perform I/O. Call initialize() to start the manager.
   *
   * @param {string} configPath - Path to the cluster configuration file (JSON/JSONC)
   */
  constructor(configPath = "./cluster_config.jsonc") {
    this.configPath = configPath;
    this.config = null;
    this.peers = [];
    this.wss = null;
    this.connections = new Map(); // Track active client connections
    this.heartbeatInterval = null;
    this.isShuttingDown = false;

    // Metrics tracking
    this.metrics = {
      messagesReceived: 0,
      messagesSent: 0,
      broadcastsSent: 0,
      errors: 0,
      reconnections: 0,
      startTime: null
    };

    // Constants
    this.MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB
    this.ALLOWED_MESSAGE_TYPES = ['sync', 'update', 'heartbeat', 'state'];
    this.HEARTBEAT_INTERVAL = 30000; // 30 seconds
    this.PEER_RETRY_ATTEMPTS = 3;
  }

  /**
   * Initializes the node sync manager by loading config, starting server, and connecting to peers.
   * This method should be called after construction.
   *
   * @returns {Promise<void>}
   * @throws {Error} If configuration is invalid or server fails to start
   */
  async initialize() {
    this.loadConfig();
    await this.startServer();
    await this.connectPeers();
    this.metrics.startTime = Date.now();
    console.log('[NodeSyncManager] Initialization complete');
  }

  /**
   * Strips JSON comments (// and /* *\/) from a string while preserving strings.
   * Supports both single-line and multi-line comments.
   *
   * Note: This is a basic implementation. For production, consider using
   * the 'strip-json-comments' npm package for more robust handling.
   *
   * @param {string} jsonString - The JSON string with comments
   * @returns {string} JSON string without comments
   */
  stripJsonComments(jsonString) {
    let result = '';
    let inString = false;
    let inSingleLineComment = false;
    let inMultiLineComment = false;
    let stringDelimiter = null;

    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString[i];
      const nextChar = jsonString[i + 1];
      const prevChar = jsonString[i - 1];

      // Handle string state
      if (!inSingleLineComment && !inMultiLineComment) {
        if ((char === '"' || char === "'") && prevChar !== '\\') {
          if (!inString) {
            inString = true;
            stringDelimiter = char;
          } else if (char === stringDelimiter) {
            inString = false;
            stringDelimiter = null;
          }
        }
      }

      // If we're in a string, preserve everything
      if (inString) {
        result += char;
        continue;
      }

      // Handle single-line comments
      if (!inMultiLineComment && char === '/' && nextChar === '/') {
        inSingleLineComment = true;
        i++; // Skip next char
        continue;
      }

      if (inSingleLineComment) {
        if (char === '\n') {
          inSingleLineComment = false;
          result += char; // Preserve newline
        }
        continue;
      }

      // Handle multi-line comments
      if (!inSingleLineComment && char === '/' && nextChar === '*') {
        inMultiLineComment = true;
        i++; // Skip next char
        continue;
      }

      if (inMultiLineComment) {
        if (char === '*' && nextChar === '/') {
          inMultiLineComment = false;
          i++; // Skip next char
        }
        continue;
      }

      // Not in a comment, preserve character
      result += char;
    }

    return result;
  }

  /**
   * Loads and validates configuration from file.
   * Tries .jsonc first, then falls back to .json for backward compatibility.
   *
   * @throws {Error} If configuration is invalid
   */
  loadConfig() {
    // Try .jsonc first, then fall back to .json for backward compatibility
    let configPath = this.configPath;
    if (!fs.existsSync(configPath)) {
      const altPath = this.configPath.replace('.jsonc', '.json');
      if (fs.existsSync(altPath)) {
        configPath = altPath;
        console.log(`[Config] Using fallback config: ${altPath}`);
      }
    }

    if (fs.existsSync(configPath)) {
      const rawContent = fs.readFileSync(configPath, "utf-8");
      const cleanedContent = this.stripJsonComments(rawContent);
      this.config = JSON.parse(cleanedContent);

      // Validate configuration
      this.validateConfig();

      console.log(`[Config] Loaded config from ${configPath}`);
      console.log(`[Config] Node: ${this.config.nodeName}, Port: ${this.config.port}, Peers: ${this.config.peers.length}`);
    } else {
      console.log("[Config] No config file found, using defaults");
      this.config = { nodeName: "Node_A", port: 8800, peers: [] };
    }
  }

  /**
   * Validates the loaded configuration.
   *
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    // Validate nodeName
    if (!this.config.nodeName || typeof this.config.nodeName !== 'string') {
      throw new Error("Config must have a valid nodeName (string)");
    }

    // Validate port
    if (!this.config.port || typeof this.config.port !== 'number') {
      throw new Error("Config must have a valid port (number)");
    }

    if (this.config.port < 1 || this.config.port > 65535) {
      throw new Error(`Port must be between 1-65535, got: ${this.config.port}`);
    }

    // Validate and sanitize peers array
    if (!Array.isArray(this.config.peers)) {
      this.config.peers = [];
    }

    // Validate peer URLs
    const validPeers = [];
    for (const peer of this.config.peers) {
      try {
        const url = new URL(peer);
        if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
          console.warn(`[Config] Invalid peer protocol (must be ws: or wss:): ${peer}`);
          continue;
        }
        validPeers.push(peer);
      } catch (err) {
        console.warn(`[Config] Invalid peer URL: ${peer} - ${err.message}`);
      }
    }
    this.config.peers = validPeers;
  }

  /**
   * Starts the WebSocket server and sets up connection handlers.
   *
   * @returns {Promise<void>}
   */
  async startServer() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocket.Server({ port: this.config.port });

        this.wss.on("connection", (ws, req) => {
          const clientIp = req.socket.remoteAddress;
          const clientPort = req.socket.remotePort;
          const connectionId = `${clientIp}:${clientPort}`;

          console.log(`[Connection] Client connected: ${connectionId}`);

          // Store connection with metadata
          this.connections.set(connectionId, {
            ws,
            connectedAt: Date.now(),
            lastActivity: Date.now(),
            isAlive: true
          });

          // Setup heartbeat
          ws.isAlive = true;
          ws.on('pong', () => {
            ws.isAlive = true;
            const conn = this.connections.get(connectionId);
            if (conn) {
              conn.lastActivity = Date.now();
            }
          });

          ws.on("message", (msg) => {
            this.handleMessage(msg, connectionId);
            const conn = this.connections.get(connectionId);
            if (conn) {
              conn.lastActivity = Date.now();
            }
          });

          ws.on("close", () => {
            this.connections.delete(connectionId);
            console.log(`[Connection] Client disconnected: ${connectionId}`);
          });

          ws.on("error", (err) => {
            this.metrics.errors++;
            console.error(`[Connection] WebSocket error from ${connectionId}: ${err.message}`);
          });
        });

        this.wss.on("error", (err) => {
          this.metrics.errors++;
          if (err.code === "EADDRINUSE") {
            console.error(`[Server] ERROR: Port ${this.config.port} is already in use. Try a different port.`);
            reject(new Error(`Port ${this.config.port} is already in use`));
          } else {
            console.error(`[Server] ERROR: ${err.message}`);
            reject(err);
          }
        });

        this.wss.on("listening", () => {
          console.log(`[Server] NodeSyncManager listening on ws://localhost:${this.config.port}`);
          console.log(`[Server] To connect from Xbox, use: ws://<YOUR_PC_IP>:${this.config.port}`);
          console.log(`[Server] Find your IP: Windows (ipconfig), Mac/Linux (ifconfig)`);

          // Start heartbeat monitoring
          this.startHeartbeat();

          resolve();
        });
      } catch (err) {
        this.metrics.errors++;
        console.error(`[Server] Failed to start server: ${err.message}`);
        reject(err);
      }
    });
  }

  /**
   * Starts the heartbeat mechanism to monitor connection health.
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isShuttingDown) return;

      let activeCount = 0;
      let deadCount = 0;

      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          deadCount++;
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
        activeCount++;
      });

      if (deadCount > 0) {
        console.log(`[Heartbeat] Terminated ${deadCount} dead connection(s), ${activeCount} alive`);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Connects to all configured peer nodes with retry logic and exponential backoff.
   *
   * @returns {Promise<void>}
   */
  async connectPeers() {
    if (this.config.peers.length === 0) {
      console.log("[Peers] No peers configured (running standalone)");
      return;
    }

    console.log(`[Peers] Attempting to connect to ${this.config.peers.length} peer(s)...`);

    const connectionPromises = this.config.peers.map(async (peer) => {
      return this.connectToPeerWithRetry(peer);
    });

    const results = await Promise.allSettled(connectionPromises);

    // Count successful connections
    const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;

    console.log(`[Peers] Connected to ${successful}/${this.config.peers.length} peer(s)`);
  }

  /**
   * Attempts to connect to a single peer with retry logic.
   *
   * @param {string} peerUrl - The WebSocket URL of the peer
   * @returns {Promise<boolean>} True if connection successful, false otherwise
   */
  async connectToPeerWithRetry(peerUrl) {
    let retries = 0;

    while (retries < this.PEER_RETRY_ATTEMPTS) {
      try {
        console.log(`[Peers] Connecting to: ${peerUrl} (attempt ${retries + 1}/${this.PEER_RETRY_ATTEMPTS})`);

        const link = new PeerLink(peerUrl);

        // Wait a moment to see if connection establishes
        await new Promise(resolve => setTimeout(resolve, 1000));

        this.peers.push(link);
        console.log(`[Peers] Successfully connected to ${peerUrl}`);
        return true;
      } catch (err) {
        retries++;
        this.metrics.errors++;
        console.error(`[Peers] Failed to connect to ${peerUrl} (attempt ${retries}): ${err.message}`);

        if (retries < this.PEER_RETRY_ATTEMPTS) {
          const delay = Math.pow(2, retries) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.log(`[Peers] Retrying ${peerUrl} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`[Peers] Giving up on ${peerUrl} after ${this.PEER_RETRY_ATTEMPTS} attempts`);
    return false;
  }

  /**
   * Broadcasts an event to all connected peers.
   *
   * @param {string} eventType - The type of event to broadcast
   * @param {Object} data - The event data payload
   * @returns {number} Number of peers successfully notified
   */
  broadcastClusterEvent(eventType, data) {
    if (this.peers.length === 0) {
      console.log(`[Broadcast] No peers to broadcast to (event: ${eventType})`);
      return 0;
    }

    console.log(`[Broadcast] Sending ${eventType} to ${this.peers.length} peer(s)`);
    let successCount = 0;

    for (const peer of this.peers) {
      try {
        peer.send({ type: eventType, data, from: this.config.nodeName });
        successCount++;
        this.metrics.messagesSent++;
      } catch (err) {
        this.metrics.errors++;
        console.error(`[Broadcast] Failed to send to peer: ${err.message}`);
      }
    }

    this.metrics.broadcastsSent++;
    console.log(`[Broadcast] Successfully sent to ${successCount}/${this.peers.length} peer(s)`);
    return successCount;
  }

  /**
   * Handles incoming messages from clients with validation and size limits.
   *
   * @param {Buffer|string} raw - The raw message data
   * @param {string} connectionId - The connection identifier
   */
  handleMessage(raw, connectionId = "unknown") {
    try {
      // Convert to string and check size
      const rawString = typeof raw === 'string' ? raw : raw.toString('utf-8');

      // Limit message size to prevent DoS
      if (rawString.length > this.MAX_MESSAGE_SIZE) {
        this.metrics.errors++;
        console.error(`[Message] Message too large from ${connectionId}: ${rawString.length} bytes (max: ${this.MAX_MESSAGE_SIZE})`);
        return;
      }

      const msg = JSON.parse(rawString);

      // Validate message structure
      if (!msg.type || !msg.from) {
        this.metrics.errors++;
        console.error(`[Message] Invalid message structure from ${connectionId}: missing 'type' or 'from' field`);
        return;
      }

      // Validate message type
      if (!this.ALLOWED_MESSAGE_TYPES.includes(msg.type)) {
        this.metrics.errors++;
        console.error(`[Message] Unknown message type from ${connectionId}: ${msg.type}`);
        console.error(`[Message] Allowed types: ${this.ALLOWED_MESSAGE_TYPES.join(', ')}`);
        return;
      }

      this.metrics.messagesReceived++;
      console.log(`[Message] Received ${msg.type} from ${msg.from} (client: ${connectionId})`);

      // Preview data if present
      if (msg.data) {
        const dataPreview = JSON.stringify(msg.data).substring(0, 100);
        console.log(`[Message] Data preview: ${dataPreview}${dataPreview.length >= 100 ? '...' : ''}`);
      }

      // TODO: Future implementation - merge updates into local world_state.json or broadcast via EventBus
      // Example: this.eventBus.emit(msg.type, msg.data);

    } catch (err) {
      this.metrics.errors++;
      console.error(`[Message] Failed to parse message from ${connectionId}: ${err.message}`);

      // Safe preview of raw message
      try {
        const rawString = typeof raw === 'string' ? raw : raw.toString('utf-8');
        const preview = rawString.substring(0, 100);
        console.error(`[Message] Raw message: ${preview}${preview.length >= 100 ? '...' : ''}`);
      } catch (previewErr) {
        console.error(`[Message] Could not preview raw message: ${previewErr.message}`);
      }
    }
  }

  /**
   * Gets the current health status of the node.
   *
   * @returns {Object} Health status information
   */
  getHealthStatus() {
    const now = Date.now();
    const uptime = this.metrics.startTime ? (now - this.metrics.startTime) / 1000 : 0;

    return {
      nodeName: this.config.nodeName,
      port: this.config.port,
      status: this.isShuttingDown ? 'shutting_down' : 'running',
      uptime: Math.floor(uptime),
      connections: {
        active: this.connections.size,
        peers: {
          connected: this.peers.length,
          configured: this.config.peers.length
        }
      },
      metrics: {
        messagesReceived: this.metrics.messagesReceived,
        messagesSent: this.metrics.messagesSent,
        broadcastsSent: this.metrics.broadcastsSent,
        errors: this.metrics.errors,
        reconnections: this.metrics.reconnections
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Performs graceful shutdown of the node sync manager.
   * Closes all peer connections and the WebSocket server.
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.isShuttingDown) {
      console.log('[Shutdown] Already shutting down...');
      return;
    }

    this.isShuttingDown = true;
    console.log('[Shutdown] Initiating graceful shutdown...');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[Shutdown] Stopped heartbeat monitoring');
    }

    // Close all client connections
    console.log(`[Shutdown] Closing ${this.connections.size} client connection(s)...`);
    for (const [connectionId, conn] of this.connections.entries()) {
      try {
        conn.ws.close(1000, 'Server shutting down');
      } catch (err) {
        console.error(`[Shutdown] Error closing connection ${connectionId}: ${err.message}`);
      }
    }
    this.connections.clear();

    // Close peer connections
    console.log(`[Shutdown] Closing ${this.peers.length} peer connection(s)...`);
    for (const peer of this.peers) {
      try {
        if (typeof peer.close === 'function') {
          await peer.close();
        }
      } catch (err) {
        console.error(`[Shutdown] Error closing peer connection: ${err.message}`);
      }
    }
    this.peers = [];

    // Close WebSocket server
    if (this.wss) {
      console.log('[Shutdown] Closing WebSocket server...');
      await new Promise((resolve) => {
        this.wss.close(() => {
          console.log('[Shutdown] WebSocket server closed');
          resolve();
        });
      });
      this.wss = null;
    }

    // Log final metrics
    const health = this.getHealthStatus();
    console.log('[Shutdown] Final metrics:', JSON.stringify(health.metrics, null, 2));
    console.log('[Shutdown] Shutdown complete');
  }
}
