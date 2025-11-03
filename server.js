import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { watch } from "fs";
import os from "os";
import { logger } from "./logger.js";
import { NPCRegistry } from "./npc_registry.js";
import { NPCSpawner } from "./npc_spawner.js";
import { NPCFinalizer } from "./npc_finalizer.js";
import { LearningEngine } from "./learning_engine.js";
import { validator } from "./validator.js";
import { NPCEngine } from "./npc_engine.js";
import { MinecraftBridge } from "./minecraft_bridge.js";
import { AutonomicCore } from "./autonomic_core.js";
import { progressionEngine } from "./core/progression_engine.js";
import { initBotRoutes } from "./routes/bot.js";
import { initLLMRoutes } from "./routes/llm.js";
import { handleLogin, getCurrentUser, authenticate } from "./middleware/auth.js";
import { ensureNonDefaultSecret, logSecretWarnings } from "./security/secrets.js";

// Constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DATA_PATH = path.join(DATA_DIR, "fused_knowledge.json");
const DEFAULT_PORT = 3000;

// NPC System instances (initialized later)
let npcRegistry = null;
let npcSpawner = null;
let npcFinalizer = null;
let learningEngine = null;
let npcEngine = null;
let minecraftBridge = null;
let autonomicCore = null;

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

const telemetryWatchers = [];
const telemetryIntervals = [];

/**
 * Initialize Minecraft Bridge (optional)
 */
async function initializeMinecraftBridge() {
  try {
    const host = process.env.MINECRAFT_RCON_HOST || '127.0.0.1';
    const port = parseInt(process.env.MINECRAFT_RCON_PORT || '25575');
    const rawPassword = process.env.MINECRAFT_RCON_PASSWORD || '';
    const password = ensureNonDefaultSecret({
      label: 'Minecraft RCON password',
      value: rawPassword,
      fallback: 'fgd_rcon_password_change_me',
      envVar: 'MINECRAFT_RCON_PASSWORD',
      allowEmpty: true
    });

    // Only initialize if password is set (indicates intent to use RCON)
    if (password) {
      minecraftBridge = new MinecraftBridge({
        host,
        port,
        password,
        connectOnCreate: false // Don't auto-connect yet
      });

      // Set up telemetry channel for real-time updates
      minecraftBridge.setTelemetryChannel((event, payload) => {
        io.emit(event, payload);
      });

      logger.info('Minecraft Bridge configured', { host, port });
      console.log(`🎮 Minecraft Bridge configured for ${host}:${port}`);

      // Optionally connect
      try {
        await minecraftBridge.connect();
        logger.info('Minecraft Bridge connected successfully');
        console.log('✅ Minecraft Bridge connected');
      } catch (err) {
        logger.warn('Minecraft Bridge configured but not connected', { error: err.message });
        console.log('⚠️  Minecraft Bridge configured but not connected:', err.message);
      }
    } else {
      logger.info('Minecraft Bridge not configured (no RCON password set)');
      console.log('ℹ️  Minecraft Bridge not configured (set MINECRAFT_RCON_PASSWORD to enable)');
    }
  } catch (err) {
    logger.error('Failed to initialize Minecraft Bridge', { error: err.message });
    console.error('❌ Failed to initialize Minecraft Bridge:', err.message);
  }
}

/**
 * Initialize the NPC Engine with Minecraft Bridge
 */
async function initializeNPCEngine() {
  try {
    npcEngine = new NPCEngine({
      autoSpawn: false,
      defaultSpawnPosition: { x: 0, y: 64, z: 0 },
      autoRegisterFromRegistry: true,
      registry: npcRegistry,
      learningEngine: learningEngine,
      bridge: minecraftBridge
    });

    await npcEngine.registryReady;
    await npcEngine.learningReady;

    logger.info('NPC Engine initialized');
    console.log('✅ NPC Engine initialized');
    console.log(`   Registry: ${npcEngine.registry?.registryPath}`);
    console.log(`   Learning: ${npcEngine.learningEngine?.path}`);
    console.log(`   Bridge: ${minecraftBridge ? 'Connected' : 'Not configured'}`);

    const activeNPCs = npcEngine.registry?.listActive() || [];
    console.log(`   Active NPCs: ${activeNPCs.length}`);
    systemState.systemStats.activeBots = activeNPCs.length;
    attachNpcEngineTelemetry(npcEngine);
    recomputeSystemStats();
  } catch (err) {
    logger.error('Failed to initialize NPC engine', { error: err.message });
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

    // Initialize Minecraft Bridge (optional)
    await initializeMinecraftBridge();

    // Initialize NPC Engine with all components
    await initializeNPCEngine();

    // Initialize Autonomic Core with Progression Engine
    await initializeAutonomicCore();

    logger.info('NPC system initialized successfully');
  } catch (err) {
    logger.error('Failed to initialize NPC system', { error: err.message });
    throw err;
  }
}

