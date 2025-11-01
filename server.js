import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { watch } from "fs";
import { logger } from "./logger.js";
import { NPCRegistry } from "./npc_registry.js";
import { NPCSpawner } from "./npc_spawner.js";
import { NPCFinalizer } from "./npc_finalizer.js";
import { LearningEngine } from "./learning_engine.js";
import { validator } from "./validator.js";
import { handleLogin, getCurrentUser, authenticate, authorize } from "./middleware/auth.js";

// Constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "data", "fused_knowledge.json");
const DEFAULT_PORT = 3000;

// NPC System instances (initialized later)
let npcRegistry = null;
let npcSpawner = null;
let npcFinalizer = null;
let learningEngine = null;

/**
 * Default fusion data structure returned when no data file exists
 */
const DEFAULT_FUSION_DATA = {
  skills: {},
  dialogues: {},
  outcomes: [],
  metadata: {
    version: "2.0.0",
    lastMerge: null,
    mergeCount: 0,
    sources: []
  }
};

// Cache for fusion data
let cachedData = null;
let lastModified = null;

/**
 * Ensures the data directory exists
 * @returns {Promise<void>}
 */
async function ensureDataDirectory() {
  try {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    console.log("✅ Data directory verified");
  } catch (err) {
    console.error("❌ Failed to create data directory:", err);
    throw err;
  }
}

/**
 * Loads fusion data from disk with caching
 * @returns {Promise<Object>} The fusion data
 */
async function loadFusionData() {
  try {
    const stats = await fs.stat(DATA_PATH);
    const currentModified = stats.mtime.getTime();

    // Return cached data if file hasn't changed
    if (cachedData && lastModified === currentModified) {
      return cachedData;
    }

    // Read and parse the file
    const rawData = await fs.readFile(DATA_PATH, "utf-8");
    const data = JSON.parse(rawData);

    // Update cache
    cachedData = data;
    lastModified = currentModified;

    return data;
  } catch (err) {
    if (err.code === "ENOENT") {
      // File doesn't exist, return default data
      return DEFAULT_FUSION_DATA;
    }
    // Re-throw other errors to be handled by caller
    throw err;
  }
}

/**
 * Sets up file watcher to invalidate cache when data changes
 */
function setupFileWatcher() {
  try {
    watch(DATA_PATH, (eventType) => {
      if (eventType === "change" || eventType === "rename") {
        console.log("📝 Data file changed, invalidating cache");
        cachedData = null;
        lastModified = null;
      }
    });
    console.log("👁️  File watcher active for fusion data");
  } catch (err) {
    console.warn("⚠️  Could not set up file watcher:", err.message);
  }
}

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// In-memory data store
let systemState = {
  nodes: [],
  metrics: { cpu: 0, memory: 0 },
  fusionData: {},
  systemStats: {},
  logs: [],
  config: {
    maxWorkers: 8,
    logLevel: 'info',
    autoScaling: true,
    telemetry: true,
    learningRate: 1.0,
    delegationBias: 0.4,
    cooldown: 10000
  }
};

// NPC Engine instance
let npcEngine = null;

/**
 * Initialize the NPC engine
 */
async function initializeNPCEngine() {
  try {
    npcEngine = new NPCEngine({
      autoSpawn: false,
      defaultSpawnPosition: { x: 0, y: 64, z: 0 },
      autoRegisterFromRegistry: true
    });

    await npcEngine.registryReady;
    await npcEngine.learningReady;

    console.log('✅ NPC Engine initialized');
    console.log(`   Registry: ${npcEngine.registry?.registryPath}`);
    console.log(`   Learning: ${npcEngine.learningEngine?.path}`);

    const activeNPCs = npcEngine.registry?.listActive() || [];
    console.log(`   Active NPCs: ${activeNPCs.length}`);
  } catch (err) {
    console.error('❌ Failed to initialize NPC engine:', err.message);
  }
}

/**
 * Initialize NPC system components
 */
async function initializeNPCSystem() {
  try {
    logger.info('Initializing NPC system');

    // Initialize learning engine
    learningEngine = new LearningEngine(path.join(__dirname, 'data', 'npc_profiles.json'));
    await learningEngine.initialize();

    // Initialize NPC registry
    npcRegistry = new NPCRegistry({
      registryPath: path.join(__dirname, 'data', 'npc_registry.json')
    });
    await npcRegistry.load();

    // Initialize spawner
    npcSpawner = new NPCSpawner({
      registry: npcRegistry,
      learningEngine: learningEngine,
      autoSpawn: false // Don't auto-spawn via spawner
    });
    await npcSpawner.initialize();

    // Initialize finalizer
    npcFinalizer = new NPCFinalizer({
      archivePath: path.join(__dirname, 'data', 'npc_archive.json'),
      registry: npcRegistry,
      learningEngine: learningEngine
    });
    await npcFinalizer.load();

    logger.info('NPC system initialized successfully');
  } catch (err) {
    logger.error('Failed to initialize NPC system', { error: err.message });
    throw err;
  }
}

