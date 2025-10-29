// cluster/node_sync_manager.js
// Manages cluster synchronization and peer communication

import WebSocket from "ws";
import fs from "fs/promises";
import fsSync from "fs";
import { PeerLink } from "./peer_link.js";
import EventEmitter from "events";

const DEFAULT_CONFIG = {
  nodeName: "Node_A",
  nodeId: "node-a-001",
  host: "0.0.0.0",
  port: 8800,
  peers: [],
  network: {
    heartbeatInterval: 10000,
    connectionTimeout: 30000,
    reconnectDelay: 5000,
    maxReconnectAttempts: 10
  }
};

export class NodeSyncManager extends EventEmitter {
  constructor(configPath = "./cluster_config.jsonc") {
    super();

    this.configPath = configPath;
    this.config = { ...DEFAULT_CONFIG };
    this.peers = new Map();
    this.clients = new Map();
    this.server = null;
    this.isRunning = false;
    this.messageHandlers = new Map();
    this.metrics = {
      messagesReceived: 0,
      messagesSent: 0,
      broadcastsSent: 0,
      errors: 0
    };

    this.loadConfig();
  }

  /**
   * Strips JSON comments (// and /* *\/) from a string
   * Supports both single-line and multi-line comments
   */
  stripJsonComments(jsonString) {
    // Remove single-line comments
    let result = jsonString.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    return result;
  }

  loadConfig() {
    try {
      // Try .jsonc first, then fall back to .json for backward compatibility
      let configPath = this.configPath;
      if (!fsSync.existsSync(configPath)) {
        const altPath = this.configPath.replace('.jsonc', '.json');
        if (fsSync.existsSync(altPath)) {
          configPath = altPath;
          console.log(`[Config] Using fallback config: ${altPath}`);
        }
      }

      if (fsSync.existsSync(configPath)) {
        const data = fsSync.readFileSync(configPath, "utf-8");
        const cleanedData = this.stripJsonComments(data);
        const loadedConfig = JSON.parse(cleanedData);
        this.config = { ...DEFAULT_CONFIG, ...loadedConfig };
        console.log(`⚙️  Cluster config loaded for ${this.config.nodeName} from ${configPath}`);
      } else {
        console.log("📝 Using default cluster configuration");
      }
    } catch (err) {
      console.error("❌ Error loading cluster config:", err.message);
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  async start() {
    if (this.isRunning) {
      console.warn("⚠️  NodeSyncManager is already running");
      return;
    }

    try {
      await this.startServer();
      await this.connectPeers();
      this.isRunning = true;
      console.log(`✅ NodeSyncManager started for ${this.config.nodeName}`);
      this.emit("started");
    } catch (err) {
      console.error("❌ Failed to start NodeSyncManager:", err.message);
      throw err;
    }
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      try {
        const options = {
          host: this.config.host,
          port: this.config.port,
          perMessageDeflate: false,
          maxPayload: this.config.network?.maxMessageSize || 1048576
        };

        this.server = new WebSocket.Server(options);

        this.server.on("connection", (ws, req) => {
          this.handleClientConnection(ws, req);
        });

        this.server.on("error", (err) => {
          console.error("❌ WebSocket server error:", err.message);
          this.metrics.errors++;
          this.emit("server_error", err);
        });

        this.server.on("listening", () => {
          const address = this.server.address();
          console.log(`🌐 NodeSyncManager listening on ${address.address}:${address.port}`);
          resolve();
        });

        setTimeout(() => {
          if (!this.server.listening) {
            reject(new Error("Server startup timeout"));
          }
        }, 10000);

      } catch (err) {
        reject(err);
      }
    });
  }