/**
 * Initialize Autonomic Core with Progression Engine integration
 */
async function initializeAutonomicCore() {
  try {
    autonomicCore = new AutonomicCore();
    await autonomicCore.init();

    // Connect NPC engine and bridge for phase coordination
    if (npcEngine) {
      autonomicCore.setNPCEngine(npcEngine);
    }

    // Listen for phase changes and propagate to all systems
    progressionEngine.on("phaseChanged", (data) => {
      console.log(`🌍 [Server] Phase changed to ${data.phase}: ${data.guide.name}`);

      // Update NPC engine phase
      if (npcEngine && typeof npcEngine.setPhase === "function") {
        npcEngine.setPhase(data.phase);
      }

      // Broadcast via WebSocket
      io.emit("progression:phaseChanged", data);
    });

    progressionEngine.on("progressUpdate", (data) => {
      io.emit("progression:progressUpdate", data);
    });

    progressionEngine.on("metricUpdate", (data) => {
      io.emit("progression:metricUpdate", data);
    });

    console.log('✅ Autonomic Core and Progression Engine initialized');
    logger.info('Autonomic Core and Progression Engine initialized');
  } catch (err) {
    logger.error('Failed to initialize Autonomic Core', { error: err.message });
    console.error('❌ Failed to initialize Autonomic Core:', err.message);
  }
}

/**
 * Initialize system with sample data
 */
async function initializeSystem() {
  try {
    const clusterData = await fs.readFile(path.join(DATA_DIR, 'cluster_status.json'), 'utf8');
    const metricsData = await fs.readFile(path.join(DATA_DIR, 'metrics.json'), 'utf8');
    const fusionData = await fs.readFile(path.join(DATA_DIR, 'fused_knowledge.json'), 'utf8');
    const statsData = await fs.readFile(path.join(DATA_DIR, 'system_stats.json'), 'utf8');
    const logsData = await fs.readFile(path.join(DATA_DIR, 'system_logs.json'), 'utf8');

    systemState.nodes = JSON.parse(clusterData).nodes;
    const parsedMetrics = JSON.parse(metricsData);
    systemState.metrics = {
      ...systemState.metrics,
      cluster: parsedMetrics,
      cpu: parsedMetrics.cpu ?? systemState.metrics.cpu,
      memory: parsedMetrics.memory ?? systemState.metrics.memory,
      timestamp: parsedMetrics.timestamp || systemState.metrics.timestamp || new Date().toISOString()
    };
    systemState.fusionData = JSON.parse(fusionData);
    systemState.systemStats = { ...JSON.parse(statsData) };
    const parsedLogs = JSON.parse(logsData).logs;
    systemState.logs = Array.isArray(parsedLogs) ? parsedLogs.slice(-100) : [];

    recomputeSystemStats();

    logger.info('System initialized with sample data');
  } catch (err) {
    logger.warn('Failed to load some data', { error: err.message });
  }
}

function appendSystemLog(entry) {
  const now = new Date();
  const logEntry = {
    time: entry.time || now.toTimeString().split(' ')[0],
    level: entry.level || 'info',
    message: entry.message || ''
  };

  systemState.logs.push(logEntry);
  if (systemState.logs.length > 100) {
    systemState.logs.shift();
  }

  io.emit('log:new', logEntry);
  io.emit('logs:update', systemState.logs);
}

