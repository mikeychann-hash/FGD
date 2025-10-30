import WebSocket from "ws";

/**
 * PeerLink - A robust WebSocket connection manager with automatic reconnection
 * @class
 * @example
 * const peer = new PeerLink('ws://localhost:8080', {
 *   reconnectDelay: 5000,
 *   maxReconnectAttempts: 10,
 *   onMessage: (data) => console.log('Received:', data),
 *   onOpen: () => console.log('Connected'),
 *   onError: (err) => console.error('Error:', err),
 *   onClose: () => console.log('Disconnected')
 * });
 */
export class PeerLink {
  /**
   * Creates a new PeerLink instance
   * @param {string} url - WebSocket URL (must start with ws:// or wss://)
   * @param {Object} options - Configuration options
   * @param {number} [options.reconnectDelay=5000] - Initial reconnection delay in ms
   * @param {number} [options.maxReconnectDelay=30000] - Maximum reconnection delay in ms
   * @param {number} [options.maxReconnectAttempts=Infinity] - Maximum reconnection attempts
   * @param {boolean} [options.enableExponentialBackoff=true] - Use exponential backoff for reconnections
   * @param {boolean} [options.queueMessagesWhileDisconnected=true] - Queue messages when disconnected
   * @param {number} [options.maxQueueSize=100] - Maximum number of queued messages
   * @param {boolean} [options.useEmoji=false] - Use emoji in default log messages
   * @param {Function} [options.onMessage] - Callback for incoming messages
   * @param {Function} [options.onOpen] - Callback when connection opens
   * @param {Function} [options.onError] - Callback for errors
   * @param {Function} [options.onClose] - Callback when connection closes
   * @param {Function} [options.logger] - Custom logger (defaults to console)
   */
  constructor(url, options = {}) {
    this._validateUrl(url);

    this.url = url;
    this.options = {
      reconnectDelay: 5000,
      maxReconnectDelay: 30000,
      maxReconnectAttempts: Infinity,
      enableExponentialBackoff: true,
      queueMessagesWhileDisconnected: true,
      maxQueueSize: 100,
      useEmoji: false,
      ...options
    };

    // Event callbacks
    this.onMessage = options.onMessage || null;
    this.onOpen = options.onOpen || null;
    this.onError = options.onError || null;
    this.onClose = options.onClose || null;

    // Logger
    this.logger = options.logger || console;

    // State tracking
    this.ws = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.shouldReconnect = true;
    this.isDestroyed = false;
    this.messageQueue = [];

    this.connect();
  }

