/**
 * Plugin Interface for FGDProxyPlayer
 */
export class PluginInterface {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.lastHeartbeatAt = null;
  }

  async moveBot({ botId, position }) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Plugin not connected'));
        return;
      }

      const timeout = setTimeout(() => reject(new Error('Plugin moveBot timeout')), 5000);

      this.socket.once(`moveBot_response_${botId}`, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.socket.emit('moveBot', { botId, position });
    });
  }

  async scanArea({ botId, radius, center }) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Plugin not connected'));
        return;
      }

      const timeout = setTimeout(() => reject(new Error('Plugin scanArea timeout')), 5000);

      this.socket.once(`scanArea_response_${botId}`, (response) => {
        clearTimeout(timeout);
        resolve(response.result);
      });

      this.socket.emit('scanArea', { botId, radius, center });
    });
  }

  async dig({ botId, blockPosition }) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Plugin not connected'));
        return;
      }

      const timeout = setTimeout(() => reject(new Error('Plugin dig timeout')), 5000);

      this.socket.once(`dig_response_${botId}`, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.socket.emit('dig', { botId, blockPosition });
    });
  }

  async place({ botId, blockPosition, blockType }) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Plugin not connected'));
        return;
      }

      const timeout = setTimeout(() => reject(new Error('Plugin place timeout')), 5000);

      this.socket.once(`place_response_${botId}`, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.socket.emit('place', { botId, blockPosition, blockType });
    });
  }

  async attack({ botId, target }) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Plugin not connected'));
        return;
      }

      const timeout = setTimeout(() => reject(new Error('Plugin attack timeout')), 5000);

      this.socket.once(`attack_response_${botId}`, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.socket.emit('attack', { botId, target });
    });
  }

  async useItem({ botId, itemName, target }) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Plugin not connected'));
        return;
      }

      const timeout = setTimeout(() => reject(new Error('Plugin useItem timeout')), 5000);

      this.socket.once(`useItem_response_${botId}`, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.socket.emit('useItem', { botId, itemName, target });
    });
  }

  async inventory({ botId }) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Plugin not connected'));
        return;
      }

      const timeout = setTimeout(() => reject(new Error('Plugin inventory timeout')), 5000);

      this.socket.once(`inventory_response_${botId}`, (response) => {
        clearTimeout(timeout);
        resolve(response.result);
      });

      this.socket.emit('inventory', { botId });
    });
  }

  async chat({ botId, message }) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Plugin not connected'));
        return;
      }

      const timeout = setTimeout(() => reject(new Error('Plugin chat timeout')), 5000);

      this.socket.once(`chat_response_${botId}`, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.socket.emit('chat', { botId, message });
    });
  }

  async jump({ botId }) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Plugin not connected'));
        return;
      }

      const timeout = setTimeout(() => reject(new Error('Plugin jump timeout')), 5000);

      this.socket.once(`jump_response_${botId}`, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.socket.emit('jump', { botId });
    });
  }

  /**
   * Set up plugin response handlers
   */
  setupResponseHandlers(socket) {
    socket.on('moveBot_response', (response) => {
      socket.emit(`moveBot_response_${response.botId}`, response);
    });

    socket.on('scanArea_response', (response) => {
      socket.emit(`scanArea_response_${response.botId}`, response);
    });

    socket.on('dig_response', (response) => {
      socket.emit(`dig_response_${response.botId}`, response);
    });

    socket.on('place_response', (response) => {
      socket.emit(`place_response_${response.botId}`, response);
    });

    socket.on('attack_response', (response) => {
      socket.emit(`attack_response_${response.botId}`, response);
    });

    socket.on('useItem_response', (response) => {
      socket.emit(`useItem_response_${response.botId}`, response);
    });

    socket.on('inventory_response', (response) => {
      socket.emit(`inventory_response_${response.botId}`, response);
    });

    socket.on('chat_response', (response) => {
      socket.emit(`chat_response_${response.botId}`, response);
    });

    socket.on('jump_response', (response) => {
      socket.emit(`jump_response_${response.botId}`, response);
    });
  }

  /**
   * Handle plugin disconnection
   */
  handleDisconnect() {
    this.connected = false;
    this.socket = null;
    console.log('❌ FGDProxyPlayer plugin disconnected');
  }

  recordHeartbeat(payload = {}) {
    this.lastHeartbeatAt = Date.now();
    if (payload?.meta?.tickLatency) {
      // surface plugin-provided latency metrics to connected clients if needed
      if (this.socket) {
        this.socket.emit('plugin_latency_update', {
          timestamp: this.lastHeartbeatAt,
          tickLatency: payload.meta.tickLatency,
        });
      }
    }
  }

  /**
   * Register plugin connection
   */
  register(socket, minecraftBridge) {
    this.socket = socket;
    this.connected = true;
    console.log('✅ FGDProxyPlayer plugin connected');

    // Wire plugin to minecraft bridge
    if (minecraftBridge) {
      minecraftBridge.setPluginInterface(this);
      console.log('🔗 Plugin interface wired to MinecraftBridge');
    }

    // Set up response handlers
    this.setupResponseHandlers(socket);

    // Handle disconnect
    socket.on('disconnect', () => this.handleDisconnect());
  }
}