function recomputeSystemStats() {
  const nodes = Array.isArray(systemState.nodes) ? systemState.nodes : [];
  const healthyNodes = nodes.filter(node => node && node.status === 'healthy');

  const sumCpu = healthyNodes.reduce((sum, node) => sum + (Number(node.cpu) || 0), 0);
  const sumMemory = healthyNodes.reduce((sum, node) => sum + (Number(node.memory) || 0), 0);
  const sumTasks = healthyNodes.reduce((sum, node) => sum + (Number(node.tasks) || 0), 0);

  const avgCpu = healthyNodes.length ? Math.round(sumCpu / healthyNodes.length) : 0;
  const avgMemory = healthyNodes.length ? Math.round(sumMemory / healthyNodes.length) : 0;

  const activeBots = npcEngine?.npcs instanceof Map ? npcEngine.npcs.size : systemState.systemStats.activeBots || 0;

  systemState.systemStats = {
    ...systemState.systemStats,
    nodeCount: nodes.length,
    healthyNodes: healthyNodes.length,
    avgCpu,
    avgMemory,
    activeTasks: sumTasks,
    activeBots,
    lastUpdated: new Date().toISOString()
  };

  io.emit('stats:update', systemState.systemStats);
}

function sampleCpuTimes() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times)) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }

  return { idle, total };
}

function createHostMetricsSampler() {
  let previous = sampleCpuTimes();

  return () => {
    const current = sampleCpuTimes();
    const idleDiff = current.idle - previous.idle;
    const totalDiff = current.total - previous.total;
    previous = current;

    const cpuPercent = totalDiff > 0
      ? Math.max(0, Math.min(100, Math.round(100 - (idleDiff / totalDiff) * 100)))
      : 0;

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryPercent = Math.max(0, Math.min(100, Math.round(((totalMemory - freeMemory) / totalMemory) * 100)));

    const hostMetrics = {
      cpuPercent,
      memoryPercent,
      loadAverage: os.loadavg?.()[0] ?? null,
      totalMemoryBytes: totalMemory,
      freeMemoryBytes: freeMemory,
      processMemoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
    };

    systemState.metrics = {
      ...systemState.metrics,
      cpu: cpuPercent,
      memory: memoryPercent,
      timestamp: new Date().toISOString(),
      host: hostMetrics
    };

    io.emit('metrics:update', systemState.metrics);
    recomputeSystemStats();
  };
}

function debounce(fn, delay = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function watchTelemetryFile(fileName, handler) {
  const filePath = path.join(DATA_DIR, fileName);

  const load = async () => {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(content);
      handler(parsed);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Failed to load telemetry file', { file: fileName, error: error.message });
      }
    }
  };

  const debouncedLoad = debounce(load, 150);
  load();

  try {
    const watcher = watch(filePath, { persistent: false }, () => debouncedLoad());
    telemetryWatchers.push(watcher);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const directoryWatcher = watch(DATA_DIR, { persistent: false }, (_, changedFile) => {
        if (changedFile === fileName) {
          debouncedLoad();
        }
      });
      telemetryWatchers.push(directoryWatcher);
    } else {
      logger.warn('Failed to watch telemetry file', { file: fileName, error: error.message });
    }
  }
}

function startTelemetryPipeline() {
  watchTelemetryFile('cluster_status.json', payload => {
    if (Array.isArray(payload?.nodes)) {
      systemState.nodes = payload.nodes;
      recomputeSystemStats();
      io.emit('nodes:update', systemState.nodes);
    }
  });

  watchTelemetryFile('metrics.json', payload => {
    if (payload && typeof payload === 'object') {
      systemState.metrics = {
        ...systemState.metrics,
        cluster: payload,
        clusterTimestamp: payload.timestamp || new Date().toISOString()
      };
      io.emit('metrics:update', systemState.metrics);
    }
  });

  watchTelemetryFile('system_stats.json', payload => {
    if (payload && typeof payload === 'object') {
      systemState.systemStats = { ...systemState.systemStats, ...payload };
      io.emit('stats:update', systemState.systemStats);
    }
  });

  watchTelemetryFile('system_logs.json', payload => {
    const logs = Array.isArray(payload?.logs) ? payload.logs.slice(-100) : [];
    systemState.logs = logs;
    io.emit('logs:update', systemState.logs);
  });

  const sampleHostMetrics = createHostMetricsSampler();
  sampleHostMetrics();
  telemetryIntervals.push(setInterval(sampleHostMetrics, 5000));
}

