import { PluginInterface } from "./plugin.js";

const MAX_REPLAY_EVENTS = 50;

function createReplayBuffer(io) {
  if (io.__replayBuffer) {
    return io.__replayBuffer;
  }

  const buffer = new Map();
  const originalEmit = io.emit.bind(io);

  io.emit = (event, ...args) => {
    if (typeof event === "string" && !event.startsWith("internal:")) {
      const payload = args?.[0];
      const events = buffer.get(event) || [];
      events.push({ payload, timestamp: Date.now() });
      if (events.length > MAX_REPLAY_EVENTS) {
        events.shift();
      }
      buffer.set(event, events);
    }
    return originalEmit(event, ...args);
  };

  io.__replayBuffer = buffer;
  return buffer;
}

function replayEventsToSocket(socket, buffer) {
  if (!buffer) return;
  for (const [event, entries] of buffer.entries()) {
    entries.forEach(entry => {
      socket.emit(event, entry.payload);
    });
  }
}

/**
 * Initialize WebSocket event handlers
 */
export function initializeWebSocketHandlers(io, stateManager, npcSystem) {
  const pluginInterface = new PluginInterface();
  const replayBuffer = createReplayBuffer(io);

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Check if this is the FGD plugin
    socket.on('plugin_register', (data) => {
      if (data.plugin === 'FGDProxyPlayer') {
        pluginInterface.register(socket, npcSystem.minecraftBridge);
      }
    });

    socket.on('plugin_heartbeat', (payload = {}) => {
      pluginInterface.recordHeartbeat(payload);
      if (npcSystem.minecraftBridge) {
        npcSystem.minecraftBridge.recordHeartbeat('plugin');
        const age = npcSystem.minecraftBridge.getHeartbeatAgeSeconds();
        stateManager.updatePerformanceMetrics({ heartbeatAgeSeconds: age });
        io.emit('bridge:heartbeat', { timestamp: Date.now(), ageSeconds: age });
      }
      socket.emit('plugin_heartbeat_ack', { timestamp: Date.now() });
    });

    // Send initial data to client
    const systemState = stateManager.getState();
    socket.emit('init', {
      nodes: systemState.nodes,
      metrics: systemState.metrics,
      stats: systemState.systemStats,
      logs: systemState.logs.slice(-20),
      config: systemState.config
    });

    replayEventsToSocket(socket, replayBuffer);

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return pluginInterface;
}
