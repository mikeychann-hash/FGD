import express from "express";
import path from "path";
import { ROOT_DIR } from "../config/constants.js";
import { loadFusionData } from "../services/data.js";

/**
 * Initialize cluster/dashboard routes
 */
export function initClusterRoutes(stateManager, npcSystem) {
  const router = express.Router();
  const systemState = stateManager.getState();

  // Dashboard HTML routes
  router.get("/", (req, res) => {
    res.sendFile(path.join(ROOT_DIR, "dashboard.html"));
  });

  router.get("/admin", (req, res) => {
    res.sendFile(path.join(ROOT_DIR, "admin.html"));
  });

  // Cluster data endpoints
  router.get("/api/cluster", (req, res) => {
    res.json({ nodes: systemState.nodes });
  });

  router.get("/api/metrics", (req, res) => {
    res.json(systemState.metrics);
  });

  router.get("/api/fusion", (req, res) => {
    res.json(systemState.fusionData);
  });

  router.get("/api/stats", (req, res) => {
    res.json(systemState.systemStats);
  });

  router.get("/api/logs", (req, res) => {
    res.json({ logs: systemState.logs });
  });

  // Config endpoints
  router.get("/api/config", (req, res) => {
    res.json(systemState.config);
  });

  router.post("/api/config", (req, res) => {
    const config = stateManager.updateConfig(req.body);
    res.json({ success: true, config });
  });

  router.post("/api/policy", (req, res) => {
    const { learningRate, delegationBias, cooldown } = req.body;
    stateManager.updatePolicy({ learningRate, delegationBias, cooldown });
    res.json({ success: true });
  });

  // Node details
  router.get("/api/nodes/:id", (req, res) => {
    const nodeId = parseInt(req.params.id);
    const node = systemState.nodes[nodeId];
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const detailedNode = {
      ...node,
      id: nodeId,
      uptime: Math.floor(Math.random() * 86400000) + 3600000,
      connections: Math.floor(Math.random() * 50) + 10,
      packetsProcessed: Math.floor(Math.random() * 1000000) + 100000,
      errors: Math.floor(Math.random() * 10),
      lastHeartbeat: new Date().toISOString(),
      version: '2.4.1',
      region: ['US-East', 'EU-West', 'Asia-Pacific'][Math.floor(Math.random() * 3)]
    };

    res.json(detailedNode);
  });

  // Fusion data endpoint
  router.get("/data/fused_knowledge.json", async (req, res) => {
    try {
      const data = await loadFusionData();
      res.type("application/json").json(data);
    } catch (err) {
      console.error("❌ Error loading fusion data:", err);

      if (err instanceof SyntaxError) {
        return res.status(500).json({
          error: "Data file is corrupted",
          message: "Unable to parse fusion data"
        });
      }

      if (err.code === "EACCES") {
        return res.status(500).json({
          error: "Permission denied",
          message: "Unable to access fusion data"
        });
      }

      return res.status(500).json({
        error: "Internal server error",
        message: "Failed to load fusion data"
      });
    }
  });

  // Bot debug view
  router.get("/debug/bot/:id/view", (req, res) => {
    if (!npcSystem.npcEngine) {
      return res.status(503).send("NPC engine not initialized");
    }

    const botId = req.params.id;
    const registryBot = npcSystem.npcEngine.registry?.get(botId) || null;
    const runtime = npcSystem.npcEngine.npcs instanceof Map
      ? npcSystem.npcEngine.npcs.get(botId)?.runtime || null
      : null;

    const summary = {
      id: botId,
      role: registryBot?.role || runtime?.role || null,
      status: runtime?.status || registryBot?.status || "unknown",
      position: runtime?.position || registryBot?.lastKnownPosition || registryBot?.spawnPosition || null,
      velocity: runtime?.velocity || null,
      tickCount: runtime?.tickCount || 0,
      lastTickAt: runtime?.lastTickAt || null,
      memory: runtime?.memory?.context || []
    };

    const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Bot Debug View - ${botId}</title>
      <style>
        body { font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; }
        pre { background: rgba(15, 23, 42, 0.85); padding: 16px; border-radius: 8px; }
        a { color: #38bdf8; }
      </style>
    </head>
    <body>
      <h1>Debug View: ${botId}</h1>
      <p>This is a placeholder visualization for hybrid NPC telemetry.</p>
      <pre>${JSON.stringify(summary, null, 2)}</pre>
      <p><a href="/admin">Back to Admin</a></p>
    </body>
  </html>`;

    res.type("html").send(html);
  });

  return router;
}