function attachNpcEngineTelemetry(engine) {
  if (!engine || typeof engine.on !== 'function') {
    return;
  }

  const updateStats = () => {
    systemState.systemStats.activeBots = engine.npcs instanceof Map ? engine.npcs.size : 0;
    recomputeSystemStats();
  };

  engine.on('npc_registered', updateStats);
  engine.on('npc_unregistered', updateStats);
  engine.on('npc_status', updateStats);

  engine.on('npc_task_completed', payload => {
    appendSystemLog({
      level: 'success',
      message: `Task completed by ${payload?.npcId || payload?.id || 'unknown'}`
    });
    updateStats();
  });

  engine.on('npc_error', payload => {
    const details = payload?.payload?.message || payload?.error || payload?.message || 'Unknown error';
    appendSystemLog({
      level: 'error',
      message: `NPC ${payload?.npcId || payload?.id || 'unknown'} error: ${details}`
    });
  });

  engine.on('npc_scan', payload => {
    appendSystemLog({
      level: 'info',
      message: `Scan received from ${payload?.npcId || payload?.botId || 'unknown'}`
    });
  });
}

// ============================================================================
// Authentication Routes
// ============================================================================

app.post("/api/auth/login", handleLogin);
app.get("/api/auth/me", authenticate, getCurrentUser);

// ============================================================================
// Bot Management Routes (integrated from routes/bot.js)
// ============================================================================

/**
 * Initialize API routes that depend on NPC Engine
 * Must be called after NPC system initialization
 */
function initializeAPIRoutes() {
  if (!npcEngine) {
    logger.warn('Cannot initialize API routes - NPC Engine not ready');
    return;
  }

  try {
    // Initialize bot management routes
    const botRouter = initBotRoutes(npcEngine, io);
    app.use('/api/bots', botRouter);
    logger.info('Bot management routes initialized');
    console.log('✅ Bot management routes initialized');

    // Initialize LLM command routes
    const llmRouter = initLLMRoutes(npcEngine, io);
    app.use('/api/llm', llmRouter);
    logger.info('LLM command routes initialized');
    console.log('✅ LLM command routes initialized');
  } catch (err) {
    logger.error('Failed to initialize API routes', { error: err.message });
    console.error('❌ Failed to initialize API routes:', err.message);
  }
}

// ============================================================================
// LLM Command Routes - see initializeAPIRoutes() above
// ============================================================================

// ============================================================================
// Dashboard Routes
// ============================================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
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

