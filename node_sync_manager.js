import WebSocket from "ws";
import fs from "fs";
import { PeerLink } from "./peer_link.js";

export class NodeSyncManager {
  constructor(configPath = "./cluster_config.jsonc") {
    this.configPath = configPath;
    this.peers = [];
    this.loadConfig();
    this.startServer();
    this.connectPeers();
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

      // Basic validation
      if (!this.config.nodeName || !this.config.port) {
        throw new Error("Config must have nodeName and port");
      }
      if (!Array.isArray(this.config.peers)) {
        this.config.peers = [];
      }

      console.log(`[Config] Loaded config from ${configPath}`);
      console.log(`[Config] Node: ${this.config.nodeName}, Port: ${this.config.port}, Peers: ${this.config.peers.length}`);
    } else {
      console.log("[Config] No config file found, using defaults");
      this.config = { nodeName: "Node_A", port: 8800, peers: [] };
    }
  }

  startServer() {
    const wss = new WebSocket.Server({ port: this.config.port });

    wss.on("connection", (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      const clientPort = req.socket.remotePort;
      console.log(`[Connection] Client connected from ${clientIp}:${clientPort}`);

      ws.on("message", (msg) => this.handleMessage(msg, clientIp));

      ws.on("close", () => {
        console.log(`[Connection] Client disconnected from ${clientIp}:${clientPort}`);
      });

      ws.on("error", (err) => {
        console.error(`[Connection] WebSocket error from ${clientIp}: ${err.message}`);
      });
    });

    wss.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`[Server] ERROR: Port ${this.config.port} is already in use. Try a different port.`);
      } else {
        console.error(`[Server] ERROR: ${err.message}`);
      }
    });

    console.log(`🌐 NodeSyncManager listening on ws://localhost:${this.config.port}`);
    console.log(`[Server] To connect from Xbox, use: ws://<YOUR_PC_IP>:${this.config.port}`);
    console.log(`[Server] Find your IP: Windows (ipconfig), Mac/Linux (ifconfig)`);
  }

  connectPeers() {
    if (this.config.peers.length === 0) {
      console.log("[Peers] No peers configured (running standalone)");
      return;
    }

    console.log(`[Peers] Attempting to connect to ${this.config.peers.length} peer(s)...`);
    for (const peer of this.config.peers) {
      console.log(`[Peers] Connecting to: ${peer}`);
      try {
        const link = new PeerLink(peer);
        this.peers.push(link);
        console.log(`[Peers] Successfully initialized connection to ${peer}`);
      } catch (err) {
        console.error(`[Peers] Failed to connect to ${peer}: ${err.message}`);
      }
    }
    console.log(`[Peers] Connected to ${this.peers.length}/${this.config.peers.length} peer(s)`);
  }

  broadcastClusterEvent(eventType, data) {
    if (this.peers.length === 0) {
      console.log(`[Broadcast] No peers to broadcast to (event: ${eventType})`);
      return;
    }

    console.log(`[Broadcast] Sending ${eventType} to ${this.peers.length} peer(s)`);
    let successCount = 0;
    for (const peer of this.peers) {
      try {
        peer.send({ type: eventType, data, from: this.config.nodeName });
        successCount++;
      } catch (err) {
        console.error(`[Broadcast] Failed to send to peer: ${err.message}`);
      }
    }
    console.log(`[Broadcast] Successfully sent to ${successCount}/${this.peers.length} peer(s)`);
  }

  handleMessage(raw, clientIp = "unknown") {
    try {
      const msg = JSON.parse(raw);
      console.log(`[Message] Received ${msg.type} from ${msg.from} (client: ${clientIp})`);
      console.log(`[Message] Data preview: ${JSON.stringify(msg.data).substring(0, 100)}...`);
      // Future: merge updates into local world_state.json or broadcast via EventBus
    } catch (err) {
      console.error(`[Message] Failed to parse message from ${clientIp}: ${err.message}`);
      console.error(`[Message] Raw message: ${raw.toString().substring(0, 100)}...`);
    }
  }
}
