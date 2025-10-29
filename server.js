import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "data", "fused_knowledge.json");
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

    console.log('✅ System initialized with sample data');
  } catch (err) {
    console.warn('⚠️ Failed to load some data:', err.message);
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

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
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
    const data = await fs.readFile(DATA_PATH, "utf-8");
    res.type("application/json").send(data);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("Unable to read fusion data", err);
    }
    res.json(DEFAULT_FUSION_DATA);
  }
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

const PORT = process.env.PORT || 3000;

async function startServer() {
  await initializeSystem();
  startDataSimulation();

  httpServer.listen(PORT, () => {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   AICraft Cluster Control Panel         ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket: Real-time updates enabled`);
  });
}

startServer();