app.get("/debug/bot/:id/view", (req, res) => {
  if (!npcEngine) {
    return res.status(503).send("NPC engine not initialized");
  }

  const botId = req.params.id;
  const registryBot = npcEngine.registry?.get(botId) || null;
  const runtime = npcEngine.npcs instanceof Map
    ? npcEngine.npcs.get(botId)?.runtime || null
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

// ============================================================================
// Progression System API Routes
// ============================================================================

/**
 * GET /api/progression - Get current progression status
 */
app.get("/api/progression", (req, res) => {
  try {
    const status = progressionEngine.getStatus();
    res.json(status);
  } catch (err) {
    logger.error('Failed to get progression status', { error: err.message });
    res.status(500).json({ error: 'Failed to get progression status' });
  }
});

/**
 * GET /api/progression/phase - Get current phase information
 */
app.get("/api/progression/phase", (req, res) => {
  try {
    const phaseInfo = progressionEngine.getCurrentPhase();
    res.json(phaseInfo);
  } catch (err) {
    logger.error('Failed to get phase info', { error: err.message });
    res.status(500).json({ error: 'Failed to get phase info' });
  }
});

/**
 * PUT /api/progression/phase - Manually set progression phase (admin)
 */
app.put("/api/progression/phase", async (req, res) => {
  try {
    const { phase } = req.body;

    if (typeof phase !== "number" || phase < 1 || phase > 6) {
      return res.status(400).json({ error: 'Phase must be a number between 1 and 6' });
    }

    await progressionEngine.setPhase(phase);
    logger.info('Phase manually updated', { phase });

    res.json({
      success: true,
      phase,
      status: progressionEngine.getStatus()
    });
  } catch (err) {
    logger.error('Failed to set phase', { error: err.message });
    res.status(500).json({ error: 'Failed to set phase' });
  }
});

/**
 * POST /api/progression/metrics - Update progression metrics
 */
app.post("/api/progression/metrics", async (req, res) => {
  try {
    const metrics = req.body;

    if (!metrics || typeof metrics !== 'object') {
      return res.status(400).json({ error: 'Invalid metrics object' });
    }

    const phaseAdvanced = await progressionEngine.updateFederationState(metrics);
    logger.info('Progression metrics updated', { metrics, phaseAdvanced });

    res.json({
      success: true,
      phaseAdvanced,
      currentPhase: progressionEngine.currentPhase,
      metrics: progressionEngine.progressData
    });
  } catch (err) {
    logger.error('Failed to update metrics', { error: err.message });
    res.status(500).json({ error: 'Failed to update metrics' });
  }
});

/**
 * POST /api/progression/metric/:name - Update a specific metric
 */
app.post("/api/progression/metric/:name", (req, res) => {
  try {
    const { name } = req.params;
    const { value, increment } = req.body;

    if (increment !== undefined && typeof increment === "number") {
      progressionEngine.incrementMetric(name, increment);
    } else if (value !== undefined) {
      progressionEngine.updateMetric(name, value);
    } else {
      return res.status(400).json({ error: 'Must provide either value or increment' });
    }

    logger.info('Metric updated', { name, value, increment });

    res.json({
      success: true,
      metric: name,
      value: progressionEngine.progressData[name]
    });
  } catch (err) {
    logger.error('Failed to update metric', { error: err.message, metric: req.params.name });
    res.status(500).json({ error: 'Failed to update metric' });
  }
});

/**
 * POST /api/progression/reset - Reset progression to Phase 1
 */
app.post("/api/progression/reset", async (req, res) => {
  try {
    await progressionEngine.reset();
    logger.warn('Progression engine reset to Phase 1');

    res.json({
      success: true,
      message: 'Progression reset to Phase 1',
      status: progressionEngine.getStatus()
    });
  } catch (err) {
    logger.error('Failed to reset progression', { error: err.message });
    res.status(500).json({ error: 'Failed to reset progression' });
  }
});

/**
 * GET /api/progression/tasks - Get recommended tasks for current phase
 */
app.get("/api/progression/tasks", (req, res) => {
  try {
    const tasks = progressionEngine.getRecommendedTasks();
    const builds = progressionEngine.getRecommendedBuilds();

    res.json({
      phase: progressionEngine.currentPhase,
      recommendedTasks: tasks,
      recommendedBuilds: builds
    });
  } catch (err) {
    logger.error('Failed to get recommended tasks', { error: err.message });
    res.status(500).json({ error: 'Failed to get recommended tasks' });
  }
});

/**
 * GET /api/autonomic - Get autonomic core status
 */
app.get("/api/autonomic", (req, res) => {
  try {
    if (!autonomicCore) {
      return res.status(503).json({ error: 'Autonomic core not initialized' });
    }

    const status = autonomicCore.getStatus();
    res.json(status);
  } catch (err) {
    logger.error('Failed to get autonomic status', { error: err.message });
    res.status(500).json({ error: 'Failed to get autonomic status' });
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
    telemetryIntervals.forEach(interval => clearInterval(interval));
    telemetryWatchers.forEach(watcher => {
      if (typeof watcher.close === 'function') {
        watcher.close();
      }
    });

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

// Plugin Interface for FGDProxyPlayer
const pluginInterface = {
  socket: null,
  connected: false,

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
};

// WebSocket
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Check if this is the FGD plugin
  socket.on('plugin_register', (data) => {
    if (data.plugin === 'FGDProxyPlayer') {
      pluginInterface.socket = socket;
      pluginInterface.connected = true;
      console.log('✅ FGDProxyPlayer plugin connected');

      // Wire plugin to minecraft bridge
      if (minecraftBridge) {
        minecraftBridge.setPluginInterface(pluginInterface);
        console.log('🔗 Plugin interface wired to MinecraftBridge');
      }

      // Handle plugin responses
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

      socket.on('disconnect', () => {
        pluginInterface.connected = false;
        pluginInterface.socket = null;
        console.log('❌ FGDProxyPlayer plugin disconnected');
      });
    }
  });

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

    // Initialize API routes (bot and LLM routes)
    initializeAPIRoutes();

    // Set up file watcher
    setupFileWatcher();

    // Start telemetry ingestion
    startTelemetryPipeline();

    // Surface any secret configuration warnings
    logSecretWarnings(logger);

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