/**
 * Initialize system with sample data
 */
async function initializeSystem() {
  try {
    const clusterData = await fs.readFile(path.join(__dirname, 'data', 'cluster_status.json'), 'utf8');
    const metricsData = await fs.readFile(path.join(__dirname, 'data', 'metrics.json'), 'utf8');
    const fusionData = await fs.readFile(path.join(__dirname, 'data', 'fused_knowledge.json'), 'utf8');
    const statsData = await fs.readFile(path.join(__dirname, 'data', 'system_stats.json'), 'utf8');
    const logsData = await fs.readFile(path.join(__dirname, 'data', 'system_logs.json'), 'utf8');

    systemState.nodes = JSON.parse(clusterData).nodes;
    systemState.metrics = JSON.parse(metricsData);
    systemState.fusionData = JSON.parse(fusionData);
    systemState.systemStats = JSON.parse(statsData);
    systemState.logs = JSON.parse(logsData).logs;

    logger.info('System initialized with sample data');
  } catch (err) {
    logger.warn('Failed to load some data', { error: err.message });
  }
}

/**
 * Simulate real-time data updates
 */
function startDataSimulation() {
  setInterval(() => {
    systemState.metrics.cpu = Math.floor(Math.random() * 30) + 40;
    systemState.metrics.memory = Math.floor(Math.random() * 30) + 50;
    systemState.metrics.timestamp = new Date().toISOString();

    systemState.nodes.forEach(node => {
      if (node.status === 'healthy') {
        node.cpu = Math.floor(Math.random() * 40) + 30;
        node.memory = Math.floor(Math.random() * 40) + 40;
        node.tasks = Math.floor(Math.random() * 10) + 5;
      }
    });

    const healthyNodes = systemState.nodes.filter(n => n.status === 'healthy');
    if (healthyNodes.length > 0) {
      systemState.systemStats.avgCpu = Math.floor(
        healthyNodes.reduce((sum, n) => sum + n.cpu, 0) / healthyNodes.length
      );
      systemState.systemStats.avgMemory = Math.floor(
        healthyNodes.reduce((sum, n) => sum + n.memory, 0) / healthyNodes.length
      );
      systemState.systemStats.activeTasks = healthyNodes.reduce((sum, n) => sum + n.tasks, 0);
    }

    io.emit('metrics:update', systemState.metrics);
    io.emit('nodes:update', systemState.nodes);
    io.emit('stats:update', systemState.systemStats);
  }, 5000);

  setInterval(() => {
    const logLevels = ['info', 'warn', 'error', 'success'];
    const messages = [
      'Task allocation completed successfully',
      'Health check passed for all nodes',
      'Fusion synchronization complete',
      'Auto-scaling triggered',
      'New learning data integrated'
    ];

    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    const newLog = {
      time,
      level: logLevels[Math.floor(Math.random() * logLevels.length)],
      message: messages[Math.floor(Math.random() * messages.length)]
    };

    systemState.logs.push(newLog);
    if (systemState.logs.length > 100) systemState.logs.shift();

    io.emit('log:new', newLog);
  }, 10000);
}

// ============================================================================
// Authentication Routes
// ============================================================================

app.post("/api/auth/login", handleLogin);
app.get("/api/auth/me", getCurrentUser);

// ============================================================================
// Bot Management Routes (integrated from routes/bot.js)
// ============================================================================

// Will be initialized after npcEngine is ready

// ============================================================================
// LLM Command Routes (integrated from routes/llm.js)
// ============================================================================

// Will be initialized after npcEngine is ready

// ============================================================================
// Dashboard Routes
// ============================================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/api/cluster", (req, res) => {
  res.json({ nodes: systemState.nodes });
});

app.get("/api/metrics", (req, res) => {
  res.json(systemState.metrics);
});

app.get("/api/fusion", (req, res) => {
  res.json(systemState.fusionData);
});

app.get("/api/stats", (req, res) => {
  res.json(systemState.systemStats);
});

app.get("/api/logs", (req, res) => {
  res.json({ logs: systemState.logs });
});

app.get("/api/config", (req, res) => {
  res.json(systemState.config);
});

app.post("/api/config", (req, res) => {
  systemState.config = { ...systemState.config, ...req.body };
  io.emit('config:update', systemState.config);
  res.json({ success: true, config: systemState.config });
});