  handleClientConnection(ws, req) {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clientIp = req.socket.remoteAddress;
    
    console.log(`🔗 Client connected: ${clientId} from ${clientIp}`);
    this.clients.set(clientId, ws);

    ws.on("message", (data) => {
      this.handleClientMessage(clientId, data).catch(err => {
        console.error(`❌ Error handling message from ${clientId}:`, err.message);
        this.metrics.errors++;
      });
    });

    ws.on("error", (err) => {
      console.error(`❌ Client error (${clientId}):`, err.message);
      this.metrics.errors++;
    });

    ws.on("close", () => {
      console.log(`🔌 Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    });

    this.sendToClient(clientId, {
      type: "welcome",
      nodeName: this.config.nodeName,
      nodeId: this.config.nodeId,
      timestamp: Date.now()
    });
  }

  async handleClientMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      this.metrics.messagesReceived++;

      console.log(`📨 [${this.config.nodeName}] Received ${message.type} from client ${clientId}`);

      if (message.type === "ping") {
        this.sendToClient(clientId, {
          type: "pong",
          timestamp: Date.now()
        });
        return;
      }

      if (this.messageHandlers.has(message.type)) {
        const handler = this.messageHandlers.get(message.type);
        await handler(message, clientId);
      }

      this.emit("message", message, clientId);

      if (message.broadcast) {
        this.broadcastToPeers(message.type, message.data, clientId);
      }

    } catch (err) {
      console.error(`❌ Failed to handle message from client ${clientId}:`, err.message);
      this.metrics.errors++;
      this.sendToClient(clientId, {
        type: "error",
        error: "Invalid message format",
        timestamp: Date.now()
      });
    }
  }

  async connectPeers() {
    if (!this.config.peers || this.config.peers.length === 0) {
      console.log("ℹ️  No peers configured");
      return;
    }

    console.log(`🔄 Connecting to ${this.config.peers.length} peer(s)...`);

    for (const peerConfig of this.config.peers) {
      try {
        const link = new PeerLink(peerConfig, {
          heartbeatInterval: this.config.network.heartbeatInterval,
          connectionTimeout: this.config.network.connectionTimeout,
          reconnectDelay: this.config.network.reconnectDelay,
          maxReconnectAttempts: this.config.network.maxReconnectAttempts
        });

        link.on("connected", (name) => {
          console.log(`✅ Peer ${name} connected`);
          this.emit("peer_connected", name);
        });

        link.on("disconnected", (name, reason) => {
          console.log(`🔌 Peer ${name} disconnected: ${reason}`);
          this.emit("peer_disconnected", name, reason);
        });

        link.on("message", (message, name) => {
          this.handlePeerMessage(message, name);
        });

        link.on("error", (err, name) => {
          console.error(`❌ Peer ${name} error:`, err.message);
          this.metrics.errors++;
        });

        this.peers.set(link.name, link);
      } catch (err) {
        console.error(`❌ Failed to create peer link:`, err.message);
        this.metrics.errors++;
      }
    }
  }

  handlePeerMessage(message, peerName) {
    this.metrics.messagesReceived++;
    console.log(`📨 [Cluster] Received ${message.type} from ${peerName}`);

    if (this.messageHandlers.has(message.type)) {
      const handler = this.messageHandlers.get(message.type);
      handler(message, peerName).catch(err => {
        console.error(`❌ Handler error for ${message.type}:`, err.message);
        this.metrics.errors++;
      });
    }

    this.emit("peer_message", message, peerName);
  }

  registerMessageHandler(type, handler) {
    if (typeof handler !== "function") {
      throw new Error("Handler must be a function");
    }
    this.messageHandlers.set(type, handler);
    console.log(`📝 Registered handler for message type: ${type}`);
  }

  unregisterMessageHandler(type) {
    this.messageHandlers.delete(type);
  }

  broadcastToPeers(eventType, data, source = null) {
    const message = {
      type: eventType,
      data,
      from: this.config.nodeName,
      nodeId: this.config.nodeId,
      source,
      timestamp: Date.now()
    };

    let successCount = 0;
    for (const [name, peer] of this.peers.entries()) {
      if (peer.send(message)) {
        successCount++;
      }
    }

    this.metrics.messagesSent += successCount;
    this.metrics.broadcastsSent++;

    console.log(`📡 Broadcast ${eventType} to ${successCount}/${this.peers.size} peer(s)`);
    return successCount;
  }

  sendToPeer(peerName, message) {
    const peer = this.peers.get(peerName);
    if (!peer) {
      console.warn(`⚠️  Peer ${peerName} not found`);
      return false;
    }

    const fullMessage = {
      ...message,
      from: this.config.nodeName,
      nodeId: this.config.nodeId,
      timestamp: Date.now()
    };

    const success = peer.send(fullMessage);
    if (success) {
      this.metrics.messagesSent++;
    }
    return success;
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.send(JSON.stringify(message));
      this.metrics.messagesSent++;
      return true;
    } catch (err) {
      console.error(`❌ Failed to send to client ${clientId}:`, err.message);
      this.metrics.errors++;
      return false;
    }
  }

  broadcastToClients(message) {
    let successCount = 0;
    for (const [clientId, client] of this.clients.entries()) {
      if (this.sendToClient(clientId, message)) {
        successCount++;
      }
    }
    return successCount;
  }

  getStatus() {
    const peerStatus = {};
    for (const [name, peer] of this.peers.entries()) {
      peerStatus[name] = peer.getStatus();
    }

    return {
      nodeName: this.config.nodeName,
      nodeId: this.config.nodeId,
      running: this.isRunning,
      server: this.server ? {
        listening: this.server.listening,
        address: this.server.address()
      } : null,
      peers: peerStatus,
      connectedClients: this.clients.size,
      metrics: { ...this.metrics }
    };
  }

  async stop() {
    if (!this.isRunning) {
      console.warn("⚠️  NodeSyncManager is not running");
      return;
    }

    console.log("🛑 Stopping NodeSyncManager...");

    for (const [name, peer] of this.peers.entries()) {
      peer.destroy();
    }
    this.peers.clear();

    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.close(1000, "Server shutting down");
      } catch (err) {
        console.error(`Error closing client ${clientId}:`, err.message);
      }
    }
    this.clients.clear();

    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(() => {
          console.log("✅ WebSocket server closed");
          resolve();
        });
      });
      this.server = null;
    }

    this.isRunning = false;
    this.emit("stopped");
    console.log("✅ NodeSyncManager stopped");
  }
}

if (process.argv[1].includes("node_sync_manager.js")) {
  const manager = new NodeSyncManager();
  
  (async () => {
    await manager.start();

    manager.registerMessageHandler("sync_update", async (message, source) => {
      console.log(`🔄 Processing sync update from ${source}:`, message.data);
    });

    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down...");
      await manager.stop();
      process.exit(0);
    });

    setInterval(() => {
      console.log("\n📊 Cluster Status:", JSON.stringify(manager.getStatus(), null, 2));
    }, 30000);
  })();
}
