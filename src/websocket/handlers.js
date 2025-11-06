import { PluginInterface } from "./plugin.js";

/**
 * Initialize WebSocket event handlers
 */
export function initializeWebSocketHandlers(io, stateManager, npcSystem) {
  const pluginInterface = new PluginInterface();

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Check if this is the FGD plugin
    socket.on('plugin_register', (data) => {
      if (data.plugin === 'FGDProxyPlayer') {
        pluginInterface.register(socket, npcSystem.minecraftBridge);
      }
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

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return pluginInterface;
}