app.post("/api/policy", (req, res) => {
  const { learningRate, delegationBias, cooldown } = req.body;
  systemState.config.learningRate = learningRate;
  systemState.config.delegationBias = delegationBias;
  systemState.config.cooldown = cooldown;
  io.emit('policy:update', { learningRate, delegationBias, cooldown });
  res.json({ success: true });
});

app.get("/api/nodes/:id", (req, res) => {
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

app.get("/data/fused_knowledge.json", async (req, res) => {
  try {
    const data = await loadFusionData();
    res.type("application/json").json(data);
  } catch (err) {
    console.error("❌ Error loading fusion data:", err);

    if (err instanceof SyntaxError) {
      // JSON parsing error
      return res.status(500).json({
        error: "Data file is corrupted",
        message: "Unable to parse fusion data"
      });
    }

    if (err.code === "EACCES") {
      // Permission error
      return res.status(500).json({
        error: "Permission denied",
        message: "Unable to access fusion data"
      });
    }

    // Generic server error
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to load fusion data"
    });
  }
});

// ============================================================================
// Health Check & Metrics Endpoints
// ============================================================================

/**
 * Health check endpoint
 */
app.get("/api/health", (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    components: {
      npcRegistry: npcRegistry ? "healthy" : "not_initialized",
      npcSpawner: npcSpawner ? "healthy" : "not_initialized",
      npcFinalizer: npcFinalizer ? "healthy" : "not_initialized",
      learningEngine: learningEngine ? "healthy" : "not_initialized"
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: "MB"
    }
  };

  const allHealthy = Object.values(health.components).every(status => status === "healthy");
  res.status(allHealthy ? 200 : 503).json(health);
});

/**
 * System metrics endpoint
 */
