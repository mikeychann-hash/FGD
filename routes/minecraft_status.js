// routes/minecraft_status.js
// Lightweight Minecraft bridge/plugin status endpoints

import express from 'express';
import { fail } from '../src/middleware/response.js';

export function initMinecraftStatusRoutes(npcSystem) {
  const router = express.Router();

  router.get('/status', (req, res) => {
    try {
      const bridge = npcSystem?.minecraftBridge || null;
      const status = {
        lastHeartbeat: null,
        ageSeconds: null,
        rconConnected: false,
        pluginConnected: false,
        plugin: 'error',
      };

      if (bridge) {
        if (typeof bridge.checkConnection === 'function') {
          const result = bridge.checkConnection();
          status.rconConnected = Boolean(result.rconConnected);
          status.pluginConnected = Boolean(result.pluginConnected);
          status.ageSeconds = result.pluginHeartbeatAgeSeconds ?? null;
          status.plugin = result.pluginStatus || (status.pluginConnected ? 'ok' : 'error');
        } else {
          status.rconConnected = typeof bridge.isConnected === 'function' ? bridge.isConnected() : false;
          status.ageSeconds = typeof bridge.getHeartbeatAgeSeconds === 'function'
            ? bridge.getHeartbeatAgeSeconds()
            : null;
          status.pluginConnected = status.ageSeconds !== null && status.ageSeconds < 30;
          status.plugin = status.pluginConnected ? 'ok' : 'error';
        }
        status.lastHeartbeat = bridge.lastHeartbeatAt
          ? new Date(bridge.lastHeartbeatAt).toISOString()
          : null;
      }

      res.json(status);
    } catch (err) {
      return fail(res, 500, 'Failed to get Minecraft status', err.message);
    }
  });

  return router;
}
