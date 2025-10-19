// ctn/cognitive_link.js
// Manages WebSocket connection to a cognitive peer node with task delegation

import WebSocket from "ws";
import EventEmitter from "events";
import crypto from "crypto";

const CONNECTION_TIMEOUT = 30000;
const TASK_TIMEOUT = 30000;
const HEARTBEAT_INTERVAL = 15000;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 4000;

export class CognitiveLink extends EventEmitter {
  constructor(peerConfig, options = {}) {
    super();
    
    this.url = typeof peerConfig === "string" ? peerConfig : peerConfig.url;
    this.name = peerConfig.name || this.url;
    this.specialization = peerConfig.specialization || [];
    this.priority = peerConfig.priority || 1;
    this.weight = peerConfig.weight || 1.0;
    this.enabled = peerConfig.enabled !== false;
    
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || MAX_RECONNECT_ATTEMPTS;
    this.reconnectDelay = options.reconnectDelay || BASE_RECONNECT_DELAY;
    this.heartbeatInterval = options.heartbeatInterval || HEARTBEAT_INTERVAL;
    this.connectionTimeout = options.connectionTimeout || CONNECTION_TIMEOUT;
    this.taskTimeout = options.taskTimeout || TASK_TIMEOUT;
    
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.connectionTimer = null;
    this.lastHeartbeat = null;
    
    this.pendingTasks = new Map();
    this.activeTasks = 0;
    this.completedTasks = 0;
    this.failedTasks = 0;
    
    if (this.enabled) {
      this.connect();
    }
  }

  connect() {
    if (this.isConnecting || this.isConnected || !this.enabled) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ Max reconnection attempts reached for ${this.name}`);
      this.emit("max_reconnect_reached", this.name);
      return;
    }

    this.isConnecting = true;
    console.log(`🔄 Connecting to cognitive peer ${this.name}`);

    try {
      this.ws = new WebSocket(this.url, { handshakeTimeout: this.connectionTimeout });
      this.connectionTimer = setTimeout(() => {
        if (!this.isConnected) this.handleDisconnect("timeout");
      }, this.connectionTimeout);

      this.ws.on("open", () => this.handleOpen());
      this.ws.on("message", (data) => this.handleMessage(data));
      this.ws.on("error", (err) => this.handleError(err));
      this.ws.on("close", (code, reason) => this.handleClose(code, reason));
    } catch (err) {
      console.error(`❌ Failed to create WebSocket: ${err.message}`);
      this.handleDisconnect("creation_error");
    }
  }

  handleOpen() {
    clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.lastHeartbeat = Date.now();
    console.log(`🧠 Cognitive link established: ${this.name}`);
    this.emit("connected", this.name);
    this.startHeartbeat();
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      this.lastHeartbeat = Date.now();
      
      if (message.type === "heartbeat") {
        this.emit("heartbeat", this.name);
        return;
      }
      
      if (message.type === "task_response" && message.taskId) {
        this.handleTaskResponse(message);
        return;
      }
      
      this.emit("message", message, this.name);
    } catch (err) {
      console.error(`❌ Parse error: ${err.message}`);
    }
  }

  handleTaskResponse(message) {
    const pending = this.pendingTasks.get(message.taskId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingTasks.delete(message.taskId);
    this.activeTasks--;

    if (message.error) {
      this.failedTasks++;
      pending.reject(new Error(message.error));
    } else {
      this.completedTasks++;
      pending.resolve(message.result);
    }
  }

  handleError(err) {
    console.error(`❌ WebSocket error: ${err.message}`);
    this.emit("error", err, this.name);
  }

  handleClose(code, reason) {
    console.log(`🔌 Cognitive link closed: ${this.name}`);
    this.handleDisconnect("close");
  }

  handleDisconnect(reason) {
    this.isConnected = false;
    this.isConnecting = false;
    
    if (this.connectionTimer) clearTimeout(this.connectionTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    
    for (const [taskId, pending] of this.pendingTasks.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Connection lost: ${reason}`));
      this.failedTasks++;
    }
    this.pendingTasks.clear();
    this.activeTasks = 0;
    
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) this.ws.close();
      this.ws = null;
    }
    
    this.emit("disconnected", this.name, reason);
    
    if (this.enabled && this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    }
  }

  startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected) return;
      const timeSince = Date.now() - this.lastHeartbeat;
      if (timeSince > this.heartbeatInterval * 3) {
        this.handleDisconnect("heartbeat_timeout");
        return;
      }
      this.send({ type: "heartbeat", timestamp: Date.now() });
    }, this.heartbeatInterval);
  }

  send(obj) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(obj));
      return true;
    } catch (err) {
      console.error(`❌ Send failed: ${err.message}`);
      return false;
    }
  }

  async sendTask(task) {
    if (!this.isConnected) throw new Error(`Peer ${this.name} not connected`);

    const taskId = crypto.randomBytes(16).toString("hex");
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        this.activeTasks--;
        this.failedTasks++;
        reject(new Error(`Task timeout after ${this.taskTimeout}ms`));
      }, this.taskTimeout);

      this.pendingTasks.set(taskId, { resolve, reject, timeout });
      this.activeTasks++;

      if (!this.send({ type: "task", taskId, payload: task, timestamp: Date.now() })) {
        clearTimeout(timeout);
        this.pendingTasks.delete(taskId);
        this.activeTasks--;
        this.failedTasks++;
        reject(new Error("Failed to send task"));
      }
    });
  }

  canHandle(taskAction) {
    if (!this.enabled) return false;

    if (!this.specialization || this.specialization.length === 0) {
      return Boolean(taskAction);
    }

    if (!taskAction) {
      return false;
    }

    return this.specialization.includes(taskAction);
  }

  getLoad() {
    return this.activeTasks;
  }

  getStatus() {
    return {
      name: this.name,
      url: this.url,
      specialization: this.specialization,
      connected: this.isConnected,
      enabled: this.enabled,
      activeTasks: this.activeTasks,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks
    };
  }

  destroy() {
    this.enabled = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.handleDisconnect("destroyed");
    this.removeAllListeners();
  }
}