import { PluginInterface } from './plugin.js';
import { runSelfCheck } from '../services/init_cluster.js';
import { setServiceContainer, getServiceStatus } from '../services/service_container.js';

const MAX_REPLAY_EVENTS = 50;

function createReplayBuffer(io) {
  if (io.__replayBuffer) {
    return io.__replayBuffer;
  }

  const buffer = new Map();
  const originalEmit = io.emit.bind(io);

  io.emit = (event, ...args) => {
    if (typeof event === 'string' && !event.startsWith('internal:')) {
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
    entries.forEach((entry) => {
      socket.emit(event, entry.payload);
    });
  }
}

/**
 * Initialize WebSocket event handlers
 */
export function initializeWebSocketHandlers(io, stateManager, npcSystem) {
  const pluginInterface = new PluginInterface();
  // Register control handlers for real‑time bot control
  // This will attach additional socket listeners for control commands.
  // The handlers use the BotControlManager service and interact with the Mineflayer bridge.
  import('../services/bot_control_manager.js').then(({ botControlManager }) => {
    // Dynamically import to avoid circular dependencies at load time.
    // Register after the socket connection is established.
    io.on('connection', (socket) => {
      // Ensure control handlers are set up for each new socket.
      // The registerControlHandlers function is defined in src/websocket/control_handlers.js.
      import('../websocket/control_handlers.js').then(({ registerControlHandlers }) => {
        registerControlHandlers(io, npcSystem);
      }).catch((err) => {
        console.error('Failed to load control handlers:', err);
      });
      // Register high‑level command handlers
      import('../websocket/command_handlers.js').then(({ registerCommandHandlers }) => {
        registerCommandHandlers(io);
      }).catch((err) => {
        console.error('Failed to load command handlers:', err);
      });
    });
  }).catch((err) => {
    console.error('Failed to load BotControlManager:', err);
  });
  const replayBuffer = createReplayBuffer(io);
  let dataUpdateIntervals = [];

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
      config: systemState.config,
    });

    // Emit current system status on connect
    const status = getServiceStatus();
    socket.emit('system:status', {
      status,
      timestamp: Date.now(),
    });

    replayEventsToSocket(socket, replayBuffer);

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // Push cluster status and metrics every 30 seconds to reduce polling
  const dashboardDataInterval = setInterval(() => {
    const currentState = stateManager.getState();
    // Refresh service status and emit
    runSelfCheck(npcSystem)
      .then((status) => {
        setServiceContainer({ status });
        io.emit('system:status', {
          status,
          timestamp: Date.now(),
        });
      })
      .catch(() => { });

    // Emit cluster status update
    io.emit('cluster:update', {
      nodes: currentState.nodes || [],
      timestamp: Date.now()
    });

    // Emit metrics update
    io.emit('metrics:update', {
      cpu: currentState.metrics?.cpu || 0,
      memory: currentState.metrics?.memory || 0,
      performance: currentState.metrics?.performance || {},
      timestamp: Date.now()
    });

    // Emit fusion data update
    io.emit('fusion:update', {
      skills: currentState.fusionData?.skills || {},
      dialogues: currentState.fusionData?.dialogues || {},
      outcomes: currentState.fusionData?.outcomes || [],
      lastSync: currentState.fusionData?.lastSync || new Date().toISOString(),
      timestamp: Date.now()
    });
  }, 30000); // Push every 30 seconds

  dataUpdateIntervals.push(dashboardDataInterval);

  // Cleanup function for graceful shutdown
  const cleanup = () => {
    dataUpdateIntervals.forEach(interval => clearInterval(interval));
    dataUpdateIntervals = [];
  };

  // Attach cleanup to io instance for later cleanup
  io.__dashboardCleanup = cleanup;

  return pluginInterface;
}
