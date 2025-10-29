// ctn/cognitive_link.js
// Manages WebSocket connection to a cognitive peer node with task delegation

import WebSocket from "ws";
import EventEmitter from "events";
import crypto from "crypto";
import { validateTask } from "./task_schema.js";

const CONNECTION_TIMEOUT = 30000;
const TASK_TIMEOUT = 30000;
const HEARTBEAT_INTERVAL = 15000;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 4000;

/**
 * Manages WebSocket connection to a cognitive peer node with task delegation.
 * Handles automatic reconnection, heartbeats, and task routing.
 * @extends EventEmitter
 */
export class CognitiveLink extends EventEmitter {
  /**
   * Creates a new CognitiveLink instance.
   * @param {Object|string} peerConfig - Peer configuration object or URL string
   * @param {string} peerConfig.url - WebSocket URL of the peer
   * @param {string} [peerConfig.name] - Display name for the peer
   * @param {string[]} [peerConfig.specialization] - Task types this peer can handle
   * @param {number} [peerConfig.priority] - Priority level for task routing
   * @param {number} [peerConfig.weight] - Weight for load balancing
   * @param {boolean} [peerConfig.enabled] - Whether the peer is enabled
   * @param {Object} [options] - Additional options
   * @throws {Error} If URL is missing or invalid
   */
  constructor(peerConfig, options = {}) {
    super();

    // Validate and extract URL
    this.url = typeof peerConfig === "string" ? peerConfig : peerConfig.url;
    if (!this.url || typeof this.url !== "string") {
      throw new Error("Peer configuration must include a valid URL");
    }

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

  /**
   * Initiates connection to the peer.
   * Handles reconnection logic with exponential backoff.
   */
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

  /**
   * Handles successful WebSocket connection.
   */
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

  /**
   * Handles incoming WebSocket messages.
   * @param {Buffer|string} data - Raw message data
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());

      // Validate message structure
      if (!message || typeof message !== "object" || !message.type) {
        console.error(`❌ Invalid message structure from ${this.name}`);
        return;
      }

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
      console.error(`❌ Parse error from ${this.name}: ${err.message}`);
    }
  }

  /**
   * Handles task response from the peer.
   * @param {Object} message - Task response message
   */
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

  /**
   * Handles WebSocket errors.
   * @param {Error} err - The error that occurred
   */
  handleError(err) {
    console.error(`❌ WebSocket error on ${this.name}: ${err.message}`);
    this.emit("error", err, this.name);
  }

  /**
   * Handles WebSocket close event.
   * @param {number} code - Close status code
   * @param {string} reason - Close reason
   */
  handleClose(code, reason) {
    console.log(`🔌 Cognitive link closed: ${this.name} (code: ${code})`);
    this.handleDisconnect("close");
  }

  /**
   * Handles disconnection and cleanup.
   * @param {string} reason - Reason for disconnection
   */
  handleDisconnect(reason) {
    this.isConnected = false;
    this.isConnecting = false;

    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Properly handle pending tasks with correct statistics
    for (const [taskId, pending] of this.pendingTasks.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Connection lost: ${reason}`));
      this.activeTasks--;
      this.failedTasks++;
    }
    this.pendingTasks.clear();

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
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

  /**
   * Starts the heartbeat mechanism to monitor connection health.
   * Sends periodic heartbeat messages and checks for peer responsiveness.
   */
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

  /**
   * Sends a message to the peer.
   * @param {Object} obj - Message object to send
   * @returns {boolean} True if sent successfully, false otherwise
   */
  send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(obj));
      return true;
    } catch (err) {
      console.error(`❌ Send failed to ${this.name}: ${err.message}`);
      this.emit("error", err, this.name);
      return false;
    }
  }

  /**
   * Sends a task to the peer for execution.
   * @param {Object} task - Task object to execute
   * @param {string} task.action - Action type for the task
   * @returns {Promise<any>} Promise that resolves with task result
   * @throws {Error} If peer is not connected, task is invalid, or peer cannot handle the action
   */
  async sendTask(task) {
    if (!this.isConnected) {
      throw new Error(`Peer ${this.name} not connected`);
    }

    const validation = validateTask(task);
    if (!validation.valid) {
      throw new Error(`Invalid task payload: ${validation.errors.join("; ")}`);
    }

    if (!this.canHandle(task.action)) {
      throw new Error(`Peer ${this.name} cannot handle action: ${task.action}`);
    }

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

  /**
   * Checks if this peer can handle a given task action.
   * @param {string} taskAction - The action type to check
   * @param {boolean} [requireConnected=false] - Whether to require active connection
   * @returns {boolean} True if peer can handle the action
   */
  canHandle(taskAction, requireConnected = false) {
    if (!this.enabled) return false;
    if (requireConnected && !this.isConnected) return false;

    if (!this.specialization || this.specialization.length === 0) {
      return Boolean(taskAction);
    }

    if (!taskAction) {
      return false;
    }

    return this.specialization.includes(taskAction);
  }

  /**
   * Gets the current load (number of active tasks).
   * @returns {number} Number of active tasks
   */
  getLoad() {
    return this.activeTasks;
  }

  /**
   * Gets the current status of this peer.
   * @returns {Object} Status object with connection and task statistics
   */
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

  /**
   * Destroys this peer connection and cleans up all resources.
   * Prevents reconnection and closes the WebSocket.
   */
  destroy() {
    this.enabled = false;

    // Clear reconnect timer to prevent reconnection
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // If currently connecting, abort the connection attempt
    if (this.isConnecting && this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
      this.isConnecting = false;
    }

    this.handleDisconnect("destroyed");
    this.removeAllListeners();
  }
}