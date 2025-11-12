import { logger } from "./logger.js";
import { DEFAULT_PORT } from "./src/config/constants.js";
import { createAppServer } from "./src/config/server.js";
import { ensureDataDirectory, loadSystemData, setupFileWatcher } from "./src/services/data.js";
import { startTelemetryPipeline, cleanupTelemetry, attachNpcEngineTelemetry } from "./src/services/telemetry.js";
import { NPCSystem } from "./src/services/npc_initializer.js";
import { SystemStateManager } from "./src/services/state.js";
import { initClusterRoutes } from "./src/api/cluster.js";
import { initNPCRoutes } from "./src/api/npcs.js";
import { initProgressionRoutes } from "./src/api/progression.js";
import { initHealthRoutes } from "./src/api/health.js";
import { notFoundHandler, globalErrorHandler } from "./src/middleware/errorHandlers.js";
import { initializeWebSocketHandlers } from "./src/websocket/handlers.js";
import { handleLogin, getCurrentUser, authenticate } from "./middleware/auth.js";
import { initBotRoutes } from "./routes/bot.js";
import { initMineflayerRoutes } from "./routes/mineflayer.js";
import { initLLMRoutes } from "./routes/llm.js";
import { logSecretWarnings } from "./security/secrets.js";
import { runStartupValidation } from "./src/services/startup.js";
import { initDatabase, closeDatabase } from "./src/database/connection.js";
import { bindMetricsToNpcEngine, getPrometheusRegistry } from "./src/services/metrics.js";
import { loadAndValidateGovernanceConfig } from "./security/governance_validator.js";
import express from "express";

// Create Express app, HTTP server, and Socket.IO
const { app, httpServer, io } = createAppServer();

// Initialize system components
const npcSystem = new NPCSystem();
const stateManager = new SystemStateManager(io);

/**
 * Initialize all API routes
 */
function initializeAPIRoutes() {
  const apiV1 = express.Router();
  const apiV2 = express.Router();

  // Auth routes (unversioned for compatibility)
  app.post("/api/auth/login", handleLogin);
  app.get("/api/auth/me", authenticate, getCurrentUser);

  // Dashboard and cluster routes remain unversioned for HTML assets
  app.use("/", initClusterRoutes(stateManager, npcSystem));

  const healthRouter = initHealthRoutes(npcSystem, stateManager);
  const npcRouter = initNPCRoutes(npcSystem);
  const progressionRouter = initProgressionRoutes();

  let botRouter = null;
  let mineflayerRouter = null;
  let llmRouter = null;

  if (npcSystem.npcEngine) {
    botRouter = initBotRoutes(npcSystem, io);
    llmRouter = initLLMRoutes(npcSystem.npcEngine, io);
    logger.info('Bot management routes initialized');
    console.log('✅ Bot management routes initialized');
    logger.info('LLM command routes initialized');
    console.log('✅ LLM command routes initialized');

    // Initialize Mineflayer routes if bridge available
    if (npcSystem.mineflayerBridge) {
      mineflayerRouter = initMineflayerRoutes(npcSystem, io);
      logger.info('Mineflayer bot routes initialized');
      console.log('✅ Mineflayer bot routes initialized');
    }
  } else {
    logger.warn('Bot and LLM routes not initialized - NPC Engine not ready');
  }

  const mountRoutes = (router) => {
    router.use("/health", healthRouter);
    router.use("/npcs", npcRouter);
    router.use("/progression", progressionRouter);
    if (botRouter) {
      router.use("/bots", botRouter);
    }
    if (mineflayerRouter) {
      router.use("/mineflayer", mineflayerRouter);
    }
    if (llmRouter) {
      router.use("/llm", llmRouter);
    }
  };

  mountRoutes(apiV1);
  mountRoutes(apiV2);

  app.use("/api", apiV1);
  app.use("/api/v1", apiV1);
  app.use("/api/v2", apiV2);

  // Error handlers
  app.use('/data', notFoundHandler);
  app.use(globalErrorHandler);
}

/**
 * Initialize system with data and telemetry
 */
async function initializeSystem() {
  try {
    // Load system data from files
    const loadedData = await loadSystemData();
    await stateManager.loadInitialData(loadedData);
    stateManager.recomputeSystemStats(npcSystem.npcEngine);

    logger.info('System initialized with sample data');
  } catch (err) {
    logger.warn('Failed to load some data', { error: err.message });
  }
}

/**
 * Gracefully shuts down the server
 */
async function gracefulShutdown(signal) {
  logger.warn('Shutdown signal received', { signal });
  console.log(`\n⚠️  ${signal} received, shutting down gracefully...`);

  try {
    // Cleanup telemetry
    cleanupTelemetry();

    await closeDatabase().catch(err => {
      logger.error('Error closing database during shutdown', { error: err.message });
    });

    // Save NPC system data
    await npcSystem.save();
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

/**
 * Start the server
 */
async function startServer() {
  try {
    // Ensure data directory exists
    await ensureDataDirectory();

    // Initialize system data
    await initializeSystem();

    const systemState = stateManager.getState();

    // Start telemetry before dependent services to satisfy validation order
    startTelemetryPipeline(
      systemState,
      io,
      () => stateManager.recomputeSystemStats(npcSystem.npcEngine)
    );

    await runStartupValidation({
      stateManager,
      npcSystem,
      io,
      initializeDatabase: () => initDatabase(),
      initializeNpcSystem: async () => {
        await npcSystem.initialize(
          io,
          systemState,
          (engine) => attachNpcEngineTelemetry(
            engine,
            systemState,
            io,
            () => stateManager.recomputeSystemStats(npcSystem.npcEngine),
            (entry) => stateManager.appendSystemLog(entry)
          ),
          () => stateManager.recomputeSystemStats(npcSystem.npcEngine)
        );
        bindMetricsToNpcEngine(npcSystem.npcEngine, stateManager);
      }
    });

    await loadAndValidateGovernanceConfig();

    // Initialize API routes (after NPC system is ready)
    initializeAPIRoutes();

    // Initialize WebSocket handlers
    initializeWebSocketHandlers(io, stateManager, npcSystem);

    // Set up file watcher
    setupFileWatcher();

    // Surface any secret configuration warnings
    logSecretWarnings(logger);

    // Expose Prometheus metrics endpoint (before server starts)
    app.get('/metrics', async (req, res) => {
      try {
        const registry = getPrometheusRegistry();
        res.set('Content-Type', registry.contentType);
        res.end(await registry.metrics());
      } catch (err) {
        res.status(500).send(err.message);
      }
    });

    // Start HTTP server
    const PORT = process.env.PORT || DEFAULT_PORT;
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

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start the server
startServer();