  /**
   * Validates WebSocket URL
   * @private
   * @param {string} url - URL to validate
   * @throws {Error} If URL is invalid
   */
  _validateUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('URL must be a non-empty string');
    }
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      throw new Error('Invalid WebSocket URL: must start with ws:// or wss://');
    }
  }

  /**
   * Establishes WebSocket connection
   */
  connect() {
    if (this.isDestroyed) {
      this.logger.warn('Cannot connect: PeerLink has been destroyed');
      return;
    }

    // Clean up existing connection
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
    }

    try {
      this.ws = new WebSocket(this.url);
      this._attachEventListeners();
    } catch (err) {
      this._handleError(err);
      this._scheduleReconnect();
    }
  }

  /**
   * Attaches event listeners to WebSocket instance
   * @private
   */
  _attachEventListeners() {
    this.ws.on("open", () => this._handleOpen());
    this.ws.on("error", (err) => this._handleError(err));
    this.ws.on("close", () => this._handleClose());
    this.ws.on("message", (data) => this._handleMessage(data));
  }

  /**
   * Handles WebSocket open event
   * @private
   */
  _handleOpen() {
    const emoji = this.options.useEmoji ? '🔗 ' : '';
    this.logger.log(`${emoji}Connected to peer ${this.url}`);

    // Reset reconnection attempts on successful connection
    this.reconnectAttempts = 0;

    // Process queued messages
    this._flushMessageQueue();

    // Call user callback
    if (this.onOpen) {
      try {
        this.onOpen();
      } catch (err) {
        this.logger.error(`Error in onOpen callback: ${err.message}`);
      }
    }
  }

  /**
   * Handles WebSocket error event
   * @private
   * @param {Error} err - Error object
   */
  _handleError(err) {
    this.logger.error(`PeerLink error (${this.url}): ${err.message}`);

    // Call user callback
    if (this.onError) {
      try {
        this.onError(err);
      } catch (callbackErr) {
        this.logger.error(`Error in onError callback: ${callbackErr.message}`);
      }
    }
  }

  /**
   * Handles WebSocket close event
   * @private
   */
  _handleClose() {
    const emoji = this.options.useEmoji ? '⚠️ ' : '';

    if (this.isDestroyed) {
      this.logger.log(`${emoji}Connection closed: ${this.url}`);
    } else {
      this.logger.log(`${emoji}Disconnected from ${this.url}, will retry...`);
      this._scheduleReconnect();
    }

    // Call user callback
    if (this.onClose) {
      try {
        this.onClose();
      } catch (err) {
        this.logger.error(`Error in onClose callback: ${err.message}`);
      }
    }
  }

  /**
   * Handles incoming WebSocket messages
   * @private
   * @param {string|Buffer} data - Raw message data
   */
  _handleMessage(data) {
    try {
      const obj = JSON.parse(data.toString());

      // Call user callback
      if (this.onMessage) {
        try {
          this.onMessage(obj);
        } catch (err) {
          this.logger.error(`Error in onMessage callback: ${err.message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Failed to parse message from ${this.url}: ${err.message}`);
    }
  }

  /**
   * Schedules reconnection attempt with exponential backoff
   * @private
   */
  _scheduleReconnect() {
    if (!this.shouldReconnect || this.isDestroyed) {
      return;
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.logger.error(`Max reconnection attempts (${this.options.maxReconnectAttempts}) reached for ${this.url}`);
      return;
    }

    this.reconnectAttempts++;

    let delay = this.options.reconnectDelay;
    if (this.options.enableExponentialBackoff) {
      delay = Math.min(
        this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.options.maxReconnectDelay
      );
    }

    this.logger.log(`Reconnecting to ${this.url} in ${delay}ms (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * Sends a message to the peer
   * @param {Object} obj - Object to send (will be JSON stringified)
   * @returns {boolean} True if message was sent, false if queued or dropped
   * @throws {Error} If serialization fails and message cannot be queued
   */
  send(obj) {
    if (this.isDestroyed) {
      this.logger.warn('Cannot send: PeerLink has been destroyed');
      return false;
    }

    // Serialize message
    let message;
    try {
      message = JSON.stringify(obj);
    } catch (err) {
      this.logger.error(`Failed to serialize message: ${err.message}`);
      throw new Error(`Message serialization failed: ${err.message}`);
    }

    // Send if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(message);
        return true;
      } catch (err) {
        this.logger.error(`Failed to send message: ${err.message}`);

        // Queue if queueing is enabled
        if (this.options.queueMessagesWhileDisconnected) {
          this._queueMessage(message);
        }
        return false;
      }
    }

    // Queue if not connected and queueing is enabled
    if (this.options.queueMessagesWhileDisconnected) {
      this._queueMessage(message);
      return false;
    }

    this.logger.warn(`Message dropped: not connected to ${this.url}`);
    return false;
  }

  /**
   * Queues a message for later delivery
   * @private
   * @param {string} message - Serialized message
   */
  _queueMessage(message) {
    if (this.messageQueue.length >= this.options.maxQueueSize) {
      this.logger.warn(`Message queue full (${this.options.maxQueueSize}), dropping oldest message`);
      this.messageQueue.shift();
    }
    this.messageQueue.push(message);
    this.logger.log(`Message queued (${this.messageQueue.length} in queue)`);
  }

  /**
   * Sends all queued messages
   * @private
   */
  _flushMessageQueue() {
    if (this.messageQueue.length === 0) {
      return;
    }

    this.logger.log(`Flushing ${this.messageQueue.length} queued messages...`);

    while (this.messageQueue.length > 0 &&
           this.ws &&
           this.ws.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      try {
        this.ws.send(message);
      } catch (err) {
        this.logger.error(`Failed to send queued message: ${err.message}`);
        // Put it back at the front
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  /**
   * Checks if currently connected
   * @returns {boolean} True if connected
   */
  get isConnected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Gets the current connection state
   * @returns {string} One of: 'connecting', 'open', 'closing', 'closed', 'destroyed'
   */
  get state() {
    if (this.isDestroyed) return 'destroyed';
    if (!this.ws) return 'closed';

    const states = ['connecting', 'open', 'closing', 'closed'];
    return states[this.ws.readyState] || 'unknown';
  }

  /**
   * Gets the number of queued messages
   * @returns {number} Number of messages in queue
   */
  get queuedMessageCount() {
    return this.messageQueue.length;
  }

  /**
   * Clears the message queue
   */
  clearQueue() {
    const count = this.messageQueue.length;
    this.messageQueue = [];
    this.logger.log(`Cleared ${count} queued messages`);
  }

  /**
   * Destroys the connection and prevents reconnection
   */
  destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    this.shouldReconnect = false;

    // Clear reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close WebSocket connection
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    // Clear message queue
    this.messageQueue = [];

    this.logger.log(`PeerLink destroyed: ${this.url}`);
  }

  /**
   * Manually triggers reconnection (resets reconnection attempts)
   */
  reconnect() {
    if (this.isDestroyed) {
      this.logger.warn('Cannot reconnect: PeerLink has been destroyed');
      return;
    }

    this.reconnectAttempts = 0;
    this.shouldReconnect = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.connect();
  }
}
