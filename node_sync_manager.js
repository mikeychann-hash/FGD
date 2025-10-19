import WebSocket from "ws";
import fs from "fs";
import { PeerLink } from "./peer_link.js";

export class NodeSyncManager {
  constructor(configPath = "./cluster/cluster_config.json") {
    this.configPath = configPath;
    this.peers = [];
    this.loadConfig();
    this.startServer();
    this.connectPeers();
  }

  loadConfig() {
    if (fs.existsSync(this.configPath))
      this.config = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
    else
      this.config = { nodeName: "Node_A", port: 8800, peers: [] };
  }

  startServer() {
    const wss = new WebSocket.Server({ port: this.config.port });
    wss.on("connection", (ws) => {
      ws.on("message", (msg) => this.handleMessage(msg));
    });
    console.log(`🌐 NodeSyncManager listening on ws://localhost:${this.config.port}`);
  }

  connectPeers() {
    for (const peer of this.config.peers) {
      const link = new PeerLink(peer);
      this.peers.push(link);
    }
  }

  broadcastClusterEvent(eventType, data) {
    for (const peer of this.peers) {
      peer.send({ type: eventType, data, from: this.config.nodeName });
    }
  }

  handleMessage(raw) {
    const msg = JSON.parse(raw);
    console.log(`[Cluster] Received ${msg.type} from ${msg.from}`);
    // Future: merge updates into local world_state.json or broadcast via EventBus
  }
}