app.get("/api/metrics/system", async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      npc: {
        total: npcRegistry ? npcRegistry.getAll().length : 0,
        active: npcRegistry ? npcRegistry.listActive().length : 0,
        archived: npcFinalizer ? (await npcFinalizer.getArchive()).length : 0,
        deadLetterQueue: npcSpawner ? npcSpawner.getDeadLetterQueue().length : 0
      },
      learning: {
        profiles: learningEngine ? Object.keys(learningEngine.profiles).length : 0
      },
      system: systemState.metrics
    };

    res.json(metrics);
  } catch (err) {
    logger.error('Failed to get system metrics', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

// ============================================================================
// NPC CRUD API Endpoints
// ============================================================================

/**
 * List all NPCs
 */
app.get("/api/npcs", async (req, res) => {
  try {
    if (!npcRegistry) {
      return res.status(503).json({ error: 'NPC system not initialized' });
    }

    const { status, limit = 100, offset = 0 } = req.query;
    let npcs = npcRegistry.getAll();

    // Filter by status if provided
    if (status) {
      npcs = npcs.filter(npc => npc.status === status);
    }

    // Pagination
    const total = npcs.length;
    npcs = npcs.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      npcs,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (err) {
    logger.error('Failed to list NPCs', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve NPCs' });
  }
});

/**
 * Get single NPC by ID
 */
app.get("/api/npcs/:id", async (req, res) => {
  try {
    if (!npcRegistry) {
      return res.status(503).json({ error: 'NPC system not initialized' });
    }

    const npc = npcRegistry.get(req.params.id);
    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    // Enrich with learning data if available
    let enriched = { ...npc };
    if (learningEngine) {
      const learningProfile = learningEngine.getProfile(req.params.id);
      if (learningProfile) {
        enriched.learning = learningProfile;
      }
    }

    res.json(enriched);
  } catch (err) {
    logger.error('Failed to get NPC', { npcId: req.params.id, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve NPC' });
  }
});

/**
 * Create new NPC
 */
app.post("/api/npcs", async (req, res) => {
  try {
    if (!npcSpawner) {
      return res.status(503).json({ error: 'NPC system not initialized' });
    }

    const { id, role, npcType, appearance, personality, position, autoSpawn = false } = req.body;

    // Basic validation
    if (!role && !npcType) {
      return res.status(400).json({ error: 'Either role or npcType is required' });
    }

    const result = await npcSpawner.spawn({
      id,
      role,
      npcType,
      appearance,
      personality,
      position,
      autoSpawn
    });

    logger.info('NPC created via API', { npcId: result.id });
    res.status(201).json(result);
  } catch (err) {
    logger.error('Failed to create NPC', { error: err.message });
    res.status(500).json({ error: 'Failed to create NPC', message: err.message });
  }
});

/**
 * Update NPC
 */
app.put("/api/npcs/:id", async (req, res) => {
  try {
    if (!npcRegistry) {
      return res.status(503).json({ error: 'NPC system not initialized' });
    }

    const existing = npcRegistry.get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    const { role, appearance, personality, metadata, description } = req.body;

    const updated = await npcRegistry.upsert({
      id: req.params.id,
      role,
      appearance,
      personality,
      metadata,
      description
    });

    logger.info('NPC updated via API', { npcId: req.params.id });
    res.json(updated);
  } catch (err) {
    logger.error('Failed to update NPC', { npcId: req.params.id, error: err.message });
    res.status(500).json({ error: 'Failed to update NPC', message: err.message });
  }
});

/**
 * Delete/Finalize NPC
 */
app.delete("/api/npcs/:id", async (req, res) => {
  try {
    if (!npcFinalizer) {
      return res.status(503).json({ error: 'NPC system not initialized' });
    }

    const { preserve = false, removeFromWorld = true } = req.query;

    const result = await npcFinalizer.finalizeNPC(req.params.id, {
      reason: 'api_request',
      preserveInRegistry: preserve === 'true',
      removeFromWorld: removeFromWorld !== 'false'
    });

    logger.info('NPC finalized via API', { npcId: req.params.id });
    res.json(result);
  } catch (err) {
    logger.error('Failed to finalize NPC', { npcId: req.params.id, error: err.message });
    res.status(500).json({ error: 'Failed to finalize NPC', message: err.message });
  }
});

/**
 * Get NPC archive
 */
app.get("/api/npcs/archive/all", async (req, res) => {
  try {
    if (!npcFinalizer) {
      return res.status(503).json({ error: 'NPC system not initialized' });
    }

    const archive = await npcFinalizer.getArchive();
    res.json({ archive, total: archive.length });
  } catch (err) {
    logger.error('Failed to get archive', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve archive' });
  }
});

/**
 * Get dead letter queue
 */
app.get("/api/npcs/deadletter/queue", (req, res) => {
  try {
    if (!npcSpawner) {
      return res.status(503).json({ error: 'NPC system not initialized' });
    }

    const queue = npcSpawner.getDeadLetterQueue();
    res.json({ queue, total: queue.length });
  } catch (err) {
    logger.error('Failed to get dead letter queue', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve dead letter queue' });
  }
});

/**
 * Retry dead letter queue
 */
app.post("/api/npcs/deadletter/retry", async (req, res) => {
  try {
    if (!npcSpawner) {
      return res.status(503).json({ error: 'NPC system not initialized' });
    }

    const results = await npcSpawner.retryDeadLetterQueue();
    logger.info('Dead letter queue retry completed', results);
    res.json(results);
  } catch (err) {
    logger.error('Failed to retry dead letter queue', { error: err.message });
    res.status(500).json({ error: 'Failed to retry dead letter queue' });
  }
});

/**
 * 404 handler for API routes
 */
app.use('/data', (req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "The requested resource does not exist"
  });
});

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: "Payload too large",
      message: `Request size exceeds ${REQUEST_SIZE_LIMIT} limit`
    });
  }

  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === 'production'
      ? "An unexpected error occurred"
      : err.message
  });
});


/**
 * Gracefully shuts down the server
 * @param {string} signal - The signal that triggered shutdown
 */
async function gracefulShutdown(signal) {
  logger.warn('Shutdown signal received', { signal });
  console.log(`\n⚠️  ${signal} received, shutting down gracefully...`);

  try {
    // Save any pending NPC data
    if (npcRegistry) {
      await npcRegistry.save();
      logger.info('NPC registry saved');
    }
    if (learningEngine) {
      await learningEngine.forceSave();
      logger.info('Learning engine saved');
    }
  } catch (err) {
    logger.error('Error saving data during shutdown', { error: err.message });
  }

  if (httpServer) {
    httpServer.close(() => {
      logger.info('Server closed gracefully');
      console.log("✅ Server closed gracefully");
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      console.error("❌ Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// WebSocket
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

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

const PORT = process.env.PORT || DEFAULT_PORT;

async function startServer() {
  try {
    // Ensure data directory exists
    await ensureDataDirectory();

    // Initialize system data
    await initializeSystem();

    // Initialize NPC system
    await initializeNPCSystem();

    // Set up file watcher
    setupFileWatcher();

    // Start data simulation
    startDataSimulation();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info('AICraft Cluster Control Panel started');
      console.log('╔══════════════════════════════════════════╗');
      console.log('║   AICraft Cluster Control Panel         ║');
      console.log('╚══════════════════════════════════════════╝');
      console.log(`🚀 Server: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: Real-time updates enabled`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📈 Metrics: http://localhost:${PORT}/api/metrics/system`);
      console.log(`🤖 NPC API: http://localhost:${PORT}/api/npcs`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
